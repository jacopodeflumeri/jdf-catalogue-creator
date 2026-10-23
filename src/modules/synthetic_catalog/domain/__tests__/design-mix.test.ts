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

  it("assigns exact targets repeatably and does not overlap when disabled", () => {
    const plan = planAssortment({ sequences: Array.from({ length: 20 }, (_, i) => i + 1), config, seed: "same" });
    const first = allocateDesignMix(plan, mix, "same");
    expect(allocateDesignMix(plan, mix, "same")).toEqual(first);
    expect(first.filter((p) => p.design?.patternCode).length).toBe(10);
    expect(first.filter((p) => p.design?.embellishmentCodes.length).length).toBe(5);
    expect(first.filter((p) => p.design?.patternCode && p.design.embellishmentCodes.length).length).toBe(0);
    expect(allocateDesignMix(plan, mix, "different")).not.toEqual(first);
  });

  it("fails when eligible categories cannot meet the requested target", () => {
    const plan = planAssortment({ sequences: [1, 2, 3, 4], scope: { type: "CATEGORY", category: "coats" }, config: { ...config, assortmentPlan: rows }, seed: "coats" });
    expect(() => allocateDesignMix(plan, { ...mix, embellishmentPercentage: 100 }, "coats")).toThrow(/Embellishment target/);
  });
});
