/**
 * URL processing utilities for website review functionality
 */

/**
 * Validates if a string is a valid URL
 * @param urlString - The string to validate
 * @returns boolean indicating if the string is a valid URL
 */
export function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Extracts the base domain from a URL (without paths/slugs)
 * @param urlString - The full URL
 * @returns The base domain URL (e.g., "https://example.com")
 */
export function extractBaseDomain(urlString: string): string {
  if (!isValidUrl(urlString)) {
    throw new Error('Invalid URL provided');
  }
  
  const url = new URL(urlString);
  return `${url.protocol}//${url.hostname}`;
}

/**
 * Creates a sanitized string for use as primary_id from a URL
 * Removes www. prefix and converts to a clean string format
 * @param urlString - The URL to sanitize
 * @returns A clean string suitable for use as primary_id
 */
export function sanitizeUrlForPrimaryId(urlString: string): string {
  if (!isValidUrl(urlString)) {
    throw new Error('Invalid URL provided');
  }
  
  const url = new URL(urlString);
  let hostname = url.hostname;
  
  // Remove www. prefix if present
  if (hostname.startsWith('www.')) {
    hostname = hostname.substring(4);
  }
  
  // Return the sanitized hostname
  return hostname;
}

/**
 * Processes a URL for website review
 * @param inputUrl - The input URL string
 * @returns Object containing the processed URL data
 */
export function processUrlForReview(inputUrl: string): {
  isValid: boolean;
  baseDomainUrl: string;
  primaryId: string;
  error?: string;
} {
  try {
    if (!isValidUrl(inputUrl)) {
      return {
        isValid: false,
        baseDomainUrl: '',
        primaryId: '',
        error: 'Invalid URL format'
      };
    }
    
    const baseDomainUrl = extractBaseDomain(inputUrl);
    const primaryId = sanitizeUrlForPrimaryId(inputUrl);
    
    return {
      isValid: true,
      baseDomainUrl,
      primaryId
    };
  } catch (error) {
    return {
      isValid: false,
      baseDomainUrl: '',
      primaryId: '',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Creates a URL-friendly slug from a string
 * @param text - The text to convert to a slug
 * @returns A URL-friendly slug
 */
export function createSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/--+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Encodes a numeric ID to base64 for use in URLs
 * @param id - The numeric ID to encode
 * @returns Base64 encoded string
 */
export function encodePageId(id: string | number): string {
  return Buffer.from(id.toString()).toString('base64')
    .replace(/\+/g, '-') // Make URL-safe
    .replace(/\//g, '_') // Make URL-safe
    .replace(/=/g, ''); // Remove padding
}

/**
 * Decodes a base64 ID from a URL back to numeric ID
 * @param encoded - The base64 encoded ID
 * @returns The decoded numeric ID as a string
 */
export function decodePageId(encoded: string): string {
  if (!encoded || !/^[A-Za-z0-9_-]+$/.test(encoded)) {
    throw new Error('Invalid encoded page ID');
  }

  const padded = encoded
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(encoded.length + (4 - encoded.length % 4) % 4, '=');

  const decoded = Buffer.from(padded, 'base64').toString('utf-8');

  if (Buffer.from(decoded, 'utf-8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '') !== encoded) {
    throw new Error('Invalid encoded page ID');
  }

  return decoded;
}

/**
 * Creates a full page slug with encoded ID
 * Format: slug-text-encodedId
 * @param title - The page title
 * @param id - The page ID
 * @returns Full slug with encoded ID (e.g., "the-power-of-product-data-NjM")
 */
export function createPageSlug(title: string, id: string | number): string {
  const slug = createSlug(title);
  const encodedId = encodePageId(id);
  return slug ? `${slug}-${encodedId}` : encodedId;
}

/**
 * Extracts the page ID from a full slug
 * Handles both formats: "slug-text-encodedId" and "encodedId"
 * @param fullSlug - The full slug from the URL
 * @returns The decoded page ID
 */
export function extractPageIdFromSlug(fullSlug: string): string {
  // Split by hyphen and get the last segment (the encoded ID)
  const segments = fullSlug.split('-');
  const encodedId = segments[segments.length - 1];
  
  try {
    return decodePageId(encodedId);
  } catch (_error) {
    // If decoding fails, try the entire slug (might be just an encoded ID)
    return decodePageId(fullSlug);
  }
}
