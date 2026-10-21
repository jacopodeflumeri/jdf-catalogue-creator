'use server';

import logger from '@/lib/utils/logger';
import { prismaService } from '@/lib/prisma/services';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/modules/auth/server';
import { generateAccountEmail } from '@/modules/auth/server';
import { stringToS3Image, transformImageForResponse } from '@/modules/s3_images';
import type { AccountData, PaginatedResponse, AccountTeamMemberData, AccountStatus, AccountStage, ActivityLogResponse, MappTeamResponse, S3Image } from '@/types';

/**
 * Transform Prisma account data to AccountData format
 */
function transformPrismaAccountToAccountData(prismaAccount: any): AccountData {
  // Get primary user email (first account user)
  const primaryUser = prismaAccount.accountUsers?.[0]?.user;
  const primaryEmail = primaryUser?.email || '';
  
  // Transform domains from JSON to string array
  let domains: string[] = [];
  if (prismaAccount.domains) {
    try {
      domains = Array.isArray(prismaAccount.domains) ? prismaAccount.domains : JSON.parse(prismaAccount.domains);
    } catch {
      domains = [];
    }
  }

  // Transform account users to contacts and team members
  const contacts: any[] = [];
  const teamMembers: any[] = [];

  if (prismaAccount.accountUsers && Array.isArray(prismaAccount.accountUsers)) {
    prismaAccount.accountUsers.forEach((accountUser: any) => {
      const user = accountUser.user;
      const baseData = {
        id: accountUser.id.toString(),
        user_id: accountUser.userId.toString(),
        email: user?.email || '',
        access: accountUser.access || 'customer',
        status: accountUser.status || 'active',
        isActive: accountUser.status === 'active',
      };

      // Separate by access type - mapp users go to teamMembers, others go to contacts
      if (accountUser.access === 'mapp') {
        teamMembers.push({
          ...baseData,
          name: `${accountUser.firstName || ''} ${accountUser.lastName || ''}`.trim() || user?.name || user?.email || '',
          role: 'Team Member', // Default role
          title: undefined,
          firstname: accountUser.firstName || undefined,
          lastname: accountUser.lastName || undefined,
          image: undefined, // S3Image would need to be populated from MappTeam if available
        });
      } else {
        contacts.push({
          ...baseData,
          first_name: accountUser.firstName || '',
          last_name: accountUser.lastName || '',
          role: undefined,
          department: undefined,
          phone: undefined,
          lastLogin: undefined,
        });
      }
    });
  }

  return {
    id: prismaAccount.id.toString(),
    email: primaryEmail,
    name: prismaAccount.name || '',
    company: prismaAccount.companyName || prismaAccount.name || '',
    region: prismaAccount.region || undefined,
    currency: prismaAccount.currency || undefined,
    vertical: prismaAccount.vertical || undefined,
    domains: domains,
    status: prismaAccount.status as AccountStatus,
    stage: prismaAccount.stage as AccountStage,
    sf_account_id: prismaAccount.sfAccountId || undefined,
    createdAt: prismaAccount.createdAt.toISOString(),
    updatedAt: prismaAccount.updatedAt.toISOString(),
    lastActive: prismaAccount.updatedAt.toISOString(), // Use updatedAt as proxy for lastActive
    contacts: contacts,
    teamMembers: teamMembers,
  };
}

/**
 * Server Actions for Admin functionality
 * All actions include authentication and authorization checks for admin users
 */

export async function getAdminDashboardData() {
  const session = await requireAdmin();

  try {
    // Fetch accounts, content, and activity logs using Prisma services
    const accountsData = await prismaService.account.getAccounts();
    const activityLogsResult = await prismaService.accountActivity.getAllActivityLogs();
    const activityLogs: ActivityLogResponse[] = activityLogsResult?.map(activity => ({
      id: activity.id,
      created_at: activity.createdAt.toISOString(),
      user_id: activity.userId,
      account_id: activity.accountId,
      type: activity.type,
      details: activity.details || '',
      message: activity.message || '',
      linked_id: activity.linkedId || undefined
    })) || [];

    // Transform accounts data to AccountData format
    const transformedAccounts = accountsData?.map(transformPrismaAccountToAccountData) || [];
    const accounts: PaginatedResponse<AccountData> = {
      data: transformedAccounts,
      pagination: { page: 1, limit: 1000, total: transformedAccounts.length, totalPages: 1 }
    };

    // Calculate stats
    const dayOffset = 30;
    const stats = {
      totalAccounts: transformedAccounts.length,
      newAccounts: transformedAccounts.filter((account) => {
        const createdAt = new Date(account.createdAt);
        const checkDate = new Date();
        checkDate.setDate(checkDate.getDate() - dayOffset);
        return createdAt >= checkDate;
      }).length,
    };

    return {
      accounts,
      stats,
      activityLogs: activityLogs || [],
      user: session.user
    };
  } catch (error) {
    logger.error('Failed to load admin dashboard data:', error);
    throw new Error('Failed to load admin dashboard data');
  }
}

export async function getAdminUserProfile(email?: string) {
  const session = await requireAdmin();

  try {
    const userEmail = email || session.user.email;

    if (!userEmail) {
      throw new Error('No email provided');
    }

    const userData = await prismaService.mappTeam.getTeamMemberByEmail(userEmail);
    return userData;
  } catch (error) {
    logger.error('Failed to load admin user profile:', error);
    throw new Error('Failed to load admin user profile');
  }
}

export async function updateAdminUserProfile(profileData: any) {
  const session = await requireAdmin();

  try {
    if (!session.user.email) {
      throw new Error('User email not found in session');
    }

    // Get the current user's Mapp team member data to find their ID
    const userData = await prismaService.mappTeam.getTeamMemberByEmail(session.user.email);
    
    if (!userData) {
      throw new Error('User profile not found');
    }

    // Use the existing updateMappTeamMember function to perform the actual update
    const updatedUser = await updateMappTeamMember(userData.id.toString(), profileData);

    if (!updatedUser) {
      throw new Error('Failed to update user profile');
    }

    return { success: true, message: 'Profile updated successfully!', data: updatedUser };
  } catch (error) {
    logger.error('Failed to update admin user profile:', error);
    return { success: false, message: error instanceof Error ? error.message : 'Failed to update profile. Please try again.' };
  }
}

export async function getMappTeamData() {
  await requireAdmin();

  try {
    const teamMembers = await prismaService.mappTeam.getAllTeamMembers();

    // Transform MappTeam to AccountTeamMemberData format
    // Filter out members without valid IDs to prevent empty string user_ids
    const transformedMembers: AccountTeamMemberData[] = teamMembers?.filter((member: any) => member.id && member.id !== null)
      .map((member: any) => ({
        id: member.id.toString(),
        user_id: member.id.toString(),
        name: `${member.firstname || ''} ${member.lastname || ''}`.trim(),
        email: member.email || '',
        role: member.role || 'Team Member',
        title: member.title,
        firstname: member.firstname,
        lastname: member.lastname,
        image: member.image || undefined,
        isActive: member.accessStatus === 'active',
        access: member.accessLevel || 'viewer',
        status: member.accessStatus || 'active',
        lastLoginAt: member.lastLoginAt?.toISOString(),
      })) || [];

    return {
      members: transformedMembers,
      stats: {
        totalMembers: transformedMembers.length,
        membersWithRoles: transformedMembers.filter(m => m.role).length,
        membersWithPhotos: transformedMembers.filter(m => m.image?.url).length,
        activeMembers: transformedMembers.filter(m => m.status === 'active').length,

      }
    };
  } catch (error) {
    logger.error('Failed to load Mapp team data:', error);
    throw new Error('Failed to load Mapp team data');
  }
}

/**
 * Update a Mapp team member's profile
 */
export async function updateMappTeamMember(id: string, data: any): Promise<MappTeamResponse | null> {
  await requireAdmin();

  try {
    // Transform string to S3Image object if needed
    const transformedData = { ...data };
    if (transformedData.image) {
      transformedData.image = typeof transformedData.image === 'string' 
        ? stringToS3Image(transformedData.image) 
        : transformedData.image as S3Image;
    } else {
      transformedData.image = null;
    }

    const result = await prismaService.mappTeam.updateTeamMember(id, transformedData);

    // Revalidate the user profile page
    revalidatePath('/admin/user');

    // Transform MappTeam to MappTeamResponse format
    if (result) {
      const transformedResult: MappTeamResponse = {
        id: result.id,
        created_at: Math.floor(result.createdAt.getTime() / 1000), // Convert to Unix timestamp
        email: result.email || '',
        firstname: result.firstname || '',
        lastname: result.lastname || '',
        title: result.title || '',
        role: result.role || '',
        location: result.location || undefined,
        image: result.image ? transformImageForResponse(result.image) : null, // Transform S3Image to response format
      };
      return transformedResult;
    }

    return null;
  } catch (error) {
    logger.error('Error updating Mapp team member:', error)
    
    // Handle specific error types and provide user-friendly messages
    if (error instanceof Error) {
      if (error.message.includes('Email already exists')) {
        throw new Error('This email is already in use by another team member');
      }
      if (error.message.includes('Team member not found')) {
        throw new Error('Team member not found');
      }
      if (error.message.includes('Invalid input data')) {
        throw new Error('Invalid data provided. Please check all fields and try again.');
      }
      if (error.message.includes('Invalid image URL')) {
        throw new Error('Invalid image URL provided');
      }
      
      // If we have a specific error message from the service layer, use it
      if (error.message !== 'Failed to update profile') {
        throw error;
      }
    }
    
    throw new Error('Failed to update profile. Please try again.');
  }
}

/**
 * Get current user's Mapp team member data
 */
export async function getCurrentUserMappTeamData(): Promise<MappTeamResponse | null> {
  const session = await requireAdmin();

  try {
    if (!session.user.email) {
      throw new Error('User email not found in session');
    }

    const userData = await prismaService.mappTeam.getTeamMemberByEmail(session.user.email);

    if (!userData) {
      return null;
    }

    // Transform Prisma MappTeam to MappTeamResponse format
    const transformedData: MappTeamResponse = {
      id: userData.id,
      created_at: Math.floor(userData.createdAt.getTime() / 1000), // Convert to Unix timestamp
      email: userData.email || '',
      firstname: userData.firstname || '',
      lastname: userData.lastname || '',
      title: userData.title || '',
      role: userData.role || '',
      location: userData.location || undefined,
      image: userData.image ? transformImageForResponse(userData.image) : null, // Transform S3Image to response format
    };

    return transformedData;
  } catch (error) {
    logger.error('Error fetching current user data:', error);
    return null; // Return null instead of throwing to match the layout's expectation
  }
}

/**
 * Generate magic link for account
 */
export async function generateAccountMagicLink(accountId: string): Promise<{ magicLink?: string; error?: string }> {
  try {
    await requireAdmin();

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
export async function generateUserMagicLink(userId: string): Promise<{ magicLink?: string; error?: string }> {
  try {
    await requireAdmin();

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

