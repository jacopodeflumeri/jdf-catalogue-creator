import { z } from "zod";
import { seededShuffle } from "./random";

export type DepartmentMode = "AUTO" | "WOMEN" | "MEN";
export type GenerationScope =
  | { type: "ALL" }
  | { type: "DEPARTMENT"; departmentKey: string }
  | { type: "CATEGORY"; category: string };
export type PlannedDepartment = string;

export interface AssortmentPlanRow {
  departmentKey: string;
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
  const allRows = input.config.assortmentPlan;
  if (allRows.length === 0) throw new Error("Catalogue mix is not configured");
  const matchingRows = scope.type === "ALL" ? [...allRows]
    : scope.type === "DEPARTMENT" ? allRows.filter((row) => row.departmentKey.toLocaleLowerCase() === scope.departmentKey.toLocaleLowerCase())
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
    return { sequence, seed: `${input.seed}:${sequence}`, department: row.departmentKey, category: row.category, subcategory: row.subcategory };
  });
}
