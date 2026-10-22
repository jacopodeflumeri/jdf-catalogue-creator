import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma/client";
import { parseCatalogProfileConfig } from "../config/profiles";
import { formatProductId, formatStyleId, formatVariantId } from "../domain/ids";
import { assertJobTransition } from "../domain/job-state";
import {
  planAssortment,
  plannedProductSchema,
  type DepartmentMode,
  type GenerationScope,
  type PlannedProduct,
} from "../domain/planner";
import { generateInventory, generatePrice } from "../domain/rules";
import {
  validateGeneratedProductSpec,
  type GeneratedProductSpec,
  type ProductGenerator,
} from "../providers/product-generator";
import { reserveProductSequenceRange } from "./sequence-reservation";
import { CATALOG_IMAGE_ROLES } from "../providers/image-generator";
import { getCatalogGenerationLimits } from "../config/generation-limits";
import { selectStyleColors, snapshotGenerationSettings } from "../domain/colors";

export interface CreateGenerationJobInput {
  catalogId: number;
  requestedProducts: number;
  departmentMode?: DepartmentMode;
  scope?: GenerationScope;
  colorVariantCount?: 1 | 2 | 3;
  textModel?: string;
  imageModel?: string;
  createdByMappTeamId?: number;
  seed?: string;
}

function asInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function validateRequestedProducts(count: number): void {
  const { maxProductsPerJob } = getCatalogGenerationLimits();
  if (!Number.isSafeInteger(count) || count < 1 || count > maxProductsPerJob) {
    throw new Error(`Requested products must be between 1 and ${maxProductsPerJob}`);
  }
}

export async function createGenerationJob(input: CreateGenerationJobInput) {
  validateRequestedProducts(input.requestedProducts);
  const departmentMode = input.departmentMode ?? "AUTO";
  const scope = input.scope ?? (departmentMode === "AUTO" ? { type: "ALL" as const } : { type: "DEPARTMENT" as const, departmentKey: departmentMode });
  const colorVariantCount = input.colorVariantCount ?? 1;
  if (![1, 2, 3].includes(colorVariantCount)) throw new Error("Color variants must be 1, 2, or 3");
  const catalog = await prisma.syntheticCatalog.findUniqueOrThrow({
    where: { id: input.catalogId },
  });
  const config = parseCatalogProfileConfig(catalog.config);
  if (colorVariantCount > config.colors.length) throw new Error("Catalog palette has fewer colors than requested variants");
  if (scope.type === "DEPARTMENT" && !config.departments.some((department) => department.key === scope.departmentKey)) throw new Error("Selected department is not configured for this catalog");
  if (scope.type === "CATEGORY" && !config.categories.includes(scope.category)) throw new Error("Selected category is not configured for this catalog");
  const existingProducts = await prisma.syntheticProduct.count({
    where: { catalogId: catalog.id },
  });

  // Reservation deliberately happens before job creation. If a later write
  // fails, the gap remains and those external IDs are never recycled.
  const reservation = await reserveProductSequenceRange(
    catalog.id,
    input.requestedProducts,
  );
  const seed =
    input.seed ??
    `${catalog.slug}:${reservation.first}:${input.requestedProducts}:${JSON.stringify(scope)}:${colorVariantCount}`;
  const plan = planAssortment({
    sequences: reservation.sequences,
    scope,
    config,
    seed,
  });

  return prisma.catalogGenerationJob.create({
    data: {
      catalogId: catalog.id,
      createdByMappTeamId: input.createdByMappTeamId,
      jobType:
        existingProducts === 0 && reservation.first === 1 ? "INITIAL" : "ADD_PRODUCTS",
      requestedProducts: input.requestedProducts,
      departmentMode,
      scopeType: scope.type,
      scopeValue: scope.type === "DEPARTMENT" ? scope.departmentKey : scope.type === "CATEGORY" ? scope.category : null,
      colorVariantCount,
      textModel: input.textModel ?? catalog.defaultTextModel,
      imageModel: input.imageModel ?? catalog.defaultImageModel,
      stage: "PRODUCTS",
      tasks: {
        create: plan.map((item) => ({
          taskType: "GENERATE_PRODUCT",
          dedupeKey: `product:${item.sequence}`,
          payload: asInputJson({
            plan: { ...item, departmentCode: config.departments.find((department) => department.key === item.department)!.code },
            colorVariantCount,
            configSnapshot: snapshotGenerationSettings(config),
          }),
        })),
      },
    },
    include: { tasks: { orderBy: { id: "asc" } } },
  });
}

async function persistGeneratedProduct(input: {
  jobId: number;
  taskId: number;
  plan: PlannedProduct;
  spec: GeneratedProductSpec;
  colorVariantCount: 1 | 2 | 3;
  configSnapshot: ReturnType<typeof snapshotGenerationSettings>;
}) {
  const job = await prisma.catalogGenerationJob.findUniqueOrThrow({
    where: { id: input.jobId },
    include: { catalog: true },
  });
  const config = input.configSnapshot;
  const spec = validateGeneratedProductSpec(input.spec, config);
  const departmentCode = (input.plan as PlannedProduct & { departmentCode?: string }).departmentCode ?? config.departments.find((department) => department.key === input.plan.department)?.code;
  if (!departmentCode) throw new Error(`Department '${input.plan.department}' is no longer configured`);
  const externalId = formatProductId({
    catalogPrefix: job.catalog.externalPrefix,
    department: departmentCode,
    sequence: input.plan.sequence,
  });
  const price = generatePrice(config, input.plan.seed);
  const selectedColors = input.colorVariantCount === 1
    ? [config.colors.find((color) => color.code === spec.colorCode)!]
    : selectStyleColors({ palette: config.colors, primaryColorCode: spec.colorCode, count: input.colorVariantCount, seed: input.plan.seed });

  return prisma.$transaction(async (tx) => {
    const product = await tx.syntheticProduct.upsert({
      where: {
        catalogId_sequence: {
          catalogId: job.catalogId,
          sequence: input.plan.sequence,
        },
      },
      update: {
        generationJobId: job.id,
        externalId,
        name: spec.name,
        description: spec.description,
        department: input.plan.department,
        category: input.plan.category,
        subcategory: input.plan.subcategory,
        material: spec.material,
        season: spec.season,
        basePrice: price.basePrice,
        salePrice: price.salePrice,
        currency: price.currency,
        productUrl: `/catalogs/${job.catalog.slug}/products/${externalId}`,
        status: "GENERATING",
      },
      create: {
        catalogId: job.catalogId,
        generationJobId: job.id,
        sequence: input.plan.sequence,
        externalId,
        name: spec.name,
        description: spec.description,
        department: input.plan.department,
        category: input.plan.category,
        subcategory: input.plan.subcategory,
        material: spec.material,
        season: spec.season,
        basePrice: price.basePrice,
        salePrice: price.salePrice,
        currency: price.currency,
        productUrl: `/catalogs/${job.catalog.slug}/products/${externalId}`,
        status: "GENERATING",
      },
    });

    for (const color of selectedColors) {
      const styleExternalId = formatStyleId(externalId, color.code);
      const inventory = generateInventory(config, input.plan.category, `${input.plan.seed}:color:${color.code}`);
      const variantIds = inventory.map((item) => formatVariantId(styleExternalId, item.size));
      if (new Set(variantIds).size !== variantIds.length) throw new Error(`Catalog sizes create colliding variant IDs for style ${styleExternalId}`);
      const style = await tx.syntheticStyle.upsert({
        where: { externalId: styleExternalId },
        update: { productId: product.id, colorName: color.name, colorCode: color.code, visualSpec: asInputJson(spec.design), status: "GENERATING" },
        create: { productId: product.id, externalId: styleExternalId, colorName: color.name, colorCode: color.code, visualSpec: asInputJson(spec.design), status: "GENERATING" },
      });
      for (const role of CATALOG_IMAGE_ROLES) {
      const imageAsset = await tx.syntheticImageAsset.upsert({
        where: { styleId_role: { styleId: style.id, role } },
        update: {},
        create: { styleId: style.id, role, status: "QUEUED" },
      });
      const frozenCatalog = { brandName: job.catalog.brandName, segment: job.catalog.segment, visualDirection: config.visualDirection };
      await tx.catalogGenerationTask.upsert({
        where: {
          jobId_dedupeKey: {
            jobId: job.id,
            dedupeKey: `image:${style.externalId}:${role}`,
          },
        },
        update: {
          productId: product.id,
          styleId: style.id,
          imageAssetId: imageAsset.id,
          payload: asInputJson({ catalogSnapshot: frozenCatalog }),
        },
        create: {
          jobId: job.id,
          productId: product.id,
          styleId: style.id,
          imageAssetId: imageAsset.id,
          taskType: "GENERATE_IMAGE",
          dedupeKey: `image:${style.externalId}:${role}`,
          payload: asInputJson({ catalogSnapshot: frozenCatalog }),
        },
      });
      }
      for (let index = 0; index < inventory.length; index += 1) {
      const item = inventory[index]!;
      const variantExternalId = variantIds[index]!;
      await tx.syntheticVariant.upsert({
        where: { externalId: variantExternalId },
        update: {
          styleId: style.id,
          sku: variantExternalId,
          size: item.size,
          stock: item.stock,
          availability: item.availability,
        },
        create: {
          styleId: style.id,
          externalId: variantExternalId,
          sku: variantExternalId,
          size: item.size,
          stock: item.stock,
          availability: item.availability,
        },
      });
    }
    }

    await tx.catalogGenerationTask.update({
      where: { id: input.taskId },
      data: {
        productId: product.id,
        status: "COMPLETED",
        lockedAt: null,
        lockedBy: null,
        lastError: null,
        finishedAt: new Date(),
      },
    });
    return product;
  });
}

export async function refreshGenerationJobState(jobId: number) {
  return prisma.$transaction(async (tx) => {
    // Serialize aggregate refreshes per job. Without this row lock, two workers
    // can count at different moments and let an older RUNNING snapshot overwrite
    // a later COMPLETED update.
    await tx.$queryRaw`SELECT id FROM catalog_generation_job WHERE id = ${jobId} FOR UPDATE`;
    const job = await tx.catalogGenerationJob.findUniqueOrThrow({ where: { id: jobId } });
    const taskCount = (
      taskType: "GENERATE_PRODUCT" | "GENERATE_IMAGE" | "VALIDATE_PRODUCT",
      status: "COMPLETED" | "FAILED" | { in: ("QUEUED" | "RUNNING")[] },
    ) => tx.catalogGenerationTask.count({ where: { jobId, taskType, status } });
    const [
      completedProducts,
      failedProducts,
      pendingProducts,
      completedImages,
      failedImages,
      pendingImages,
      failedValidation,
      pendingValidation,
    ] = await Promise.all([
      taskCount("GENERATE_PRODUCT", "COMPLETED"),
      taskCount("GENERATE_PRODUCT", "FAILED"),
      taskCount("GENERATE_PRODUCT", { in: ["QUEUED", "RUNNING"] }),
      taskCount("GENERATE_IMAGE", "COMPLETED"),
      taskCount("GENERATE_IMAGE", "FAILED"),
      taskCount("GENERATE_IMAGE", { in: ["QUEUED", "RUNNING"] }),
      taskCount("VALIDATE_PRODUCT", "FAILED"),
      taskCount("VALIDATE_PRODUCT", { in: ["QUEUED", "RUNNING"] }),
    ]);
    const pending = pendingProducts + pendingImages + pendingValidation;
    const failed = failedProducts + failedImages + failedValidation;

    if (job.status === "CANCELLED") {
      return tx.catalogGenerationJob.findUniqueOrThrow({
        where: { id: jobId },
        include: { tasks: { orderBy: { id: "asc" } } },
      });
    }

    const nextStatus =
      pending > 0 ? "RUNNING" : failed > 0 ? "COMPLETED_WITH_ERRORS" : "COMPLETED";
    const nextStage =
      pendingProducts > 0
        ? "PRODUCTS"
        : pendingImages > 0
          ? "IMAGES"
          : pendingValidation > 0
            ? "VALIDATING"
            : "COMPLETE";

    return tx.catalogGenerationJob.update({
      where: { id: jobId },
      data: {
        status: nextStatus,
        stage: nextStage,
        completedProducts,
        failedProducts,
        completedImages,
        failedImages,
        startedAt: job.startedAt ?? (nextStatus === "RUNNING" ? new Date() : null),
        finishedAt: pending > 0 ? null : new Date(),
      },
      include: { tasks: { orderBy: { id: "asc" } } },
    });
  });
}

export async function processProductGenerationTask(
  taskId: number,
  provider: ProductGenerator,
) {
  const task = await prisma.catalogGenerationTask.findUniqueOrThrow({
    where: { id: taskId },
    include: { job: { include: { catalog: true } } },
  });
  if (task.taskType !== "GENERATE_PRODUCT") {
    throw new Error(`Task ${task.id} is not a product-generation task`);
  }
  if (task.job.status === "CANCELLED") {
    throw new Error(`Generation job ${task.jobId} is cancelled`);
  }
  const payload = task.payload && typeof task.payload === "object" && !Array.isArray(task.payload)
    ? task.payload as Record<string, unknown>
    : {};
  const rawPlan = "plan" in payload ? payload.plan : task.payload;
  const plan = plannedProductSchema.parse(rawPlan) as PlannedProduct & { departmentCode?: string };
  if (rawPlan && typeof rawPlan === "object" && !Array.isArray(rawPlan) && "departmentCode" in rawPlan && typeof rawPlan.departmentCode === "string") {
    plan.departmentCode = rawPlan.departmentCode;
  }
  const config = "configSnapshot" in payload
    ? parseCatalogProfileConfig(payload.configSnapshot)
    : parseCatalogProfileConfig(task.job.catalog.config);
  const colorVariantCount: 1 | 2 | 3 = payload.colorVariantCount === 2 || payload.colorVariantCount === 3
    ? payload.colorVariantCount
    : 1;
  const spec = await provider.generateProduct({
    model: task.job.textModel,
    catalog: {
      slug: task.job.catalog.slug,
      segment: task.job.catalog.segment,
      brandName: task.job.catalog.brandName,
      config,
    },
    plan,
  });
  return persistGeneratedProduct({ jobId: task.jobId, taskId: task.id, plan, spec, colorVariantCount, configSnapshot: snapshotGenerationSettings(config) });
}

export async function runGenerationJob(
  jobId: number,
  provider: ProductGenerator,
  options: { maxTasks?: number } = {},
) {
  const existingJob = await prisma.catalogGenerationJob.findUniqueOrThrow({
    where: { id: jobId },
  });
  if (existingJob.status === "COMPLETED" || existingJob.status === "CANCELLED") {
    return prisma.catalogGenerationJob.findUniqueOrThrow({
      where: { id: jobId },
      include: { tasks: { orderBy: { id: "asc" } } },
    });
  }
  assertJobTransition(existingJob.status, "RUNNING");
  if (options.maxTasks != null && (!Number.isSafeInteger(options.maxTasks) || options.maxTasks < 1)) {
    throw new Error("maxTasks must be a positive safe integer");
  }

  await prisma.catalogGenerationJob.update({
    where: { id: jobId },
    data: {
      status: "RUNNING",
      stage: "PRODUCTS",
      startedAt: existingJob.startedAt ?? new Date(),
      finishedAt: null,
      errorMessage: null,
    },
  });
  const tasks = await prisma.catalogGenerationTask.findMany({
    where: { jobId, taskType: "GENERATE_PRODUCT", status: "QUEUED" },
    orderBy: { id: "asc" },
    ...(options.maxTasks != null && { take: options.maxTasks }),
  });

  for (const task of tasks) {
    await prisma.catalogGenerationTask.update({
      where: { id: task.id },
      data: {
        status: "RUNNING",
        attempts: { increment: 1 },
        startedAt: task.startedAt ?? new Date(),
        finishedAt: null,
      },
    });

    try {
      await processProductGenerationTask(task.id, provider);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown product generation error";
      await prisma.catalogGenerationTask.update({
        where: { id: task.id },
        data: {
          status: "FAILED",
          lastError: message.slice(0, 2000),
          finishedAt: new Date(),
        },
      });
    }
  }

  return refreshGenerationJobState(jobId);
}

export async function resumeGenerationJob(jobId: number) {
  const job = await prisma.catalogGenerationJob.findUniqueOrThrow({
    where: { id: jobId },
  });
  assertJobTransition(job.status, "QUEUED");
  const resumable = await prisma.catalogGenerationTask.findMany({
    where: { jobId, status: "FAILED" },
    select: { id: true, taskType: true, imageAssetId: true },
  });
  if (resumable.length === 0) {
    throw new Error("Generation job has no resumable tasks");
  }
  await prisma.catalogGenerationTask.updateMany({
    where: { id: { in: resumable.map((task) => task.id) } },
    data: {
      status: "QUEUED",
      attempts: 0,
      availableAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      lastError: null,
      finishedAt: null,
    },
  });
  const imageAssetIds = resumable.flatMap((task) =>
    task.imageAssetId == null ? [] : [task.imageAssetId],
  );
  if (imageAssetIds.length > 0) {
    await prisma.syntheticImageAsset.updateMany({
      where: { id: { in: imageAssetIds } },
      data: { status: "QUEUED", errorMessage: null },
    });
  }
  const [failedProducts, failedImages] = await Promise.all([
    prisma.catalogGenerationTask.count({
      where: { jobId, taskType: "GENERATE_PRODUCT", status: "FAILED" },
    }),
    prisma.catalogGenerationTask.count({
      where: { jobId, taskType: "GENERATE_IMAGE", status: "FAILED" },
    }),
  ]);

  const updated = await prisma.catalogGenerationJob.update({
    where: { id: jobId },
    data: {
      status: "QUEUED",
      stage: resumable.some((task) => task.taskType === "GENERATE_PRODUCT")
        ? "PRODUCTS"
        : "IMAGES",
      failedProducts,
      failedImages,
      finishedAt: null,
      errorMessage: null,
    },
    include: { tasks: { orderBy: { id: "asc" } } },
  });
  return updated;
}
