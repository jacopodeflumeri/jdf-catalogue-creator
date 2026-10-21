/**
 * Mapp Engage Module - Validation Utilities
 * Authentication and access validation for Mapp Engage services
 * 
 * ⚠️ SERVER-ONLY: This file imports authOptions which has server-only dependencies
 */

import { getServerSession } from 'next-auth';
import { authOptions } from '@/modules/auth/config/nextauth';
import logger from '@/lib/utils/logger';

/**
 * Validates that the current user has access to Mapp Engage services
 * This ensures only authenticated users (admin or customer) can use these services
 * 
 * @param bypassAuth - Optional flag to bypass authentication check (use with caution)
 * @returns Promise<boolean> - True if access is granted
 * @throws Error if validation fails
 */
export async function validateMappEngageAccess(bypassAuth: boolean = false): Promise<boolean> {
  try {
    if (bypassAuth) {
      logger.warn('Mapp Engage access validation bypassed');
      return true;
    }

    const session = await getServerSession(authOptions);

    if (!session?.user) {
      throw new Error('No authenticated session found');
    }

    // Allow both admin and customer users to access Mapp Engage services
    if (session.user.role === 'admin' || session.user.role === 'customer') {
      return true;
    }

    throw new Error('Insufficient permissions for Mapp Engage access');
  } catch (error) {
    logger.error('Mapp Engage access validation failed:', error);
    throw error;
  }
}

/**
 * Validates email format
 * @param email - Email address to validate
 * @returns boolean - True if email is valid
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates contact data before creating a contact
 * @param data - Contact data to validate
 * @throws Error if validation fails
 */
export function validateContactData(data: { email: string; firstname: string; lastname: string }): void {
  if (!data.email || !isValidEmail(data.email)) {
    throw new Error('Valid email is required');
  }

  if (!data.firstname || data.firstname.trim().length === 0) {
    throw new Error('First name is required');
  }

  if (!data.lastname || data.lastname.trim().length === 0) {
    throw new Error('Last name is required');
  }
}
