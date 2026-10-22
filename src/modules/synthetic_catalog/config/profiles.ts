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
  categories: readonly string[];
  subcategories: Readonly<Record<string, readonly string[]>>;
  materials: readonly string[];
  colors: readonly { name: string; code: string; hex: string }[];
  sizes: readonly string[];
  seasons: readonly string[];
  namingTone: string;
  visualDirection: string;
}

export interface CatalogProfileSeed {
  slug: string;
  name: string;
  segment: string;
  brandName: string;
  externalPrefix: string;
  defaultTextModel: string;
  defaultImageModel: string;
  config: CatalogProfileConfig;
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
      categories: ["coats", "knitwear", "shirts", "trousers", "dresses"],
      subcategories: {
        coats: ["wool coats", "trench coats"],
        knitwear: ["cardigans", "crew necks"],
        shirts: ["poplin shirts", "silk shirts"],
        trousers: ["tailored trousers", "wide-leg trousers"],
        dresses: ["midi dresses", "shirt dresses"],
      },
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
      categories: ["tops", "denim", "dresses", "outerwear", "accessories"],
      subcategories: {
        tops: ["t-shirts", "cropped tops"],
        denim: ["straight jeans", "wide-leg jeans"],
        dresses: ["mini dresses", "midi dresses"],
        outerwear: ["bomber jackets", "overshirts"],
        accessories: ["tote bags", "caps"],
      },
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
      categories: ["tailoring", "eveningwear", "leather goods", "outerwear", "fine knitwear"],
      subcategories: {
        tailoring: ["single-breasted jackets", "tailored trousers"],
        eveningwear: ["column dresses", "draped separates"],
        "leather goods": ["top-handle bags", "small leather goods"],
        outerwear: ["cashmere coats", "leather jackets"],
        "fine knitwear": ["cashmere pullovers", "silk-knit cardigans"],
      },
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
      categories: ["training tops", "leggings", "shorts", "jackets", "sports bras"],
      subcategories: {
        "training tops": ["performance t-shirts", "seamless tanks"],
        leggings: ["full-length leggings", "7/8 leggings"],
        shorts: ["training shorts", "cycling shorts"],
        jackets: ["running jackets", "training layers"],
        "sports bras": ["medium-support bras", "high-support bras"],
      },
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
  categories: z.array(z.string().min(1)).min(1),
  subcategories: z.record(z.string(), z.array(z.string().min(1)).min(1)),
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
  for (const category of config.categories) {
    if (!config.subcategories[category]?.length) {
      throw new Error(`Catalog category '${category}' has no subcategories`);
    }
  }
  return config;
}
