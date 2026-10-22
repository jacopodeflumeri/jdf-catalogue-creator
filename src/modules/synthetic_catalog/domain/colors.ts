import type { CatalogProfileConfig } from "../config/profiles";
import { seededShuffle } from "./random";
import type { PlannedProduct } from "./planner";

export interface CatalogColor { name: string; code: string; hex: string }

export function selectStyleColors(input: {
  palette: readonly CatalogColor[];
  primaryColorCode: string;
  count: 2 | 3;
  seed: string;
}): CatalogColor[] {
  const normalizedCodes = input.palette.map((color) => color.code.toUpperCase());
  if (new Set(normalizedCodes).size !== normalizedCodes.length) throw new Error("Catalog palette contains duplicate color codes");
  if (input.palette.length < input.count) throw new Error(`Catalog palette has fewer colors than requested (${input.count})`);
  const primary = input.palette.find((color) => color.code.toUpperCase() === input.primaryColorCode.toUpperCase());
  if (!primary) throw new Error(`Primary color '${input.primaryColorCode}' is not in the catalog palette`);
  const remaining = seededShuffle(`${input.seed}:secondary-colors`, input.palette.filter((color) => color.code !== primary.code));
  return [primary, ...remaining.slice(0, input.count - 1)];
}

export function estimateGenerationOutput(input: {
  products: number;
  colorVariantCount: number;
  sizeCount: number;
  categories?: readonly string[];
  categorySizeCounts?: Readonly<Record<string, number>>;
  categoryOffset?: number;
  fixedCategory?: string;
}) {
  const styles = input.products * input.colorVariantCount;
  const sizeRows = input.fixedCategory
    ? input.products * input.colorVariantCount * (input.categorySizeCounts?.[input.fixedCategory] ?? input.sizeCount)
    : input.categories?.length && input.categorySizeCounts
      ? Array.from({ length: input.products }, (_, index) => input.categories![((input.categoryOffset ?? 0) + index) % input.categories!.length]!)
        .reduce((total, category) => total + input.colorVariantCount * (input.categorySizeCounts?.[category] ?? input.sizeCount), 0)
      : styles * input.sizeCount;
  return {
    products: input.products,
    styles,
    images: styles * 3,
    sizeRows,
    tasks: input.products + styles * 3,
    liteLlmCalls: input.products + styles * 3,
  };
}

export function estimateAssortmentOutput(input: {
  plan: readonly PlannedProduct[];
  colorVariantCount: number;
  categorySizeCounts: Readonly<Record<string, number>>;
}) {
  const products = input.plan.length;
  const styles = products * input.colorVariantCount;
  const images = styles * 3;
  const sizeRows = input.plan.reduce((total, product) =>
    total + input.colorVariantCount * (input.categorySizeCounts[product.category] ?? 0), 0,
  );
  return { products, styles, images, sizeRows, tasks: products + images, liteLlmCalls: products + images };
}

export function snapshotGenerationSettings(config: CatalogProfileConfig): CatalogProfileConfig {
  return JSON.parse(JSON.stringify(config)) as CatalogProfileConfig;
}
