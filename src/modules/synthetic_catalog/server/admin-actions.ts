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
      await tx.syntheticCatalog.update({ where: { id: catalog.id }, data: { config: JSON.parse(JSON.stringify(updatedConfig)) as Prisma.InputJsonValue } });
      return { catalog, previousRowCount: config.assortmentPlan.length, nextRowCount: updatedConfig.assortmentPlan.length };
    });
    await writeAuditLog({
      ...sessionAuditActor(session),
      action: "catalog_mix_updated",
      entityType: "synthetic_catalog",
      entityId: result.catalog.id,
      message: `Updated the catalogue mix for ${result.catalog.name}`,
      data: { catalogId: result.catalog.id, previousRowCount: result.previousRowCount, nextRowCount: result.nextRowCount },
    });
    revalidateCatalog(result.catalog.slug);
    return { ok: true };
  } catch (error) {
    return errorResult(error);
  }
}
