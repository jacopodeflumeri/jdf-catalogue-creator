/**
 * LLM Client — LiteLLM Proxy Integration
 *
 * All LLM calls route through the LiteLLM proxy, which provides
 * virtual key management, spend tracking, and customer attribution.
 * The proxy speaks the OpenAI-compatible API, so we use the OpenAI SDK
 * regardless of the underlying model provider (Anthropic, OpenAI, etc.).
 *
 * IMPORTANT: Do not add fallback to direct provider calls. If the proxy
 * is unreachable, the call must fail so we know there's an issue.
 */

import OpenAI from "openai";
import logger from "@/lib/utils/logger";
import type { LLMMetadata, LLMCompletionParams } from "./types";

// ---------------------------------------------------------------------------
// Known Mapp Products (for typo detection)
// ---------------------------------------------------------------------------

const KNOWN_PRODUCTS = ["fashion", "engage", "intelligence", "internal"];
let productWarningLogged = false;

function warnIfUnknownProduct(product: string): void {
  if (productWarningLogged) return;
  if (!KNOWN_PRODUCTS.includes(product)) {
    logger.warn(
      `APP_PRODUCT '${product}' is not a recognized Mapp product (${KNOWN_PRODUCTS.join(", ")}). ` +
        `If this is intentional, ignore this warning.`,
    );
    productWarningLogged = true;
  }
}

/** Reset the product warning flag (for testing) */
export function _resetProductWarning(): void {
  productWarningLogged = false;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

let clientInstance: OpenAI | null = null;

/**
 * Get the singleton OpenAI client configured for the LiteLLM proxy.
 * Use this for advanced scenarios (streaming, tool-use loops).
 * For simple completions, prefer `llmCompletion()`.
 */
export function getLLMClient(): OpenAI {
  if (!clientInstance) {
    clientInstance = new OpenAI({
      apiKey: process.env.LITELLM_API_KEY || "build-placeholder",
      baseURL: process.env.LITELLM_BASE_URL,
    });
  }
  return clientInstance;
}

// ---------------------------------------------------------------------------
// Billing / Attribution
// ---------------------------------------------------------------------------

/**
 * Build the billing params (user + metadata) for an LLM call.
 *
 * Use this when calling `getLLMClient()` directly (e.g., streaming, tool-use loops).
 * For simple completions, prefer `llmCompletion()` which calls this automatically.
 *
 * Throws if APP_NAME or APP_PRODUCT are not set — every LLM call must be
 * attributable to an app and product for spend tracking.
 */
export function buildBillingParams(metadata: LLMMetadata) {
  const { feature, accountId, brandId } = metadata;

  const appName = process.env.APP_NAME;
  if (!appName) {
    throw new Error(
      "APP_NAME environment variable is required for LLM billing attribution. " +
        "Set it in your .env file.",
    );
  }

  const appProduct = process.env.APP_PRODUCT;
  if (!appProduct) {
    throw new Error(
      "APP_PRODUCT environment variable is required for LLM billing attribution. " +
        "Set it to your Mapp product (fashion, engage, intelligence, internal) in your .env file.",
    );
  }

  warnIfUnknownProduct(appProduct);

  const user = accountId
    ? `company:${accountId}:brand:${brandId || "default"}`
    : `internal:${appProduct}:${appName}:${feature}`;

  return {
    user,
    metadata: {
      user,
      spend_logs_metadata: {
        app: appName,
        environment:
          process.env.NEXT_PUBLIC_ENVIRONMENT ||
          process.env.NODE_ENV ||
          "development",
        feature,
        user,
        ...(accountId && { company_id: String(accountId) }),
        ...(brandId && { brand_id: String(brandId) }),
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Simple Completion Helper
// ---------------------------------------------------------------------------

/**
 * Make an LLM completion call with automatic billing attribution.
 *
 * This is the primary API for making LLM calls. It handles all
 * billing/metadata construction so callers only need to provide
 * the model, messages, and attribution context.
 *
 * @example
 * ```typescript
 * import { llmCompletion, MODELS } from '@/modules/llm';
 *
 * const response = await llmCompletion({
 *   model: MODELS.SONNET,
 *   messages: [
 *     { role: 'system', content: 'Summarize the text.' },
 *     { role: 'user', content: text },
 *   ],
 *   feature: 'text-summarization',
 *   accountId: 42,
 *   brandId: 7,
 * });
 *
 * const summary = response.choices[0].message.content;
 * ```
 */
export async function llmCompletion(params: LLMCompletionParams) {
  const { feature, accountId, brandId, ...completionParams } = params;
  const billing = buildBillingParams({ feature, accountId, brandId });
  const client = getLLMClient();

  return client.chat.completions.create({
    ...completionParams,
    ...billing,
  } as any);
}
