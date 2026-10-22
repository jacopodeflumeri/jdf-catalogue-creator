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
        role: (["FRONT", "BACK", "ON_MODEL"] as const)[index % 3],
        status,
        url: status === "READY" ? `https://example.com/${index}.webp` : null,
        errorMessage: status === "FAILED" ? "Failed" : null,
      })),
    }],
  };
}

describe("getProductImageStatus", () => {
  it("reports ready only when all three expected images are ready", () => {
    expect(getProductImageStatus(productWithImages(["READY", "READY", "READY"]))).toBe("READY");
    expect(getProductImageStatus(productWithImages(["READY", "READY"]))).toBe("MISSING");
  });

  it("prioritizes failures over in-progress images", () => {
    expect(getProductImageStatus(productWithImages(["READY", "GENERATING", "FAILED"]))).toBe(
      "FAILED",
    );
  });

  it("groups queued and generating images as generating", () => {
    expect(getProductImageStatus(productWithImages(["READY", "QUEUED", "READY"]))).toBe(
      "GENERATING",
    );
  });

  it("reports missing when there is no style", () => {
    expect(getProductImageStatus({ styles: [] })).toBe("MISSING");
  });

  it("requires readiness across every style and shows sibling failures", () => {
    const ready = productWithImages(["READY", "READY", "READY"]).styles[0]!;
    expect(getProductImageStatus({ styles: [ready, { ...ready, id: 2, images: ready.images.map((image) => ({ ...image, status: "QUEUED" as const })) }] })).toBe("GENERATING");
    expect(getProductImageStatus({ styles: [ready, { ...ready, id: 2, images: ready.images.map((image) => ({ ...image, status: "FAILED" as const })) }] })).toBe("FAILED");
  });
});
