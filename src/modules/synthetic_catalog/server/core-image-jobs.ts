import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma/client";
import { REQUIRED_CORE_IMAGE_ROLES } from "../providers/image-generator";
import { parseCatalogProfileConfig } from "../config/profiles";

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function createCoreImagesJob(input: {
  catalogId: number;
  sourceJobId?: number;
  allMissing?: boolean;
  createdByMappTeamId?: number;
}) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM synthetic_catalog WHERE id = ${input.catalogId} FOR UPDATE`;
    const catalog = await tx.syntheticCatalog.findUniqueOrThrow({ where: { id: input.catalogId } });
    const config = parseCatalogProfileConfig(catalog.config);
    if (!input.allMissing) {
      if (!input.sourceJobId) throw new Error("Choose a completed catalogue information job");
      const source = await tx.catalogGenerationJob.findUniqueOrThrow({ where: { id: input.sourceJobId } });
      if (source.catalogId !== catalog.id || source.jobType !== "CATALOG_INFO") throw new Error("Source must be a catalogue information job for this catalogue");
      if (source.status !== "COMPLETED" && source.status !== "COMPLETED_WITH_ERRORS") throw new Error("Catalogue information must finish before core images can start");
    }
    const styles = await tx.syntheticStyle.findMany({
      where: {
        product: {
          catalogId: catalog.id,
          archivedAt: null,
          ...(input.allMissing ? {} : { generationJobId: input.sourceJobId }),
        },
      },
      include: { product: true, images: true },
      orderBy: { externalId: "asc" },
    });
    if (styles.length === 0) throw new Error("No active styles are available for core image generation");
    const work: Array<{ styleId: number; productId: number; role: (typeof REQUIRED_CORE_IMAGE_ROLES)[number]; assetId?: number }> = [];
    for (const style of styles) {
      for (const role of REQUIRED_CORE_IMAGE_ROLES) {
        const current = style.images.find((image) => image.role === role);
        if (current?.status === "READY") continue;
        const activeTask = current && await tx.catalogGenerationTask.findFirst({
          where: { imageAssetId: current.id, taskType: "GENERATE_IMAGE", status: { in: ["QUEUED", "RUNNING"] }, job: { status: { in: ["QUEUED", "RUNNING"] } } },
          select: { id: true },
        });
        if (activeTask) throw new Error(`Core image work is already active for ${style.externalId} (${role})`);
        work.push({ styleId: style.id, productId: style.productId, role, ...(current && { assetId: current.id }) });
      }
    }
    if (work.length === 0) throw new Error("All target styles already have their required core images");
    const job = await tx.catalogGenerationJob.create({
      data: {
        catalogId: catalog.id,
        sourceJobId: input.allMissing ? input.sourceJobId ?? null : input.sourceJobId!,
        createdByMappTeamId: input.createdByMappTeamId,
        jobType: "CORE_IMAGES",
        requestedProducts: new Set(work.map((item) => item.productId)).size,
        departmentMode: "AUTO",
        scopeType: input.allMissing ? "ALL_MISSING_CORE_IMAGES" : "SOURCE_BATCH",
        scopeValue: input.sourceJobId ? String(input.sourceJobId) : null,
        colorVariantCount: 1,
        textModel: catalog.defaultTextModel,
        imageModel: catalog.defaultImageModel,
        stage: "IMAGES",
      },
    });
    for (const item of work) {
      const asset = item.assetId
        ? await tx.syntheticImageAsset.update({ where: { id: item.assetId }, data: { status: "QUEUED", errorMessage: null } })
        : await tx.syntheticImageAsset.create({ data: { styleId: item.styleId, role: item.role, status: "QUEUED" } });
      await tx.catalogGenerationTask.create({
        data: {
          jobId: job.id,
          productId: item.productId,
          styleId: item.styleId,
          imageAssetId: asset.id,
          taskType: "GENERATE_IMAGE",
          dedupeKey: `image:${item.styleId}:${item.role}`,
          payload: json({ catalogSnapshot: { brandName: catalog.brandName, segment: catalog.segment, visualDirection: config.visualDirection } }),
        },
      });
    }
    return tx.catalogGenerationJob.findUniqueOrThrow({ where: { id: job.id }, include: { tasks: true } });
  }, { isolationLevel: "Serializable" });
}

export async function getCoreImagesPreflight(input: { catalogId: number; sourceJobId?: number; allMissing?: boolean }) {
  if (!input.allMissing) {
    if (!input.sourceJobId) throw new Error("Choose a catalogue information job");
    const source = await prisma.catalogGenerationJob.findUniqueOrThrow({ where: { id: input.sourceJobId } });
    if (source.catalogId !== input.catalogId || source.jobType !== "CATALOG_INFO" || !["COMPLETED", "COMPLETED_WITH_ERRORS"].includes(source.status)) {
      throw new Error("Choose a completed catalogue information job for this catalogue");
    }
  }
  const styles = await prisma.syntheticStyle.findMany({
    where: { product: { catalogId: input.catalogId, archivedAt: null, ...(input.allMissing ? {} : { generationJobId: input.sourceJobId }) } },
    include: { product: { select: { id: true } }, images: true },
  });
  const needingWork = styles.filter((style) => REQUIRED_CORE_IMAGE_ROLES.some((role) => !style.images.some((image) => image.role === role && image.status === "READY")));
  const missing = needingWork.flatMap((style) => REQUIRED_CORE_IMAGE_ROLES.filter((role) => !style.images.some((image) => image.role === role && image.status === "READY")));
  return {
    products: new Set(needingWork.map((style) => style.product.id)).size,
    styles: needingWork.length,
    expectedImages: missing.length,
  };
}
