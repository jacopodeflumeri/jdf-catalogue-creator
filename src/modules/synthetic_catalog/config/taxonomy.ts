import type { CatalogProfileConfig } from "./profiles";

export function normalizeTaxonomyText(value: string, label: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) throw new Error(`${label} cannot be empty`);
  if (/[<>\u0000-\u001F]/.test(normalized)) throw new Error(`${label} contains invalid characters`);
  return normalized;
}

export function normalizeDepartmentKey(label: string): string {
  const key = label.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (!/^[A-Z][A-Z0-9_]{0,39}$/.test(key)) throw new Error("Department label cannot form a valid identifier");
  return key;
}

export function addCatalogDepartment(
  config: CatalogProfileConfig,
  input: { label: string; code: string; generationWeight: number },
): CatalogProfileConfig {
  const label = normalizeTaxonomyText(input.label, "Department label");
  const key = normalizeDepartmentKey(label);
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9]{1,6}$/.test(code)) throw new Error("Department code must be 1–6 uppercase letters or digits");
  if (!Number.isFinite(input.generationWeight) || input.generationWeight <= 0) throw new Error("Generation weight must be positive");
  if (config.departments.some((item) => item.key.toUpperCase() === key)) throw new Error("Department already exists");
  if (config.departments.some((item) => item.code.toUpperCase() === code)) throw new Error("Department code already exists");
  return { ...config, departments: [...config.departments, { key, label, code, generationWeight: input.generationWeight }] };
}

export function addCatalogCategory(config: CatalogProfileConfig, categoryValue: string, subcategoryValue: string): CatalogProfileConfig {
  const category = normalizeTaxonomyText(categoryValue, "Category");
  const subcategory = normalizeTaxonomyText(subcategoryValue, "Subcategory");
  if (config.categories.some((item) => item.toLocaleLowerCase() === category.toLocaleLowerCase())) throw new Error("Category already exists");
  return { ...config, categories: [...config.categories, category], subcategories: { ...config.subcategories, [category]: [subcategory] } };
}

export function addCatalogSubcategory(config: CatalogProfileConfig, categoryValue: string, subcategoryValue: string): CatalogProfileConfig {
  const category = config.categories.find((item) => item.toLocaleLowerCase() === categoryValue.trim().toLocaleLowerCase());
  if (!category) throw new Error("Category does not exist");
  const subcategory = normalizeTaxonomyText(subcategoryValue, "Subcategory");
  const existing = config.subcategories[category] ?? [];
  if (existing.some((item) => item.toLocaleLowerCase() === subcategory.toLocaleLowerCase())) throw new Error("Subcategory already exists");
  return { ...config, subcategories: { ...config.subcategories, [category]: [...existing, subcategory] } };
}
