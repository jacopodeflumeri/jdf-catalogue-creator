import {
  formatProductId,
  formatSku,
  formatStyleId,
  formatVariantId,
  normalizeCatalogCode,
  productSequenceRange,
} from "../ids";

describe("synthetic catalog identifiers", () => {
  it("builds the complete product/style/variant hierarchy", () => {
    const productId = formatProductId({
      catalogPrefix: "PRE",
      department: "W",
      sequence: 42,
    });
    const styleId = formatStyleId(productId, "Midnight Navy");
    const variantId = formatVariantId(styleId, "One Size");

    expect(productId).toBe("PRE-W-000042");
    expect(styleId).toBe("PRE-W-000042-MIDNIGHT_NAVY");
    expect(variantId).toBe("PRE-W-000042-MIDNIGHT_NAVY-ONE_SIZE");
    expect(formatSku(styleId, "One Size")).toBe(variantId);
  });

  it("supports configured custom department codes without changing legacy Women IDs", () => {
    expect(formatProductId({ catalogPrefix: "PRE", department: "KID7", sequence: 7 })).toBe("PRE-KID7-000007");
    expect(formatProductId({ catalogPrefix: "PRE", department: "W", sequence: 7 })).toBe("PRE-W-000007");
    expect(() => formatProductId({ catalogPrefix: "PRE", department: "TOO_LONG", sequence: 7 })).toThrow("1 to 6");
  });

  it("normalizes controlled catalog codes deterministically", () => {
    expect(normalizeCatalogCode("  blue / green  ", "Color")).toBe("BLUE_GREEN");
  });

  it("rejects invalid product ID inputs", () => {
    expect(() =>
      formatProductId({ catalogPrefix: "PREMIUM", department: "W", sequence: 1 }),
    ).toThrow("exactly three");
    expect(() =>
      formatProductId({ catalogPrefix: "PRE", department: "M", sequence: 0 }),
    ).toThrow("positive safe integer");
  });

  it("creates bounded contiguous reservation ranges", () => {
    expect(productSequenceRange(7, 4)).toEqual([7, 8, 9, 10]);
    expect(() => productSequenceRange(1, 0)).toThrow("between 1 and 1000");
  });
});
