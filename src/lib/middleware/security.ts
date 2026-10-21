/**
 * Security middleware for API routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, validateSecureEmail, sanitizeInput } from '@/lib/utils/security';
import { validateOrigin, isCSRFProtectedMethod, logCSRFAttempt, createCSRFErrorResponse, getClientIP } from '@/lib/utils/csrf-protection';
import logger from '@/lib/utils/logger';

interface SecurityConfig {
  rateLimit?: {
    windowMs: number;
    maxAttempts: number;
  };
  requireAuth?: boolean;
  allowedMethods?: string[];
  maxBodySize?: number;
  enableCSRF?: boolean; // New option to enable/disable CSRF protection
}

/**
 * Security middleware wrapper for API routes
 */
export function withSecurity(config: SecurityConfig = {}) {
  return function (handler: (req: NextRequest) => Promise<NextResponse>) {
    return async function secureHandler(req: NextRequest): Promise<NextResponse> {
      try {
        const clientIp = getClientIP(req);
        
        // Method validation
        if (config.allowedMethods && !config.allowedMethods.includes(req.method)) {
          logger.warn('Method not allowed', { method: req.method, ip: clientIp });
          return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
        }

        // CSRF Protection (enabled by default for state-changing methods)
        const shouldCheckCSRF = config.enableCSRF !== false && isCSRFProtectedMethod(req.method);
        if (shouldCheckCSRF) {
          if (!validateOrigin(req)) {
            logCSRFAttempt(req, 'Origin validation failed');
            return NextResponse.json(createCSRFErrorResponse(), { status: 403 });
          }
        }

        // Rate limiting
        if (config.rateLimit) {
          const rateLimitKey = `${clientIp}:${req.nextUrl.pathname}`;
          if (!checkRateLimit(rateLimitKey, config.rateLimit)) {
            logger.warn('Rate limit exceeded', { ip: clientIp, path: req.nextUrl.pathname });
            return NextResponse.json(
              { error: 'Rate limit exceeded' }, 
              { 
                status: 429,
                headers: {
                  'Retry-After': String(Math.ceil(config.rateLimit.windowMs / 1000))
                }
              }
            );
          }
        }

        // Body size validation
        if (config.maxBodySize && req.method !== 'GET') {
          const contentLength = req.headers.get('content-length');
          if (contentLength && parseInt(contentLength) > config.maxBodySize) {
            return NextResponse.json({ error: 'Request too large' }, { status: 413 });
          }
        }

        // Security headers validation
        const userAgent = req.headers.get('user-agent');
        if (!userAgent || userAgent.length > 500) {
          logger.warn('Suspicious user agent', { userAgent, ip: clientIp });
        }

        // Execute the handler
        return await handler(req);

      } catch (error) {
        logger.error('Security middleware error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }
    };
  };
}

/**
 * Input validation middleware
 */
export function validateApiInput(_schema: any) {
  return function (data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Basic validation
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        try {
          // Sanitize string inputs
          const sanitized = sanitizeInput(value as string);
          if (sanitized !== value) {
            errors.push(`Invalid characters in field: ${key}`);
          }
        } catch (_error) {
          errors.push(`Invalid input in field: ${key}`);
        }
      }
    }

    // Email validation
    if (data.email) {
      const emailValidation = validateSecureEmail(data.email);
      if (!emailValidation.isValid) {
        errors.push(emailValidation.error || 'Invalid email');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  };
}

const securityMiddleware = {
  withSecurity,
  validateApiInput
};

export default securityMiddleware;
