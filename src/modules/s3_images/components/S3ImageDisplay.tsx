'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import type { S3Image } from '../types';
import Loading from '@/components/ui/Loading';
import { logger } from '@/lib/utils/logger';

interface S3ImageDisplayProps {
  s3Image?: S3Image | null;
  alt: string;
  fill?: boolean;
  width?: number;
  height?: number;
  className?: string;
  fallback?: React.ReactNode;
  priority?: boolean;
}

/**
 * Detect WebP support in the browser
 */
function checkWebPSupport(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Check if browser supports WebP
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  
  // Try to export as WebP
  return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
}

/**
 * Get the optimal image URL based on browser support and available formats
 */
function getOptimalImageUrl(s3Image: S3Image): string {
  // If formats are available, choose the best one
  if (s3Image.formats) {
    const supportsWebP = checkWebPSupport();
    
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
 * Extract S3 key from URL for presigned URL generation
 */
function extractKeyFromUrl(url: string, s3Image: S3Image): string {
  // If we have the original key, try to derive the format-specific key
  if (s3Image.key) {
    // Check if URL is WebP format
    if (url.includes('.webp')) {
      return s3Image.key.replace(/\.(jpe?g|png)$/i, '.webp');
    }
    // Check if URL is JPEG format
    if (url.includes('.jpg') || url.includes('.jpeg')) {
      return s3Image.key.replace(/\.(webp|png)$/i, '.jpg');
    }
  }
  
  // Fallback: try to extract from URL
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    return pathname.startsWith('/') ? pathname.substring(1) : pathname;
  } catch {
    // If URL parsing fails, return original key or empty string
    return s3Image.key || '';
  }
}

/**
 * S3ImageDisplay - Handles secure display of S3Images with presigned URLs
 * 
 * This component automatically generates presigned URLs for S3 images
 * to ensure secure access without requiring public bucket permissions.
 */
export default function S3ImageDisplay({
  s3Image,
  alt,
  fill,
  width,
  height,
  className,
  fallback,
  priority
}: S3ImageDisplayProps) {
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function getPresignedUrl() {
      if (!s3Image) {
        setDisplayUrl(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(false);

        // Get optimal format URL based on browser support
        const optimalUrl = getOptimalImageUrl(s3Image);
        
        // If we have a key, try to get presigned URL for the optimal format
        if (s3Image.key) {
          // Extract the key for the optimal format
          const optimalKey = extractKeyFromUrl(optimalUrl, s3Image);
          
          const response = await fetch(`/api/images/${optimalKey}`);
          if (response.ok) {
            const data = await response.json();
            setDisplayUrl(data.url);
            setLoading(false);
            return;
          }
        }
        
        // Fallback to optimal URL directly (for public URLs)
        setDisplayUrl(optimalUrl);
      } catch (err) {
        logger.warn('Failed to get presigned URL:', err);
        // Final fallback to primary URL
        setDisplayUrl(s3Image.url);
        setError(true);
      } finally {
        setLoading(false);
      }
    }

    getPresignedUrl();
  }, [s3Image]);

  // Show loading state while fetching presigned URL
  if (loading) {
    return (

      <div className={`${className} flex items-center justify-center bg-gray-50 animate-pulse h-full`}>
        <Loading size="sm" text="" />
      </div>
    );
  }

  // Show fallback if no URL or if there was an error
  if (!displayUrl || error) {
    return <>{fallback}</> || null;
  }

  // Build image props with explicit undefined handling for exactOptionalPropertyTypes
  const imageAlt = alt || "";
  const baseProps = {
    src: displayUrl,
    ...(className !== undefined && { className }),
    ...(priority !== undefined && { priority })
  };

  // Handle fill vs width/height separately to satisfy TypeScript
  if (fill) {
    return <Image {...baseProps} alt={imageAlt} fill />;
  }

  // Only include width/height if they're defined
  const sizedProps = {
    ...baseProps,
    ...(width !== undefined && { width }),
    ...(height !== undefined && { height })
  };

  return <Image {...sizedProps} alt={imageAlt} />;
}