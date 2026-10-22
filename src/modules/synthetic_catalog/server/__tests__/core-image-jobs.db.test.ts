/** @jest-environment node */

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma/client";
import { disconnectPrisma, requireTestDatabase, truncateAllTables } from "@test/utils/db";
import { CATALOG_PROFILES } from "../../config/profiles";
import { createCoreImagesJob } from "../core-image-jobs";

const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

async function fixture() {
  const profile = CATALOG_PROFILES[0]!;
  const catalog = await prisma.syntheticCatalog.create({ data: {
    slug: profile.slug, name: profile.name, segment: profile.segment, brandName: profile.brandName,
    externalPrefix: profile.externalPrefix, config: json(profile.config), defaultTextModel: profile.defaultTextModel,
    defaultImageModel: profile.defaultImageModel,
  } });
  const source = await prisma.catalogGenerationJob.create({ data: {
    catalogId: catalog.id, jobType: "CATALOG_INFO", requestedProducts: 2, textModel: catalog.defaultTextModel,
    imageModel: catalog.defaultImageModel, status: "COMPLETED", stage: "COMPLETE",
  } });
  const products = [];
  for (let index = 1; index <= 2; index += 1) {
    products.push(await prisma.syntheticProduct.create({ data: {
      catalogId: catalog.id, generationJobId: source.id, sequence: index, externalId: `PRE-W-00000${index}`,
      name: "Test", description: "Test", department: "WOMEN", category: "dresses", subcategory: "midi dresses",
      material: "cotton", season: "Core", basePrice: 25, currency: "EUR", status: "READY",
      styles: { create: { externalId: `PRE-W-00000${index}-BLACK`, colorName: "Black", colorCode: "BLACK", status: "READY" } },
    } }));
  }
  return { catalog, source, products };
}

describe("core image jobs", () => {
  beforeAll(() => requireTestDatabase());
  beforeEach(() => truncateAllTables());
  afterAll(() => disconnectPrisma());

  it("queues only missing core roles for the source batch and rejects duplicate active work", async () => {
    const { catalog, source, products } = await fixture();
    const style = await prisma.syntheticStyle.findFirstOrThrow({ where: { productId: products[0]!.id } });
    await prisma.syntheticImageAsset.create({ data: { styleId: style.id, role: "FRONT", status: "READY", storageKey: "front.webp", mimeType: "image/webp" } });
    const job = await createCoreImagesJob({ catalogId: catalog.id, sourceJobId: source.id });
    expect(job.jobType).toBe("CORE_IMAGES");
    expect(job.sourceJobId).toBe(source.id);
    expect(job.tasks).toHaveLength(5);
    expect(job.tasks.some((task) => task.styleId === style.id && task.dedupeKey.endsWith(":FRONT"))).toBe(false);
    await expect(createCoreImagesJob({ catalogId: catalog.id, sourceJobId: source.id })).rejects.toThrow("already active");
  });

  it("all-missing mode includes historical active products and excludes archived products", async () => {
    const { catalog, products } = await fixture();
    await prisma.syntheticProduct.update({ where: { id: products[1]!.id }, data: { generationJobId: null, archivedAt: new Date() } });
    const job = await createCoreImagesJob({ catalogId: catalog.id, allMissing: true });
    expect(job.tasks).toHaveLength(3);
    expect(job.tasks.every((task) => task.productId === products[0]!.id)).toBe(true);
  });
});
