import { CATALOG_PROFILES } from "../../config/profiles";
import { planAssortment } from "../planner";
import { generateInventory, generatePrice, sizesForCategory } from "../rules";

const config = CATALOG_PROFILES[0].config;

describe("assortment planner", () => {
  it("is deterministic and distributes every requested slot", () => {
    const input = {
      sequences: [1, 2, 3, 4, 5],
      departmentMode: "AUTO" as const,
      config,
      seed: "premium:first-five",
    };
    const first = planAssortment(input);
    const second = planAssortment(input);

    expect(second).toEqual(first);
    expect(first).toHaveLength(5);
    expect(first.filter((item) => item.department === "WOMEN")).toHaveLength(3);
    expect(new Set(first.map((item) => item.sequence)).size).toBe(5);
    for (const item of first) {
      expect(config.categories).toContain(item.category);
      expect(config.subcategories[item.category]).toContain(item.subcategory);
    }
  });

  it("honors an explicit department override", () => {
    const plan = planAssortment({
      sequences: [10, 11, 12],
      departmentMode: "MEN",
      config,
      seed: "men-only",
    });
    expect(plan.every((item) => item.department === "MEN")).toBe(true);
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
