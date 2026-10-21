import { CATALOG_PROFILES } from "../../config/profiles";
import { planAssortment } from "../../domain/planner";
import {
  isRetryableProductGenerationError,
  LiteLLMProductGenerator,
  ProductResponseError,
} from "../litellm-product-generator";
import type { ProductGenerationInput } from "../product-generator";

function generationInput(): ProductGenerationInput {
  const profile = CATALOG_PROFILES[0];
  return {
    model: profile.defaultTextModel,
    catalog: {
      slug: profile.slug,
      segment: profile.segment,
      brandName: profile.brandName,
      config: profile.config,
    },
    plan: planAssortment({
      sequences: [1],
      departmentMode: "WOMEN",
      config: profile.config,
      seed: "litellm-test",
    })[0]!,
  };
}

function validSpec(input: ProductGenerationInput) {
  const color = input.catalog.config.colors[0]!;
  return {
    name: "Elara Wool Coat",
    description: "A refined fictional wool coat with a clean tailored finish.",
    material: input.catalog.config.materials[0]!,
    season: input.catalog.config.seasons[0]!,
    colorName: color.name,
    colorCode: color.code,
    design: {
      silhouette: "structured",
      construction: "softly tailored",
      details: ["notched collar"],
    },
  };
}

describe("LiteLLMProductGenerator", () => {
  it("uses the selected proxy model and attributed structured completion path", async () => {
    const input = generationInput();
    const spec = validSpec(input);
    const completion = jest.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(spec) } }],
    });
    const generator = new LiteLLMProductGenerator({ completion });

    await expect(generator.generateProduct(input)).resolves.toEqual(spec);
    expect(completion).toHaveBeenCalledTimes(1);
    expect(completion).toHaveBeenCalledWith(
      expect.objectContaining({
        model: input.model,
        feature: "synthetic-catalog-product-generation",
        response_format: { type: "json_object" },
      }),
    );
  });

  it("retries transient proxy failures with bounded exponential backoff", async () => {
    const input = generationInput();
    const transient = Object.assign(new Error("rate limited"), { status: 429 });
    const completion = jest
      .fn()
      .mockRejectedValueOnce(transient)
      .mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(validSpec(input)) } }],
      });
    const sleep = jest.fn().mockResolvedValue(undefined);
    const generator = new LiteLLMProductGenerator({
      completion,
      sleep,
      maxAttempts: 3,
      baseDelayMs: 25,
    });

    await expect(generator.generateProduct(input)).resolves.toEqual(validSpec(input));
    expect(completion).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(25);
  });

  it("stops after the configured number of transient attempts", async () => {
    const input = generationInput();
    const transient = Object.assign(new Error("proxy unavailable"), { status: 503 });
    const completion = jest.fn().mockRejectedValue(transient);
    const sleep = jest.fn().mockResolvedValue(undefined);
    const generator = new LiteLLMProductGenerator({
      completion,
      sleep,
      maxAttempts: 2,
      baseDelayMs: 10,
    });

    await expect(generator.generateProduct(input)).rejects.toBe(transient);
    expect(completion).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(10);
  });

  it("does not retry auth, malformed JSON, or invalid vocabulary", async () => {
    const input = generationInput();
    const cases = [
      Object.assign(new Error("unauthorized"), { status: 401 }),
      new ProductResponseError("invalid JSON"),
      new Error("outside the catalog vocabulary"),
    ];

    for (const error of cases) {
      const completion = jest.fn().mockRejectedValue(error);
      const generator = new LiteLLMProductGenerator({ completion, maxAttempts: 3 });
      await expect(generator.generateProduct(input)).rejects.toBe(error);
      expect(completion).toHaveBeenCalledTimes(1);
    }
  });

  it("rejects invalid JSON and out-of-vocabulary season without retrying", async () => {
    const input = generationInput();
    const invalidJson = jest.fn().mockResolvedValue({
      choices: [{ message: { content: "not json" } }],
    });
    await expect(
      new LiteLLMProductGenerator({ completion: invalidJson }).generateProduct(input),
    ).rejects.toThrow("invalid product JSON");
    expect(invalidJson).toHaveBeenCalledTimes(1);

    const invalidSpec = { ...validSpec(input), season: "Imaginary Season" };
    const invalidVocabulary = jest.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(invalidSpec) } }],
    });
    await expect(
      new LiteLLMProductGenerator({ completion: invalidVocabulary }).generateProduct(input),
    ).rejects.toThrow("outside the catalog vocabulary");
    expect(invalidVocabulary).toHaveBeenCalledTimes(1);
  });

  it("classifies only transient proxy errors as retryable", () => {
    expect(isRetryableProductGenerationError({ status: 503 })).toBe(true);
    expect(isRetryableProductGenerationError({ code: "ETIMEDOUT" })).toBe(true);
    expect(isRetryableProductGenerationError({ status: 400 })).toBe(false);
    expect(isRetryableProductGenerationError(new ProductResponseError("bad response"))).toBe(
      false,
    );
  });
});
