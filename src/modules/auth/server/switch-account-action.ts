'use server';

import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/modules/auth/config/nextauth';;
import { switchAccount } from './switch-account';
import logger from '@/lib/utils/logger';

/**
 * Server action to switch accounts for authenticated users
 * @param accountId The account ID to switch to
 * @param callbackUrl The URL to redirect to after switching
 * @returns Promise with the result of the account switch
 */
export async function switchAccountAction(accountId: number, callbackUrl: string = '/account') {
  const session = await getServerSession(authOptions);

  // Security checks
  if (!session) {
    return { success: false, error: 'Not authenticated' };
  }

  if (session.user.role !== 'customer') {
    return { success: false, error: 'Only customers can switch accounts' };
  }

  const userId = session.user.userId || session.user.id;

  if (!userId) {
    return { success: false, error: 'Missing authentication data' };
  }

  try {
    // Call the switch account function with security validation
    const result = await switchAccount(userId, accountId);
    
    if (result.success) {
      // Return the data needed for client-side NextAuth signIn
      return {
        success: true,
        userSimple: result.userSimple,
        callbackUrl
      };
    } else {
      return {
        success: false,
        error: result.error || 'Failed to switch accounts'
      };
    }
  } catch (error) {
    logger.error('Account switch action failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Account switch failed'
    };
  }
}
