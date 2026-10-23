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
});
