import { CATALOG_PROFILES, parseCatalogProfileConfig } from "../profiles";

describe("catalogue mix outfit slots", () => {
  it("has explicit sensible slots on all built-in mix rows", () => {
    for (const profile of CATALOG_PROFILES) {
      const parsed = parseCatalogProfileConfig(profile.config);
      expect(parsed.assortmentPlan.every((row) => Boolean(row.outfitSlot))).toBe(true);
    }
    expect(parseCatalogProfileConfig(CATALOG_PROFILES[0]!.config).assortmentPlan.map((row) => row.outfitSlot)).toEqual(["ONE_PIECE", "OUTERWEAR", "TOP", "BOTTOM"]);
  });

  it("normalizes known legacy rows and requires a slot for custom rows", () => {
    const profile = CATALOG_PROFILES[0]!.config;
    const legacy = { ...profile, assortmentPlan: [{ departmentKey: "WOMEN", category: "dresses", subcategory: "midi dresses", productCount: 1 }] };
    expect(parseCatalogProfileConfig(legacy).assortmentPlan[0]?.outfitSlot).toBe("ONE_PIECE");
    const custom = { ...profile, categories: [...profile.categories, "ceremonial objects"], subcategories: { ...profile.subcategories, "ceremonial objects": ["object"] }, assortmentPlan: [{ departmentKey: "WOMEN", category: "ceremonial objects", subcategory: "object", productCount: 1 }] };
    expect(() => parseCatalogProfileConfig(custom)).toThrow(/Choose an outfit slot/);
  });
});
