/**
 * Auth Module - Account Switching (Server-Only)
 * 
 * Server-only function for switching user accounts.
 * This is separated from client-safe utilities to prevent bundling
 * server-only dependencies in client code.
 */

'use server';

import logger from '@/lib/utils/logger';
import { generateAccountEmail } from '../utils/auth-helpers';
import { getUserAccountsByIdAction } from './team-member-actions';

/**
 * Switch to a specific account for a user
 * @param userId The user ID from the current session
 * @param accountId The account ID to switch to
 * @returns Promise with success status and user data for the selected account
 */
export async function switchAccount(
  userId: string, 
  accountId: number
): Promise<{
  success: boolean;
  error?: string;
  userSimple?: {
    id: string;
    email: string;
    created_at: string;
    name?: string;
    accountId: number;
  };
}> {
  try {
    // Validate inputs
    if (!userId || !accountId) {
      return { success: false, error: 'Missing required parameters' };
    }

    // Use server action to get user's account details for the selected account
    const accountUsersResult = await getUserAccountsByIdAction(userId);
    
    if (!accountUsersResult.success || !accountUsersResult.data) {
      return { success: false, error: accountUsersResult.error || 'Failed to get user accounts' };
    }
    
    const accountUsers = accountUsersResult.data;
    
    if (!accountUsers || accountUsers.length === 0) {
      return { success: false, error: 'No accounts found for user' };
    }

    // Find the specific account details
    const selectedAccount = accountUsers.find((account: any) => 
      account.accountId === accountId
    );

    if (!selectedAccount) {
      return { success: false, error: 'Account not found' };
    }

    // Create user data for the selected account
    const userSimple = {
      id: userId,
      email: generateAccountEmail(accountId),
      created_at: new Date().toISOString(),
      name: (selectedAccount as any).firstName ? (selectedAccount as any).firstName.trim() || undefined : undefined,
      accountId: accountId,
    };

    // Return the validated user data
    return { 
      success: true, 
      userSimple,
    };

  } catch (error) {
    logger.error('Account switch failed:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Account switch failed' 
    };
  }
}
