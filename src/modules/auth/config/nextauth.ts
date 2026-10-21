/**
 * NextAuth v4 Configuration
 *
 * This file contains the NextAuth authentication configuration for Mapp Labs.
 * It supports these authentication flows:
 *
 * 1. Keycloak-brokered OIDC (preferred) — one provider, two IdP hints:
 *    - "Mapp Entra ID" (kc_idp_hint=mapp-entra-id) -> internal Mapp admins
 *    - "Company Login" (kc_idp_hint=mapp-cloud-company) -> Mapp Cloud customers,
 *      whose session is enriched with company/workspace context.
 *
 * 2. Microsoft Entra / Azure AD (legacy direct path) — used only when Keycloak
 *    is disabled. Validates against Mapp Team members; super admin via config.
 *
 * 3. Magic link (OPTIONAL capability, OFF by default) — legacy email-link
 *    customer auth for apps with non-company users. Gated by config.magicLink.
 *
 * 4. Dev login (non-production only) — local bypass that runs the same hydration.
 *
 * @see https://next-auth.js.org/configuration/options
 */

import logger from '@/lib/utils/logger';
import { existsSync, readFileSync } from 'node:fs';
import { Agent as HttpsAgent } from 'node:https';
import { rootCertificates } from 'node:tls';
import NextAuth from 'next-auth';
import type { NextAuthOptions } from 'next-auth';
import AzureADProvider from 'next-auth/providers/azure-ad';
import CredentialsProvider from 'next-auth/providers/credentials';
import KeycloakProvider from 'next-auth/providers/keycloak';
import { config } from '@/config';
import { hydrateInternalAdminUser } from '../server/internal-admin-auth';
import { hydrateCompanyUser } from '../server/company-user-auth';
import {
  createAuthSession,
  deleteAuthSession,
  isAuthSessionTableMissing,
  loadAuthSessionClaims,
} from '../server/auth-session';
import { isSuperAdmin } from '../utils/auth-helpers';
import {
  deriveIsMappEmployee,
  extractBooleanClaim,
  extractScalarStringClaim,
  extractStringArrayClaim,
  extractWorkspaceClaims,
  resolveKeycloakIdentityProvider,
  resolveKeycloakIdpHint,
  resolveKeycloakProfileEmail,
  resolveKeycloakProfileId,
  resolveKeycloakProfileName,
} from './keycloak/claims';

// ---------------------------------------------------------------------------
// Keycloak backchannel TLS + public-endpoint handling
// ---------------------------------------------------------------------------
// Prefer a CA bundle from NODE_EXTRA_CA_CERTS / /tmp/keycloak-ca.pem (written by
// the container entrypoint from SSM) and fall back to the KEYCLOAK_CA_PEM env.
// The two fs reads below are flagged by security/detect-non-literal-fs-filename
// for taking a non-literal path. Both are safe and the disables are deliberate:
// the path is NODE_EXTRA_CA_CERTS, set by our own container entrypoint from SSM
// (never user input), and the only operation is reading a CA bundle at boot.
const keycloakCaFile =
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  process.env.NODE_EXTRA_CA_CERTS && existsSync(process.env.NODE_EXTRA_CA_CERTS)
    ? process.env.NODE_EXTRA_CA_CERTS
    : existsSync('/tmp/keycloak-ca.pem')
      ? '/tmp/keycloak-ca.pem'
      : undefined;

const keycloakCaBundle = keycloakCaFile
  ? // eslint-disable-next-line security/detect-non-literal-fs-filename
    readFileSync(keycloakCaFile, 'utf8')
  : config.keycloak.caPem || undefined;

// NOTE: passing `ca` to https.Agent REPLACES Node's default Mozilla trust store.
// If we only ship an intermediate, we'd lose trust for the public root above it.
// So always MERGE the Mozilla roots with our custom CA(s). `tlsInsecure` is
// hard-gated off in production by config (never rejectUnauthorized:false there).
const keycloakHttpsAgent = config.keycloak.tlsInsecure
  ? new HttpsAgent({ rejectUnauthorized: false })
  : keycloakCaBundle
    ? new HttpsAgent({ ca: [...rootCertificates, keycloakCaBundle] })
    : undefined;

// Force the public issuer host for back-channel endpoints in case the KC
// discovery document advertises internal ingress URLs.
const keycloakPublicIssuer = config.keycloak.issuer.replace(/\/$/, '');
const keycloakPublicEndpoints = keycloakPublicIssuer
  ? {
      authorization: `${keycloakPublicIssuer}/protocol/openid-connect/auth`,
      token: `${keycloakPublicIssuer}/protocol/openid-connect/token`,
      userinfo: `${keycloakPublicIssuer}/protocol/openid-connect/userinfo`,
      jwks: `${keycloakPublicIssuer}/protocol/openid-connect/certs`,
    }
  : undefined;

/**
 * NextAuth Configuration Options
 */
export const authOptions: NextAuthOptions = {
  providers: [
    /**
     * Magic Link Credentials Provider (OPTIONAL capability, OFF by default)
     *
     * Legacy customer auth via email magic links. Gated by config.magicLink so
     * it is cleanly decoupled from the Keycloak path — enable per-app with
     * MAGIC_LINK_ENABLED=true. (Apps without non-company users should leave it
     * off and rely on Company Login.)
     */
    ...(config.magicLink.enabled
      ? [
          CredentialsProvider({
            id: 'magic-link',
            name: 'Magic Link',
            credentials: {
              token: { label: 'Token', type: 'text' },
              userData: { label: 'User Data', type: 'text' },
            },
            async authorize(credentials) {
              if (credentials?.userData) {
                try {
                  const userData = JSON.parse(credentials.userData);
                  return {
                    id: userData.id,
                    email: userData.email,
                    name: userData.name,
                    role: 'customer',
                    customerData: userData,
                    accountId: userData.accountId || null, // null for multi-account
                    userId: userData.id,
                  };
                } catch (error) {
                  logger.error('Magic link authorization failed:', error);
                  return null;
                }
              }
              return null;
            },
          }),
        ]
      : []),

    /**
     * Azure AD Provider (legacy direct-Entra path)
     *
     * Enabled only when Keycloak is OFF and Azure credentials are configured.
     * When Keycloak is on, its "Mapp Entra ID" button brokers to Entra, so the
     * direct provider is redundant and we skip it to keep the surface small.
     */
    ...(!config.keycloak.enabled &&
    config.azure.clientId &&
    config.azure.clientId !== 'your-azure-ad-client-id'
      ? [
          AzureADProvider({
            clientId: config.azure.clientId,
            clientSecret: config.azure.clientSecret,
            tenantId: config.azure.tenantId,
          }),
        ]
      : []),

    /**
     * Keycloak Provider (preferred login broker)
     *
     * Keycloak becomes the upstream IdP/broker while NextAuth keeps owning the
     * final app session. The profile() callback maps Keycloak claims into the
     * enriched identity fields (companyId / tenantId / workspaces / roles /
     * ldapGroups). kc_idp_hint selects the brokered IdP (Mapp Entra ID vs
     * Company Login) per-request from the sign-in page.
     */
    ...(config.keycloak.enabled &&
    config.keycloak.issuer &&
    config.keycloak.clientId &&
    config.keycloak.clientSecret
      ? [
          KeycloakProvider({
            clientId: config.keycloak.clientId,
            clientSecret: config.keycloak.clientSecret,
            issuer: config.keycloak.issuer,
            wellKnown: undefined,
            authorization: keycloakPublicEndpoints
              ? {
                  url: keycloakPublicEndpoints.authorization,
                  params: {
                    scope: 'openid profile',
                    ...(config.keycloak.idpHint
                      ? { kc_idp_hint: config.keycloak.idpHint }
                      : {}),
                  },
                }
              : undefined,
            token: keycloakPublicEndpoints
              ? { url: keycloakPublicEndpoints.token }
              : undefined,
            userinfo: keycloakPublicEndpoints
              ? { url: keycloakPublicEndpoints.userinfo }
              : undefined,
            jwks_endpoint: keycloakPublicEndpoints?.jwks,
            httpOptions: {
              ...(keycloakHttpsAgent ? { agent: keycloakHttpsAgent } : {}),
              timeout: 15000,
            },
            profile(profile) {
              const keycloakIdpHint = resolveKeycloakIdpHint(
                profile,
                config.keycloak.idpHint,
                config.keycloak.companyIdpHint,
              );
              const mappLdapGroups = extractStringArrayClaim(
                profile.mappLdapGroups,
              );
              const email = resolveKeycloakProfileEmail(profile);
              const isMappEmployee = deriveIsMappEmployee(
                extractBooleanClaim(profile.isMappEmployee),
                email,
                mappLdapGroups,
              );

              return {
                id: resolveKeycloakProfileId(profile),
                name: resolveKeycloakProfileName(profile),
                email,
                image: null,
                role: 'admin',
                loginName: extractScalarStringClaim(profile.loginName),
                userId: extractScalarStringClaim(profile.userId),
                companyId: extractScalarStringClaim(profile.companyId),
                tenantId: extractScalarStringClaim(profile.tenantId),
                roles: extractStringArrayClaim(profile.roles),
                workspaces: extractWorkspaceClaims(profile.workspaces),
                isMappEmployee,
                mappLdapGroups,
                identityProvider: resolveKeycloakIdentityProvider(
                  profile,
                  keycloakIdpHint,
                ),
                keycloakIdpHint,
              };
            },
          }),
        ]
      : []),

    /**
     * Dev Login (local fallback)
     *
     * A mock IdP for local development WITHOUT AWS/Keycloak access. Double-gated
     * by config.devAuth.enabled (DEV_AUTH_ENABLED=true AND NODE_ENV!=production),
     * so it can never be registered in a production build. It only mocks the
     * identity — the real signIn hydration + eligibility code still runs.
     */
    ...(config.devAuth.enabled
      ? [
          CredentialsProvider({
            id: 'dev-login',
            name: 'Developer Login',
            credentials: {
              role: { label: 'Role', type: 'text' },
              email: { label: 'Email', type: 'text' },
              name: { label: 'Name', type: 'text' },
              companyId: { label: 'Company ID', type: 'text' },
              userId: { label: 'User ID', type: 'text' },
              workspaces: { label: 'Workspaces JSON', type: 'text' },
            },
            async authorize(credentials) {
              if (!config.devAuth.enabled) return null;
              const role = credentials?.role === 'admin' ? 'admin' : 'customer';
              const email =
                credentials?.email?.trim() ||
                (role === 'admin'
                  ? 'dev-admin@mapp.com'
                  : 'dev-customer@example.com');

              let workspaces: { workspaceId: string; services: string[] }[] = [];
              if (credentials?.workspaces) {
                try {
                  const parsed = JSON.parse(credentials.workspaces);
                  if (Array.isArray(parsed)) workspaces = parsed;
                } catch {
                  logger.warn('dev-login: could not parse workspaces JSON');
                }
              }

              return {
                id: email,
                email,
                name: credentials?.name?.trim() || email,
                role,
                companyId:
                  role === 'customer'
                    ? credentials?.companyId?.trim() || '0'
                    : undefined,
                userId:
                  credentials?.userId?.trim() || `dev-${email.toLowerCase()}`,
                workspaces,
                isMappEmployee:
                  role === 'admin' || email.toLowerCase().endsWith('@mapp.com'),
                identityProvider: role === 'admin' ? 'entra' : 'mapp-cloud',
                authSource: 'keycloak',
              };
            },
          }),
        ]
      : []),
  ],

  /**
   * Custom Pages
   */
  pages: {
    // When Keycloak is on, the unified single-field /auth/admin is the entry
    // point for both admins and customers. When KC is off, fall back to the
    // magic-link page if that capability is enabled, else still /auth/admin.
    signIn:
      config.keycloak.enabled || !config.magicLink.enabled
        ? '/auth/admin'
        : '/auth/signin',
    signOut: '/auth/signout',
    error: '/auth/error',
  },

  callbacks: {
    /**
     * Sign In Callback
     *
     * - Keycloak: forks to internal-admin vs company-customer hydration by IdP
     * - Azure AD (legacy): validates against Mapp Team, creates member if new
     * - magic-link: direct customer auth (pre-validated token)
     * - dev-login: local bypass (non-production), runs the same hydration
     */
    async signIn({ user, account, profile }) {
      try {
        if (account?.provider === 'magic-link') {
          // Direct magic link authentication - user data already validated.
          user.authSource = 'magic-link';
          return true;
        }

        if (account?.provider === 'dev-login') {
          // Local fallback. Mocked identity, but runs the SAME hydration +
          // eligibility code as the real Keycloak path.
          if (!config.devAuth.enabled) return false;
          try {
            const email = user.email!;
            const name = user.name || email;
            // Dev-login role is explicitly chosen in the form; honor it (don't
            // let an @mapp.com test email misroute a chosen customer to admin).
            const isInternal = user.role === 'admin';
            if (isInternal) {
              return await hydrateInternalAdminUser(user, {
                email,
                name,
                image: user.image,
                authSource: 'nextauth-azure',
                identityProvider: user.identityProvider ?? 'entra',
                isMappEmployee: true,
              });
            }
            // Respect the Company Login capability gate in dev too.
            if (!config.companyLogin.enabled) {
              logger.warn('Company Login disabled; dev customer login rejected');
              return false;
            }
            return await hydrateCompanyUser(user, {
              email,
              name,
              identityProvider: user.identityProvider ?? 'mapp-cloud',
              userId: user.userId,
              companyId: user.companyId,
              workspaces: user.workspaces,
              isMappEmployee: user.isMappEmployee,
            });
          } catch (error) {
            logger.error('Dev login error:', error);
            return false;
          }
        }

        if (account?.provider === 'azure-ad') {
          // Legacy direct-Entra admin path. Routed through the shared internal
          // admin hydrator so it produces the same session shape as Keycloak.
          try {
            return await hydrateInternalAdminUser(user, {
              email: user.email!,
              name: user.name!,
              image: user.image,
              authSource: 'nextauth-azure',
              identityProvider: 'entra',
              graphAccessToken: account.access_token,
              isMappEmployee: user.email?.toLowerCase().endsWith('@mapp.com'),
            });
          } catch (error) {
            logger.error('Admin authentication error:', error);
            return false;
          }
        }

        if (account?.provider === 'keycloak') {
          // Brokered login via Keycloak (Mapp Entra ID or Company Login).
          // Recover enrichment from the user object (set in profile()) with a
          // fallback to the raw profile claims.
          try {
            const keycloakProfile = profile as
              | Record<string, unknown>
              | undefined;
            const email =
              user.email ?? resolveKeycloakProfileEmail(keycloakProfile);
            const name =
              user.name ?? resolveKeycloakProfileName(keycloakProfile);
            const keycloakIdpHint =
              user.keycloakIdpHint ??
              resolveKeycloakIdpHint(
                keycloakProfile,
                config.keycloak.idpHint,
                config.keycloak.companyIdpHint,
              );
            const identityProvider =
              user.identityProvider ??
              resolveKeycloakIdentityProvider(keycloakProfile, keycloakIdpHint);
            const mappLdapGroups =
              user.mappLdapGroups ??
              extractStringArrayClaim(keycloakProfile?.mappLdapGroups);
            const loginName =
              user.loginName ??
              extractScalarStringClaim(keycloakProfile?.loginName);
            const userId =
              user.userId ?? extractScalarStringClaim(keycloakProfile?.userId);
            const companyId =
              user.companyId ??
              extractScalarStringClaim(keycloakProfile?.companyId);
            const tenantId =
              user.tenantId ??
              extractScalarStringClaim(keycloakProfile?.tenantId);
            const roles =
              user.roles ?? extractStringArrayClaim(keycloakProfile?.roles);
            const workspaces =
              user.workspaces ??
              extractWorkspaceClaims(keycloakProfile?.workspaces);
            const isMappEmployee = deriveIsMappEmployee(
              user.isMappEmployee ??
                extractBooleanClaim(keycloakProfile?.isMappEmployee),
              email,
              mappLdapGroups,
            );

            // Fork by HOW they logged in, not by email domain. FAIL CLOSED:
            // grant the internal-admin path only on a POSITIVE internal signal;
            // anything ambiguous falls through to the (less-privileged) customer
            // path rather than minting an admin.
            //  - Company Login (identityProvider=mapp-cloud) is ALWAYS a customer
            //    scoped to their company — even if their email is @mapp.com (test
            //    / company accounts commonly are). NEVER overridden -> never admin.
            //  - Entra -> internal admin. `identityProvider==="internal"` is the
            //    *unknown/default* bucket, so it only routes internal when
            //    corroborated by mappLdapGroups (which only real Mapp users have);
            //    otherwise it's treated as a customer.
            // (isMappEmployee stays as enrichment but must NOT drive routing here,
            // or company users with @mapp.com emails get misrouted to admin.)
            const isInternal =
              identityProvider === 'entra' ||
              (identityProvider === 'internal' && mappLdapGroups.length > 0);

            // Diagnostic: log the resolved identity for every KC login so we can
            // see why a given company login routes/fails (staging runs with
            // next-auth debug off). No secrets — just routing-relevant claims.
            logger.debug('Keycloak signIn resolved identity', {
              email,
              hasName: Boolean(name),
              identityProvider,
              keycloakIdpHint,
              isMappEmployee,
              companyId: companyId ?? null,
              userId: userId ?? null,
              loginName: loginName ?? null,
              workspaceCount: workspaces.length,
              mappLdapGroupCount: mappLdapGroups.length,
              route: isInternal ? 'internal-admin' : 'company-customer',
            });

            if (!email || !name) {
              logger.error(
                'Keycloak profile is missing required identity fields',
                { hasEmail: Boolean(email), hasName: Boolean(name) },
              );
              return false;
            }

            // Company Login capability gate. For a Mapp-internal-only app
            // (COMPANY_LOGIN_ENABLED=false) refuse the company-context customer
            // path entirely — fail closed, never fall through to an admin row.
            if (!isInternal && !config.companyLogin.enabled) {
              logger.warn(
                'Company Login is disabled for this app; rejecting company-context login',
                { email, companyId: companyId ?? null },
              );
              return false;
            }

            if (!isInternal) {
              return await hydrateCompanyUser(user, {
                email,
                name,
                identityProvider,
                loginName,
                userId,
                companyId,
                tenantId,
                roles,
                workspaces,
                isMappEmployee,
                mappLdapGroups,
                keycloakIdpHint,
              });
            }

            return await hydrateInternalAdminUser(user, {
              email,
              name,
              image: user.image,
              authSource: 'keycloak',
              identityProvider,
              loginName,
              userId,
              companyId,
              tenantId,
              roles,
              workspaces,
              isMappEmployee,
              mappLdapGroups,
              keycloakIdpHint,
            });
          } catch (error) {
            logger.error('Keycloak authentication error:', error);
            return false;
          }
        }

        return false;
      } catch (error) {
        logger.error('Sign in error:', error);
        return false;
      }
    },

    /**
     * JWT Callback
     *
     * Stores only scalar identifiers — the whole token is the session cookie and
     * is sent on every request. Anything that grows with the user's profile
     * (roles, workspaces, LDAP groups, the Keycloak id_token) goes to the
     * auth_session table instead and the token keeps just `authSessionId`;
     * putting those here gave users with many groups HTTP 431 on every page.
     *
     * Refreshes the admin access flags per request from the DB so config/db
     * changes take effect; carries accessStatus so require-auth can enforce it
     * without a second per-request mapp_team read.
     */
    async jwt({ token, user, account, trigger, session }) {
      if (user) {
        token.role = user.role;
        token.email = user.email;
        token.name = user.name;

        // Identity enrichment (Keycloak / Entra / company context). Persisted on
        // initial sign-in so attribution survives for the life of the session.
        token.authSource = user.authSource;
        token.identityProvider = user.identityProvider;
        token.keycloakIdpHint = user.keycloakIdpHint;
        token.loginName = user.loginName;
        token.companyId = user.companyId;
        token.tenantId = user.tenantId;
        token.isMappEmployee = user.isMappEmployee;

        // Profile-sized claims + the id_token are stored server-side; only the
        // row id rides in the cookie.
        const keycloakIdToken =
          account?.provider === 'keycloak' ? account.id_token : undefined;
        try {
          token.authSessionId = await createAuthSession({
            email: user.email,
            roles: user.roles,
            workspaces: user.workspaces,
            mappLdapGroups: user.mappLdapGroups,
            keycloakIdToken,
          });
        } catch (error) {
          if (!isAuthSessionTableMissing(error)) {
            throw error;
          }
          // First deploy of this change: the new image is serving but the
          // migration hasn't run yet. Fall back to the old inline claims for
          // logins in that window rather than refusing them; the session and
          // signout paths still read these.
          logger.warn(
            'auth_session table missing (migration not applied yet); storing claims on the JWT for this login',
          );
          token.roles = user.roles;
          token.workspaces = user.workspaces;
          token.mappLdapGroups = user.mappLdapGroups;
          token.keycloakIdToken = keycloakIdToken;
        }

        if (user.role === 'admin') {
          token.adminId = user.adminId;
          token.isSuperAdmin = user.isSuperAdmin || false;
        } else if (user.role === 'customer') {
          token.accountId = user.accountId; // may be null for company customers
          token.userId = user.userId;
        }
      }

      // Always refresh isSuperAdmin / access / accessStatus / adminId for admin
      // tokens. We only require token.email (not token.adminId) so a lost adminId
      // can still be recovered from the DB lookup.
      if (token.role === 'admin' && token.email) {
        try {
          const {
            getRawTeamMemberByEmailAction,
            updateTeamMemberForAuthAction,
          } = await import('@/modules/auth/server');
          const teamMemberResult = await getRawTeamMemberByEmailAction(
            token.email,
          );
          const dbSuperAdminFlag = teamMemberResult.data?.isSuperAdmin;
          const accessLevel = teamMemberResult.data?.accessLevel;

          // Refresh or recover adminId from DB.
          if (teamMemberResult.data?.id != null) {
            const currentAdminId = String(teamMemberResult.data.id);
            if (!token.adminId) {
              logger.warn(
                `Recovering missing adminId for ${token.email}: -> ${currentAdminId}`,
              );
              token.adminId = currentAdminId;
            } else if (token.adminId !== currentAdminId) {
              logger.warn(
                `Refreshing stale adminId for ${token.email}: ${token.adminId} -> ${currentAdminId}`,
              );
              token.adminId = currentAdminId;
            }
          } else if (token.adminId) {
            // adminId in token but no matching mapp_team record (e.g. after a DB
            // reset). Clear it to prevent misattribution in audit logs.
            logger.warn(
              `Clearing stale adminId for ${token.email}: ${token.adminId} -> null (no mapp_team record)`,
            );
            token.adminId = undefined;
          }

          token.isSuperAdmin = isSuperAdmin(token.email, dbSuperAdminFlag);
          token.access = accessLevel || 'viewer';
          // Carry accessStatus on the token so require-auth can enforce it from
          // the session without a second per-request mapp_team read.
          token.accessStatus = teamMemberResult.data?.accessStatus || 'active';

          // Throttled "last seen" update — at most once per 5 minutes.
          const lastSeen = teamMemberResult.data?.lastLoginAt;
          const fiveMinutes = 5 * 60 * 1000;
          const shouldUpdateLastSeen =
            !lastSeen ||
            Date.now() - new Date(lastSeen).getTime() > fiveMinutes;
          if (teamMemberResult.data?.id != null && shouldUpdateLastSeen) {
            updateTeamMemberForAuthAction(String(teamMemberResult.data.id), {
              lastLoginAt: new Date(),
            }).catch((err) => logger.error('Failed to update last seen:', err));
          }
        } catch (error) {
          logger.error(
            'Error refreshing superadmin status and access level:',
            error,
          );
          token.isSuperAdmin = isSuperAdmin(token.email);
          token.access = 'viewer';
        }
      }

      // Handle session updates (account switching and admin viewing accounts).
      if (trigger === 'update' && session) {
        if (session.accountId !== undefined) {
          token.accountId = session.accountId;
        }
        if (session.accountName !== undefined) {
          token.accountName = session.accountName;
        }
        if (session.access !== undefined) {
          token.access = session.access;
        }
        if (session.clearAccountId) {
          delete token.accountId;
          delete token.accountName;
          delete token.access;
        }
      }

      return token;
    },

    /**
     * Session Callback
     *
     * Transforms JWT token data into the session object for client-side use.
     * The Keycloak id_token is deliberately NOT copied onto the session — it
     * stays server-side (auth_session row) so it isn't exposed to client JS.
     */
    async session({ session, token }) {
      if (token) {
        session.user.role = token.role as 'customer' | 'admin';
        session.user.email = token.email as string;
        session.user.name = token.name as string;

        // Identity enrichment (Keycloak / Entra / company context).
        if (token.loginName) {
          session.user.loginName = token.loginName as string;
        }
        if (token.companyId) {
          session.user.companyId = token.companyId as string;
        }
        if (token.tenantId) {
          session.user.tenantId = token.tenantId as string;
        }
        // roles / workspaces / mappLdapGroups come from the auth_session row.
        // Sessions issued before that table existed still carry them inline on
        // the token; honor those until they expire or the user logs in again.
        const claims = token.authSessionId
          ? await loadAuthSessionClaims(token.authSessionId)
          : token;
        if (claims?.roles) {
          session.user.roles = claims.roles;
        }
        if (claims?.workspaces) {
          session.user.workspaces = claims.workspaces;
        }
        if (token.isMappEmployee !== undefined) {
          session.user.isMappEmployee = token.isMappEmployee as boolean;
        }
        if (claims?.mappLdapGroups) {
          session.user.mappLdapGroups = claims.mappLdapGroups;
        }
        if (token.authSource) {
          session.user.authSource = token.authSource as
            | 'keycloak'
            | 'nextauth-azure'
            | 'magic-link';
        }
        if (token.identityProvider) {
          session.user.identityProvider = token.identityProvider as
            | 'entra'
            | 'internal'
            | 'mapp-cloud';
        }
        if (token.keycloakIdpHint) {
          session.user.keycloakIdpHint = token.keycloakIdpHint as string;
        }
        // NOTE: the Keycloak id_token is intentionally NOT copied onto the
        // session. The signout page reads it server-side from the auth_session
        // row (via the JWT's authSessionId).

        if (token.role === 'admin') {
          session.user.adminId = token.adminId as string;
          session.user.isSuperAdmin = token.isSuperAdmin as boolean;
          // Access level + status (status drives the require-auth gate; both are
          // refreshed per request in the jwt callback).
          if (token.access) {
            session.user.access = token.access as string;
          }
          if (token.accessStatus) {
            session.user.accessStatus = token.accessStatus as string;
          }
          if (token.accountId) {
            session.user.accountId = token.accountId as string;
          }
          if (token.accountName) {
            session.user.accountName = token.accountName as string;
          }
        } else if (token.role === 'customer') {
          session.user.accountId = token.accountId as string;
          session.user.userId = token.userId as string;
          if (token.accountName) {
            session.user.accountName = token.accountName as string;
          }
          if (token.access) {
            session.user.access = token.access as string;
          }
        }
      }

      return session;
    },
  },

  /**
   * Events — drop the server-side session row when the user signs out. (The
   * signout page has already read the id_token from it by the time the client
   * calls signOut().)
   */
  events: {
    async signOut({ token }) {
      if (token?.authSessionId) {
        await deleteAuthSession(token.authSessionId);
      }
    },
  },

  /**
   * Session Configuration — JWT strategy, maxAge from central config.
   */
  session: {
    strategy: 'jwt',
    maxAge: config.auth.sessionMaxAge,
  },

  /**
   * Auth Secret — signs JWTs / encrypts session cookies (NEXTAUTH_SECRET).
   */
  secret: config.auth.secret,

  /**
   * Debug Mode — verbose only in development.
   */
  debug: config.app.isDevelopment,

  /**
   * Logger — surface NextAuth errors/warnings even when full debug is off (e.g.
   * staging/prod) so OAuth-callback failures (state/PKCE/provider errors) are
   * visible in ECS logs. Verbose debug stays gated to development.
   */
  logger: {
    error(code: string, metadata: unknown) {
      logger.error(`[next-auth][error] ${code}`, metadata);
    },
    warn(code: string) {
      logger.warn(`[next-auth][warn] ${code}`);
    },
    debug(code: string, metadata: unknown) {
      if (config.app.isDevelopment) {
        logger.debug(`[next-auth][debug] ${code}`, metadata);
      }
    },
  },
};

/**
 * NextAuth Handler
 *
 * Default export for API route: /api/auth/[...nextauth]/route.ts
 */
export default NextAuth(authOptions);
