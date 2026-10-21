import { CATALOG_PROFILES } from "../profiles";

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
});
