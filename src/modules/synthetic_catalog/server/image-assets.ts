import { prisma } from "@/lib/prisma/client";
import { parseCatalogProfileConfig } from "../config/profiles";
import {
  CATALOG_IMAGE_ROLES,
  type CatalogImageGenerator,
  type CatalogImageRoleValue,
  type ImageReference,
} from "../providers/image-generator";
import { buildCatalogImagePrompt } from "../providers/image-prompt";
import type { GeneratedAssetStorage } from "../storage/generated-asset-storage";

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
}) {
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
  const profile = parseCatalogProfileConfig(asset.style.product.catalog.config);
  const reference = await getReference(input.styleId, input.role, input.storage);
  const prompt = buildCatalogImagePrompt({
    role: input.role,
    catalog: {
      segment: asset.style.product.catalog.segment,
      brandName: asset.style.product.catalog.brandName,
      visualDirection: profile.visualDirection,
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
    const generated = await input.generator.generateImage({
      model: input.model,
      role: input.role,
      prompt,
      reference,
      regeneration: input.regeneration,
    });
    const stored = await input.storage.put({
      catalogSlug: asset.style.product.catalog.slug,
      styleExternalId: asset.style.externalId,
      role: input.role,
      assetPublicId: asset.publicId,
      data: generated.data,
      sourceMimeType: generated.mimeType,
    });
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
    const message = error instanceof Error ? error.message : "Unknown image generation error";
    await prisma.syntheticImageAsset.update({
      where: { id: asset.id },
      data: { status: "FAILED", errorMessage: message.slice(0, 2000) },
    });
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
