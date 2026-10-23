import { getProductImageStatus } from "../product-image-status";
import type { CatalogProductView } from "../types";

function productWithImages(
  statuses: Array<"QUEUED" | "GENERATING" | "READY" | "FAILED">,
): Pick<CatalogProductView, "styles"> {
  return {
    styles: statuses.length === 0 ? [] : [{
      id: 1,
      externalId: "STYLE-1",
      colorName: "Black",
      colorCode: "BLACK",
      colorHex: "#000000",
      status: "READY",
      variants: [],
      images: statuses.map((status, index) => ({
        id: index + 1,
        publicId: `image-${index + 1}`,
        role: (["FRONT", "BACK"] as const)[index % 2],
        status,
        url: status === "READY" ? `https://example.com/${index}.webp` : null,
        errorMessage: status === "FAILED" ? "Failed" : null,
      })),
    }],
  };
}

describe("getProductImageStatus", () => {
  it("reports ready only when both expected images are ready", () => {
    expect(getProductImageStatus(productWithImages(["READY", "READY"]))).toBe("READY");
    expect(getProductImageStatus(productWithImages(["READY"]))).toBe("MISSING");
  });

  it("prioritizes failures over in-progress images", () => {
    expect(getProductImageStatus(productWithImages(["GENERATING", "FAILED"]))).toBe(
      "FAILED",
    );
  });

  it("groups queued and generating images as generating", () => {
    expect(getProductImageStatus(productWithImages(["READY", "QUEUED"]))).toBe(
      "GENERATING",
    );
  });

  it("reports missing when there is no style", () => {
    expect(getProductImageStatus({ styles: [] })).toBe("MISSING");
  });

  it("requires readiness across every style and shows sibling failures", () => {
    const ready = productWithImages(["READY", "READY"]).styles[0]!;
    expect(getProductImageStatus({ styles: [ready, { ...ready, id: 2, images: ready.images.map((image) => ({ ...image, status: "QUEUED" as const })) }] })).toBe("GENERATING");
    expect(getProductImageStatus({ styles: [ready, { ...ready, id: 2, images: ready.images.map((image) => ({ ...image, status: "FAILED" as const })) }] })).toBe("FAILED");
  });

  it("ignores failures on optional image roles when calculating core-image readiness", () => {
    const ready = productWithImages(["READY", "READY"]).styles[0]!;
    const optional = [
      { id: 3, publicId: "legacy", role: "ON_MODEL" as const, status: "FAILED" as const, url: null, errorMessage: "Legacy image failed" },
      { id: 4, publicId: "optional", role: "COMPLETE_LOOK" as const, status: "FAILED" as const, url: null, errorMessage: "Optional image failed" },
    ];
    expect(getProductImageStatus({ styles: [{ ...ready, images: [...ready.images, ...optional] }] })).toBe("READY");
  });
});
