/**
 * Image optimization utilities for WebP support and format selection
 */

import type { S3Image } from '../types';

/**
 * Detect WebP support from User-Agent header (server-side)
 */
export function detectWebPSupportFromHeaders(headers: Headers): boolean {
  const accept = headers.get('accept') || '';
  return accept.includes('image/webp');
}

/**
 * Get optimal image URL based on client capabilities
 */
export function getOptimalImageUrl(s3Image: S3Image, supportsWebP: boolean = true): string {
  // If formats are available, choose the best one
  if (s3Image.formats) {
    if (supportsWebP && s3Image.formats.webp) {
      return s3Image.formats.webp;
    }
    
    if (s3Image.formats.jpeg) {
      return s3Image.formats.jpeg;
    }
    
    if (s3Image.formats.original) {
      return s3Image.formats.original;
    }
  }
  
  // Fallback to primary URL
  return s3Image.url;
}

/**
 * Get image format statistics for monitoring
 */
export function getImageFormatStats(s3Image: S3Image): {
  hasWebP: boolean;
  hasJPEG: boolean;
  hasOriginal: boolean;
  primaryFormat: string;
  formatCount: number;
} {
  const formats = s3Image.formats || {};
  
  return {
    hasWebP: !!formats.webp,
    hasJPEG: !!formats.jpeg,
    hasOriginal: !!formats.original,
    primaryFormat: s3Image.type || 'unknown',
    formatCount: Object.keys(formats).length,
  };
}

/**
 * Estimate bandwidth savings from WebP usage
 */
export function estimateWebPSavings(originalSize: number): {
  webpSize: number;
  savings: number;
  savingsPercent: number;
} {
  // WebP typically saves 25-35% compared to JPEG
  const averageSavings = 0.30; // 30% average
  const webpSize = Math.round(originalSize * (1 - averageSavings));
  const savings = originalSize - webpSize;
  const savingsPercent = Math.round((savings / originalSize) * 100);
  
  return {
    webpSize,
    savings,
    savingsPercent,
  };
}

/**
 * Check if image should be converted to WebP
 */
export function shouldConvertToWebP(mimeType: string, fileSize: number): boolean {
  // Only convert photographs and complex images
  const supportedTypes = ['image/jpeg', 'image/png'];
  
  // Skip very small images (< 5KB) - overhead not worth it
  const minSize = 5 * 1024; // 5KB
  
  // Skip very large images (> 5MB) - processing time too long
  const maxSize = 5 * 1024 * 1024; // 5MB
  
  return supportedTypes.includes(mimeType) && 
         fileSize >= minSize && 
         fileSize <= maxSize;
}
