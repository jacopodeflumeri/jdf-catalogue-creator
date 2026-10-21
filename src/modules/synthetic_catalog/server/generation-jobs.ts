import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma/client";
import { parseCatalogProfileConfig } from "../config/profiles";
import { formatProductId, formatStyleId, formatVariantId } from "../domain/ids";
import { assertJobTransition } from "../domain/job-state";
import {
  planAssortment,
  plannedProductSchema,
  type DepartmentMode,
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

export const MAX_PRODUCTS_PER_JOB = 100;

export interface CreateGenerationJobInput {
  catalogId: number;
  requestedProducts: number;
  departmentMode?: DepartmentMode;
  textModel?: string;
  imageModel?: string;
  createdByMappTeamId?: number;
  seed?: string;
}

function asInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function validateRequestedProducts(count: number): void {
  if (!Number.isSafeInteger(count) || count < 1 || count > MAX_PRODUCTS_PER_JOB) {
    throw new Error(`Requested products must be between 1 and ${MAX_PRODUCTS_PER_JOB}`);
  }
}

export async function createGenerationJob(input: CreateGenerationJobInput) {
  validateRequestedProducts(input.requestedProducts);
  const departmentMode = input.departmentMode ?? "AUTO";
  const catalog = await prisma.syntheticCatalog.findUniqueOrThrow({
    where: { id: input.catalogId },
  });
  const config = parseCatalogProfileConfig(catalog.config);
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
    `${catalog.slug}:${reservation.first}:${input.requestedProducts}:${departmentMode}`;
  const plan = planAssortment({
    sequences: reservation.sequences,
    departmentMode,
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
      textModel: input.textModel ?? catalog.defaultTextModel,
      imageModel: input.imageModel ?? catalog.defaultImageModel,
      stage: "PRODUCTS",
      tasks: {
        create: plan.map((item) => ({
          taskType: "GENERATE_PRODUCT",
          dedupeKey: `product:${item.sequence}`,
          payload: asInputJson(item),
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
}) {
  const job = await prisma.catalogGenerationJob.findUniqueOrThrow({
    where: { id: input.jobId },
    include: { catalog: true },
  });
  const config = parseCatalogProfileConfig(job.catalog.config);
  const spec = validateGeneratedProductSpec(input.spec, config);
  const departmentCode = input.plan.department === "WOMEN" ? "W" : "M";
  const externalId = formatProductId({
    catalogPrefix: job.catalog.externalPrefix,
    department: departmentCode,
    sequence: input.plan.sequence,
  });
  const styleExternalId = formatStyleId(externalId, spec.colorCode);
  const price = generatePrice(config, input.plan.seed);
  const inventory = generateInventory(config, input.plan.category, input.plan.seed);
  const variantIds = inventory.map((item) => formatVariantId(styleExternalId, item.size));
  if (new Set(variantIds).size !== variantIds.length) {
    throw new Error(`Catalog sizes create colliding variant IDs for style ${styleExternalId}`);
  }

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
        status: "DRAFT",
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
        status: "DRAFT",
      },
    });

    const style = await tx.syntheticStyle.upsert({
      where: { externalId: styleExternalId },
      update: {
        productId: product.id,
        colorName: spec.colorName,
        colorCode: spec.colorCode,
        visualSpec: asInputJson(spec.design),
        status: "DRAFT",
      },
      create: {
        productId: product.id,
        externalId: styleExternalId,
        colorName: spec.colorName,
        colorCode: spec.colorCode,
        visualSpec: asInputJson(spec.design),
        status: "DRAFT",
      },
    });

    for (const role of CATALOG_IMAGE_ROLES) {
      await tx.syntheticImageAsset.upsert({
        where: { styleId_role: { styleId: style.id, role } },
        update: {},
        create: { styleId: style.id, role, status: "QUEUED" },
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

    await tx.catalogGenerationTask.update({
      where: { id: input.taskId },
      data: {
        productId: product.id,
        status: "COMPLETED",
        lastError: null,
        finishedAt: new Date(),
      },
    });
    return product;
  });
}

async function refreshJobState(jobId: number) {
  const job = await prisma.catalogGenerationJob.findUniqueOrThrow({
    where: { id: jobId },
  });
  const [completed, failed, pending] = await Promise.all([
    prisma.catalogGenerationTask.count({ where: { jobId, status: "COMPLETED" } }),
    prisma.catalogGenerationTask.count({ where: { jobId, status: "FAILED" } }),
    prisma.catalogGenerationTask.count({
      where: { jobId, status: { in: ["QUEUED", "RUNNING"] } },
    }),
  ]);
  const nextStatus =
    pending > 0 ? "QUEUED" : failed > 0 ? "COMPLETED_WITH_ERRORS" : "COMPLETED";
  assertJobTransition(job.status, nextStatus);

  return prisma.catalogGenerationJob.update({
    where: { id: jobId },
    data: {
      status: nextStatus,
      stage: pending > 0 ? "PRODUCTS" : "COMPLETE",
      completedProducts: completed,
      failedProducts: failed,
      finishedAt: pending > 0 ? null : new Date(),
    },
    include: { tasks: { orderBy: { id: "asc" } } },
  });
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

  const job = await prisma.catalogGenerationJob.update({
    where: { id: jobId },
    data: {
      status: "RUNNING",
      stage: "PRODUCTS",
      startedAt: existingJob.startedAt ?? new Date(),
      finishedAt: null,
      errorMessage: null,
    },
    include: { catalog: true },
  });
  const config = parseCatalogProfileConfig(job.catalog.config);
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
      const plan = plannedProductSchema.parse(task.payload);
      const spec = await provider.generateProduct({
        model: job.textModel,
        catalog: {
          slug: job.catalog.slug,
          segment: job.catalog.segment,
          brandName: job.catalog.brandName,
          config,
        },
        plan,
      });
      await persistGeneratedProduct({ jobId, taskId: task.id, plan, spec });
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

  return refreshJobState(jobId);
}

export async function resumeGenerationJob(jobId: number) {
  const job = await prisma.catalogGenerationJob.findUniqueOrThrow({
    where: { id: jobId },
  });
  assertJobTransition(job.status, "QUEUED");
  const requeued = await prisma.catalogGenerationTask.updateMany({
    where: {
      jobId,
      status: "FAILED",
      attempts: { lt: 3 },
    },
    data: {
      status: "QUEUED",
      lastError: null,
      finishedAt: null,
    },
  });
  const queued = await prisma.catalogGenerationTask.count({
    where: { jobId, status: "QUEUED" },
  });
  if (queued === 0) {
    throw new Error("Generation job has no resumable tasks");
  }

  const updated = await prisma.catalogGenerationJob.update({
    where: { id: jobId },
    data: {
      status: "QUEUED",
      stage: "PRODUCTS",
      failedProducts: { decrement: requeued.count },
      finishedAt: null,
      errorMessage: null,
    },
    include: { tasks: { orderBy: { id: "asc" } } },
  });
  return updated;
}
