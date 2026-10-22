/** @jest-environment node */

const generate = jest.fn();
const edit = jest.fn();
const buildBillingParams = jest.fn(() => ({
  user: "internal:internal:test-app:image",
  metadata: { spend_logs_metadata: { app: "test-app", feature: "image" } },
}));
const recordLLMUsage = jest.fn();

jest.mock("../client", () => ({
  getLLMClient: () => ({ images: { generate, edit } }),
  buildBillingParams: (...args: unknown[]) => buildBillingParams(...args),
}));

jest.mock("../usage-recorder", () => ({
  recordLLMUsage: (...args: unknown[]) => recordLLMUsage(...args),
}));

import { IMAGE_TIMEOUT_MS, llmEditImage, llmGenerateImage } from "../images";

describe("LiteLLM image helpers", () => {
  beforeEach(() => jest.clearAllMocks());

  it("generates non-streaming images with billing attribution and a 240s timeout", async () => {
    generate.mockResolvedValue({
      data: [{ b64_json: Buffer.from("generated").toString("base64") }],
      output_format: "webp",
      usage: {
        input_tokens: 10,
        output_tokens: 20,
        total_tokens: 30,
        input_tokens_details: { text_tokens: 10, image_tokens: 0 },
      },
    });

    await expect(
      llmGenerateImage({
        model: "openai/gpt-image-2",
        prompt: "product photo",
        feature: "synthetic-catalog-image-front",
      }),
    ).resolves.toEqual({
      data: Buffer.from("generated"),
      mimeType: "image/webp",
      revisedPrompt: undefined,
    });
    expect(buildBillingParams).toHaveBeenCalledWith({
      feature: "synthetic-catalog-image-front",
      accountId: undefined,
      brandId: undefined,
    });
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "openai/gpt-image-2",
        stream: false,
        user: expect.stringContaining("internal:"),
      }),
      { timeout: IMAGE_TIMEOUT_MS, maxRetries: 0 },
    );
    expect(recordLLMUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        feature: "synthetic-catalog-image-front",
        model: "openai/gpt-image-2",
        operation: "IMAGE_GENERATION",
        size: "1024x1536",
        quality: "medium",
      }),
    );
  });

  it("sends reference bytes through the non-streaming image edit endpoint", async () => {
    edit.mockResolvedValue({
      data: [{ b64_json: Buffer.from("edited").toString("base64") }],
      output_format: "webp",
    });
    await llmEditImage(
      {
        model: "openai/gpt-image-2",
        prompt: "same item from behind",
        feature: "synthetic-catalog-image-back",
      },
      { data: Buffer.from("reference"), mimeType: "image/webp" },
    );
    expect(edit).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "openai/gpt-image-2",
        stream: false,
        user: expect.stringContaining("internal:"),
        image: expect.any(File),
      }),
      {
        timeout: IMAGE_TIMEOUT_MS,
        maxRetries: 0,
        headers: {
          "x-litellm-spend-logs-metadata": JSON.stringify({
            app: "test-app",
            feature: "image",
          }),
        },
      },
    );
    expect(recordLLMUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        feature: "synthetic-catalog-image-back",
        model: "openai/gpt-image-2",
        operation: "IMAGE_EDIT",
      }),
    );
  });

  it("sends ordered multi-reference files with multipart spend metadata", async () => {
    edit.mockResolvedValue({ data: [{ b64_json: Buffer.from("edited-many").toString("base64") }], output_format: "webp" });
    await llmEditImage({ model: "openai/gpt-image-2", prompt: "complete look", feature: "synthetic-catalog-image-complete-look" }, [
      { data: Buffer.from("anchor-on-model"), mimeType: "image/webp" },
      { data: Buffer.from("anchor-front"), mimeType: "image/png" },
      { data: Buffer.from("companion"), mimeType: "image/jpeg" },
    ]);
    const body = edit.mock.calls[0]![0] as { image: File[] };
    expect(body.image).toHaveLength(3);
    expect(body.image.map((file) => file.name)).toEqual(["reference-01.webp", "reference-02.png", "reference-03.jpg"]);
    expect(edit.mock.calls[0]![1]).toMatchObject({ headers: { "x-litellm-spend-logs-metadata": expect.stringContaining("synthetic-catalog-image-complete-look") } });
    expect(recordLLMUsage).toHaveBeenCalledWith(expect.objectContaining({ feature: "synthetic-catalog-image-complete-look", operation: "IMAGE_EDIT" }));
  });
});
