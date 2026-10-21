import type { S3PathName } from '../config/prefixes';
/**
 * S3 Images Module - Type Definitions
 * All S3-related types for the application
 */

// ====================================
// BASE S3 TYPES
// ====================================

/**
 * Base interface for all S3 stored objects
 */
export interface S3Object {
  url: string; // The full S3 URL (public or presigned)
  bucket?: string; // S3 bucket name
  key?: string; // S3 object key/path
  name?: string; // Original filename
  type?: string; // MIME type
  size?: number; // File size in bytes
  metadata?: {
    uploadedAt?: string;
    uploadedBy?: string;
    originalName?: string;
    userAgent?: string;
    [key: string]: unknown;
  };
  access?: 'public' | 'private'; // Access level
}

/**
 * S3 Image type - Extends S3Object with image-specific properties
 */
export interface S3Image extends S3Object {
  alt?: string; // Alt text for accessibility
  metadata?: S3Object['metadata'] & {
    width?: number;
    height?: number;
    format?: string;
  };
  variants?: {
    [size: string]: string; // Allow custom size variants like thumbnail, medium, large
  };
  formats?: {
    webp?: string; // WebP format URL for modern browsers
    jpeg?: string; // JPEG fallback URL for compatibility
    png?: string; // PNG fallback URL if needed
    original?: string; // Original format URL
  };
}

/**
 * S3 File type - Extends S3Object for non-image files
 */
export interface S3File extends S3Object {
  metadata?: S3Object['metadata'] & {
    fileType?: 'pdf' | 'ppt' | 'doc' | 'other';
    category?: string;
    description?: string;
  };
}

// ====================================
// UPLOAD TYPES
// ====================================

/**
 * Options for uploading images to S3
 */
export interface UploadImageOptions {
  path?: S3PathName;
  generateVariants?: boolean;
  metadata?: Record<string, string>;
}

/**
 * Options for uploading files to S3
 */
export interface UploadFileOptions {
  path?: S3PathName;
  metadata?: Record<string, string>;
}

/**
 * Result from an S3 upload operation
 */
export interface UploadResult {
  success: boolean;
  url?: string;
  key?: string;
  size?: number;
  error?: string;
}

// ====================================
// IMAGE VARIANT TYPES
// ====================================

/**
 * Image variant size options
 */
export type ImageVariant = 'thumbnail' | 'small' | 'medium' | 'large' | 'original';

/**
 * Configuration for image variants
 */
export interface ImageVariantConfig {
  width: number;
  height: number;
  fit: 'cover' | 'inside' | 'outside' | 'contain';
}

// ====================================
// S3 SERVICE TYPES
// ====================================

/**
 * Configuration for S3 service
 */
export interface S3ServiceConfig {
  bucket: string;
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  cdnDomain?: string;
}

/**
 * Parameters for generating presigned URLs
 */
export interface PresignedUrlParams {
  key: string;
  expiresIn?: number;
  responseContentDisposition?: string;
}
