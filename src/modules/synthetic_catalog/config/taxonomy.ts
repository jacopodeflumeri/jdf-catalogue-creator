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
  input: { label: string; code: string },
): CatalogProfileConfig {
  const label = normalizeTaxonomyText(input.label, "Department label");
  const key = normalizeDepartmentKey(label);
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9]{1,6}$/.test(code)) throw new Error("Department code must be 1–6 uppercase letters or digits");
  if (config.departments.some((item) => item.key.toUpperCase() === key)) throw new Error("Department already exists");
  if (config.departments.some((item) => item.code.toUpperCase() === code)) throw new Error("Department code already exists");
  return { ...config, departments: [...config.departments, { key, label, code }] };
}
