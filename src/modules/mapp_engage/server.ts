/**
 * Mapp Engage Module - Server-only Exports
 * This file should only be imported in server components and server actions
 * 
 * @module mapp_engage/server
 */

'use server';

// Server-only validation utilities
export { 
  validateMappEngageAccess,
  isValidEmail,
  validateContactData,
} from './utils/validation';
