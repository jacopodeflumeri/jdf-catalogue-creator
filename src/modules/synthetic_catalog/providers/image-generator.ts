export const CATALOG_IMAGE_ROLES = ["FRONT", "BACK", "ON_MODEL"] as const;
export type CatalogImageRoleValue = (typeof CATALOG_IMAGE_ROLES)[number];

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
