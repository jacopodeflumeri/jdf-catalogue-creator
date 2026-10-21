/**
 * Auth Module - Server-Only Exports
 * 
 * This entry point exports ALL auth functionality including server-only
 * dependencies. Use this in server components, API routes, and server actions.
 * 
 * ⚠️ WARNING: Do NOT import from this file in client components!
 * Use '@/modules/auth/client' for client components instead.
 * 
 * @example Server component
 * ```typescript
 * import { requireAdmin, requireCustomer } from '@/modules/auth/server';
 * 
 * export default async function Page() {
 *   const { session, account } = await requireCustomer();
 *   return <div>Welcome {account.name}</div>;
 * }
 * ```
 * 
 * @example API route
 * ```typescript
 * import { withAdminAuth, authOptions } from '@/modules/auth/server';
 * 
 * export const GET = withAdminAuth(async (request, { session }) => {
 *   return Response.json({ data: 'protected' });
 * });
 * ```
 * 
 * @example Server action
 * ```typescript
 * 'use server';
 * import { requireAdmin, sendCustomerMagicLink } from '@/modules/auth/server';
 * 
 * export async function sendMagicLink(email: string) {
 *   await requireAdmin();
 *   return await sendCustomerMagicLink(email, '', '', undefined, undefined, '/account', false);
 * }
 * ```
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
// Configuration
// ============================================================================

export { authOptions } from './config/nextauth';
export { default as NextAuthHandler } from './config/nextauth';

// ============================================================================
// Server-Side Authentication
// ============================================================================

export {
  requireCustomer,
  requireAdmin,
  requireCustomerOrAdmin,
  requireCustomerForAccountSelection,
  getCustomerSession,
  getAdminSession,
} from './server/require-auth';

// ============================================================================
// Company Context (Keycloak Company-Login customers)
// ============================================================================

export {
  resolveCompanyContext,
  type CompanyContext,
} from './server/company-context';
export {
  evaluateCustomerEligibility,
  requireEligibleCustomer,
  defaultCustomerEligibilityPolicy,
  customerEligibilityPolicy,
  type CustomerEligibility,
  type CustomerEligibilityPolicy,
} from './server/customer-eligibility';
export {
  getCustomerPageScope,
  requireEligibleCustomerPageScope,
  type CustomerPageScope,
  type CustomerPageScopeOptions,
} from './server/customer-page-scope';
export {
  resolveUsageAttribution,
  type UsageAttribution,
} from './server/usage-attribution';
export { resolveAccountIdForCompany } from './server/company-account-resolver';

// ============================================================================
// Access Control
// ============================================================================

export {
  requireFeature,
  requireAnyFeature,
  requireAllFeatures,
  checkFeature,
  checkFeatureAccess,
} from './server/access-control';

// ============================================================================
// API Helpers
// ============================================================================

export {
  withAdminAuth,
  withCustomerAuth,
  withAuth,
  type ApiHandler,
} from './server/api-helpers';

// ============================================================================
// Magic Link
// ============================================================================

export {
  buildMagicLinkUrl,
  generateMagicLinkToken,
  generateMagicLinkUrl,
  generateCustomerMagicLinkUrl,
  generateCustomerMagicLinkUrlClient,
  sendCustomerMagicLink,
} from './server/magic-link';

export {
  validateMagicLinkToken,
  confirmMagicLinkToken,
  authenticateMagicLink,
} from './server/magic-link-actions';

// Magic Link Client Actions (Server Actions for Client Components)
export {
  generateAdminMagicLinkAction,
  generateCustomerMagicLinkAction,
  sendCustomerMagicLinkAction,
} from './server/magic-link-client-actions';

// ============================================================================
// Utilities (All - Including Server-Only)
// ============================================================================

export {
  isSuperAdmin,
  isSessionSuperAdmin,
  isAdmin,
  isCustomer,
  isCompanyCustomer,
  generateAccountEmail,
  parseAccountEmail,
  getUserDisplayName,
  getUserEmail,
  isSessionValid,
} from './utils/auth-helpers';

// ============================================================================
// Server Actions
// ============================================================================

export { switchAccountAction } from './server/switch-account-action';
export { switchAccount } from './server/switch-account';
export {
  getTeamMemberByEmailAction,
  getRawTeamMemberByEmailAction,
  createTeamMemberForAuthAction,
  updateTeamMemberForAuthAction,
  getUserAccountsByIdAction,
} from './server/team-member-actions';

// ============================================================================
// Server Utilities
// ============================================================================

export { handleAdminAuthError, withAdminAuthHandling } from './utils/admin-error-helpers';

// ============================================================================
// Client Hooks (Re-exported for Convenience)
// ============================================================================

export { useAdminAuth } from './client/hooks/useAdminAuth';
export { useAuthErrorHandler } from './client/hooks/useAuthError';
