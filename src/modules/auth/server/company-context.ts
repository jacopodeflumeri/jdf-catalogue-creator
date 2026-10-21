/**
 * Company context resolution.
 *
 * Maps a logged-in Company-Login customer's session to their local `Account`,
 * so customer-facing pages can scope content to the company.
 *
 * The session already carries the resolved local `accountId` (set by the
 * company-user hydrator at login via the `resolveAccountIdForCompany` seam).
 * This generic version returns the account identity only — apps that have
 * company-scoped child entities (e.g. FTL's brands/catalogs) extend the result
 * with their own queries on top of `accountId`.
 */

import { cache } from "react";
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma/client";
import logger from "@/lib/utils/logger";
import { parseEntityId } from "@/lib/utils/parse-id";

export interface CompanyContext {
  /** Resolved local Account id, or null when the company isn't mapped. */
  accountId: number | null;
  accountName: string | null;
  /** Raw client-catalog company id from the session (for attribution/joins). */
  companyId: string | null;
}

// Memoized per request (React `cache`, keyed on the session object, which
// `requireCustomer` resolves once per request): a page and the server actions
// it awaits while rendering share one lookup.
export const resolveCompanyContext = cache(async function resolveCompanyContext(
  session: Session,
): Promise<CompanyContext> {
  const accountId = parseEntityId(session.user.accountId);
  const companyId = session.user.companyId ?? null;

  if (accountId === null) {
    return { accountId: null, accountName: null, companyId };
  }

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { id: true, name: true, companyName: true },
  });

  const result: CompanyContext = {
    accountId,
    accountName: account?.companyName ?? account?.name ?? null,
    companyId,
  };

  logger.debug("Resolved company context", {
    companyId: result.companyId,
    accountId: result.accountId,
    accountName: result.accountName,
  });

  return result;
});
