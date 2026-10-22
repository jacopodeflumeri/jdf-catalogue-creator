import { z } from "zod";
import { CATALOG_IMAGE_MODEL_OPTIONS } from "../config/profiles";
import {
  DEFAULT_MAX_PRODUCTS_PER_JOB,
  getCatalogGenerationLimits,
} from "../config/generation-limits";
import type { GenerationScope } from "../domain/planner";

export const generationScopeSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ALL") }),
  z.object({ type: z.literal("DEPARTMENT"), departmentKey: z.string().trim().min(1).max(40) }),
  z.object({ type: z.literal("CATEGORY"), category: z.string().trim().min(1).max(120) }),
]);

export function createAddProductsInputSchema(maxProductsPerJob: number) {
  return z.object({
    catalogId: z.number().int().positive(),
    requestedProducts: z.number().int().min(1).max(maxProductsPerJob).optional(),
    scope: generationScopeSchema,
    colorVariantCount: z.union([z.literal(2), z.literal(3)]).default(2),
  }).superRefine((values, context) => {
    if (values.scope.type === "ALL" && values.requestedProducts != null) {
      context.addIssue({ code: "custom", path: ["requestedProducts"], message: "All catalogue product count comes from the configured catalogue mix" });
    }
    if (values.scope.type !== "ALL" && values.requestedProducts == null) {
      context.addIssue({ code: "custom", path: ["requestedProducts"], message: "Choose a product count for this scope" });
    }
  });
}

export const addProductsInputSchema = createAddProductsInputSchema(DEFAULT_MAX_PRODUCTS_PER_JOB);

export function parseAddProductsInput(input: unknown) {
  const { maxProductsPerJob } = getCatalogGenerationLimits();
  return createAddProductsInputSchema(maxProductsPerJob).parse(input);
}

export type ParsedGenerationScope = GenerationScope;

export const catalogSettingsInputSchema = z.object({
  catalogId: z.number().int().positive(),
  brandName: z.string().trim().min(2).max(80),
  defaultTextModel: z.string().trim().regex(/^[a-z0-9._-]+\/[a-z0-9._:-]+$/i).max(160),
  defaultImageModel: z.enum(CATALOG_IMAGE_MODEL_OPTIONS),
  visualDirection: z.string().trim().min(10).max(500),
});

export const catalogTaxonomyInputSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("DEPARTMENT"), catalogId: z.number().int().positive(), label: z.string().trim().min(1).max(80), code: z.string().trim().min(1).max(6), generationWeight: z.number().positive() }),
  z.object({ type: z.literal("CATEGORY"), catalogId: z.number().int().positive(), category: z.string().trim().min(1).max(120), subcategory: z.string().trim().min(1).max(120) }),
  z.object({ type: z.literal("SUBCATEGORY"), catalogId: z.number().int().positive(), category: z.string().trim().min(1).max(120), subcategory: z.string().trim().min(1).max(120) }),
]);

export const catalogMixInputSchema = z.object({
  catalogId: z.number().int().positive(),
  rows: z.array(z.object({
    departmentKey: z.string().trim().min(1).max(40),
    category: z.string().trim().min(1).max(120),
    subcategory: z.string().trim().min(1).max(120),
    productCount: z.number().int().positive(),
  })).min(1).max(500),
}).superRefine(({ rows }, context) => {
  const seen = new Set<string>();
  rows.forEach((row, index) => {
    const key = [row.departmentKey, row.category, row.subcategory].map((value) => value.trim().toLocaleLowerCase()).join("\u0000");
    if (seen.has(key)) context.addIssue({ code: "custom", path: ["rows", index], message: "This department, category, and subcategory row already exists" });
    seen.add(key);
  });
});

export const positiveIdSchema = z.number().int().positive();
