/**
 * Mapp Engage Module - Type Definitions
 * Centralized type definitions for Mapp Engage integration
 */

// API Request Types
export interface CreateContactRequest {
  email: string;
  firstname: string;
  lastname: string;
  phone?: string;
}

export interface CreateContactBody {
  name: string;
  value: string;
}

export interface AddToGroupRequest {
  userId: string;
  groupId: string;
}

export interface SendMessageRequest {
  recipientId: string;
  messageId: string;
  parameters: {
    firstName?: string;
    url?: string;
    comment?: string;
  };
}

export interface SendMessageBody {
  parameters: Array<{
    name: string;
    value: string;
  }>;
}

export interface CreateUserAndSendMessageRequest {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  groupId: string;
  messageId: string;
  messageParameters: {
    firstName?: string;
    url?: string;
    comment?: string;
  };
}

export interface UserFlowResult {
  userExists: boolean;
  userCreated: boolean;
  userId?: string;
  subscribed: boolean;
  messageSent: boolean;
  userData?: any;
  subscriptionData?: any;
  messageData?: any;
}

// API Response Types
export interface UserDetailsResponse {
  id: string;
  email: string;
  firstname?: string;
  lastname?: string;
  phone?: string;
  // Add other fields as needed based on actual API response
}

export interface MappApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Configuration Types
export interface MappEngageConfig {
  baseUrl: string;
  authToken: string;
  groupId?: string;
  messageId?: string;
}
