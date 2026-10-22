import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma/client";
import logger from "@/lib/utils/logger";
import {
  calculateCompletionCost,
  calculateImageCost,
  type CompletionUsage,
  type ImageUsage,
} from "./pricing";

type CommonUsageInput = {
  requestId?: string | null;
  feature: string;
  model: string;
};

type CompletionUsageInput = CommonUsageInput & {
  operation: "CHAT_COMPLETION";
  usage?: CompletionUsage | null;
};

type ImageUsageInput = CommonUsageInput & {
  operation: "IMAGE_GENERATION" | "IMAGE_EDIT";
  usage?: ImageUsage | null;
  size: string;
  quality: "low" | "medium" | "high" | "auto";
};

export type LLMUsageInput = CompletionUsageInput | ImageUsageInput;

function jsonSnapshot(value: unknown): Prisma.InputJsonValue | undefined {
  if (value == null) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/**
 * Persist one successful LiteLLM response for local cost monitoring.
 * This is deliberately best-effort: observability must never fail generation.
 */
export async function recordLLMUsage(input: LLMUsageInput): Promise<void> {
  try {
    const calculation =
      input.operation === "CHAT_COMPLETION"
        ? calculateCompletionCost(input.model, input.usage)
        : calculateImageCost({
            model: input.model,
            usage: input.usage,
            size: input.size,
            quality: input.quality,
          });

    const completionUsage = input.operation === "CHAT_COMPLETION" ? input.usage : null;
    const imageUsage = input.operation === "CHAT_COMPLETION" ? null : input.usage;
    const cachedInputTokens = completionUsage?.prompt_tokens_details?.cached_tokens ?? null;

    await prisma.llmUsage.create({
      data: {
        requestId: input.requestId || null,
        feature: input.feature,
        model: input.model,
        operation: input.operation,
        inputTokens: completionUsage?.prompt_tokens ?? imageUsage?.input_tokens ?? null,
        cachedInputTokens,
        outputTokens: completionUsage?.completion_tokens ?? imageUsage?.output_tokens ?? null,
        textInputTokens: imageUsage?.input_tokens_details?.text_tokens ?? null,
        imageInputTokens: imageUsage?.input_tokens_details?.image_tokens ?? null,
        textOutputTokens: imageUsage?.output_tokens_details?.text_tokens ?? null,
        imageOutputTokens: imageUsage?.output_tokens_details?.image_tokens ?? null,
        estimatedCostUsd:
          calculation.costUsd == null ? null : calculation.costUsd.toFixed(8),
        costBasis: calculation.basis,
        pricingSnapshot: jsonSnapshot(calculation.pricing),
        usageSnapshot: jsonSnapshot(input.usage),
      },
    });
  } catch (error) {
    logger.error("Failed to persist local LiteLLM usage", {
      feature: input.feature,
      model: input.model,
      operation: input.operation,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
