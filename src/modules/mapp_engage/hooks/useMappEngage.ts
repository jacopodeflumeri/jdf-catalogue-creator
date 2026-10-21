/**
 * Mapp Engage Module - React Hook
 * Client-side hook for managing Mapp Engage API operations with loading states and toast notifications
 */

'use client';

import { useTransition } from 'react';
import { useToast } from '@/components/providers/ToastProvider';
import {
  createMappEngageContact,
  getMappEngageUserDetails,
  subscribeMappEngageUserToGroup,
  sendMappEngageSingleMessage,
  createUserAndSendMappEngageMessage
} from '../services/actions';
import type {
  CreateContactRequest,
  AddToGroupRequest,
  SendMessageRequest,
  CreateUserAndSendMessageRequest
} from '../types';

/**
 * Hook for managing Mapp Engage API operations with loading states and toast notifications
 * 
 * @returns Object containing API methods and loading state
 * 
 * @example
 * ```tsx
 * const { createContact, isPending } = useMappEngage();
 * 
 * const handleCreateContact = async () => {
 *   const result = await createContact({
 *     email: 'user@example.com',
 *     firstname: 'John',
 *     lastname: 'Doe'
 *   });
 * };
 * ```
 */
export function useMappEngage() {
  const [isPending, startTransition] = useTransition();
  const { addToast } = useToast();

  const createContact = async (contactData: CreateContactRequest) => {
    return new Promise<any>((resolve, reject) => {
      startTransition(async () => {
        try {
          const result = await createMappEngageContact(contactData);
          
          if (result.success) {
            addToast({
              type: 'success',
              message: result.message || 'Contact created successfully'
            });
            resolve(result.data);
          } else {
            addToast({
              type: 'error',
              message: result.error || 'Failed to create contact'
            });
            reject(new Error(result.error));
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to create contact';
          addToast({
            type: 'error',
            message: errorMessage
          });
          reject(error);
        }
      });
    });
  };

  const getUserDetails = async (email: string) => {
    return new Promise<any>((resolve, reject) => {
      startTransition(async () => {
        try {
          const result = await getMappEngageUserDetails(email);
          
          if (result.success) {
            addToast({
              type: 'success',
              message: result.message || 'User details retrieved successfully'
            });
            resolve(result.data);
          } else {
            addToast({
              type: 'error',
              message: result.error || 'Failed to get user details'
            });
            reject(new Error(result.error));
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to get user details';
          addToast({
            type: 'error',
            message: errorMessage
          });
          reject(error);
        }
      });
    });
  };

  const subscribeToGroup = async (subscriptionData: AddToGroupRequest) => {
    return new Promise<any>((resolve, reject) => {
      startTransition(async () => {
        try {
          const result = await subscribeMappEngageUserToGroup(subscriptionData);
          
          if (result.success) {
            addToast({
              type: 'success',
              message: result.message || 'User subscribed to group successfully'
            });
            resolve(result.data);
          } else {
            addToast({
              type: 'error',
              message: result.error || 'Failed to subscribe user to group'
            });
            reject(new Error(result.error));
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to subscribe user to group';
          addToast({
            type: 'error',
            message: errorMessage
          });
          reject(error);
        }
      });
    });
  };

  const sendMessage = async (messageData: SendMessageRequest) => {
    return new Promise<any>((resolve, reject) => {
      startTransition(async () => {
        try {
          const result = await sendMappEngageSingleMessage(messageData);
          
          if (result.success) {
            addToast({
              type: 'success',
              message: result.message || 'Message sent successfully'
            });
            resolve(result.data);
          } else {
            addToast({
              type: 'error',
              message: result.error || 'Failed to send message'
            });
            reject(new Error(result.error));
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
          addToast({
            type: 'error',
            message: errorMessage
          });
          reject(error);
        }
      });
    });
  };

  const createUserAndSendMessage = async (userData: CreateUserAndSendMessageRequest) => {
    return new Promise<any>((resolve, reject) => {
      startTransition(async () => {
        try {
          const result = await createUserAndSendMappEngageMessage(userData);
          
          if (result.success) {
            addToast({
              type: 'success',
              message: result.message || 'User created and message sent successfully'
            });
            resolve(result.data);
          } else {
            addToast({
              type: 'error',
              message: result.error || 'Failed to create user and send message'
            });
            reject(new Error(result.error));
          }
        } catch (error) {
          const errorMessage = error instanceof Error 
            ? error.message 
            : 'Failed to create user and send message';
          addToast({
            type: 'error',
            message: errorMessage
          });
          reject(error);
        }
      });
    });
  };

  return {
    // API Methods
    createContact,
    getUserDetails,
    subscribeToGroup,
    sendMessage,
    createUserAndSendMessage,
    
    // State
    isPending,
  };
}
