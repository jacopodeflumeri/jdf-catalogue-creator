/**
 * Company User Service - Prisma Implementation
 *
 * Durable identities for Keycloak "Company Login" (Mapp Cloud) customers. Keyed
 * by the mapp-cloud user id + integer client-catalog company id.
 *
 * This service is intentionally GENERIC: it knows nothing about how a company
 * maps to a local `Account`. The optional `accountId` is resolved by the caller
 * (the auth layer) via the pluggable `resolveAccountIdForCompany(companyId)`
 * seam and passed in. App-specific entitlement checks (e.g. "does this company
 * have a product feed") live in the app's eligibility policy, NOT here.
 */

import { prisma } from "../client";
import type { CompanyUser, Prisma } from "@/generated/prisma/client";
import { escapeLikePattern } from "@/lib/utils/search";

export type CompanyUserLoginInput = {
  mappUserId: string;
  companyId: number;
  tenantId?: string | null;
  loginName?: string | null;
  email?: string | null;
  name?: string | null;
  /** Resolved by the app's company→account seam; null when unmapped. */
  accountId?: number | null;
};

export class PrismaCompanyUserService {
  /**
   * Upsert a company user on login: refresh identity fields + lastLoginAt and
   * (re)link the local Account when the caller resolved one. Returns the stored
   * row (its id is the stable handle for future usage attribution).
   */
  async upsertOnLogin(input: CompanyUserLoginInput): Promise<CompanyUser> {
    const accountId = input.accountId ?? null;
    const now = new Date();
    return prisma.companyUser.upsert({
      where: {
        mappUserId_companyId: {
          mappUserId: input.mappUserId,
          companyId: input.companyId,
        },
      },
      create: {
        mappUserId: input.mappUserId,
        companyId: input.companyId,
        tenantId: input.tenantId ?? null,
        loginName: input.loginName ?? null,
        email: input.email ?? null,
        name: input.name ?? null,
        accountId,
        lastLoginAt: now,
      },
      update: {
        tenantId: input.tenantId ?? null,
        loginName: input.loginName ?? null,
        email: input.email ?? null,
        name: input.name ?? null,
        accountId,
        lastLoginAt: now,
      },
    });
  }

  /**
   * Paginated + searchable list of Company-Login users for the global admin
   * view, including the linked Account (id + name). Search matches name/email/
   * loginName/Mapp-Cloud id/company name (and companyId when the query is a
   * plain decimal within Int4 range). Sort, filter, and pagination happen in
   * Postgres — the table grows with the whole customer base, so we never ship
   * it all to the client.
   */
  async listPaginatedWithAccount(opts: {
    search?: string;
    sortKey?: "user" | "company" | "mappUserId" | "lastLogin";
    sortDir?: "asc" | "desc";
    limit: number;
    offset: number;
  }) {
    const search = opts.search?.trim();
    const dir: Prisma.SortOrder = opts.sortDir === "asc" ? "asc" : "desc";

    // Escaped for `contains`: `%` / `_` match literally, not as wildcards.
    const pattern = search ? escapeLikePattern(search) : "";

    const where: Prisma.CompanyUserWhereInput = search
      ? {
          OR: [
            { name: { contains: pattern, mode: "insensitive" } },
            { email: { contains: pattern, mode: "insensitive" } },
            { loginName: { contains: pattern, mode: "insensitive" } },
            { mappUserId: { contains: pattern, mode: "insensitive" } },
            { account: { name: { contains: pattern, mode: "insensitive" } } },
            // Only match companyId for a plain decimal within Int4 range —
            // "1e3"/"0x10" and >2^31 values would otherwise coerce to a number
            // and (for out-of-range) make Postgres throw on the Int column.
            ...(/^\d+$/.test(search) && Number(search) <= 2147483647
              ? [{ companyId: Number(search) }]
              : []),
          ],
        }
      : {};

    const orderBy: Prisma.CompanyUserOrderByWithRelationInput[] =
      opts.sortKey === "user"
        ? [{ name: dir }, { email: dir }]
        : opts.sortKey === "mappUserId"
          ? [{ mappUserId: dir }]
          : opts.sortKey === "lastLogin"
            ? [{ lastLoginAt: dir }]
            : // default + "company": group by company, most-recent first within it
              [{ companyId: dir }, { lastLoginAt: "desc" }];

    const [rows, total] = await Promise.all([
      prisma.companyUser.findMany({
        where,
        orderBy,
        include: { account: { select: { id: true, name: true } } },
        take: opts.limit,
        skip: opts.offset,
      }),
      prisma.companyUser.count({ where }),
    ]);

    return { rows, total };
  }

  /**
   * List all Company-Login users for a company (most-recently-active first).
   * `companyId` is the client-catalog company id.
   */
  async listByCompany(companyId: number): Promise<CompanyUser[]> {
    return prisma.companyUser.findMany({
      where: { companyId },
      orderBy: [{ lastLoginAt: "desc" }, { createdAt: "desc" }],
    });
  }

  /**
   * List all Company-Login users linked to a local Account (most-recently-active
   * first). Only populated for apps that wire `resolveAccountIdForCompany`.
   */
  async listByAccount(accountId: number): Promise<CompanyUser[]> {
    return prisma.companyUser.findMany({
      where: { accountId },
      orderBy: [{ lastLoginAt: "desc" }, { createdAt: "desc" }],
    });
  }

  async getByMappUserAndCompany(
    mappUserId: string,
    companyId: number,
  ): Promise<CompanyUser | null> {
    return prisma.companyUser.findUnique({
      where: { mappUserId_companyId: { mappUserId, companyId } },
    });
  }
}
