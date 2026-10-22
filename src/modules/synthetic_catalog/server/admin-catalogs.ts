import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma/client";
import { parseCatalogProfileConfig } from "../config/profiles";
import { getCatalogGenerationLimits } from "../config/generation-limits";
import type {
  CatalogDetailView,
  CatalogJobView,
  CatalogOverviewView,
} from "../admin/types";

function jobView(job: {
  id: number;
  publicId: string;
  jobType: string;
  status: string;
  stage: string;
  requestedProducts: number;
  departmentMode: string;
  completedProducts: number;
  failedProducts: number;
  completedImages: number;
  failedImages: number;
  errorMessage: string | null;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  tasks: Array<{
    id: number;
    status: string;
    taskType: string;
    dedupeKey: string;
    attempts: number;
    maxAttempts: number;
    lastError: string | null;
    product: { externalId: string } | null;
    style: { externalId: string } | null;
    imageAsset: { role: string } | null;
  }>;
}): CatalogJobView {
  return {
    id: job.id,
    publicId: job.publicId,
    jobType: job.jobType,
    status: job.status as CatalogJobView["status"],
    stage: job.stage,
    requestedProducts: job.requestedProducts,
    departmentMode: job.departmentMode,
    completedProducts: job.completedProducts,
    failedProducts: job.failedProducts,
    completedImages: job.completedImages,
    failedImages: job.failedImages,
    totalTasks: job.tasks.length,
    completedTasks: job.tasks.filter((task) => task.status === "COMPLETED").length,
    failedTasks: job.tasks.filter((task) => task.status === "FAILED").length,
    createdAt: job.createdAt.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    finishedAt: job.finishedAt?.toISOString() ?? null,
    errorMessage: job.errorMessage,
    failedTaskDetails: job.tasks
      .filter((task) => task.status === "FAILED")
      .map((task) => ({
        id: task.id,
        taskType: task.taskType,
        reference:
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
  tasks: {
    select: {
      id: true,
      status: true,
      taskType: true,
      dedupeKey: true,
      attempts: true,
      maxAttempts: true,
      lastError: true,
      product: { select: { externalId: true } },
      style: { select: { externalId: true } },
      imageAsset: { select: { role: true } },
    },
  },
} satisfies Prisma.CatalogGenerationJobInclude;

export async function getCatalogOverview(): Promise<CatalogOverviewView[]> {
  const generationLimits = getCatalogGenerationLimits();
  const catalogs = await prisma.syntheticCatalog.findMany({
    where: { active: true },
    orderBy: { id: "asc" },
    include: {
      products: {
        select: {
          styles: {
            select: {
              variants: { select: { id: true } },
              images: { select: { status: true } },
            },
          },
        },
      },
      jobs: { orderBy: { createdAt: "desc" }, take: 1, include: jobInclude },
    },
  });

  return catalogs.map((catalog) => {
    const config = parseCatalogProfileConfig(catalog.config);
    const styles = catalog.products.flatMap((product) => product.styles);
    const images = styles.flatMap((style) => style.images);
    return {
      id: catalog.id,
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
      ...generationLimits,
      latestJob: catalog.jobs[0] ? jobView(catalog.jobs[0]) : null,
    };
  });
}

export async function getCatalogDetail(reference: string): Promise<CatalogDetailView | null> {
  const generationLimits = getCatalogGenerationLimits();
  const numericId = /^\d+$/.test(reference) ? Number(reference) : null;
  const catalog = await prisma.syntheticCatalog.findFirst({
    where: numericId == null ? { slug: reference } : { id: numericId },
    include: {
      products: {
        orderBy: { sequence: "desc" },
        include: {
          styles: {
            orderBy: { id: "asc" },
            include: {
              variants: { orderBy: { id: "asc" } },
              images: { orderBy: { role: "asc" } },
            },
          },
        },
      },
      jobs: { orderBy: { createdAt: "desc" }, take: 20, include: jobInclude },
    },
  });
  if (!catalog) return null;

  const config = parseCatalogProfileConfig(catalog.config);
  const [productCount, styleCount, variantCount, readyImages, failedImages] = await Promise.all([
    prisma.syntheticProduct.count({ where: { catalogId: catalog.id } }),
    prisma.syntheticStyle.count({ where: { product: { catalogId: catalog.id } } }),
    prisma.syntheticVariant.count({ where: { style: { product: { catalogId: catalog.id } } } }),
    prisma.syntheticImageAsset.count({ where: { style: { product: { catalogId: catalog.id } }, status: "READY" } }),
    prisma.syntheticImageAsset.count({ where: { style: { product: { catalogId: catalog.id } }, status: "FAILED" } }),
  ]);

  return {
    catalog: {
      id: catalog.id,
      slug: catalog.slug,
      name: catalog.name,
      segment: catalog.segment,
      brandName: catalog.brandName,
      externalPrefix: catalog.externalPrefix,
      defaultTextModel: catalog.defaultTextModel,
      defaultImageModel: catalog.defaultImageModel,
      visualDirection: config.visualDirection,
      estimatedSizesPerProduct: config.sizes.length,
      ...generationLimits,
    },
    counts: { products: productCount, styles: styleCount, variants: variantCount, readyImages, failedImages },
    products: catalog.products.map((product) => {
      const style = product.styles[0];
      return {
        id: product.id,
        externalId: product.externalId,
        name: product.name,
        description: product.description,
        department: product.department,
        category: product.category,
        subcategory: product.subcategory,
        material: product.material,
        season: product.season,
        basePrice: product.basePrice.toFixed(2),
        salePrice: product.salePrice?.toFixed(2) ?? null,
        currency: product.currency,
        status: product.status,
        style: style
          ? {
              id: style.id,
              externalId: style.externalId,
              colorName: style.colorName,
              colorCode: style.colorCode,
              status: style.status,
              variants: style.variants.map((variant) => ({
                id: variant.id,
                externalId: variant.externalId,
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
            }
          : null,
      };
    }),
    jobs: catalog.jobs.map(jobView),
  };
}

export async function enqueueImageRegeneration(imageAssetId: number, createdByMappTeamId?: number) {
  return prisma.$transaction(async (tx) => {
    // Serialize requests for this asset so two near-simultaneous clicks cannot
    // both pass the active-task check and create duplicate LiteLLM spend.
    await tx.$queryRaw`SELECT id FROM synthetic_image_asset WHERE id = ${imageAssetId} FOR UPDATE`;
    const asset = await tx.syntheticImageAsset.findUniqueOrThrow({
      where: { id: imageAssetId },
      include: { style: { include: { product: { include: { catalog: true } } } } },
    });
    const duplicate = await tx.catalogGenerationTask.findFirst({
      where: { imageAssetId, status: { in: ["QUEUED", "RUNNING"] } },
      select: { id: true },
    });
    if (duplicate) throw new Error("This image already has generation work in progress");

    return tx.catalogGenerationJob.create({
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
  });
}
