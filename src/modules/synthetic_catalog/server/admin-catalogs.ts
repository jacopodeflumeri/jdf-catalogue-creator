import { Prisma, type Prisma as PrismaTypes } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma/client";
import { catalogCategories, catalogSubcategories, parseCatalogProfileConfig } from "../config/profiles";
import { configuredDepartmentLabel } from "../config/department-label";
import { getCatalogGenerationSettings } from "../config/generation-limits";
import { sizesForCategory } from "../domain/rules";
import { REQUIRED_CORE_IMAGE_ROLES } from "../providers/image-generator";
import type {
  CatalogDetailView,
  CatalogJobView,
  CatalogOverviewView,
  CatalogProductDetailView,
  CatalogProductView,
} from "../admin/types";

const productInclude = {
  styles: {
    orderBy: { id: "asc" },
    include: {
      variants: { orderBy: { id: "asc" } },
      images: { orderBy: { role: "asc" } },
      completeLook: { include: { imageAsset: true, items: { orderBy: { sortOrder: "asc" }, include: { companionStyle: { include: { product: { select: { externalId: true, name: true } } } } } } } },
    },
  },
} satisfies Prisma.SyntheticProductInclude;

type ProductWithRelations = Prisma.SyntheticProductGetPayload<{
  include: typeof productInclude;
}>;

function productView(product: ProductWithRelations, config: ReturnType<typeof parseCatalogProfileConfig>): CatalogProductView {
  return {
    id: product.id,
    archivedAt: product.archivedAt?.toISOString() ?? null,
    externalId: product.externalId,
    name: product.name,
    description: product.description,
    departmentKey: product.department,
    department: configuredDepartmentLabel(config, product.department),
    category: product.category,
    subcategory: product.subcategory,
    material: product.material,
    season: product.season,
    patternCode: product.patternCode,
    embellishmentCodes: Array.isArray(product.embellishmentCodes) ? product.embellishmentCodes.filter((code): code is string => typeof code === "string") : [],
    basePrice: product.basePrice.toFixed(2),
    salePrice: product.salePrice?.toFixed(2) ?? null,
    currency: product.currency,
    status: product.status,
    styles: product.styles.map((style) => ({
          id: style.id,
          externalId: style.externalId,
          colorName: style.colorName,
          colorCode: style.colorCode,
          colorHex: style.colorHex ?? config.colors.find((color) => color.code === style.colorCode)?.hex ?? "#808080",
          status: style.status,
          variants: style.variants.map((variant) => ({
            id: variant.id,
            externalId: variant.externalId,
            sku: variant.sku,
            size: variant.size,
            stock: variant.stock,
            availability: variant.availability,
          })),
          images: style.images.map((image) => ({
            id: image.id,
            publicId: image.publicId,
            role: image.role,
            status: image.status,
            url: image.status === "READY" ? `/api/catalog-assets/${image.publicId}` : null,
            errorMessage: image.errorMessage,
          })),
          completeLook: style.completeLook ? {
            id: style.completeLook.id,
            status: style.completeLook.status,
            reason: style.completeLook.errorMessage ?? style.completeLook.selectionReason,
            imageAssetId: style.completeLook.imageAsset?.id ?? null,
            imagePublicId: style.completeLook.imageAsset?.status === "READY" ? style.completeLook.imageAsset.publicId : null,
            companions: style.completeLook.items.map((item) => ({
              externalId: item.companionStyle.product.externalId,
              name: item.companionStyle.product.name,
              styleExternalId: item.companionStyle.externalId,
              colorName: item.companionStyle.colorName,
              outfitSlot: item.outfitSlot,
            })),
          } : null,
        })),
  };
}

function jobView(job: {
  id: number;
  publicId: string;
  jobType: string;
  status: string;
  stage: string;
  requestedProducts: number;
  departmentMode: string;
  scopeType: string;
  scopeValue: string | null;
  colorVariantCount: number;
  completedProducts: number;
  failedProducts: number;
  completedImages: number;
  failedImages: number;
  skippedImages: number;
  errorMessage: string | null;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
}, counts: { total: number; completed: number; failed: number; queued: number; running: number; readyProducts: number; readyStyles: number }, failedTasks: Array<{
  id: number;
  taskType: string;
  dedupeKey: string;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  product: { externalId: string } | null;
  style: { externalId: string } | null;
  imageAsset: { role: string } | null;
}>): CatalogJobView {
  return {
    id: job.id,
    publicId: job.publicId,
    jobType: job.jobType,
    status: job.status as CatalogJobView["status"],
    stage: job.stage,
    requestedProducts: job.requestedProducts,
    departmentMode: job.departmentMode,
    scopeType: job.scopeType,
    scopeValue: job.scopeValue,
    colorVariantCount: job.colorVariantCount,
    completedProducts: job.completedProducts,
    failedProducts: job.failedProducts,
    completedImages: job.completedImages,
    failedImages: job.failedImages,
    skippedImages: job.skippedImages,
    informationReadyProducts: counts.readyProducts,
    informationReadyStyles: counts.readyStyles,
    totalTasks: counts.total,
    completedTasks: counts.completed,
    failedTasks: counts.failed,
    queuedTasks: counts.queued,
    runningTasks: counts.running,
    createdAt: job.createdAt.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    finishedAt: job.finishedAt?.toISOString() ?? null,
    errorMessage: job.errorMessage,
    failedTaskDetails: failedTasks.map((task) => ({
        id: task.id,
        taskType: task.taskType,
        reference:
          (task.taskType === "PROPOSE_PRODUCT_NAMES" ? "name proposal batch" : null) ??
          task.imageAsset?.role ??
          task.style?.externalId ??
          task.product?.externalId ??
          task.dedupeKey,
        attempts: task.attempts,
        maxAttempts: task.maxAttempts,
        lastError: task.lastError ?? "No failure reason was recorded",
      })),
  };
}

const jobInclude = {
} satisfies PrismaTypes.CatalogGenerationJobInclude;

type CatalogJobRecord = PrismaTypes.CatalogGenerationJobGetPayload<{ include: typeof jobInclude }>;
type FailedTaskRecord = {
  id: number;
  jobId: number;
  taskType: string;
  dedupeKey: string;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  product: { externalId: string } | null;
  style: { externalId: string } | null;
  imageAsset: { role: string } | null;
};

async function jobViews(jobs: CatalogJobRecord[]): Promise<CatalogJobView[]> {
  if (jobs.length === 0) return [];
  const jobIds = jobs.map((job) => job.id);
  const [taskGroups, readyProductGroups, readyStyleGroups] = await Promise.all([
    prisma.catalogGenerationTask.groupBy({
      by: ["jobId", "status"],
      where: { jobId: { in: jobIds } },
      _count: { _all: true },
    }),
    prisma.syntheticProduct.groupBy({
      by: ["generationJobId"],
      where: { generationJobId: { in: jobIds }, archivedAt: null, status: "READY" },
      _count: { _all: true },
    }),
    prisma.$queryRaw<Array<{ generationJobId: number; count: bigint }>>(Prisma.sql`
      SELECT p.generation_job_id AS "generationJobId", COUNT(*) AS count
      FROM synthetic_style s
      INNER JOIN synthetic_product p ON p.id = s.product_id
      WHERE p.generation_job_id IN (${Prisma.join(jobIds)})
        AND p.archived_at IS NULL AND s.status = 'READY'
      GROUP BY p.generation_job_id
    `),
  ]);
  const taskCounts = new Map<number, { total: number; completed: number; failed: number; queued: number; running: number }>();
  for (const row of taskGroups) {
    const counts = taskCounts.get(row.jobId) ?? { total: 0, completed: 0, failed: 0, queued: 0, running: 0 };
    const count = row._count._all;
    counts.total += count;
    if (row.status === "COMPLETED") counts.completed += count;
    if (row.status === "FAILED") counts.failed += count;
    if (row.status === "QUEUED") counts.queued += count;
    if (row.status === "RUNNING") counts.running += count;
    taskCounts.set(row.jobId, counts);
  }
  const readyProducts = new Map(readyProductGroups.flatMap((row) => row.generationJobId == null ? [] : [[row.generationJobId, row._count._all] as const]));
  const readyStyles = new Map(readyStyleGroups.map((row) => [row.generationJobId, Number(row.count)] as const));
  const failedJobIds = [...taskCounts].filter(([, counts]) => counts.failed > 0).map(([jobId]) => jobId);
  const failureRows: FailedTaskRecord[] = failedJobIds.length === 0 ? [] : await prisma.catalogGenerationTask.findMany({
    where: { jobId: { in: failedJobIds }, status: "FAILED" },
    select: {
      id: true, jobId: true, taskType: true, dedupeKey: true, attempts: true, maxAttempts: true, lastError: true,
      product: { select: { externalId: true } },
      style: { select: { externalId: true } },
      imageAsset: { select: { role: true } },
    },
    orderBy: { id: "asc" },
  });
  const failuresByJob = new Map<number, FailedTaskRecord[]>();
  for (const failure of failureRows) failuresByJob.set(failure.jobId, [...(failuresByJob.get(failure.jobId) ?? []), failure]);
  return jobs.map((job) => jobView(job, {
    total: taskCounts.get(job.id)?.total ?? 0,
    completed: taskCounts.get(job.id)?.completed ?? 0,
    failed: taskCounts.get(job.id)?.failed ?? 0,
    queued: taskCounts.get(job.id)?.queued ?? 0,
    running: taskCounts.get(job.id)?.running ?? 0,
    readyProducts: readyProducts.get(job.id) ?? 0,
    readyStyles: readyStyles.get(job.id) ?? 0,
  }, failuresByJob.get(job.id) ?? []));
}

export async function getCatalogOverview(): Promise<CatalogOverviewView[]> {
  const generationSettings = getCatalogGenerationSettings();
  const catalogs = await prisma.syntheticCatalog.findMany({
    where: { active: true },
    orderBy: { id: "asc" },
    include: {
      products: {
        where: { archivedAt: null },
        select: {
          styles: {
            select: {
              variants: { select: { id: true } },
              images: { select: { role: true, status: true } },
            },
          },
        },
      },
      jobs: { orderBy: { createdAt: "desc" }, take: 1, include: jobInclude },
    },
  });

  const latestJobs = await jobViews(catalogs.flatMap((catalog) => catalog.jobs));
  const latestById = new Map(latestJobs.map((job) => [job.id, job]));
  return catalogs.map((catalog) => {
    const config = parseCatalogProfileConfig(catalog.config);
    const styles = catalog.products.flatMap((product) => product.styles);
    const images = styles
      .flatMap((style) => style.images)
      .filter((image) => (REQUIRED_CORE_IMAGE_ROLES as readonly string[]).includes(image.role));
    return {
      id: catalog.id,
      nextProductSequence: catalog.nextProductSequence,
      slug: catalog.slug,
      name: catalog.name,
      segment: catalog.segment,
      brandName: catalog.brandName,
      productCount: catalog.products.length,
      styleCount: styles.length,
      variantCount: styles.reduce((total, style) => total + style.variants.length, 0),
      readyImageCount: images.filter((image) => image.status === "READY").length,
      failedImageCount: images.filter((image) => image.status === "FAILED").length,
      estimatedSizesPerProduct: config.sizes.length,
      departments: config.departments.map(({ key, label }) => ({ key, label })),
      categories: catalogCategories(config),
      categorySizeCounts: Object.fromEntries(catalogCategories(config).map((category) => [category, sizesForCategory(config, category).length])),
      assortmentPlan: config.assortmentPlan.map((row) => ({ ...row })),
      designMix: config.designMix,
      ...generationSettings,
      latestJob: catalog.jobs[0] ? latestById.get(catalog.jobs[0].id) ?? null : null,
    };
  });
}

export async function getCatalogDetail(reference: string): Promise<CatalogDetailView | null> {
  const generationSettings = getCatalogGenerationSettings();
  const numericId = /^\d+$/.test(reference) ? Number(reference) : null;
  const catalog = await prisma.syntheticCatalog.findFirst({
    where: { ...(numericId == null ? { slug: reference } : { id: numericId }), active: true },
    include: {
      products: {
        orderBy: { sequence: "desc" },
        include: productInclude,
      },
      jobs: { orderBy: { createdAt: "desc" }, take: 20, include: jobInclude },
    },
  });
  if (!catalog) return null;

  const config = parseCatalogProfileConfig(catalog.config);
  const [productCount, styleCount, variantCount, readyImages, failedImages, pendingCoreImages, jobs] = await Promise.all([
    prisma.syntheticProduct.count({ where: { catalogId: catalog.id, archivedAt: null } }),
    prisma.syntheticStyle.count({ where: { product: { catalogId: catalog.id, archivedAt: null } } }),
    prisma.syntheticVariant.count({ where: { style: { product: { catalogId: catalog.id, archivedAt: null } } } }),
    prisma.syntheticImageAsset.count({ where: { style: { product: { catalogId: catalog.id, archivedAt: null } }, role: { in: [...REQUIRED_CORE_IMAGE_ROLES] }, status: "READY" } }),
    prisma.syntheticImageAsset.count({ where: { style: { product: { catalogId: catalog.id, archivedAt: null } }, role: { in: [...REQUIRED_CORE_IMAGE_ROLES] }, status: "FAILED" } }),
    prisma.syntheticImageAsset.count({ where: { style: { product: { catalogId: catalog.id, archivedAt: null } }, role: { in: [...REQUIRED_CORE_IMAGE_ROLES] }, status: { in: ["QUEUED", "GENERATING"] } } }),
    jobViews(catalog.jobs),
  ]);

  return {
    catalog: {
      id: catalog.id,
      slug: catalog.slug,
      name: catalog.name,
      segment: catalog.segment,
      brandName: catalog.brandName,
      externalPrefix: catalog.externalPrefix,
      nextProductSequence: catalog.nextProductSequence,
      defaultTextModel: catalog.defaultTextModel,
      defaultImageModel: catalog.defaultImageModel,
      visualDirection: config.visualDirection,
      estimatedSizesPerProduct: config.sizes.length,
      departments: config.departments.map((department) => ({ ...department })),
      categories: catalogCategories(config),
      categorySizeCounts: Object.fromEntries(catalogCategories(config).map((category) => [category, sizesForCategory(config, category).length])),
      subcategories: catalogSubcategories(config),
      assortmentPlan: config.assortmentPlan.map((row) => ({ ...row })),
      designMix: config.designMix,
      ...generationSettings,
    },
    counts: { products: productCount, styles: styleCount, variants: variantCount, readyImages, failedImages, readyCoreImages: readyImages, failedCoreImages: failedImages, pendingCoreImages },
    products: catalog.products.map((product) => productView(product, config)),
    jobs,
  };
}

export async function getCatalogProductDetail(
  catalogReference: string,
  productReference: string,
): Promise<CatalogProductDetailView | null> {
  const numericCatalogId = /^\d+$/.test(catalogReference) ? Number(catalogReference) : null;
  const catalog = await prisma.syntheticCatalog.findFirst({
    where: { ...(numericCatalogId == null ? { slug: catalogReference } : { id: numericCatalogId }), active: true },
    select: { id: true, slug: true, name: true, segment: true, brandName: true },
  });
  if (!catalog) return null;

  const numericProductId = /^\d+$/.test(productReference) ? Number(productReference) : null;
  const product = await prisma.syntheticProduct.findFirst({
    where: {
      catalogId: catalog.id,
      ...(numericProductId == null
        ? { externalId: productReference }
        : { id: numericProductId }),
    },
    include: productInclude,
  });
  if (!product) return null;

  const current = await prisma.syntheticCatalog.findUniqueOrThrow({ where: { id: catalog.id }, select: { config: true } });
  return { catalog, product: productView(product, parseCatalogProfileConfig(current.config)) };
}

export async function enqueueImageRegeneration(imageAssetId: number, createdByMappTeamId?: number) {
  return prisma.$transaction(async (tx) => {
    // Serialize requests for this asset so two near-simultaneous clicks cannot
    // both pass the active-task check and create duplicate LiteLLM spend.
    await tx.$queryRaw`SELECT c.id FROM synthetic_catalog c JOIN synthetic_product p ON p.catalog_id = c.id JOIN synthetic_style s ON s.product_id = p.id JOIN synthetic_image_asset a ON a.style_id = s.id WHERE a.id = ${imageAssetId} FOR UPDATE OF c`;
    await tx.$queryRaw`SELECT id FROM synthetic_image_asset WHERE id = ${imageAssetId} FOR UPDATE`;
    const asset = await tx.syntheticImageAsset.findUniqueOrThrow({
      where: { id: imageAssetId },
      include: { style: { include: { product: { include: { catalog: true } } } } },
    });
    if (!asset.style.product.catalog.active) throw new Error("Catalogue is not active");
    if (asset.style.product.archivedAt) throw new Error("Restore this product before regenerating its images");
    if (asset.role === "COMPLETE_LOOK") {
      const look = await tx.syntheticCompleteLook.findUnique({ where: { imageAssetId: asset.id } });
      if (!look || look.status === "STALE" || look.status === "SKIPPED") throw new Error("This Complete the Look must be replanned before its image can be regenerated");
    }
    const duplicate = await tx.catalogGenerationTask.findFirst({
      where: { imageAssetId, status: { in: ["QUEUED", "RUNNING"] } },
      select: { id: true },
    });
    if (duplicate) throw new Error("This image already has generation work in progress");

    const job = await tx.catalogGenerationJob.create({
      data: {
        catalogId: asset.style.product.catalogId,
        createdByMappTeamId,
        jobType: "REGENERATE_IMAGE",
        requestedProducts: 0,
        departmentMode: "AUTO",
        textModel: asset.style.product.catalog.defaultTextModel,
        imageModel: asset.style.product.catalog.defaultImageModel,
        stage: "IMAGES",
        tasks: {
          create: {
            productId: asset.style.productId,
            styleId: asset.styleId,
            imageAssetId: asset.id,
            taskType: "GENERATE_IMAGE",
            dedupeKey: `regenerate:${asset.publicId}`,
            payload: { regeneration: true },
          },
        },
      },
    });
    await tx.syntheticImageAsset.update({
      where: { id: asset.id },
      data: { status: "QUEUED", errorMessage: null },
    });
    if (asset.role === "COMPLETE_LOOK") await tx.syntheticCompleteLook.updateMany({ where: { imageAssetId: asset.id }, data: { status: "QUEUED", errorMessage: null } });
    return job;
  });
}
