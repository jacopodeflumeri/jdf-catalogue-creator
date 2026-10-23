import { z } from "zod";
import { seededShuffle } from "./random";
import type { CatalogDesignMix } from "../config/profiles";

export type DepartmentMode = "AUTO" | "WOMEN" | "MEN";
export type GenerationScope =
  | { type: "ALL" }
  | { type: "DEPARTMENT"; departmentKey: string }
  | { type: "CATEGORY"; category: string };
export type PlannedDepartment = string;

export interface AssortmentPlanRow {
  id?: string;
  departmentKey: string | null;
  category: string;
  subcategory: string;
  productCount: number;
}

export const plannedProductSchema = z.object({
  sequence: z.number().int().positive(),
  seed: z.string().min(1),
  department: z.string().min(1),
  category: z.string().min(1),
  subcategory: z.string().min(1),
  mixRowId: z.string().optional(),
  design: z.object({ patternCode: z.string().nullable(), embellishmentCodes: z.array(z.string()) }).optional(),
});

export type PlannedProduct = z.infer<typeof plannedProductSchema>;

function allocateRows(count: number, rows: readonly AssortmentPlanRow[], seed: string): AssortmentPlanRow[] {
  const totalWeight = rows.reduce((sum, row) => sum + row.productCount, 0);
  if (totalWeight <= 0) throw new Error("No catalogue mix rows match the selected scope");
  const quotas = rows.map((row) => count * row.productCount / totalWeight);
  const allocations = quotas.map(Math.floor);
  const remainder = count - allocations.reduce((sum, value) => sum + value, 0);
  const tieOrder = new Map(seededShuffle(`${seed}:mix-ties`, rows.map((_, index) => index)).map((value, index) => [value, index]));
  const remainderOrder = rows.map((_, index) => index).sort((a, b) =>
    (quotas[b]! % 1) - (quotas[a]! % 1) || tieOrder.get(a)! - tieOrder.get(b)!,
  );
  for (let index = 0; index < remainder; index += 1) {
    const rowIndex = remainderOrder[index]!;
    allocations[rowIndex] = allocations[rowIndex]! + 1;
  }
  return seededShuffle(seed, rows.flatMap((row, index) => Array.from({ length: allocations[index]! }, () => row)));
}

export function roundDesignTarget(count: number, percentage: number): number {
  return Math.floor(count * percentage / 100 + 0.5);
}

function designRule(rowId: string | undefined, mix: CatalogDesignMix, category: string) {
  const explicit = mix.rules.find((rule) => rule.catalogMixRowId === rowId);
  if (explicit) return explicit;
  const normalized = category.toLocaleLowerCase();
  const patternFriendly = /dress|shirt|top|knit|denim|trouser|legging|short|jacket|coat|skirt|blouse/.test(normalized);
  const embellishmentFriendly = /dress|shirt|top|knit|jacket|coat|skirt|blouse|eveningwear/.test(normalized);
  return {
    allowedPatternCodes: patternFriendly ? mix.patterns.map((item) => item.code) : [],
    allowedEmbellishmentCodes: embellishmentFriendly ? mix.embellishments.map((item) => item.code) : [],
  };
}

function quotaAwareSubset<T extends { mixRowId?: string }>(items: T[], count: number, seed: string, quotas: Map<string, number>): T[] {
  const tie = new Map(seededShuffle(`${seed}:tie`, items).map((item, index) => [item, index]));
  const selected: T[] = [];
  const rowCounts = new Map<string, number>();
  const remaining = [...items];
  while (selected.length < count) {
    remaining.sort((a, b) => {
      const ar = a.mixRowId ?? ""; const br = b.mixRowId ?? "";
      const as = (rowCounts.get(ar) ?? 0) / Math.max(1, quotas.get(ar) ?? 1);
      const bs = (rowCounts.get(br) ?? 0) / Math.max(1, quotas.get(br) ?? 1);
      return as - bs || tie.get(a)! - tie.get(b)!;
    });
    const item = remaining.shift()!;
    selected.push(item);
    const key = item.mixRowId ?? "";
    rowCounts.set(key, (rowCounts.get(key) ?? 0) + 1);
  }
  return selected;
}

export function allocateDesignMix<T extends PlannedProduct & { mixRowId?: string }>(
  products: T[], mix: CatalogDesignMix, seed: string,
): T[] {
  const n = products.length;
  const patternTarget = roundDesignTarget(n, mix.patternPercentage);
  const embellishmentTarget = roundDesignTarget(n, mix.embellishmentPercentage);
  const combinedLimit = mix.allowCombined ? roundDesignTarget(n, mix.maxCombinedPercentage) : 0;
  if (!mix.allowCombined && patternTarget + embellishmentTarget > n) throw new Error(`Design targets require overlap for this scope (${n} products), but combined designs are disabled`);
  const rules = products.map((product) => designRule(product.mixRowId, mix, product.category));
  const patterned = products.filter((_, i) => rules[i]!.allowedPatternCodes.length > 0);
  const embellished = products.filter((_, i) => rules[i]!.allowedEmbellishmentCodes.length > 0);
  if (patterned.length < patternTarget) throw new Error(`Pattern target ${patternTarget} cannot be met in this scope: only ${patterned.length} products are compatible`);
  if (embellished.length < embellishmentTarget) throw new Error(`Embellishment target ${embellishmentTarget} cannot be met in this scope: only ${embellished.length} products are compatible`);
  const rowQuotas = new Map<string, number>();
  for (const product of products) rowQuotas.set(product.mixRowId ?? "", (rowQuotas.get(product.mixRowId ?? "") ?? 0) + 1);
  const sharedEligible = products.filter((product) => {
    const r = designRule(product.mixRowId, mix, product.category);
    return r.allowedPatternCodes.length > 0 && r.allowedEmbellishmentCodes.length > 0;
  });
  const patternExclusive = patterned.filter((product) => !sharedEligible.includes(product)).length;
  const embellishmentExclusive = embellished.filter((product) => !sharedEligible.includes(product)).length;
  const minOverlap = Math.max(0, patternTarget + embellishmentTarget - n, patternTarget - patternExclusive, embellishmentTarget - embellishmentExclusive);
  if (sharedEligible.length < minOverlap) throw new Error(`Pattern and embellishment targets require at least ${minOverlap} combined products, but only ${sharedEligible.length} are compatible in this scope`);
  if (minOverlap > combinedLimit) throw new Error(`Design targets require ${minOverlap} combined products, above the configured overlap limit of ${combinedLimit}`);
  const overlapCount = minOverlap;
  if (overlapCount > sharedEligible.length) throw new Error(`Configured overlap target ${overlapCount} cannot be met: only ${sharedEligible.length} products allow both`);
  const overlap = quotaAwareSubset(sharedEligible, overlapCount, `${seed}:overlap`, rowQuotas);
  const selectedPattern = [...overlap, ...quotaAwareSubset(patterned.filter((p) => !overlap.includes(p)), patternTarget - overlapCount, `${seed}:patterns`, rowQuotas)];
  const selectedEmbellishments = [...overlap, ...quotaAwareSubset(embellished.filter((p) => !overlap.includes(p)), embellishmentTarget - overlapCount, `${seed}:embellishments`, rowQuotas)];
  const patternSet = new Set(selectedPattern);
  const embellishmentSet = new Set(selectedEmbellishments);
  return products.map((product) => {
    const rule = designRule(product.mixRowId, mix, product.category);
    const patternCode = patternSet.has(product) ? seededShuffle(`${seed}:${product.seed}:pattern-code`, rule.allowedPatternCodes)[0]! : null;
    const embellishmentCodes = embellishmentSet.has(product) ? [seededShuffle(`${seed}:${product.seed}:embellishment-code`, rule.allowedEmbellishmentCodes)[0]!] : [];
    return { ...product, design: { patternCode, embellishmentCodes } };
  });
}

export function planAssortment(input: {
  sequences: readonly number[];
  scope?: GenerationScope;
  departmentMode?: DepartmentMode;
  config: { departments: readonly { key: string }[]; assortmentPlan: readonly AssortmentPlanRow[] };
  seed: string;
}): PlannedProduct[] {
  if (input.sequences.length === 0) {
    throw new Error("An assortment plan needs at least one product sequence");
  }
  if (new Set(input.sequences).size !== input.sequences.length) {
    throw new Error("Assortment sequences must be unique");
  }

  const legacyMode = input.departmentMode ?? "AUTO";
  const scope = input.scope ?? (legacyMode === "AUTO" ? { type: "ALL" } : { type: "DEPARTMENT", departmentKey: legacyMode });
  const allRows = input.config.assortmentPlan.filter((row) => row.departmentKey != null && row.productCount > 0);
  if (allRows.length === 0) throw new Error("Catalogue mix is not configured");
  const matchingRows = scope.type === "ALL" ? [...allRows]
    : scope.type === "DEPARTMENT" ? allRows.filter((row) => row.departmentKey?.toLocaleLowerCase() === scope.departmentKey.toLocaleLowerCase())
      : allRows.filter((row) => row.category.toLocaleLowerCase() === scope.category.toLocaleLowerCase());
  if (matchingRows.length === 0) throw new Error(`No catalogue mix rows match the selected ${scope.type.toLowerCase()} scope`);
  if (scope.type === "DEPARTMENT" && !input.config.departments.some((department) => department.key.toLocaleLowerCase() === scope.departmentKey.toLocaleLowerCase())) {
    throw new Error(`Unknown catalog department '${scope.departmentKey}'`);
  }
  if (scope.type === "ALL") {
    const expected = allRows.reduce((sum, row) => sum + row.productCount, 0);
    if (input.sequences.length !== expected) throw new Error(`All catalogue scope requires exactly ${expected} product sequences from the configured mix`);
  }
  const selectedRows = scope.type === "ALL"
    ? seededShuffle(`${input.seed}:all-mix-rows`, matchingRows.flatMap((row) => Array.from({ length: row.productCount }, () => row)))
    : allocateRows(input.sequences.length, matchingRows, `${input.seed}:scoped-mix`);

  return input.sequences.map((sequence, index) => {
    const row = selectedRows[index]!;
    return { sequence, seed: `${input.seed}:${sequence}`, department: row.departmentKey!, category: row.category, subcategory: row.subcategory, mixRowId: row.id };
  });
}
