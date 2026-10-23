import { seededChoice } from "../domain/random";
import type {
  GeneratedProductSpec,
  ProductGenerationInput,
  ProductGenerator,
} from "./product-generator";

const NAME_PREFIXES = ["Aster", "Elara", "Kova", "Mira", "Nolan", "Soren"] as const;
const SILHOUETTES = ["relaxed", "structured", "streamlined", "regular"] as const;
const CONSTRUCTIONS = ["clean-finished", "panelled", "softly tailored", "seamless"] as const;

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export class MockProductGenerator implements ProductGenerator {
  async generateProduct(input: ProductGenerationInput): Promise<GeneratedProductSpec> {
    const { config } = input.catalog;
    const { plan } = input;
    const color = seededChoice(`${plan.seed}:color`, config.colors);
    const material = seededChoice(`${plan.seed}:material`, config.materials);
    const season = seededChoice(`${plan.seed}:season`, config.seasons);
    const prefix = seededChoice(`${plan.seed}:name`, NAME_PREFIXES);
    const silhouette = seededChoice(`${plan.seed}:silhouette`, SILHOUETTES);
    const construction = seededChoice(`${plan.seed}:construction`, CONSTRUCTIONS);
    const categoryName = titleCase(plan.subcategory.replace(/s$/, ""));

    return {
      name: `${prefix} ${categoryName}`,
      description: `${titleCase(color.name)} ${plan.subcategory} in ${material}, designed with a ${silhouette} silhouette${plan.design?.patternCode ? ` and a ${plan.design.patternCode.toLowerCase().replaceAll("_", " ")} pattern` : ""}${plan.design?.embellishmentCodes.length ? ` with ${plan.design.embellishmentCodes.map((code) => code.toLowerCase().replaceAll("_", " ")).join(" and ")}` : ""} for the ${season} collection.`,
      material,
      season,
      colorName: color.name,
      colorCode: color.code,
      design: {
        silhouette,
        construction,
        details: [plan.subcategory, input.catalog.config.visualDirection],
        patternCode: plan.design?.patternCode ?? null,
        embellishmentCodes: plan.design?.embellishmentCodes ?? [],
      },
    };
  }
}
