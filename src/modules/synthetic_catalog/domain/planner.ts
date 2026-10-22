import { z } from "zod";
import type { CatalogProfileConfig } from "../config/profiles";
import { seededInteger, seededShuffle } from "./random";

export type DepartmentMode = "AUTO" | "WOMEN" | "MEN";
export type GenerationScope =
  | { type: "ALL" }
  | { type: "DEPARTMENT"; departmentKey: string }
  | { type: "CATEGORY"; category: string };
export type PlannedDepartment = string;

export const plannedProductSchema = z.object({
  sequence: z.number().int().positive(),
  seed: z.string().min(1),
  department: z.string().min(1),
  category: z.string().min(1),
  subcategory: z.string().min(1),
});

export type PlannedProduct = z.infer<typeof plannedProductSchema>;

function allocateDepartments(
  count: number,
  scope: GenerationScope,
  config: CatalogProfileConfig,
  seed: string,
): PlannedDepartment[] {
  if (scope.type === "DEPARTMENT") {
    if (!config.departments.some((department) => department.key === scope.departmentKey)) {
      throw new Error(`Unknown catalog department '${scope.departmentKey}'`);
    }
    return Array.from({ length: count }, () => scope.departmentKey);
  }
  const departments = config.departments;
  const totalWeight = departments.reduce((sum, department) => sum + department.generationWeight, 0);
  const allocations = departments.map((department) => Math.floor(count * department.generationWeight / totalWeight));
  let remainder = count - allocations.reduce((sum, value) => sum + value, 0);
  for (let i = 0; remainder > 0; i = (i + 1) % departments.length) {
    allocations[i] = allocations[i]! + 1;
    remainder -= 1;
  }
  return seededShuffle(seed, departments.flatMap((department, index) =>
    Array.from({ length: allocations[index]! }, () => department.key)));
}

export function planAssortment(input: {
  sequences: readonly number[];
  scope?: GenerationScope;
  departmentMode?: DepartmentMode;
  config: CatalogProfileConfig;
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
  const departments = allocateDepartments(
    input.sequences.length,
    scope,
    input.config,
    `${input.seed}:departments`,
  );
  if (scope.type === "CATEGORY" && !input.config.categories.includes(scope.category)) {
    throw new Error(`Unknown catalog category '${scope.category}'`);
  }
  const categoryOffset = seededInteger(
    `${input.seed}:categories`,
    0,
    input.config.categories.length - 1,
  );

  return input.sequences.map((sequence, index) => {
    const category = scope.type === "CATEGORY" ? scope.category :
      input.config.categories[(categoryOffset + index) % input.config.categories.length]!;
    const subcategories = input.config.subcategories[category];
    if (!subcategories?.length) {
      throw new Error(`Catalog category '${category}' has no subcategories`);
    }
    const subcategory =
      subcategories[
        seededInteger(`${input.seed}:${sequence}:subcategory`, 0, subcategories.length - 1)
      ]!;

    return {
      sequence,
      seed: `${input.seed}:${sequence}`,
      department: departments[index]!,
      category,
      subcategory,
    };
  });
}
