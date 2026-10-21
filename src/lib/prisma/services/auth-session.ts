/**
 * Auth Session Service - Prisma Implementation
 *
 * Server-side half of a login session: the claims that are too large to keep in
 * the NextAuth session cookie (roles, workspaces, LDAP groups) plus the Keycloak
 * id_token used for federated logout. The cookie holds only the row id.
 *
 * Rows are immutable apart from `expiresAt` — claims are a snapshot of the
 * identity at login, exactly as they were when they lived in the JWT.
 */

import { prisma } from "../client";
import type { Prisma } from "@/generated/prisma/client";

export type AuthSessionWorkspace = { workspaceId: string; services: string[] };

export type AuthSessionClaims = {
  roles?: string[];
  workspaces?: AuthSessionWorkspace[];
  mappLdapGroups?: string[];
};

export type AuthSessionCreateInput = AuthSessionClaims & {
  email?: string | null;
  keycloakIdToken?: string | null;
  expiresAt: Date;
};

export class PrismaAuthSessionService {
  /** Store a login's claims; returns the id to carry in the session cookie. */
  async create(input: AuthSessionCreateInput): Promise<string> {
    const row = await prisma.authSession.create({
      data: {
        email: input.email ?? null,
        roles: input.roles as Prisma.InputJsonValue | undefined,
        workspaces: input.workspaces as Prisma.InputJsonValue | undefined,
        mappLdapGroups: input.mappLdapGroups as
          Prisma.InputJsonValue | undefined,
        keycloakIdToken: input.keycloakIdToken ?? null,
        expiresAt: input.expiresAt,
      },
      select: { id: true },
    });
    return row.id;
  }

  /**
   * Claims for a live session, or null when the row is missing or expired.
   * Deliberately does NOT select the id_token — this feeds `session.user`,
   * which is returned to client JS.
   */
  async getClaims(
    id: string,
  ): Promise<(AuthSessionClaims & { expiresAt: Date }) | null> {
    const row = await prisma.authSession.findUnique({
      where: { id },
      select: {
        roles: true,
        workspaces: true,
        mappLdapGroups: true,
        expiresAt: true,
      },
    });
    if (!row || row.expiresAt.getTime() <= Date.now()) {
      return null;
    }
    return {
      roles: (row.roles as string[] | null) ?? undefined,
      workspaces:
        (row.workspaces as AuthSessionWorkspace[] | null) ?? undefined,
      mappLdapGroups: (row.mappLdapGroups as string[] | null) ?? undefined,
      expiresAt: row.expiresAt,
    };
  }

  /** The Keycloak id_token for federated logout. Server-only. */
  async getKeycloakIdToken(id: string): Promise<string | null> {
    const row = await prisma.authSession.findUnique({
      where: { id },
      select: { keycloakIdToken: true },
    });
    return row?.keycloakIdToken ?? null;
  }

  async extend(id: string, expiresAt: Date): Promise<void> {
    await prisma.authSession.updateMany({ where: { id }, data: { expiresAt } });
  }

  async delete(id: string): Promise<void> {
    await prisma.authSession.deleteMany({ where: { id } });
  }

  async deleteExpired(): Promise<number> {
    const result = await prisma.authSession.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return result.count;
  }
}
