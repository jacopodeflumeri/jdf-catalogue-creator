import { planOutfits, scoreColorPair, type OutfitStyle } from "../outfit-planner";

const style = (id: number, productId: number, outfitSlot: OutfitStyle["outfitSlot"], department = "WOMEN", season = "Core", colorHex = "#111111"): OutfitStyle => ({ id, productId, externalId: `S-${id}`, outfitSlot, department, season, colorHex });

describe("deterministic Complete the Look planner", () => {
  it("uses TOP/BOTTOM recipes, excludes the same product, and is deterministic", () => {
    const catalog = [style(1, 10, "TOP"), style(2, 10, "BOTTOM"), style(3, 11, "BOTTOM"), style(4, 12, "TOP")];
    const first = planOutfits(catalog);
    const again = planOutfits(catalog);
    expect(first).toEqual(again);
    const top = first.find((item) => item.anchor.id === 1)!;
    expect(top.status).toBe("PLANNED");
    expect(top.items.map((item) => item.outfitSlot)).toContain("BOTTOM");
    expect(top.items.every((item) => item.style.productId !== top.anchor.productId)).toBe(true);
  });

  it("rejects cross-department and incompatible seasons and persists a skip reason", () => {
    const plans = planOutfits([
      style(1, 1, "TOP", "WOMEN", "Winter"),
      style(2, 2, "BOTTOM", "MEN", "Winter"),
      style(3, 3, "BOTTOM", "WOMEN", "Summer"),
    ]);
    const top = plans.find((item) => item.anchor.id === 1)!;
    expect(top.status).toBe("SKIPPED");
    expect(top.reason).toMatch(/No eligible companions/);
  });

  it("supports one-piece recipes with accessories and gives neutrals broad colour compatibility", () => {
    const plans = planOutfits([style(1, 1, "ONE_PIECE", "WOMEN", "Core", "#D02050"), style(2, 2, "ACCESSORY", "WOMEN", "Winter", "#222222")]);
    const dress = plans.find((item) => item.anchor.id === 1)!;
    expect(dress.status).toBe("PLANNED");
    expect(dress.items).toHaveLength(1);
    expect(scoreColorPair("#D02050", "#222222")).toBeGreaterThan(0);
  });

  it("uses the outerwear recipe of top plus bottom and balances companion reuse", () => {
    const catalog = [
      style(1, 1, "OUTERWEAR"),
      style(2, 2, "TOP"),
      style(3, 3, "BOTTOM"),
      style(4, 4, "BOTTOM"),
    ];
    const plan = planOutfits(catalog, new Map([[3, 20]])).find((item) => item.anchor.id === 1)!;
    expect(plan.status).toBe("PLANNED");
    expect(plan.items.map((item) => item.outfitSlot)).toEqual(expect.arrayContaining(["TOP", "BOTTOM"]));
    expect(plan.items.find((item) => item.outfitSlot === "BOTTOM")?.style.id).toBe(4);
  });

  it("allows at most one saturated colour in an outfit", () => {
    const catalog = [
      style(1, 1, "TOP", "WOMEN", "Core", "#D02050"),
      style(2, 2, "BOTTOM", "WOMEN", "Core", "#2080D0"),
      style(3, 3, "BOTTOM", "WOMEN", "Core", "#222222"),
    ];
    const plan = planOutfits(catalog).find((item) => item.anchor.id === 1)!;
    expect(plan.status).toBe("PLANNED");
    expect(plan.items.map((item) => item.style.id)).toContain(3);
    expect(plan.items.map((item) => item.style.id)).not.toContain(2);
  });
});
