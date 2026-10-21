/**
 * Auth Module - Client-Safe Exports
 * 
 * This entry point exports ONLY client-safe functions and utilities
 * that don't have server-only dependencies (like sharp, child_process, etc.)
 * 
 * Use this in client components:
 * ```typescript
 * 'use client';
 * import { useAdminAuth, isSessionSuperAdmin } from '@/modules/auth/client';
 * ```
 * 
 * For server components and API routes, use the main export:
 * ```typescript
 * import { requireAdmin, authOptions } from '@/modules/auth';
 * ```
 */

// ============================================================================
// Types (always safe to export)
// ============================================================================

export type {
  UserRole,
  AuthUser,
  AuthSession,
  AuthUserExtended,
  AuthJWT,
  CustomerAuthResult,
  AdminAuthResult,
  CustomerOrAdminAuthResult,
  RequireAdminOptions,
  RequireCustomerOptions,
  RequireFeatureOptions,
  UseAdminAuthOptions,
  UseAdminAuthReturn,
  UseAuthErrorOptions,
  AuthError,
  AuthErrorState,
  AdminAuthContext,
  CustomerAuthContext,
  GenericAuthContext,
  FeatureFlags,
  FeatureAccessResult,
} from './types';

export {
  isAuthSession,
  isCustomerSession,
  isAdminSession,
  isSuperAdminSession,
  isAdminAccessSession,
} from './types';

// ============================================================================
// Client-Side Hooks (safe for client components)
// ============================================================================

export { useAdminAuth } from './client/hooks/useAdminAuth';
export { useAccessLevel } from './client/hooks/useAccessLevel';
export { useAuthErrorHandler } from './client/hooks/useAuthError';

// ============================================================================
// Client Components (safe for client components)
// ============================================================================

export { default as AdminAuthErrorHandler } from './components/AdminAuthErrorHandler';
export { default as AdminErrorBoundary } from './components/AdminErrorBoundary';
export { AdminErrorProvider, useAdminError } from './components/AdminErrorProvider';
export { AuthErrorBoundary } from './components/AuthErrorBoundary';
export { AuthErrorProvider, useAuthError } from './components/AuthErrorProvider';

// ============================================================================
// Client-Safe Utilities (no server dependencies)
// ============================================================================

export {
  isSuperAdmin,
  isSessionSuperAdmin,
  isAdmin,
  isCustomer,
  isCompanyCustomer,
  getUserDisplayName,
  getUserEmail,
  isSessionValid,
} from './utils/auth-helpers';

// ============================================================================
// Client-Safe Server Actions
// ============================================================================

export { confirmMagicLinkAction } from './client/actions';

/**
 * Note: Server-only functions (requireAdmin, requireCustomer, authOptions, magic link utilities)
 * are available from '@/modules/auth/server'
 */
