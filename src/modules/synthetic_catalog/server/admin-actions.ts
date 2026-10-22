"use server";

import type { Prisma } from "@/generated/prisma/client";
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
import { addCatalogCategory, addCatalogDepartment, addCatalogSubcategory } from "../config/taxonomy";
import { cancelGenerationJob, createGenerationJob, resumeGenerationJob } from "./generation-jobs";
import {
  enqueueImageRegeneration,
  getCatalogDetail,
  getCatalogProductDetail,
} from "./admin-catalogs";
import { getCatalogExportSummary } from "./catalog-export";
import { getCatalogGenerationLimits } from "../config/generation-limits";
import { createCoreImagesJob, getCoreImagesPreflight } from "./core-image-jobs";
import { createCompleteLookJob, getCompleteLookPreflight } from "./complete-look-jobs";
import type { CatalogExportSummary } from "../export/demoware-csv";

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
        config: {
          ...existingConfig,
          visualDirection: values.visualDirection,
        } as Prisma.InputJsonValue,
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
      const updated = values.type === "DEPARTMENT"
        ? addCatalogDepartment(config, values)
        : values.type === "CATEGORY"
          ? addCatalogCategory(config, values.category, values.subcategory)
          : addCatalogSubcategory(config, values.category, values.subcategory);
      await tx.syntheticCatalog.update({ where: { id: existing.id }, data: { config: JSON.parse(JSON.stringify(updated)) as Prisma.InputJsonValue } });
      return { existing, updated };
    });
    const summary = values.type === "DEPARTMENT" ? `Added department ${values.label.trim()}` : values.type === "CATEGORY" ? `Added category ${values.category.trim()}` : `Added subcategory to ${values.category.trim()}`;
    await writeAuditLog({
      ...sessionAuditActor(session),
      action: "taxonomy_added",
      entityType: "synthetic_catalog",
      entityId: catalog.existing.id,
      message: `${summary} in ${catalog.existing.name}`,
      data: { catalogId: catalog.existing.id, taxonomyType: values.type },
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
    const { maxProductsPerJob } = getCatalogGenerationLimits();
    const totalProducts = values.rows.reduce((total, row) => total + row.productCount, 0);
    if (!Number.isSafeInteger(totalProducts) || totalProducts > maxProductsPerJob) {
      throw new Error(`Catalogue mix total must be between 1 and ${maxProductsPerJob} products`);
    }
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM synthetic_catalog WHERE id = ${values.catalogId} FOR UPDATE`;
      const catalog = await tx.syntheticCatalog.findUniqueOrThrow({ where: { id: values.catalogId } });
      const config = parseCatalogProfileConfig(catalog.config);
      const categories = [...config.categories];
      const subcategories: Record<string, string[]> = Object.fromEntries(Object.entries(config.subcategories).map(([key, value]) => [key, [...value]]));
      for (const row of values.rows) {
        let category = categories.find((item) => item.toLocaleLowerCase() === row.category.toLocaleLowerCase());
        if (!category) {
          category = row.category;
          categories.push(category);
          subcategories[category] = [];
        }
        const existingSubcategories = subcategories[category] ?? [];
        if (!existingSubcategories.some((item) => item.toLocaleLowerCase() === row.subcategory.toLocaleLowerCase())) {
          subcategories[category] = [...existingSubcategories, row.subcategory];
        }
      }
      const updatedConfig = parseCatalogProfileConfig({
        ...config,
        categories,
        subcategories,
        assortmentPlan: values.rows,
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
