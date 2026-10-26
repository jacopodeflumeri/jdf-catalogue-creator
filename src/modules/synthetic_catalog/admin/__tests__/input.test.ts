import {
  addProductsInputSchema,
  catalogMixInputSchema,
  catalogSettingsInputSchema,
  catalogTaxonomyInputSchema,
} from "../input";

describe("catalog admin input", () => {
  it("validates generation scopes and accepts only 2 or 3 color variants", () => {
    expect(addProductsInputSchema.parse({ catalogId: 1, scope: { type: "ALL" } }))
      .toEqual({ catalogId: 1, scope: { type: "ALL" }, colorVariantCount: 2 });
    expect(() => addProductsInputSchema.parse({ catalogId: 1, requestedProducts: 25, scope: { type: "ALL" } }))
      .toThrow();
    expect(() => addProductsInputSchema.parse({ catalogId: 1, requestedProducts: 2, scope: { type: "DEPARTMENT" } }))
      .toThrow();
    expect(() => addProductsInputSchema.parse({ catalogId: 1, requestedProducts: 2, scope: { type: "ALL" }, colorVariantCount: 1 }))
      .toThrow();
  });

  it("accepts large positive safe integers and rejects invalid quantities", () => {
    for (const requestedProducts of [101, 500, 1_500, 10_000]) {
      expect(addProductsInputSchema.parse({ catalogId: 1, requestedProducts, scope: { type: "DEPARTMENT", departmentKey: "WOMEN" } }).requestedProducts)
        .toBe(requestedProducts);
    }
    for (const requestedProducts of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => addProductsInputSchema.parse({ catalogId: 1, requestedProducts, scope: { type: "DEPARTMENT", departmentKey: "WOMEN" } }))
        .toThrow();
    }
  });

  it("allows Catalogue Mix totals above former limits while requiring valid row counts", () => {
    const row = { id: "mix-1", departmentKey: "WOMEN", category: "coats", subcategory: "wool", productCount: 1_500, outfitSlot: "OUTERWEAR" as const };
    expect(catalogMixInputSchema.parse({ catalogId: 1, rows: [row] }).rows[0]?.productCount).toBe(1_500);
    for (const productCount of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => catalogMixInputSchema.parse({ catalogId: 1, rows: [{ ...row, productCount }] })).toThrow();
    }
  });

  it("accepts only explicit LiteLLM provider/model names", () => {
    const valid = {
      catalogId: 1,
      brandName: "Aureline",
      defaultTextModel: "openai/gpt-5.4-mini",
      defaultImageModel: "openai/gpt-image-2",
      visualDirection: "Controlled editorial studio lighting",
    };
    expect(catalogSettingsInputSchema.parse(valid)).toEqual(valid);
    expect(() => catalogSettingsInputSchema.parse({ ...valid, defaultImageModel: "gpt-image-2" }))
      .toThrow();
  });

  it("requires only a label and product ID code when adding a department", () => {
    const department = { type: "DEPARTMENT" as const, catalogId: 1, label: "Kids", code: "K" };
    expect(catalogTaxonomyInputSchema.parse(department)).toEqual(department);
  });

  it("accepts visible unassigned mix rows only with zero quota and no outfit slot", () => {
    const taxonomyRow = { id: "legacy-row", departmentKey: null, category: "babywear", subcategory: "onesies", productCount: 0, outfitSlot: null };
    expect(catalogMixInputSchema.parse({ catalogId: 1, rows: [taxonomyRow] }).rows).toEqual([taxonomyRow]);
    expect(() => catalogMixInputSchema.parse({ catalogId: 1, rows: [{ ...taxonomyRow, productCount: 2 }] })).toThrow();
    expect(() => catalogMixInputSchema.parse({ catalogId: 1, rows: [{ ...taxonomyRow, departmentKey: "WOMEN", productCount: 2 }] })).toThrow();
  });
});
