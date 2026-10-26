import {
  buildProductHref,
  canonicalFilterQuery,
  DEFAULT_PRODUCT_FILTERS,
  filtersFromSearch,
  getProductTaxonomyOptions,
  inProductStateScope,
  readFilterSession,
  reconcileProductFilters,
  resolveInitialProductFilters,
  sanitizeCatalogFrom,
  serializeProductFilters,
  validateCachedFilters,
  writeFilterSession,
  type CatalogProductView,
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
    for (const invalid of ["https://evil.test/admin/catalogs/premium-apparel", "https://catalogue.invalid/admin/catalogs/premium-apparel", "//evil.test/admin/catalogs/premium-apparel", "javascript:alert(1)", "/admin/catalogs/other", "/admin/settings", "/admin/catalogs/premium-apparel%ZZ", "/admin\\catalogs\\premium-apparel"]) {
      expect(sanitizeCatalogFrom(invalid, "premium-apparel")).toBe("/admin/catalogs/premium-apparel");
    }
    expect(sanitizeCatalogFrom(null, "premium-apparel")).toBe("/admin/catalogs/premium-apparel");
  });
});

describe("product-driven catalogue taxonomy", () => {
  const product = (values: Partial<CatalogProductView> = {}) => ({
    id: 1, archivedAt: null, externalId: "P1", name: "Product", description: "", departmentKey: "WOMEN", department: "Women", category: "tops", subcategory: "shirts", material: "cotton", season: "summer", patternCode: null, embellishmentCodes: [], basePrice: "10", salePrice: null, currency: "EUR", status: "READY", styles: [], ...values,
  }) as CatalogProductView;
  const products = [
    product(),
    product({ id: 2, externalId: "P2", category: "tops", subcategory: "shirts" }),
    product({ id: 3, externalId: "P3", category: "tops", subcategory: "blouses" }),
    product({ id: 4, externalId: "P4", departmentKey: "MEN", department: "Men", category: "shirts", subcategory: "casual" }),
    product({ id: 5, externalId: "P5", departmentKey: "EMPTY", department: "Empty", category: "", subcategory: "" }),
    product({ id: 6, externalId: "P6", departmentKey: "WOMEN", category: "dresses", subcategory: "maxi", archivedAt: "2026-01-01T00:00:00.000Z" }),
    product({ id: 7, externalId: "P7", departmentKey: "WOMEN", category: "shirts", subcategory: "button-down" }),
  ];

  it("derives distinct non-empty options from product state, department, and category selections", () => {
    expect(getProductTaxonomyOptions(products, DEFAULT_PRODUCT_FILTERS)).toEqual({
      departments: [["EMPTY", "Empty"], ["MEN", "Men"], ["WOMEN", "Women"]],
      categories: ["shirts", "tops"],
      subcategories: ["blouses", "button-down", "casual", "shirts"],
    });
    expect(getProductTaxonomyOptions(products, { ...DEFAULT_PRODUCT_FILTERS, department: "WOMEN" }).categories).toEqual(["shirts", "tops"]);
    expect(getProductTaxonomyOptions(products, { ...DEFAULT_PRODUCT_FILTERS, department: "WOMEN", category: "tops" }).subcategories).toEqual(["blouses", "shirts"]);
  });

  it("uses active, archived, and combined product scopes without image-status narrowing", () => {
    const active = getProductTaxonomyOptions(products, DEFAULT_PRODUCT_FILTERS);
    const archived = getProductTaxonomyOptions(products, { ...DEFAULT_PRODUCT_FILTERS, productState: "ARCHIVED" });
    const combined = getProductTaxonomyOptions(products, { ...DEFAULT_PRODUCT_FILTERS, productState: "all" });
    expect(active.categories).not.toContain("dresses");
    expect(archived.categories).toEqual(["dresses"]);
    expect(combined.categories).toContain("dresses");
    expect(getProductTaxonomyOptions(products, { ...DEFAULT_PRODUCT_FILTERS, imageStatus: "FAILED" })).toEqual(active);
    expect(inProductStateScope(products[0]!, "unknown")).toBe(false);
  });

  it("clears selections that become invalid after an upstream user change", () => {
    const selected = { ...DEFAULT_PRODUCT_FILTERS, department: "WOMEN", category: "tops", subcategory: "blouses" };
    expect(reconcileProductFilters(products, { ...selected, department: "MEN" })).toEqual({ ...selected, department: "MEN", category: "all", subcategory: "all" });
    expect(reconcileProductFilters(products, { ...selected, category: "shirts" })).toEqual({ ...selected, category: "shirts", subcategory: "all" });
    expect(reconcileProductFilters(products, { ...selected, productState: "ARCHIVED" })).toEqual({ ...selected, category: "all", subcategory: "all", productState: "ARCHIVED" });
  });

  it("validates cached taxonomy and isolates and clears session state per catalogue", () => {
    const memory = new Map<string, string>();
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => { memory.set(key, value); },
      removeItem: (key: string) => { memory.delete(key); },
    };
    const stale = { ...DEFAULT_PRODUCT_FILTERS, department: "GONE", category: "removed", subcategory: "old" };
    writeFilterSession(storage, "catalog-a", stale);
    expect(readFilterSession(storage, "catalog-a")).not.toBeNull();
    expect(readFilterSession(storage, "catalog-b")).toBeNull();
    expect(validateCachedFilters(stale, products)).toEqual(DEFAULT_PRODUCT_FILTERS);
    writeFilterSession(storage, "catalog-a", DEFAULT_PRODUCT_FILTERS);
    expect(readFilterSession(storage, "catalog-a")).toBeNull();
  });

  it("does not reset invalid explicit taxonomy values to All", () => {
    const invalid = filtersFromSearch("?department=UNKNOWN&category=not-real");
    expect(invalid.department).toBe("UNKNOWN");
    expect(invalid.category).toBe("not-real");
    expect(products.filter((item) => (invalid.department === "all" || item.departmentKey === invalid.department) && (invalid.category === "all" || item.category === invalid.category))).toHaveLength(0);
  });

  it("validates cached selections in an explicitly selected product-state scope but preserves explicit URL values", () => {
    const resolved = resolveInitialProductFilters("?productState=ARCHIVED", "department=WOMEN&category=tops&subcategory=shirts", products);
    expect(resolved).toEqual({ ...DEFAULT_PRODUCT_FILTERS, department: "WOMEN", productState: "ARCHIVED" });
    expect(resolveInitialProductFilters("?productState=ARCHIVED&category=unknown", "department=WOMEN&category=tops", products)).toEqual({ ...DEFAULT_PRODUCT_FILTERS, department: "WOMEN", category: "unknown", productState: "ARCHIVED" });
  });
});
