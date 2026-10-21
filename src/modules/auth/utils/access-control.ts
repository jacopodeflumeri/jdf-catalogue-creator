/**
 * Access Control Utilities
 * 
 * Provides helper functions for checking employee access permissions
 * for the admin panel.
 */

import logger from '../../../lib/utils/logger';

// ============================================================================
// Access Level Definitions
// ============================================================================

// No "pending" — new users are active immediately (first user -> admin,
// everyone after -> viewer); suspended/denied remain for moderation.
export type AccessStatus = 'active' | 'suspended' | 'denied';
export type AccessLevel = 'viewer' | 'editor' | 'admin';

/**
 * Access level permissions matrix
 * Defines what each access level can do
 */
export const ACCESS_PERMISSIONS = {
  viewer: {
    canViewAccounts: true,
    canEditAccounts: false,
    canManageUsers: false,
    canViewAnalytics: true,
    canManageTeam: false,
  },
  editor: {
    canViewAccounts: true,
    canEditAccounts: true,
    canManageUsers: true,
    canViewAnalytics: true,
    canManageTeam: false,
  },
  admin: {
    canViewAccounts: true,
    canEditAccounts: true,
    canManageUsers: true,
    canViewAnalytics: true,
    canManageTeam: true,
  },
} as const;

// ============================================================================
// Access Status Helpers
// ============================================================================

/**
 * Check if access status allows login
 */
export function isAccessStatusValid(status: string): boolean {
  return status === 'active';
}

/**
 * Get user-friendly label for access status
 */
export function getAccessStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    active: 'Active',
    suspended: 'Suspended',
    denied: 'Access Denied',
  };
  return labels[status] || status;
}

/**
 * Get color class for access status badge
 */
export function getAccessStatusColor(status: string): string {
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    suspended: 'bg-orange-100 text-orange-800',
    denied: 'bg-red-100 text-red-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

// ============================================================================
// Access Level Helpers
// ============================================================================

/**
 * Check if user has required access level or higher
 */
export function hasAccessLevel(
  userLevel: AccessLevel,
  requiredLevel: AccessLevel
): boolean {
  const hierarchy: AccessLevel[] = ['viewer', 'editor', 'admin'];
  const userIndex = hierarchy.indexOf(userLevel);
  const requiredIndex = hierarchy.indexOf(requiredLevel);
  
  if (userIndex === -1 || requiredIndex === -1) {
    logger.warn('Invalid access level comparison:', { userLevel, requiredLevel });
    return false;
  }
  
  return userIndex >= requiredIndex;
}

/**
 * Get user-friendly label for access level
 */
export function getAccessLevelLabel(level: string): string {
  const labels: Record<string, string> = {
    viewer: 'Viewer',
    editor: 'Editor',
    admin: 'Admin',
  };
  return labels[level] || level;
}

/**
 * Get color class for access level badge
 */
export function getAccessLevelColor(level: string): string {
  const colors: Record<string, string> = {
    viewer: 'bg-blue-100 text-blue-800',
    editor: 'bg-purple-100 text-purple-800',
    admin: 'bg-primary-100 text-primary-800',
  };
  return colors[level] || 'bg-gray-100 text-gray-800';
}

/**
 * Get permissions for a specific access level
 */
export function getAccessLevelPermissions(level: AccessLevel) {
  return ACCESS_PERMISSIONS[level] || ACCESS_PERMISSIONS.viewer;
}

// ============================================================================
// Route Access Control
// ============================================================================

/**
 * Define which routes require which access level
 * Superadmins always have access regardless of these settings
 */
const ROUTE_ACCESS_REQUIREMENTS: Record<string, AccessLevel> = {
  '/admin': 'viewer',
  '/admin/accounts': 'viewer',
  '/admin/accounts/[id]': 'viewer',
  '/admin/user': 'viewer',
  '/admin/mapp-team': 'admin', // Only admin+ can view team
  '/admin/s3': 'editor',
  '/admin/sftp': 'editor',
  '/admin/settings': 'viewer',
  '/admin/audit-log': 'viewer',
};

/**
 * Check if user can access a specific route
 */
export function canAccessRoute(
  userLevel: AccessLevel,
  route: string,
  isSuperAdmin: boolean = false
): boolean {
  // Superadmins can access everything
  if (isSuperAdmin) return true;
  
  // Check if route has specific requirements
  const requiredLevel = ROUTE_ACCESS_REQUIREMENTS[route];
  if (!requiredLevel) {
    // If no specific requirement, allow viewer+ access
    return hasAccessLevel(userLevel, 'viewer');
  }
  
  return hasAccessLevel(userLevel, requiredLevel);
}

// ============================================================================
// Permission Checkers
// ============================================================================

/**
 * Check if user can view accounts
 */
export function canViewAccounts(
  level: AccessLevel,
  isSuperAdmin: boolean = false
): boolean {
  if (isSuperAdmin) return true;
  return getAccessLevelPermissions(level).canViewAccounts;
}

/**
 * Check if user can edit accounts
 */
export function canEditAccounts(
  level: AccessLevel,
  isSuperAdmin: boolean = false
): boolean {
  if (isSuperAdmin) return true;
  return getAccessLevelPermissions(level).canEditAccounts;
}

/**
 * Check if user can manage team members
 */
export function canManageTeam(
  level: AccessLevel,
  isSuperAdmin: boolean = false
): boolean {
  if (isSuperAdmin) return true;
  return getAccessLevelPermissions(level).canManageTeam;
}

/**
 * Check if user can manage users/contacts
 */
export function canManageUsers(
  level: AccessLevel,
  isSuperAdmin: boolean = false
): boolean {
  if (isSuperAdmin) return true;
  return getAccessLevelPermissions(level).canManageUsers;
}

/**
 * Check if user can view analytics
 */
export function canViewAnalytics(
  level: AccessLevel,
  isSuperAdmin: boolean = false
): boolean {
  if (isSuperAdmin) return true;
  return getAccessLevelPermissions(level).canViewAnalytics;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate access status value
 */
export function isValidAccessStatus(status: string): status is AccessStatus {
  return ['active', 'suspended', 'denied'].includes(status);
}

/**
 * Validate access level value
 */
export function isValidAccessLevel(level: string): level is AccessLevel {
  return ['viewer', 'editor', 'admin'].includes(level);
}

/**
 * Check if user has valid access (active status + access level)
 */
export function hasValidAccess(
  status: string,
  level: string,
  isSuperAdmin: boolean = false
): boolean {
  // Superadmins always have access
  if (isSuperAdmin) return true;
  
  // Must have active status
  if (!isAccessStatusValid(status)) {
    logger.log('Access denied: invalid status', status);
    return false;
  }
  
  // Must have a valid access level (viewer, editor, or admin)
  if (!isValidAccessLevel(level)) {
    logger.log('Access denied: invalid access level', level);
    return false;
  }
  
  return true;
}
