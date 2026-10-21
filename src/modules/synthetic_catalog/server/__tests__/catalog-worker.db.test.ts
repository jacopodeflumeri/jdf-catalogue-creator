/** @jest-environment node */

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma/client";
import {
  disconnectPrisma,
  requireTestDatabase,
  truncateAllTables,
} from "@test/utils/db";
import { CATALOG_PROFILES } from "../../config/profiles";
import type { CatalogImageGenerator } from "../../providers/image-generator";
import { MockProductGenerator } from "../../providers/mock-product-generator";
import type { ProductGenerator } from "../../providers/product-generator";
import type {
  GeneratedAssetStorage,
  StoreGeneratedImageInput,
} from "../../storage/generated-asset-storage";
import {
  CatalogGenerationWorker,
  claimNextCatalogTask,
} from "../catalog-worker";
import { createGenerationJob } from "../generation-jobs";

const IMAGE = Buffer.from("worker-image");

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

class MemoryStorage implements GeneratedAssetStorage {
  readonly objects = new Map<string, Buffer>();

  async put(input: StoreGeneratedImageInput) {
    const storageKey = `public/catalogs/${input.catalogSlug}/${input.styleExternalId}/${input.role}.webp`;
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
    if (!data) throw new Error(`Missing test object ${storageKey}`);
    return data;
  }

  getStablePublicUrl(publicId: string) {
    return `https://example.test/api/catalog-assets/${publicId}`;
  }
}

async function createTestCatalog() {
  const profile = CATALOG_PROFILES[0];
  return prisma.syntheticCatalog.create({
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
}

function createWorker(
  workerId: string,
  productGenerator: ProductGenerator,
  imageCalls: string[],
  storage = new MemoryStorage(),
) {
  const imageGenerator: CatalogImageGenerator = {
    async generateImage(input) {
      imageCalls.push(`${input.role}:${Boolean(input.reference)}`);
      return { data: IMAGE, mimeType: "image/png", usedReference: Boolean(input.reference) };
    },
  };
  return new CatalogGenerationWorker(
    { productGenerator, imageGenerator, storage },
    { workerId, retryDelayMs: 0, pollIntervalMs: 1, leaseMs: 1_000 },
  );
}

describe("catalog generation worker", () => {
  beforeAll(() => requireTestDatabase());
  beforeEach(() => truncateAllTables());
  afterAll(() => disconnectPrisma());

  it("atomically gives concurrent workers different tasks", async () => {
    const catalog = await createTestCatalog();
    await createGenerationJob({ catalogId: catalog.id, requestedProducts: 2, seed: "claims" });

    const [first, second] = await Promise.all([
      claimNextCatalogTask("worker-a"),
      claimNextCatalogTask("worker-b"),
    ]);

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(first!.id).not.toBe(second!.id);
    expect(new Set([first!.lockedBy, second!.lockedBy])).toEqual(
      new Set(["worker-a", "worker-b"]),
    );
  });

  it("finishes and resumes a five-product job from durable task state", async () => {
    const catalog = await createTestCatalog();
    const job = await createGenerationJob({
      catalogId: catalog.id,
      requestedProducts: 5,
      seed: "five-products",
    });
    const generatedProducts: number[] = [];
    const base = new MockProductGenerator();
    const productGenerator: ProductGenerator = {
      async generateProduct(input) {
        generatedProducts.push(input.plan.sequence);
        return base.generateProduct(input);
      },
    };
    const imageCalls: string[] = [];
    const storage = new MemoryStorage();

    const firstProcess = createWorker("worker-first", productGenerator, imageCalls, storage);
    expect(await firstProcess.runUntilIdle(7)).toBe(7);
    const interrupted = await prisma.catalogGenerationJob.findUniqueOrThrow({
      where: { id: job.id },
    });
    expect(interrupted.status).toBe("RUNNING");
    expect(interrupted.completedProducts).toBe(5);
    expect(interrupted.completedImages).toBe(2);

    const resumedProcess = createWorker("worker-resumed", productGenerator, imageCalls, storage);
    expect(await resumedProcess.runUntilIdle()).toBe(13);
    const completed = await prisma.catalogGenerationJob.findUniqueOrThrow({
      where: { id: job.id },
    });
    expect(completed).toEqual(
      expect.objectContaining({
        status: "COMPLETED",
        stage: "COMPLETE",
        completedProducts: 5,
        failedProducts: 0,
        completedImages: 15,
        failedImages: 0,
      }),
    );
    expect(generatedProducts).toHaveLength(5);
    expect(imageCalls).toHaveLength(15);
    expect(await prisma.syntheticProduct.count({ where: { catalogId: catalog.id } })).toBe(5);
    expect(await prisma.syntheticImageAsset.count({ where: { status: "READY" } })).toBe(15);
    expect(await prisma.catalogGenerationTask.count({ where: { status: "COMPLETED" } })).toBe(20);
  });

  it("keeps terminal progress correct when two workers finish tasks concurrently", async () => {
    const catalog = await createTestCatalog();
    const job = await createGenerationJob({
      catalogId: catalog.id,
      requestedProducts: 2,
      seed: "concurrent-progress",
    });
    const storage = new MemoryStorage();
    const imageCalls: string[] = [];
    const first = createWorker("worker-concurrent-a", new MockProductGenerator(), imageCalls, storage);
    const second = createWorker("worker-concurrent-b", new MockProductGenerator(), imageCalls, storage);

    for (;;) {
      const results = await Promise.all([first.runOnce(), second.runOnce()]);
      if (results.every((worked) => !worked)) break;
    }

    expect(await prisma.catalogGenerationJob.findUniqueOrThrow({ where: { id: job.id } })).toEqual(
      expect.objectContaining({
        status: "COMPLETED",
        stage: "COMPLETE",
        completedProducts: 2,
        completedImages: 6,
      }),
    );
  });

  it("retries transient failures within the task limit", async () => {
    const catalog = await createTestCatalog();
    const job = await createGenerationJob({
      catalogId: catalog.id,
      requestedProducts: 1,
      seed: "transient-retry",
    });
    const base = new MockProductGenerator();
    let attempts = 0;
    const productGenerator: ProductGenerator = {
      async generateProduct(input) {
        attempts += 1;
        if (attempts === 1) {
          const error = new Error("temporary proxy failure") as Error & { status: number };
          error.status = 503;
          throw error;
        }
        return base.generateProduct(input);
      },
    };
    const worker = createWorker("worker-retry", productGenerator, []);

    expect(await worker.runUntilIdle()).toBe(5);
    const productTask = await prisma.catalogGenerationTask.findFirstOrThrow({
      where: { jobId: job.id, taskType: "GENERATE_PRODUCT" },
    });
    expect(productTask.attempts).toBe(2);
    expect(productTask.status).toBe("COMPLETED");
    expect((await prisma.catalogGenerationJob.findUniqueOrThrow({ where: { id: job.id } })).status)
      .toBe("COMPLETED");
  });

  it("makes dependent images claimable after a terminal front setup failure", async () => {
    const catalog = await createTestCatalog();
    const job = await createGenerationJob({
      catalogId: catalog.id,
      requestedProducts: 1,
      seed: "front-setup-failure",
    });
    const worker = createWorker("worker-front-failure", new MockProductGenerator(), []);
    expect(await worker.runOnce()).toBe(true);
    await prisma.syntheticCatalog.update({
      where: { id: catalog.id },
      data: { config: json({}) },
    });

    expect(await worker.runOnce()).toBe(true);
    const front = await prisma.syntheticImageAsset.findFirstOrThrow({
      where: { style: { product: { generationJobId: job.id } }, role: "FRONT" },
    });
    expect(front.status).toBe("FAILED");
    const next = await claimNextCatalogTask("worker-after-front-failure");
    expect(next).toEqual(expect.objectContaining({ taskType: "GENERATE_IMAGE" }));
    expect(next!.imageAssetId).not.toBe(front.id);
  });

  it("recovers an expired worker lease without duplicating a claim", async () => {
    const catalog = await createTestCatalog();
    const job = await createGenerationJob({
      catalogId: catalog.id,
      requestedProducts: 1,
      seed: "stale-lease",
    });
    const claimed = await claimNextCatalogTask("dead-worker");
    expect(claimed).not.toBeNull();
    await prisma.catalogGenerationTask.update({
      where: { id: claimed!.id },
      data: { lockedAt: new Date(Date.now() - 10_000) },
    });

    const worker = createWorker("replacement-worker", new MockProductGenerator(), []);
    expect(await worker.recoverStaleTasks()).toBe(1);
    const recovered = await prisma.catalogGenerationTask.findUniqueOrThrow({
      where: { id: claimed!.id },
    });
    expect(recovered).toEqual(
      expect.objectContaining({ status: "QUEUED", attempts: 1, lockedAt: null, lockedBy: null }),
    );
    expect((await prisma.catalogGenerationJob.findUniqueOrThrow({ where: { id: job.id } })).status)
      .toBe("RUNNING");
  });
});
