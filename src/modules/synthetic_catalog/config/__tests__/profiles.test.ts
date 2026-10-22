import { CATALOG_PROFILES, parseCatalogProfileConfig } from "../profiles";

describe("catalog profile configuration", () => {
  it("defines exactly the four required profiles", () => {
    expect(CATALOG_PROFILES.map((profile) => profile.slug)).toEqual([
      "premium-apparel",
      "fast-fashion",
      "luxury-fashion",
      "activewear",
    ]);
  });

  it("uses unique stable three-letter prefixes", () => {
    const prefixes = CATALOG_PROFILES.map((profile) => profile.externalPrefix);
    expect(new Set(prefixes).size).toBe(CATALOG_PROFILES.length);
    expect(prefixes).toEqual(["PRE", "FAS", "LUX", "ACT"]);
    expect(prefixes.every((prefix) => /^[A-Z]{3}$/.test(prefix))).toBe(true);
  });

  it("has complete generation defaults for every profile", () => {
    for (const profile of CATALOG_PROFILES) {
      expect(profile.config.categories.length).toBeGreaterThan(0);
      expect(profile.config.colors.length).toBeGreaterThan(0);
      expect(profile.defaultTextModel).toMatch(/^openai\//);
      expect(profile.defaultImageModel).toMatch(/^openai\//);
    }
  });

  it("normalizes legacy department weights while preserving Women and Men IDs", () => {
    const legacy = JSON.parse(JSON.stringify(CATALOG_PROFILES[0].config)) as Record<string, unknown>;
    legacy.departmentWeights = { women: 0.58, men: 0.42 };
    delete legacy.departments;
    expect(parseCatalogProfileConfig(legacy).departments).toEqual([
      { key: "WOMEN", label: "Women", code: "W", generationWeight: 0.58 },
      { key: "MEN", label: "Men", code: "M", generationWeight: 0.42 },
    ]);
  });

  it("accepts pre-mix configs and validates canonical mix rows", () => {
    const legacy = JSON.parse(JSON.stringify(CATALOG_PROFILES[0].config)) as Record<string, unknown>;
    delete legacy.assortmentPlan;
    expect(parseCatalogProfileConfig(legacy).assortmentPlan).toEqual([]);

    const duplicate = JSON.parse(JSON.stringify(CATALOG_PROFILES[0].config)) as Record<string, unknown>;
    duplicate.assortmentPlan = [...CATALOG_PROFILES[0].config.assortmentPlan, CATALOG_PROFILES[0].config.assortmentPlan[0]];
    expect(() => parseCatalogProfileConfig(duplicate)).toThrow("must be unique");

    const invalidDepartment = JSON.parse(JSON.stringify(CATALOG_PROFILES[0].config)) as Record<string, unknown>;
    invalidDepartment.assortmentPlan = [{ departmentKey: "UNKNOWN", category: "coats", subcategory: "wool coats", productCount: 2 }];
    expect(() => parseCatalogProfileConfig(invalidDepartment)).toThrow("not configured");
  });
});
