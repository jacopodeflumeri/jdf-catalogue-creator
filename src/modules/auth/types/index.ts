/**
 * Auth Module - Type Definitions
 *
 * Centralized authentication types for the auth module.
 * These types extend NextAuth's base types with application-specific fields.
 */

import type { DefaultSession, DefaultUser, Session as NextAuthSession } from 'next-auth';
import type { JWT as NextAuthJWT } from 'next-auth/jwt';
import type { AccountData, CustomerAccountData, S3Image } from '@/types';

// ============================================================================
// Core Auth Types
// ============================================================================

/**
 * User role enumeration
 */
export type UserRole = 'customer' | 'admin';

/**
 * Where the session identity originated.
 * - keycloak: brokered through the Keycloak labs realm (Entra or Company Login)
 * - nextauth-azure: legacy direct Azure AD provider (also used by the dev bypass)
 * - magic-link: optional legacy email magic-link customer path (capability,
 *   off by default — see config.magicLink)
 */
export type AuthSource = 'keycloak' | 'nextauth-azure' | 'magic-link';

/**
 * Resolved upstream identity provider behind the login.
 */
export type IdentityProvider = 'entra' | 'internal' | 'mapp-cloud';

/**
 * A Mapp Cloud workspace the user can access, with its entitled services.
 * `workspaceId` corresponds to the client-catalog workspace id.
 */
export interface WorkspaceAccess {
  workspaceId: string;
  services: string[];
}

/**
 * What a "View as customer" session carries about the preview itself
 * (`session.user.customerPreview`). See src/modules/customer_preview.
 */
export interface CustomerPreviewSessionInfo {
  /** Lower-cased email of the admin previewing. */
  adminEmail: string;
  /** The admin's MappTeam id (null for a SuperAdmin without a row) — for audit/attribution. */
  adminMappUserId: number | null;
  /** Client-catalog company id being viewed. */
  companyId: number;
  companyName: string | null;
  /** ISO timestamp the preview ends at. */
  expiresAt: string;
  /** Names of the granted workspaces when narrowed; absent = the whole company. */
  workspaceNames?: string[];
}

/**
 * Custom claims attached to the NextAuth user / JWT / session.user across the
 * app. Single source of truth so the parallel interfaces + module augmentations
 * below can't drift. (`id` / `role` stay inline per block since their exact
 * shape varies by surface.)
 */
export interface MappSessionClaims {
  // App identity / authorization
  accountId?: string;
  adminId?: string;
  userId?: string;
  customerData?: AccountData;
  adminData?: AdminData;
  isSuperAdmin?: boolean;
  accountName?: string;
  access?: string;
  /** MappTeam.accessStatus, refreshed per request in the JWT callback so
   *  require-auth can enforce it without a second DB read. */
  accessStatus?: string;
  // Identity enrichment (Keycloak / Entra / company context)
  loginName?: string;
  companyId?: string;
  tenantId?: string;
  roles?: string[];
  workspaces?: WorkspaceAccess[];
  isMappEmployee?: boolean;
  mappLdapGroups?: string[];
  authSource?: AuthSource;
  identityProvider?: IdentityProvider;
  keycloakIdpHint?: string;
  /**
   * Set ONLY on the synthesized customer session an admin sees while using
   * "View as customer" (the optional `customer_preview` capability). Never set
   * on a real customer's session, never on the JWT/cookie. Customer mutations
   * refuse when it is present (`assertNotPreview`); the customer layout shows
   * a banner from it.
   */
  customerPreview?: CustomerPreviewSessionInfo;
  // NOTE: keycloakIdToken is intentionally NOT here — it lives on the JWT only
  // (see AuthJWT / the JWT module augmentation), never on session.user, so the
  // signed id_token is not exposed to client JS via /api/auth/session.
}

/**
 * Extended session user properties
 */
export interface AuthUser extends MappSessionClaims {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role: UserRole;
}

/**
 * Extended NextAuth Session
 */
export interface AuthSession extends NextAuthSession {
  user: AuthUser;
}

/**
 * Extended AdminData properties
 */
export interface AdminData {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
  // Access control fields
  accessStatus?: string;
  accessLevel?: string;
  isSuperAdmin?: boolean;
  lastLoginAt?: string;
}

/**
 * Extended NextAuth User (for callbacks)
 */
export interface AuthUserExtended extends DefaultUser, MappSessionClaims {
  role: UserRole;
}

/**
 * Extended NextAuth JWT Token
 */
export interface AuthJWT extends NextAuthJWT, MappSessionClaims {
  role: UserRole;
  /** Id of the server-side auth_session row holding roles / workspaces /
   *  mappLdapGroups and the Keycloak id_token. Never copied onto session.user. */
  authSessionId?: string;
  /** @deprecated Legacy: only present on sessions issued before auth_session
   *  existed. New logins store the id_token on the auth_session row. */
  keycloakIdToken?: string;
}

declare module 'next-auth' {
  interface Session {
    user: MappSessionClaims & {
      id: string;
      role: 'customer' | 'admin';
    } & DefaultSession['user'];
  }

  interface User extends DefaultUser, MappSessionClaims {
    role: 'customer' | 'admin';
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends MappSessionClaims {
    role: 'customer' | 'admin';
    /** Id of the server-side auth_session row holding roles / workspaces /
     *  mappLdapGroups and the Keycloak id_token. Not on session.user. */
    authSessionId?: string;
    /** @deprecated Legacy: only on sessions issued before auth_session existed. */
    keycloakIdToken?: string;
  }
}

// ============================================================================
// Server Auth Result Types
// ============================================================================

/**
 * Result from requireCustomer() server function
 */
export interface CustomerAuthResult {
  session: AuthSession;
  account: CustomerAccountData;
}

/**
 * Result from requireAdmin() server function
 */
export interface AdminAuthResult {
  session: AuthSession;
  adminData: AdminData;
  isSuperAdmin: boolean;
}

/**
 * Result from requireCustomerOrAdmin() server function
 */
export interface CustomerOrAdminAuthResult {
  session: AuthSession;
  account?: CustomerAccountData;
  adminData?: AdminData;
  isSuperAdmin: boolean;
  isCustomer: boolean;
  isAdmin: boolean;
}


// Mapp Team Types
export interface MappTeamMember {
  id?: number;
  created_at?: number;
  email: string;
  firstname: string;
  lastname: string;
  title: string;
  role: string;
  image?: S3Image | null;
}

export interface MappTeamMemberRequest {
  email: string;
  firstname: string;
  lastname: string;
  title: string;
  role: string;
  location?: string;
  image?: S3Image;
}

export interface MappTeamResponse {
  id: number;
  created_at: number;
  email: string;
  firstname: string;
  lastname: string;
  title: string;
  role: string;
  location?: string;
  image?: S3Image | null;
  // Access control fields for authentication
  accessStatus?: string;
  accessLevel?: string;
  isSuperAdmin?: boolean;
  lastLoginAt?: Date | null;
  authorizedBy?: number | null;
  authorizedAt?: Date | null;
  accessNotes?: string | null;
}

export type MappTeamListResponse = MappTeamResponse[];

// ============================================================================
// Auth Options & Config
// ============================================================================

/**
 * Options for requireAdmin()
 */
export interface RequireAdminOptions {
  /**
   * Whether to require super admin privileges
   * @default false
   */
  requireSuperAdmin?: boolean;
  requireAdminAccess?: boolean;
  /**
   * Whether to require editor-level access (editor or admin).
   * Viewers will be rejected. SuperAdmins always pass.
   * @default false
   */
  requireEditorAccess?: boolean;
  /**
   * Redirect to this path if user is not authenticated
   * @default '/auth/admin'
   */
  redirectTo?: string;
  /**
   * Redirect path for non-super admins (when requireSuperAdmin is true)
   * @default '/admin'
   */
  superAdminRedirectTo?: string;
  /**
   * Whether to skip IP restriction checks (for internal calls)
   * @default false
   */
  skipIPCheck?: boolean;
}

/**
 * Options for requireCustomer()
 */
export interface RequireCustomerOptions {
  /**
   * Redirect to this path if user is not authenticated
   * @default '/auth/signin'
   */
  redirectTo?: string;
  /**
   * Declare that the caller only READS. Only matters during an admin "View as
   * customer" preview: `requireCustomer` then refuses every server-action
   * request (it throws `CustomerPreviewReadOnlyError`) unless the action says
   * it is read-only with this flag. Pages and anything called while rendering
   * are unaffected. Never set it on an action that writes.
   * @default false
   */
  readOnly?: boolean;
}

/**
 * Options for requireFeature()
 */
export interface RequireFeatureOptions {
  /**
   * Redirect to this path if feature is not enabled
   * @default '/account'
   */
  redirectTo?: string;
  /**
   * Custom error message
   */
  errorMessage?: string;
}

// ============================================================================
// Client Hook Types
// ============================================================================

/**
 * Options for useAdminAuth() hook
 */
export interface UseAdminAuthOptions {
  /**
   * Redirect to this path if user is not authenticated
   * @default '/auth/signin'
   */
  redirectTo?: string;
  /**
   * Whether to require super admin privileges
   * @default false
   */
  requireSuperAdmin?: boolean;
  /**
   * Redirect path for non-super admins (when requireSuperAdmin is true)
   * @default '/admin'
   */
  superAdminRedirectTo?: string;
}

/**
 * Return type for useAdminAuth() hook
 */
export interface UseAdminAuthReturn {
  session: AuthSession | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
  isAuthorized: boolean;
}

/**
 * Options for useAuthErrorHandler() hook
 */
export interface UseAuthErrorOptions {
  /**
   * Whether user is an admin (for custom error messages)
   */
  isAdmin?: boolean;
  /**
   * Whether to redirect to sign in on auth error
   * @default true
   */
  redirectToSignIn?: boolean;
  /**
   * Whether to show toast notification
   * @default true
   */
  showToast?: boolean;
  /**
   * Custom error message
   */
  customMessage?: string;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Auth error structure
 */
export interface AuthError {
  code: string;
  message: string;
  statusCode?: number;
  details?: Record<string, unknown>;
}

/**
 * Auth error state
 */
export interface AuthErrorState {
  error: AuthError | null;
  isVisible: boolean;
}

// ============================================================================
// API Helper Types
// ============================================================================

/**
 * Context provided to API route handlers by withAdminAuth
 */
export interface AdminAuthContext {
  session: AuthSession;
  adminData: AdminData;
  isSuperAdmin: boolean;
}

/**
 * Context provided to API route handlers by withCustomerAuth
 */
export interface CustomerAuthContext {
  session: AuthSession;
  account: CustomerAccountData;
}

/**
 * Generic auth context for withAuth
 */
export interface GenericAuthContext {
  session: AuthSession;
  isAdmin: boolean;
  isCustomer: boolean;
  isSuperAdmin: boolean;
}

// ============================================================================
// Feature Access Types
// ============================================================================

/**
 * Feature flags for account-based feature access
 */
export interface FeatureFlags {
  modules?: boolean;
  opportunities?: boolean;
  support?: boolean;
  settings?: boolean;
  contentPages?: boolean;
}

/**
 * Feature access check result
 */
export interface FeatureAccessResult {
  hasAccess: boolean;
  reason?: string;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for AuthSession
 */
export function isAuthSession(session: unknown): session is AuthSession {
  return (
    typeof session === 'object' &&
    session !== null &&
    'user' in session &&
    typeof (session as AuthSession).user === 'object' &&
    'role' in (session as AuthSession).user
  );
}

/**
 * Type guard for customer session
 */
export function isCustomerSession(session: AuthSession | null): boolean {
  return session?.user?.role === 'customer' && !!session?.user?.accountId;
}

/**
 * Type guard for admin session
 */
export function isAdminSession(session: AuthSession | null): boolean {
  return session?.user?.role === 'admin';
}

/**
 * Type guard for super admin session
 */
export function isSuperAdminSession(session: AuthSession | null): boolean {
  return session?.user?.role === 'admin' && session?.user?.isSuperAdmin === true;
}

/**
 * Type guard for super admin session
 */
export function isAdminAccessSession(session: AuthSession | null): boolean {
  // Check for both super admin and admin access level
  return session?.user?.role === 'admin' && (session?.user?.isSuperAdmin === true || session?.user?.access === 'admin');
}
