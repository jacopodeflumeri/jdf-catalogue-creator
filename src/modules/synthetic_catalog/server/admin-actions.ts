"use server";

import type { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma/client";
import { requireAdmin } from "@/modules/auth/server";
import { sessionAuditActor, writeAuditLog } from "@/modules/audit";
import {
  catalogSettingsInputSchema,
  parseAddProductsInput,
  positiveIdSchema,
} from "../admin/input";
import type { CatalogActionResult, CatalogDetailView } from "../admin/types";
import { parseCatalogProfileConfig } from "../config/profiles";
import { createGenerationJob, resumeGenerationJob } from "./generation-jobs";
import { enqueueImageRegeneration, getCatalogDetail } from "./admin-catalogs";
import { getCatalogExportSummary } from "./catalog-export";
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
      message: `Requested ${values.requestedProducts} products for ${catalog.name}`,
      data: { catalogId: catalog.id, departmentMode: values.departmentMode },
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
