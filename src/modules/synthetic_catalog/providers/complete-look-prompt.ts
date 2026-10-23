import type { ImageReference } from "./image-generator";

export interface CompleteLookPromptInput {
  anchor: { name: string; category: string; subcategory: string; material: string; season: string; colorName: string; colorCode: string; visualSpec: unknown };
  catalog: { brandName: string; segment: string; visualDirection: string };
  references: ImageReference[];
}

export function buildCompleteLookPrompt(input: CompleteLookPromptInput): string {
  const indexed = input.references.map((reference, index) => `Image ${index + 1}: ${reference.description ?? "catalogue reference"}.`).join(" ");
  return [
    "Produce one photorealistic portrait-oriented fashion catalogue image with one adult fictional model.",
    "The model wears the exact anchor colour style and also wears or carries every selected companion catalogue item.",
    "Preserve the construction, materials, colours, proportions, and visible details from every reference image. Keep the anchor item clearly visible.",
    "Preserve the anchor and every companion product's exact assigned pattern and embellishments. Do not simplify, replace, or invent decoration on any item.",
    "Preserve existing fictional brand-logo repeats visible on referenced products and preserve ordinary patterns as shown. Do not add a logo to an item without that assignment, and never replace an ordinary pattern with a logo pattern.",
    "Use coherent styling and the catalogue visual direction. Do not add another prominent saleable garment.",
    "Neutral unbranded basics may fill unavoidable functional gaps such as shoes when no footwear companion is selected, but are not catalogue companions.",
    "No real-world brands, new or unassigned logos, text, watermarks, celebrities, or recognizable campaigns.",
    indexed,
    `Anchor: ${input.anchor.name}, ${input.anchor.category} / ${input.anchor.subcategory}, ${input.anchor.material}, ${input.anchor.season}, exact ${input.anchor.colorName} (${input.anchor.colorCode}).`,
    `Catalogue direction: ${input.catalog.segment}; ${input.catalog.visualDirection}. Fictional catalogue brand: ${input.catalog.brandName}.`,
    `Anchor construction notes: ${JSON.stringify(input.anchor.visualSpec ?? {})}.`,
  ].join(" ");
}
