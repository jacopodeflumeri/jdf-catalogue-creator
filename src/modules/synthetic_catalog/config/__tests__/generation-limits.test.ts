import {
  DEFAULT_LARGE_JOB_THRESHOLD,
  DEFAULT_MAX_PRODUCTS_PER_JOB,
  getCatalogGenerationLimits,
} from "../generation-limits";

describe("catalog generation limits", () => {
  it("uses conservative defaults", () => {
    expect(getCatalogGenerationLimits({})).toEqual({
      maxProductsPerJob: DEFAULT_MAX_PRODUCTS_PER_JOB,
      largeJobThreshold: DEFAULT_LARGE_JOB_THRESHOLD,
    });
  });

  it("accepts environment-specific limits", () => {
    expect(
      getCatalogGenerationLimits({
        CATALOG_MAX_PRODUCTS_PER_JOB: "40",
        CATALOG_LARGE_JOB_THRESHOLD: "10",
      }),
    ).toEqual({ maxProductsPerJob: 40, largeJobThreshold: 10 });
  });

  it("rejects unsafe or inconsistent limits", () => {
    expect(() =>
      getCatalogGenerationLimits({ CATALOG_MAX_PRODUCTS_PER_JOB: "501" }),
    ).toThrow("safety ceiling");
    expect(() =>
      getCatalogGenerationLimits({
        CATALOG_MAX_PRODUCTS_PER_JOB: "10",
        CATALOG_LARGE_JOB_THRESHOLD: "11",
      }),
    ).toThrow("cannot exceed");
    expect(() =>
      getCatalogGenerationLimits({ CATALOG_MAX_PRODUCTS_PER_JOB: "many" }),
    ).toThrow("positive integer");
  });
});
