/**
 * Image utility functions for S3 image handling
 */

import type { S3Image } from "../types";
import type { JsonValue } from "@prisma/client/runtime/client";
import { S3_CONFIG } from "../config/s3-config";
import { logger } from "@/lib/utils/logger";

/**
 * Ensure image object is in S3Image format
 * Handles both string URLs and S3Image objects
 */
export function normalizeImageToS3Format(
  image: string | S3Image,
): S3Image | null {
  if (!image) return null;

  // If it's a string URL, create a minimal S3Image object
  if (typeof image === "string") {
    return {
      url: image,
      access: "public",
    };
  }

  // Return the S3Image object as-is
  return image;
}

/**
 * Get the display URL from an image object or string
 */
export function getImageUrl(
  image: string | S3Image | null | undefined,
): string {
  if (!image) return "";

  if (typeof image === "string") {
    return image;
  }

  return image.url;
}

/**
 * Create an S3Image object from URL and metadata
 */
export function createS3Image(
  url: string,
  options?: Partial<Omit<S3Image, "url">>,
): S3Image {
  return {
    url,
    access: "public",
    ...options,
  };
}

/**
 * Check if an image object is in the S3Image format
 */
export function isS3Image(image: any): image is S3Image {
  return image && typeof image === "object" && typeof image.url === "string";
}

/**
 * Generate responsive image variants for S3Image
 */
export function addImageVariants(
  baseUrl: string,
  variants: Record<string, string>,
): S3Image {
  return {
    url: baseUrl,
    access: "public",
    variants,
  };
}

/**
 * Create S3Image from file upload data
 */
export function createS3ImageFromUpload(
  url: string,
  file: File,
  bucket?: string,
  key?: string,
): S3Image {
  return {
    url,
    bucket,
    key,
    name: file.name,
    type: file.type,
    size: file.size,
    access: "public",
    metadata: {
      uploadedAt: new Date().toISOString(),
      width: undefined, // To be filled by image processing
      height: undefined, // To be filled by image processing
      format: file.type.split("/")[1],
    },
  };
}

// ===== PRISMA CONVERSION UTILITIES =====

/**
 * Convert an image URL string to S3Image object
 */
export function stringToS3Image(
  url: string | null | undefined,
): S3Image | null {
  if (!url || typeof url !== "string") {
    return null;
  }

  // If it's already an S3 URL, parse it
  if (url.includes("s3.amazonaws.com") || url.includes("amazonaws.com")) {
    const urlParts = url.split("/");
    const key = urlParts.slice(-2).join("/"); // Get last two parts as key
    const bucket = S3_CONFIG.bucket || "default-bucket";

    return {
      url,
      bucket,
      key,
      access: "public" as const,
      metadata: {
        uploadedAt: new Date().toISOString(),
      },
    };
  }

  // Create a basic S3Image object
  return {
    url,
    access: "public" as const,
    metadata: {
      uploadedAt: new Date().toISOString(),
    },
  };
}

/**
 * Convert S3Image object to Prisma JsonValue for database storage
 */
export function s3ImageToJson(s3Image: S3Image | null | undefined): JsonValue {
  if (!s3Image) {
    return null;
  }
  return s3Image as unknown as JsonValue;
}

/**
 * Convert Prisma JsonValue to S3Image object
 */
export function jsonToS3Image(
  jsonValue: JsonValue | null | undefined,
): S3Image | null {
  if (!jsonValue || typeof jsonValue !== "object" || Array.isArray(jsonValue)) {
    return null;
  }

  const obj = jsonValue as Record<string, unknown>;

  // Validate that it has the required S3Image structure
  if (typeof obj["url"] === "string") {
    return obj as unknown as S3Image;
  }

  return null;
}

/**
 * Convert image data to S3Image format for API responses
 * Handles the transformation of database JsonValue to proper S3Image objects
 */
export function transformImageForResponse(
  imageData: JsonValue | null | undefined,
): S3Image | null {
  if (!imageData) {
    return null;
  }

  // If it's already a proper S3Image object
  if (
    typeof imageData === "object" &&
    !Array.isArray(imageData) &&
    imageData !== null
  ) {
    const obj = imageData as Record<string, unknown>;
    if (typeof obj["url"] === "string") {
      return obj as unknown as S3Image;
    }
  }

  // If it's a string URL, convert it
  if (typeof imageData === "string") {
    return stringToS3Image(imageData);
  }

  return null;
}

/**
 * Handle mixed image input - can be string URL or S3Image object
 */
export function normalizeImageInput(
  input: string | S3Image | null | undefined,
): S3Image | null {
  if (!input) {
    return null;
  }

  if (typeof input === "string") {
    return stringToS3Image(input);
  }

  return input;
}

/**
 * Get a presigned URL for S3Image display (client-side safe)
 */
export async function getImageDisplayUrl(
  s3Image: S3Image | null | undefined,
): Promise<string | null> {
  if (!s3Image?.key) {
    return s3Image?.url || null;
  }

  try {
    const response = await fetch(`/api/images/${s3Image.key}`);
    if (response.ok) {
      const data = await response.json();
      return data.url;
    }

    // Fallback to original URL if API fails
    return s3Image.url;
  } catch (error) {
    logger.warn("Failed to get presigned URL, using original:", error);
    return s3Image.url;
  }
}
