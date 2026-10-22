import type { CatalogImageRoleValue } from "./image-generator";

export interface CatalogImagePromptInput {
  role: CatalogImageRoleValue;
  catalog: {
    segment: string;
    brandName: string;
    visualDirection: string;
  };
  product: {
    name: string;
    department: string;
    category: string;
    subcategory: string;
    material: string;
    season: string;
  };
  style: {
    externalId: string;
    colorName: string;
    colorCode: string;
    visualSpec: unknown;
  };
  hasFrontReference: boolean;
}

const ROLE_DIRECTION: Record<CatalogImageRoleValue, string[]> = {
  FRONT: [
    "Show the complete garment alone from the front, centered and fully inside the frame.",
    "Use a neutral seamless studio background and even catalog lighting.",
    "No person, mannequin, hanger, hand, packaging, or obscuring prop.",
  ],
  BACK: [
    "Show the complete garment alone from the back, centered and fully inside the frame.",
    "Match the exact construction, color, material, scale, lighting, and neutral background of the front product image.",
    "No person, mannequin, hanger, hand, packaging, or obscuring prop.",
  ],
  ON_MODEL: [
    "Show one adult fashion model wearing the exact garment and color described.",
    "Keep the whole garment clearly visible, with a natural pose that does not hide its construction.",
    "Use a polished studio or restrained campaign setting consistent with the product-only image.",
  ],
  COMPLETE_LOOK: [
    "Create a complete outfit image using the ordered anchor and companion references supplied in the prompt.",
    "Preserve the anchor item and all selected companion catalogue products exactly.",
  ],
};

export function buildCatalogImagePrompt(input: CatalogImagePromptInput): string {
  const referenceDirection = input.hasFrontReference
    ? "The supplied image is the authoritative front reference. Preserve the same fictional item, proportions, fabric, color, and details; do not redesign it."
    : "No reference image is available. Follow the structured product specification exactly and keep the item visually consistent with the requested catalog set.";

  return [
    "Create one photorealistic ecommerce fashion image for an entirely fictional internal synthetic catalog.",
    `Image role: ${input.role}.`,
    ...ROLE_DIRECTION[input.role],
    referenceDirection,
    `Fictional brand: ${input.catalog.brandName}; segment: ${input.catalog.segment}; visual direction: ${input.catalog.visualDirection}.`,
    `Product: ${input.product.name}; ${input.product.department} / ${input.product.category} / ${input.product.subcategory}; material: ${input.product.material}; season: ${input.product.season}.`,
    `Style ID: ${input.style.externalId}; exact color: ${input.style.colorName} (${input.style.colorCode}).`,
    `Construction specification: ${JSON.stringify(input.style.visualSpec ?? {})}.`,
    "Do not include any logo, trademark, brand text, caption, watermark, border, collage, or extra product.",
    "Do not imitate a real brand, celebrity, identifiable model, or recognizable campaign.",
    "Portrait orientation, high fidelity, realistic fabric texture, production-ready catalog photography.",
  ].join(" ");
}
