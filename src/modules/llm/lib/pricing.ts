export const OPENAI_PRICING_SOURCE = "https://developers.openai.com/api/docs/pricing";
export const OPENAI_IMAGE_PRICING_SOURCE =
  "https://developers.openai.com/api/docs/guides/image-generation";
export const PRICING_EFFECTIVE_DATE = "2026-10-22";

type TokenRates = {
  textInput: number;
  cachedTextInput?: number;
  textOutput?: number;
  imageInput?: number;
  cachedImageInput?: number;
  imageOutput?: number;
};

type ImageOutputPrices = Record<
  "low" | "medium" | "high",
  Record<"1024x1024" | "1024x1536" | "1536x1024", number>
>;

export type ModelPricing = {
  model: string;
  tokenRatesPerMillion: TokenRates;
  imageOutputPrices?: ImageOutputPrices;
  sourceUrl: string;
  effectiveDate: string;
  note?: string;
};

const PRICING: Record<string, ModelPricing> = {
  "openai/gpt-5.4-mini": {
    model: "openai/gpt-5.4-mini",
    tokenRatesPerMillion: {
      textInput: 0.75,
      cachedTextInput: 0.075,
      textOutput: 4.5,
    },
    sourceUrl: "https://developers.openai.com/api/docs/models/gpt-5.4-mini",
    effectiveDate: PRICING_EFFECTIVE_DATE,
  },
  "openai/gpt-image-2": {
    model: "openai/gpt-image-2",
    tokenRatesPerMillion: {
      textInput: 2.5,
      cachedTextInput: 0.625,
      imageInput: 4,
      cachedImageInput: 1,
      imageOutput: 15,
    },
    imageOutputPrices: {
      low: { "1024x1024": 0.006, "1024x1536": 0.005, "1536x1024": 0.005 },
      medium: { "1024x1024": 0.053, "1024x1536": 0.041, "1536x1024": 0.041 },
      high: { "1024x1024": 0.211, "1024x1536": 0.165, "1536x1024": 0.165 },
    },
    sourceUrl: "https://developers.openai.com/api/docs/models/gpt-image-2",
    effectiveDate: PRICING_EFFECTIVE_DATE,
    note: "Direct Images API requests do not receive cached-input pricing.",
  },
  "openai/gpt-image-1.5": {
    model: "openai/gpt-image-1.5",
    tokenRatesPerMillion: {
      textInput: 5,
      cachedTextInput: 1.25,
      textOutput: 10,
      imageInput: 8,
      cachedImageInput: 2,
      imageOutput: 32,
    },
    imageOutputPrices: {
      low: { "1024x1024": 0.009, "1024x1536": 0.013, "1536x1024": 0.013 },
      medium: { "1024x1024": 0.034, "1024x1536": 0.05, "1536x1024": 0.05 },
      high: { "1024x1024": 0.133, "1024x1536": 0.2, "1536x1024": 0.2 },
    },
    sourceUrl: "https://developers.openai.com/api/docs/models/gpt-image-1.5",
    effectiveDate: PRICING_EFFECTIVE_DATE,
    note: "Deprecated; scheduled to shut down on 2026-12-01.",
  },
};

export type CompletionUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number | null } | null;
};

export type ImageUsage = {
  input_tokens: number;
  output_tokens: number;
  total_tokens?: number;
  input_tokens_details?: { text_tokens?: number; image_tokens?: number } | null;
  output_tokens_details?: { text_tokens?: number; image_tokens?: number } | null;
};

export type CostCalculation = {
  costUsd: number | null;
  basis: "TOKEN_USAGE" | "CATALOG_ESTIMATE" | "UNPRICED";
  pricing: ModelPricing | null;
};

export function getModelPricing(model: string): ModelPricing | null {
  return PRICING[model] ?? null;
}

export function listModelPricing(): ModelPricing[] {
  return Object.values(PRICING);
}

function tokenCost(tokens: number, dollarsPerMillion = 0): number {
  return (Math.max(0, tokens) * dollarsPerMillion) / 1_000_000;
}

export function calculateCompletionCost(
  model: string,
  usage: CompletionUsage | null | undefined,
): CostCalculation {
  const pricing = getModelPricing(model);
  if (!pricing || !usage || pricing.tokenRatesPerMillion.textOutput == null) {
    return { costUsd: null, basis: "UNPRICED", pricing };
  }

  const cached = Math.min(
    Math.max(0, usage.prompt_tokens_details?.cached_tokens ?? 0),
    Math.max(0, usage.prompt_tokens),
  );
  const uncached = Math.max(0, usage.prompt_tokens - cached);
  const rates = pricing.tokenRatesPerMillion;
  const costUsd =
    tokenCost(uncached, rates.textInput) +
    tokenCost(cached, rates.cachedTextInput ?? rates.textInput) +
    tokenCost(usage.completion_tokens, rates.textOutput);

  return { costUsd, basis: "TOKEN_USAGE", pricing };
}

export function calculateImageCost(input: {
  model: string;
  usage?: ImageUsage | null;
  size: string;
  quality: "low" | "medium" | "high" | "auto";
}): CostCalculation {
  const pricing = getModelPricing(input.model);
  if (!pricing) return { costUsd: null, basis: "UNPRICED", pricing: null };

  const usage = input.usage;
  const rates = pricing.tokenRatesPerMillion;
  if (usage && rates.imageOutput != null) {
    const textInput = Math.max(0, usage.input_tokens_details?.text_tokens ?? usage.input_tokens);
    const imageInput = Math.max(0, usage.input_tokens_details?.image_tokens ?? 0);
    const imageOutput = Math.max(
      0,
      usage.output_tokens_details?.image_tokens ?? usage.output_tokens,
    );
    const textOutput = Math.max(0, usage.output_tokens_details?.text_tokens ?? 0);
    const costUsd =
      tokenCost(textInput, rates.textInput) +
      tokenCost(imageInput, rates.imageInput) +
      tokenCost(imageOutput, rates.imageOutput) +
      tokenCost(textOutput, rates.textOutput);
    return { costUsd, basis: "TOKEN_USAGE", pricing };
  }

  const quality = input.quality === "auto" ? null : input.quality;
  const supportedSize = ["1024x1024", "1024x1536", "1536x1024"].includes(input.size)
    ? (input.size as keyof ImageOutputPrices["low"])
    : null;
  const fallback =
    quality && supportedSize ? pricing.imageOutputPrices?.[quality]?.[supportedSize] : undefined;
  return fallback == null
    ? { costUsd: null, basis: "UNPRICED", pricing }
    : { costUsd: fallback, basis: "CATALOG_ESTIMATE", pricing };
}
