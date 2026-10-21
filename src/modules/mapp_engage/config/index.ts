/**
 * Mapp Engage Module - Configuration
 * Environment-based configuration for Mapp Engage integration
 */

import logger from '@/lib/utils/logger';
import type { MappEngageConfig } from '../types';

// Base configuration from environment variables
export const mappEngageConfig: MappEngageConfig = {
  baseUrl: process.env.ENGAGE_BASE_URL || '',
  authToken: process.env.ENGAGE_AUTH_TOKEN || '',
  groupId: process.env.NEXT_PUBLIC_ENGAGE_GROUP_ID,
  messageId: process.env.NEXT_PUBLIC_ENGAGE_MESSAGE_ID,
};

/**
 * Validates that required Mapp Engage environment variables are set
 * Only throws if Mapp Engage is being used but not configured
 * @throws Error if required configuration is missing when feature is enabled
 */
export function validateMappEngageConfig(): void {
  // Only validate if we're trying to use Mapp Engage
  // This prevents errors during development when Mapp Engage isn't configured
  if (!isMappEngageConfigured()) {
    logger.warn('Mapp Engage is not fully configured. Some features may be unavailable.');
    logger.warn('Missing: ' + [
      !mappEngageConfig.baseUrl && 'ENGAGE_BASE_URL',
      !mappEngageConfig.authToken && 'ENGAGE_AUTH_TOKEN'
    ].filter(Boolean).join(', '));
  }
}

/**
 * Ensures Mapp Engage is configured before making API calls
 * @throws Error if configuration is missing
 */
export function ensureMappEngageConfigured(): void {
  logger.debug('🔧 Checking Mapp Engage Configuration:');
  logger.debug('  Base URL:', mappEngageConfig.baseUrl || '❌ MISSING');
  logger.debug('  Auth Token:', mappEngageConfig.authToken ? '✅ Present' : '❌ MISSING');
  logger.debug('  Group ID:', mappEngageConfig.groupId || '⚠️ Not set (optional)');
  logger.debug('  Message ID:', mappEngageConfig.messageId || '⚠️ Not set (optional)');
  
  if (!mappEngageConfig.baseUrl) {
    throw new Error('ENGAGE_BASE_URL environment variable is required for Mapp Engage operations');
  }

  if (!mappEngageConfig.authToken) {
    throw new Error('ENGAGE_AUTH_TOKEN environment variable is required for Mapp Engage operations');
  }
}

/**
 * Check if Mapp Engage is properly configured
 * @returns boolean indicating if configuration is valid
 */
export function isMappEngageConfigured(): boolean {
  return !!(mappEngageConfig.baseUrl && mappEngageConfig.authToken);
}

/**
 * Get common headers for Mapp Engage API requests
 * @returns Headers object with authentication
 */
export function getMappEngageHeaders(): Record<string, string> {
  return {
    'Authorization': mappEngageConfig.authToken,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };
}
