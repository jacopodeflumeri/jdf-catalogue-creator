import { llmCompletion, type LLMCompletionParams } from "@/modules/llm";
import { buildProductPrompt } from "./product-prompt";
import {
  validateGeneratedProductSpec,
  type GeneratedProductSpec,
  type ProductGenerationInput,
  type ProductGenerator,
} from "./product-generator";

interface CompletionResponse {
  choices: Array<{ message: { content: string | null } }>;
}

type CompletionCall = (params: LLMCompletionParams) => Promise<CompletionResponse>;
type Sleep = (milliseconds: number) => Promise<void>;

export class ProductResponseError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ProductResponseError";
  }
}

export interface LiteLLMProductGeneratorOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  completion?: CompletionCall;
  sleep?: Sleep;
}

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function defaultCompletion(params: LLMCompletionParams): Promise<CompletionResponse> {
  return llmCompletion(params) as Promise<CompletionResponse>;
}

export function isRetryableProductGenerationError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const status = "status" in error ? Number(error.status) : undefined;
  if (status === 408 || status === 409 || status === 425 || status === 429) return true;
  if (status != null && status >= 500 && status <= 599) return true;

  const code = "code" in error ? String(error.code) : "";
  return ["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "EAI_AGAIN"].includes(code);
}

export class LiteLLMProductGenerator implements ProductGenerator {
  private readonly maxAttempts: number;
  private readonly baseDelayMs: number;
  private readonly completion: CompletionCall;
  private readonly sleep: Sleep;

  constructor(options: LiteLLMProductGeneratorOptions = {}) {
    this.maxAttempts = options.maxAttempts ?? 3;
    this.baseDelayMs = options.baseDelayMs ?? 500;
    this.completion = options.completion ?? defaultCompletion;
    this.sleep = options.sleep ?? defaultSleep;
    if (!Number.isSafeInteger(this.maxAttempts) || this.maxAttempts < 1 || this.maxAttempts > 5) {
      throw new Error("LiteLLM product generation maxAttempts must be between 1 and 5");
    }
    if (!Number.isFinite(this.baseDelayMs) || this.baseDelayMs < 0) {
      throw new Error("LiteLLM product generation baseDelayMs must be non-negative");
    }
  }

  async generateProduct(input: ProductGenerationInput): Promise<GeneratedProductSpec> {
    if (!/^[a-z0-9_-]+\/[a-z0-9._-]+$/i.test(input.model)) {
      throw new Error("LiteLLM model must use the configured provider/model format");
    }
    const prompt = buildProductPrompt(input);
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        const response = await this.completion({
          model: input.model,
          feature: "synthetic-catalog-product-generation",
          messages: [
            { role: "system", content: prompt.system },
            { role: "user", content: prompt.user },
          ],
          response_format: { type: "json_object" },
          max_completion_tokens: 1000,
        });
        const content = response.choices[0]?.message.content;
        if (!content) {
          throw new ProductResponseError("LiteLLM returned an empty product specification");
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(content);
        } catch (error) {
          throw new ProductResponseError("LiteLLM returned invalid product JSON", {
            cause: error,
          });
        }
        return validateGeneratedProductSpec(parsed, input.catalog.config);
      } catch (error) {
        lastError = error;
        if (attempt === this.maxAttempts || !isRetryableProductGenerationError(error)) {
          throw error;
        }
        await this.sleep(this.baseDelayMs * 2 ** (attempt - 1));
      }
    }

    throw lastError;
  }
}
