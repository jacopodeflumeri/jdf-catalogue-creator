import { parseCatalogProfileConfig, type CatalogProfileConfig } from "./profiles";

/** Apply profile defaults while retaining catalog mix rows managed through Settings. */
export function mergeSeedCatalogConfig(
  profileConfig: unknown,
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

  const mixRows = [...defaults.assortmentPlan];
  for (const row of current.assortmentPlan) {
    const index = mixRows.findIndex((item) =>
      item.departmentKey?.toLocaleLowerCase() === row.departmentKey?.toLocaleLowerCase() &&
      item.category.toLocaleLowerCase() === row.category.toLocaleLowerCase() &&
      item.subcategory.toLocaleLowerCase() === row.subcategory.toLocaleLowerCase(),
    );
    if (index < 0) mixRows.push(row);
    else mixRows[index] = row;
  }

  // Design Mix is operator-owned state. Keep its vocabularies, percentages,
  // compatibility rules (including intentional removals), and overlap policy.
  return parseCatalogProfileConfig({ ...defaults, departments, assortmentPlan: mixRows, designMix: current.designMix });
}
