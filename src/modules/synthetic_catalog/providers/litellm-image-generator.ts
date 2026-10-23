import {
  llmEditImage,
  llmGenerateImage,
  type LLMImageParams,
  type LLMImageResult,
  type LLMImageSource,
} from "@/modules/llm";
import {
  type CatalogImageGenerationInput,
  type CatalogImageGenerator,
  type GeneratedCatalogImage,
} from "./image-generator";
import { isRetryableProductGenerationError } from "./litellm-product-generator";

type GenerateCall = (params: LLMImageParams) => Promise<LLMImageResult>;
type EditCall = (params: LLMImageParams, source: LLMImageSource | readonly LLMImageSource[]) => Promise<LLMImageResult>;
type Sleep = (milliseconds: number) => Promise<void>;

export interface LiteLLMImageGeneratorOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  generate?: GenerateCall;
  edit?: EditCall;
  sleep?: Sleep;
  referencesEnabled?: boolean;
}

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function isReferenceImageUnsupportedError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String(error.code).toLowerCase() : "";
  const message = "message" in error ? String(error.message).toLowerCase() : "";
  return (
    ["unsupported_operation", "not_implemented", "method_not_allowed"].includes(code) ||
    /image (editing|edits?).*(not supported|unsupported|not implemented)/.test(message) ||
    /images\/edits?.*(not supported|unknown url|method not allowed)/.test(message)
  );
}

export class LiteLLMImageGenerator implements CatalogImageGenerator {
  private readonly maxAttempts: number;
  private readonly baseDelayMs: number;
  private readonly generate: GenerateCall;
  private readonly edit: EditCall;
  private readonly sleep: Sleep;
  private readonly referencesEnabled: boolean;

  constructor(options: LiteLLMImageGeneratorOptions = {}) {
    this.maxAttempts = options.maxAttempts ?? 3;
    this.baseDelayMs = options.baseDelayMs ?? 1_000;
    this.generate = options.generate ?? llmGenerateImage;
    this.edit = options.edit ?? llmEditImage;
    this.sleep = options.sleep ?? defaultSleep;
    this.referencesEnabled = options.referencesEnabled ?? true;
    if (!Number.isSafeInteger(this.maxAttempts) || this.maxAttempts < 1 || this.maxAttempts > 5) {
      throw new Error("LiteLLM image generation maxAttempts must be between 1 and 5");
    }
    if (!Number.isFinite(this.baseDelayMs) || this.baseDelayMs < 0) {
      throw new Error("LiteLLM image generation baseDelayMs must be non-negative");
    }
  }

  async generateImage(input: CatalogImageGenerationInput): Promise<GeneratedCatalogImage> {
    if (!/^[a-z0-9_-]+\/[a-z0-9._-]+$/i.test(input.model)) {
      throw new Error("LiteLLM image model must use the configured provider/model format");
    }
    const role = input.role.toLowerCase().replace("_", "-");
    const feature = input.regeneration
      ? `synthetic-catalog-image-${role}-regeneration`
      : `synthetic-catalog-image-${role}`;
    const params: LLMImageParams = {
      model: input.model,
      prompt: input.prompt,
      feature,
      size: "1024x1536",
      quality: "medium",
      outputFormat: "webp",
    };

    const references = input.references ?? (input.reference ? [input.reference] : []);
    if (input.requireReferences && references.length === 0) throw new Error("This image assignment requires reference-image editing, but no references were supplied");
    if (input.requireReferences && !this.referencesEnabled) throw new Error("This image assignment requires reference-image editing, which is disabled");
    if (references.length > 0 && this.referencesEnabled) {
      try {
        const sources = references.map(({ data, mimeType }) => ({ data, mimeType }));
        const result = await this.callWithRetry(() =>
          this.edit(params, sources.length === 1 ? sources[0]! : sources),
        );
        return { ...result, usedReference: true };
      } catch (error) {
        if (!isReferenceImageUnsupportedError(error) || input.role === "COMPLETE_LOOK" || input.requireReferences) throw error;
      }
    }

    if (input.role === "COMPLETE_LOOK") throw new Error("Complete the Look requires supported multi-reference image editing");

    const result = await this.callWithRetry(() => this.generate(params));
    return { ...result, usedReference: false };
  }

  private async callWithRetry(call: () => Promise<LLMImageResult>): Promise<LLMImageResult> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        return await call();
      } catch (error) {
        lastError = error;
        if (attempt === this.maxAttempts || !isRetryableProductGenerationError(error)) throw error;
        await this.sleep(this.baseDelayMs * 2 ** (attempt - 1));
      }
    }
    throw lastError;
  }
}
