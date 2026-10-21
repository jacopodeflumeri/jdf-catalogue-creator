/**
 * Auth Module - Helper Utilities
 * 
 * Pure utility functions for authentication logic.
 * These functions are framework-agnostic and easily testable.
 */

import logger from '@/lib/utils/logger';
import { config } from '@/config';
import type { Session } from 'next-auth';
import type { AuthSession } from '../types';

// ============================================================================
// Role & Permission Checks
// ============================================================================

/**
 * Check if a user is a super admin based on their email
 * Checks BOTH the environment variable AND the database flag
 * @param email The user's email address
 * @param dbSuperAdminFlag Optional database superadmin flag from MappTeam record
 * @returns True if the user is a super admin (either env or db)
 */
export function isSuperAdmin(email: string | null | undefined, dbSuperAdminFlag?: boolean): boolean {
  if (!email) {
    logger.log('isSuperAdmin: No email provided');
    return false;
  }
  
  // Check database flag first if provided
  if (dbSuperAdminFlag === true) {
    logger.log(`isSuperAdmin: ${email} is superadmin via database flag`);
    return true;
  }
  
  // Check environment variable
  const normalizedEmail = email.toLowerCase();
  const superAdmins = config.auth.superAdmins;
  const isIncluded = superAdmins.includes(normalizedEmail);

  if (isIncluded) {
    logger.log(`isSuperAdmin: ${email} is superadmin via environment variable`);
  }

  return isIncluded;
}

/**
 * Check if the current session user is a super admin
 * @param session The NextAuth session
 * @returns True if the session user is a super admin
 */
export function isSessionSuperAdmin(session: Session | AuthSession | null): boolean {
  if (!session?.user) {
    logger.log('isSessionSuperAdmin: No session or user found');
    return false;
  }
  
  // Use the isSuperAdmin flag from the session (set during authentication)
  const isSuper = session.user.isSuperAdmin || false;
  
  return isSuper;
}

export function isSessionAdminAccess(session: Session | AuthSession | null): boolean {
  if (!session?.user) {
    logger.log('isSessionAdminAccess: No session or user found');
    return false;
  }

  // Check for both super admin and admin access level
  const isSuper = session.user.isSuperAdmin || false;
  const isAdmin = session.user.access === 'admin';

  return isSuper || isAdmin;
}

/**
 * Check if a user is an admin (any admin role)
 * @param session The NextAuth session
 * @returns True if the user is an admin
 */
export function isAdmin(session: Session | AuthSession | null): boolean {
  return session?.user?.role === 'admin';
}

/**
 * Check if a user is a customer
 * @param session The NextAuth session
 * @returns True if the user is a customer
 */
export function isCustomer(session: Session | AuthSession | null): boolean {
  return session?.user?.role === 'customer';
}

/**
 * Is this a Company-Login (Keycloak / Mapp Cloud) customer, as opposed to a
 * legacy magic-link customer? Company customers are identified by company
 * context (companyId/workspaces) and have NO local User/Account, so they must
 * NOT be routed through the legacy magic-link customer portal.
 *
 * Pure function — safe on the server (getServerSession) or client (useSession).
 *
 * @param session The NextAuth session
 * @returns True if the user is a Company-Login customer
 */
export function isCompanyCustomer(
  session: Session | AuthSession | null,
): boolean {
  return (
    session?.user?.role === 'customer' &&
    session?.user?.authSource === 'keycloak'
  );
}

// ============================================================================
// Account Management
// ============================================================================

/**
 * Generate a standardized email address for an account
 * @param accountId The account ID
 * @returns Formatted account email
 */
export function generateAccountEmail(accountId: number): string {
  return `${accountId}.labs@mapp.com`;
}

/**
 * Parse an account email to extract the account ID
 * @param email The email to parse
 * @returns Object with parsing result and account ID if valid
 */
export function parseAccountEmail(email: string): { 
  isAccountEmail: boolean; 
  accountId?: number;
} {
  const match = email.match(/^(\d+)\.labs@mapp\.com$/);
  if (match) {
    return {
      isAccountEmail: true,
      accountId: parseInt(match[1], 10)
    };
  }
  return { isAccountEmail: false };
}

/**
 * MOVED TO SERVER-ONLY MODULE
 * 
 * switchAccount() has been moved to @/modules/auth/server to prevent
 * server-only dependencies from being bundled in client code.
 * 
 * For server components and API routes, import from:
 * import { switchAccount } from '@/modules/auth/server';
 * 
 * For client components, use the switchAccountAction server action:
 * import { switchAccountAction } from '@/modules/auth/server/switch-account-action';
 */

// ============================================================================
// Session Utilities
// ============================================================================

/**
 * Get user display name from session
 * @param session The NextAuth session
 * @returns User's display name or 'User'
 */
export function getUserDisplayName(session: Session | AuthSession | null): string {
  if (!session?.user) return 'User';
  
  if (session.user.name) return session.user.name;
  if (session.user.email) return session.user.email.split('@')[0];
  
  return 'User';
}

/**
 * Get user email from session
 * @param session The NextAuth session
 * @returns User's email or null
 */
export function getUserEmail(session: Session | AuthSession | null): string | null {
  return session?.user?.email || null;
}

/**
 * Check if session is valid and not expired
 * @param session The NextAuth session
 * @returns True if session is valid
 */
export function isSessionValid(session: Session | AuthSession | null): boolean {
  if (!session) return false;
  if (!session.user) return false;
  if (!session.user.role) return false;
  
  return true;
}
