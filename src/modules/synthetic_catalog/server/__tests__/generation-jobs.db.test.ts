/** @jest-environment node */

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma/client";
import {
  disconnectPrisma,
  requireTestDatabase,
  truncateAllTables,
} from "@test/utils/db";
import { CATALOG_PROFILES } from "../../config/profiles";
import { MockProductGenerator } from "../../providers/mock-product-generator";
import type {
  ProductGenerationInput,
  ProductGenerator,
} from "../../providers/product-generator";
import {
  createGenerationJob,
  resumeGenerationJob,
  runGenerationJob,
} from "../generation-jobs";

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
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

describe("catalog generation jobs", () => {
  beforeAll(() => requireTestDatabase());
  beforeEach(() => truncateAllTables());
  afterAll(() => disconnectPrisma());

  it("derives ALL product totals from the mix and freezes the queued mix snapshot", async () => {
    const catalog = await createTestCatalog();
    const job = await createGenerationJob({ catalogId: catalog.id, scope: { type: "ALL" }, colorVariantCount: 2, seed: "all-catalogue-mix" });
    const expectedTotal = CATALOG_PROFILES[0]!.config.assortmentPlan.reduce((total, row) => total + row.productCount, 0);
    expect(job.requestedProducts).toBe(expectedTotal);
    expect(job.tasks).toHaveLength(expectedTotal);

    const changedConfig = {
      ...CATALOG_PROFILES[0]!.config,
      assortmentPlan: CATALOG_PROFILES[0]!.config.assortmentPlan.map((row, index) => index === 0 ? { ...row, productCount: row.productCount + 9 } : row),
    };
    await prisma.syntheticCatalog.update({ where: { id: catalog.id }, data: { config: json(changedConfig) } });
    const tasks = await prisma.catalogGenerationTask.findMany({ where: { jobId: job.id } });
    const queuedPlans = tasks.map((task) => {
      const payload = task.payload as { plan: { department: string; category: string; subcategory: string }; configSnapshot: { assortmentPlan: typeof changedConfig.assortmentPlan } };
      return { row: payload.plan, mix: payload.configSnapshot.assortmentPlan };
    });
    expect(queuedPlans.every(({ mix }) => mix.reduce((total, row) => total + row.productCount, 0) === expectedTotal)).toBe(true);
    expect(queuedPlans.map(({ row }) => row)).toEqual(expect.arrayContaining(CATALOG_PROFILES[0]!.config.assortmentPlan.map((row) => expect.objectContaining(row))));
    expect(tasks).toHaveLength(expectedTotal);
  });

  it("appends mocked products from concurrent reservations without ID collisions", async () => {
    const catalog = await createTestCatalog();
    const [firstJob, secondJob] = await Promise.all([
      createGenerationJob({
        catalogId: catalog.id,
        requestedProducts: 2,
        departmentMode: "WOMEN",
        seed: "append-a",
      }),
      createGenerationJob({
        catalogId: catalog.id,
        requestedProducts: 2,
        departmentMode: "MEN",
        seed: "append-b",
      }),
    ]);
    const provider = new MockProductGenerator();
    const completed = await Promise.all([
      runGenerationJob(firstJob.id, provider),
      runGenerationJob(secondJob.id, provider),
    ]);

    expect(completed.every((job) => job.status === "RUNNING" && job.stage === "IMAGES")).toBe(true);
    const products = await prisma.syntheticProduct.findMany({
      where: { catalogId: catalog.id },
      include: { styles: { include: { variants: true } } },
      orderBy: { sequence: "asc" },
    });
    expect(products.map((product) => product.sequence)).toEqual([1, 2, 3, 4]);
    expect(new Set(products.map((product) => product.externalId)).size).toBe(4);
    expect(products.every((product) => product.styles.length === 1)).toBe(true);

    const variants = products.flatMap((product) => product.styles[0]!.variants);
    expect(new Set(variants.map((variant) => variant.externalId)).size).toBe(
      variants.length,
    );
    expect(new Set(variants.map((variant) => variant.sku)).size).toBe(variants.length);
  });

  it("resumes an interrupted job without regenerating completed tasks", async () => {
    const catalog = await createTestCatalog();
    const job = await createGenerationJob({
      catalogId: catalog.id,
      requestedProducts: 3,
      scope: { type: "DEPARTMENT", departmentKey: "WOMEN" },
      textModel: "openai/gpt-4o-mini",
      seed: "resumable-job",
    });
    const baseProvider = new MockProductGenerator();
    const generatedSequences: number[] = [];
    const receivedModels: string[] = [];
    const trackingProvider: ProductGenerator = {
      async generateProduct(input: ProductGenerationInput) {
        generatedSequences.push(input.plan.sequence);
        receivedModels.push(input.model);
        return baseProvider.generateProduct(input);
      },
    };

    const partial = await runGenerationJob(job.id, trackingProvider, { maxTasks: 1 });
    expect(partial.status).toBe("RUNNING");
    expect(partial.completedProducts).toBe(1);
    expect(
      partial.tasks.filter(
        (task) => task.taskType === "GENERATE_PRODUCT" && task.status === "QUEUED",
      ),
    ).toHaveLength(2);

    const finished = await runGenerationJob(job.id, trackingProvider);
    expect(finished.status).toBe("RUNNING");
    expect(finished.stage).toBe("IMAGES");
    expect(finished.completedProducts).toBe(3);
    expect(generatedSequences).toHaveLength(3);
    expect(new Set(generatedSequences).size).toBe(3);
    expect(finished.textModel).toBe("openai/gpt-4o-mini");
    expect(new Set(receivedModels)).toEqual(new Set(["openai/gpt-4o-mini"]));
  });

  it("persists multiple distinct color styles with independent sizes and three image tasks each", async () => {
    const catalog = await createTestCatalog();
    const job = await createGenerationJob({ catalogId: catalog.id, requestedProducts: 1, scope: { type: "DEPARTMENT", departmentKey: "WOMEN" }, colorVariantCount: 3, seed: "three-colors" });
    const changedConfig = { ...CATALOG_PROFILES[0].config, colors: [CATALOG_PROFILES[0].config.colors[0]!] };
    await prisma.syntheticCatalog.update({
      where: { id: catalog.id },
      data: { config: json(changedConfig), brandName: "Changed Brand", segment: "changed-segment" },
    });
    const baseProvider = new MockProductGenerator();
    const receivedContext: Array<{ brandName: string; segment: string }> = [];
    const trackingProvider: ProductGenerator = {
      async generateProduct(input) {
        receivedContext.push({ brandName: input.catalog.brandName, segment: input.catalog.segment });
        return baseProvider.generateProduct(input);
      },
    };
    await runGenerationJob(job.id, trackingProvider);
    const product = await prisma.syntheticProduct.findFirstOrThrow({
      where: { catalogId: catalog.id },
      include: { styles: { include: { variants: true, images: true, tasks: true } } },
    });
    expect(product.styles).toHaveLength(3);
    expect(new Set(product.styles.map((style) => style.colorCode)).size).toBe(3);
    expect(new Set(product.styles.map((style) => style.externalId)).size).toBe(3);
    for (const style of product.styles) {
      expect(style.variants.map((variant) => variant.size)).toEqual(CATALOG_PROFILES[0].config.sizes);
      expect(new Set(style.variants.map((variant) => variant.externalId)).size).toBe(style.variants.length);
      expect(style.images).toHaveLength(3);
      expect(style.tasks).toHaveLength(3);
      expect(style.tasks.every((task) => {
        const payload = task.payload as { catalogSnapshot?: { brandName?: string; segment?: string } };
        return payload.catalogSnapshot?.brandName === catalog.brandName && payload.catalogSnapshot.segment === catalog.segment;
      })).toBe(true);
    }
    expect(receivedContext).toEqual([{ brandName: catalog.brandName, segment: catalog.segment }]);
    expect(await prisma.catalogGenerationTask.count({ where: { jobId: job.id, taskType: "GENERATE_PRODUCT" } })).toBe(1);
  });

  it("can requeue a bounded provider failure and finish on retry", async () => {
    const catalog = await createTestCatalog();
    const job = await createGenerationJob({
      catalogId: catalog.id,
      requestedProducts: 2,
      scope: { type: "DEPARTMENT", departmentKey: "WOMEN" },
      colorVariantCount: 2,
      seed: "retry-job",
    });
    const baseProvider = new MockProductGenerator();
    let failedOnce = false;
    const flakyProvider: ProductGenerator = {
      async generateProduct(input) {
        if (!failedOnce) {
          failedOnce = true;
          throw new Error("temporary mock failure");
        }
        return baseProvider.generateProduct(input);
      },
    };

    const withError = await runGenerationJob(job.id, flakyProvider);
    expect(withError.status).toBe("RUNNING");
    expect(withError.failedProducts).toBe(1);

    await prisma.catalogGenerationTask.updateMany({
      where: { jobId: job.id, status: "FAILED" },
      data: { attempts: 3 },
    });

    const resumed = await resumeGenerationJob(job.id);
    expect(resumed.status).toBe("QUEUED");
    expect(resumed.tasks.find((task) => task.status === "QUEUED")?.attempts).toBe(0);
    const completed = await runGenerationJob(job.id, baseProvider);
    expect(completed.status).toBe("RUNNING");
    expect(completed.stage).toBe("IMAGES");
    expect(completed.completedProducts).toBe(2);
    expect(completed.failedProducts).toBe(0);
    expect(await prisma.syntheticProduct.count({ where: { catalogId: catalog.id } })).toBe(2);
    const generated = await prisma.syntheticProduct.findMany({ where: { catalogId: catalog.id }, include: { styles: true } });
    expect(generated.every((product) => product.styles.length === 2)).toBe(true);
    expect(new Set(generated.flatMap((product) => product.styles.map((style) => style.externalId))).size).toBe(4);
  });
});
