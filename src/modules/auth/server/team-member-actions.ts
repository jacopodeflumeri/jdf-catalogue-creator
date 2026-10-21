'use server';

import logger from '@/lib/utils/logger';
import { prismaService } from '@/lib/prisma/services';
import type { MappTeamResponse, S3Image } from '@/types';

async function transformTeamMemberImageForResponse(image: unknown) {
  if (!image) {
    return null;
  }

  const { transformImageForResponse } = await import('@/modules/s3_images');
  return transformImageForResponse(image);
}

/**
 * Get team member by email (for authentication purposes)
 * This is used during auth flow and doesn't require existing authentication
 */
export async function getTeamMemberByEmailAction(
  email: string
): Promise<{ success: boolean; data?: MappTeamResponse | null; error?: string }> {
  try {
    if (!email) {
      return {
        success: false,
        error: 'Email is required'
      };
    }

    logger.log('Looking up team member by email:', email);

    const teamMember = await prismaService.mappTeam.getTeamMemberByEmail(email);

    if (!teamMember) {
      return {
        success: true,
        data: null
      };
    }

    // Transform Prisma MappTeam to MappTeamResponse format
    const transformedMember: MappTeamResponse = {
      id: teamMember.id,
      created_at: Math.floor(teamMember.createdAt.getTime() / 1000), // Convert to Unix timestamp
      email: teamMember.email || '',
      firstname: teamMember.firstname || '',
      lastname: teamMember.lastname || '',
      title: teamMember.title || '',
      role: teamMember.role || '',
      location: teamMember.location || undefined,
      image: await transformTeamMemberImageForResponse(teamMember.image),
      // Include access control fields for authentication
      accessStatus: teamMember.accessStatus,
      accessLevel: teamMember.accessLevel,
      lastLoginAt: teamMember.lastLoginAt,
      authorizedBy: teamMember.authorizedBy,
      authorizedAt: teamMember.authorizedAt,
      accessNotes: teamMember.accessNotes
    };

    return {
      success: true,
      data: transformedMember
    };
  } catch (error) {
    logger.error('Error getting team member by email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get team member'
    };
  }
}

/**
 * Get raw team member data by email (returns Prisma format for auth transformations)
 * This is used during auth flow and doesn't require existing authentication
 */
export async function getRawTeamMemberByEmailAction(
  email: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    if (!email) {
      return {
        success: false,
        error: 'Email is required'
      };
    }

    logger.log('Looking up raw team member by email:', email);

    const teamMember = await prismaService.mappTeam.getTeamMemberByEmail(email);

    return {
      success: true,
      data: teamMember
    };
  } catch (error) {
    logger.error('Error getting raw team member by email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get team member'
    };
  }
}

/**
 * Create team member during authentication flow
 * This is used during auth flow and doesn't require existing authentication
 */
export async function createTeamMemberForAuthAction(memberData: {
  email: string;
  firstname: string;
  lastname: string;
  title?: string;
  role?: string;
  location?: string;
  image?: S3Image | null;
  accessStatus?: 'active' | 'suspended' | 'denied';
  accessLevel?: 'viewer' | 'editor' | 'admin';
}): Promise<{ success: boolean; data?: MappTeamResponse; error?: string }> {
  try {
    logger.log('Creating team member during auth for:', memberData.email);

    // Data is already in correct format (S3Image objects)
    // Add lastLoginAt since this is called during authentication (actual login)
    const result = await prismaService.mappTeam.createTeamMember({
      ...memberData,
      lastLoginAt: new Date()
    });

    if (result) {
      // Transform MappTeam to MappTeamResponse format
      const transformedResult: MappTeamResponse = {
        id: result.id,
        created_at: Math.floor(result.createdAt.getTime() / 1000), // Convert to Unix timestamp
        email: result.email || '',
        firstname: result.firstname || '',
        lastname: result.lastname || '',
        title: result.title || '',
        role: result.role || '',
        location: result.location || undefined,
        image: await transformTeamMemberImageForResponse(result.image),
        // Include access control fields for authentication
        accessStatus: result.accessStatus,
        accessLevel: result.accessLevel,
        lastLoginAt: result.lastLoginAt,
        authorizedBy: result.authorizedBy,
        authorizedAt: result.authorizedAt,
        accessNotes: result.accessNotes
      };
      
      logger.log('Successfully created team member during auth:', transformedResult);
      return {
        success: true,
        data: transformedResult
      };
    }

    return {
      success: false,
      error: 'Failed to create team member'
    };
  } catch (error) {
    logger.error('Error creating team member during auth:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create team member'
    };
  }
}

/**
 * Update team member during authentication flow (e.g., lastLoginAt, Azure AD profile data)
 * This is used during auth flow and doesn't require existing authentication
 */
export async function updateTeamMemberForAuthAction(
  teamMemberId: string,
  updateData: {
    lastLoginAt?: Date;
    firstname?: string;
    lastname?: string;
    title?: string;
    role?: string;
    location?: string;
    image?: S3Image | null;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!teamMemberId) {
      return {
        success: false,
        error: 'Team member ID is required'
      };
    }


    await prismaService.mappTeam.updateTeamMember(teamMemberId, updateData);

    logger.log('Successfully updated team member during auth');
    return {
      success: true
    };
  } catch (error) {
    logger.error('Error updating team member during auth:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update team member'
    };
  }
}

/**
 * Get user accounts by user ID (for authentication and account switching purposes)
 * This is used during auth flow and doesn't require existing authentication
 */
export async function getUserAccountsByIdAction(
  userId: string
): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    if (!userId) {
      return {
        success: false,
        error: 'User ID is required'
      };
    }

    logger.log('Looking up user accounts by user ID:', userId);

    const accountUsers = await prismaService.accountUser.getUserAccounts(userId);

    return {
      success: true,
      data: accountUsers || []
    };
  } catch (error) {
    logger.error('Error getting user accounts by ID:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get user accounts'
    };
  }
}
