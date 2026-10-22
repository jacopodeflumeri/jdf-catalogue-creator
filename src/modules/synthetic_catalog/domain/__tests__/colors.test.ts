import { CATALOG_PROFILES } from "../../config/profiles";
import { estimateGenerationOutput, selectStyleColors } from "../colors";

const palette = CATALOG_PROFILES[0].config.colors;

describe("multi-color generation rules", () => {
  it.each([2, 3] as const)("selects %i distinct colors deterministically with primary first", (count) => {
    const first = selectStyleColors({ palette, primaryColorCode: palette[0]!.code, count, seed: "same-product" });
    expect(selectStyleColors({ palette, primaryColorCode: palette[0]!.code, count, seed: "same-product" })).toEqual(first);
    expect(first).toHaveLength(count);
    expect(first[0]).toEqual(palette[0]);
    expect(new Set(first.map((color) => color.code)).size).toBe(count);
  });

  it("rejects an insufficient palette and calculates the full output/call estimate", () => {
    expect(() => selectStyleColors({ palette: palette.slice(0, 1), primaryColorCode: palette[0]!.code, count: 2, seed: "x" })).toThrow("fewer colors");
    expect(estimateGenerationOutput({ products: 10, colorVariantCount: 3, sizeCount: 5 })).toEqual({
      products: 10, styles: 30, images: 90, sizeRows: 150, tasks: 100, liteLlmCalls: 100,
    });
  });
});
