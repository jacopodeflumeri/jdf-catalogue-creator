import { CATALOG_PROFILES } from "../../config/profiles";
import {
  buildUpcCsv,
  UPC_CSV_COLUMNS,
  type CatalogExportProductSource,
  type CatalogExportSource,
} from "../upc-csv";

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
    patternCode: null,
    embellishmentCodes: [],
    basePrice: "220.00",
    salePrice: "180.00",
    currency: "EUR",
    productUrl: "/catalogs/premium-apparel/products/PRE-W-000001",
    status: "READY",
    styles: [{
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
    }],
    ...overrides,
  };
}

function source(products = [product()]): CatalogExportSource {
  const profile = CATALOG_PROFILES[0];
  return { id: 1, slug: profile.slug, name: profile.name, brandName: profile.brandName, config: profile.config, products };
}

function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i]!;
    if (quoted) {
      if (char === '"' && csv[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\r" && csv[i + 1] === "\n") {
      row.push(field); rows.push(row); row = []; field = ""; i += 1;
    } else field += char;
  }
  return rows;
}

const image = (row: string[], column: "images") => JSON.parse(row[UPC_CSV_COLUMNS.indexOf(column)]!) as string[];
const cell = (row: string[], column: (typeof UPC_CSV_COLUMNS)[number]) => row[UPC_CSV_COLUMNS.indexOf(column)]!;

describe("UPC CSV export", () => {
  it("emits the exact header order and one row per size variant", () => {
    expect(UPC_CSV_COLUMNS).toEqual([
      "product_id", "style_id", "variant_id", "sku", "brand", "name", "description", "department", "category", "subcategory", "price", "sale_price", "currency", "color", "size", "material", "season", "stock", "availability", "images", "product_url", "companion_products", "pattern", "embellishments",
    ]);
    const rows = parseCsv(buildUpcCsv(source(), "https://catalogs.example.test").csv);
    expect(rows[0]).toEqual([...UPC_CSV_COLUMNS]);
    expect(rows).toHaveLength(3);
    expect(cell(rows[1]!, "variant_id")).toBe("PRE-W-000001-NAVY-S");
    expect(cell(rows[2]!, "variant_id")).toBe("PRE-W-000001-NAVY-M");
  });

  it("writes lowercase boolean availability and orders FRONT before BACK", () => {
    const rows = parseCsv(buildUpcCsv(source(), "https://catalogs.example.test").csv);
    expect(cell(rows[1]!, "availability")).toBe("true");
    expect(cell(rows[2]!, "availability")).toBe("false");
    expect(image(rows[1]!, "images")).toEqual([
      "https://catalogs.example.test/api/catalog-assets/00000000-0000-4000-8000-000000000001",
      "https://catalogs.example.test/api/catalog-assets/00000000-0000-4000-8000-000000000002",
    ]);
    expect(JSON.parse(rows[1]![UPC_CSV_COLUMNS.indexOf("images")]!)).toEqual(image(rows[1]!, "images"));
  });

  it("adds a READY Complete the Look image third and keeps companions semicolon separated", () => {
    const style = product().styles[0]!;
    const readyLook = {
      status: "READY",
      imageAsset: { publicId: "00000000-0000-4000-8000-000000000004", status: "READY", storageKey: "public/catalogs/look.webp" },
      items: [{ productExternalId: "PRE-W-000010", archived: false }, { productExternalId: "PRE-W-000011", archived: false }],
    };
    const result = buildUpcCsv(source([product({ styles: [{ ...style, completeLook: readyLook }] })]), "https://catalogs.example.test");
    const rows = parseCsv(result.csv);
    expect(image(rows[1]!, "images")).toHaveLength(3);
    expect(image(rows[1]!, "images")[2]).toContain("00000000-0000-4000-8000-000000000004");
    expect(cell(rows[1]!, "companion_products")).toBe("PRE-W-000010;PRE-W-000011");
    expect(result.summary.imagesReferenced).toBe(3);
  });

  it("omits missing optional and legacy ON_MODEL images and counts only exported URLs", () => {
    const result = buildUpcCsv(source(), "https://catalogs.example.test");
    const rows = parseCsv(result.csv);
    expect(image(rows[1]!, "images")).toHaveLength(2);
    expect(result.csv).not.toContain("00000000-0000-4000-8000-000000000003");
    expect(result.summary.imagesReferenced).toBe(2);
  });

  it.each([
    ["failed image", { status: "READY", imageAsset: { publicId: "look", status: "FAILED", storageKey: "look.webp" }, items: [{ productExternalId: "PRE-W-000010", archived: false }] }],
    ["skipped look", { status: "SKIPPED", imageAsset: { publicId: "look", status: "READY", storageKey: "look.webp" }, items: [{ productExternalId: "PRE-W-000010", archived: false }] }],
    ["stale look", { status: "STALE", imageAsset: { publicId: "look", status: "READY", storageKey: "look.webp" }, items: [{ productExternalId: "PRE-W-000010", archived: false }] }],
    ["archived companion", { status: "READY", imageAsset: { publicId: "look", status: "READY", storageKey: "look.webp" }, items: [{ productExternalId: "PRE-W-000010", archived: true }] }],
  ])("does not export %s", (_label, completeLook) => {
    const style = product().styles[0]!;
    const rows = parseCsv(buildUpcCsv(source([product({ styles: [{ ...style, completeLook }] })]), "https://catalogs.example.test").csv);
    expect(image(rows[1]!, "images")).toHaveLength(2);
    expect(cell(rows[1]!, "companion_products")).toBe("");
  });

  it("escapes CSV characters inside JSON image URLs without corrupting the parsed array", () => {
    const p = product();
    p.styles[0]!.images[0]!.publicId = 'image,"quoted"';
    const result = buildUpcCsv(source([p]), "https://catalogs.example.test");
    const rows = parseCsv(result.csv);
    const images = image(rows[1]!, "images");
    expect(images).toHaveLength(2);
    expect(images[0]).toContain("image,%22quoted%22");
    expect(result.csv).toContain('""https://catalogs.example.test/api/catalog-assets/image,%22quoted%22""');
  });

  it("preserves design fields and CSV-safe quoting", () => {
    const p = product({ name: 'Alpine, "Shell"', patternCode: "FLORAL", embellishmentCodes: ["EMBROIDERY", "LACE_TRIM"], salePrice: null });
    const row = parseCsv(buildUpcCsv(source([p]), "https://catalogs.example.test").csv)[1]!;
    expect(cell(row, "name")).toBe('Alpine, "Shell"');
    expect(cell(row, "sale_price")).toBe("");
    expect(cell(row, "pattern")).toBe("FLORAL");
    expect(cell(row, "embellishments")).toBe("EMBROIDERY;LACE_TRIM");
  });

  it("excludes invalid products, retains safe empty exports, and reports readiness", () => {
    const incomplete = product({ externalId: "PRE-W-000002", status: "GENERATING", styles: [] });
    const result = buildUpcCsv(source([incomplete]), "https://catalogs.example.test");
    expect(result.summary.productsExported).toBe(0);
    expect(result.summary.readyForImport).toBe(false);
    expect(result.csv).toBe(`${UPC_CSV_COLUMNS.join(",")}\r\n`);
    expect(buildUpcCsv(source([]), "https://catalogs.example.test").summary.readyForImport).toBe(false);
  });

  it("keeps validation tied to canonical stock and availability", () => {
    const invalid = product();
    invalid.styles[0]!.variants[0]!.availability = "OUT_OF_STOCK";
    const result = buildUpcCsv(source([invalid]), "https://catalogs.example.test");
    expect(result.summary.issues.map((issue) => issue.code)).toContain("availability_stock");
    expect(result.summary.variantsExported).toBe(0);
  });

  it("does not export duplicate core image values", () => {
    const invalid = product();
    invalid.styles[0]!.images[1]!.publicId = invalid.styles[0]!.images[0]!.publicId;
    const result = buildUpcCsv(source([invalid]), "https://catalogs.example.test");
    expect(result.summary.issues.map((issue) => issue.code)).toContain("image_duplicate");
    expect(result.summary.variantsExported).toBe(0);
  });
});
