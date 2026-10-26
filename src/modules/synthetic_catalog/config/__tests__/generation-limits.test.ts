import {
  DEFAULT_LARGE_JOB_THRESHOLD,
  getCatalogGenerationSettings,
} from "../generation-limits";

describe("catalog generation settings", () => {
  it("uses a warning threshold of 25 by default", () => {
    expect(getCatalogGenerationSettings({})).toEqual({ largeJobThreshold: DEFAULT_LARGE_JOB_THRESHOLD });
  });

  it("accepts a warning threshold independently of any product maximum", () => {
    expect(getCatalogGenerationSettings({ CATALOG_LARGE_JOB_THRESHOLD: "10000" }))
      .toEqual({ largeJobThreshold: 10000 });
  });

  it("ignores the obsolete product maximum setting", () => {
    expect(getCatalogGenerationSettings({ CATALOG_MAX_PRODUCTS_PER_JOB: "100" } as never))
      .toEqual({ largeJobThreshold: DEFAULT_LARGE_JOB_THRESHOLD });
  });

  it("rejects invalid warning thresholds", () => {
    expect(() => getCatalogGenerationSettings({ CATALOG_LARGE_JOB_THRESHOLD: "many" }))
      .toThrow("positive safe integer");
    expect(() => getCatalogGenerationSettings({ CATALOG_LARGE_JOB_THRESHOLD: "0" }))
      .toThrow("positive safe integer");
  });
});
