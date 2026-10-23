export const REQUIRED_CORE_IMAGE_ROLES = ["FRONT", "BACK"] as const;
/** ON_MODEL is retained for existing assets and explicit legacy regeneration only. */
export const OPTIONAL_IMAGE_ROLES = ["ON_MODEL", "COMPLETE_LOOK"] as const;
/** Backwards-compatible alias used by existing core image generation code. */
export const CATALOG_IMAGE_ROLES = REQUIRED_CORE_IMAGE_ROLES;
export type CatalogImageRoleValue = (typeof REQUIRED_CORE_IMAGE_ROLES)[number] | (typeof OPTIONAL_IMAGE_ROLES)[number];

export interface ImageReference {
  data: Buffer;
  mimeType: string;
  assetId?: number;
  description?: string;
}

export interface CatalogImageGenerationInput {
  model: string;
  role: CatalogImageRoleValue;
  prompt: string;
  reference?: ImageReference;
  references?: ImageReference[];
  regeneration?: boolean;
  requireReferences?: boolean;
}

export interface GeneratedCatalogImage {
  data: Buffer;
  mimeType: string;
  usedReference: boolean;
}

export interface CatalogImageGenerator {
  generateImage(input: CatalogImageGenerationInput): Promise<GeneratedCatalogImage>;
}
