import type { CatalogProductView } from "./types";

export type ProductFilters = {
  department: string;
  category: string;
  subcategory: string;
  imageStatus: string;
  productState: string;
};

export const DEFAULT_PRODUCT_FILTERS: ProductFilters = {
  department: "all",
  category: "all",
  subcategory: "all",
  imageStatus: "all",
  productState: "ACTIVE",
};

export const PRODUCT_FILTER_KEYS = ["department", "category", "subcategory", "imageStatus", "productState"] as const;
export const PRODUCT_FILTER_SESSION_PREFIX = "catalogue-product-filters:";

type FilterStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function readFilterSession(storage: FilterStorage, catalogSlug: string): string | null {
  return storage.getItem(`${PRODUCT_FILTER_SESSION_PREFIX}${catalogSlug}`);
}

export function writeFilterSession(storage: FilterStorage, catalogSlug: string, filters: ProductFilters): void {
  const query = canonicalFilterQuery(filters);
  const key = `${PRODUCT_FILTER_SESSION_PREFIX}${catalogSlug}`;
  if (query) storage.setItem(key, query);
  else storage.removeItem(key);
}

export function parseProductFilters(params: URLSearchParams): ProductFilters {
  return {
    department: params.get("department") ?? "all",
    category: params.get("category") ?? "all",
    subcategory: params.get("subcategory") ?? "all",
    imageStatus: params.get("imageStatus") ?? "all",
    productState: params.get("productState") ?? "ACTIVE",
  };
}

export function serializeProductFilters(filters: ProductFilters, base = new URLSearchParams()): URLSearchParams {
  const params = new URLSearchParams(base);
  for (const key of PRODUCT_FILTER_KEYS) params.delete(key);
  if (filters.department !== "all") params.set("department", filters.department);
  if (filters.category !== "all") params.set("category", filters.category);
  if (filters.subcategory !== "all") params.set("subcategory", filters.subcategory);
  if (filters.imageStatus !== "all") params.set("imageStatus", filters.imageStatus);
  if (filters.productState !== "ACTIVE") params.set("productState", filters.productState);
  return params;
}

export function canonicalFilterQuery(filters: ProductFilters): string {
  return serializeProductFilters(filters).toString();
}

export function filtersFromSearch(search: string): ProductFilters {
  return parseProductFilters(new URLSearchParams(search));
}

export function mergeExplicitFilters(cached: ProductFilters, params: URLSearchParams): ProductFilters {
  const merged = { ...cached };
  for (const key of PRODUCT_FILTER_KEYS) {
    if (params.has(key)) merged[key] = params.get(key)!;
  }
  return merged;
}

export function validateCachedFilters(filters: ProductFilters, products: CatalogProductView[]): ProductFilters {
  const productState = ["ACTIVE", "ARCHIVED", "all"].includes(filters.productState) ? filters.productState : DEFAULT_PRODUCT_FILTERS.productState;
  const imageStatus = ["all", "READY", "FAILED", "GENERATING", "MISSING"].includes(filters.imageStatus) ? filters.imageStatus : DEFAULT_PRODUCT_FILTERS.imageStatus;
  const scopedFilters = { ...filters, productState, imageStatus };
  const scope = products.filter((product) => inProductStateScope(product, productState));
  const departments = new Set(scope.map((product) => product.departmentKey).filter(isPresent));
  const department = filters.department === "all" || departments.has(filters.department) ? filters.department : "all";
  const categories = new Set(scope.filter((product) => department === "all" || product.departmentKey === department).map((product) => product.category).filter(isPresent));
  const category = filters.category === "all" || categories.has(filters.category) ? filters.category : "all";
  const subcategories = new Set(scope.filter((product) => (department === "all" || product.departmentKey === department) && (category === "all" || product.category === category)).map((product) => product.subcategory).filter(isPresent));
  const subcategory = filters.subcategory === "all" || subcategories.has(filters.subcategory) ? filters.subcategory : "all";
  return { ...scopedFilters, department, category, subcategory };
}

export function inProductStateScope(product: CatalogProductView, productState: string): boolean {
  if (productState === "all") return true;
  if (productState === "ACTIVE") return product.archivedAt == null;
  if (productState === "ARCHIVED") return product.archivedAt != null;
  return false;
}

function isPresent(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function displayTaxonomyValue(value: string): string {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function compareDisplayLabels(left: string, right: string): number {
  return left.localeCompare(right, "en", { sensitivity: "base" }) || left.localeCompare(right, "en");
}

export function getProductTaxonomyOptions(products: CatalogProductView[], filters: ProductFilters) {
  const scope = products.filter((product) => inProductStateScope(product, filters.productState));
  const departments = new Map<string, string>();
  for (const product of scope) if (isPresent(product.departmentKey) && isPresent(product.department)) {
    const current = departments.get(product.departmentKey);
    if (!current || compareDisplayLabels(product.department, current) < 0) departments.set(product.departmentKey, product.department);
  }
  const categories = new Set(scope.filter((product) => filters.department === "all" || product.departmentKey === filters.department).map((product) => product.category).filter(isPresent));
  const subcategories = new Set(scope.filter((product) => (filters.department === "all" || product.departmentKey === filters.department) && (filters.category === "all" || product.category === filters.category)).map((product) => product.subcategory).filter(isPresent));
  return {
    departments: [...departments].sort((a, b) => compareDisplayLabels(a[1], b[1]) || compareDisplayLabels(a[0], b[0])),
    categories: [...categories].sort((a, b) => compareDisplayLabels(displayTaxonomyValue(a), displayTaxonomyValue(b)) || compareDisplayLabels(a, b)),
    subcategories: [...subcategories].sort((a, b) => compareDisplayLabels(displayTaxonomyValue(a), displayTaxonomyValue(b)) || compareDisplayLabels(a, b)),
  };
}

export function reconcileProductFilters(products: CatalogProductView[], filters: ProductFilters): ProductFilters {
  const scope = products.filter((product) => inProductStateScope(product, filters.productState));
  const departments = new Set(scope.map((product) => product.departmentKey).filter(isPresent));
  const department = filters.department === "all" || departments.has(filters.department) ? filters.department : "all";
  const categories = new Set(scope.filter((product) => department === "all" || product.departmentKey === department).map((product) => product.category).filter(isPresent));
  const category = filters.category === "all" || categories.has(filters.category) ? filters.category : "all";
  const subcategories = new Set(scope.filter((product) => (department === "all" || product.departmentKey === department) && (category === "all" || product.category === category)).map((product) => product.subcategory).filter(isPresent));
  const subcategory = filters.subcategory === "all" || subcategories.has(filters.subcategory) ? filters.subcategory : "all";
  return { ...filters, department, category, subcategory };
}

export function sanitizeCatalogFrom(value: string | null | undefined, catalogSlug: string): string {
  const fallback = `/admin/catalogs/${encodeURIComponent(catalogSlug)}`;
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /%(?![0-9a-f]{2})/i.test(value)) return fallback;
  try {
    const parsed = new URL(value, "https://catalogue.invalid");
    const expected = `/admin/catalogs/${encodeURIComponent(catalogSlug)}`;
    if (parsed.origin !== "https://catalogue.invalid" || parsed.pathname !== expected) return fallback;
    return `${expected}${parsed.search}`;
  } catch {
    return fallback;
  }
}

export function resolveInitialProductFilters(search: string, cachedSearch?: string | null, products?: CatalogProductView[]): ProductFilters {
  const params = new URLSearchParams(search);
  const merged = cachedSearch ? mergeExplicitFilters(filtersFromSearch(cachedSearch), params) : filtersFromSearch(search);
  if (!cachedSearch || !products) return merged;
  const validated = validateCachedFilters(merged, products);
  for (const key of PRODUCT_FILTER_KEYS) if (params.has(key)) validated[key] = params.get(key)!;
  return validated;
}

export function buildProductHref(catalogSlug: string, productExternalId: string, filters: ProductFilters, unrelated = new URLSearchParams()): string {
  const catalogPath = `/admin/catalogs/${encodeURIComponent(catalogSlug)}`;
  const query = serializeProductFilters(filters, unrelated).toString();
  const from = `${catalogPath}${query ? `?${query}` : ""}`;
  return `${catalogPath}/products/${encodeURIComponent(productExternalId)}?${new URLSearchParams({ from }).toString()}`;
}
