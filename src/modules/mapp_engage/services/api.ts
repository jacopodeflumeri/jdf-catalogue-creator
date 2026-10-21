/**
 * Mapp Engage Module - API Service
 * Core API service layer for communicating with Mapp Engage platform
 * Handles contact management, user details, messaging, and group subscriptions
 */

import logger from '@/lib/utils/logger';
import { fetchWithRetry } from '@/lib/utils/fetch-with-retry';
import { mappEngageConfig, ensureMappEngageConfigured, getMappEngageHeaders } from '../config';
import type {
  CreateContactRequest,
  CreateContactBody,
  UserDetailsResponse,
  AddToGroupRequest,
  SendMessageRequest,
  SendMessageBody,
  CreateUserAndSendMessageRequest,
  UserFlowResult,
} from '../types';

const BASE_URL = mappEngageConfig.baseUrl;

/**
 * Creates a new contact in Mapp Engage
 * @param contactData - Contact information
 * @returns Promise with the created contact data
 */
export async function createContact(contactData: CreateContactRequest): Promise<any> {
  ensureMappEngageConfigured();
  
  try {
    const body: CreateContactBody[] = [
      { name: 'user.Firstname', value: contactData.firstname },
      { name: 'user.Lastname', value: contactData.lastname },
    ];

    // Add phone if provided
    if (contactData.phone) {
      body.push({ name: 'user.customattribute.Phone', value: contactData.phone });
    }

    const response = await fetchWithRetry(`${BASE_URL}/user/create?email=${encodeURIComponent(contactData.email)}`, {
      method: 'POST',
      headers: getMappEngageHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Mapp Engage API error:', errorText);
      throw new Error(`Failed to create contact: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    logger.info('Contact created successfully in Mapp Engage');
    return result;
  } catch (error) {
    logger.error('Error creating Mapp Engage contact:', error);
    throw error;
  }
}

/**
 * Retrieves user details from Mapp Engage by email
 * @param email - User's email address
 * @returns Promise with user details
 */
export async function getUserDetails(email: string): Promise<UserDetailsResponse> {
  ensureMappEngageConfigured();
  
  try {
    if (!email) {
      throw new Error('Email is required to get user details');
    }

    const response = await fetchWithRetry(`${BASE_URL}/user/getByEmail?email=${encodeURIComponent(email)}`, {
      method: 'GET',
      headers: getMappEngageHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Mapp Engage API error:', errorText);
      throw new Error(`Failed to get user details: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    logger.info('User details retrieved successfully from Mapp Engage');
    return result;
  } catch (error) {
    logger.error('Error getting Mapp Engage user details:', error);
    throw error;
  }
}

/**
 * Adds a user to a group in Mapp Engage
 * @param subscriptionData - User and group information
 * @returns Promise with the subscription result
 */
export async function addToGroup(subscriptionData: AddToGroupRequest): Promise<any> {
  ensureMappEngageConfigured();
  
  try {
    if (!subscriptionData.userId || !subscriptionData.groupId) {
      throw new Error('User ID and Group ID are required');
    }

    const response = await fetchWithRetry(
      `${BASE_URL}/membership/create?userId=${encodeURIComponent(subscriptionData.userId)}&groupId=${encodeURIComponent(subscriptionData.groupId)}`,
      {
        method: 'GET',
        headers: getMappEngageHeaders(),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Mapp Engage API error:', errorText, response);
      throw new Error(`Failed to add user to group: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    logger.info('User added to group successfully in Mapp Engage');
    return result;
  } catch (error) {
    logger.error('Error adding user to Mapp Engage group:', error);
    throw error;
  }
}

/**
 * Sends a single message to a user via Mapp Engage
 * @param messageData - Message and recipient information
 * @returns Promise with the message send result
 */
export async function sendSingleMessage(messageData: SendMessageRequest): Promise<any> {
  ensureMappEngageConfigured();
  
  try {
    if (!messageData.recipientId || !messageData.messageId) {
      throw new Error('Recipient ID and Message ID are required');
    }

    const parameters: Array<{ name: string; value: string }> = [];

    // Add parameters if provided
    if (messageData.parameters.firstName) {
      parameters.push({ name: 'FirstName', value: messageData.parameters.firstName });
    }
    if (messageData.parameters.url) {
      parameters.push({ name: 'URL', value: messageData.parameters.url });
    }
    if (messageData.parameters.comment) {
      parameters.push({ name: 'Comment', value: messageData.parameters.comment });
    }

    const body: SendMessageBody = { parameters };

    const response = await fetchWithRetry(
      `${BASE_URL}/message/sendSingle?recipientId=${encodeURIComponent(messageData.recipientId)}&messageId=${encodeURIComponent(messageData.messageId)}`,
      {
        method: 'POST',
        headers: getMappEngageHeaders(),
        body: JSON.stringify(body),
      }
    );

    logger.info(`Sending message to recipient ID: ${messageData.recipientId}`, body);

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Mapp Engage API error:', errorText);
      throw new Error(`Failed to send message: ${response.status} ${response.statusText}`);
    }

    // API returns 204 No Content on success, so return a success indicator instead of parsing JSON
    const result = { success: true, status: response.status };
    logger.info('Message sent successfully via Mapp Engage');
    return result;
  } catch (error) {
    logger.error('Error sending Mapp Engage message:', error);
    throw error;
  }
}

/**
 * Creates a user and sends them a message in one operation
 * This is a comprehensive function that handles the entire user onboarding/messaging process
 * Checks if user exists first, creates only if needed, then subscribes and sends message
 * @param data - Complete user and message information
 * @returns Promise with detailed result of each step
 */
export async function createUserAndSendMessage(
  data: CreateUserAndSendMessageRequest
): Promise<UserFlowResult> {
  ensureMappEngageConfigured();
  
  const result: UserFlowResult = {
    userExists: false,
    userCreated: false,
    subscribed: false,
    messageSent: false,
  };

  try {
    logger.info(`Starting user flow for email: ${data.email}`);

    // Step 1: Check if user exists
    let userData: any;
    try {
      userData = await getUserDetails(data.email);
      result.userExists = true;
      result.userId = userData.id;
      result.userData = userData;
      logger.info(`User exists with ID: ${userData.id}`);
    } catch {
      logger.info('User does not exist, will create new user');
      result.userExists = false;
    }

    // Step 2: Create user if they don't exist
    if (!result.userExists) {
      try {
        const contactData: CreateContactRequest = {
          email: data.email,
          firstname: data.firstName,
          lastname: data.lastName,
          phone: data.phone,
        };
        
        userData = await createContact(contactData);
        result.userCreated = true;
        result.userId = userData.id;
        result.userData = userData;
        logger.info(`User created successfully with ID: ${userData.id}`);
      } catch (error) {
        logger.error('Failed to create user:', error);
        throw new Error(`Failed to create user: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Step 3: Subscribe user to group (always done)
    try {
      const subscriptionData: AddToGroupRequest = {
        userId: result.userId || data.email, // Use user ID if available, fallback to email
        groupId: data.groupId,
      };
      
      const subscriptionResult = await addToGroup(subscriptionData);
      result.subscribed = true;
      result.subscriptionData = subscriptionResult;
      logger.info(`User subscribed to group ${data.groupId} successfully`);
    } catch (error) {
      logger.error('Failed to subscribe user to group:', error);
      throw new Error(`Failed to subscribe user to group: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Step 4: Send message (always done)
    try {
      const messageData: SendMessageRequest = {
        recipientId: result.userId || data.email,
        messageId: data.messageId,
        parameters: data.messageParameters,
      };

      logger.info(`Sending message to user ID: ${messageData.recipientId}`, messageData);

      const messageResult = await sendSingleMessage(messageData);
      result.messageSent = true;
      result.messageData = messageResult;
      logger.info(`Message sent successfully to user ${result.userId}`);
    } catch (error) {
      logger.error('Failed to send message:', error);
      throw new Error(`Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    logger.info('User flow completed successfully:', result);
    return result;

  } catch (error) {
    logger.error('User flow failed:', error);
    throw error;
  }
}
