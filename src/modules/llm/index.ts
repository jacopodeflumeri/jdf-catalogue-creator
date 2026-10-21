/**
 * LLM Module
 *
 * LiteLLM proxy integration for making LLM calls with automatic
 * billing attribution and spend tracking.
 *
 * Primary API:
 *   llmCompletion() — simple completion with automatic billing
 *   MODELS          — model constants (e.g., MODELS.SONNET)
 *
 * Advanced API:
 *   getLLMClient()       — raw OpenAI client for streaming / tool-use
 *   buildBillingParams() — billing metadata for raw client calls
 */

export { llmCompletion, getLLMClient, buildBillingParams } from "./lib/client";

export { MODELS, type ModelName } from "./lib/models";

export type {
  LLMCompletionParams,
  LLMMetadata,
  LLMConfig,
} from "./lib/types";
