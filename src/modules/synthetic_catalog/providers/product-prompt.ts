import type { ProductGenerationInput } from "./product-generator";

export interface ProductPrompt {
  system: string;
  user: string;
}

export function buildProductPrompt(input: ProductGenerationInput): ProductPrompt {
  const { catalog, plan } = input;
  const hasLogoPattern = plan.design?.patternCode === "BRAND_LOGO_REPEAT";
  return {
    system: [
      "You generate fictional fashion product creative for an internal synthetic catalog.",
      "Return exactly one JSON object and no markdown or commentary.",
      "Never imitate a real brand, logo, trademark, celebrity, or identifiable campaign.",
      "The application owns IDs, prices, sale rules, sizes, stock, availability, URLs, and distribution; do not return those fields.",
      "Use only the supplied material, color, and season vocabularies.",
      hasLogoPattern
        ? `The only permitted logo is the current catalogue's supplied fictional ${catalog.brandName} logo, described in the product design as a tasteful repeated textile or surface motif. Do not add other logos, invented lettering, altered symbols, trademarks, or real-brand signatures.`
        : "Do not add patterns or embellishments that are not explicitly assigned. Do not add logos, trademarks, brand motifs, or recognizable real-brand signatures.",
      "Incorporate the assigned design naturally into the product name, description, construction, placement, and details.",
    ].join(" "),
    user: JSON.stringify(
      {
        task: "Create one product specification",
        catalog: {
          segment: catalog.segment,
          fictionalBrand: catalog.brandName,
          namingTone: catalog.config.namingTone,
          visualDirection: catalog.config.visualDirection,
        },
        plannedSlot: {
          department: plan.department,
          category: plan.category,
          subcategory: plan.subcategory,
        },
        plannedDesign: plan.design ?? { patternCode: null, embellishmentCodes: [] },
        controlledVocabulary: {
          materials: catalog.config.materials,
          colors: catalog.config.colors.map(({ name, code }) => ({ name, code })),
          seasons: catalog.config.seasons,
          patterns: catalog.config.designMix.patterns,
          embellishments: catalog.config.designMix.embellishments,
        },
        responseShape: {
          name: "string, maximum 160 characters",
          description: "concise commercial description, maximum 2000 characters",
          material: "exact value from controlledVocabulary.materials",
          season: "exact value from controlledVocabulary.seasons",
          colorName: "exact color name from controlledVocabulary.colors",
          colorCode: "matching exact color code",
          design: {
            silhouette: "string",
            construction: "string",
            details: ["up to 8 short strings"],
            patternCode: "exact plannedDesign.patternCode or null",
            embellishmentCodes: "exact plannedDesign.embellishmentCodes in the same order",
          },
        },
      },
      null,
      2,
    ),
  };
}
