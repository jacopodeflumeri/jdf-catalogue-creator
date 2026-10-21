/**
 * Magic Link Authentication - Server Actions
 * 
 * Server-side functions for verifying and authenticating magic link tokens.
 * These actions handle the complete magic link verification flow including:
 * - Token validation
 * - User lookup
 * - Multi-account handling
 * - Admin account access
 * - Session creation redirect
 * 
 */

'use server';

import logger from '@/lib/utils/logger';
import { redirect } from 'next/navigation';
import { prismaService } from '@/lib/prisma/services';
import { parseAccountEmail } from '../utils/auth-helpers';

/**
 * Server-side magic link token validation (without consuming)
 * 
 * Validates a magic link token WITHOUT marking it as used. This is the first step
 * to prevent email prefetching from consuming tokens. Returns user information
 * so a confirmation page can be shown.
 * 
 * @param token - The magic link token to validate
 * @returns Promise with validation result including user data
 * 
 * @example Validate token
 * ```typescript
 * const result = await validateMagicLinkToken('token123');
 * if (result.success) {
 *   // Show confirmation button to user
 *   // Token is NOT consumed yet
 * }
 * ```
 */
export async function validateMagicLinkToken(token: string): Promise<{
  success: boolean;
  error?: string;
  userSimple?: any;
  multipleAccounts?: boolean;
  isAdminAccountAccess?: boolean;
  accountId?: number;
  accountName?: string;
}> {
  try {
    // Verify magic link token using Prisma auth service
    const magicLinkData = await prismaService.auth.getMagicLink({ token });
    
    if (!magicLinkData || magicLinkData.used || magicLinkData.expiresAt < new Date()) {
      return { success: false, error: 'Invalid or expired magic link' };
    }

    // DO NOT mark as used yet - just validate
    // This prevents email prefetching from consuming the token

    // Check if this is a generic account email format
    const accountEmailInfo = parseAccountEmail(magicLinkData.email);
    
    if (accountEmailInfo.isAccountEmail) {
      // This is a generic account email for admin access - verify account exists but don't log in as customer
      const accountId = accountEmailInfo.accountId!;
      
      try {
        const account = await prismaService.account.getAccountById(accountId.toString());
        if (!account) {
          return { success: false, error: 'Account not found for generic email' };
        }

        // For generic account emails, this should be an admin session with account context
        // The admin should already be authenticated when generating the magic link
        // Return a special response indicating this is for admin account access
        return { 
          success: true, 
          isAdminAccountAccess: true,
          accountId: accountId,
          accountName: account.companyName || `Account ${accountId}`,
          // Don't return userSimple - this will be handled by the auth callback
        };
        
      } catch (error) {
        logger.error('Error looking up account for generic email:', error);
        return { success: false, error: 'Failed to resolve account for generic email' };
      }
    }

    // For regular email addresses, implement user lookup logic
    try {
      const user = await prismaService.user.getUserByEmail(magicLinkData.email);
      if (!user) {
        return { success: false, error: 'User not found for email' };
      }

      // Check how many accounts this user has access to
      const userAccounts = await prismaService.accountUser.getUserAccountsWithDetails(user.id.toString());
      
      logger.log('Found accounts for user:', user.id, userAccounts?.length || 0);
      
      if (userAccounts && userAccounts.length > 1) {
        // User has multiple accounts - should show account selector
        logger.log('Multiple accounts found, showing selection:', userAccounts.length);
        return { 
          success: true, 
          multipleAccounts: true,
          userSimple: {
            id: user.id,
            email: user.email,
            created_at: user.createdAt.toISOString(),
            name: user.name,
          }
        };
      } else if (userAccounts && userAccounts.length === 1) {
        // User has exactly one account - direct login
        const accountUser = userAccounts[0];
        const userSimple = {
          id: user.id,
          email: user.email,
          created_at: user.createdAt.toISOString(),
          name: user.name,
          accountId: accountUser.accountId.toString(),
        };

        return { 
          success: true, 
          userSimple,
          multipleAccounts: false
        };
      } else {
        // User has no account access
        return { success: false, error: 'User has no account access' };
      }
      
    } catch (error) {
      logger.error('Error looking up user by email:', error);
      return { success: false, error: 'Failed to resolve user' };
    }

  } catch (error) {
    logger.error('Magic link validation failed:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Verification failed' 
    };
  }
}

/**
 * Server-side magic link token confirmation and consumption
 * 
 * Confirms and consumes a magic link token. This is the second step after validation.
 * Only call this when the user explicitly clicks the confirmation button.
 * 
 * @param token - The magic link token to confirm
 * @returns Promise with confirmation result including user data
 * 
 * @example Confirm token
 * ```typescript
 * // After user clicks "Sign In" button
 * const result = await confirmMagicLinkToken('token123');
 * if (result.success) {
 *   // Proceed with authentication
 *   // Token is now consumed and cannot be reused
 * }
 * ```
 */
export async function confirmMagicLinkToken(token: string): Promise<{
  success: boolean;
  error?: string;
  userSimple?: any;
  multipleAccounts?: boolean;
  isAdminAccountAccess?: boolean;
  accountId?: number;
  accountName?: string;
}> {
  try {
    // Verify magic link token using Prisma auth service
    const magicLinkData = await prismaService.auth.getMagicLink({ token });
    
    if (!magicLinkData || magicLinkData.used || magicLinkData.expiresAt < new Date()) {
      return { success: false, error: 'Invalid or expired magic link' };
    }

    // NOW mark magic link as used (only when user explicitly confirms)
    await prismaService.auth.useMagicLink(token);

    // Check if this is a generic account email format
    const accountEmailInfo = parseAccountEmail(magicLinkData.email);
    
    if (accountEmailInfo.isAccountEmail) {
      // This is a generic account email for admin access - verify account exists but don't log in as customer
      const accountId = accountEmailInfo.accountId!;
      
      try {
        const account = await prismaService.account.getAccountById(accountId.toString());
        if (!account) {
          return { success: false, error: 'Account not found for generic email' };
        }

        // For generic account emails, this should be an admin session with account context
        // The admin should already be authenticated when generating the magic link
        // Return a special response indicating this is for admin account access
        return { 
          success: true, 
          isAdminAccountAccess: true,
          accountId: accountId,
          accountName: account.companyName || `Account ${accountId}`,
          // Don't return userSimple - this will be handled by the auth callback
        };
        
      } catch (error) {
        logger.error('Error looking up account for generic email:', error);
        return { success: false, error: 'Failed to resolve account for generic email' };
      }
    }

    // For regular email addresses, implement user lookup logic
    try {
      const user = await prismaService.user.getUserByEmail(magicLinkData.email);
      if (!user) {
        return { success: false, error: 'User not found for email' };
      }

      // Check how many accounts this user has access to
      const userAccounts = await prismaService.accountUser.getUserAccountsWithDetails(user.id.toString());
      
      logger.log('Found accounts for user:', user.id, userAccounts?.length || 0);
      
      if (userAccounts && userAccounts.length > 1) {
        // User has multiple accounts - should show account selector
        logger.log('Multiple accounts found, showing selection:', userAccounts.length);
        return { 
          success: true, 
          multipleAccounts: true,
          userSimple: {
            id: user.id,
            email: user.email,
            created_at: user.createdAt.toISOString(),
            name: user.name,
          }
        };
      } else if (userAccounts && userAccounts.length === 1) {
        // User has exactly one account - direct login
        const accountUser = userAccounts[0];
        const userSimple = {
          id: user.id,
          email: user.email,
          created_at: user.createdAt.toISOString(),
          name: user.name,
          accountId: accountUser.accountId.toString(),
        };

        return { 
          success: true, 
          userSimple,
          multipleAccounts: false
        };
      } else {
        // User has no account access
        return { success: false, error: 'User has no account access' };
      }
      
    } catch (error) {
      logger.error('Error looking up user by email:', error);
      return { success: false, error: 'Failed to resolve user' };
    }

  } catch (error) {
    logger.error('Magic link verification failed:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Verification failed' 
    };
  }
}

/**
 * Server-side magic link authentication and redirect
 * 
 * Handles the complete authentication flow on the server including verification,
 * user lookup, and appropriate redirects based on account status.
 * 
 * This function never returns - it always redirects to the appropriate page.
 * 
 * @param token - The magic link token to authenticate
 * @param redirectTo - The path to redirect to after successful authentication
 * 
 * @example From verify page
 * ```typescript
 * // In a server component or action
 * await authenticateMagicLink(token, '/account/dashboard');
 * // Will redirect to appropriate page - never returns
 * ```
 */
export async function authenticateMagicLink(token: string, redirectTo: string = '/account') {
  if (!token) {
    redirect('/auth/signin?error=InvalidToken');
  }

  const result = await confirmMagicLinkToken(token);

  if (!result.success) {
    const errorMessage = encodeURIComponent(result.error || 'Verification failed');
    redirect(`/auth/verify/error?message=${errorMessage}`);
  }

  if (!result.userSimple) {
    redirect('/auth/verify/error?message=Authentication failed');
  }

  // Handle multiple accounts case
  if (result.multipleAccounts) {
    const callbackUrl = encodeURIComponent(redirectTo);
    // Pass the user data so the account selector can authenticate them first
    const userData = encodeURIComponent(JSON.stringify(result.userSimple));
    redirect(`/auth/select-account?callbackUrl=${callbackUrl}&userData=${userData}`);
  }

  // At this point we have valid user data, but we need to handle the NextAuth signIn
  // Since we can't call NextAuth signIn directly in a server action,
  // we'll pass the data to a client component that handles the signIn
  redirect(`/auth/verify/signin?token=${encodeURIComponent("UNUSED")}&userData=${encodeURIComponent(JSON.stringify(result.userSimple))}&redirect=${encodeURIComponent(redirectTo)}`);
}
