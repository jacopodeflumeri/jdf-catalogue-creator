import { parseCatalogProfileConfig, type CatalogProfileConfig } from "./profiles";

function mergeNames(defaults: readonly string[], current: readonly string[]): string[] {
  const seen = new Set<string>();
  return [...defaults, ...current].filter((value) => {
    const key = value.trim().toLocaleLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Apply profile defaults while retaining taxonomy managed through catalog settings. */
export function mergeSeedCatalogConfig(
  profileConfig: CatalogProfileConfig,
  currentConfig: unknown,
): CatalogProfileConfig {
  const defaults = parseCatalogProfileConfig(profileConfig);
  const current = parseCatalogProfileConfig(currentConfig);

  const departments = [...defaults.departments];
  for (const department of current.departments) {
    const index = departments.findIndex((item) => item.key.toLocaleLowerCase() === department.key.toLocaleLowerCase());
    if (index < 0) departments.push(department);
    else departments[index] = department;
  }

  const categories = mergeNames(defaults.categories, current.categories);
  const subcategories: Record<string, string[]> = {};
  for (const category of categories) {
    const currentCategory = current.categories.find((item) => item.toLocaleLowerCase() === category.toLocaleLowerCase());
    const defaultCategory = defaults.categories.find((item) => item.toLocaleLowerCase() === category.toLocaleLowerCase());
    subcategories[category] = mergeNames(
      defaultCategory ? defaults.subcategories[defaultCategory] ?? [] : [],
      currentCategory ? current.subcategories[currentCategory] ?? [] : [],
    );
  }

  const mixRows = [...defaults.assortmentPlan];
  for (const row of current.assortmentPlan) {
    const index = mixRows.findIndex((item) =>
      item.departmentKey.toLocaleLowerCase() === row.departmentKey.toLocaleLowerCase() &&
      item.category.toLocaleLowerCase() === row.category.toLocaleLowerCase() &&
      item.subcategory.toLocaleLowerCase() === row.subcategory.toLocaleLowerCase(),
    );
    if (index < 0) mixRows.push(row);
    else mixRows[index] = row;
  }

  return { ...defaults, departments, categories, subcategories, assortmentPlan: mixRows };
}
