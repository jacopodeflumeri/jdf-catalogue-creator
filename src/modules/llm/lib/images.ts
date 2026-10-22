import { toFile } from "openai";
import { buildBillingParams, getLLMClient } from "./client";
import type { LLMImageParams, LLMImageResult, LLMImageSource } from "./types";

const IMAGE_TIMEOUT_MS = 240_000;
export const MAX_IMAGE_EDIT_REFERENCES = 8;

function mimeTypeForFormat(format: LLMImageParams["outputFormat"]): string {
  return `image/${format === "jpeg" ? "jpeg" : format ?? "webp"}`;
}

async function normalizeImageResponse(
  response: {
    data?: Array<{ b64_json?: string; url?: string; revised_prompt?: string }>;
    output_format?: "png" | "webp" | "jpeg";
  },
  requestedFormat: LLMImageParams["outputFormat"],
): Promise<LLMImageResult> {
  const image = response.data?.[0];
  if (!image) throw new Error("LiteLLM returned no generated image");

  const mimeType = mimeTypeForFormat(response.output_format ?? requestedFormat);
  if (image.b64_json) {
    const data = Buffer.from(image.b64_json, "base64");
    if (data.length === 0) throw new Error("LiteLLM returned an empty generated image");
    return { data, mimeType, revisedPrompt: image.revised_prompt };
  }

  if (image.url) {
    const downloaded = await fetch(image.url, {
      signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
    });
    if (!downloaded.ok) {
      throw new Error(`Failed to download generated image (${downloaded.status})`);
    }
    const data = Buffer.from(await downloaded.arrayBuffer());
    if (data.length === 0) throw new Error("LiteLLM returned an empty generated image");
    return {
      data,
      mimeType: downloaded.headers.get("content-type")?.split(";")[0] || mimeType,
      revisedPrompt: image.revised_prompt,
    };
  }

  throw new Error("LiteLLM image response contained neither bytes nor a URL");
}

/** Generate one non-streaming image through the Mapp LiteLLM proxy. */
export async function llmGenerateImage(params: LLMImageParams): Promise<LLMImageResult> {
  const {
    feature,
    accountId,
    brandId,
    model,
    prompt,
    size = "1024x1536",
    quality = "medium",
    outputFormat = "webp",
  } = params;
  const response = await getLLMClient().images.generate(
    {
      model,
      prompt,
      n: 1,
      size,
      quality,
      output_format: outputFormat,
      stream: false,
      ...buildBillingParams({ feature, accountId, brandId }),
    } as any,
    { timeout: IMAGE_TIMEOUT_MS, maxRetries: 0 },
  );
  const { recordLLMUsage } = await import("./usage-recorder");
  await recordLLMUsage({
    requestId: "_request_id" in response ? String(response._request_id || "") : null,
    feature,
    model,
    operation: "IMAGE_GENERATION",
    usage: response.usage,
    size,
    quality,
  });
  return normalizeImageResponse(response, outputFormat);
}

/** Edit one reference image through the proxy, preserving the same attribution. */
export async function llmEditImage(
  params: LLMImageParams,
  source: LLMImageSource | readonly LLMImageSource[],
): Promise<LLMImageResult> {
  const {
    feature,
    accountId,
    brandId,
    model,
    prompt,
    size = "1024x1536",
    quality = "medium",
    outputFormat = "webp",
  } = params;
  const sources = Array.isArray(source) ? source : [source];
  if (sources.length === 0 || sources.length > MAX_IMAGE_EDIT_REFERENCES) {
    throw new Error(`Image edits require between 1 and ${MAX_IMAGE_EDIT_REFERENCES} references`);
  }
  const files = await Promise.all(sources.map(async (item, index) => {
    const extension = item.mimeType === "image/jpeg" ? "jpg" : item.mimeType.split("/")[1] || "webp";
    return toFile(item.data, `reference-${String(index + 1).padStart(2, "0")}.${extension}`, { type: item.mimeType });
  }));
  const image = files.length === 1 ? files[0] : files;
  const billing = buildBillingParams({ feature, accountId, brandId });
  const response = await getLLMClient().images.edit(
    {
      model,
      image,
      prompt,
      n: 1,
      size,
      quality,
      output_format: outputFormat,
      stream: false,
      // images.edit is multipart. Sending LiteLLM's nested metadata as a form
      // field is forwarded to OpenAI and rejected as an unknown parameter, so
      // keep the supported upstream `user` field in the body and carry custom
      // spend metadata through LiteLLM's dedicated header instead.
      user: billing.user,
    } as any,
    {
      timeout: IMAGE_TIMEOUT_MS,
      maxRetries: 0,
      headers: {
        "x-litellm-spend-logs-metadata": JSON.stringify(
          billing.metadata.spend_logs_metadata,
        ),
      },
    },
  );
  const { recordLLMUsage } = await import("./usage-recorder");
  await recordLLMUsage({
    requestId: "_request_id" in response ? String(response._request_id || "") : null,
    feature,
    model,
    operation: "IMAGE_EDIT",
    usage: response.usage,
    size,
    quality,
  });
  return normalizeImageResponse(response, outputFormat);
}

export { IMAGE_TIMEOUT_MS };
