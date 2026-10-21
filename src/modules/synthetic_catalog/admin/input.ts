import { z } from "zod";
import { CATALOG_IMAGE_MODEL_OPTIONS } from "../config/profiles";
import {
  DEFAULT_MAX_PRODUCTS_PER_JOB,
  getCatalogGenerationLimits,
} from "../config/generation-limits";

export function createAddProductsInputSchema(maxProductsPerJob: number) {
  return z.object({
    catalogId: z.number().int().positive(),
    requestedProducts: z.number().int().min(1).max(maxProductsPerJob),
    departmentMode: z.enum(["AUTO", "WOMEN", "MEN"]),
  });
}

export const addProductsInputSchema = createAddProductsInputSchema(DEFAULT_MAX_PRODUCTS_PER_JOB);

export function parseAddProductsInput(input: unknown) {
  const { maxProductsPerJob } = getCatalogGenerationLimits();
  return createAddProductsInputSchema(maxProductsPerJob).parse(input);
}

export const catalogSettingsInputSchema = z.object({
  catalogId: z.number().int().positive(),
  brandName: z.string().trim().min(2).max(80),
  defaultTextModel: z.string().trim().regex(/^[a-z0-9._-]+\/[a-z0-9._:-]+$/i).max(160),
  defaultImageModel: z.enum(CATALOG_IMAGE_MODEL_OPTIONS),
  visualDirection: z.string().trim().min(10).max(500),
});

export const positiveIdSchema = z.number().int().positive();
