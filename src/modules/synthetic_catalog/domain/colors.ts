import type { CatalogProfileConfig } from "../config/profiles";
import { seededShuffle } from "./random";

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
}) {
  const styles = input.products * input.colorVariantCount;
  return {
    products: input.products,
    styles,
    images: styles * 3,
    sizeRows: styles * input.sizeCount,
    tasks: input.products + styles * 3,
    liteLlmCalls: input.products + styles * 3,
  };
}

export function snapshotGenerationSettings(config: CatalogProfileConfig): CatalogProfileConfig {
  return JSON.parse(JSON.stringify(config)) as CatalogProfileConfig;
}
