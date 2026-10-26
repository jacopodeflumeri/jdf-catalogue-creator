import {
  buildProductHref,
  canonicalFilterQuery,
  DEFAULT_PRODUCT_FILTERS,
  filtersFromSearch,
  resolveInitialProductFilters,
  sanitizeCatalogFrom,
  serializeProductFilters,
  type ProductFilters,
} from "../product-filters";

describe("catalogue product filter URLs", () => {
  const filters: ProductFilters = { ...DEFAULT_PRODUCT_FILTERS, department: "WOMEN", category: "tops", imageStatus: "READY", productState: "ARCHIVED" };

  it("parses URL filters and round-trips browser history/bookmark state", () => {
    const parsed = filtersFromSearch("?department=WOMEN&category=tops&imageStatus=READY&productState=ARCHIVED");
    expect(parsed).toEqual(filters);
    expect(filtersFromSearch(`?${canonicalFilterQuery(parsed)}`)).toEqual(parsed);
  });

  it("omits defaults, uses deterministic parameter order, and keeps unrelated query parameters", () => {
    expect(serializeProductFilters(DEFAULT_PRODUCT_FILTERS).toString()).toBe("");
    expect(serializeProductFilters(filters, new URLSearchParams("tab=products&sort=name")).toString()).toBe("tab=products&sort=name&department=WOMEN&category=tops&imageStatus=READY&productState=ARCHIVED");
  });

  it("restores cached filters per catalogue while explicit URL values take precedence", () => {
    const cached = "department=WOMEN&category=tops&productState=ARCHIVED";
    expect(resolveInitialProductFilters("", cached)).toEqual({ ...DEFAULT_PRODUCT_FILTERS, department: "WOMEN", category: "tops", productState: "ARCHIVED" });
    expect(resolveInitialProductFilters("?category=shoes", cached)).toEqual({ ...DEFAULT_PRODUCT_FILTERS, department: "WOMEN", category: "shoes", productState: "ARCHIVED" });
    expect(canonicalFilterQuery(DEFAULT_PRODUCT_FILTERS)).toBe("");
  });

  it("adds an encoded from URL and sanitizes PDP back links to this catalogue", () => {
    const href = buildProductHref("premium-apparel", "SKU / 1", filters);
    const query = new URL(href, "https://app.test").searchParams;
    expect(query.get("from")).toBe("/admin/catalogs/premium-apparel?department=WOMEN&category=tops&imageStatus=READY&productState=ARCHIVED");
    expect(sanitizeCatalogFrom(query.get("from"), "premium-apparel")).toBe(query.get("from"));
    for (const invalid of ["https://evil.test/admin/catalogs/premium-apparel", "//evil.test/admin/catalogs/premium-apparel", "javascript:alert(1)", "/admin/catalogs/other", "/admin/settings", "/admin/catalogs/premium-apparel%ZZ", "/admin\\catalogs\\premium-apparel"]) {
      expect(sanitizeCatalogFrom(invalid, "premium-apparel")).toBe("/admin/catalogs/premium-apparel");
    }
    expect(sanitizeCatalogFrom(null, "premium-apparel")).toBe("/admin/catalogs/premium-apparel");
  });
});
