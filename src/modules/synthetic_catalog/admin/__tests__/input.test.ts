import {
  addProductsInputSchema,
  catalogSettingsInputSchema,
} from "../input";

describe("catalog admin input", () => {
  it("bounds product batches and department modes", () => {
    expect(addProductsInputSchema.parse({ catalogId: 1, requestedProducts: 25, departmentMode: "AUTO" }))
      .toEqual({ catalogId: 1, requestedProducts: 25, departmentMode: "AUTO" });
    expect(() => addProductsInputSchema.parse({ catalogId: 1, requestedProducts: 101, departmentMode: "AUTO" }))
      .toThrow();
    expect(() => addProductsInputSchema.parse({ catalogId: 1, requestedProducts: 2, departmentMode: "KIDS" }))
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
