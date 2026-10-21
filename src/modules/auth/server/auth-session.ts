/**
 * Server-side login session — keeps the NextAuth session cookie small.
 *
 * The session cookie is a JWT, sent in full on every request. Anything in it
 * whose size depends on the user's profile (roles, workspaces, LDAP groups, and
 * the Keycloak id_token, which embeds all three again) eventually pushes someone
 * past Node's 16 KB request-header limit, and they get HTTP 431 on every page.
 *
 * So those live in the `auth_session` table, and the cookie carries only
 * `authSessionId`. `session.user.roles / workspaces / mappLdapGroups` are
 * unchanged for callers — the session callback reads them back from here.
 *
 * RULE for new claims: a scalar may go on the JWT; a list, or anything that
 * grows with the user's profile, goes here.
 */

import logger from "@/lib/utils/logger";
import { config } from "@/config";
import { prismaService } from "@/lib/prisma/services";
import type { AuthSessionClaims } from "@/lib/prisma/services/auth-session";

export type { AuthSessionClaims };

function expiryFromNow(): Date {
  return new Date(Date.now() + config.auth.sessionMaxAge * 1000);
}

/**
 * Persist a login's large claims. Returns the id to store on the JWT, or
 * undefined when there is nothing to store (e.g. magic-link logins).
 *
 * Throws if the write fails: a session silently missing its groups and its
 * logout token is worse than a failed login the user can retry.
 */
export async function createAuthSession(input: {
  email?: string | null;
  roles?: string[];
  workspaces?: AuthSessionClaims["workspaces"];
  mappLdapGroups?: string[];
  keycloakIdToken?: string;
}): Promise<string | undefined> {
  const hasClaims =
    (input.roles?.length ?? 0) > 0 ||
    (input.workspaces?.length ?? 0) > 0 ||
    (input.mappLdapGroups?.length ?? 0) > 0;
  if (!hasClaims && !input.keycloakIdToken) {
    return undefined;
  }

  // Opportunistic cleanup; a login is rare enough that this needs no scheduler.
  prismaService.authSession
    .deleteExpired()
    .catch((err) =>
      logger.error("Failed to prune expired auth sessions:", err),
    );

  return prismaService.authSession.create({
    ...input,
    expiresAt: expiryFromNow(),
  });
}

/**
 * True when the auth_session table has not been migrated in yet (Prisma P2021).
 * The default deploy rolls the new image out BEFORE it runs migrations, so for a
 * few minutes on the first deploy of this change the table does not exist.
 */
export function isAuthSessionTableMissing(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "P2021";
}

/**
 * Claims for the session callback. Returns null if the row is gone (expired,
 * signed out elsewhere, DB reset) or the read fails — the session then simply
 * has no roles/workspaces/groups, which fails closed for anything gated on them.
 */
export async function loadAuthSessionClaims(
  id: string,
): Promise<AuthSessionClaims | null> {
  try {
    const row = await prismaService.authSession.getClaims(id);
    if (!row) {
      return null;
    }

    // NextAuth sessions are rolling, so the row must be too. Extend once it is
    // past the halfway point — at most one write per half-lifetime per session.
    const halfLifeMs = (config.auth.sessionMaxAge * 1000) / 2;
    if (row.expiresAt.getTime() - Date.now() < halfLifeMs) {
      prismaService.authSession
        .extend(id, expiryFromNow())
        .catch((err) => logger.error("Failed to extend auth session:", err));
    }

    return {
      roles: row.roles,
      workspaces: row.workspaces,
      mappLdapGroups: row.mappLdapGroups,
    };
  } catch (error) {
    logger.error("Failed to load auth session claims:", error);
    return null;
  }
}

/** Keycloak id_token for the federated-logout redirect. Server-only. */
export async function getAuthSessionIdToken(
  id: string,
): Promise<string | null> {
  try {
    return await prismaService.authSession.getKeycloakIdToken(id);
  } catch (error) {
    logger.error("Failed to load auth session id_token:", error);
    return null;
  }
}

export async function deleteAuthSession(id: string): Promise<void> {
  try {
    await prismaService.authSession.delete(id);
  } catch (error) {
    logger.error("Failed to delete auth session:", error);
  }
}
