import {
  isReferenceImageUnsupportedError,
  LiteLLMImageGenerator,
} from "../litellm-image-generator";

const result = { data: Buffer.from("image"), mimeType: "image/webp" };

describe("LiteLLMImageGenerator", () => {
  it("uses the reference edit endpoint and role-specific attribution", async () => {
    const edit = jest.fn().mockResolvedValue(result);
    const generate = jest.fn();
    const generator = new LiteLLMImageGenerator({ edit, generate });
    await expect(
      generator.generateImage({
        model: "openai/gpt-image-2",
        role: "BACK",
        prompt: "back view",
        reference: { data: Buffer.from("front"), mimeType: "image/webp", assetId: 3 },
      }),
    ).resolves.toEqual({ ...result, usedReference: true });
    expect(edit).toHaveBeenCalledWith(
      expect.objectContaining({ feature: "synthetic-catalog-image-back" }),
      { data: Buffer.from("front"), mimeType: "image/webp" },
    );
    expect(generate).not.toHaveBeenCalled();
  });

  it("falls back through the proxy generation endpoint only when edits are unsupported", async () => {
    const unsupported = Object.assign(new Error("image editing is not supported"), {
      code: "unsupported_operation",
    });
    const edit = jest.fn().mockRejectedValue(unsupported);
    const generate = jest.fn().mockResolvedValue(result);
    const generator = new LiteLLMImageGenerator({ edit, generate });
    await expect(
      generator.generateImage({
        model: "openai/gpt-image-2",
        role: "ON_MODEL",
        prompt: "model view",
        reference: { data: Buffer.from("front"), mimeType: "image/webp", assetId: 3 },
      }),
    ).resolves.toEqual({ ...result, usedReference: false });
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({ feature: "synthetic-catalog-image-on-model" }),
    );
  });

  it("retries transient proxy failures but not ordinary request errors", async () => {
    const generate = jest
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error("busy"), { status: 503 }))
      .mockResolvedValueOnce(result);
    const sleep = jest.fn().mockResolvedValue(undefined);
    const generator = new LiteLLMImageGenerator({
      generate,
      sleep,
      maxAttempts: 2,
      baseDelayMs: 20,
    });
    await generator.generateImage({
      model: "openai/gpt-image-2",
      role: "FRONT",
      prompt: "front",
    });
    expect(generate).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(20);

    const badRequest = Object.assign(new Error("bad prompt"), { status: 400 });
    const noRetry = jest.fn().mockRejectedValue(badRequest);
    await expect(
      new LiteLLMImageGenerator({ generate: noRetry }).generateImage({
        model: "openai/gpt-image-2",
        role: "FRONT",
        prompt: "front",
      }),
    ).rejects.toBe(badRequest);
    expect(noRetry).toHaveBeenCalledTimes(1);
  });

  it("recognizes only explicit unsupported-edit failures", () => {
    expect(isReferenceImageUnsupportedError({ code: "not_implemented" })).toBe(true);
    expect(isReferenceImageUnsupportedError(new Error("image edits are not supported"))).toBe(true);
    expect(isReferenceImageUnsupportedError({ status: 400, message: "invalid image" })).toBe(false);
  });
});
