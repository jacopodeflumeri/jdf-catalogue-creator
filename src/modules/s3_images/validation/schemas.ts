/**
 * Zod validation schemas for S3 operations
 */

import { z } from 'zod';

// ====================================
// S3 OBJECT SCHEMAS
// ====================================

/**
 * S3Image schema for validation - STRICT S3Image only
 */
export const s3ImageSchema = z.object({
  key: z.string().min(1, 'S3 key is required'),
  url: z.string().url('Invalid S3 URL'),
  size: z.number().positive('File size must be positive'),
  type: z.string().min(1, 'Content type is required'),
  lastModified: z.date().optional(),
  etag: z.string().optional()
});

/**
 * Image field validation - ONLY accepts proper S3Image objects (no string fallbacks)
 */
export const imageFieldSchema = s3ImageSchema.nullable().optional();

/**
 * S3File schema for validation
 */
export const s3FileSchema = z.object({
  key: z.string().min(1, 'S3 key is required'),
  url: z.string().url('Invalid S3 URL'),
  size: z.number().positive('File size must be positive'),
  type: z.string().min(1, 'Content type is required'),
  name: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

/**
 * File field validation
 */
export const fileFieldSchema = s3FileSchema.nullable().optional();

// ====================================
// UPLOAD VALIDATION SCHEMAS
// ====================================

/**
 * Upload options validation
 */
export const uploadOptionsSchema = z.object({
  path: z.enum(['content', 'mappTeam', 'temp']).optional(),
  generateVariants: z.boolean().optional(),
  metadata: z.record(z.string(), z.string()).optional()
});

/**
 * File upload validation
 */
export const fileUploadSchema = z.object({
  file: z.instanceof(File),
  options: uploadOptionsSchema.optional()
});

// ====================================
// PRESIGNED URL SCHEMAS
// ====================================

/**
 * Presigned URL parameters validation
 */
export const presignedUrlParamsSchema = z.object({
  key: z.string().min(1, 'S3 key is required'),
  expiresIn: z.number().positive().optional(),
  responseContentDisposition: z.string().optional()
});

// ====================================
// TYPE EXPORTS
// ====================================

export type S3ImageValidation = z.infer<typeof s3ImageSchema>;
export type S3FileValidation = z.infer<typeof s3FileSchema>;
export type UploadOptionsValidation = z.infer<typeof uploadOptionsSchema>;
export type PresignedUrlParamsValidation = z.infer<typeof presignedUrlParamsSchema>;
