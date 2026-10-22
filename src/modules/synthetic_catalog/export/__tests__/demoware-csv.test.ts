import { CATALOG_PROFILES } from "../../config/profiles";
import {
  buildDemowareCsv,
  DEMOWARE_CSV_COLUMNS,
  type CatalogExportProductSource,
  type CatalogExportSource,
} from "../demoware-csv";

function product(overrides: Partial<CatalogExportProductSource> = {}): CatalogExportProductSource {
  return {
    externalId: "PRE-W-000001",
    name: "Alpine Shell",
    description: "A refined outer layer",
    department: "WOMEN",
    category: "coats",
    subcategory: "wool coats",
    material: "cashmere",
    season: "Autumn/Winter",
    basePrice: "220.00",
    salePrice: "180.00",
    currency: "EUR",
    productUrl: "/catalogs/premium-apparel/products/PRE-W-000001",
    status: "READY",
    styles: [
      {
        externalId: "PRE-W-000001-NAVY",
        colorName: "Midnight Navy",
        status: "READY",
        variants: [
          { externalId: "PRE-W-000001-NAVY-S", sku: "PRE-W-000001-NAVY-S", size: "S", stock: 4, availability: "IN_STOCK" },
          { externalId: "PRE-W-000001-NAVY-M", sku: "PRE-W-000001-NAVY-M", size: "M", stock: 0, availability: "OUT_OF_STOCK" },
        ],
        images: [
          { publicId: "00000000-0000-4000-8000-000000000001", role: "FRONT", status: "READY", storageKey: "public/catalogs/front.webp", mimeType: "image/webp", width: 1024, height: 1536 },
          { publicId: "00000000-0000-4000-8000-000000000002", role: "BACK", status: "READY", storageKey: "public/catalogs/back.webp", mimeType: "image/webp", width: 1024, height: 1536 },
          { publicId: "00000000-0000-4000-8000-000000000003", role: "ON_MODEL", status: "READY", storageKey: "public/catalogs/model.webp", mimeType: "image/webp", width: 1024, height: 1536 },
        ],
      },
    ],
    ...overrides,
  };
}

function source(products = [product()], config = CATALOG_PROFILES[0].config): CatalogExportSource {
  const profile = CATALOG_PROFILES[0];
  return {
    id: 1,
    slug: profile.slug,
    name: profile.name,
    brandName: profile.brandName,
    config,
    products,
  };
}

describe("Demoware CSV export", () => {
  it("emits the exact contract, one row per variant, and stable role-ordered image URLs", () => {
    const result = buildDemowareCsv(source(), "https://catalogs.example.test");
    const rows = result.csv.trimEnd().split("\r\n");
    expect(rows[0]).toBe(DEMOWARE_CSV_COLUMNS.join(","));
    expect(rows).toHaveLength(3);

    const first = rows[1]!.split(",");
    const second = rows[2]!.split(",");
    const index = (column: (typeof DEMOWARE_CSV_COLUMNS)[number]) => DEMOWARE_CSV_COLUMNS.indexOf(column);
    expect(first[index("product_id")]).toBe("PRE-W-000001");
    expect(first[index("style_id")]).toBe("PRE-W-000001-NAVY");
    expect(first[index("variant_id")]).toBe("PRE-W-000001-NAVY-S");
    expect(first[index("department")]).toBe("Women");
    expect(first[index("availability")]).toBe("in_stock");
    expect(first[index("image_url_1")]).toBe("https://catalogs.example.test/api/catalog-assets/00000000-0000-4000-8000-000000000001");
    expect(first[index("image_url_2")]).toBe("https://catalogs.example.test/api/catalog-assets/00000000-0000-4000-8000-000000000002");
    expect(first[index("image_url_3")]).toBe("https://catalogs.example.test/api/catalog-assets/00000000-0000-4000-8000-000000000003");
    expect(second.slice(index("image_url_1"), index("image_url_3") + 1)).toEqual(
      first.slice(index("image_url_1"), index("image_url_3") + 1),
    );
    expect(result.summary).toEqual(expect.objectContaining({
      readyForImport: true,
      totalProducts: 1,
      productsExported: 1,
      stylesExported: 1,
      variantsExported: 2,
      imagesReferenced: 3,
      incompleteProductsExcluded: 0,
      issues: [],
    }));
  });

  it("uses RFC-compatible quoting and blank optional values", () => {
    const result = buildDemowareCsv(
      source([product({ name: 'Alpine, "Shell"', salePrice: null })]),
      "https://catalogs.example.test",
    );
    expect(result.csv).toContain('"Alpine, ""Shell"""');
    expect(result.csv).toContain(",220.00,,EUR,");
    expect(result.csv.endsWith("\r\n")).toBe(true);
  });

  it("exports every color style with its own size rows and configured custom department label", () => {
    const item = product({
      externalId: "PRE-K-000001",
      department: "KIDS",
      styles: [
        { ...product().styles[0]!, externalId: "PRE-K-000001-NAVY", variants: product().styles[0]!.variants.map((variant) => ({ ...variant, externalId: variant.externalId.replace("PRE-W-000001", "PRE-K-000001"), sku: variant.sku.replace("PRE-W-000001", "PRE-K-000001") })) },
        { ...product().styles[0]!, externalId: "PRE-K-000001-OAT", colorName: "Oat", variants: product().styles[0]!.variants.map((variant) => ({ ...variant, externalId: variant.externalId.replace("PRE-W-000001-NAVY", "PRE-K-000001-OAT"), sku: variant.sku.replace("PRE-W-000001-NAVY", "PRE-K-000001-OAT") })), images: product().styles[0]!.images.map((image, index) => ({ ...image, publicId: `00000000-0000-4000-8000-00000000000${index + 4}` })) },
      ],
    });
    const config = { ...CATALOG_PROFILES[0].config, departments: [...CATALOG_PROFILES[0].config.departments, { key: "KIDS", label: "Kids", code: "K", generationWeight: 0.2 }] };
    const result = buildDemowareCsv(source([item], config), "https://catalogs.example.test");
    expect(result.summary).toEqual(expect.objectContaining({ stylesExported: 2, variantsExported: 4, imagesReferenced: 6 }));
    expect(result.csv).toContain("PRE-K-000001-OAT");
    expect(result.csv).toContain(",Kids,");
  });

  it("excludes incomplete and invalid products with actionable reasons", () => {
    const incomplete = product({ externalId: "PRE-W-000002", status: "GENERATING", styles: [] });
    const invalid = product({
      externalId: "PRE-W-000003",
      category: "unknown",
      salePrice: "300.00",
      styles: [],
    });
    const result = buildDemowareCsv(source([incomplete, invalid]), "https://catalogs.example.test");
    expect(result.summary.productsExported).toBe(0);
    expect(result.summary.readyForImport).toBe(false);
    expect(result.summary.variantsExported).toBe(0);
    expect(result.summary.incompleteProductsExcluded).toBe(2);
    expect(result.summary.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["product_not_ready", "category", "sale_price", "styles"]),
    );
    expect(result.csv).toBe(`${DEMOWARE_CSV_COLUMNS.join(",")}\r\n`);
  });

  it("does not mark an empty catalog ready for import", () => {
    const result = buildDemowareCsv(source([]), "https://catalogs.example.test");
    expect(result.summary).toEqual(
      expect.objectContaining({
        readyForImport: false,
        totalProducts: 0,
        variantsExported: 0,
      }),
    );
  });

  it("rejects duplicate IDs and image metadata below export quality", () => {
    const first = product();
    const second = product();
    second.styles[0]!.images[0]!.width = 100;
    const result = buildDemowareCsv(source([first, second]), "https://catalogs.example.test");
    expect(result.summary.productsExported).toBe(0);
    expect(result.summary.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["duplicate_product_id", "duplicate_style_id", "duplicate_variant_id", "duplicate_sku", "image_dimensions"]),
    );
  });
});
