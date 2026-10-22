export const REQUIRED_CORE_IMAGE_ROLES = ["FRONT", "BACK", "ON_MODEL"] as const;
export const OPTIONAL_IMAGE_ROLES = [] as const;
/** Backwards-compatible alias used by existing core image generation code. */
export const CATALOG_IMAGE_ROLES = REQUIRED_CORE_IMAGE_ROLES;
export type CatalogImageRoleValue = (typeof REQUIRED_CORE_IMAGE_ROLES)[number];

export interface ImageReference {
  data: Buffer;
  mimeType: string;
  assetId: number;
}

export interface CatalogImageGenerationInput {
  model: string;
  role: CatalogImageRoleValue;
  prompt: string;
  reference?: ImageReference;
  regeneration?: boolean;
}

export interface GeneratedCatalogImage {
  data: Buffer;
  mimeType: string;
  usedReference: boolean;
}

export interface CatalogImageGenerator {
  generateImage(input: CatalogImageGenerationInput): Promise<GeneratedCatalogImage>;
}
