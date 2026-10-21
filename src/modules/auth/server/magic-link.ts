/**
 * Magic Link Utilities - Auth Module
 * 
 * Helper functions for generating and managing magic link authentication.
 * These utilities handle the complete magic link flow from generation to
 * email delivery via Mapp Engage.
 * 
 * Features:
 * - Magic link URL generation
 * - Token generation for customers and admins
 * - Email delivery via Mapp Engage
 * - Account and user-specific link generation
 * - Multi-account support
 * 
 * @example Generate and send magic link
 * ```typescript
 * const result = await sendCustomerMagicLink(
 *   'customer@example.com',
 *   'John',
 *   'Doe',
 *   undefined,
 *   '123',
 *   '/account/dashboard'
 * );
 * ```
 */

import logger from '@/lib/utils/logger';
import { config } from '@/config';
import { generateAccountMagicLink, generateUserMagicLink } from '@/lib/actions/admin/admin-actions';
import { generateCustomerAccountMagicLink, generateCustomerUserMagicLink, generateCustomerUserMagicLinkClient } from '@/lib/actions/account/account-actions';
import { createUserAndSendMappEngageMessage, mappEngageConfig } from '@/modules/mapp_engage';

/**
 * Build a magic link URL with the provided token
 * 
 * Constructs a complete magic link URL using the application's base URL
 * and the provided token.
 * 
 * @param token - The magic link token
 * @param path - Optional redirect path after authentication
 * @returns Complete magic link URL
 * 
 * @example
 * ```typescript
 * const url = buildMagicLinkUrl('token123', '/account/dashboard');
 * // Returns: 'https://portal.mapp.com/auth/verify?token=token123&redirect=%2Faccount%2Fdashboard'
 * ```
 */
export function buildMagicLinkUrl(token: string, path?: string): string {
  const base = config.app.url || (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base}/auth/verify?token=${token}&redirect=${encodeURIComponent(path || '')}`;
}

/**
 * Generate a magic link token for a user using server actions
 * 
 * @param userId - User ID for user-specific link generation
 * @param accountId - Account ID for account-specific link generation
 * @param useAccountAction - Whether to use account-based (true) or user-based (false) generation
 * @returns Promise with the generated magic link token
 * @throws Error if generation fails or no token is returned
 */
export async function generateMagicLinkToken(
  userId?: string, 
  accountId?: string, 
  useAccountAction: boolean = true
): Promise<string> {
  try {
    if (!accountId) {
      throw new Error('Account ID or User ID is required');
    }

    let result;

    if (useAccountAction && accountId) {
      // Use generateAccountMagicLink for account-specific links
      result = await generateAccountMagicLink(accountId);
    } else {
      // Use generateUserMagicLink for user-specific links
      result = await generateUserMagicLink(userId!);
    }

    if (result.error) {
      throw new Error(result.error);
    }

    if (!result.magicLink) {
      throw new Error('No magic link returned from server');
    }

    // Extract token from the magic link URL
    const url = new URL(result.magicLink);
    const token = url.searchParams.get('token');

    if (!token) {
      throw new Error('No token found in magic link URL');
    }

    return token;
  } catch (error) {
    logger.error('Failed to get magic link token:', error);
    throw error;
  }
}

/**
 * Generate a complete magic link URL for a user using server actions
 * 
 * @param userId - User ID for user-specific link generation
 * @param accountId - Account ID for account-specific link generation
 * @param path - Optional redirect path after login
 * @param useAccountAction - Whether to use account-based (false by default) or user-based generation
 * @returns Promise with the complete magic link URL
 * @throws Error if generation fails
 */
export async function generateMagicLinkUrl(
  userId?: string, 
  accountId?: string, 
  path?: string, 
  useAccountAction: boolean = false
): Promise<string> {
  if (!accountId && !userId) {
    throw new Error('Account ID or User ID is required');
  }

  let result;

  if (useAccountAction && accountId) {
    result = await generateAccountMagicLink(accountId);
  } else {
    result = await generateUserMagicLink(userId!);
  }

  if (result.error) {
    throw new Error(result.error);
  }

  if (!result.magicLink) {
    throw new Error('No magic link returned from server');
  }

  // result.magicLink is already a complete URL with the correct base and token
  // If a custom path is provided, we need to update the redirect parameter
  if (path) {
    const url = new URL(result.magicLink);
    url.searchParams.set('redirect', path);
    return url.toString();
  }

  return result.magicLink;
}

/**
 * Generate a complete customer magic link URL using server actions
 * 
 * @param userId - User ID for user-specific link generation
 * @param accountId - Account ID for account-specific link generation
 * @param path - Optional redirect path after login
 * @param useAccountAction - Whether to use account-based (false by default) or user-based generation
 * @returns Promise with the complete magic link URL
 * @throws Error if generation fails
 */
export async function generateCustomerMagicLinkUrl(
  userId?: string, 
  accountId?: string, 
  path?: string, 
  useAccountAction: boolean = false
): Promise<string> {
  if (!accountId && !userId) {
    throw new Error('Account ID or User ID is required');
  }

  let result;

  if (useAccountAction && accountId) {
    result = await generateCustomerAccountMagicLink(accountId);
  } else {
    result = await generateCustomerUserMagicLink(userId!);
  }

  if (result.error) {
    throw new Error(result.error);
  }

  if (!result.magicLink) {
    throw new Error('No magic link returned from server');
  }

  // result.magicLink is already a complete URL with the correct base and token
  // If a custom path is provided, we need to update the redirect parameter
  if (path) {
    const url = new URL(result.magicLink);
    url.searchParams.set('redirect', path);
    return url.toString();
  }

  return result.magicLink;
}

/**
 * Generate a customer magic link URL from client-side using email
 * 
 * @param email - Customer email address
 * @param path - Optional redirect path after login
 * @returns Promise with the complete magic link URL
 * @throws Error if generation fails or email validation fails
 */
export async function generateCustomerMagicLinkUrlClient(
  email: string, 
  path?: string
): Promise<string> {
  if (!email) {
    throw new Error('Email is required');
  }

  const result = await generateCustomerUserMagicLinkClient(email);

  if (result.error) {
    throw new Error(result.error);
  }

  if (!result.magicLink) {
    throw new Error('No magic link returned from server');
  }

  // Handle validation failure case - don't generate a real magic link
  if (result.magicLink === 'validation-failed') {
    throw new Error('Email validation failed');
  }

  // result.magicLink is already a complete URL with the correct base and token
  // If a custom path is provided, we need to update the redirect parameter
  if (path) {
    const url = new URL(result.magicLink);
    url.searchParams.set('redirect', path);
    return url.toString();
  }

  return result.magicLink;
}

/**
 * Generate a magic link URL and send it via Mapp Engage
 * 
 * This is the main function for sending magic links to customers. It generates
 * the link and sends it via email using Mapp Engage.
 * 
 * @param email - User's email address to send the magic link to
 * @param firstName - User's first name for personalization
 * @param lastName - User's last name for personalization
 * @param userId - User ID for generating user-specific link
 * @param accountId - Account ID for generating account-specific link
 * @param path - Optional redirect path after login
 * @param useAccountAction - Whether to use account-based or user-based magic link generation
 * @param groupId - Mapp Engage group ID (optional, will use env var if not provided)
 * @param messageId - Mapp Engage message ID (optional, will use env var if not provided)
 * @returns Promise with success status and message
 * 
 * @example Send magic link to new customer
 * ```typescript
 * const result = await sendCustomerMagicLink(
 *   'customer@example.com',
 *   'John',
 *   'Doe',
 *   undefined,
 *   '123',
 *   '/account/dashboard'
 * );
 * ```
 */
export async function sendCustomerMagicLink(
  email: string,
  firstName?: string,
  lastName?: string,
  userId?: string,
  accountId?: string,
  path?: string,
  useAccountAction: boolean = false,
  groupId?: string,
  messageId?: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Generate the magic link URL
    let magicLinkUrl;
    if (!userId && !accountId) {
      try {
        magicLinkUrl = await generateCustomerMagicLinkUrlClient(email, path);
      } catch (error) {
        // Handle email validation failure gracefully
        if (error instanceof Error && error.message === 'Email validation failed') {
          logger.log(`Email validation failed for ${email} - returning success without sending email`);
          // Return success to prevent email enumeration attacks
          return {
            success: true,
            message: `Magic link sent successfully to ${email}!`
          };
        }
        throw error; // Re-throw other errors
      }
    } else {
      magicLinkUrl = await generateCustomerMagicLinkUrl(userId, accountId, path, useAccountAction);
    }

    // Get default group and message IDs from environment if not provided
    const GROUP_ID = groupId || mappEngageConfig.groupId || '';
    const MESSAGE_ID = messageId || mappEngageConfig.messageId || '';

    if (!GROUP_ID || !MESSAGE_ID) {
      throw new Error('Mapp Engage group ID and message ID are required');
    }

    // Send the magic link via Mapp Engage
    await createUserAndSendMappEngageMessage({
      email,
      firstName: firstName || "",
      lastName: lastName || "",
      groupId: GROUP_ID,
      messageId: MESSAGE_ID,
      messageParameters: {
        firstName: firstName || "",
        url: magicLinkUrl,
        comment: 'Welcome to the Mapp Dashboard!'
      }
    }, true);

    logger.log("createUserAndSendMappEngageMessage success")

    return {
      success: true,
      message: `Magic link sent successfully to ${email}!`
    };
  } catch (error) {
    logger.error('Failed to send customer magic link:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to send magic link'
    };
  }
}
