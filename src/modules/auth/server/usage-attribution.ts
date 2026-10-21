/**
 * Usage attribution.
 *
 * Resolves the keys needed to attribute a metered action (LLM call, etc.) to the
 * right actor + company, so spend/usage reporting (e.g. Lago) can be built later
 * without re-plumbing every call site. The shape is intentionally general:
 *
 *   - Mapp employee (admin) → `userId` (MappTeam id); no company context.
 *   - Company-Login customer → `companyUserId` (CompanyUser id) + `companyId`
 *     (+ optional `workspaceId` when the action is workspace-scoped).
 *
 * Always exactly one of `userId` / `companyUserId` is set for a real actor.
 *
 * NOTE: this helper is generic and dependency-free. Persisting the attribution
 * is app-specific: an app that ships a metering/LLM capability adds the
 * `companyUserId`/`companyId`/`workspaceId` columns (nullable, onDelete SetNull)
 * to its usage tables and passes this result into its create/record calls. See
 * docs/template/capabilities for the documented pattern.
 */

import type { Session } from "next-auth";
import { prismaService } from "@/lib/prisma/services";
import { parseEntityId } from "@/lib/utils/parse-id";
import { isCompanyCustomer } from "../utils/auth-helpers";

export interface UsageAttribution {
  /** MappTeam id when the actor is a Mapp employee, else null. */
  userId: number | null;
  /** CompanyUser id when the actor is a Company-Login customer, else null. */
  companyUserId: number | null;
  /** Client-catalog company id (raw key for reporting), else null. */
  companyId: number | null;
  /** Workspace id when the action is workspace-scoped, else null. */
  workspaceId: number | null;
}

export async function resolveUsageAttribution(
  session: Session,
  opts?: { workspaceId?: number | null },
): Promise<UsageAttribution> {
  const user = session.user;
  const workspaceId = opts?.workspaceId ?? null;

  // An admin's "View as customer" session looks like a company customer, but
  // anything metered during it is the ADMIN's usage — never bill the company.
  if (user.customerPreview) {
    return {
      userId: user.customerPreview.adminMappUserId,
      companyUserId: null,
      companyId: null,
      workspaceId,
    };
  }

  if (isCompanyCustomer(session)) {
    const companyId = parseEntityId(user.companyId);
    let companyUserId: number | null = null;
    if (user.userId && companyId !== null) {
      const cu = await prismaService.companyUser.getByMappUserAndCompany(
        user.userId,
        companyId,
      );
      companyUserId = cu?.id ?? null;
    }
    return { userId: null, companyUserId, companyId, workspaceId };
  }

  // Mapp employee / admin.
  const adminId = parseEntityId(user.adminId);
  return { userId: adminId, companyUserId: null, companyId: null, workspaceId };
}
