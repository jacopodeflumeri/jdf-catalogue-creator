/**
 * CSRF Protection Utilities
 * Provides origin validation and CSRF protection for API routes
 */

import { NextRequest } from 'next/server';
import { config } from '@/config';
import logger from '@/lib/utils/logger';

/**
 * Validate request origin to prevent CSRF attacks
 * Checks Origin and Referer headers against allowed origins
 */
export function validateOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const host = request.headers.get('host');
  
  // Get allowed origins from environment or build from current host
  const allowedOrigins = getAllowedOrigins(host);
  
  // Log the validation attempt for debugging
  logger.log('CSRF Origin Validation', {
    origin,
    referer,
    host,
    allowedOrigins,
    userAgent: request.headers.get('user-agent')
  });
  
  // Check Origin header (most reliable for CORS requests)
  if (origin) {
    const isOriginAllowed = allowedOrigins.some(allowed => origin === allowed);
    if (!isOriginAllowed) {
      logger.warn('CSRF: Invalid origin detected', {
        origin,
        allowedOrigins,
        ip: getClientIP(request)
      });
      return false;
    }
    return true;
  }
  
  // Fallback to Referer header if Origin is missing (older browsers/same-origin requests)
  if (referer) {
    const isRefererAllowed = allowedOrigins.some(allowed => {
      try {
        const refererUrl = new URL(referer);
        const allowedUrl = new URL(allowed);
        return refererUrl.origin === allowedUrl.origin;
      } catch {
        return false;
      }
    });
    
    if (!isRefererAllowed) {
      logger.warn('CSRF: Invalid referer detected', {
        referer,
        allowedOrigins,
        ip: getClientIP(request)
      });
      return false;
    }
    return true;
  }
  
  // Reject if neither Origin nor Referer is present (suspicious)
  logger.warn('CSRF: Missing Origin and Referer headers', {
    headers: Object.fromEntries(request.headers.entries()),
    ip: getClientIP(request)
  });
  return false;
}

/**
 * Get allowed origins for the application
 */
function getAllowedOrigins(host: string | null): string[] {
  const origins: string[] = [];
  
  // Add configured app URL
  if (config.app.url) {
    origins.push(config.app.url);
  }
  
  // Add current host with HTTPS and HTTP (for development)
  if (host) {
    origins.push(`https://${host}`);
    
    // Add HTTP for development environments
    if (config.app.isDevelopment || host.includes('localhost') || host.includes('127.0.0.1')) {
      origins.push(`http://${host}`);
    }
  }
  
  // Add additional allowed origins from environment
  if (config.security.allowedOrigins.length > 0) {
    origins.push(...config.security.allowedOrigins);
  }
  
  // Remove duplicates and filter out empty values
  return [...new Set(origins)].filter(Boolean);
}

/**
 * Extract client IP address from request
 */
export function getClientIP(request: NextRequest): string {
  // Check various headers for client IP
  const xForwardedFor = request.headers.get('x-forwarded-for');
  const xRealIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip'); // Cloudflare
  
  if (xForwardedFor) {
    // X-Forwarded-For can contain multiple IPs, take the first one
    return xForwardedFor.split(',')[0].trim();
  }
  
  if (xRealIP) {
    return xRealIP;
  }
  
  if (cfConnectingIP) {
    return cfConnectingIP;
  }
  
  // Fallback to unknown if no IP headers found
  return 'unknown';
}

/**
 * Validate that request method is allowed for CSRF-protected endpoints
 * Only state-changing methods need CSRF protection
 */
export function isCSRFProtectedMethod(method: string): boolean {
  const protectedMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  return protectedMethods.includes(method.toUpperCase());
}

/**
 * Log CSRF attack attempt with relevant details
 */
export function logCSRFAttempt(request: NextRequest, reason: string): void {
  logger.warn('CSRF Attack Detected', {
    reason,
    method: request.method,
    url: request.url,
    origin: request.headers.get('origin'),
    referer: request.headers.get('referer'),
    userAgent: request.headers.get('user-agent'),
    ip: getClientIP(request),
    timestamp: new Date().toISOString()
  });
}

/**
 * Create a standardized CSRF error response
 */
export function createCSRFErrorResponse() {
  return {
    error: 'Invalid request origin',
    message: 'This request appears to be from an unauthorized source.',
    code: 'CSRF_VALIDATION_FAILED'
  };
}