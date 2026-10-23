import { createCsvRow } from "@/lib/utils/csv";
import type { CatalogProfileConfig } from "../config/profiles";
import { sizesForCategory } from "../domain/rules";

export const DEMOWARE_CSV_COLUMNS = [
  "product_id",
  "style_id",
  "variant_id",
  "sku",
  "brand",
  "name",
  "description",
  "department",
  "category",
  "subcategory",
  "price",
  "sale_price",
  "currency",
  "color",
  "size",
  "material",
  "season",
  "stock",
  "availability",
  "image_url_1",
  "image_url_2",
  "image_url_3",
  "product_url",
  "complete_look_image_url",
  "companion_products",
] as const;

export const MIN_EXPORT_IMAGE_DIMENSION = 512;

type ExportImageRole = "FRONT" | "BACK" | "ON_MODEL" | "COMPLETE_LOOK";

export interface CatalogExportImageSource {
  publicId: string;
  role: ExportImageRole;
  status: string;
  storageKey: string | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
}

export interface CatalogExportVariantSource {
  externalId: string;
  sku: string;
  size: string;
  stock: number;
  availability: string;
}

export interface CatalogExportStyleSource {
  externalId: string;
  colorName: string;
  status: string;
  variants: CatalogExportVariantSource[];
  images: CatalogExportImageSource[];
  completeLook?: {
    status: string;
    imageAsset: { publicId: string; status: string; storageKey: string | null } | null;
    items: Array<{ productExternalId: string; archived: boolean }>;
  } | null;
}

export interface CatalogExportProductSource {
  externalId: string;
  name: string;
  description: string;
  department: string;
  category: string;
  subcategory: string;
  material: string;
  season: string;
  basePrice: string;
  salePrice: string | null;
  currency: string;
  productUrl: string | null;
  status: string;
  styles: CatalogExportStyleSource[];
}

export interface CatalogExportSource {
  id: number;
  slug: string;
  name: string;
  brandName: string;
  config: CatalogProfileConfig;
  products: CatalogExportProductSource[];
}

export interface CatalogExportIssue {
  productId: string;
  code: string;
  message: string;
}

export interface CatalogExportSummary {
  readyForImport: boolean;
  totalProducts: number;
  productsExported: number;
  stylesExported: number;
  variantsExported: number;
  imagesReferenced: number;
  incompleteProductsExcluded: number;
  issues: CatalogExportIssue[];
}

export interface CatalogCsvExport {
  csv: string;
  summary: CatalogExportSummary;
}

const REQUIRED_IMAGE_ROLES: readonly ExportImageRole[] = ["FRONT", "BACK", "ON_MODEL"];
const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/webp", "image/png", "image/jpeg"]);

function countValues(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

function hasText(value: string): boolean {
  return value.trim().length > 0;
}

function absoluteUrl(path: string, appUrl: string): string {
  return new URL(path, appUrl.endsWith("/") ? appUrl : `${appUrl}/`).toString();
}

function productIssues(
  product: CatalogExportProductSource,
  catalog: CatalogExportSource,
  duplicates: {
    products: Map<string, number>;
    styles: Map<string, number>;
    variants: Map<string, number>;
    skus: Map<string, number>;
  },
): CatalogExportIssue[] {
  const issues: CatalogExportIssue[] = [];
  const add = (code: string, message: string) =>
    issues.push({ productId: product.externalId || "(missing)", code, message });

  if (product.status !== "READY") add("product_not_ready", "Product is not ready");
  if (![product.externalId, product.name, product.description, product.material, product.season].every(hasText)) {
    add("required_field", "One or more required product fields are blank");
  }
  if ((duplicates.products.get(product.externalId) ?? 0) > 1) add("duplicate_product_id", "Product ID is not unique");
  const department = catalog.config.departments.find((item) => item.key === product.department);
  if (!department) add("department", "Department is not in the catalog configuration");
  const categoryRows = catalog.config.assortmentPlan.filter((row) => row.category.toLocaleLowerCase() === product.category.toLocaleLowerCase());
  if (categoryRows.length === 0) add("category", "Category is not in the catalogue mix");
  if (!categoryRows.some((row) => row.subcategory.toLocaleLowerCase() === product.subcategory.toLocaleLowerCase())) add("subcategory", "Subcategory does not belong to the product category in the catalogue mix");
  if (!categoryRows.some((row) => row.departmentKey?.toLocaleLowerCase() === product.department.toLocaleLowerCase() && row.subcategory.toLocaleLowerCase() === product.subcategory.toLocaleLowerCase())) {
    add("department_category", "Department, category, and subcategory combination is not assigned in the catalogue mix");
  }
  const price = Number(product.basePrice);
  const salePrice = product.salePrice == null ? null : Number(product.salePrice);
  if (!Number.isFinite(price) || price <= 0) add("price", "Price must be greater than zero");
  if (salePrice != null && (!Number.isFinite(salePrice) || salePrice <= 0 || salePrice >= price)) {
    add("sale_price", "Sale price must be positive and lower than price");
  }
  if (product.currency !== "EUR") add("currency", "Currency must be EUR for the MVP export");
  if (product.styles.length === 0) add("styles", "Product has no styles");

  for (const style of product.styles) {
    if (!hasText(style.externalId) || !hasText(style.colorName)) add("style_required_field", "Style ID or color is blank");
    if (!style.externalId.startsWith(`${product.externalId}-`)) add("style_parent", `Style ${style.externalId} does not belong to the product ID`);
    if ((duplicates.styles.get(style.externalId) ?? 0) > 1) add("duplicate_style_id", `Style ID ${style.externalId} is not unique`);
    if (style.status !== "READY") add("style_not_ready", `Style ${style.externalId} is not ready`);
    if (style.variants.length === 0) add("variants", `Style ${style.externalId} has no variants`);

    const coreImages = style.images.filter((image) => (REQUIRED_IMAGE_ROLES as readonly string[]).includes(image.role));
    const imagesByRole = new Map(coreImages.map((image) => [image.role, image]));
    if (coreImages.length !== REQUIRED_IMAGE_ROLES.length || imagesByRole.size !== REQUIRED_IMAGE_ROLES.length) {
      add("image_roles", `Style ${style.externalId} must have exactly front, back, and on-model images`);
    }
    for (const role of REQUIRED_IMAGE_ROLES) {
      const image = imagesByRole.get(role);
      if (!image) {
        add("image_missing", `Style ${style.externalId} is missing its ${role.toLowerCase()} image`);
        continue;
      }
      if (image.status !== "READY" || !image.storageKey || !image.publicId) {
        add("image_not_ready", `Style ${style.externalId} ${role.toLowerCase()} image is not exportable`);
      }
      if (!image.mimeType || !ALLOWED_IMAGE_MIME_TYPES.has(image.mimeType)) {
        add("image_mime_type", `Style ${style.externalId} ${role.toLowerCase()} image has an unsupported MIME type`);
      }
      if (
        image.width == null ||
        image.height == null ||
        image.width < MIN_EXPORT_IMAGE_DIMENSION ||
        image.height < MIN_EXPORT_IMAGE_DIMENSION
      ) {
        add("image_dimensions", `Style ${style.externalId} ${role.toLowerCase()} image is below ${MIN_EXPORT_IMAGE_DIMENSION}px`);
      }
    }

    for (const variant of style.variants) {
      if (!hasText(variant.externalId) || !hasText(variant.sku) || !hasText(variant.size)) {
        add("variant_required_field", `Style ${style.externalId} has a variant with missing required data`);
      }
      if (!variant.externalId.startsWith(`${style.externalId}-`)) add("variant_parent", `Variant ${variant.externalId} does not belong to the style ID`);
      if ((duplicates.variants.get(variant.externalId) ?? 0) > 1) add("duplicate_variant_id", `Variant ID ${variant.externalId} is not unique`);
      if ((duplicates.skus.get(variant.sku) ?? 0) > 1) add("duplicate_sku", `SKU ${variant.sku} is not unique`);
      if (!sizesForCategory(catalog.config, product.category).includes(variant.size)) {
        add("size", `Variant ${variant.externalId} has an invalid size for its category`);
      }
      if (!Number.isSafeInteger(variant.stock) || variant.stock < 0) add("stock", `Variant ${variant.externalId} has invalid stock`);
      if (!(["IN_STOCK", "OUT_OF_STOCK"] as string[]).includes(variant.availability)) add("availability", `Variant ${variant.externalId} has invalid availability`);
      if ((variant.stock > 0) !== (variant.availability === "IN_STOCK")) add("availability_stock", `Variant ${variant.externalId} availability does not match stock`);
    }
  }
  return issues;
}

export function buildDemowareCsv(source: CatalogExportSource, appUrl: string): CatalogCsvExport {
  const allStyles = source.products.flatMap((product) => product.styles);
  const allVariants = allStyles.flatMap((style) => style.variants);
  const duplicates = {
    products: countValues(source.products.map((product) => product.externalId)),
    styles: countValues(allStyles.map((style) => style.externalId)),
    variants: countValues(allVariants.map((variant) => variant.externalId)),
    skus: countValues(allVariants.map((variant) => variant.sku)),
  };
  const issues: CatalogExportIssue[] = [];
  const exportable: CatalogExportProductSource[] = [];
  for (const product of source.products) {
    const currentIssues = productIssues(product, source, duplicates);
    issues.push(...currentIssues);
    if (currentIssues.length === 0) exportable.push(product);
  }

  const rows: string[] = [createCsvRow([...DEMOWARE_CSV_COLUMNS])];
  let stylesExported = 0;
  let imagesReferenced = 0;
  for (const product of exportable) {
    const department = source.config.departments.find((item) => item.key === product.department);
    for (const style of product.styles) {
      stylesExported += 1;
      imagesReferenced += REQUIRED_IMAGE_ROLES.length;
      const images = new Map(style.images.map((image) => [image.role, image]));
      const imageUrls = REQUIRED_IMAGE_ROLES.map((role) =>
        absoluteUrl(`/api/catalog-assets/${images.get(role)!.publicId}`, appUrl),
      );
      const look = style.completeLook;
      const lookUsable = look?.status === "READY" && look.imageAsset?.status === "READY" && Boolean(look.imageAsset.storageKey) && look.items.every((item) => !item.archived);
      const completeLookUrl = lookUsable ? absoluteUrl(`/api/catalog-assets/${look!.imageAsset!.publicId}`, appUrl) : "";
      const companionProducts = lookUsable ? look!.items.map((item) => item.productExternalId).filter((id) => id !== product.externalId).join(";") : "";
      for (const variant of style.variants) {
        rows.push(
          createCsvRow([
            product.externalId,
            style.externalId,
            variant.externalId,
            variant.sku,
            source.brandName,
            product.name,
            product.description,
            department?.label ?? product.department,
            product.category,
            product.subcategory,
            product.basePrice,
            product.salePrice ?? "",
            product.currency,
            style.colorName,
            variant.size,
            product.material,
            product.season,
            String(variant.stock),
            variant.availability === "IN_STOCK" ? "in_stock" : "out_of_stock",
            ...imageUrls,
            absoluteUrl(product.productUrl ?? `/catalogs/${source.slug}/products/${product.externalId}`, appUrl),
            completeLookUrl,
            companionProducts,
          ]),
        );
      }
    }
  }

  const summary: CatalogExportSummary = {
    readyForImport:
      source.products.length > 0 &&
      exportable.length === source.products.length &&
      rows.length > 1 &&
      issues.length === 0,
    totalProducts: source.products.length,
    productsExported: exportable.length,
    stylesExported,
    variantsExported: rows.length - 1,
    imagesReferenced,
    incompleteProductsExcluded: source.products.length - exportable.length,
    issues,
  };
  return {
    csv: `${rows.join("\r\n")}\r\n`,
    summary,
  };
}
