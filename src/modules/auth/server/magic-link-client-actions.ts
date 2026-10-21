'use server';

/**
 * Server Actions for Magic Link Generation
 * 
 * These actions wrap the server-only magic link functions so they can be
 * called from client components without bundling server dependencies.
 * 
 * This file belongs in the auth module because:
 * - It's part of the authentication system
 * - It wraps auth module functions
 * - It should be portable with the auth module
 */

import { generateMagicLinkUrl, generateCustomerMagicLinkUrl, sendCustomerMagicLink } from '@/modules/auth/server';

/**
 * Generate a magic link URL for admin users
 * Called from client components that need to generate magic links
 */
export async function generateAdminMagicLinkAction(
  userId: string | undefined,
  accountId: string | undefined,
  path: string = '/account',
  useAccountAction: boolean = false
): Promise<string> {
  return generateMagicLinkUrl(userId, accountId, path, useAccountAction);
}

/**
 * Generate a magic link URL for customer users
 * Called from client components that need to generate customer magic links
 */
export async function generateCustomerMagicLinkAction(
  email: string,
  accountId: string | undefined,
  path: string = '/account',
  useAccountAction: boolean = false
): Promise<string> {
  return generateCustomerMagicLinkUrl(email, accountId, path, useAccountAction);
}

/**
 * Send a customer magic link via email
 * Called from client components to send magic link emails
 */
export async function sendCustomerMagicLinkAction(
  email: string,
  firstName: string,
  lastName: string,
  userId: string | undefined,
  accountId: string | undefined,
  callbackUrl: string = '/account',
  useAccountAction: boolean = false
): Promise<{ success: boolean; message: string }> {
  return sendCustomerMagicLink(email, firstName, lastName, userId, accountId, callbackUrl, useAccountAction);
}
