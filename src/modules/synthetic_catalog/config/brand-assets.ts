export type CatalogBrandAsset = { slug: string; logoPath: string };

const CATALOG_BRAND_ASSETS: Readonly<Record<string, CatalogBrandAsset>> = {
  "premium-apparel": { slug: "premium-apparel", logoPath: "/img/aureline.png" },
  "fast-fashion": { slug: "fast-fashion", logoPath: "/img/loopline.png" },
  "luxury-fashion": { slug: "luxury-fashion", logoPath: "/img/maison-veyra.png" },
  activewear: { slug: "activewear", logoPath: "/img/kinetiq-form.png" },
};

export function getCatalogBrandAsset(slug: string): CatalogBrandAsset | null {
  return CATALOG_BRAND_ASSETS[slug] ?? null;
}

export function getCatalogBrandLogoPath(slug: string): string | null {
  return getCatalogBrandAsset(slug)?.logoPath ?? null;
}
