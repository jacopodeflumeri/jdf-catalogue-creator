/**
 * Server-Side Authentication Functions
 * 
 * This module provides server-side authentication and authorization functions
 * for Next.js Server Components and Server Actions. These functions execute
 * on the server and can redirect users or return null for API routes.
 * 
 * Key Features:
 * - Instant server-side redirects (no client flash)
 * - IP restriction checks for admin routes
 * - Super admin mode support
 * - Flexible authentication requirements
 * - API-friendly variants (no redirects)
 * 
 * @example Server Component Protection
 * ```typescript
 * import { requireCustomer } from '@/modules/auth';
 * 
 * export default async function CustomerPage() {
 *   const session = await requireCustomer();
 *   return <div>Welcome {session.user.name}</div>;
 * }
 * ```
 * 
 * @example API Route Protection
 * ```typescript
 * import { getAdminSession } from '@/modules/auth';
 * 
 * export async function GET() {
 *   const session = await getAdminSession({ requireSuperAdmin: true });
 *   if (!session) {
 *     return Response.json({ error: 'Unauthorized' }, { status: 401 });
 *   }
 *   return Response.json({ data: 'protected' });
 * }
 * ```
 */

import { cache } from 'react';
import { getServerSession } from 'next-auth';
import { authOptions } from '../config/nextauth';
import { isSessionSuperAdmin } from '../utils/auth-helpers';
import { redirect } from 'next/navigation';
import type { Session } from 'next-auth';
import { isSuperAdminOnlyMode, isIPAllowed } from '@/lib/utils/security-restrictions';
import logger from '@/lib/utils/logger';
import type { RequireAdminOptions, RequireCustomerOptions } from '../types';
import {
  resolveCustomerPreview,
  type CustomerPreviewResolution,
} from '@/modules/customer_preview/server/resolve';
import { CustomerPreviewReadOnlyError } from '@/modules/customer_preview/lib/guard';
import { CUSTOMER_PREVIEW_END_PATH } from '@/modules/customer_preview/lib/constants';

// ============================================================================
// Internal Validation Helpers
// ============================================================================

/**
 * Validates admin authentication status
 * @internal
 */
function isValidAdmin(session: Session | null, requireSuperAdmin: boolean = false, requireAdminAccess: boolean = false, requireEditorAccess: boolean = false): boolean {
  if (!session || session.user.role !== 'admin') {
    return false;
  }

  if (requireSuperAdmin && !isSessionSuperAdmin(session)) {
    return false;
  }

  if (requireAdminAccess && session.user.access !== 'admin' && !isSessionSuperAdmin(session)) {
    return false;
  }

  if (requireEditorAccess && session.user.access !== 'editor' && session.user.access !== 'admin' && !isSessionSuperAdmin(session)) {
    return false;
  }

  return true;
}

/**
 * Validates customer authentication for account selection
 * Allows customers without accountId (multiple account scenario)
 * @internal
 */
function isValidCustomerForAccountSelection(session: Session | null): boolean {
  return !!(session && session.user.role === 'customer' && session.user.userId);
}

/**
 * Validates customer authentication with required accountId
 * Also allows admins with an accountId (admin viewing as customer)
 * @internal
 */
function isValidCustomer(session: Session | null): boolean {
  if (!session) return false;

  // Company-Login (Keycloak) customers are valid even without a linked local
  // account. An un-mapped company has no Account (resolveAccountIdForCompany
  // returned null), so accountId is null — but we still want them authenticated
  // so the eligibility gate can route them to onboarding rather than bouncing
  // them back to the login screen.
  if (
    session.user.role === 'customer' &&
    session.user.authSource === 'keycloak'
  ) {
    return true;
  }

  // Legacy (magic-link) customers and admins-viewing-as-customer require an
  // accountId.
  if (!session.user.accountId) return false;
  if (session.user.role === 'customer') return true;
  if (session.user.role === 'admin') return true;

  return false;
}

// ============================================================================
// Security & IP Restriction Helpers
// ============================================================================

/**
 * Gets client IP from server-side headers
 * Checks multiple header sources for real IP (proxy, CDN, etc.)
 * @internal
 */
async function getServerClientIP(): Promise<string> {
  const { headers } = await import('next/headers');
  const headersList = await headers();
  
  // Check various headers for the real IP
  const ipHeaders = [
    'x-forwarded-for',
    'x-real-ip',
    'x-client-ip',
    'cf-connecting-ip',
    'true-client-ip',
    'x-forwarded',
    'forwarded-for',
    'forwarded'
  ];

  for (const header of ipHeaders) {
    const value = headersList.get(header);
    if (value) {
      const ip = value.split(',')[0].trim();
      if (ip && ip !== '::1' && ip !== '127.0.0.1') {
        return ip;
      }
    }
  }

  return '127.0.0.1';
}

/**
 * Checks security restrictions for admin access
 * Validates IP restrictions, super admin mode, and employee access control
 * @internal
 */
async function checkSecurityRestrictions(
  session: Session | null, 
  skipIPCheck: boolean = false
): Promise<{ allowed: boolean; redirectPath?: string }> {
  if (!session || session.user.role !== 'admin') {
    return { allowed: false, redirectPath: '/auth/signin?error=AdminRequired' };
  }

  // accessStatus is refreshed per request in the JWT callback (from the same
  // mapp_team read it already does) and carried on the session, so we enforce it
  // here without a second DB round-trip. Defaults to active for backward compat.
  const accessStatus = session.user.accessStatus || 'active';

  // Superadmins bypass access status enforcement but still go through IP checks.
  if (session.user.isSuperAdmin) {
    logger.log(`Superadmin access granted: ${session.user.email}`);
  } else {
    // Enforce access status for non-superadmins. There is no pending/approval
    // state anymore (new users are active); suspended/denied remain for
    // moderation.
    switch (accessStatus) {
      case 'suspended':
        logger.warn(`Admin access blocked - account suspended: ${session.user.email}`);
        return { allowed: false, redirectPath: '/auth/error?error=AccessSuspended' };
      case 'denied':
        logger.warn(`Admin access blocked - access denied: ${session.user.email}`);
        return { allowed: false, redirectPath: '/auth/error?error=AccessDeniedPermanent' };
      case 'active':
        // Allow through to further checks
        break;
      default:
        // If no access status set, treat as active for backward compatibility
        break;
    }
  }

  // Check IP restrictions (unless skipped)
  if (!skipIPCheck) {
    const clientIP = await getServerClientIP();
    if (!isIPAllowed(clientIP)) {
      logger.warn(`Admin access blocked for IP: ${clientIP}`);
      return { allowed: false, redirectPath: '/auth/signin?error=IPRestricted' };
    }
  }

  // Check superadmin-only mode
  if (isSuperAdminOnlyMode() && !isSessionSuperAdmin(session)) {
    logger.warn(`Admin access blocked for non-superadmin: ${session.user.email}`);
    return { allowed: false, redirectPath: '/auth/signin?error=SuperAdminRequired' };
  }

  return { allowed: true };
}

/**
 * Gets current NextAuth session — resolved ONCE per request.
 *
 * A single page render calls the require* helpers many times (the layout, the
 * page, every server action / data loader it awaits). Each call used to decode
 * the session again, which runs the JWT and session callbacks and their
 * database lookups (MappTeam refresh, auth_session row). React `cache` scopes
 * the memo to one server request, so they now share one read — and the SAME
 * session object, which the per-request caches keyed on the session
 * (eligibility, company context, customer profile) rely on. Outside a request
 * scope (tests, scripts) it simply doesn't memoize.
 * @internal
 */
const getCurrentSession = cache(async (): Promise<Session | null> => {
  return await getServerSession(authOptions);
});

/**
 * The session a customer page/action should act as, for the current request —
 * resolved ONCE (React `cache`), so every `requireCustomer` caller in the
 * request (layout, pages, `getCustomerPageScope`, eligibility, company
 * context, actions) sees the same identity and the same session OBJECT (the
 * per-request caches keyed on the session rely on that).
 *
 * This is the single hook point for the optional "View as customer" overlay
 * (`customer_preview` capability): an admin session plus a valid preview cookie
 * becomes a synthesized, read-only customer session here. With the capability
 * off, or no cookie, `preview` is `none` and nothing else runs.
 * @internal
 */
const getCustomerRequestSession = cache(
  async (): Promise<{ session: Session | null; preview: CustomerPreviewResolution }> => {
    const session = await getCurrentSession();
    const preview = await resolveCustomerPreview(session, {
      // The same admin checks requireAdmin runs (status, IP allow-list,
      // superadmin-only mode): a preview is an admin power.
      adminGate: async (s) => (await checkSecurityRestrictions(s)).allowed,
    });
    return {
      session: preview.kind === 'active' ? preview.session : session,
      preview,
    };
  },
);

/**
 * Is the current request a server-action invocation (a POST from the browser)?
 * Next marks those with the `next-action` header; page renders and route
 * handlers never carry it.
 * @internal
 */
async function isServerActionRequest(): Promise<boolean> {
  const { headers } = await import('next/headers');
  return (await headers()).has('next-action');
}

// ============================================================================
// Public Server Authentication Functions
// ============================================================================

/**
 * Server-side admin authentication with automatic redirect
 * 
 * Validates admin authentication and authorization on the server.
 * Automatically redirects if authentication fails. Perfect for Server Components
 * that require admin access.
 * 
 * Features:
 * - IP restriction enforcement (configurable)
 * - Super admin mode support
 * - Super admin requirement option
 * - Custom redirect paths
 * - No client-side flash
 * 
 * @param options - Configuration for admin requirements
 * @returns Authenticated admin session (never returns null - redirects instead)
 * @throws Redirects if authentication fails
 * 
 * @example Basic admin protection
 * ```typescript
 * const session = await requireAdmin();
 * logger.log(session.user.role); // 'admin'
 * ```
 * 
 * @example Super admin protection
 * ```typescript
 * const session = await requireAdmin({ requireSuperAdmin: true });
 * logger.log(session.user.isSuperAdmin); // true
 * ```
 * 
 * @example Custom redirects
 * ```typescript
 * const session = await requireAdmin({ 
 *   redirectTo: '/login',
 *   requireSuperAdmin: true,
 *   superAdminRedirectTo: '/admin/home'
 * });
 * ```
 */
export async function requireAdmin(options: RequireAdminOptions = {}): Promise<Session> {
  const {
    requireSuperAdmin = false,
    requireAdminAccess = false,
    requireEditorAccess = false,
    redirectTo = '/auth/signin',
    superAdminRedirectTo = '/admin',
    skipIPCheck = false
  } = options;

  const session = await getCurrentSession();

  // First check basic admin auth and security restrictions
  const securityCheck = await checkSecurityRestrictions(session, skipIPCheck);
  if (!securityCheck.allowed) {
    redirect(securityCheck.redirectPath || redirectTo);
  }

  // Then check for access level requirements
  if (!isValidAdmin(session, requireSuperAdmin, requireAdminAccess, requireEditorAccess)) {
    // If session exists but higher access is required and user doesn't have it
    if (session && session.user.role === 'admin' && (requireSuperAdmin || requireAdminAccess || requireEditorAccess)) {
      redirect(superAdminRedirectTo);
    } else {
      redirect(redirectTo);
    }
  }

  return session!; // TypeScript assertion safe here due to validation above
}

/**
 * Server-side customer authentication for account selection
 * 
 * Validates customer authentication but allows customers without accountId.
 * Used for account selection pages where customer hasn't chosen an account yet.
 * 
 * @param options - Configuration for customer requirements
 * @returns Authenticated customer session (never returns null - redirects instead)
 * @throws Redirects if authentication fails
 * 
 * @example Account selection page
 * ```typescript
 * const session = await requireCustomerForAccountSelection();
 * // Customer has userId but may not have accountId yet
 * ```
 */
export async function requireCustomerForAccountSelection(
  options: RequireCustomerOptions = {}
): Promise<Session> {
  const {
    redirectTo = '/auth/signin'
  } = options;

  const session = await getCurrentSession();

  if (!isValidCustomerForAccountSelection(session)) {
    redirect(redirectTo);
  }

  return session!; // TypeScript assertion safe here due to validation above
}

/**
 * Server-side customer authentication with automatic redirect
 * 
 * Validates customer authentication and authorization on the server.
 * Automatically redirects if authentication fails. Perfect for Server Components
 * that require customer access with a selected account.
 * 
 * @param options - Configuration for customer requirements
 * @returns Authenticated customer session (never returns null - redirects instead)
 * @throws Redirects if authentication fails
 * 
 * @example Basic customer protection
 * ```typescript
 * const session = await requireCustomer();
 * logger.log(session.user.role); // 'customer'
 * logger.log(session.user.accountId); // '123'
 * ```
 * 
 * @example Custom redirect
 * ```typescript
 * const session = await requireCustomer({ redirectTo: '/login' });
 * ```
 */
export async function requireCustomer(options: RequireCustomerOptions = {}): Promise<Session> {
  const {
    redirectTo = '/auth/signin'
  } = options;

  // The customer-preview overlay is resolved here — see getCustomerRequestSession.
  const { session, preview } = await getCustomerRequestSession();

  // "View as customer": a cookie that no longer verifies (expired, forged,
  // another admin's, admin access lost, company gone) ends the preview — the
  // end route clears the cookie and returns the admin to where they started —
  // rather than bouncing the admin to the sign-in page.
  if (preview.kind === 'invalid') {
    redirect(`${CUSTOMER_PREVIEW_END_PATH}?reason=${preview.status}`);
  }

  // Central read-only guard: during a preview, a server action is refused
  // unless it declared itself read-only. This catches a customer mutation that
  // forgot `assertNotPreview`; the explicit check stays the documented rule.
  if (
    preview.kind === 'active' &&
    !options.readOnly &&
    (await isServerActionRequest())
  ) {
    logger.warn('Customer server action refused during a customer preview', {
      adminEmail: preview.session.user.customerPreview?.adminEmail ?? null,
    });
    throw new CustomerPreviewReadOnlyError();
  }

  if (!isValidCustomer(session)) {
    redirect(redirectTo);
  }

  return session!; // TypeScript assertion safe here due to validation above
}

/**
 * Server-side authentication for customers OR admins with automatic redirect
 * 
 * Validates that user is authenticated as either a customer or admin.
 * Useful for pages that should be accessible to both user types.
 * 
 * @param options - Configuration for authentication requirements
 * @returns Authenticated session (never returns null - redirects instead)
 * @throws Redirects if authentication fails
 * 
 * @example Allow both customers and admins
 * ```typescript
 * const session = await requireCustomerOrAdmin();
 * if (session.user.role === 'customer') {
 *   // Handle customer
 * } else {
 *   // Handle admin
 * }
 * ```
 */
export async function requireCustomerOrAdmin(
  options: RequireCustomerOptions = {}
): Promise<Session> {
  const {
    redirectTo = '/auth/signin'
  } = options;

  const session = await getCurrentSession();

  // Allow if user is either a valid customer or valid admin
  if (!isValidCustomer(session) && !isValidAdmin(session)) {
    redirect(redirectTo);
  }

  return session!; // TypeScript assertion safe here due to validation above
}

// ============================================================================
// API Route Authentication Functions (No Redirects)
// ============================================================================

/**
 * Server-side admin authentication for API routes (no redirect)
 * 
 * Validates admin authentication without redirecting. Suitable for API routes
 * that need to return JSON responses instead of redirecting.
 * 
 * Returns null if authentication fails, allowing you to return proper
 * HTTP error responses.
 * 
 * @param options - Configuration for admin requirements
 * @returns Authenticated admin session or null if authentication fails
 * 
 * @example API route protection
 * ```typescript
 * export async function GET() {
 *   const session = await getAdminSession({ requireSuperAdmin: true });
 *   if (!session) {
 *     return Response.json({ error: 'Unauthorized' }, { status: 401 });
 *   }
 *   return Response.json({ data: 'protected' });
 * }
 * ```
 */
export async function getAdminSession(options: RequireAdminOptions = {}): Promise<Session | null> {
  const {
    requireSuperAdmin = false,
    requireAdminAccess = false,
    requireEditorAccess = false,
    skipIPCheck = false
  } = options;

  const session = await getCurrentSession();

  // Check security restrictions for API routes
  const securityCheck = await checkSecurityRestrictions(session, skipIPCheck);
  if (!securityCheck.allowed) {
    return null;
  }

  return isValidAdmin(session, requireSuperAdmin, requireAdminAccess, requireEditorAccess) ? session : null;
}

/**
 * Server-side customer authentication for API routes (no redirect)
 * 
 * Validates customer authentication without redirecting. Suitable for API routes
 * that need to return JSON responses instead of redirecting.
 * 
 * Returns null if authentication fails, allowing you to return proper
 * HTTP error responses.
 * 
 * @param options - Configuration for customer requirements
 * @returns Authenticated customer session or null if authentication fails
 * 
 * @example API route protection
 * ```typescript
 * export async function GET() {
 *   const session = await getCustomerSession();
 *   if (!session) {
 *     return Response.json({ error: 'Unauthorized' }, { status: 401 });
 *   }
 *   return Response.json({ accountId: session.user.accountId });
 * }
 * ```
 */
export async function getCustomerSession(
  _options: RequireCustomerOptions = {}
): Promise<Session | null> {
  const session = await getCurrentSession();

  return isValidCustomer(session) ? session : null;
}
