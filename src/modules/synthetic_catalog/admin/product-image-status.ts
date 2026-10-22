import type { CatalogProductView } from "./types";

export type ProductImageStatus = "READY" | "FAILED" | "GENERATING" | "MISSING";

export function getProductImageStatus(
  product: Pick<CatalogProductView, "styles">,
): ProductImageStatus {
  const images = product.styles.flatMap((style) => style.images);

  if (images.some((image) => image.status === "FAILED")) return "FAILED";
  if (images.some((image) => image.status === "QUEUED" || image.status === "GENERATING")) {
    return "GENERATING";
  }
  if (product.styles.length > 0 && product.styles.every((style) => style.images.length === 3 && style.images.every((image) => image.status === "READY"))) return "READY";

  return "MISSING";
}
