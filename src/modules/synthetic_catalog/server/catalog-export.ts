import { prisma } from "@/lib/prisma/client";
import { parseCatalogProfileConfig } from "../config/profiles";
import {
  buildUpcCsv,
  UPC_CSV_COLUMNS,
  type CatalogCsvExport,
  type CatalogExportSource,
  type CatalogExportSummary,
} from "../export/upc-csv";

export interface CatalogValidationReport {
  schemaVersion: 2;
  generatedAt: string;
  catalog: { id: number; slug: string; name: string };
  contract: {
    format: "upc-csv";
    columns: number;
    imageColumn: "images";
    imageOrder: ["FRONT", "BACK", "COMPLETE_LOOK"];
    availability: "boolean";
    requiredImageRoles: ["FRONT", "BACK"];
  };
  checks: {
    hasProducts: boolean;
    allProductsExportable: boolean;
    hasVariantRows: boolean;
    noValidationIssues: boolean;
  };
  summary: CatalogExportSummary;
}

async function loadCatalogExportSource(reference: string): Promise<CatalogExportSource | null> {
  const numericId = /^\d+$/.test(reference) ? Number(reference) : null;
  const catalog = await prisma.syntheticCatalog.findFirst({
    where: { ...(numericId == null ? { slug: reference } : { id: numericId }), active: true },
    include: {
      products: {
        where: { archivedAt: null },
        orderBy: { sequence: "asc" },
        include: {
          styles: {
            orderBy: { externalId: "asc" },
            include: {
              variants: { orderBy: { externalId: "asc" } },
              images: { orderBy: { role: "asc" } },
              completeLook: { include: { imageAsset: true, items: { orderBy: { sortOrder: "asc" }, include: { companionStyle: { include: { product: { select: { externalId: true, archivedAt: true } } } } } } } },
            },
          },
        },
      },
    },
  });
  if (!catalog) return null;
  return {
    id: catalog.id,
    slug: catalog.slug,
    name: catalog.name,
    brandName: catalog.brandName,
    config: parseCatalogProfileConfig(catalog.config),
    products: catalog.products.map((product) => ({
      externalId: product.externalId,
      name: product.name,
      description: product.description,
      department: product.department,
      category: product.category,
      subcategory: product.subcategory,
      material: product.material,
      season: product.season,
      patternCode: product.patternCode,
      embellishmentCodes: Array.isArray(product.embellishmentCodes) ? product.embellishmentCodes.filter((code): code is string => typeof code === "string") : [],
      basePrice: product.basePrice.toFixed(2),
      salePrice: product.salePrice?.toFixed(2) ?? null,
      currency: product.currency,
      productUrl: product.productUrl,
      status: product.status,
      styles: product.styles.map((style) => ({
        externalId: style.externalId,
        colorName: style.colorName,
        status: style.status,
        variants: style.variants.map((variant) => ({
          externalId: variant.externalId,
          sku: variant.sku,
          size: variant.size,
          stock: variant.stock,
          availability: variant.availability,
        })),
        images: style.images.map((image) => ({
          publicId: image.publicId,
          role: image.role,
          status: image.status,
          storageKey: image.storageKey,
          mimeType: image.mimeType,
          width: image.width,
          height: image.height,
        })),
        completeLook: style.completeLook ? {
          status: style.completeLook.status,
          imageAsset: style.completeLook.imageAsset ? { publicId: style.completeLook.imageAsset.publicId, status: style.completeLook.imageAsset.status, storageKey: style.completeLook.imageAsset.storageKey } : null,
          items: style.completeLook.items.map((item) => ({ productExternalId: item.companionStyle.product.externalId, archived: item.companionStyle.product.archivedAt != null })),
        } : null,
      })),
    })),
  };
}

export async function createCatalogCsvExport(
  reference: string,
  appUrl: string,
): Promise<({ catalog: { id: number; slug: string; name: string } } & CatalogCsvExport) | null> {
  const source = await loadCatalogExportSource(reference);
  if (!source) return null;
  return {
    catalog: { id: source.id, slug: source.slug, name: source.name },
    ...buildUpcCsv(source, appUrl),
  };
}

export async function getCatalogExportSummary(reference: string): Promise<CatalogExportSummary | null> {
  const source = await loadCatalogExportSource(reference);
  if (!source) return null;
  return buildUpcCsv(source, "http://localhost").summary;
}

export async function createCatalogValidationReport(
  reference: string,
  generatedAt = new Date(),
): Promise<CatalogValidationReport | null> {
  const result = await createCatalogCsvExport(reference, "http://localhost");
  if (!result) return null;
  const { summary } = result;
  return {
    schemaVersion: 2,
    generatedAt: generatedAt.toISOString(),
    catalog: result.catalog,
    contract: {
      format: "upc-csv",
      columns: UPC_CSV_COLUMNS.length,
      imageColumn: "images",
      imageOrder: ["FRONT", "BACK", "COMPLETE_LOOK"],
      availability: "boolean",
      requiredImageRoles: ["FRONT", "BACK"],
    },
    checks: {
      hasProducts: summary.totalProducts > 0,
      allProductsExportable:
        summary.totalProducts > 0 && summary.productsExported === summary.totalProducts,
      hasVariantRows: summary.variantsExported > 0,
      noValidationIssues: summary.issues.length === 0,
    },
    summary,
  };
}
