/**
 * Mapp Engage Module - Server Actions
 * Server-side actions for Mapp Engage operations with authentication and caching
 */

'use server';

import logger from '@/lib/utils/logger';
import { revalidatePath } from 'next/cache';
import { validateMappEngageAccess } from '../utils/validation';
import { 
  createContact,
  getUserDetails,
  addToGroup,
  sendSingleMessage,
  createUserAndSendMessage,
} from './api';
import type {
  CreateContactRequest,
  AddToGroupRequest,
  SendMessageRequest,
  CreateUserAndSendMessageRequest,
  MappApiResponse,
} from '../types';

/**
 * Server action to create a new contact in Mapp Engage
 */
export async function createMappEngageContact(
  contactData: CreateContactRequest
): Promise<MappApiResponse> {
  try {
    await validateMappEngageAccess();
    
    const result = await createContact(contactData);
    
    // Revalidate relevant paths if needed
    revalidatePath('/admin/accounts');
    
    return {
      success: true,
      data: result,
      message: 'Contact created successfully in Mapp Engage'
    };
  } catch (error) {
    logger.error('Failed to create Mapp Engage contact:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create contact'
    };
  }
}

/**
 * Server action to get user details from Mapp Engage by email
 */
export async function getMappEngageUserDetails(email: string): Promise<MappApiResponse> {
  try {
    await validateMappEngageAccess();
    
    if (!email) {
      throw new Error('Email is required');
    }
    
    const result = await getUserDetails(email);
    
    return {
      success: true,
      data: result,
      message: 'User details retrieved successfully'
    };
  } catch (error) {
    logger.error('Failed to get Mapp Engage user details:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get user details'
    };
  }
}

/**
 * Server action to subscribe a user to a group in Mapp Engage
 */
export async function subscribeMappEngageUserToGroup(
  subscriptionData: AddToGroupRequest
): Promise<MappApiResponse> {
  try {
    await validateMappEngageAccess();
    
    if (!subscriptionData.userId || !subscriptionData.groupId) {
      throw new Error('User ID and Group ID are required');
    }
    
    const result = await addToGroup(subscriptionData);
    
    return {
      success: true,
      data: result,
      message: 'User subscribed to group successfully'
    };
  } catch (error) {
    logger.error('Failed to subscribe user to Mapp Engage group:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to subscribe user to group'
    };
  }
}

/**
 * Server action to send a single message via Mapp Engage
 */
export async function sendMappEngageSingleMessage(
  messageData: SendMessageRequest
): Promise<MappApiResponse> {
  try {
    await validateMappEngageAccess();
    
    if (!messageData.recipientId || !messageData.messageId) {
      throw new Error('Recipient ID and Message ID are required');
    }
    
    const result = await sendSingleMessage(messageData);
    
    return {
      success: true,
      data: result,
      message: 'Message sent successfully'
    };
  } catch (error) {
    logger.error('Failed to send Mapp Engage message:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send message'
    };
  }
}

/**
 * Server action to create a user and send them a message
 * This combines contact creation, group subscription, and message sending
 * 
 * @param userData - User and message data
 * @param bypassAuth - Optional flag to bypass authentication check (use with caution)
 */
export async function createUserAndSendMappEngageMessage(
  userData: CreateUserAndSendMessageRequest,
  bypassAuth: boolean = false
): Promise<MappApiResponse> {
  try {
    await validateMappEngageAccess(bypassAuth);
    
    if (!userData.email || !userData.firstName || !userData.lastName) {
      throw new Error('Email, first name, and last name are required');
    }
    
    if (!userData.groupId || !userData.messageId) {
      throw new Error('Group ID and Message ID are required');
    }
    
    const result = await createUserAndSendMessage(userData);
    
    // Revalidate relevant paths
    revalidatePath('/admin/accounts');
    
    return {
      success: true,
      data: result,
      message: 'User created and message sent successfully'
    };
  } catch (error) {
    logger.error('Failed to create user and send message:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create user and send message'
    };
  }
}
