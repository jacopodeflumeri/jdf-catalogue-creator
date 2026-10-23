import { prisma } from "@/lib/prisma/client";
import { parseCatalogProfileConfig } from "../config/profiles";
import {
  CATALOG_IMAGE_ROLES,
  type CatalogImageGenerator,
  type CatalogImageRoleValue,
  type ImageReference,
} from "../providers/image-generator";
import { buildCatalogImagePrompt } from "../providers/image-prompt";
import { buildCompleteLookPrompt } from "../providers/complete-look-prompt";
import type { GeneratedAssetStorage } from "../storage/generated-asset-storage";
import { CatalogJobCancelledError } from "./job-cancellation";

export async function ensureStyleImageAssets(styleId: number) {
  await prisma.$transaction(
    CATALOG_IMAGE_ROLES.map((role) =>
      prisma.syntheticImageAsset.upsert({
        where: { styleId_role: { styleId, role } },
        update: {},
        create: { styleId, role, status: "QUEUED" },
      }),
    ),
  );
  return prisma.syntheticImageAsset.findMany({
    where: { styleId },
    orderBy: { id: "asc" },
  });
}

async function getReference(
  styleId: number,
  role: CatalogImageRoleValue,
  storage: GeneratedAssetStorage,
): Promise<ImageReference | undefined> {
  if (role === "FRONT") return undefined;
  const front = await prisma.syntheticImageAsset.findUnique({
    where: { styleId_role: { styleId, role: "FRONT" } },
  });
  if (!front?.storageKey || !front.mimeType) return undefined;
  return {
    data: await storage.get(front.storageKey),
    mimeType: front.mimeType,
    assetId: front.id,
  };
}

export async function generateStyleImage(input: {
  styleId: number;
  role: CatalogImageRoleValue;
  model: string;
  generator: CatalogImageGenerator;
  storage: GeneratedAssetStorage;
  regeneration?: boolean;
  catalogSnapshot?: { brandName: string; segment: string; visualDirection: string };
  assertActive?: () => Promise<void>;
}) {
  if (input.role === "COMPLETE_LOOK") return generateCompleteLookImage(input);
  await ensureStyleImageAssets(input.styleId);
  const asset = await prisma.syntheticImageAsset.findUniqueOrThrow({
    where: { styleId_role: { styleId: input.styleId, role: input.role } },
    include: {
      style: {
        include: {
          product: { include: { catalog: true } },
        },
      },
    },
  });
  const profile = input.catalogSnapshot ? null : parseCatalogProfileConfig(asset.style.product.catalog.config);
  const reference = await getReference(input.styleId, input.role, input.storage);
  const prompt = buildCatalogImagePrompt({
    role: input.role,
    catalog: {
      segment: input.catalogSnapshot?.segment ?? asset.style.product.catalog.segment,
      brandName: input.catalogSnapshot?.brandName ?? asset.style.product.catalog.brandName,
      visualDirection: input.catalogSnapshot?.visualDirection ?? profile!.visualDirection,
    },
    product: {
      name: asset.style.product.name,
      department: asset.style.product.department,
      category: asset.style.product.category,
      subcategory: asset.style.product.subcategory,
      material: asset.style.product.material,
      season: asset.style.product.season,
    },
    style: {
      externalId: asset.style.externalId,
      colorName: asset.style.colorName,
      colorCode: asset.style.colorCode,
      visualSpec: asset.style.visualSpec,
    },
    hasFrontReference: Boolean(reference),
  });

  await prisma.syntheticImageAsset.update({
    where: { id: asset.id },
    data: {
      status: "GENERATING",
      attemptCount: { increment: 1 },
      model: input.model,
      prompt,
      errorMessage: null,
    },
  });

  try {
    await input.assertActive?.();
    const generated = await input.generator.generateImage({
      model: input.model,
      role: input.role,
      prompt,
      reference,
      regeneration: input.regeneration,
    });
    await input.assertActive?.();
    const stored = await input.storage.put({
      catalogSlug: asset.style.product.catalog.slug,
      styleExternalId: asset.style.externalId,
      role: input.role,
      assetPublicId: asset.publicId,
      data: generated.data,
      sourceMimeType: generated.mimeType,
    });
    await input.assertActive?.();
    return await prisma.syntheticImageAsset.update({
      where: { id: asset.id },
      data: {
        status: "READY",
        storageKey: stored.storageKey,
        mimeType: stored.mimeType,
        width: stored.width,
        height: stored.height,
        referenceAssetId: generated.usedReference ? reference?.assetId : null,
        errorMessage: null,
        generatedAt: new Date(),
      },
    });
  } catch (error) {
    if (error instanceof CatalogJobCancelledError) {
      await prisma.syntheticImageAsset.update({
        where: { id: asset.id },
        data: { status: "QUEUED", errorMessage: null },
      });
      throw error;
    }
    const message = error instanceof Error ? error.message : "Unknown image generation error";
    await prisma.syntheticImageAsset.update({
      where: { id: asset.id },
      data: { status: "FAILED", errorMessage: message.slice(0, 2000) },
    });
    throw error;
  }
}

async function assertCompleteLookCurrent(lookId: number) {
  const look = await prisma.syntheticCompleteLook.findUniqueOrThrow({
    where: { id: lookId },
    include: { anchorStyle: { include: { product: true } }, items: { include: { companionStyle: { include: { product: true } } } } },
  });
  if (look.status === "STALE" || look.anchorStyle.product.archivedAt || look.items.some((item) => item.companionStyle.product.archivedAt)) {
    throw new Error("Complete the Look became stale because an anchor or companion product is archived");
  }
  const missing = await prisma.syntheticStyle.count({
    where: { product: { catalogId: look.anchorStyle.product.catalogId, archivedAt: null }, NOT: { images: { some: { role: "FRONT", status: "READY" } } } },
  });
  const missingBack = await prisma.syntheticStyle.count({
    where: { product: { catalogId: look.anchorStyle.product.catalogId, archivedAt: null }, NOT: { images: { some: { role: "BACK", status: "READY" } } } },
  });
  if (missing || missingBack) throw new Error(`Complete the Look core-image gate changed (${missing} FRONT and ${missingBack} BACK styles missing)`);
  return look;
}

async function generateCompleteLookImage(input: {
  styleId: number;
  role: CatalogImageRoleValue;
  model: string;
  generator: CatalogImageGenerator;
  storage: GeneratedAssetStorage;
  regeneration?: boolean;
  catalogSnapshot?: { brandName: string; segment: string; visualDirection: string };
  assertActive?: () => Promise<void>;
}) {
  const look = await prisma.syntheticCompleteLook.findUniqueOrThrow({
    where: { anchorStyleId: input.styleId },
    include: {
      anchorStyle: { include: { product: { include: { catalog: true } }, images: true } },
      items: { orderBy: { sortOrder: "asc" }, include: { companionStyle: { include: { product: true, images: true } } } },
    },
  });
  if (look.items.length === 0) throw new Error("Complete the Look has no persisted companions");
  await assertCompleteLookCurrent(look.id);
  const asset = await prisma.syntheticImageAsset.findUniqueOrThrow({ where: { styleId_role: { styleId: input.styleId, role: "COMPLETE_LOOK" } } });
  const references: ImageReference[] = [];
  const anchorOnModel = look.anchorStyle.images.find((image) => image.role === "ON_MODEL" && image.status === "READY" && image.storageKey && image.mimeType);
  const anchorFront = look.anchorStyle.images.find((image) => image.role === "FRONT" && image.status === "READY" && image.storageKey && image.mimeType);
  if (!anchorFront) throw new Error("The anchor FRONT reference is not ready");
  if (anchorOnModel) references.push({ data: await input.storage.get(anchorOnModel.storageKey!), mimeType: anchorOnModel.mimeType!, assetId: anchorOnModel.id, description: "anchor item already worn by the model" });
  references.push({ data: await input.storage.get(anchorFront.storageKey!), mimeType: anchorFront.mimeType!, assetId: anchorFront.id, description: "authoritative anchor product reference" });
  for (const item of look.items) {
    if (item.companionStyle.product.archivedAt) throw new Error("A companion product is archived");
    const front = item.companionStyle.images.find((image) => image.role === "FRONT" && image.status === "READY" && image.storageKey && image.mimeType);
    if (!front) throw new Error(`Companion ${item.companionStyle.externalId} has no READY FRONT image`);
    const companionDesign = item.companionStyle.visualSpec && typeof item.companionStyle.visualSpec === "object" ? item.companionStyle.visualSpec as Record<string, unknown> : {};
    references.push({ data: await input.storage.get(front.storageKey!), mimeType: front.mimeType!, assetId: front.id, description: `companion ${item.outfitSlot.toLowerCase().replaceAll("_", " ")} ${item.companionStyle.product.name} in ${item.companionStyle.colorName}; assigned pattern ${String(companionDesign.patternCode ?? "none")}; assigned embellishments ${JSON.stringify(companionDesign.embellishmentCodes ?? [])}; construction ${JSON.stringify(companionDesign.details ?? [])}` });
  }
  if (references.length < 2) throw new Error("Complete the Look requires multiple reference images");
  if (references.length > 8) throw new Error("Complete the Look reference set exceeds the supported limit");
  const catalog = look.anchorStyle.product.catalog;
  const profile = parseCatalogProfileConfig(catalog.config);
  const prompt = buildCompleteLookPrompt({
    anchor: { name: look.anchorStyle.product.name, category: look.anchorStyle.product.category, subcategory: look.anchorStyle.product.subcategory, material: look.anchorStyle.product.material, season: look.anchorStyle.product.season, colorName: look.anchorStyle.colorName, colorCode: look.anchorStyle.colorCode, visualSpec: look.anchorStyle.visualSpec },
    catalog: { brandName: input.catalogSnapshot?.brandName ?? catalog.brandName, segment: input.catalogSnapshot?.segment ?? catalog.segment, visualDirection: input.catalogSnapshot?.visualDirection ?? profile.visualDirection },
    references,
  });
  await prisma.syntheticImageAsset.update({ where: { id: asset.id }, data: { status: "GENERATING", attemptCount: { increment: 1 }, model: input.model, prompt, errorMessage: null } });
  await prisma.syntheticCompleteLook.update({ where: { id: look.id }, data: { status: "GENERATING", errorMessage: null } });
  try {
    await input.assertActive?.();
    await assertCompleteLookCurrent(look.id);
    const generated = await input.generator.generateImage({ model: input.model, role: "COMPLETE_LOOK", prompt, references, regeneration: input.regeneration });
    await input.assertActive?.();
    await assertCompleteLookCurrent(look.id);
    const stored = await input.storage.put({ catalogSlug: catalog.slug, styleExternalId: look.anchorStyle.externalId, role: "COMPLETE_LOOK", assetPublicId: asset.publicId, data: generated.data, sourceMimeType: generated.mimeType });
    await input.assertActive?.();
    await assertCompleteLookCurrent(look.id);
    const result = await prisma.syntheticImageAsset.update({ where: { id: asset.id }, data: { status: "READY", storageKey: stored.storageKey, mimeType: stored.mimeType, width: stored.width, height: stored.height, referenceAssetId: references[0]?.assetId ?? null, errorMessage: null, generatedAt: new Date() } });
    await prisma.syntheticCompleteLook.update({ where: { id: look.id }, data: { status: "READY", errorMessage: null } });
    return result;
  } catch (error) {
    if (error instanceof CatalogJobCancelledError) {
      await prisma.syntheticImageAsset.update({ where: { id: asset.id }, data: { status: "QUEUED", errorMessage: null } });
      await prisma.syntheticCompleteLook.updateMany({ where: { id: look.id, status: { not: "STALE" } }, data: { status: "QUEUED" } });
      throw error;
    }
    const message = error instanceof Error ? error.message : "Complete the Look image generation failed";
    await prisma.syntheticImageAsset.update({ where: { id: asset.id }, data: { status: "FAILED", errorMessage: message.slice(0, 2000) } });
    await prisma.syntheticCompleteLook.updateMany({ where: { id: look.id, status: { not: "STALE" } }, data: { status: "FAILED", errorMessage: message.slice(0, 2000) } });
    throw error;
  }
}

export async function generateStyleImages(input: {
  styleId: number;
  model: string;
  generator: CatalogImageGenerator;
  storage: GeneratedAssetStorage;
}) {
  await ensureStyleImageAssets(input.styleId);
  for (const role of CATALOG_IMAGE_ROLES) {
    try {
      await generateStyleImage({ ...input, role });
    } catch {
      // Each role has its own durable FAILED state. Continue so a failed front
      // image does not prevent prompt-only back and on-model generation.
    }
  }
  return prisma.syntheticImageAsset.findMany({
    where: { styleId: input.styleId },
    orderBy: { id: "asc" },
  });
}

export async function regenerateImageAsset(input: {
  imageAssetId: number;
  model: string;
  generator: CatalogImageGenerator;
  storage: GeneratedAssetStorage;
}) {
  const asset = await prisma.syntheticImageAsset.findUniqueOrThrow({
    where: { id: input.imageAssetId },
  });
  return generateStyleImage({
    styleId: asset.styleId,
    role: asset.role,
    model: input.model,
    generator: input.generator,
    storage: input.storage,
    regeneration: true,
  });
}
