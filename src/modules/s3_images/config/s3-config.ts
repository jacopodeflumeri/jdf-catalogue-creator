/**
 * AWS S3 Configuration
 */

import { env } from '@/config/env';
import { S3_PREFIXES } from './prefixes';

export const S3_CONFIG = {
  // AWS Configuration
  region: env.S3_REGION,
  accessKeyId: env.S3_ACCESS_KEY_ID,
  secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  
  // S3 Bucket Configuration
  bucket: env.S3_BUCKET_NAME,
  
  // Key prefixes within the bucket.
  //
  // Derived from S3_PREFIXES so the literal strings cannot drift from the
  // access levels declared alongside them — the read rules and the write
  // destinations have to describe the same set of prefixes.
  paths: Object.fromEntries(
    Object.entries(S3_PREFIXES).map(([name, policy]) => [name, policy.prefix])
  ) as Record<keyof typeof S3_PREFIXES, string>,
  
  // Image processing settings
  imageProcessing: {
    // Maximum file size (100MB)
    maxFileSize: env.S3_MAX_FILE_SIZE * 1024 * 1024, // Convert to bytes
    
    // Allowed MIME types
    allowedTypes: [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/webp',
      'image/gif',
      'image/svg+xml'
    ],
    
    // Image quality settings
    quality: {
      webp: 85,      // Primary format - high quality for modern browsers
      jpeg: 70,      // Fallback format - lower quality when WebP is available
      jpegPrimary: 90, // High quality when JPEG is the primary format (no WebP)
      png: 9         // Maximum compression (lossless - always use 9)
    },
    
    // Automatic variants to generate
    variants: {
      thumbnail: { width: 150, height: 150, fit: 'cover' as const },
      small: { width: 300, height: 300, fit: 'inside' as const },
      medium: { width: 600, height: 600, fit: 'inside' as const },
      large: { width: 1200, height: 1200, fit: 'inside' as const },
    }
  },
  
  // CDN Configuration (CloudFront)
  cdn: {
    enabled: !!env.CLOUDFRONT_DOMAIN,
    domain: env.CLOUDFRONT_DOMAIN,
  },
  
  // Presigned URL settings
  presignedUrl: {
    expiresIn: 3600, // 1 hour
  }
} as const;

// Common placeholder values that indicate S3 is not properly configured
const PLACEHOLDER_VALUES = [
  'your-aws-access-key-id',
  'your-aws-secret-access-key', 
  'your-s3-bucket-name',
  'your-region',
  'placeholder',
  'example',
  'dummy',
  'test',
  'changeme',
  'replace-me',
  'your-key-here',
  'enter-your-key',
];

// Validation
export function validateS3Config(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!S3_CONFIG.accessKeyId) {
    errors.push('S3_ACCESS_KEY_ID environment variable is required');
  } else if (PLACEHOLDER_VALUES.includes(S3_CONFIG.accessKeyId.toLowerCase())) {
    errors.push('S3_ACCESS_KEY_ID contains placeholder value - please set your actual AWS access key');
  }
  
  if (!S3_CONFIG.secretAccessKey) {
    errors.push('S3_SECRET_ACCESS_KEY environment variable is required');
  } else if (PLACEHOLDER_VALUES.includes(S3_CONFIG.secretAccessKey.toLowerCase())) {
    errors.push('S3_SECRET_ACCESS_KEY contains placeholder value - please set your actual AWS secret key');
  }
  
  if (!S3_CONFIG.bucket) {
    errors.push('S3_BUCKET_NAME environment variable is required');
  } else if (PLACEHOLDER_VALUES.includes(S3_CONFIG.bucket.toLowerCase())) {
    errors.push('S3_BUCKET_NAME contains placeholder value - please set your actual S3 bucket name');
  }
  
  if (!S3_CONFIG.region) {
    errors.push('S3_REGION environment variable is required');
  } else if (PLACEHOLDER_VALUES.includes(S3_CONFIG.region.toLowerCase())) {
    errors.push('S3_REGION contains placeholder value - please set your actual AWS region');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Check if S3 is available/configured
export function isS3Available(): boolean {
  const validation = validateS3Config();
  return validation.isValid;
}

// Environment-specific overrides
export const getS3Config = () => {
  const baseConfig = { ...S3_CONFIG };
  
  // Use the bucket name as-is from environment variables
  // No environment prefix needed since we're using the same bucket for all environments
  
  return baseConfig;
};
