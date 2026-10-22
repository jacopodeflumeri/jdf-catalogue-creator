/** @jest-environment node */

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma/client";
import { disconnectPrisma, requireTestDatabase, truncateAllTables } from "@test/utils/db";
import { CATALOG_PROFILES } from "../../config/profiles";
import { createCompleteLookJob, getCompleteLookPreflight } from "../complete-look-jobs";

const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

async function fixture(readyBack = true) {
  const profile = CATALOG_PROFILES[0]!;
  const catalog = await prisma.syntheticCatalog.create({ data: { slug: profile.slug, name: profile.name, segment: profile.segment, brandName: profile.brandName, externalPrefix: profile.externalPrefix, config: json(profile.config), defaultTextModel: profile.defaultTextModel, defaultImageModel: profile.defaultImageModel } });
  const source = await prisma.catalogGenerationJob.create({ data: { catalogId: catalog.id, jobType: "CATALOG_INFO", requestedProducts: 1, textModel: catalog.defaultTextModel, imageModel: catalog.defaultImageModel, status: "COMPLETED", stage: "COMPLETE" } });
  const top = await prisma.syntheticProduct.create({ data: { catalogId: catalog.id, generationJobId: source.id, sequence: 1, externalId: "PRE-W-000001", name: "Top", description: "Top", department: "WOMEN", category: "shirts", subcategory: "poplin shirts", material: "cotton", season: "Core", basePrice: 20, currency: "EUR", status: "READY", styles: { create: { externalId: "PRE-W-000001-NAVY", colorName: "Navy", colorCode: "NAVY", colorHex: "#17223B", status: "READY" } } } });
  const bottom = await prisma.syntheticProduct.create({ data: { catalogId: catalog.id, sequence: 2, externalId: "PRE-W-000002", name: "Trousers", description: "Trousers", department: "WOMEN", category: "trousers", subcategory: "tailored trousers", material: "wool", season: "Core", basePrice: 40, currency: "EUR", status: "READY", styles: { create: { externalId: "PRE-W-000002-BLACK", colorName: "Black", colorCode: "BLACK", colorHex: "#111111", status: "READY" } } } });
  const styles = await prisma.syntheticStyle.findMany({ where: { productId: { in: [top.id, bottom.id] } } });
  for (const style of styles) {
    await prisma.syntheticImageAsset.createMany({ data: [
      { styleId: style.id, role: "FRONT", status: "READY", storageKey: `${style.id}-front.webp`, mimeType: "image/webp" },
      ...(readyBack || style.externalId !== "PRE-W-000002-BLACK" ? [{ styleId: style.id, role: "BACK" as const, status: "READY" as const, storageKey: `${style.id}-back.webp`, mimeType: "image/webp" }] : []),
    ] });
  }
  return { catalog, source, styles };
}

describe("Complete the Look jobs", () => {
  beforeAll(() => requireTestDatabase());
  beforeEach(() => truncateAllTables());
  afterAll(() => disconnectPrisma());

  it("blocks all targets until every active catalogue style has FRONT and BACK ready", async () => {
    const { catalog, source } = await fixture(false);
    const preflight = await getCompleteLookPreflight({ catalogId: catalog.id, sourceJobId: source.id });
    expect(preflight.gateReady).toBe(false);
    expect(preflight.readinessFailures).toEqual(expect.arrayContaining([expect.objectContaining({ missingRoles: ["BACK"] })]));
    await expect(createCompleteLookJob({ catalogId: catalog.id, sourceJobId: source.id })).rejects.toThrow(/full-catalogue|blocked/i);
  });

  it("plans one look per source-batch style and persists ordered style companions", async () => {
    const { catalog, source, styles } = await fixture();
    const preflight = await getCompleteLookPreflight({ catalogId: catalog.id, sourceJobId: source.id });
    expect(preflight.gateReady).toBe(true);
    expect(preflight.targetStyles).toBe(1);
    expect(preflight.expectedImageCalls).toBe(1);
    const job = await createCompleteLookJob({ catalogId: catalog.id, sourceJobId: source.id });
    expect(job.jobType).toBe("COMPLETE_LOOK");
    expect(job.sourceJobId).toBe(source.id);
    expect(job.tasks).toHaveLength(1);
    const look = await prisma.syntheticCompleteLook.findUniqueOrThrow({ where: { anchorStyleId: styles.find((item) => item.externalId === "PRE-W-000001-NAVY")!.id }, include: { items: true } });
    expect(look.status).toBe("QUEUED");
    expect(look.items.map((item) => item.companionStyleId)).toEqual([styles.find((item) => item.externalId === "PRE-W-000002-BLACK")!.id]);
  });
});
