import {
  addProductsInputSchema,
  catalogSettingsInputSchema,
} from "../input";

describe("catalog admin input", () => {
  it("validates generation scopes and accepts only 2 or 3 color variants", () => {
    expect(addProductsInputSchema.parse({ catalogId: 1, requestedProducts: 25, scope: { type: "ALL" } }))
      .toEqual({ catalogId: 1, requestedProducts: 25, scope: { type: "ALL" }, colorVariantCount: 2 });
    expect(() => addProductsInputSchema.parse({ catalogId: 1, requestedProducts: 101, scope: { type: "ALL" } }))
      .toThrow();
    expect(() => addProductsInputSchema.parse({ catalogId: 1, requestedProducts: 2, scope: { type: "DEPARTMENT" } }))
      .toThrow();
    expect(() => addProductsInputSchema.parse({ catalogId: 1, requestedProducts: 2, scope: { type: "ALL" }, colorVariantCount: 1 }))
      .toThrow();
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
});
