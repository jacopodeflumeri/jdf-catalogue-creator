import { z } from "zod";
import { CATALOG_IMAGE_MODEL_OPTIONS } from "../config/profiles";

const MAX_PRODUCTS_PER_JOB = 100;

export const addProductsInputSchema = z.object({
  catalogId: z.number().int().positive(),
  requestedProducts: z.number().int().min(1).max(MAX_PRODUCTS_PER_JOB),
  departmentMode: z.enum(["AUTO", "WOMEN", "MEN"]),
});

export const catalogSettingsInputSchema = z.object({
  catalogId: z.number().int().positive(),
  brandName: z.string().trim().min(2).max(80),
  defaultTextModel: z.string().trim().regex(/^[a-z0-9._-]+\/[a-z0-9._:-]+$/i).max(160),
  defaultImageModel: z.enum(CATALOG_IMAGE_MODEL_OPTIONS),
  visualDirection: z.string().trim().min(10).max(500),
});

export const positiveIdSchema = z.number().int().positive();
