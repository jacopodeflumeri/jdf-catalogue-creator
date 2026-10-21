/**
 * Mapp Engage Module
 * Centralized integration for Mapp Engage email marketing platform
 * 
 * This module provides a complete solution for interacting with Mapp Engage API,
 * including contact management, user details retrieval, group subscriptions, and messaging.
 * 
 * @module mapp_engage
 * 
 * @example
 * ```tsx
 * // Using the hook in a client component
 * import { useMappEngage } from '@/modules/mapp_engage';
 * 
 * function MyComponent() {
 *   const { createContact, isPending } = useMappEngage();
 *   
 *   const handleCreate = async () => {
 *     await createContact({
 *       email: 'user@example.com',
 *       firstname: 'John',
 *       lastname: 'Doe'
 *     });
 *   };
 * }
 * ```
 * 
 * @example
 * ```tsx
 * // Using server actions directly
 * import { createMappEngageContact } from '@/modules/mapp_engage';
 * 
 * async function serverFunction() {
 *   const result = await createMappEngageContact({
 *     email: 'user@example.com',
 *     firstname: 'John',
 *     lastname: 'Doe'
 *   });
 * }
 * ```
 */

// Configuration
export { 
  mappEngageConfig,
  validateMappEngageConfig,
  ensureMappEngageConfigured,
  isMappEngageConfigured,
  getMappEngageHeaders
} from './config';

// Types
export type {
  CreateContactRequest,
  CreateContactBody,
  AddToGroupRequest,
  SendMessageRequest,
  SendMessageBody,
  CreateUserAndSendMessageRequest,
  UserFlowResult,
  UserDetailsResponse,
  MappApiResponse,
  MappEngageConfig,
} from './types';

// Services - API
export {
  createContact,
  getUserDetails,
  addToGroup,
  sendSingleMessage,
  createUserAndSendMessage,
} from './services/api';

// Services - Server Actions
export {
  createMappEngageContact,
  getMappEngageUserDetails,
  subscribeMappEngageUserToGroup,
  sendMappEngageSingleMessage,
  createUserAndSendMappEngageMessage,
} from './services/actions';

// Hooks
export { useMappEngage } from './hooks/useMappEngage';

// Note: Server-only utilities (validateMappEngageAccess, isValidEmail, validateContactData)
// are available in '@/modules/mapp_engage/server' to prevent bundling server code in client components
