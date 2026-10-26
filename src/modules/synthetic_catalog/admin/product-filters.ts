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
  const scope = products.filter((product) => filters.productState === "all" || (filters.productState === "ARCHIVED" ? product.archivedAt != null : filters.productState === "ACTIVE" ? product.archivedAt == null : true));
  const departments = new Set(scope.map((product) => product.departmentKey).filter(Boolean));
  const department = filters.department === "all" || departments.has(filters.department) ? filters.department : "all";
  const categories = new Set(scope.filter((product) => department === "all" || product.departmentKey === department).map((product) => product.category).filter(Boolean));
  const category = filters.category === "all" || categories.has(filters.category) ? filters.category : "all";
  const subcategories = new Set(scope.filter((product) => (department === "all" || product.departmentKey === department) && (category === "all" || product.category === category)).map((product) => product.subcategory).filter(Boolean));
  const subcategory = filters.subcategory === "all" || subcategories.has(filters.subcategory) ? filters.subcategory : "all";
  return { ...filters, department, category, subcategory };
}

export function getProductTaxonomyOptions(products: CatalogProductView[], filters: ProductFilters) {
  const scope = products.filter((product) => filters.productState === "all" || (filters.productState === "ARCHIVED" ? product.archivedAt != null : filters.productState === "ACTIVE" ? product.archivedAt == null : true));
  const departments = new Map<string, string>();
  for (const product of scope) if (product.departmentKey && product.department) departments.set(product.departmentKey, product.department);
  const categories = new Set(scope.filter((product) => filters.department === "all" || product.departmentKey === filters.department).map((product) => product.category).filter(Boolean));
  const subcategories = new Set(scope.filter((product) => (filters.department === "all" || product.departmentKey === filters.department) && (filters.category === "all" || product.category === filters.category)).map((product) => product.subcategory).filter(Boolean));
  return {
    departments: [...departments].sort((a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0])),
    categories: [...categories].sort((a, b) => a.localeCompare(b)),
    subcategories: [...subcategories].sort((a, b) => a.localeCompare(b)),
  };
}

export function sanitizeCatalogFrom(value: string | null | undefined, catalogSlug: string): string {
  const fallback = `/admin/catalogs/${encodeURIComponent(catalogSlug)}`;
  if (!value || value.includes("\\") || /%(?![0-9a-f]{2})/i.test(value)) return fallback;
  try {
    const parsed = new URL(value, "https://catalogue.invalid");
    const expected = `/admin/catalogs/${encodeURIComponent(catalogSlug)}`;
    if (parsed.origin !== "https://catalogue.invalid" || parsed.pathname !== expected) return fallback;
    return `${expected}${parsed.search}`;
  } catch {
    return fallback;
  }
}

export function resolveInitialProductFilters(search: string, cachedSearch?: string | null): ProductFilters {
  const params = new URLSearchParams(search);
  return cachedSearch ? mergeExplicitFilters(filtersFromSearch(cachedSearch), params) : filtersFromSearch(search);
}

export function buildProductHref(catalogSlug: string, productExternalId: string, filters: ProductFilters, unrelated = new URLSearchParams()): string {
  const catalogPath = `/admin/catalogs/${encodeURIComponent(catalogSlug)}`;
  const query = serializeProductFilters(filters, unrelated).toString();
  const from = `${catalogPath}${query ? `?${query}` : ""}`;
  return `${catalogPath}/products/${encodeURIComponent(productExternalId)}?${new URLSearchParams({ from }).toString()}`;
}
