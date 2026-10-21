import { z } from "zod";
import type { CatalogProfileConfig } from "../config/profiles";
import type { PlannedProduct } from "../domain/planner";

export const generatedProductSpecSchema = z.object({
  name: z.string().min(1).max(160),
  description: z.string().min(1).max(2000),
  material: z.string().min(1).max(240),
  season: z.string().min(1).max(120),
  colorName: z.string().min(1).max(120),
  colorCode: z.string().regex(/^[A-Z0-9]+$/),
  design: z.object({
    silhouette: z.string().min(1),
    construction: z.string().min(1),
    details: z.array(z.string().min(1)).max(8),
  }),
});

export type GeneratedProductSpec = z.infer<typeof generatedProductSpecSchema>;

export function validateGeneratedProductSpec(
  rawSpec: unknown,
  config: CatalogProfileConfig,
): GeneratedProductSpec {
  const spec = generatedProductSpecSchema.parse(rawSpec);
  if (!config.materials.includes(spec.material)) {
    throw new Error(`Generated material '${spec.material}' is outside the catalog vocabulary`);
  }
  if (!config.seasons.includes(spec.season)) {
    throw new Error(`Generated season '${spec.season}' is outside the catalog vocabulary`);
  }
  const color = config.colors.find((item) => item.code === spec.colorCode);
  if (!color || color.name !== spec.colorName) {
    throw new Error(`Generated color '${spec.colorCode}' is outside the catalog palette`);
  }
  return spec;
}

export interface ProductGenerationInput {
  /** Persisted model selected for this generation job. */
  model: string;
  catalog: {
    slug: string;
    segment: string;
    brandName: string;
    config: CatalogProfileConfig;
  };
  plan: PlannedProduct;
}

export interface ProductGenerator {
  generateProduct(input: ProductGenerationInput): Promise<GeneratedProductSpec>;
}
