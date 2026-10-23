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
    seed: z.string().trim().min(1).max(200).optional(),
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
]);

export const catalogMixInputSchema = z.object({
  catalogId: z.number().int().positive(),
  rows: z.array(z.object({
    id: z.string().trim().regex(/^[A-Za-z0-9._:-]{1,200}$/),
    departmentKey: z.string().trim().min(1).max(40).nullable(),
    category: z.string().trim().min(1).max(120),
    subcategory: z.string().trim().min(1).max(120),
    productCount: z.number().int().nonnegative(),
    outfitSlot: z.enum(["TOP", "BOTTOM", "ONE_PIECE", "OUTERWEAR", "FOOTWEAR", "BAG", "ACCESSORY"]).nullable(),
  })).min(1).max(500),
}).superRefine(({ rows }, context) => {
  const seen = new Set<string>();
  const ids = new Set<string>();
  rows.forEach((row, index) => {
    const key = [row.departmentKey ?? "", row.category, row.subcategory].map((value) => value.trim().toLocaleLowerCase()).join("\u0000");
    if (seen.has(key)) context.addIssue({ code: "custom", path: ["rows", index], message: "This department, category, and subcategory row already exists" });
    seen.add(key);
    if (ids.has(row.id)) context.addIssue({ code: "custom", path: ["rows", index, "id"], message: "Catalogue mix row IDs must be unique" });
    ids.add(row.id);
    if (row.departmentKey == null && (row.productCount !== 0 || row.outfitSlot != null)) context.addIssue({ code: "custom", path: ["rows", index], message: "Unassigned rows need zero products and no outfit slot" });
    if (row.departmentKey != null && (row.productCount < 1 || row.outfitSlot == null)) context.addIssue({ code: "custom", path: ["rows", index], message: "Assigned rows need a positive quota and an outfit slot" });
  });
});

export const positiveIdSchema = z.number().int().positive();
