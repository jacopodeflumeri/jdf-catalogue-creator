import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma/client";
import { parseCatalogProfileConfig, type OutfitSlot } from "../config/profiles";
import { planOutfits, type OutfitStyle, type PlannedOutfit } from "../domain/outfit-planner";

function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function slotFor(product: { department: string; category: string; subcategory: string }, config: ReturnType<typeof parseCatalogProfileConfig>): OutfitSlot | undefined {
  const row = config.assortmentPlan.find((item) => item.departmentKey?.toLocaleLowerCase() === product.department.toLocaleLowerCase() && item.category.toLocaleLowerCase() === product.category.toLocaleLowerCase() && item.subcategory.toLocaleLowerCase() === product.subcategory.toLocaleLowerCase());
  return row?.outfitSlot ?? undefined;
}

async function calculate(catalogId: number, sourceJobId?: number) {
  const catalog = await prisma.syntheticCatalog.findUniqueOrThrow({ where: { id: catalogId } });
  const config = parseCatalogProfileConfig(catalog.config);
  if (sourceJobId != null) {
    const source = await prisma.catalogGenerationJob.findUniqueOrThrow({ where: { id: sourceJobId } });
    if (source.catalogId !== catalog.id || source.jobType !== "CATALOG_INFO" || !["COMPLETED", "COMPLETED_WITH_ERRORS"].includes(source.status)) throw new Error("Choose a completed catalogue information job for this catalogue");
  }
  const rawStyles = await prisma.syntheticStyle.findMany({
    where: { product: { catalogId, archivedAt: null } },
    include: { product: true, images: true, completeLook: { include: { items: { orderBy: { sortOrder: "asc" }, include: { companionStyle: true } } } } },
    orderBy: { id: "asc" },
  });
  const readiness = rawStyles.flatMap((style) => {
    const missingRoles = (["FRONT", "BACK"] as const).filter((role) => !style.images.some((image) => image.role === role && image.status === "READY"));
    return missingRoles.length ? [{ styleId: style.id, styleExternalId: style.externalId, productExternalId: style.product.externalId, missingRoles, failedRoles: missingRoles.filter((role) => style.images.some((image) => image.role === role && image.status === "FAILED")) }] : [];
  });
  const candidates: OutfitStyle[] = rawStyles.flatMap((style) => {
    const frontReady = style.images.some((image) => image.role === "FRONT" && image.status === "READY");
    const outfitSlot = slotFor(style.product, config);
    if (!frontReady || !outfitSlot) return [];
    return [{ id: style.id, productId: style.productId, externalId: style.externalId, department: style.product.department, season: style.product.season, outfitSlot, colorHex: style.colorHex ?? config.colors.find((color) => color.code === style.colorCode)?.hex ?? "#808080" }];
  });
  const targetProducts = sourceJobId == null ? null : new Set(await prisma.syntheticProduct.findMany({ where: { catalogId, generationJobId: sourceJobId, archivedAt: null }, select: { id: true } }).then((items) => items.map((item) => item.id)));
  const rawAnchors = rawStyles.filter((style) => targetProducts == null || targetProducts.has(style.productId));
  const candidatePlans = planOutfits(candidates);
  const planByAnchor = new Map(candidatePlans.map((plan) => [plan.anchor.id, plan]));
  const targetPlans: PlannedOutfit[] = rawAnchors.map((style) => {
    const existingPlan = planByAnchor.get(style.id);
    if (existingPlan) return existingPlan;
    const outfitSlot = slotFor(style.product, config);
    const anchor: OutfitStyle = { id: style.id, productId: style.productId, externalId: style.externalId, department: style.product.department, season: style.product.season, outfitSlot: outfitSlot ?? "ACCESSORY", colorHex: style.colorHex ?? "#808080" };
    return { anchor, items: [], status: "SKIPPED", reason: "No supported outfit slot is configured for this style.", scoringSnapshot: { ruleVersion: 1 } };
  });
  return { catalog, config, rawStyles, targetPlans, readiness };
}

export async function getCompleteLookPreflight(input: { catalogId: number; sourceJobId?: number }) {
  const result = await calculate(input.catalogId, input.sourceJobId);
  const existingById = new Map(result.rawStyles.map((style) => [style.id, style.completeLook]));
  const plans = result.targetPlans.map((plan) => ({
    anchorStyleId: plan.anchor.id,
    anchorStyleExternalId: plan.anchor.externalId,
    status: existingById.get(plan.anchor.id)?.status === "READY" ? "READY" : existingById.get(plan.anchor.id)?.items.length && existingById.get(plan.anchor.id)?.status !== "STALE" ? "PLANNED" : plan.status,
    reason: existingById.get(plan.anchor.id)?.status === "READY" ? "Complete the Look is already ready." : existingById.get(plan.anchor.id)?.items.length && existingById.get(plan.anchor.id)?.status !== "STALE" ? "Persisted pairing will be reused." : plan.reason,
    companions: existingById.get(plan.anchor.id)?.items.length || plan.items.length,
  }));
  return {
    gateReady: result.readiness.length === 0,
    readinessFailures: result.readiness,
    targetProducts: new Set(result.targetPlans.map((plan) => plan.anchor.productId)).size,
    targetStyles: result.targetPlans.length,
    eligibleStyles: plans.filter((plan) => plan.status === "PLANNED").length,
    skippedStyles: plans.filter((plan) => plan.status === "SKIPPED").length,
    expectedImageCalls: plans.filter((plan) => plan.status === "PLANNED").length,
    skipped: plans.filter((plan) => plan.status === "SKIPPED").map(({ anchorStyleExternalId, reason }) => ({ style: anchorStyleExternalId, reason })),
    sampleReadinessFailures: result.readiness.slice(0, 50),
  };
}

export async function createCompleteLookJob(input: { catalogId: number; sourceJobId?: number; createdByMappTeamId?: number }) {
  const preflight = await calculate(input.catalogId, input.sourceJobId);
  if (preflight.readiness.length) {
    const failedFront = preflight.readiness.filter((item) => item.missingRoles.includes("FRONT")).length;
    const failedBack = preflight.readiness.filter((item) => item.missingRoles.includes("BACK")).length;
    throw new Error(`Complete the Look is blocked: ${failedFront} styles are missing FRONT and ${failedBack} are missing BACK. Run Step 2 for all products missing core images.`);
  }
  if (preflight.targetPlans.length === 0) throw new Error("No active styles are available for this Complete the Look target");
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM synthetic_catalog WHERE id = ${input.catalogId} FOR UPDATE`;
    const [missingFront, missingBack] = await Promise.all([
      tx.syntheticStyle.count({ where: { product: { catalogId: input.catalogId, archivedAt: null }, NOT: { images: { some: { role: "FRONT", status: "READY" } } } } }),
      tx.syntheticStyle.count({ where: { product: { catalogId: input.catalogId, archivedAt: null }, NOT: { images: { some: { role: "BACK", status: "READY" } } } } }),
    ]);
    if (missingFront || missingBack) throw new Error(`Complete the Look is blocked: ${missingFront} styles are missing FRONT and ${missingBack} are missing BACK. Run Step 2 for all products missing core images.`);
    const active = await tx.catalogGenerationJob.findFirst({ where: { catalogId: input.catalogId, jobType: "COMPLETE_LOOK", status: { in: ["QUEUED", "RUNNING"] } }, select: { id: true } });
    if (active) throw new Error("A Complete the Look job is already active for this catalogue");
    const job = await tx.catalogGenerationJob.create({ data: {
      catalogId: input.catalogId,
      sourceJobId: input.sourceJobId ?? null,
      createdByMappTeamId: input.createdByMappTeamId,
      jobType: "COMPLETE_LOOK",
      requestedProducts: new Set(preflight.targetPlans.map((plan) => plan.anchor.productId)).size,
      skippedImages: preflight.targetPlans.filter((plan) => plan.status === "SKIPPED").length,
      departmentMode: "AUTO",
      scopeType: input.sourceJobId ? "SOURCE_BATCH" : "ALL_ACTIVE",
      scopeValue: input.sourceJobId ? String(input.sourceJobId) : null,
      colorVariantCount: 1,
      textModel: preflight.catalog.defaultTextModel,
      imageModel: preflight.catalog.defaultImageModel,
      status: "QUEUED",
      stage: "PLANNING",
    } });
    for (const plan of preflight.targetPlans) {
      const existing = await tx.syntheticCompleteLook.findUnique({ where: { anchorStyleId: plan.anchor.id }, include: { imageAsset: true, items: true } });
      if (existing?.status === "READY" && existing.imageAsset?.status === "READY") continue;
      if (existing && ["QUEUED", "GENERATING"].includes(existing.status)) throw new Error(`Complete the Look is already active for ${plan.anchor.externalId}`);
      const reusePairing = Boolean(existing && existing.items.length > 0 && existing.status !== "STALE");
      const effectivePlan = reusePairing ? { ...plan, status: "PLANNED" as const } : plan;
      if (effectivePlan.status === "SKIPPED") {
        if (existing) {
          await tx.syntheticCompleteLook.update({ where: { id: existing.id }, data: { status: "SKIPPED", selectionReason: effectivePlan.reason, errorMessage: effectivePlan.reason, scoringSnapshot: asJson(effectivePlan.scoringSnapshot) } });
          await tx.syntheticCompleteLookItem.deleteMany({ where: { completeLookId: existing.id } });
        } else {
          await tx.syntheticCompleteLook.create({ data: { anchorStyleId: plan.anchor.id, status: "SKIPPED", selectionReason: effectivePlan.reason, errorMessage: effectivePlan.reason, scoringSnapshot: asJson(effectivePlan.scoringSnapshot) } });
        }
        continue;
      }
      let lookId: number;
      if (existing) {
        if (!reusePairing) await tx.syntheticCompleteLookItem.deleteMany({ where: { completeLookId: existing.id } });
        const look = await tx.syntheticCompleteLook.update({ where: { id: existing.id }, data: { status: "QUEUED", ...(!reusePairing && { selectionReason: effectivePlan.reason, scoringSnapshot: asJson(effectivePlan.scoringSnapshot) }), errorMessage: null } });
        lookId = look.id;
      } else {
        const look = await tx.syntheticCompleteLook.create({ data: { anchorStyleId: effectivePlan.anchor.id, status: "QUEUED", selectionReason: effectivePlan.reason, scoringSnapshot: asJson(effectivePlan.scoringSnapshot) } });
        lookId = look.id;
      }
      if (!reusePairing && effectivePlan.items.length) await tx.syntheticCompleteLookItem.createMany({ data: effectivePlan.items.map((item, sortOrder) => ({ completeLookId: lookId, companionStyleId: item.style.id, outfitSlot: item.outfitSlot, sortOrder, scoreSnapshot: asJson({ score: item.score, reason: item.reason }) })) });
      const style = preflight.rawStyles.find((item) => item.id === plan.anchor.id)!;
      const asset = await tx.syntheticImageAsset.upsert({ where: { styleId_role: { styleId: style.id, role: "COMPLETE_LOOK" } }, update: { status: "QUEUED", errorMessage: null }, create: { styleId: style.id, role: "COMPLETE_LOOK", status: "QUEUED" } });
      await tx.syntheticCompleteLook.update({ where: { id: lookId }, data: { imageAssetId: asset.id } });
      const duplicate = await tx.catalogGenerationTask.findFirst({ where: { imageAssetId: asset.id, status: { in: ["QUEUED", "RUNNING"] }, job: { status: { in: ["QUEUED", "RUNNING"] } } }, select: { id: true } });
      if (duplicate) throw new Error(`Complete the Look generation is already active for ${plan.anchor.externalId}`);
      await tx.catalogGenerationTask.create({ data: {
        jobId: job.id,
        productId: style.productId,
        styleId: style.id,
        imageAssetId: asset.id,
        taskType: "GENERATE_IMAGE",
        dedupeKey: `complete-look:${style.id}`,
        payload: asJson({ lookId, catalogSnapshot: { brandName: preflight.catalog.brandName, segment: preflight.catalog.segment, visualDirection: preflight.config.visualDirection } }),
      } });
    }
    const taskCount = await tx.catalogGenerationTask.count({ where: { jobId: job.id } });
    await tx.catalogGenerationJob.update({ where: { id: job.id }, data: {
      requestedProducts: new Set(preflight.targetPlans.filter((plan) => plan.status === "PLANNED").map((plan) => plan.anchor.productId)).size,
      ...(taskCount === 0 && { status: "COMPLETED", stage: "COMPLETE", finishedAt: new Date() }),
    } });
    return tx.catalogGenerationJob.findUniqueOrThrow({ where: { id: job.id }, include: { tasks: true } });
  }, { isolationLevel: "Serializable" });
}
