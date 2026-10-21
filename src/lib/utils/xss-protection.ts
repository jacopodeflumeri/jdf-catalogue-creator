/**
 * XSS Protection Utilities
 * Client-side and server-side HTML sanitization
 */

import { sanitizeInput } from './security';
import logger from './logger';

/**
 * Client-side HTML sanitization (requires DOMPurify)
 * Install with: npm install dompurify @types/dompurify
 */
export async function sanitizeHTML(html: string, options?: any): Promise<string> {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    logger.warn('sanitizeHTML called on server-side, falling back to basic sanitization');
    return sanitizeHTMLServerSide(html);
  }

  try {
    // Dynamically import DOMPurify for client-side use
    // Note: This requires DOMPurify to be installed
    const DOMPurifyModule = await import('dompurify');
    const DOMPurify = DOMPurifyModule.default;
    
    const defaultOptions = {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'u', 'b', 'i', 'a', 'ul', 'ol', 'li',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code'
      ],
      ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
      ALLOW_DATA_ATTR: false,
      FORBID_SCRIPT: true,
      FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input', 'textarea'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'style']
    };

    const config = { ...defaultOptions, ...options };
    return DOMPurify.sanitize(html, config) as unknown as string;
  } catch (error) {
    logger.error('DOMPurify sanitization failed, falling back to basic sanitization:', error);
    return sanitizeHTMLServerSide(html);
  }
}

/**
 * Server-side HTML sanitization (basic)
 */
export function sanitizeHTMLServerSide(html: string): string {
  if (!html || typeof html !== 'string') return '';

  // Remove tags that must have their inner content stripped as well
  let sanitized = html;
  const contentBearingTags = ['script', 'style', 'iframe', 'object', 'form', 'textarea'];
  contentBearingTags.forEach(tag => {
    const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = '<' + escapedTag + '\\b[^>]*>[\\s\\S]*?<\\/' + escapedTag + '\\s*>';
    // eslint-disable-next-line security/detect-non-literal-regexp
    sanitized = sanitized.replace(new RegExp(pattern, 'gi'), '');
  });

  // Remove dangerous attributes
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, ''); // onclick, onload, etc.
  sanitized = sanitized.replace(/\s*javascript\s*:/gi, '');
  sanitized = sanitized.replace(/\s*data\s*:/gi, '');
  sanitized = sanitized.replace(/\s*vbscript\s*:/gi, '');

  // Remove any remaining dangerous tags (void elements and unclosed ones)
  const dangerousTags = ['script', 'object', 'embed', 'form', 'input', 'textarea', 'iframe', 'link', 'style'];
  dangerousTags.forEach(tag => {
    const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = '<\\/?' + escapedTag + '\\b[^>]*>';
    // eslint-disable-next-line security/detect-non-literal-regexp
    sanitized = sanitized.replace(new RegExp(pattern, 'gi'), '');
  });

  // Basic input sanitization (only if there's content left to sanitize)
  if (sanitized) {
    sanitized = sanitizeInput(sanitized);
  }

  return sanitized;
}

/**
 * Safe innerHTML replacement hook for React components
 */
export function useSafeHTML(html: string, options?: any) {
  const sanitizedHTML = sanitizeHTML(html, options);
  
  return {
    __html: sanitizedHTML
  };
}

/**
 * Validate URL for safety (prevent javascript:, data:, etc.)
 */
export function sanitizeURL(url: string): string {
  if (!url || typeof url !== 'string') return '';

  // Remove dangerous protocols
  const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:', 'ftp:'];
  const lowerUrl = url.toLowerCase().trim();
  
  for (const protocol of dangerousProtocols) {
    if (lowerUrl.startsWith(protocol)) {
      logger.warn('Dangerous URL protocol blocked:', url);
      return '';
    }
  }

  // Allow only http, https, mailto, tel
  const allowedProtocols = ['http:', 'https:', 'mailto:', 'tel:', '#', '/'];
  const hasValidProtocol = allowedProtocols.some(protocol => 
    lowerUrl.startsWith(protocol) || !url.includes(':')
  );

  if (!hasValidProtocol) {
    logger.warn('Invalid URL protocol blocked:', url);
    return '';
  }

  return url;
}

/**
 * Content Security Policy nonce generator
 */
export function generateCSPNonce(): string {
  if (typeof window !== 'undefined' && window.crypto) {
    const array = new Uint8Array(16);
    window.crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
  
  // Fallback for server-side
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * XSS detection patterns
 */
const XSS_PATTERNS = [
  /<script[^>]*>[\s\S]*?<\/script>/i,
  /javascript\s*:/i,
  /on\w+\s*=/i,
  /<iframe\b[^>]*>/i,
  /<object\b[^>]*>/i,
  /<embed\b[^>]*>/i,
  /data\s*:\s*text\/html/i,
  /vbscript\s*:/i
];

/**
 * Detect potential XSS in content
 */
export function detectXSS(content: string): boolean {
  if (!content || typeof content !== 'string') return false;

  return XSS_PATTERNS.some(pattern => pattern.test(content));
}

/**
 * Log XSS attempt
 */
export function logXSSAttempt(content: string, source: string, userInfo?: any) {
  logger.error('XSS attempt detected', {
    source,
    contentLength: content.length,
    userInfo,
    patterns: XSS_PATTERNS.filter(pattern => pattern.test(content)).length,
    timestamp: new Date().toISOString()
  });
}

const xssProtection = {
  sanitizeHTML,
  sanitizeHTMLServerSide,
  useSafeHTML,
  sanitizeURL,
  generateCSPNonce,
  detectXSS,
  logXSSAttempt
};

export default xssProtection;
