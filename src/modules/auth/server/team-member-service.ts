import logger from '@/lib/utils/logger';
import type { MappTeamMemberRequest, MappTeamResponse, S3Image } from '@/types';
import { createTeamMemberForAuthAction } from './team-member-actions';

/**
 * Service for creating and managing Mapp team members
 * 
 * ⚠️ SERVER-ONLY: This file imports sharp via s3ImageService and must only be used server-side
 */
export class MappTeamMemberService {
  private static async getS3ImageService() {
    const { s3ImageService } = await import('@/modules/s3_images');
    return s3ImageService;
  }
  
  /**
   * Extract user profile data from Microsoft Graph API
   */
  static async getGraphProfileData(accessToken: string): Promise<{
    title: string;
    profileImageUrl?: string;
    department?: string;
    companyName?: string;
    officeLocation?: string;
    mobilePhone?: string;
    businessPhones?: string[];
  }> {
    const result = {
      title: '',
      profileImageUrl: undefined as string | undefined,
      department: undefined as string | undefined,
      companyName: undefined as string | undefined,
      officeLocation: undefined as string | undefined,
      mobilePhone: undefined as string | undefined,
      businessPhones: undefined as string[] | undefined,
    };

    try {
      // Call Microsoft Graph API to get user profile details
      const graphResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (graphResponse.ok) {
        const graphData = await graphResponse.json();
        logger.log('Microsoft Graph user data:', graphData);
        
        // Extract profile data from Graph API response
        result.title = graphData.jobTitle || '';
        result.department = graphData.department || undefined;
        result.companyName = graphData.companyName || undefined;
        result.officeLocation = graphData.officeLocation || undefined;
        result.mobilePhone = graphData.mobilePhone || undefined;
        result.businessPhones = graphData.businessPhones || undefined;
        
        // Get higher resolution profile photo if available
        try {
          const photoResponse = await fetch('https://graph.microsoft.com/v1.0/me/photo/$value', {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          });
          
          if (photoResponse.ok) {
            // Convert photo to base64
            const photoBuffer = await photoResponse.arrayBuffer();
            const base64Photo = Buffer.from(photoBuffer).toString('base64');
            result.profileImageUrl = `data:image/jpeg;base64,${base64Photo}`;
            logger.log('Retrieved high-res profile photo from Microsoft Graph');
          }
        } catch (photoError) {
          logger.log('Could not retrieve profile photo from Graph API:', photoError);
        }
      } else {
        logger.warn('Failed to fetch user data from Microsoft Graph API:', graphResponse.status);
      }
    } catch (graphError) {
      logger.error('Error calling Microsoft Graph API:', graphError);
    }

    return result;
  }

  /**
   * Parse full name into first and last name components
   */
  static parseFullName(fullName?: string): { firstname: string; lastname: string } {
    const nameParts = fullName?.split(' ') || [];
    return {
      firstname: nameParts[0] || '',
      lastname: nameParts.slice(1).join(' ') || '',
    };
  }

  /**
   * Create team member data object from user information and Graph API data
   */
  static async createTeamMemberData(
    email: string,
    fullName: string,
    fallbackImageUrl?: string,
    graphData?: {
      title: string;
      profileImageUrl?: string;
      department?: string;
      companyName?: string;
      officeLocation?: string;
    },
    defaultRole: string = '',
    accessOverrides?: {
      accessStatus?: 'active' | 'suspended' | 'denied';
      accessLevel?: 'viewer' | 'editor' | 'admin';
    }
  ): Promise<MappTeamMemberRequest> {
    const { firstname, lastname } = this.parseFullName(fullName);
    
    // Use profile image from Graph API if available, otherwise fall back to provided image
    const profileImageUrl = graphData?.profileImageUrl || fallbackImageUrl;
    
    // Convert image to S3Image if available
    let s3Image: S3Image | null = null;
    if (profileImageUrl) {
      s3Image = await this.convertImageToS3(profileImageUrl);
    }
    
    return {
      email,
      firstname,
      lastname,
      title: graphData?.title || '',
      role: defaultRole,
      location: graphData?.officeLocation || undefined,
      // Include S3Image if available
      ...(s3Image && { image: s3Image }),
      // Include access control overrides if provided
      ...(accessOverrides?.accessStatus && { accessStatus: accessOverrides.accessStatus }),
      ...(accessOverrides?.accessLevel && { accessLevel: accessOverrides.accessLevel }),
    };
  }

  /**
   * Convert base64 image data to S3Image object
   */
  static async convertImageToS3(imageData: string): Promise<S3Image | null> {
    try {
      if (!imageData) return null;
      
      // Check if S3 is available before attempting upload
      const s3ImageService = await this.getS3ImageService();
      if (!s3ImageService.isS3Available()) {
        logger.warn('S3 service is not available, skipping image upload during auth');
        return null;
      }
      
      // Handle base64 data URLs
      if (imageData.startsWith('data:image/')) {
        logger.log('Converting base64 image to S3Image...');
        
        // Extract the base64 content and content type
        const [header, base64Content] = imageData.split(',');
        const contentType = header.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
        
        // Convert base64 to buffer
        const buffer = Buffer.from(base64Content, 'base64');
        
        // Create a File-like object for S3 upload
        const file = new File([buffer], `profile-${Date.now()}.${contentType.split('/')[1]}`, {
          type: contentType
        });
        
        // Upload to S3
        const s3Image = await s3ImageService.uploadImage(file, {
          path: 'mappTeam', // Store in mappTeam folder
          generateVariants: false // Don't generate variants for profile photos
        });
        
        logger.log('Successfully converted base64 image to S3Image:', {
          key: s3Image.key,
          size: s3Image.size
        });
        
        return s3Image;
      }
      
      // If it's already a regular URL, we can't convert it to S3Image
      // This should be handled at the UI level by uploading to S3 first
      logger.warn('Cannot convert regular URL to S3Image:', imageData);
      return null;
      
    } catch (error) {
      logger.error('Error converting image to S3Image:', error);
      return null;
    }
  }

  /**
   * Complete workflow to create a Mapp team member with Azure AD and Graph API data
   */
  static async createTeamMemberFromAzureAD(
    user: {
      email: string;
      name: string;
      image?: string;
    },
    accessToken?: string,
    defaultRole: string = '',
    accessOverrides?: {
      accessStatus?: 'active' | 'suspended' | 'denied';
      accessLevel?: 'viewer' | 'editor' | 'admin';
    }
  ): Promise<MappTeamResponse | null> {
    try {
      logger.log('Creating Mapp team member for:', user.email);

      // Get enhanced profile data from Graph API if access token is available
      let graphData;
      if (accessToken) {
        graphData = await this.getGraphProfileData(accessToken);
      }

      // Parse name components
      const { firstname, lastname } = this.parseFullName(user.name);

      logger.log('Creating Mapp team member with parsed data:', { 
        email: user.email, 
        firstname, 
        lastname, 
        title: graphData?.title || '',
        role: defaultRole,
        location: graphData?.officeLocation || undefined
      });

      // Create team member data with S3Image conversion
      const teamMemberData = await this.createTeamMemberData(
        user.email,
        user.name,
        user.image,
        graphData,
        defaultRole,
        accessOverrides
      );

      // Create the team member using auth-specific server action (no admin auth required)
      const result = await createTeamMemberForAuthAction(teamMemberData);
      
      if (result.success && result.data) {
        logger.log('Successfully created Mapp team member:', result.data);
        return result.data;
      } else {
        logger.warn('Failed to create Mapp team member for:', user.email, result.error);
        return null;
      }

    } catch (error) {
      logger.error('Error creating Mapp team member:', error);
      return null;
    }
  }
}

export default MappTeamMemberService;
