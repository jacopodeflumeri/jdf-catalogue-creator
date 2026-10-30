export type CatalogBrandAsset = { slug: string; logoPath: string; heroPath: string };

const CATALOG_BRAND_ASSETS: Readonly<Record<string, CatalogBrandAsset>> = {
  "premium-apparel": { slug: "premium-apparel", logoPath: "/img/aureline.png", heroPath: "/img/aureline-hero.png" },
  "fast-fashion": { slug: "fast-fashion", logoPath: "/img/loopline.png", heroPath: "/img/loopline-hero.png" },
  "luxury-fashion": { slug: "luxury-fashion", logoPath: "/img/maison-veyra.png", heroPath: "/img/maison-veyra-hero.png" },
  activewear: { slug: "activewear", logoPath: "/img/kinetiq-form.png", heroPath: "/img/kineticForm-hero.png" },
};

export function getCatalogBrandAsset(slug: string): CatalogBrandAsset | null {
  return CATALOG_BRAND_ASSETS[slug] ?? null;
}

export function getCatalogBrandLogoPath(slug: string): string | null {
  return getCatalogBrandAsset(slug)?.logoPath ?? null;
}

export function getCatalogBrandHeroPath(slug: string): string | null {
  return getCatalogBrandAsset(slug)?.heroPath ?? null;
}
