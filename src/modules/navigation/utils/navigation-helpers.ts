/**
 * Navigation Helper Functions
 * 
 * Pure utility functions for navigation logic.
 * These are portable and can be reused in other projects.
 */

import type { NavigationUserProfile } from '../types';

/**
 * Get initials from a full name
 * @param name - Full name (e.g., "John Doe")
 * @returns Initials (e.g., "JD")
 */
export function getInitials(name: string): string {
  if (!name) return '??';
  
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
  }
  
  return name.substring(0, 2).toUpperCase();
}

/**
 * Get user initials from profile or session data
 * @param userProfile - User profile object
 * @param userName - User name from session
 * @param userEmail - User email from session
 * @returns User initials
 */
export function getUserInitials(
  userProfile: NavigationUserProfile | null | undefined,
  userName?: string | null,
  userEmail?: string | null
): string {
  if (userProfile) {
    return `${userProfile.firstname.charAt(0)}${userProfile.lastname.charAt(0)}`.toUpperCase();
  }
  
  if (userName) {
    return getInitials(userName);
  }
  
  if (userEmail) {
    return userEmail.substring(0, 2).toUpperCase();
  }
  
  return '??';
}

/**
 * Get user display name from profile or session data
 * @param userProfile - User profile object
 * @param userName - User name from session
 * @param userEmail - User email from session
 * @returns Display name
 */
export function getUserDisplayName(
  userProfile: NavigationUserProfile | null | undefined,
  userName?: string | null,
  userEmail?: string | null
): string {
  if (userProfile) {
    return `${userProfile.firstname} ${userProfile.lastname}`;
  }
  
  return userName || userEmail || 'User';
}

/**
 * Determine logo href based on current pathname
 * This is a default implementation that can be overridden via config
 * 
 * @param pathname - Current pathname
 * @returns Logo link href
 */
export function getDefaultLogoHref(pathname: string): string {
  if (pathname.startsWith('/account')) {
    return '/account';
  }
  
  if (pathname.startsWith('/admin')) {
    return '/admin';
  }
  
  return '/';
}
