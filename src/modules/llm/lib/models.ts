/**
 * LLM Model Constants
 *
 * Model names as configured on the LiteLLM proxy.
 * All names use the `provider/model` format required by LiteLLM routing.
 * Import these instead of hardcoding model strings in your app.
 */

export const MODELS = {
  // Anthropic
  /** Claude Opus 4.8 — most capable (latest Opus); use for complex reasoning */
  OPUS: "anthropic/claude-opus-4-8",
  /** Claude Opus 4.7 — previous-generation Opus (pin when you need 4.7 specifically) */
  OPUS_4_7: "anthropic/claude-opus-4-7",
  /** Claude Opus 4.6 — older Opus (pin when you need 4.6 specifically) */
  OPUS_4_6: "anthropic/claude-opus-4-6",
  /** Claude Sonnet 4.6 — balanced performance and cost */
  SONNET: "anthropic/claude-sonnet-4-6",
  /** Claude Haiku 4.5 — fast and cheap, good for structured output */
  HAIKU: "anthropic/claude-haiku-4-5-20251001",

  // OpenAI
  /** GPT-5.5 — most capable OpenAI model (latest) */
  GPT_5_5: "openai/gpt-5.5",
  /** GPT-5.5 Mini — balanced OpenAI model */
  GPT_5_5_MINI: "openai/gpt-5.5-mini",
  /** GPT-5.5 Nano — cheapest OpenAI model */
  GPT_5_5_NANO: "openai/gpt-5.5-nano",
  /** GPT-5.4 — previous-gen full model */
  GPT_5_4: "openai/gpt-5.4",
  /** GPT-5.4 Mini — previous-gen balanced model */
  GPT_5_4_MINI: "openai/gpt-5.4-mini",
  /** GPT-5.4 Nano — previous-gen cheapest model */
  GPT_5_4_NANO: "openai/gpt-5.4-nano",
  /** GPT-4o — older-gen full model */
  GPT_4O: "openai/gpt-4o",
  /** GPT-4o Mini — older-gen fast/cheap model */
  GPT_4O_MINI: "openai/gpt-4o-mini",
} as const;

export type ModelName = (typeof MODELS)[keyof typeof MODELS];
