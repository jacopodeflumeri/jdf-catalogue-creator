import type { CatalogProductView } from "./types";

export type ProductImageStatus = "READY" | "FAILED" | "GENERATING" | "MISSING";

export function getProductImageStatus(
  product: Pick<CatalogProductView, "style">,
): ProductImageStatus {
  const images = product.style?.images ?? [];

  if (images.some((image) => image.status === "FAILED")) return "FAILED";
  if (images.some((image) => image.status === "QUEUED" || image.status === "GENERATING")) {
    return "GENERATING";
  }
  if (images.length >= 3 && images.every((image) => image.status === "READY")) return "READY";

  return "MISSING";
}
