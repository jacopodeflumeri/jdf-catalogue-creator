/**
 * Auth Module - Public API (Client-Safe Default)
 * 
 * This barrel export provides ONLY client-safe exports to avoid bundling
 * server-only dependencies (sharp, child_process, etc.) into client bundles.
 * 
 * 📦 Import Paths:
 * 
 * **For Client Components** (safe for browser):
 * ```typescript
 * import { useAdminAuth, isSessionSuperAdmin } from '@/modules/auth';
 * // or explicitly:
 * import { useAdminAuth } from '@/modules/auth/client';
 * ```
 * 
 * **For Server Components & API Routes** (has server-only dependencies):
 * ```typescript
 * import { requireAdmin, authOptions, sendCustomerMagicLink } from '@/modules/auth/server';
 * // or import specific files:
 * import { authOptions } from '@/modules/auth/config/nextauth';
 * import { requireAdmin } from '@/modules/auth/server/require-auth';
 * ```
 * 
 * This design prevents the "Module not found: Can't resolve 'child_process'" error
 * that occurs when client components try to import server-only code.
 */

// ============================================================================
// Types
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
// Configuration - NOT EXPORTED (Server-Only Dependencies)
// ============================================================================

// NextAuth configuration, server auth functions, and magic link utilities are
// NOT exported from the main barrel to avoid pulling server-only dependencies
// (sharp, child_process, etc.) into client components.
//
// For server components and API routes, import directly:
// import { authOptions } from '@/modules/auth/config/nextauth';
// import { requireAdmin, requireCustomer } from '@/modules/auth/server/require-auth';
// import { sendCustomerMagicLink } from '@/modules/auth/server/magic-link';
//
// For client components, use '@/modules/auth/client' instead:
// import { useAdminAuth, isSessionSuperAdmin } from '@/modules/auth/client';

// ============================================================================
// Client-Side Hooks
// ============================================================================

export { useAdminAuth } from './client/hooks/useAdminAuth';
export { useAccessLevel } from './client/hooks/useAccessLevel';
export { useAuthErrorHandler } from './client/hooks/useAuthError';

// ============================================================================
// Client-Safe Utilities
// ============================================================================

// Only export client-safe utilities that don't have server-only dependencies
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
