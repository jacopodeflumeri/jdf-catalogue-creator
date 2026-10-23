import { CATALOG_PROFILES, parseCatalogProfileConfig } from "../profiles";

describe("catalog profile configuration", () => {
  it("defaults legacy catalogues to a safe zero design mix", () => {
    const legacy = { ...CATALOG_PROFILES[0]!.config } as Record<string, unknown>;
    delete legacy.designMix;
    const parsed = parseCatalogProfileConfig(legacy);
    expect(parsed.designMix.patternPercentage).toBe(0);
    expect(parsed.designMix.embellishmentPercentage).toBe(0);
    expect(parsed.designMix.patterns.map((item) => item.code)).toContain("STRIPED");
  });

  it("rejects configurations that require overlap when combined designs are disabled", () => {
    const config = CATALOG_PROFILES[0]!.config;
    expect(() => parseCatalogProfileConfig({ ...config, designMix: { patternPercentage: 60, embellishmentPercentage: 50, allowCombined: false, maxCombinedPercentage: 0, patterns: [{ code: "STRIPED", label: "Striped" }], embellishments: [{ code: "EMBROIDERY", label: "Embroidery" }], rules: [] } })).toThrow(/require overlap/);
  });

  it("reserves SOLID for the null pattern value", () => {
    const config = CATALOG_PROFILES[0]!.config;
    expect(() => parseCatalogProfileConfig({ ...config, designMix: { ...parseCatalogProfileConfig(config).designMix, patterns: [{ code: "SOLID", label: "Solid" }] } })).toThrow(/SOLID must be represented by no pattern/);
  });
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
      const parsed = parseCatalogProfileConfig(profile.config);
      expect(parsed.assortmentPlan.length).toBeGreaterThan(0);
      expect(parsed.assortmentPlan.every((row) => Boolean(row.id))).toBe(true);
      expect(parsed).not.toHaveProperty("categories");
      expect(parsed).not.toHaveProperty("subcategories");
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

  it("folds legacy taxonomy-only combinations into unassigned mix rows", () => {
    const legacy = JSON.parse(JSON.stringify(CATALOG_PROFILES[0].config)) as Record<string, unknown>;
    delete legacy.assortmentPlan;
    legacy.categories = ["coats", "knitwear", "shirts", "trousers", "dresses"];
    legacy.subcategories = {
      coats: ["wool coats", "trench coats"],
      knitwear: ["cardigans", "crew necks"],
      shirts: ["poplin shirts", "silk shirts"],
      trousers: ["tailored trousers", "wide-leg trousers"],
      dresses: ["midi dresses", "shirt dresses"],
    };
    const folded = parseCatalogProfileConfig(legacy);
    expect(folded.assortmentPlan.every((row) => row.departmentKey === null && row.productCount === 0 && row.outfitSlot === null)).toBe(true);
    expect(folded.assortmentPlan).toHaveLength(10);
    expect(folded).not.toHaveProperty("categories");
    expect(folded).not.toHaveProperty("subcategories");
  });

  it("validates canonical mix rows and requires generation settings on assigned rows", () => {
    const legacy = JSON.parse(JSON.stringify(CATALOG_PROFILES[0].config)) as Record<string, unknown>;

    const duplicate = JSON.parse(JSON.stringify(legacy)) as Record<string, unknown>;
    duplicate.assortmentPlan = [...CATALOG_PROFILES[0].config.assortmentPlan, CATALOG_PROFILES[0].config.assortmentPlan[0]];
    expect(() => parseCatalogProfileConfig(duplicate)).toThrow("must be unique");

    const invalidDepartment = JSON.parse(JSON.stringify(legacy)) as Record<string, unknown>;
    invalidDepartment.assortmentPlan = [{ departmentKey: "UNKNOWN", category: "coats", subcategory: "wool coats", productCount: 2 }];
    expect(() => parseCatalogProfileConfig(invalidDepartment)).toThrow("not configured");

    const invalidUnassigned = JSON.parse(JSON.stringify(legacy)) as Record<string, unknown>;
    invalidUnassigned.assortmentPlan = [{ departmentKey: null, category: "coats", subcategory: "wool coats", productCount: 1, outfitSlot: null }];
    expect(() => parseCatalogProfileConfig(invalidUnassigned)).toThrow("zero products");
  });
});
