/**
 * LLM Module — Type Definitions
 */

import type OpenAI from "openai";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface LLMConfig {
  apiKey: string;
  baseURL: string;
}

// ---------------------------------------------------------------------------
// Billing / Attribution
// ---------------------------------------------------------------------------

export interface LLMMetadata {
  /** Which feature is making this call (e.g., "email-subject-gen", "chat-synthesis") */
  feature: string;
  /** Client catalog company ID — for customer attribution */
  accountId?: string | number;
  /** Client catalog workspace ID — for brand attribution */
  brandId?: string | number;
}

// ---------------------------------------------------------------------------
// Completion Parameters
// ---------------------------------------------------------------------------

export interface LLMCompletionParams extends LLMMetadata {
  /** Model name from MODELS constant (e.g., MODELS.SONNET) */
  model: string;
  /** Chat messages array */
  messages: OpenAI.ChatCompletionMessageParam[];
  /** Maximum tokens to generate */
  max_tokens?: number;
  /** Maximum completion tokens (newer API param) */
  max_completion_tokens?: number;
  /** Sampling temperature (0-2) */
  temperature?: number;
  /** Response format constraint */
  response_format?: { type: "json_object" | "text" };
  /** Stream the response as Server-Sent Events. Returns an async-iterable stream. */
  stream?: boolean;
  /**
   * Streaming options. When `stream: true`, you MUST set
   * `{ include_usage: true }` — otherwise the final chunk carries no token
   * counts and the call is missing from LiteLLM spend logs (silent failure).
   */
  stream_options?: { include_usage?: boolean };
}
