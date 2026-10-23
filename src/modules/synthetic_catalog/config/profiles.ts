import { z } from "zod";

export const DEFAULT_TEXT_MODEL = "openai/gpt-5.4-mini";
export const DEFAULT_IMAGE_MODEL = "openai/gpt-image-2";
export const CATALOG_IMAGE_MODEL_OPTIONS = [
  "openai/gpt-image-2",
  "openai/gpt-image-1.5",
] as const;

export interface CatalogProfileConfig {
  priceRangeEur: { min: number; max: number };
  saleProbability: number;
  stockRange: { min: number; max: number };
  departments: readonly { key: string; label: string; code: string; generationWeight: number }[];
  assortmentPlan: readonly CatalogMixRow[];
  materials: readonly string[];
  colors: readonly { name: string; code: string; hex: string }[];
  sizes: readonly string[];
  seasons: readonly string[];
  namingTone: string;
  visualDirection: string;
}

export interface CatalogMixRow {
  id: string;
  departmentKey: string | null;
  category: string;
  subcategory: string;
  productCount: number;
  outfitSlot: OutfitSlot | null;
}

interface CatalogProfileConfigInput extends Omit<CatalogProfileConfig, "assortmentPlan"> {
  assortmentPlan: readonly {
    id?: string;
    departmentKey: string | null;
    category: string;
    subcategory: string;
    productCount: number;
    outfitSlot?: OutfitSlot | null;
  }[];
}

export const OUTFIT_SLOTS = ["TOP", "BOTTOM", "ONE_PIECE", "OUTERWEAR", "FOOTWEAR", "BAG", "ACCESSORY"] as const;
export type OutfitSlot = (typeof OUTFIT_SLOTS)[number];

const LEGACY_OUTFIT_SLOT_DEFAULTS: Record<string, OutfitSlot> = {
  "dresses|midi dresses": "ONE_PIECE", "dresses|mini dresses": "ONE_PIECE", "eveningwear|column dresses": "ONE_PIECE",
  "coats|wool coats": "OUTERWEAR", "shirts|poplin shirts": "TOP", "trousers|tailored trousers": "BOTTOM",
  "denim|straight jeans": "BOTTOM", "tops|t-shirts": "TOP", "outerwear|bomber jackets": "OUTERWEAR",
  "tailoring|single-breasted jackets": "OUTERWEAR", "leather goods|small leather goods": "ACCESSORY",
  "sports bras|medium-support bras": "TOP", "leggings|full-length leggings": "BOTTOM",
  "training tops|performance t-shirts": "TOP", "jackets|running jackets": "OUTERWEAR",
};
const LEGACY_CATEGORY_SLOT_DEFAULTS: Record<string, OutfitSlot> = {
  dresses: "ONE_PIECE", "evening dresses": "ONE_PIECE", eveningwear: "ONE_PIECE",
  shirts: "TOP", knitwear: "TOP", tops: "TOP", "training tops": "TOP", "sports bras": "TOP",
  trousers: "BOTTOM", denim: "BOTTOM", leggings: "BOTTOM", shorts: "BOTTOM",
  coats: "OUTERWEAR", jackets: "OUTERWEAR", outerwear: "OUTERWEAR",
  bags: "BAG", handbags: "BAG", "leather goods": "ACCESSORY", accessories: "ACCESSORY",
  caps: "ACCESSORY", "small leather goods": "ACCESSORY",
};

export function defaultOutfitSlot(category: string, subcategory: string): OutfitSlot | undefined {
  const normalizedCategory = category.trim().toLocaleLowerCase();
  return LEGACY_OUTFIT_SLOT_DEFAULTS[`${normalizedCategory}|${subcategory.trim().toLocaleLowerCase()}`] ?? LEGACY_CATEGORY_SLOT_DEFAULTS[normalizedCategory];
}

export interface CatalogProfileSeed {
  slug: string;
  name: string;
  segment: string;
  brandName: string;
  externalPrefix: string;
  defaultTextModel: string;
  defaultImageModel: string;
  config: CatalogProfileConfigInput;
}

export const CATALOG_PROFILES = [
  {
    slug: "premium-apparel",
    name: "Premium Apparel",
    segment: "premium",
    brandName: "Aureline",
    externalPrefix: "PRE",
    defaultTextModel: DEFAULT_TEXT_MODEL,
    defaultImageModel: DEFAULT_IMAGE_MODEL,
    config: {
      priceRangeEur: { min: 90, max: 420 },
      saleProbability: 0.18,
      stockRange: { min: 0, max: 45 },
      departments: [{ key: "WOMEN", label: "Women", code: "W", generationWeight: 0.58 }, { key: "MEN", label: "Men", code: "M", generationWeight: 0.42 }],
      assortmentPlan: [
        { departmentKey: "WOMEN", category: "dresses", subcategory: "midi dresses", productCount: 5, outfitSlot: "ONE_PIECE" },
        { departmentKey: "WOMEN", category: "coats", subcategory: "wool coats", productCount: 5, outfitSlot: "OUTERWEAR" },
        { departmentKey: "MEN", category: "shirts", subcategory: "poplin shirts", productCount: 5, outfitSlot: "TOP" },
        { departmentKey: "MEN", category: "trousers", subcategory: "tailored trousers", productCount: 5, outfitSlot: "BOTTOM" },
        { departmentKey: null, category: "coats", subcategory: "trench coats", productCount: 0, outfitSlot: null },
        { departmentKey: null, category: "knitwear", subcategory: "cardigans", productCount: 0, outfitSlot: null },
        { departmentKey: null, category: "knitwear", subcategory: "crew necks", productCount: 0, outfitSlot: null },
        { departmentKey: null, category: "shirts", subcategory: "silk shirts", productCount: 0, outfitSlot: null },
        { departmentKey: null, category: "trousers", subcategory: "wide-leg trousers", productCount: 0, outfitSlot: null },
        { departmentKey: null, category: "dresses", subcategory: "shirt dresses", productCount: 0, outfitSlot: null },
      ],
      materials: ["cashmere", "merino wool", "silk", "linen", "organic cotton"],
      colors: [
        { name: "Midnight Navy", code: "NAVY", hex: "#17223B" },
        { name: "Oat", code: "OAT", hex: "#D8CDBA" },
        { name: "Burgundy", code: "BURG", hex: "#672A3F" },
        { name: "Forest", code: "FOREST", hex: "#294C3A" },
      ],
      sizes: ["XS", "S", "M", "L", "XL"],
      seasons: ["Spring/Summer", "Autumn/Winter"],
      namingTone: "Refined, understated, and material-led",
      visualDirection: "Editorial studio photography with soft directional light and restrained styling",
    },
  },
  {
    slug: "fast-fashion",
    name: "Fast Fashion",
    segment: "fast-fashion",
    brandName: "Loopline",
    externalPrefix: "FAS",
    defaultTextModel: DEFAULT_TEXT_MODEL,
    defaultImageModel: DEFAULT_IMAGE_MODEL,
    config: {
      priceRangeEur: { min: 12, max: 85 },
      saleProbability: 0.42,
      stockRange: { min: 0, max: 180 },
      departments: [{ key: "WOMEN", label: "Women", code: "W", generationWeight: 0.64 }, { key: "MEN", label: "Men", code: "M", generationWeight: 0.36 }],
      assortmentPlan: [
        { departmentKey: "WOMEN", category: "dresses", subcategory: "mini dresses", productCount: 5, outfitSlot: "ONE_PIECE" },
        { departmentKey: "WOMEN", category: "denim", subcategory: "straight jeans", productCount: 5, outfitSlot: "BOTTOM" },
        { departmentKey: "MEN", category: "tops", subcategory: "t-shirts", productCount: 5, outfitSlot: "TOP" },
        { departmentKey: "MEN", category: "outerwear", subcategory: "bomber jackets", productCount: 5, outfitSlot: "OUTERWEAR" },
        { departmentKey: null, category: "tops", subcategory: "cropped tops", productCount: 0, outfitSlot: null },
        { departmentKey: null, category: "denim", subcategory: "wide-leg jeans", productCount: 0, outfitSlot: null },
        { departmentKey: null, category: "dresses", subcategory: "midi dresses", productCount: 0, outfitSlot: null },
        { departmentKey: null, category: "outerwear", subcategory: "overshirts", productCount: 0, outfitSlot: null },
        { departmentKey: null, category: "accessories", subcategory: "tote bags", productCount: 0, outfitSlot: null },
        { departmentKey: null, category: "accessories", subcategory: "caps", productCount: 0, outfitSlot: null },
      ],
      materials: ["cotton", "viscose", "polyester", "denim", "faux leather"],
      colors: [
        { name: "Jet Black", code: "BLACK", hex: "#111111" },
        { name: "Electric Blue", code: "EBLUE", hex: "#2364FF" },
        { name: "Cherry", code: "CHERRY", hex: "#D5284A" },
        { name: "Butter", code: "BUTTER", hex: "#F4DEA4" },
      ],
      sizes: ["XXS", "XS", "S", "M", "L", "XL"],
      seasons: ["Spring", "Summer", "Autumn", "Winter"],
      namingTone: "Energetic, trend-aware, and concise",
      visualDirection: "Bright ecommerce studio imagery with contemporary styling and clean shadows",
    },
  },
  {
    slug: "luxury-fashion",
    name: "Luxury Fashion",
    segment: "luxury",
    brandName: "Maison Veyra",
    externalPrefix: "LUX",
    defaultTextModel: DEFAULT_TEXT_MODEL,
    defaultImageModel: DEFAULT_IMAGE_MODEL,
    config: {
      priceRangeEur: { min: 480, max: 4200 },
      saleProbability: 0.06,
      stockRange: { min: 0, max: 12 },
      departments: [{ key: "WOMEN", label: "Women", code: "W", generationWeight: 0.55 }, { key: "MEN", label: "Men", code: "M", generationWeight: 0.45 }],
      assortmentPlan: [
        { departmentKey: "WOMEN", category: "eveningwear", subcategory: "column dresses", productCount: 5, outfitSlot: "ONE_PIECE" },
        { departmentKey: "WOMEN", category: "tailoring", subcategory: "single-breasted jackets", productCount: 5, outfitSlot: "OUTERWEAR" },
        { departmentKey: "MEN", category: "tailoring", subcategory: "tailored trousers", productCount: 5, outfitSlot: "BOTTOM" },
        { departmentKey: "MEN", category: "leather goods", subcategory: "small leather goods", productCount: 5, outfitSlot: "ACCESSORY" },
        { departmentKey: null, category: "eveningwear", subcategory: "draped separates", productCount: 0, outfitSlot: null },
        { departmentKey: null, category: "leather goods", subcategory: "top-handle bags", productCount: 0, outfitSlot: null },
        { departmentKey: null, category: "outerwear", subcategory: "cashmere coats", productCount: 0, outfitSlot: null },
        { departmentKey: null, category: "outerwear", subcategory: "leather jackets", productCount: 0, outfitSlot: null },
        { departmentKey: null, category: "fine knitwear", subcategory: "cashmere pullovers", productCount: 0, outfitSlot: null },
        { departmentKey: null, category: "fine knitwear", subcategory: "silk-knit cardigans", productCount: 0, outfitSlot: null },
      ],
      materials: ["silk satin", "double-face cashmere", "lambskin", "velvet", "fine wool"],
      colors: [
        { name: "Obsidian", code: "OBSID", hex: "#161518" },
        { name: "Ivory", code: "IVORY", hex: "#EEE9DD" },
        { name: "Garnet", code: "GARNET", hex: "#6E1F2A" },
        { name: "Antique Gold", code: "AGOLD", hex: "#A8874A" },
      ],
      sizes: ["XS", "S", "M", "L", "XL"],
      seasons: ["Resort", "Spring/Summer", "Pre-Fall", "Autumn/Winter"],
      namingTone: "Distinctive, evocative, and craftsmanship-focused",
      visualDirection: "High-fashion campaign imagery with sculptural lighting and gallery-like composition",
    },
  },
  {
    slug: "activewear",
    name: "Activewear",
    segment: "activewear",
    brandName: "Kinetic Form",
    externalPrefix: "ACT",
    defaultTextModel: DEFAULT_TEXT_MODEL,
    defaultImageModel: DEFAULT_IMAGE_MODEL,
    config: {
      priceRangeEur: { min: 28, max: 190 },
      saleProbability: 0.22,
      stockRange: { min: 0, max: 95 },
      departments: [{ key: "WOMEN", label: "Women", code: "W", generationWeight: 0.52 }, { key: "MEN", label: "Men", code: "M", generationWeight: 0.48 }],
      assortmentPlan: [
        { departmentKey: "WOMEN", category: "sports bras", subcategory: "medium-support bras", productCount: 5, outfitSlot: "TOP" },
        { departmentKey: "WOMEN", category: "leggings", subcategory: "full-length leggings", productCount: 5, outfitSlot: "BOTTOM" },
        { departmentKey: "MEN", category: "training tops", subcategory: "performance t-shirts", productCount: 5, outfitSlot: "TOP" },
        { departmentKey: "MEN", category: "jackets", subcategory: "running jackets", productCount: 5, outfitSlot: "OUTERWEAR" },
        { departmentKey: null, category: "sports bras", subcategory: "high-support bras", productCount: 0, outfitSlot: null },
        { departmentKey: null, category: "leggings", subcategory: "7/8 leggings", productCount: 0, outfitSlot: null },
        { departmentKey: null, category: "training tops", subcategory: "seamless tanks", productCount: 0, outfitSlot: null },
        { departmentKey: null, category: "jackets", subcategory: "training layers", productCount: 0, outfitSlot: null },
        { departmentKey: null, category: "shorts", subcategory: "training shorts", productCount: 0, outfitSlot: null },
        { departmentKey: null, category: "shorts", subcategory: "cycling shorts", productCount: 0, outfitSlot: null },
      ],
      materials: ["recycled nylon", "performance jersey", "elastane blend", "mesh", "fleece"],
      colors: [
        { name: "Graphite", code: "GRAPH", hex: "#3C4146" },
        { name: "Volt", code: "VOLT", hex: "#C7F000" },
        { name: "Ocean", code: "OCEAN", hex: "#156B8A" },
        { name: "Clay", code: "CLAY", hex: "#B7674D" },
      ],
      sizes: ["XS", "S", "M", "L", "XL", "XXL"],
      seasons: ["Core", "Spring/Summer", "Autumn/Winter"],
      namingTone: "Technical, confident, and benefit-led",
      visualDirection: "Dynamic sports campaign photography with crisp detail and controlled motion",
    },
  },
] as const satisfies readonly CatalogProfileSeed[];

const departmentSchema = z.object({
  key: z.string().regex(/^[A-Z][A-Z0-9_]{0,39}$/),
  label: z.string().trim().min(1).max(80),
  code: z.string().regex(/^[A-Z0-9]{1,6}$/),
  generationWeight: z.number().positive(),
});

const catalogProfileConfigSchema = z.object({
  priceRangeEur: z.object({ min: z.number().positive(), max: z.number().positive() }),
  saleProbability: z.number().min(0).max(1),
  stockRange: z.object({ min: z.number().int().min(0), max: z.number().int().min(0) }),
  departments: z.array(departmentSchema).min(1).optional(),
  departmentWeights: z.object({ women: z.number().min(0), men: z.number().min(0) }).optional(),
  categories: z.array(z.string().min(1)).optional(),
  subcategories: z.record(z.string(), z.array(z.string().min(1))).optional(),
  assortmentPlan: z.array(z.object({
    id: z.string().trim().min(1).max(200).optional(),
    departmentKey: z.string().trim().min(1).max(40).nullable(),
    category: z.string().trim().min(1).max(120),
    subcategory: z.string().trim().min(1).max(120),
    productCount: z.number().int().nonnegative(),
    outfitSlot: z.enum(OUTFIT_SLOTS).nullable().optional(),
  })).optional(),
  materials: z.array(z.string().min(1)).min(1),
  colors: z
    .array(
      z.object({
        name: z.string().min(1),
        code: z.string().regex(/^[A-Z0-9]+$/),
        hex: z.string().regex(/^#[0-9A-F]{6}$/i),
      }),
    )
    .min(1),
  sizes: z.array(z.string().min(1)).min(1),
  seasons: z.array(z.string().min(1)).min(1),
  namingTone: z.string().min(1),
  visualDirection: z.string().min(1),
});

export function parseCatalogProfileConfig(value: unknown): CatalogProfileConfig {
  const parsed = catalogProfileConfigSchema.parse(value);
  const legacy = parsed.departmentWeights;
  const config = {
    ...parsed,
    assortmentPlan: parsed.assortmentPlan ?? [],
    departments: parsed.departments ?? (legacy ? [
      { key: "WOMEN", label: "Women", code: "W", generationWeight: legacy.women },
      { key: "MEN", label: "Men", code: "M", generationWeight: legacy.men },
    ].filter((d) => d.generationWeight > 0) : []),
  } as CatalogProfileConfig;
  if (config.priceRangeEur.max < config.priceRangeEur.min) {
    throw new Error("Catalog price range maximum must be greater than or equal to its minimum");
  }
  if (config.stockRange.max < config.stockRange.min) {
    throw new Error("Catalog stock range maximum must be greater than or equal to its minimum");
  }
  if (config.departments.reduce((sum, department) => sum + department.generationWeight, 0) <= 0) {
    throw new Error("Catalog department weights must have a positive total");
  }
  const keys = config.departments.map((d) => d.key.toLocaleUpperCase());
  const codes = config.departments.map((d) => d.code.toLocaleUpperCase());
  if (new Set(keys).size !== keys.length) throw new Error("Catalog department keys must be unique");
  if (new Set(codes).size !== codes.length) throw new Error("Catalog department codes must be unique");
  const normalizedAssortmentPlan: CatalogMixRow[] = [];
  const mixTuples = new Set<string>();
  const mixIds = new Set<string>();
  const sourceRows = config.assortmentPlan;
  for (const [index, row] of sourceRows.entries()) {
    const department = row.departmentKey == null ? null : config.departments.find((item) => item.key.toLocaleLowerCase() === row.departmentKey?.toLocaleLowerCase());
    if (row.departmentKey != null && !department) {
      throw new Error(`Catalog mix department '${row.departmentKey}' is not configured`);
    }
    const outfitSlot = row.outfitSlot ?? (department ? defaultOutfitSlot(row.category, row.subcategory) : null) ?? null;
    if (department && row.productCount <= 0) throw new Error(`Catalogue mix row '${row.category} / ${row.subcategory}' needs a positive product count`);
    if (department && !outfitSlot) throw new Error(`Choose an outfit slot for catalogue mix row '${row.category} / ${row.subcategory}'`);
    if (!department && (row.productCount !== 0 || outfitSlot !== null)) throw new Error("Unassigned catalogue mix rows must have zero products and no outfit slot");
    const normalizedRow: CatalogMixRow = {
      id: row.id ?? legacyMixId(index, row.departmentKey, row.category, row.subcategory),
      departmentKey: department?.key ?? null,
      category: row.category,
      subcategory: row.subcategory,
      productCount: row.productCount,
      outfitSlot,
    };
    const tuple = [normalizedRow.departmentKey ?? "", normalizedRow.category, normalizedRow.subcategory].map((value) => value.trim().toLocaleLowerCase()).join("\u0000");
    if (mixTuples.has(tuple)) throw new Error("Catalog mix rows must be unique by department, category, and subcategory");
    if (mixIds.has(normalizedRow.id)) throw new Error("Catalog mix row IDs must be unique");
    mixTuples.add(tuple);
    mixIds.add(normalizedRow.id);
    normalizedAssortmentPlan.push(normalizedRow);
  }

  // Read old catalog-wide taxonomy once, folding every previously configured
  // category/subcategory into an unassigned row when it has no mix row yet.
  for (const category of parsed.categories ?? []) {
    const subcategories = parsed.subcategories?.[category] ?? [];
    if (subcategories.length === 0) throw new Error(`Catalog category '${category}' has no subcategories`);
    for (const subcategory of subcategories) {
      const represented = normalizedAssortmentPlan.some((row) => row.category.toLocaleLowerCase() === category.toLocaleLowerCase() && row.subcategory.toLocaleLowerCase() === subcategory.toLocaleLowerCase());
      if (represented) continue;
      const id = legacyMixId(normalizedAssortmentPlan.length, null, category, subcategory);
      normalizedAssortmentPlan.push({ id, departmentKey: null, category, subcategory, productCount: 0, outfitSlot: null });
      mixIds.add(id);
    }
  }

  const canonicalConfig = Object.fromEntries(Object.entries(config).filter(([key]) => key !== "categories" && key !== "subcategories"));
  return { ...canonicalConfig, assortmentPlan: normalizedAssortmentPlan } as unknown as CatalogProfileConfig;
}

function legacyMixId(index: number, departmentKey: string | null, category: string, subcategory: string): string {
  const input = `${index}:${departmentKey ?? ""}:${category.toLocaleLowerCase()}:${subcategory.toLocaleLowerCase()}`;
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) hash = Math.imul(hash ^ input.charCodeAt(index), 16777619);
  return `mix-${(hash >>> 0).toString(36)}`;
}

export function catalogCategories(config: Pick<CatalogProfileConfig, "assortmentPlan">): string[] {
  return [...new Map(config.assortmentPlan.map((row) => [row.category.toLocaleLowerCase(), row.category])).values()];
}

export function catalogSubcategories(config: Pick<CatalogProfileConfig, "assortmentPlan">): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const row of config.assortmentPlan) {
    const category = catalogCategories(config).find((value) => value.toLocaleLowerCase() === row.category.toLocaleLowerCase())!;
    result[category] ??= [];
    if (!result[category]!.some((value) => value.toLocaleLowerCase() === row.subcategory.toLocaleLowerCase())) result[category]!.push(row.subcategory);
  }
  return result;
}
