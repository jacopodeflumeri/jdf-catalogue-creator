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

export interface ProductGenerationInput {
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
