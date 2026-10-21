import type { CatalogProfileConfig } from "../config/profiles";
import { seededChoice, seededInteger, seededUnit } from "./random";

export interface DeterministicPrice {
  basePrice: string;
  salePrice: string | null;
  currency: "EUR";
}

export interface DeterministicInventory {
  size: string;
  stock: number;
  availability: "IN_STOCK" | "OUT_OF_STOCK";
}

function formatCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function generatePrice(
  config: CatalogProfileConfig,
  seed: string,
): DeterministicPrice {
  const minCents = Math.ceil(config.priceRangeEur.min * 100);
  const maxCents = Math.floor(config.priceRangeEur.max * 100);
  const baseCents = seededInteger(`${seed}:base-price`, minCents, maxCents);
  const onSale = seededUnit(`${seed}:sale-roll`) < config.saleProbability;

  if (!onSale || baseCents <= 1) {
    return { basePrice: formatCents(baseCents), salePrice: null, currency: "EUR" };
  }

  const discountPercent = seededChoice(`${seed}:discount`, [10, 15, 20, 25, 30]);
  const saleCents = Math.max(1, Math.floor((baseCents * (100 - discountPercent)) / 100));
  return {
    basePrice: formatCents(baseCents),
    salePrice: formatCents(Math.min(saleCents, baseCents - 1)),
    currency: "EUR",
  };
}

export function sizesForCategory(
  config: CatalogProfileConfig,
  category: string,
): readonly string[] {
  return category === "accessories" || category === "leather goods"
    ? ["ONE_SIZE"]
    : config.sizes;
}

export function generateInventory(
  config: CatalogProfileConfig,
  category: string,
  seed: string,
): DeterministicInventory[] {
  return sizesForCategory(config, category).map((size) => {
    const stock = seededInteger(
      `${seed}:stock:${size}`,
      config.stockRange.min,
      config.stockRange.max,
    );
    return {
      size,
      stock,
      availability: stock === 0 ? "OUT_OF_STOCK" : "IN_STOCK",
    };
  });
}
