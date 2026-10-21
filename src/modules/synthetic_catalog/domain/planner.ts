import { z } from "zod";
import type { CatalogProfileConfig } from "../config/profiles";
import { seededInteger, seededShuffle } from "./random";

export type DepartmentMode = "AUTO" | "WOMEN" | "MEN";
export type PlannedDepartment = "WOMEN" | "MEN";

export const plannedProductSchema = z.object({
  sequence: z.number().int().positive(),
  seed: z.string().min(1),
  department: z.enum(["WOMEN", "MEN"]),
  category: z.string().min(1),
  subcategory: z.string().min(1),
});

export type PlannedProduct = z.infer<typeof plannedProductSchema>;

function allocateDepartments(
  count: number,
  mode: DepartmentMode,
  config: CatalogProfileConfig,
  seed: string,
): PlannedDepartment[] {
  if (mode !== "AUTO") {
    return Array.from({ length: count }, () => mode);
  }

  const totalWeight = config.departmentWeights.women + config.departmentWeights.men;
  const womenCount = Math.round((count * config.departmentWeights.women) / totalWeight);
  return seededShuffle(seed, [
    ...Array.from({ length: womenCount }, () => "WOMEN" as const),
    ...Array.from({ length: count - womenCount }, () => "MEN" as const),
  ]);
}

export function planAssortment(input: {
  sequences: readonly number[];
  departmentMode: DepartmentMode;
  config: CatalogProfileConfig;
  seed: string;
}): PlannedProduct[] {
  if (input.sequences.length === 0) {
    throw new Error("An assortment plan needs at least one product sequence");
  }
  if (new Set(input.sequences).size !== input.sequences.length) {
    throw new Error("Assortment sequences must be unique");
  }

  const departments = allocateDepartments(
    input.sequences.length,
    input.departmentMode,
    input.config,
    `${input.seed}:departments`,
  );
  const categoryOffset = seededInteger(
    `${input.seed}:categories`,
    0,
    input.config.categories.length - 1,
  );

  return input.sequences.map((sequence, index) => {
    const category =
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
