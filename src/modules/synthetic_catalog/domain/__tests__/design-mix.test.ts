import { allocateDesignMix, planAssortment, roundDesignTarget } from "../planner";
import { parseCatalogProfileConfig, CATALOG_PROFILES } from "../../config/profiles";

const config = parseCatalogProfileConfig(CATALOG_PROFILES[0]!.config);
const rows = config.assortmentPlan.filter((row) => row.departmentKey != null && row.productCount > 0);
const mix = {
  ...config.designMix,
  patternPercentage: 50,
  embellishmentPercentage: 25,
  allowCombined: false,
  maxCombinedPercentage: 0,
};

describe("deterministic design mix allocation", () => {
  it("keeps the complete ordinary vocabulary and treats logo repeat as one balanced optional code", () => {
    const expected = ["STRIPED", "CHECKED", "FLORAL", "GEOMETRIC", "ABSTRACT", "ANIMAL", "POLKA_DOT", "COLOR_BLOCKED", "BRAND_LOGO_REPEAT"];
    expect(config.designMix.patterns.map((item) => item.code)).toEqual(expected);
    const plan = planAssortment({ sequences: Array.from({ length: 20 }, (_, i) => i + 1), config, seed: "vocabulary" });
    const planned = allocateDesignMix(plan, { ...config.designMix, patternPercentage: 100, embellishmentPercentage: 0 }, "vocabulary");
    const counts = new Map<string, number>();
    for (const product of planned) counts.set(product.design!.patternCode!, (counts.get(product.design!.patternCode!) ?? 0) + 1);
    expect(counts.get("BRAND_LOGO_REPEAT")).toBeGreaterThan(0);
    expect(Math.max(...counts.values()) - Math.min(...counts.values())).toBeLessThanOrEqual(1);
    expect(allocateDesignMix(plan, { ...config.designMix, patternPercentage: 100, embellishmentPercentage: 0 }, "vocabulary")).toEqual(planned);
  });

  it("honors row-level inclusion and exclusion of the logo pattern", () => {
    const plan = planAssortment({ sequences: Array.from({ length: 20 }, (_, i) => i + 1), config, seed: "rules" });
    const rules = rows.map((row, index) => ({ catalogMixRowId: row.id, allowedPatternCodes: index === 0 ? ["BRAND_LOGO_REPEAT", "STRIPED"] : ["STRIPED"], allowedEmbellishmentCodes: [] }));
    const planned = allocateDesignMix(plan, { ...config.designMix, rules, patternPercentage: 100, embellishmentPercentage: 0 }, "rules");
    expect(planned.some((p) => p.design?.patternCode === "BRAND_LOGO_REPEAT")).toBe(true);
    expect(planned.filter((p) => p.design?.patternCode === "BRAND_LOGO_REPEAT").every((p) => p.mixRowId === rows[0]!.id)).toBe(true);
  });

  it("uses half-up integer rounding", () => {
    expect(roundDesignTarget(5, 50)).toBe(3);
    expect(roundDesignTarget(5, 49)).toBe(2);
  });

  it("keeps legacy zero targets plain and limits the forced overlap to its configured cap", () => {
    const plan = planAssortment({ sequences: Array.from({ length: 10 }, (_, i) => i + 1), scope: { type: "DEPARTMENT", departmentKey: "WOMEN" }, config, seed: "overlap" });
    const zero = { ...config.designMix, patternPercentage: 0, embellishmentPercentage: 0, allowCombined: false, maxCombinedPercentage: 0 };
    expect(allocateDesignMix(plan, zero, "zero").every((item) => item.design?.patternCode == null && item.design.embellishmentCodes.length === 0)).toBe(true);
    const both = allocateDesignMix(plan, { ...mix, patternPercentage: 60, embellishmentPercentage: 60, allowCombined: true, maxCombinedPercentage: 20 }, "both");
    expect(both.filter((item) => item.design?.patternCode).length).toBe(6);
    expect(both.filter((item) => item.design?.embellishmentCodes.length).length).toBe(6);
    expect(both.filter((item) => item.design?.patternCode && item.design.embellishmentCodes.length).length).toBe(2);
  });

  it("assigns exact targets repeatably and does not overlap when disabled", () => {
    const plan = planAssortment({ sequences: Array.from({ length: 20 }, (_, i) => i + 1), config, seed: "same" });
    const first = allocateDesignMix(plan, mix, "same");
    expect(allocateDesignMix(plan, mix, "same")).toEqual(first);
    expect(first.filter((p) => p.design?.patternCode).length).toBe(10);
    expect(first.filter((p) => p.design?.embellishmentCodes.length).length).toBe(5);
    expect(first.filter((p) => p.design?.patternCode && p.design.embellishmentCodes.length).length).toBe(0);
    expect(allocateDesignMix(plan, mix, "different")).not.toEqual(first);
  });

  it("keeps Design Mix targets exact and deterministic for a large plan", () => {
    const plan = planAssortment({ sequences: Array.from({ length: 1_500 }, (_, i) => i + 1), scope: { type: "DEPARTMENT", departmentKey: "WOMEN" }, config, seed: "large-design-mix" });
    const planned = allocateDesignMix(plan, mix, "large-design-mix");
    expect(planned).toHaveLength(1_500);
    expect(planned.filter((item) => item.design?.patternCode != null)).toHaveLength(750);
    expect(planned.filter((item) => item.design?.embellishmentCodes.length)).toHaveLength(375);
    expect(planned.filter((item) => item.design?.patternCode && item.design.embellishmentCodes.length)).toHaveLength(0);
    expect(allocateDesignMix(plan, mix, "large-design-mix")).toEqual(planned);
  });

  it("spreads full patterned quotas across the planned mix rows", () => {
    const plan = planAssortment({ sequences: Array.from({ length: 20 }, (_, i) => i + 1), config, seed: "rows" });
    const planned = allocateDesignMix(plan, { ...mix, patternPercentage: 100, embellishmentPercentage: 0 }, "rows");
    const perRow = new Map<string, number>();
    for (const product of planned) if (product.design?.patternCode) perRow.set(product.mixRowId ?? "", (perRow.get(product.mixRowId ?? "") ?? 0) + 1);
    expect([...perRow.values()]).toEqual([5, 5, 5, 5]);
  });

  it("fails when eligible categories cannot meet the requested target", () => {
    const plan = planAssortment({ sequences: [1, 2, 3, 4], scope: { type: "CATEGORY", category: "coats" }, config: { ...config, assortmentPlan: rows }, seed: "coats" }).map((product) => ({ ...product, category: "bags" }));
    expect(() => allocateDesignMix(plan, { ...mix, patternPercentage: 0, embellishmentPercentage: 100 }, "coats")).toThrow(/Embellishment target/);
  });

  it("reserves scarce embellishment-compatible products in a 66-product scoped job", () => {
    const products = Array.from({ length: 66 }, (_, index) => ({
      sequence: index + 1,
      seed: `women-66:${index + 1}`,
      department: "WOMEN",
      category: index < 20 ? "pattern only" : index < 30 ? "shared design" : "plain",
      subcategory: "test",
      mixRowId: index < 20 ? "pattern-row" : index < 30 ? "shared-row" : "plain-row",
    }));
    const configuredMix = {
      patternPercentage: 30,
      embellishmentPercentage: 15,
      allowCombined: true,
      maxCombinedPercentage: 5,
      patterns: [{ code: "STRIPED", label: "Striped" }],
      embellishments: [{ code: "EMBROIDERY", label: "Embroidery" }],
      rules: [
        { catalogMixRowId: "pattern-row", allowedPatternCodes: ["STRIPED"], allowedEmbellishmentCodes: [] },
        { catalogMixRowId: "shared-row", allowedPatternCodes: ["STRIPED"], allowedEmbellishmentCodes: ["EMBROIDERY"] },
        { catalogMixRowId: "plain-row", allowedPatternCodes: [], allowedEmbellishmentCodes: [] },
      ],
    };

    const planned = allocateDesignMix(products, configuredMix, "women-66");

    expect(planned.filter((product) => product.design?.patternCode != null)).toHaveLength(20);
    expect(planned.filter((product) => product.design?.embellishmentCodes.length)).toHaveLength(10);
    expect(planned.filter((product) => product.design?.patternCode && product.design.embellishmentCodes.length)).toHaveLength(0);
    expect(planned.filter((product) => product.design?.patternCode).every((product) => product.mixRowId === "pattern-row")).toBe(true);
    expect(planned.filter((product) => product.design?.embellishmentCodes.length).every((product) => product.mixRowId === "shared-row")).toBe(true);
  });
});
