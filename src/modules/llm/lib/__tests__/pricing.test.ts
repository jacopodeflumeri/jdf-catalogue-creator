/** @jest-environment node */

import {
  calculateCompletionCost,
  calculateImageCost,
  getModelPricing,
} from "../pricing";

describe("LiteLLM local pricing", () => {
  it("prices GPT-5.4 Mini input, cached input, and output tokens", () => {
    const result = calculateCompletionCost("openai/gpt-5.4-mini", {
      prompt_tokens: 1_000_000,
      completion_tokens: 200_000,
      prompt_tokens_details: { cached_tokens: 100_000 },
    });

    expect(result.basis).toBe("TOKEN_USAGE");
    expect(result.costUsd).toBeCloseTo(1.5825, 8);
  });

  it("prices GPT Image 2 from returned modality token usage", () => {
    const result = calculateImageCost({
      model: "openai/gpt-image-2",
      size: "1024x1536",
      quality: "medium",
      usage: {
        input_tokens: 1_100,
        output_tokens: 2_000,
        input_tokens_details: { text_tokens: 100, image_tokens: 1_000 },
        output_tokens_details: { text_tokens: 0, image_tokens: 2_000 },
      },
    });

    expect(result.basis).toBe("TOKEN_USAGE");
    expect(result.costUsd).toBeCloseTo(0.03425, 8);
  });

  it("uses the official per-image output estimate when image usage is absent", () => {
    expect(
      calculateImageCost({
        model: "openai/gpt-image-2",
        size: "1024x1536",
        quality: "medium",
      }),
    ).toMatchObject({ costUsd: 0.041, basis: "CATALOG_ESTIMATE" });

    expect(
      calculateImageCost({
        model: "openai/gpt-image-1.5",
        size: "1024x1536",
        quality: "medium",
      }),
    ).toMatchObject({ costUsd: 0.05, basis: "CATALOG_ESTIMATE" });
  });

  it("keeps unknown models visible as unpriced instead of inventing a cost", () => {
    expect(getModelPricing("openai/unknown")).toBeNull();
    expect(
      calculateCompletionCost("openai/unknown", {
        prompt_tokens: 10,
        completion_tokens: 10,
      }),
    ).toMatchObject({ costUsd: null, basis: "UNPRICED" });
  });
});
