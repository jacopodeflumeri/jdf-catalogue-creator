/**
 * Security validation utilities for environment variables and configuration
 */

import logger from '@/lib/utils/logger';
import { config } from '@/config';

interface SecurityValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate that all required environment variables are set and secure
 */
export function validateEnvironmentSecurity(): SecurityValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const usesKeycloakInternalLogin = Boolean(
    config.keycloak.enabled &&
    config.keycloak.issuer &&
    config.keycloak.clientId &&
    config.keycloak.clientSecret
  );
  const usesAzureInternalLogin = Boolean(
    config.azure.clientId &&
    config.azure.clientSecret &&
    config.azure.tenantId
  );

  // Critical security environment variables
  const requiredSecrets = [
    { key: 'NEXTAUTH_SECRET', value: config.auth.secret },
  ];

  if (usesKeycloakInternalLogin) {
    requiredSecrets.push({ key: 'KEYCLOAK_CLIENT_SECRET', value: config.keycloak.clientSecret });
  } else if (usesAzureInternalLogin) {
    requiredSecrets.push({ key: 'AZURE_AD_CLIENT_SECRET', value: config.azure.clientSecret });
  } else {
    errors.push('Missing internal login configuration: provide either Azure AD or Keycloak credentials');
  }

  // Check required secrets exist
  for (const secret of requiredSecrets) {
    if (!secret.value) {
      errors.push(`Missing required secret: ${secret.key}`);
    } else if (secret.value.length < 32) {
      warnings.push(`Secret ${secret.key} appears too short (< 32 chars)`);
    }
  }

  // Check for insecure defaults
  if (config.auth.secret === 'your-secret-here' || config.auth.secret === 'development-secret') {
    errors.push('NEXTAUTH_SECRET is using default/insecure value');
  }

  // Validate production settings
  if (!config.app.isDevelopment) {
    if (config.app.url?.includes('localhost')) {
      errors.push('Production environment using localhost URL');
    }
    
    if (!config.app.url?.startsWith('https://')) {
      errors.push('Production environment not using HTTPS');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Sanitize string inputs to prevent injection attacks
 */
export function sanitizeInput(input: string, _allowedChars: RegExp = /^[a-zA-Z0-9\s\-_@.]+$/): string {
  if (!input || typeof input !== 'string') {
    throw new Error('Invalid input provided');
  }

  // Remove any non-allowed characters
  const sanitized = input.replace(/[^\w\s\-_@.]/g, '');
  
  // Check if input was modified (potential attack)
  if (sanitized !== input) {
    logger.warn('Input sanitization detected potential attack', {
      original: input,
      sanitized: sanitized,
      timestamp: new Date().toISOString()
    });
  }

  return sanitized.trim();
}

/**
 * Validate email addresses with security considerations
 */
export function validateSecureEmail(email: string): { isValid: boolean; error?: string } {
  if (!email || typeof email !== 'string') {
    return { isValid: false, error: 'Email is required' };
  }

  const sanitizedEmail = email.trim().toLowerCase();
  
  // Basic email format validation
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(sanitizedEmail)) {
    return { isValid: false, error: 'Invalid email format' };
  }

  // Security checks
  if (sanitizedEmail.includes('..')) {
    return { isValid: false, error: 'Invalid email format' };
  }

  if (sanitizedEmail.length > 254) {
    return { isValid: false, error: 'Email too long' };
  }

  // Check for suspicious patterns
  const suspiciousPatterns = [
    /javascript:/i,
    /<script/i,
    /onload=/i,
    /onerror=/i
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(email)) {
      logger.warn('Suspicious email pattern detected', { email: sanitizedEmail });
      return { isValid: false, error: 'Invalid email format' };
    }
  }

  return { isValid: true };
}

/**
 * Generate secure random tokens
 */
export function generateSecureToken(length: number = 32): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  
  return result;
}

/**
 * Rate limiting utility
 */
interface RateLimitConfig {
  windowMs: number;
  maxAttempts: number;
}

const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(key: string, config: RateLimitConfig): boolean {
  const now = Date.now();
  const existing = rateLimitStore.get(key);

  if (!existing || now > existing.resetTime) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.windowMs
    });
    return true;
  }

  if (existing.count >= config.maxAttempts) {
    return false;
  }

  existing.count++;
  return true;
}

/**
 * Validate file uploads
 */
export function validateFileUpload(file: any): { isValid: boolean; error?: string } {
  if (!file) {
    return { isValid: false, error: 'No file provided' };
  }

  // Size limit (50MB for files, matches S3FileUpload)
  const maxSize = 50 * 1024 * 1024;
  if (file.size > maxSize) {
    return { isValid: false, error: 'File too large (max 50MB)' };
  }

  // Allowed MIME types - expanded to match S3FileUpload component
  const allowedTypes = [
    // Images
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
    // Documents
    'application/pdf',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    // Archives
    'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
    // Media
    'video/mp4', 'video/avi', 'video/quicktime',
    'audio/mpeg', 'audio/wav', 'audio/mp3',
    // Data
    'text/csv', 'application/json'
  ];

  if (!allowedTypes.includes(file.type)) {
    return { isValid: false, error: `File type '${file.type}' not allowed` };
  }

  // Additional security: check for double extensions (must run before single-extension check)
  const fileName = file.name || '';
  const doubleExtension = /\.[a-zA-Z0-9]{1,4}\.(exe|bat|cmd|sh|php|asp|jsp|scr|vbs|js)$/i;
  if (doubleExtension.test(fileName)) {
    return { isValid: false, error: 'Suspicious file name detected' };
  }

  // Check for suspicious file extensions (security critical)
  const suspiciousExtensions = /\.(exe|bat|cmd|sh|php|asp|jsp|scr|vbs|js|jar|com|pif)$/i;
  if (suspiciousExtensions.test(fileName)) {
    return { isValid: false, error: 'File type not allowed for security reasons' };
  }

  return { isValid: true };
}

const securityUtils = {
  validateEnvironmentSecurity,
  sanitizeInput,
  validateSecureEmail,
  generateSecureToken,
  checkRateLimit,
  validateFileUpload
};

export default securityUtils;
