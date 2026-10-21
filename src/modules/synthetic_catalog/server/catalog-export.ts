import { prisma } from "@/lib/prisma/client";
import { parseCatalogProfileConfig } from "../config/profiles";
import {
  buildDemowareCsv,
  type CatalogCsvExport,
  type CatalogExportSource,
  type CatalogExportSummary,
} from "../export/demoware-csv";

async function loadCatalogExportSource(reference: string): Promise<CatalogExportSource | null> {
  const numericId = /^\d+$/.test(reference) ? Number(reference) : null;
  const catalog = await prisma.syntheticCatalog.findFirst({
    where: numericId == null ? { slug: reference } : { id: numericId },
    include: {
      products: {
        orderBy: { sequence: "asc" },
        include: {
          styles: {
            orderBy: { externalId: "asc" },
            include: {
              variants: { orderBy: { externalId: "asc" } },
              images: { orderBy: { role: "asc" } },
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
    ...buildDemowareCsv(source, appUrl),
  };
}

export async function getCatalogExportSummary(reference: string): Promise<CatalogExportSummary | null> {
  const source = await loadCatalogExportSource(reference);
  if (!source) return null;
  return buildDemowareCsv(source, "http://localhost").summary;
}
