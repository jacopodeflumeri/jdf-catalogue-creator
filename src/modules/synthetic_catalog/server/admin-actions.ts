"use server";

import type { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma/client";
import { requireAdmin } from "@/modules/auth/server";
import { sessionAuditActor, writeAuditLog } from "@/modules/audit";
import {
  catalogSettingsInputSchema,
  catalogMixInputSchema,
  catalogTaxonomyInputSchema,
  parseAddProductsInput,
  positiveIdSchema,
} from "../admin/input";
import type {
  CatalogActionResult,
  CatalogDetailView,
  CatalogProductDetailView,
} from "../admin/types";
import { parseCatalogProfileConfig } from "../config/profiles";
import { CATALOG_PROFILES } from "../config/profiles";
import { S3GeneratedAssetStorage } from "../storage/generated-asset-storage";
import { BULK_RENAME_CHUNK_SIZE } from "./bulk-rename-worker";
import { addCatalogDepartment } from "../config/taxonomy";
import { cancelGenerationJob, createGenerationJob, resumeGenerationJob } from "./generation-jobs";
import {
  enqueueImageRegeneration,
  getCatalogDetail,
  getCatalogProductDetail,
} from "./admin-catalogs";
import { getCatalogExportSummary } from "./catalog-export";
import { createCoreImagesJob, getCoreImagesPreflight } from "./core-image-jobs";
import { createCompleteLookJob, getCompleteLookPreflight } from "./complete-look-jobs";
import type { CatalogExportSummary } from "../export/upc-csv";

function adminId(session: Awaited<ReturnType<typeof requireAdmin>>): number | undefined {
  const parsed = Number(session.user.adminId);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function errorResult(error: unknown): CatalogActionResult {
  return {
    ok: false,
    message: error instanceof Error ? error.message : "The request could not be completed",
  };
}

function revalidateCatalog(slug: string): void {
  revalidatePath("/admin");
  revalidatePath("/admin/catalogs");
  revalidatePath(`/admin/catalogs/${slug}`);
}

function isSafeCatalogSlug(value: string): boolean {
  return value.length > 0 && value.length <= 80 && value.split("-").every((part) => part.length > 0 && /^[a-z0-9]+$/.test(part));
}

const createCatalogInputSchema = z.object({
  name: z.string().trim().min(2).max(100), brandName: z.string().trim().min(2).max(80),
  segment: z.string().trim().min(2).max(80), slug: z.string().trim().toLowerCase().refine(isSafeCatalogSlug, "Use lowercase letters and numbers separated by single hyphens").max(80),
  externalPrefix: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/), template: z.string().trim().min(1),
});

export async function getCatalogTemplatesAction() {
  await requireAdmin({});
  const active = await prisma.syntheticCatalog.findMany({ where: { active: true }, select: { slug: true, name: true, config: true, defaultTextModel: true, defaultImageModel: true }, orderBy: [{ name: "asc" }, { slug: "asc" }] });
  if (active.length) return active.map((item) => ({ id: `catalog:${item.slug}`, label: item.name }));
  return CATALOG_PROFILES.map((item) => ({ id: `profile:${item.slug}`, label: item.name }));
}

export async function createSyntheticCatalogAction(input: unknown): Promise<CatalogActionResult & { slug?: string }> {
  const session = await requireAdmin({ requireEditorAccess: true });
  try {
    const values = createCatalogInputSchema.parse(input);
    const duplicate = await prisma.syntheticCatalog.findFirst({ where: { OR: [{ slug: values.slug }, { externalPrefix: values.externalPrefix }] }, select: { id: true, slug: true, externalPrefix: true } });
    if (duplicate?.slug === values.slug) throw new Error("A catalogue with this slug already exists");
    if (duplicate?.externalPrefix === values.externalPrefix) throw new Error("This external product prefix is already in use");
    const active = await prisma.syntheticCatalog.findMany({ where: { active: true }, select: { slug: true, config: true, defaultTextModel: true, defaultImageModel: true } });
    let config: unknown; let textModel: string; let imageModel: string;
    if (active.length) {
      if (!values.template.startsWith("catalog:")) throw new Error("Choose an active catalogue as the configuration template");
      const template = active.find((item) => item.slug === values.template.slice("catalog:".length));
      if (!template) throw new Error("The selected catalogue template is no longer active");
      config = parseCatalogProfileConfig(template.config); textModel = template.defaultTextModel; imageModel = template.defaultImageModel;
    } else {
      if (!values.template.startsWith("profile:")) throw new Error("Choose a built-in profile as the configuration template");
      const template = CATALOG_PROFILES.find((item) => item.slug === values.template.slice("profile:".length));
      if (!template) throw new Error("The selected built-in profile does not exist");
      config = parseCatalogProfileConfig(template.config); textModel = template.defaultTextModel; imageModel = template.defaultImageModel;
    }
    const catalog = await prisma.syntheticCatalog.create({ data: { slug: values.slug, name: values.name, brandName: values.brandName, segment: values.segment, externalPrefix: values.externalPrefix, config: JSON.parse(JSON.stringify(config)) as Prisma.InputJsonValue, defaultTextModel: textModel, defaultImageModel: imageModel, nextProductSequence: 1, active: true } });
    await writeAuditLog({ ...sessionAuditActor(session), action: "catalogue_created", entityType: "synthetic_catalog", entityId: catalog.id, message: `Created catalogue ${catalog.name}`, data: { slug: catalog.slug, externalPrefix: catalog.externalPrefix } });
    revalidateCatalog(catalog.slug); revalidatePath("/admin", "layout");
    return { ok: true, slug: catalog.slug };
  } catch (error) { return errorResult(error); }
}

export async function getCatalogDeletionSummaryAction(catalogId: number) {
  await requireAdmin({ requireAdminAccess: true });
  const id = positiveIdSchema.parse(catalogId);
  const catalog = await prisma.syntheticCatalog.findFirst({ where: { id, active: true }, select: { id: true, slug: true, name: true } });
  if (!catalog) return null;
  const [activeProducts, archivedProducts, styles, variants, imageAssets, completeLooks, jobs, tasks] = await Promise.all([
    prisma.syntheticProduct.count({ where: { catalogId: id, archivedAt: null } }), prisma.syntheticProduct.count({ where: { catalogId: id, archivedAt: { not: null } } }),
    prisma.syntheticStyle.count({ where: { product: { catalogId: id } } }), prisma.syntheticVariant.count({ where: { style: { product: { catalogId: id } } } }),
    prisma.syntheticImageAsset.count({ where: { style: { product: { catalogId: id } } } }), prisma.syntheticCompleteLook.count({ where: { anchorStyle: { product: { catalogId: id } } } }),
    prisma.catalogGenerationJob.count({ where: { catalogId: id } }), prisma.catalogGenerationTask.count({ where: { job: { catalogId: id } } }),
  ]);
  return { ...catalog, activeProducts, archivedProducts, styles, variants, imageAssets, completeLooks, jobs, tasks };
}

export async function deleteFullCatalogAction(input: { catalogId: number; confirmation: string }): Promise<CatalogActionResult> {
  const session = await requireAdmin({ requireAdminAccess: true });
  try {
    const catalogId = positiveIdSchema.parse(input.catalogId);
    const locked = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM synthetic_catalog WHERE id = ${catalogId} FOR UPDATE`;
      const catalog = await tx.syntheticCatalog.findFirst({ where: { id: catalogId, active: true } });
      if (!catalog) throw new Error("This catalogue is already deleted or unavailable");
      if (input.confirmation !== catalog.name && input.confirmation !== catalog.slug) throw new Error("Type the exact catalogue name or slug to confirm deletion");
      const activeWork = await tx.catalogGenerationJob.findFirst({ where: { catalogId, OR: [{ status: { in: ["QUEUED", "RUNNING"] } }, { tasks: { some: { status: { in: ["QUEUED", "RUNNING"] } } } }] }, select: { id: true } });
      if (activeWork) throw new Error("Stop active catalogue work before deleting this catalogue");
      const [imageRows, activeProducts, archivedProducts, styles, variants, imageAssets, completeLooks, jobs, tasks] = await Promise.all([
        tx.syntheticImageAsset.findMany({ where: { style: { product: { catalogId } } }, select: { storageKey: true } }),
        tx.syntheticProduct.count({ where: { catalogId, archivedAt: null } }), tx.syntheticProduct.count({ where: { catalogId, archivedAt: { not: null } } }),
        tx.syntheticStyle.count({ where: { product: { catalogId } } }), tx.syntheticVariant.count({ where: { style: { product: { catalogId } } } }),
        tx.syntheticImageAsset.count({ where: { style: { product: { catalogId } } } }), tx.syntheticCompleteLook.count({ where: { anchorStyle: { product: { catalogId } } } }),
        tx.catalogGenerationJob.count({ where: { catalogId } }), tx.catalogGenerationTask.count({ where: { job: { catalogId } } }),
      ]);
      const keys = imageRows.flatMap((row) => row.storageKey ? [row.storageKey] : []);
      await tx.syntheticCatalog.update({ where: { id: catalogId }, data: { active: false } });
      await tx.syntheticRenameBatch.deleteMany({ where: { catalogId } });
      await tx.catalogGenerationJob.deleteMany({ where: { catalogId } });
      await tx.syntheticProduct.deleteMany({ where: { catalogId } });
      return { catalog, keys, counts: { activeProducts, archivedProducts, styles, variants, imageAssets, completeLooks, jobs, tasks } };
    });
    const cleanup = await new S3GeneratedAssetStorage().deleteExactKeys(locked.catalog.slug, locked.keys);
    await writeAuditLog({ ...sessionAuditActor(session), action: "catalogue_deleted", entityType: "synthetic_catalog", entityId: catalogId, message: `Permanently deleted catalogue data for ${locked.catalog.name}${cleanup.failed ? `; ${cleanup.failed} image object deletions failed` : ""}`, data: { catalogId, ...locked.counts, deletedImageObjects: cleanup.deleted, failedImageObjects: cleanup.failed } });
    revalidateCatalog(locked.catalog.slug); revalidatePath("/admin", "layout");
    return { ok: true, message: cleanup.failed ? `Catalogue deleted. ${cleanup.failed} image object(s) could not be removed from storage.` : "Catalogue deleted." };
  } catch (error) { return errorResult(error); }
}

const bulkRenameInputSchema = z.object({ catalogId: z.number().int().positive(), scope: z.enum(["FILTERED", "ALL_ACTIVE"]), productIds: z.array(z.number().int().positive()).max(10000), preset: z.enum(["REMOVE_BRAND", "REMOVE_COLOUR", "REMOVE_BRAND_AND_COLOUR", "CUSTOM"]), customInstruction: z.string().trim().max(1000).optional() }).superRefine((input, ctx) => {
  if (input.scope === "FILTERED" && input.productIds.length === 0) ctx.addIssue({ code: "custom", path: ["productIds"], message: "The filtered scope has no active products" });
  if (input.preset === "CUSTOM" && !input.customInstruction?.trim()) ctx.addIssue({ code: "custom", path: ["customInstruction"], message: "Enter a custom naming instruction" });
  if (new Set(input.productIds).size !== input.productIds.length) ctx.addIssue({ code: "custom", path: ["productIds"], message: "Product IDs must be unique" });
});

const RENAME_INSTRUCTIONS = { REMOVE_BRAND: "Remove the brand name from each product name.", REMOVE_COLOUR: "Remove colour references from each product name.", REMOVE_BRAND_AND_COLOUR: "Remove the brand name and colour references from each product name.", CUSTOM: "" } as const;

export async function createBulkRenamePreviewAction(input: unknown): Promise<CatalogActionResult & { batchId?: number }> {
  const session = await requireAdmin({ requireEditorAccess: true });
  try {
    const values = bulkRenameInputSchema.parse(input);
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM synthetic_catalog WHERE id = ${values.catalogId} FOR UPDATE`;
      const catalog = await tx.syntheticCatalog.findFirst({ where: { id: values.catalogId, active: true } });
      if (!catalog) throw new Error("Catalogue is not active");
      const products = await tx.syntheticProduct.findMany({ where: { catalogId: catalog.id, archivedAt: null, ...(values.scope === "FILTERED" ? { id: { in: values.productIds } } : {}) }, select: { id: true, externalId: true, name: true }, orderBy: { id: "asc" } });
      if (values.scope === "FILTERED" && products.length !== values.productIds.length) throw new Error("One or more selected products do not belong to this active catalogue");
      if (!products.length) throw new Error("There are no active products in this scope");
      const instruction = values.preset === "CUSTOM" ? values.customInstruction!.trim() : RENAME_INSTRUCTIONS[values.preset];
      const job = await tx.catalogGenerationJob.create({ data: { catalogId: catalog.id, createdByMappTeamId: adminId(session), jobType: "BULK_RENAME", requestedProducts: products.length, departmentMode: "AUTO", scopeType: values.scope, scopeValue: null, colorVariantCount: 0, textModel: catalog.defaultTextModel, imageModel: catalog.defaultImageModel, stage: "PRODUCTS" } });
      const batch = await tx.syntheticRenameBatch.create({ data: { catalogId: catalog.id, jobId: job.id, createdByMappTeamId: adminId(session), instructionSnapshot: { preset: values.preset, instruction }, scopeSnapshot: { type: values.scope, productIds: products.map((product) => product.id) }, model: catalog.defaultTextModel, items: { create: products.map((product) => ({ productId: product.id, externalId: product.externalId, originalName: product.name })) } }, include: { items: { select: { id: true } } } });
      const tasks = [];
      for (let i = 0; i < batch.items.length; i += BULK_RENAME_CHUNK_SIZE) {
        const itemIds = batch.items.slice(i, i + BULK_RENAME_CHUNK_SIZE).map((item) => item.id);
        tasks.push({ taskType: "PROPOSE_PRODUCT_NAMES" as const, dedupeKey: `rename:${batch.id}:${i / BULK_RENAME_CHUNK_SIZE}`, payload: { batchId: batch.id, itemIds } });
      }
      await tx.catalogGenerationTask.createMany({ data: tasks.map((task) => ({ ...task, jobId: job.id })) });
      return { catalog, batch, job };
    });
    await writeAuditLog({ ...sessionAuditActor(session), action: "bulk_rename_preview_requested", entityType: "catalog_generation_job", entityId: result.job.id, message: `Requested name preview for ${result.batch.items.length} products in ${result.catalog.name}`, data: { catalogId: result.catalog.id, batchId: result.batch.id, requestedCount: result.batch.items.length, scope: values.scope, preset: values.preset } });
    revalidateCatalog(result.catalog.slug);
    return { ok: true, jobId: result.job.id, batchId: result.batch.id };
  } catch (error) { return errorResult(error); }
}

export async function getBulkRenameBatchAction(batchId: number) {
  await requireAdmin({});
  const id = positiveIdSchema.parse(batchId);
  const batch = await prisma.syntheticRenameBatch.findUnique({ where: { id }, include: { catalog: { select: { active: true, slug: true } }, job: { select: { status: true, textModel: true } }, items: { orderBy: { id: "asc" }, include: { product: { select: { department: true, category: true, subcategory: true } } } } } });
  if (!batch?.catalog.active) return null;
  return { id: batch.id, catalogSlug: batch.catalog.slug, status: batch.status, jobStatus: batch.job.status, model: batch.model, items: batch.items.map((item) => ({ id: item.id, productId: item.productId, externalId: item.externalId, originalName: item.originalName, proposedName: item.proposedName, status: item.status, errorMessage: item.errorMessage, department: item.product.department, category: item.product.category, subcategory: item.product.subcategory })) };
}

export async function applyBulkRenameAction(input: { batchId: number; itemIds: number[] }): Promise<CatalogActionResult> {
  const session = await requireAdmin({ requireEditorAccess: true });
  try {
    const batchId = positiveIdSchema.parse(input.batchId);
    const itemIds = z.array(positiveIdSchema).min(1).max(10000).parse(input.itemIds);
    if (new Set(itemIds).size !== itemIds.length) throw new Error("Selected proposal IDs must be unique");
    const result = await prisma.$transaction(async (tx) => {
      const batch = await tx.syntheticRenameBatch.findUnique({ where: { id: batchId }, include: { catalog: true } });
      if (!batch?.catalog.active) throw new Error("Rename preview is no longer available");
      if (batch.appliedAt) throw new Error("This rename preview has already been applied");
      const items = await tx.syntheticRenameItem.findMany({ where: { batchId, id: { in: itemIds }, status: "READY" } });
      if (items.length !== itemIds.length) throw new Error("One or more selected proposals are unavailable");
      let applied = 0; let stale = 0;
      for (const item of items) {
        const updated = await tx.syntheticProduct.updateMany({ where: { id: item.productId, catalogId: batch.catalogId, archivedAt: null, name: item.originalName }, data: { name: item.proposedName! } });
        if (updated.count) { applied += 1; await tx.syntheticRenameItem.update({ where: { id: item.id }, data: { status: "APPLIED", appliedAt: new Date() } }); }
        else { stale += 1; await tx.syntheticRenameItem.update({ where: { id: item.id }, data: { status: "STALE" } }); }
      }
      await tx.syntheticRenameBatch.update({ where: { id: batch.id }, data: { status: "APPLIED", appliedAt: new Date(), appliedByMappTeamId: adminId(session) } });
      return { catalog: batch.catalog, requested: itemIds.length, applied, stale, unchanged: await tx.syntheticRenameItem.count({ where: { batchId, status: "UNCHANGED" } }), failed: await tx.syntheticRenameItem.count({ where: { batchId, status: "FAILED" } }) };
    });
    await writeAuditLog({ ...sessionAuditActor(session), action: "bulk_rename_applied", entityType: "synthetic_rename_batch", entityId: batchId, message: `Applied ${result.applied} product name changes in ${result.catalog.name}`, data: { batchId, catalogId: result.catalog.id, requestedCount: result.requested, appliedCount: result.applied, unchangedCount: result.unchanged, staleCount: result.stale, failedCount: result.failed } });
    revalidateCatalog(result.catalog.slug);
    return { ok: true, message: `Applied ${result.applied}; stale ${result.stale}.` };
  } catch (error) { return errorResult(error); }
}

export async function getCatalogDetailAction(reference: string): Promise<CatalogDetailView | null> {
  await requireAdmin({});
  return getCatalogDetail(reference);
}

export async function getCatalogProductDetailAction(
  catalogReference: string,
  productReference: string,
): Promise<CatalogProductDetailView | null> {
  await requireAdmin({});
  return getCatalogProductDetail(catalogReference, productReference);
}

export async function getCatalogExportSummaryAction(reference: string): Promise<CatalogExportSummary | null> {
  await requireAdmin({});
  return getCatalogExportSummary(reference);
}

export async function createCatalogGenerationJobAction(input: unknown): Promise<CatalogActionResult> {
  const session = await requireAdmin({ requireEditorAccess: true });
  try {
    const values = parseAddProductsInput(input);
    const job = await createGenerationJob({
      ...values,
      createdByMappTeamId: adminId(session),
    });
    const catalog = await prisma.syntheticCatalog.findUniqueOrThrow({ where: { id: values.catalogId } });
    await writeAuditLog({
      ...sessionAuditActor(session),
      action: "generation_requested",
      entityType: "catalog_generation_job",
      entityId: job.id,
      message: `Requested ${job.requestedProducts} products for ${catalog.name}`,
      data: { catalogId: catalog.id, scope: values.scope, colorVariantCount: values.colorVariantCount },
    });
    revalidateCatalog(catalog.slug);
    return { ok: true, jobId: job.id };
  } catch (error) {
    return errorResult(error);
  }
}

export async function createCoreImagesJobAction(input: { catalogId: number; sourceJobId?: number; allMissing?: boolean }): Promise<CatalogActionResult> {
  const session = await requireAdmin({ requireEditorAccess: true });
  try {
    const catalogId = positiveIdSchema.parse(input.catalogId);
    const sourceJobId = input.sourceJobId == null ? undefined : positiveIdSchema.parse(input.sourceJobId);
    const job = await createCoreImagesJob({ catalogId, sourceJobId, allMissing: input.allMissing === true, createdByMappTeamId: adminId(session) });
    const catalog = await prisma.syntheticCatalog.findUniqueOrThrow({ where: { id: catalogId } });
    await writeAuditLog({
      ...sessionAuditActor(session), action: "core_images_requested", entityType: "catalog_generation_job", entityId: job.id,
      message: `Requested core images for ${catalog.name}`,
      data: { catalogId, sourceJobId: sourceJobId ?? null, allMissing: input.allMissing === true, imageTasks: job.tasks.length },
    });
    revalidateCatalog(catalog.slug);
    return { ok: true, jobId: job.id };
  } catch (error) { return errorResult(error); }
}

export async function getCoreImagesPreflightAction(input: { catalogId: number; sourceJobId?: number; allMissing?: boolean }) {
  await requireAdmin({});
  try {
    return { ok: true as const, ...await getCoreImagesPreflight(input) };
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : "Could not calculate core image targets" };
  }
}

export async function getCompleteLookPreflightAction(input: { catalogId: number; sourceJobId?: number }) {
  await requireAdmin({});
  try { return { ok: true as const, ...await getCompleteLookPreflight(input) }; }
  catch (error) { return { ok: false as const, message: error instanceof Error ? error.message : "Could not calculate Complete the Look eligibility" }; }
}

export async function createCompleteLookJobAction(input: { catalogId: number; sourceJobId?: number }) {
  const session = await requireAdmin({ requireEditorAccess: true });
  try {
    const catalogId = positiveIdSchema.parse(input.catalogId);
    const sourceJobId = input.sourceJobId == null ? undefined : positiveIdSchema.parse(input.sourceJobId);
    const job = await createCompleteLookJob({ catalogId, sourceJobId, createdByMappTeamId: adminId(session) });
    const catalog = await prisma.syntheticCatalog.findUniqueOrThrow({ where: { id: catalogId } });
    await writeAuditLog({ ...sessionAuditActor(session), action: "complete_look_generation_requested", entityType: "catalog_generation_job", entityId: job.id, message: `Requested Complete the Look generation for ${catalog.name}`, data: { catalogId, sourceJobId: sourceJobId ?? null, imageTasks: job.tasks.length } });
    revalidateCatalog(catalog.slug);
    return { ok: true, jobId: job.id };
  } catch (error) { return errorResult(error); }
}

export async function retryCatalogGenerationJobAction(jobId: number): Promise<CatalogActionResult> {
  const session = await requireAdmin({ requireEditorAccess: true });
  try {
    const id = positiveIdSchema.parse(jobId);
    const job = await resumeGenerationJob(id);
    const catalog = await prisma.syntheticCatalog.findUniqueOrThrow({ where: { id: job.catalogId } });
    await writeAuditLog({
      ...sessionAuditActor(session),
      action: "generation_retry_requested",
      entityType: "catalog_generation_job",
      entityId: job.id,
      message: `Retried failed generation tasks for ${catalog.name}`,
      data: { catalogId: catalog.id },
    });
    revalidateCatalog(catalog.slug);
    return { ok: true, jobId: job.id };
  } catch (error) {
    return errorResult(error);
  }
}

export async function cancelCatalogGenerationJobAction(jobId: number): Promise<CatalogActionResult> {
  const session = await requireAdmin({ requireEditorAccess: true });
  try {
    const id = positiveIdSchema.parse(jobId);
    const { job, previousStatus } = await cancelGenerationJob(id);
    const catalog = await prisma.syntheticCatalog.findUniqueOrThrow({ where: { id: job.catalogId } });
    await writeAuditLog({
      ...sessionAuditActor(session),
      action: "generation_cancelled",
      entityType: "catalog_generation_job",
      entityId: job.id,
      message: `Stopped generation for ${catalog.name}`,
      data: { catalogId: catalog.id, previousStatus },
    });
    revalidateCatalog(catalog.slug);
    return { ok: true, jobId: job.id };
  } catch (error) {
    return errorResult(error);
  }
}

export async function regenerateCatalogImageAction(imageAssetId: number): Promise<CatalogActionResult> {
  const session = await requireAdmin({ requireEditorAccess: true });
  try {
    const id = positiveIdSchema.parse(imageAssetId);
    const job = await enqueueImageRegeneration(id, adminId(session));
    const catalog = await prisma.syntheticCatalog.findUniqueOrThrow({ where: { id: job.catalogId } });
    await writeAuditLog({
      ...sessionAuditActor(session),
      action: "image_regeneration_requested",
      entityType: "synthetic_image_asset",
      entityId: id,
      message: `Requested image regeneration for ${catalog.name}`,
      data: { catalogId: catalog.id, jobId: job.id },
    });
    revalidateCatalog(catalog.slug);
    return { ok: true, jobId: job.id };
  } catch (error) {
    return errorResult(error);
  }
}

export async function updateCatalogSettingsAction(input: unknown): Promise<CatalogActionResult> {
  const session = await requireAdmin({ requireEditorAccess: true });
  try {
    const values = catalogSettingsInputSchema.parse(input);
    const existing = await prisma.syntheticCatalog.findUniqueOrThrow({ where: { id: values.catalogId } });
    const existingConfig = parseCatalogProfileConfig(existing.config);
    await prisma.syntheticCatalog.update({
      where: { id: existing.id },
      data: {
        brandName: values.brandName,
        defaultTextModel: values.defaultTextModel,
        defaultImageModel: values.defaultImageModel,
        config: JSON.parse(JSON.stringify({
          ...existingConfig,
          visualDirection: values.visualDirection,
        })) as Prisma.InputJsonValue,
      },
    });
    await writeAuditLog({
      ...sessionAuditActor(session),
      action: "settings_updated",
      entityType: "synthetic_catalog",
      entityId: existing.id,
      message: `Updated generation settings for ${existing.name}`,
      data: {
        before: {
          brandName: existing.brandName,
          defaultTextModel: existing.defaultTextModel,
          defaultImageModel: existing.defaultImageModel,
          visualDirection: existingConfig.visualDirection,
        },
        after: values,
      },
    });
    revalidateCatalog(existing.slug);
    return { ok: true };
  } catch (error) {
    return errorResult(error);
  }
}

export async function addCatalogTaxonomyAction(input: unknown): Promise<CatalogActionResult> {
  const session = await requireAdmin({ requireEditorAccess: true });
  try {
    const values = catalogTaxonomyInputSchema.parse(input);
    const catalog = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM synthetic_catalog WHERE id = ${values.catalogId} FOR UPDATE`;
      const existing = await tx.syntheticCatalog.findUniqueOrThrow({ where: { id: values.catalogId } });
      const config = parseCatalogProfileConfig(existing.config);
      const updated = addCatalogDepartment(config, values);
      await tx.syntheticCatalog.update({ where: { id: existing.id }, data: { config: JSON.parse(JSON.stringify(updated)) as Prisma.InputJsonValue } });
      return { existing, updated };
    });
    const summary = `Added department ${values.label.trim()}`;
    await writeAuditLog({
      ...sessionAuditActor(session),
      action: "taxonomy_added",
      entityType: "synthetic_catalog",
      entityId: catalog.existing.id,
      message: `${summary} in ${catalog.existing.name}`,
      data: { catalogId: catalog.existing.id, taxonomyType: "DEPARTMENT" },
    });
    revalidateCatalog(catalog.existing.slug);
    return { ok: true };
  } catch (error) {
    return errorResult(error);
  }
}

export async function saveCatalogMixAction(input: unknown): Promise<CatalogActionResult> {
  const session = await requireAdmin({ requireEditorAccess: true });
  try {
    const values = catalogMixInputSchema.parse(input);
    const totalProducts = values.rows.reduce((total, row) => total + (row.departmentKey == null ? 0 : row.productCount), 0);
    if (!Number.isSafeInteger(totalProducts) || totalProducts < 1) {
      throw new Error("Catalogue mix total must be a positive safe integer");
    }
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM synthetic_catalog WHERE id = ${values.catalogId} FOR UPDATE`;
      const catalog = await tx.syntheticCatalog.findUniqueOrThrow({ where: { id: values.catalogId } });
      const config = parseCatalogProfileConfig(catalog.config);
      const updatedConfig = parseCatalogProfileConfig({
        ...config,
        assortmentPlan: values.rows,
        designMix: { ...config.designMix, rules: config.designMix.rules.filter((rule) => values.rows.some((row) => row.id === rule.catalogMixRowId)) },
      });
      const outfitSlotChanges = updatedConfig.assortmentPlan.flatMap((row) => {
        const prior = config.assortmentPlan.find((item) => item.departmentKey === row.departmentKey && item.category === row.category && item.subcategory === row.subcategory);
        return prior && prior.outfitSlot !== row.outfitSlot ? [{ category: row.category, subcategory: row.subcategory, from: prior.outfitSlot, to: row.outfitSlot }] : [];
      });
      await tx.syntheticCatalog.update({ where: { id: catalog.id }, data: { config: JSON.parse(JSON.stringify(updatedConfig)) as Prisma.InputJsonValue } });
      return { catalog, previousRowCount: config.assortmentPlan.length, nextRowCount: updatedConfig.assortmentPlan.length, outfitSlotChanges };
    });
    await writeAuditLog({
      ...sessionAuditActor(session),
      action: "catalog_mix_updated",
      entityType: "synthetic_catalog",
      entityId: result.catalog.id,
      message: `Updated the catalogue mix for ${result.catalog.name}`,
      data: { catalogId: result.catalog.id, previousRowCount: result.previousRowCount, nextRowCount: result.nextRowCount, outfitSlotChanges: result.outfitSlotChanges },
    });
    revalidateCatalog(result.catalog.slug);
    return { ok: true };
  } catch (error) {
    return errorResult(error);
  }
}

export async function saveCatalogDesignMixAction(input: unknown): Promise<CatalogActionResult> {
  const session = await requireAdmin({ requireEditorAccess: true });
  try {
    const catalogId = positiveIdSchema.parse((input as { catalogId?: unknown })?.catalogId);
    const designMix = (input as { designMix?: unknown })?.designMix;
    const catalog = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM synthetic_catalog WHERE id = ${catalogId} FOR UPDATE`;
      const existing = await tx.syntheticCatalog.findUniqueOrThrow({ where: { id: catalogId } });
      const current = parseCatalogProfileConfig(existing.config);
      const updated = parseCatalogProfileConfig({ ...current, designMix });
      await tx.syntheticCatalog.update({ where: { id: catalogId }, data: { config: JSON.parse(JSON.stringify(updated)) as Prisma.InputJsonValue } });
      return existing;
    });
    await writeAuditLog({ ...sessionAuditActor(session), action: "catalog_design_mix_updated", entityType: "synthetic_catalog", entityId: catalog.id, message: `Updated design mix for ${catalog.name}`, data: { designMix } });
    revalidateCatalog(catalog.slug);
    return { ok: true };
  } catch (error) { return errorResult(error); }
}

async function setCatalogProductArchived(input: unknown, archived: boolean): Promise<CatalogActionResult> {
  const session = await requireAdmin({ requireEditorAccess: true });
  try {
    const productId = positiveIdSchema.parse(input);
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM synthetic_product WHERE id = ${productId} FOR UPDATE`;
      const product = await tx.syntheticProduct.findUniqueOrThrow({ where: { id: productId }, include: { catalog: true } });
      if (archived && !product.archivedAt) {
        const now = new Date();
        const styles = await tx.syntheticStyle.findMany({ where: { productId: product.id }, select: { id: true } });
        const styleIds = styles.map((style) => style.id);
        await tx.syntheticProduct.update({
          where: { id: product.id },
          data: { archivedAt: now, archivedByMappTeamId: adminId(session) ?? null },
        });
        await tx.catalogGenerationTask.updateMany({
          where: { productId: product.id, status: "QUEUED" },
          data: { status: "CANCELLED", finishedAt: now, lockedAt: null, lockedBy: null },
        });
        if (styleIds.length) {
          const affectedLooks = await tx.syntheticCompleteLook.findMany({
            where: { OR: [{ anchorStyleId: { in: styleIds } }, { items: { some: { companionStyleId: { in: styleIds } } } }] },
            select: { id: true, imageAssetId: true },
          });
          const lookIds = affectedLooks.map((look) => look.id);
          const lookAssetIds = affectedLooks.flatMap((look) => look.imageAssetId == null ? [] : [look.imageAssetId]);
          if (lookIds.length) await tx.syntheticCompleteLook.updateMany({ where: { id: { in: lookIds } }, data: { status: "STALE", errorMessage: "An anchor or companion product was archived." } });
          if (lookAssetIds.length) await tx.catalogGenerationTask.updateMany({ where: { imageAssetId: { in: lookAssetIds }, status: "QUEUED" }, data: { status: "CANCELLED", finishedAt: now, lockedAt: null, lockedBy: null } });
        }
        return { product, changed: true };
      }
      if (!archived && product.archivedAt) {
        await tx.syntheticProduct.update({
          where: { id: product.id },
          data: { archivedAt: null, archivedByMappTeamId: null },
        });
        return { product, changed: true };
      }
      return { product, changed: false };
    });
    if (result.changed) {
      await writeAuditLog({
        ...sessionAuditActor(session),
        action: archived ? "catalog_product_archived" : "catalog_product_restored",
        entityType: "synthetic_product",
        entityId: result.product.id,
        message: `${archived ? "Archived" : "Restored"} catalogue product ${result.product.id} in ${result.product.catalog.name}`,
        data: { catalogId: result.product.catalogId, productId: result.product.id },
      });
    }
    revalidateCatalog(result.product.catalog.slug);
    return { ok: true };
  } catch (error) {
    return errorResult(error);
  }
}

export async function archiveCatalogProductAction(input: unknown): Promise<CatalogActionResult> {
  return setCatalogProductArchived(input, true);
}

export async function restoreCatalogProductAction(input: unknown): Promise<CatalogActionResult> {
  return setCatalogProductArchived(input, false);
}
