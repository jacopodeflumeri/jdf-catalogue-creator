/**
 * Audit Log Service - Prisma Implementation
 *
 * Read side of the admin audit log (/admin/audit-log). Rows are written through
 * `writeAuditLog` in src/modules/audit, not through this service.
 */

import { prisma } from "../client";
import type { Prisma } from "@/generated/prisma/client";
import { toContainsTerm } from "@/lib/utils/search";

export class PrismaAuditLogService {
  /**
   * Newest-first page of audit rows with the acting team member's name.
   * Filtering and pagination happen in Postgres — the table only ever grows.
   */
  async listPaginated(opts: {
    entityType?: string;
    search?: string;
    limit: number;
    offset: number;
  }) {
    // Escaped: `%` / `_` in the search box match literally, not as wildcards.
    const search = toContainsTerm(opts.search);

    const where: Prisma.AuditLogWhereInput = {
      ...(opts.entityType ? { entityType: opts.entityType } : {}),
      ...(search
        ? {
            OR: [
              { message: { contains: search, mode: "insensitive" } },
              { action: { contains: search, mode: "insensitive" } },
              { actorEmail: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: {
          mappUser: {
            select: { id: true, email: true, firstname: true, lastname: true },
          },
        },
        take: opts.limit,
        skip: opts.offset,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { rows, total };
  }
}
