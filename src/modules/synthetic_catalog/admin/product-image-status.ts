import type { CatalogProductView } from "./types";
import { REQUIRED_CORE_IMAGE_ROLES } from "../providers/image-generator";

export type ProductImageStatus = "READY" | "FAILED" | "GENERATING" | "MISSING";

export function getProductImageStatus(
  product: Pick<CatalogProductView, "styles">,
): ProductImageStatus {
  const images = product.styles.flatMap((style) => style.images);

  const coreImages = images.filter((image) => (REQUIRED_CORE_IMAGE_ROLES as readonly string[]).includes(image.role));
  if (coreImages.some((image) => image.status === "FAILED")) return "FAILED";
  if (coreImages.some((image) => image.status === "QUEUED" || image.status === "GENERATING")) {
    return "GENERATING";
  }
  if (product.styles.length > 0 && product.styles.every((style) => REQUIRED_CORE_IMAGE_ROLES.every((role) => style.images.some((image) => image.role === role && image.status === "READY")))) return "READY";

  return "MISSING";
}
