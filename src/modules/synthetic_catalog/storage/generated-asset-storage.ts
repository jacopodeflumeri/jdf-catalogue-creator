import sharp from "sharp";
import type { CatalogImageRoleValue } from "../providers/image-generator";

export interface StoreGeneratedImageInput {
  catalogSlug: string;
  styleExternalId: string;
  role: CatalogImageRoleValue;
  assetPublicId: string;
  data: Buffer;
  sourceMimeType: string;
}

export interface StoredGeneratedImage {
  storageKey: string;
  mimeType: "image/webp";
  width: number;
  height: number;
  publicUrl: string;
}

export interface GeneratedAssetStorage {
  put(input: StoreGeneratedImageInput): Promise<StoredGeneratedImage>;
  get(storageKey: string): Promise<Buffer>;
  getStablePublicUrl(assetPublicId: string): string;
}

interface GeneratedObjectStore {
  putObject(
    key: string,
    body: Buffer,
    contentType: string,
    metadata?: Record<string, string>,
  ): Promise<void>;
  getObjectBuffer(key: string): Promise<Buffer>;
}

const defaultObjectStore: GeneratedObjectStore = {
  async putObject(key, body, contentType, metadata) {
    const { S3ImageService } = await import("@/modules/s3_images");
    return S3ImageService.getInstance().putGeneratedCatalogObject(
      key,
      body,
      contentType,
      metadata,
    );
  },
  async getObjectBuffer(key) {
    const { S3ImageService } = await import("@/modules/s3_images");
    return S3ImageService.getInstance().getGeneratedCatalogObjectBuffer(key);
  },
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function buildGeneratedImageStorageKey(
  catalogSlug: string,
  styleExternalId: string,
  role: CatalogImageRoleValue,
): string {
  const safeCatalogSlug =
    /^[a-z0-9-]+$/.test(catalogSlug) &&
    !catalogSlug.startsWith("-") &&
    !catalogSlug.endsWith("-") &&
    !catalogSlug.includes("--");
  if (!safeCatalogSlug) {
    throw new Error("Catalog slug is not safe for generated asset storage");
  }
  const safeStyleId =
    /^[A-Z0-9-]+$/.test(styleExternalId) &&
    styleExternalId.includes("-") &&
    !styleExternalId.startsWith("-") &&
    !styleExternalId.endsWith("-") &&
    !styleExternalId.includes("--");
  if (!safeStyleId) {
    throw new Error("Style ID is not safe for generated asset storage");
  }
  const filename = role === "ON_MODEL" ? "model" : role === "COMPLETE_LOOK" ? "complete-look" : role.toLowerCase();
  return `public/catalogs/${catalogSlug}/${styleExternalId}/${filename}.webp`;
}

export class S3GeneratedAssetStorage implements GeneratedAssetStorage {
  constructor(
    private readonly objects: GeneratedObjectStore = defaultObjectStore,
    private readonly appUrl: string = process.env.APP_URL || "http://localhost:3000",
  ) {}

  async put(input: StoreGeneratedImageInput): Promise<StoredGeneratedImage> {
    if (!UUID_PATTERN.test(input.assetPublicId)) {
      throw new Error("Generated asset public ID must be a UUID");
    }
    if (!input.sourceMimeType.startsWith("image/")) {
      throw new Error(`Generated asset has unsupported MIME type '${input.sourceMimeType}'`);
    }
    const storageKey = buildGeneratedImageStorageKey(
      input.catalogSlug,
      input.styleExternalId,
      input.role,
    );
    const converted = await sharp(input.data)
      .rotate()
      .webp({ quality: 90 })
      .toBuffer({ resolveWithObject: true });
    if (!converted.info.width || !converted.info.height) {
      throw new Error("Generated image dimensions could not be determined");
    }

    await this.objects.putObject(storageKey, converted.data, "image/webp", {
      catalog: input.catalogSlug,
      style: input.styleExternalId,
      role: input.role,
      asset: input.assetPublicId,
    });
    return {
      storageKey,
      mimeType: "image/webp",
      width: converted.info.width,
      height: converted.info.height,
      publicUrl: this.getStablePublicUrl(input.assetPublicId),
    };
  }

  get(storageKey: string): Promise<Buffer> {
    return this.objects.getObjectBuffer(storageKey);
  }

  getStablePublicUrl(assetPublicId: string): string {
    if (!UUID_PATTERN.test(assetPublicId)) {
      throw new Error("Generated asset public ID must be a UUID");
    }
    return new URL(`/api/catalog-assets/${assetPublicId}`, this.appUrl).toString();
  }
}
