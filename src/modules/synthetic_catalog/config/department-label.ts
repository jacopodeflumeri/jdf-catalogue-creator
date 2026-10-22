import type { CatalogProfileConfig } from "./profiles";

export function configuredDepartmentLabel(config: CatalogProfileConfig, key: string): string {
  return config.departments.find((department) => department.key.toLocaleLowerCase() === key.toLocaleLowerCase())?.label ?? key;
}
