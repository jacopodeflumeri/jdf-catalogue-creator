import { CATALOG_PROFILES } from "../../config/profiles";
import { planAssortment } from "../planner";
import { generateInventory, generatePrice, sizesForCategory } from "../rules";

const config = CATALOG_PROFILES[0].config;

describe("assortment planner", () => {
  it("honors every exact ALL catalogue-mix quota deterministically", () => {
    const input = {
      sequences: Array.from({ length: config.assortmentPlan.reduce((sum, row) => sum + row.productCount, 0) }, (_, index) => index + 1),
      scope: { type: "ALL" as const },
      config,
      seed: "premium:first-five",
    };
    const first = planAssortment(input);
    const second = planAssortment(input);

    expect(second).toEqual(first);
    expect(first).toHaveLength(20);
    expect(new Set(first.map((item) => item.sequence)).size).toBe(20);
    for (const row of config.assortmentPlan) {
      expect(first.filter((item) => item.department === row.departmentKey && item.category === row.category && item.subcategory === row.subcategory)).toHaveLength(row.productCount);
    }
  });

  it("allocates department requests only across matching mix rows", () => {
    const plan = planAssortment({
      sequences: [10, 11, 12],
      scope: { type: "DEPARTMENT", departmentKey: "MEN" },
      config,
      seed: "men-only",
    });
    expect(plan.every((item) => item.department === "MEN")).toBe(true);
    expect(plan.every((item) => item.category !== "dresses")).toBe(true);
  });

  it("distributes smaller department requests by mix weights deterministically", () => {
    const input = { sequences: [10, 11, 12, 13, 14], scope: { type: "DEPARTMENT" as const, departmentKey: "MEN" }, config, seed: "scope-department" };
    const planned = planAssortment(input);
    expect(planned.every((item) => item.department === "MEN")).toBe(true);
    expect(planAssortment(input)).toEqual(planned);
    expect(planned.every((item) => config.assortmentPlan.some((row) => row.departmentKey === item.department && row.category === item.category && row.subcategory === item.subcategory))).toBe(true);
  });

  it("creates exactly the requested products in a selected category", () => {
    const input = { sequences: [20, 21, 22, 23], scope: { type: "CATEGORY" as const, category: "coats" }, config, seed: "scope-category" };
    const planned = planAssortment(input);
    expect(planned).toHaveLength(4);
    expect(planned.every((item) => item.category === "coats" && item.subcategory === "wool coats" && item.department === "WOMEN")).toBe(true);
    expect(planAssortment(input)).toEqual(planned);
  });

  it("uses weighted largest remainders for small scoped jobs", () => {
    const weightedConfig = {
      ...config,
      departments: [
        { key: "WOMEN", label: "Women", code: "W", generationWeight: 0.05 },
        { key: "MEN", label: "Men", code: "M", generationWeight: 0.05 },
        { key: "KIDS", label: "Kids", code: "K", generationWeight: 0.9 },
      ],
      assortmentPlan: [
        { departmentKey: "WOMEN", category: "coats", subcategory: "wool coats", productCount: 1 },
        { departmentKey: "MEN", category: "coats", subcategory: "wool coats", productCount: 1 },
        { departmentKey: "KIDS", category: "coats", subcategory: "wool coats", productCount: 18 },
      ],
    };
    const planned = planAssortment({ sequences: [1], scope: { type: "CATEGORY", category: "coats" }, config: weightedConfig, seed: "one-product" });
    expect(planned[0]!.department).toBe("KIDS");
  });

  it("rejects missing scope rows and noncanonical ALL counts", () => {
    expect(() => planAssortment({ sequences: [1], scope: { type: "CATEGORY", category: "sports bras" }, config, seed: "missing" })).toThrow("No catalogue mix rows");
    expect(() => planAssortment({ sequences: [1], scope: { type: "ALL" }, config, seed: "short-all" })).toThrow("requires exactly 20");
  });

  it("rejects empty and duplicate sequence requests", () => {
    expect(() =>
      planAssortment({ sequences: [], departmentMode: "AUTO", config, seed: "empty" }),
    ).toThrow("at least one");
    expect(() =>
      planAssortment({
        sequences: [1, 1],
        departmentMode: "AUTO",
        config,
        seed: "duplicate",
      }),
    ).toThrow("unique");
  });
});

describe("deterministic merchandising rules", () => {
  it("keeps prices within range and sale prices below regular prices", () => {
    const alwaysSale = { ...config, saleProbability: 1 };
    const price = generatePrice(alwaysSale, "sale-product");

    expect(Number(price.basePrice)).toBeGreaterThanOrEqual(config.priceRangeEur.min);
    expect(Number(price.basePrice)).toBeLessThanOrEqual(config.priceRangeEur.max);
    expect(price.salePrice).not.toBeNull();
    expect(Number(price.salePrice)).toBeLessThan(Number(price.basePrice));
    expect(price.currency).toBe("EUR");
    expect(generatePrice(alwaysSale, "sale-product")).toEqual(price);
  });

  it("supports deterministic no-sale and zero-stock boundaries", () => {
    const boundaryConfig = {
      ...config,
      saleProbability: 0,
      stockRange: { min: 0, max: 0 },
    };
    expect(generatePrice(boundaryConfig, "no-sale").salePrice).toBeNull();
    expect(generateInventory(boundaryConfig, "coats", "empty-stock")).toEqual(
      config.sizes.map((size) => ({ size, stock: 0, availability: "OUT_OF_STOCK" })),
    );
  });

  it("uses one-size variants only for accessory categories", () => {
    expect(sizesForCategory(config, "accessories")).toEqual(["ONE_SIZE"]);
    expect(sizesForCategory(config, "leather goods")).toEqual(["ONE_SIZE"]);
    expect(sizesForCategory(config, "coats")).toEqual(config.sizes);
  });
});
