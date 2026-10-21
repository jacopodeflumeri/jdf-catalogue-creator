'use server';

import logger from '@/lib/utils/logger';
import { prismaService } from '@/lib/prisma/services';
import { revalidatePath } from 'next/cache';
import { requireCustomer, requireCustomerForAccountSelection } from '@/modules/auth/server';
import { generateAccountEmail } from '@/modules/auth/server';
import {
  assertNotPreview,
  isPreviewSession,
  CUSTOMER_PREVIEW_READ_ONLY_MESSAGE,
} from '@/modules/customer_preview';

/**
 * Server Actions for Customer-facing functionality
 * All actions include authentication and authorization checks
 */

/**
 * Get all accounts for the current customer user
 * @param userId Optional user ID to lookup accounts for
 * @param allowPartialAuth Allow partial authentication (for account selection)
 */
export async function getCustomerAccounts(userId?: string, allowPartialAuth?: boolean): Promise<any[]> {
  try {
    let session;
    let userIdToUse;
    
    if (allowPartialAuth) {
      // For account selection, we might have a partial session without accountId
      session = await requireCustomerForAccountSelection();
      userIdToUse = userId || session.user.userId || session.user.id;
    } else {
      // Normal flow requires full customer authentication
      session = await requireCustomer();
      userIdToUse = userId || session.user.userId || session.user.id;
    }
    
    if (!userIdToUse) {
      logger.error('No user ID available for account lookup');
      return [];
    }

    // Get account users with account details included
    const accountUsers = await prismaService.accountUser.getUserAccountsWithDetails(userIdToUse);
    
    logger.log('Found accounts for user:', userIdToUse, accountUsers?.length || 0);
    return accountUsers || [];
  } catch (error) {
    logger.error('Error fetching customer accounts:', error);
    return [];
  }
}

/**
 * Switch to a different account for the current user
 */
export async function switchToAccount(accountId: number, callbackUrl?: string): Promise<{
  success: boolean;
  error?: string;
  redirectUrl?: string;
  accountData?: {
    accountId: string;
    accountName: string;
    access: string;
  };
}> {
  try {
    const session = await requireCustomerForAccountSelection();
    const userId = session.user.userId || session.user.id;
    
    if (!userId) {
      return { success: false, error: 'No user ID found in session' };
    }

    // Verify user has access to this account
    const accountUsers = await prismaService.accountUser.getUserAccountsWithDetails(userId);
    const targetAccountUser = accountUsers.find((au: any) => au.accountId === accountId);
    
    if (!targetAccountUser) {
      logger.warn('Unauthorized account access attempt:', { userId, accountId });
      return { success: false, error: 'You do not have access to this account' };
    }

    logger.log('Account switch successful:', { userId, accountId, access: targetAccountUser.access });
    
    // Revalidate paths to ensure server components pick up the new session
    revalidatePath('/account');
    revalidatePath('/');
    
    // For now, we'll handle the session update client-side via NextAuth
    // The actual session update will happen through NextAuth's update mechanism
    return { 
      success: true, 
      redirectUrl: callbackUrl || '/account',
      accountData: {
        accountId: accountId.toString(),
        accountName: targetAccountUser.account?.name || `Account ${accountId}`,
        access: targetAccountUser.access
      }
    };
  } catch (error) {
    logger.error('Account switch failed:', error);
    return { success: false, error: 'Account switch failed' };
  }
}

/**
 * Admin function to view an account as a customer
 * Sets accountId in admin session to allow viewing customer pages
 */
export async function adminViewAsAccount(accountId: number): Promise<{
  success: boolean;
  error?: string;
  accountData?: {
    accountId: string;
    accountName: string;
  };
}> {
  try {
    // Import requireAdmin to validate admin session
    const { requireAdmin } = await import('@/modules/auth/server');
    await requireAdmin();
    
    logger.log('Admin viewing account:', accountId);

    // Get account details
    const account = await prismaService.account.getAccountById(accountId.toString());

    if (!account) {
      return { success: false, error: 'Account not found' };
    }

    logger.log('Admin preparing to view account:', { accountId, accountName: account.name || account.companyName });
    
    // Return account data - admin will add this to their session
    return { 
      success: true,
      accountData: {
        accountId: accountId.toString(),
        accountName: account.name || account.companyName || `Account ${accountId}`
      }
    };
  } catch (error) {
    logger.error('Admin view as account failed:', error);
    return { success: false, error: 'Failed to prepare account view' };
  }
}

/**
 * Admin function to exit customer account view
 * Removes accountId from admin session
 */
export async function adminExitAccountView(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { requireAdmin } = await import('@/modules/auth/server');
    await requireAdmin();
    
    logger.log('Admin exiting account view');
    
    return { success: true };
  } catch (error) {
    logger.error('Admin exit account view failed:', error);
    return { success: false, error: 'Failed to exit account view' };
  }
}

/**
 * Create a current user team member object
 */
function createCurrentUserTeamMember(session: any, id: string = 'current') {
  return {
    id,
    user_id: session.user.userId || '',
    name: session.user.name || 'Current User',
    email: session.user.email || '',
    role: 'admin' as const,
    status: 'active' as const,
    isActive: true,
    access: 'admin',
    lastActive: 'Current session',
    joinedDate: 'Account owner',
    permissions: ['admin', 'manage_team', 'billing']
  };
}

/**
 * Transform account_user relationships to team member format
 * Filters out Mapp team members and blocked users
 */
function transformAccountUsersToTeamMembers(accountUsers: any[], currentUserEmail?: string, currentSession?: any) {
  logger.log('Transforming account users to team members:', accountUsers.length);
  
  const members = accountUsers
    .filter((accountUser: any) => accountUser.access !== 'mapp' && accountUser.access !== 'admin') // Filter out Mapp team members
    .filter((accountUser: any) => !accountUser.user?.email?.endsWith('mapp.com'))
    .filter((accountUser: any) => accountUser.status !== 'blocked') // Exclude blocked users
    .map((accountUser: any, index: number) => {
      logger.log('Processing account user:', {
        id: accountUser.id,
        firstName: accountUser.firstName,
        lastName: accountUser.lastName,
        email: accountUser.user?.email,
        access: accountUser.access,
        status: accountUser.status
      });

      // Construct name from firstName and lastName, with fallbacks
      let displayName = '';
      if (accountUser.firstName || accountUser.lastName) {
        displayName = [accountUser.firstName, accountUser.lastName].filter(Boolean).join(' ');
      } else if (accountUser.user?.name && accountUser.user.name.trim() !== '') {
        displayName = accountUser.user.name;
      } else {
        // Use email prefix instead of "Unknown User"
        displayName = accountUser.user?.email?.split('@')[0] || 'User';
      }

      return {
        id: accountUser.id?.toString() || (index + 1).toString(),
        user_id: accountUser.user?.id?.toString() || accountUser.userId?.toString() || '',
        name: displayName,
        email: accountUser.user?.email || '',
        role: accountUser.access === 'admin' ? 'admin' as const : 'member' as const,
        status: accountUser.status || 'active' as const,
        isActive: accountUser.status === 'active',
        access: accountUser.access,
        lastActive: accountUser.user?.updatedAt ? `Last seen ${new Date(accountUser.user.updatedAt).toLocaleDateString()}` : 'Never',
        joinedDate: accountUser.createdAt ? new Date(accountUser.createdAt).toLocaleDateString() : 'Unknown',
        permissions: accountUser.access === 'admin' ? ['admin', 'manage_team', 'billing'] : ['view', 'edit']
      };
    });

  // Add current user if not in account_user relationships and session is provided
  if (currentSession && currentUserEmail && !members.some((member: any) => member.email === currentUserEmail)) {
    members.unshift(createCurrentUserTeamMember(currentSession));
  }

  return members;
}

export async function getCustomerDashboardData() {
  const session = await requireCustomer();

  try {
    const { teamData, mappTeamData } = await getCustomerTeamData(true);

    return {
      user: session.user,
      team: teamData,
      mappTeam: mappTeamData,
    };
  } catch (error) {
    logger.error('Failed to load dashboard data:', error);
    throw new Error('Failed to load dashboard data');
  }
}

/**
 * Get customer team data
 */
export async function getCustomerTeamData(includeMappTeam = false) {
  const session = await requireCustomer();

  try {

    // Get team members/contacts from account data with relationships
    try {
      const account = await prismaService.account.getAccountById(session.user.accountId!);

      if (!account || !account.accountUsers) {
        throw new Error('No account data found');
      }

      // Transform account_user relationships to team member format using the reusable function
      const members = transformAccountUsersToTeamMembers(
        account.accountUsers,
        session.user.email || undefined,
        session
      );

      const client = {
        members: members,
        permissions: {
          canInvite: true,
          canRemove: true,
          canChangeRoles: true
        }
      };

      if(includeMappTeam){
        // Get account users with access='mapp' and lookup their mapp team data by email
        const mappAccountUsers = account.accountUsers.filter((user: any) => user.access === 'mapp');
        
        const mappTeamMembers = [];
        for (const mappUser of mappAccountUsers) {
          if (mappUser.user?.email) {
            try {
              const mappTeamData = await prismaService.mappTeam.getTeamMemberByEmail(mappUser.user.email);
              if (mappTeamData) {
                // Only include the clean Mapp team profile data (no mixed account_user data)
                mappTeamMembers.push(mappTeamData);
              }
            } catch (error) {
              logger.warn(`Could not find mapp team data for email ${mappUser.user.email}:`, error);
            }
          }
        }
        
        return {teamData: client, mappTeamData: mappTeamMembers};
      }

      return {teamData: client, mappTeamData: []};

    } catch (error) {
      logger.log('No team data found, returning current user only:', error);

      // Return just the current user if no team data exists
      const client = {
        members: [createCurrentUserTeamMember(session)],
        invitations: [],
        permissions: {
          canInvite: true,
          canRemove: true,
          canChangeRoles: true
        }
      };

      return {teamData: client, mappTeamData: []};
    }
  } catch (error) {
    logger.error('Failed to fetch customer team data:', error);
    throw new Error('Failed to fetch team data');
  }
}

/**
 * Update current user's first and last names in account_user record
 */
export async function updateUserNames(firstName: string, lastName: string) {
  const session = await requireCustomer();
  // Customer mutation: refused during an admin "View as customer" preview.
  assertNotPreview(session);

  try {
    logger.log(`Updating user names for ${session.user.email} to "${firstName}" "${lastName}"`);

    // Get account data to find the current user's account_user record
    const account = await prismaService.account.getAccountById(session.user.accountId!);
    
    if (!account || !account.accountUsers) {
      throw new Error('No account data found');
    }

    // Find the current user's account_user record by email
    const currentUserAccountUser = account.accountUsers.find((accountUser: any) => 
      accountUser.user?.email?.toLowerCase() === session.user.email?.toLowerCase()
    );

    if (!currentUserAccountUser) {
      throw new Error('Current user not found in account_user records');
    }

    // Update the account_user record with the new names
    const updateData = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: currentUserAccountUser.user?.email, // Keep email the same
      access: currentUserAccountUser.access, // Keep access the same
      status: currentUserAccountUser.status || 'active' // Keep status the same
    };

    const result = await prismaService.accountUser.updateContact(
      currentUserAccountUser.id,
      updateData
    );

    if (result) {
      // Revalidate paths to update the UI
      revalidatePath('/account');
      revalidatePath('/account/settings');
      
      return { 
        success: true, 
        message: 'Names updated successfully!',
        data: result
      };
    } else {
      throw new Error('Failed to update names');
    }

  } catch (error) {
    logger.error('Failed to update user names:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to update names');
  }
}

/**
 * Get current user's first and last names from account_user record
 */
export async function getCurrentUserNames(): Promise<{ firstName: string; lastName: string }> {
  const session = await requireCustomer();

  try {
    // Get account data to find the current user's account_user record
    const account = await prismaService.account.getAccountById(session.user.accountId!);
    
    if (!account || !account.accountUsers) {
      return { firstName: '', lastName: '' };
    }

    // Find the current user's account_user record by email
    const currentUserAccountUser = account.accountUsers.find((accountUser: any) => 
      accountUser.user?.email?.toLowerCase() === session.user.email?.toLowerCase()
    );

    if (!currentUserAccountUser) {
      return { firstName: '', lastName: '' };
    }

    return {
      firstName: currentUserAccountUser.firstName || '',
      lastName: currentUserAccountUser.lastName || ''
    };

  } catch (error) {
    logger.error('Failed to get current user names:', error);
    return { firstName: '', lastName: '' };
  }
}

/**
 * Invite a team member to the customer account
 * Uses the same admin flow as adding contacts and sends magic link
 */
export async function inviteTeamMember(email: string, fullName?: string) {
  const session = await requireCustomer();
  // Customer mutation: refused during an admin "View as customer" preview.
  assertNotPreview(session);

  try {
    logger.log(`Inviting team member ${email} to account ${session.user.accountId}`);

    // Use admin service to add contact with member access

    // Check for duplicate emails within the account
    const account = await prismaService.account.getAccountById(session.user.accountId!);
    if (account) {
      // Check both contacts and team members for duplicate emails
      const allAccountEmails = [
        ...(account.accountUsers || []).map((c: any) => c.email.toLowerCase()),
        ...(account.accountUsers || []).map((tm: any) => tm.email.toLowerCase())
      ];
      
      if (allAccountEmails.includes(email.toLowerCase())) {
        throw new Error('A contact with this email address already exists for this account');
      }
    }

    // Parse the full name into first and last name for database storage
    const defaultName = fullName || email.split('@')[0];
    const nameParts = defaultName.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Step 1: Add contact through admin flow
    const contactResult = await prismaService.accountUser.createContact({
      first_name: firstName,
      last_name: lastName,
      email: email,
      access: 'customer', // Customer contact access level
      account_id: parseInt(session.user.accountId!),
      user_id: 0, // Use 0 for pending user
      status: 'pending',
    });

    if (!contactResult) {
      throw new Error('Failed to create team member contact');
    }
    
    // Note: contactResult.email is readonly in AccountUser type

    return {
      success: true,
      message: `Team member invited successfully! ${email} will receive a magic link to access the dashboard.`,
      contactId: contactResult.id,
      contact: { ...contactResult, email }, // Spread with email override
    };

  } catch (error) {
    logger.error('Failed to invite team member:', error);
    throw new Error(`Failed to invite team member: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate magic link for account
 */
export async function generateCustomerAccountMagicLink(accountId: string): Promise<{ magicLink?: string; error?: string }> {
  try {
    const session = await requireCustomer();
    // Mints a login link: refused during an admin "View as customer" preview.
    if (isPreviewSession(session)) return { error: CUSTOMER_PREVIEW_READ_ONLY_MESSAGE };

    // Get account data to validate it exists
    const account = await prismaService.account.getAccountById(accountId);
    if (!account) {
      return { error: 'Account not found' };
    }

    // Use a generic email format for account-based magic links
    const genericEmail = generateAccountEmail(account.id);

    // Generate magic link using the generic email
    const magicLinkUrl = await prismaService.auth.generateMagicLinkUrl(genericEmail, '/account');

    return { magicLink: magicLinkUrl };
  } catch (error) {
    logger.error('Error generating magic link:', error);
    return { error: 'Failed to generate magic link' };
  }
}

/**
 * Generate magic link for user
 */
export async function generateCustomerUserMagicLink(userId: string): Promise<{ magicLink?: string; error?: string }> {
  try {
    const session = await requireCustomer();
    // Mints a login link: refused during an admin "View as customer" preview.
    if (isPreviewSession(session)) return { error: CUSTOMER_PREVIEW_READ_ONLY_MESSAGE };

    // Get user data to extract the email
    const user = await prismaService.user.getUserById(userId);
    if (!user) {
      return { error: 'User not found' };
    }

    if (!user.email) {
      return { error: 'User email not found' };
    }

    // Generate magic link using the enhanced auth service
    const magicLinkUrl = await prismaService.auth.generateMagicLinkUrl(user.email, '/account');

    return { magicLink: magicLinkUrl };
  } catch (error) {
    logger.error('Error generating user magic link:', error);
    return { error: 'Failed to generate magic link' };
  }
}

/**
 * Generate magic link for user using client endpoint
 */
export async function generateCustomerUserMagicLinkClient(email: string): Promise<{ magicLink?: string; error?: string }> {
  try {
    logger.log(`Generating magic link for user ${email} with client endpoint`);

    // Validate that the email belongs to a valid customer
    const user = await prismaService.user.getUserByEmail(email);
    if (!user) {
      // Don't reveal that the email doesn't exist - return a generic success message
      // This prevents email enumeration attacks
      logger.log(`Magic link requested for non-existent email: ${email}`);
      return { magicLink: 'validation-failed' }; // Special flag for non-existent emails
    }

    // Generate magic link using the enhanced auth service directly
    const magicLinkUrl = await prismaService.auth.generateMagicLinkUrl(email, '/account');

    return { magicLink: magicLinkUrl };
  } catch (error) {
    logger.error('Error generating user magic link with client:', error);
    return { error: 'Failed to generate magic link' };
  }
}