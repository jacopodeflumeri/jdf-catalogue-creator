/** @jest-environment node */

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma/client";
import {
  disconnectPrisma,
  requireTestDatabase,
  truncateAllTables,
} from "@test/utils/db";
import { CATALOG_PROFILES } from "../../config/profiles";
import { createCatalogCsvExport, createCatalogValidationReport } from "../catalog-export";
import { getCatalogDetail, getCatalogOverview } from "../admin-catalogs";

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

describe("catalog export persistence", () => {
  beforeAll(() => requireTestDatabase());
  beforeEach(() => truncateAllTables());
  afterAll(() => disconnectPrisma());

  it("loads persisted relations and repeats ordered image arrays across variants", async () => {
    const profile = CATALOG_PROFILES[0];
    const catalog = await prisma.syntheticCatalog.create({
      data: {
        slug: profile.slug,
        name: profile.name,
        segment: profile.segment,
        brandName: profile.brandName,
        externalPrefix: profile.externalPrefix,
        config: json(profile.config),
        defaultTextModel: profile.defaultTextModel,
        defaultImageModel: profile.defaultImageModel,
      },
    });
    const product = await prisma.syntheticProduct.create({
      data: {
        catalogId: catalog.id,
        sequence: 1,
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
        styles: {
          create: {
            externalId: "PRE-W-000001-NAVY",
            colorName: "Midnight Navy",
            colorCode: "NAVY",
            status: "READY",
            variants: {
              create: [
                { externalId: "PRE-W-000001-NAVY-S", sku: "PRE-W-000001-NAVY-S", size: "S", stock: 5, availability: "IN_STOCK" },
                { externalId: "PRE-W-000001-NAVY-M", sku: "PRE-W-000001-NAVY-M", size: "M", stock: 0, availability: "OUT_OF_STOCK" },
              ],
            },
            images: {
              create: [
                { publicId: "00000000-0000-4000-8000-000000000001", role: "FRONT", status: "READY", storageKey: "public/catalogs/front.webp", mimeType: "image/webp", width: 1024, height: 1536 },
                { publicId: "00000000-0000-4000-8000-000000000002", role: "BACK", status: "READY", storageKey: "public/catalogs/back.webp", mimeType: "image/webp", width: 1024, height: 1536 },
                { publicId: "00000000-0000-4000-8000-000000000003", role: "ON_MODEL", status: "READY", storageKey: "public/catalogs/model.webp", mimeType: "image/webp", width: 1024, height: 1536 },
              ],
            },
          },
        },
      },
    });

    const result = await createCatalogCsvExport(profile.slug, "https://catalogs.example.test");
    expect(result?.summary).toEqual(expect.objectContaining({
      productsExported: 1,
      stylesExported: 1,
      variantsExported: 2,
      imagesReferenced: 2,
      incompleteProductsExcluded: 0,
    }));
    expect(result?.csv.match(/00000000-0000-4000-8000-000000000001/g)).toHaveLength(2);
    expect(result?.csv.match(/00000000-0000-4000-8000-000000000002/g)).toHaveLength(2);
    expect(result?.csv).not.toContain("00000000-0000-4000-8000-000000000003");
    const report = await createCatalogValidationReport(profile.slug);
    expect(report?.schemaVersion).toBe(2);
    expect(report?.contract).toEqual({
      format: "upc-csv",
      columns: 24,
      imageColumn: "images",
      imageOrder: ["FRONT", "BACK", "COMPLETE_LOOK"],
      availability: "boolean",
      requiredImageRoles: ["FRONT", "BACK"],
    });

    await prisma.syntheticProduct.update({ where: { id: product.id }, data: { archivedAt: new Date(), archivedByMappTeamId: null } });
    const activeDetail = await getCatalogDetail(profile.slug);
    const overview = await getCatalogOverview();
    const archivedExport = await createCatalogCsvExport(profile.slug, "https://catalogs.example.test");
    expect(activeDetail?.counts).toEqual({ products: 0, styles: 0, variants: 0, readyImages: 0, failedImages: 0 });
    expect(activeDetail?.products).toHaveLength(1);
    expect(activeDetail?.products[0]?.archivedAt).toBeTruthy();
    expect(overview.find((item) => item.id === catalog.id)).toEqual(expect.objectContaining({ productCount: 0, styleCount: 0, variantCount: 0, readyImageCount: 0, failedImageCount: 0 }));
    expect(archivedExport?.summary).toEqual(expect.objectContaining({ productsExported: 0, stylesExported: 0, variantsExported: 0, imagesReferenced: 0 }));
    expect(await prisma.syntheticStyle.count({ where: { productId: product.id } })).toBe(1);
    expect(await prisma.syntheticVariant.count({ where: { style: { productId: product.id } } })).toBe(2);
  });
});
