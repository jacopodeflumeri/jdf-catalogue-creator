/** @jest-environment node */

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma/client";
import { disconnectPrisma, requireTestDatabase, truncateAllTables } from "@test/utils/db";
import { CATALOG_PROFILES } from "../../config/profiles";
import { getCatalogueDashboard } from "../dashboard";

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

describe("catalogue Dashboard database aggregation", () => {
  beforeAll(() => requireTestDatabase());
  beforeEach(() => truncateAllTables());
  afterAll(() => disconnectPrisma());

  it("aggregates active persisted inventory, valid looks, timeframe activity, stage jobs, and bounded recent work", async () => {
    const profile = CATALOG_PROFILES[0];
    const catalog = await prisma.syntheticCatalog.create({ data: {
      slug: profile.slug, name: profile.name, segment: profile.segment, brandName: profile.brandName,
      externalPrefix: profile.externalPrefix, config: json(profile.config),
      defaultTextModel: profile.defaultTextModel, defaultImageModel: profile.defaultImageModel,
    } });
    await prisma.syntheticCatalog.create({ data: {
      slug: "inactive-tombstone", name: "Inactive", segment: "Test", brandName: "Inactive",
      externalPrefix: "INA", config: json(profile.config), defaultTextModel: profile.defaultTextModel,
      defaultImageModel: profile.defaultImageModel, active: false,
    } });
    const now = new Date("2026-11-12T12:00:00.000Z");
    const createdAt = new Date("2026-11-05T12:00:00.000Z");
    const infoJob = await prisma.catalogGenerationJob.create({ data: {
      catalogId: catalog.id, jobType: "CATALOG_INFO", requestedProducts: 2, textModel: catalog.defaultTextModel,
      imageModel: catalog.defaultImageModel, status: "COMPLETED", stage: "COMPLETE", createdAt,
      startedAt: new Date("2026-11-05T12:01:00.000Z"), finishedAt: new Date("2026-11-05T12:02:00.000Z"),
    } });
    const coreJob = await prisma.catalogGenerationJob.create({ data: {
      catalogId: catalog.id, jobType: "CORE_IMAGES", requestedProducts: 0, textModel: catalog.defaultTextModel,
      imageModel: catalog.defaultImageModel, status: "COMPLETED_WITH_ERRORS", stage: "COMPLETE", createdAt,
      startedAt: new Date("2026-11-05T12:00:00.000Z"), finishedAt: new Date("2026-11-05T12:02:00.000Z"),
    } });
    const lookJob = await prisma.catalogGenerationJob.create({ data: {
      catalogId: catalog.id, jobType: "COMPLETE_LOOK", requestedProducts: 0, textModel: catalog.defaultTextModel,
      imageModel: catalog.defaultImageModel, status: "COMPLETED", stage: "COMPLETE", createdAt,
      startedAt: new Date("2026-11-05T12:00:00.000Z"), finishedAt: new Date("2026-11-05T12:00:30.000Z"),
    } });
    await prisma.catalogGenerationJob.create({ data: {
      catalogId: catalog.id, jobType: "RETRY", requestedProducts: 0, textModel: catalog.defaultTextModel,
      imageModel: catalog.defaultImageModel, status: "CANCELLED", stage: "COMPLETE", createdAt,
      startedAt: new Date("2026-11-05T12:00:00.000Z"), finishedAt: new Date("2026-11-05T11:59:00.000Z"),
    } });
    await prisma.catalogGenerationJob.create({ data: {
      catalogId: catalog.id, jobType: "BULK_RENAME", requestedProducts: 0, textModel: catalog.defaultTextModel,
      imageModel: catalog.defaultImageModel, status: "RUNNING", stage: "PRODUCTS", createdAt,
      startedAt: new Date("2026-11-05T12:00:00.000Z"),
    } });

    const products = await Promise.all([1, 2].map((sequence) => prisma.syntheticProduct.create({ data: {
      catalogId: catalog.id, generationJobId: infoJob.id, sequence, externalId: `PRE-W-00000${sequence}`,
      name: `Product ${sequence}`, description: "Test product", department: "WOMEN", category: "tops",
      subcategory: "shirts", material: "cotton", season: "SS26", basePrice: "20.00", status: "READY", createdAt,
    } })));
    const [anchor, companion] = await Promise.all(products.map((product, index) => prisma.syntheticStyle.create({ data: {
      productId: product.id, externalId: `${product.externalId}-NAVY`, colorName: "Navy", colorCode: "NAVY", status: "READY",
      variants: { create: { externalId: `${product.externalId}-NAVY-M`, sku: `${product.externalId}-NAVY-M`, size: "M", stock: 1, availability: "IN_STOCK" } },
      images: { create: ["FRONT", "BACK"].map((role) => ({
        role: role as "FRONT" | "BACK", status: "READY", publicId: `${product.externalId}-${role}`,
        storageKey: `public/catalogs/${catalog.slug}/${product.externalId}-${role}.webp`, generatedAt: createdAt,
      })).concat(index === 0 ? [{
        role: "COMPLETE_LOOK" as const, status: "READY" as const, publicId: "look-ready",
        storageKey: `public/catalogs/${catalog.slug}/look-ready.webp`, generatedAt: createdAt,
      }] : []) },
    } })));
    const lookImage = await prisma.syntheticImageAsset.findFirstOrThrow({ where: { styleId: anchor.id, role: "COMPLETE_LOOK" } });
    const look = await prisma.syntheticCompleteLook.create({ data: {
      anchorStyleId: anchor.id, imageAssetId: lookImage.id, status: "READY",
      items: { create: { companionStyleId: companion.id, outfitSlot: "BOTTOM", sortOrder: 0 } },
    } });
    await prisma.catalogGenerationTask.createMany({ data: [
      { jobId: coreJob.id, imageAssetId: await prisma.syntheticImageAsset.findFirstOrThrow({ where: { styleId: anchor.id, role: "FRONT" } }).then((image) => image.id), taskType: "GENERATE_IMAGE", status: "COMPLETED", dedupeKey: "front" },
      { jobId: lookJob.id, imageAssetId: lookImage.id, taskType: "GENERATE_IMAGE", status: "COMPLETED", dedupeKey: "look" },
    ] });
    await prisma.syntheticProduct.create({ data: {
      catalogId: catalog.id, sequence: 3, externalId: "PRE-W-000003", name: "Archived", description: "Archived product",
      department: "WOMEN", category: "tops", subcategory: "shirts", material: "cotton", season: "SS26", basePrice: "20.00",
      status: "READY", archivedAt: createdAt, createdAt,
      styles: { create: { externalId: "PRE-W-000003-NAVY", colorName: "Navy", colorCode: "NAVY", status: "READY",
        variants: { create: { externalId: "PRE-W-000003-NAVY-M", sku: "PRE-W-000003-NAVY-M", size: "M", stock: 1, availability: "IN_STOCK" } },
        images: { create: { role: "FRONT", status: "READY", publicId: "archived-image", storageKey: "archived.webp", generatedAt: createdAt } },
      } },
    } });

    const result = await getCatalogueDashboard("30d", now);
    expect(result.inventory).toMatchObject({ catalogues: 1, products: 2, styles: 2, variants: 2, readyImages: 5, readyLooks: 1, archivedProducts: 1 });
    expect(result.catalogues[0]).toMatchObject({ productCount: 2, styleCount: 2, readyCoreStyles: 2, readyLooks: 1, eligibleLookStyles: 2 });
    expect(result.activity).toMatchObject({ productsCreated: 2, imagesCompleted: 5, jobsCompleted: 3, jobsFailedOrCancelled: 1, successRate: 0.75, cumulativeProcessingMs: 210_000 });
    expect(result.stages.map(({ stage }) => stage)).toEqual(["CATALOG_INFO", "CORE_IMAGES", "COMPLETE_LOOK"]);
    expect(result.stages.find(({ stage }) => stage === "CATALOG_INFO")).toMatchObject({ producedUnits: 2, averageDurationMs: 60_000 });
    expect(result.stages.find(({ stage }) => stage === "CORE_IMAGES")).toMatchObject({ producedUnits: 1, completedJobs: 1 });
    expect(result.stages.find(({ stage }) => stage === "COMPLETE_LOOK")).toMatchObject({ producedUnits: 1, medianDurationMs: 30_000 });
    expect(result.recentJobs).toHaveLength(5);
    expect(result.recentJobs[0].id).toBeGreaterThan(result.recentJobs[1].id);
    expect(result.range.from?.toISOString()).toBe("2026-10-13T12:00:00.000Z");
    expect(look.id).toBeGreaterThan(0);
  });
});
