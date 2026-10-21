/** @jest-environment node */

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma/client";
import {
  disconnectPrisma,
  requireTestDatabase,
  truncateAllTables,
} from "@test/utils/db";
import { CATALOG_PROFILES } from "../../config/profiles";
import type {
  CatalogImageGenerationInput,
  CatalogImageGenerator,
} from "../../providers/image-generator";
import { MockProductGenerator } from "../../providers/mock-product-generator";
import {
  buildGeneratedImageStorageKey,
  type GeneratedAssetStorage,
  type StoreGeneratedImageInput,
} from "../../storage/generated-asset-storage";
import { createGenerationJob, runGenerationJob } from "../generation-jobs";
import { generateStyleImages, regenerateImageAsset } from "../image-assets";

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

class MemoryStorage implements GeneratedAssetStorage {
  readonly objects = new Map<string, Buffer>();

  async put(input: StoreGeneratedImageInput) {
    const storageKey = buildGeneratedImageStorageKey(
      input.catalogSlug,
      input.styleExternalId,
      input.role,
    );
    this.objects.set(storageKey, input.data);
    return {
      storageKey,
      mimeType: "image/webp" as const,
      width: 1,
      height: 1,
      publicUrl: this.getStablePublicUrl(input.assetPublicId),
    };
  }

  async get(storageKey: string) {
    const data = this.objects.get(storageKey);
    if (!data) throw new Error("missing in-memory asset");
    return data;
  }

  getStablePublicUrl(publicId: string) {
    return `https://example.test/api/catalog-assets/${publicId}`;
  }
}

describe("synthetic image asset persistence", () => {
  beforeAll(() => requireTestDatabase());
  beforeEach(() => truncateAllTables());
  afterAll(() => disconnectPrisma());

  it("persists three images with front references and regenerates one role independently", async () => {
    const profile = CATALOG_PROFILES[0];
    const catalog = await prisma.syntheticCatalog.create({
      data: {
        slug: profile.slug,
        name: profile.name,
        segment: profile.segment,
        brandName: profile.brandName,
        externalPrefix: profile.externalPrefix,
        config: json(profile.config),
        defaultTextModel: profile.defaultTextModel,
        defaultImageModel: profile.defaultImageModel,
      },
    });
    const job = await createGenerationJob({
      catalogId: catalog.id,
      requestedProducts: 1,
      seed: "image-assets",
    });
    await runGenerationJob(job.id, new MockProductGenerator());
    const style = await prisma.syntheticStyle.findFirstOrThrow({
      where: { product: { catalogId: catalog.id } },
    });
    expect(await prisma.syntheticImageAsset.count({ where: { styleId: style.id } })).toBe(3);

    const calls: CatalogImageGenerationInput[] = [];
    const generator: CatalogImageGenerator = {
      async generateImage(input) {
        calls.push(input);
        return {
          data: ONE_PIXEL_PNG,
          mimeType: "image/png",
          usedReference: Boolean(input.reference),
        };
      },
    };
    const storage = new MemoryStorage();
    const generated = await generateStyleImages({
      styleId: style.id,
      model: job.imageModel,
      generator,
      storage,
    });
    expect(generated).toHaveLength(3);
    expect(generated.every((asset) => asset.status === "READY")).toBe(true);
    expect(generated.every((asset) => asset.storageKey?.startsWith("public/catalogs/"))).toBe(true);
    expect(calls.map((call) => [call.role, Boolean(call.reference)])).toEqual([
      ["FRONT", false],
      ["BACK", true],
      ["ON_MODEL", true],
    ]);

    const front = generated.find((asset) => asset.role === "FRONT")!;
    const back = generated.find((asset) => asset.role === "BACK")!;
    const onModel = generated.find((asset) => asset.role === "ON_MODEL")!;
    expect(back.referenceAssetId).toBe(front.id);
    expect(onModel.referenceAssetId).toBe(front.id);

    await regenerateImageAsset({
      imageAssetId: back.id,
      model: job.imageModel,
      generator,
      storage,
    });
    const after = await prisma.syntheticImageAsset.findMany({
      where: { styleId: style.id },
    });
    expect(after.find((asset) => asset.role === "BACK")?.attemptCount).toBe(2);
    expect(after.find((asset) => asset.role === "FRONT")?.attemptCount).toBe(1);
    expect(after.find((asset) => asset.role === "ON_MODEL")?.attemptCount).toBe(1);
    expect(calls.at(-1)).toEqual(expect.objectContaining({ role: "BACK", regeneration: true }));
  });
});
