/**
 * "View as customer" — the ONE data seam an app implements.
 *
 * Given a client-catalog company id, return what a customer of that company
 * logs in with: the company's name, the local Account it maps to (if any), its
 * workspaces, and the service codes those workspaces carry. Return `null` when
 * the company cannot be previewed (unknown, or deactivated).
 *
 * Called on EVERY request during a preview (memoized per request, and for
 * `SUBJECT_CACHE_TTL_MS` across requests in `server/subject-cache.ts`), so the
 * preview always reflects the company as it is NOW: a workspace removed since
 * the preview started is no longer granted. Keep it a cheap, side-effect-free
 * read.
 *
 * The template default:
 *   1. client_catalog configured (`CLIENT_CATALOG_BASE_URL` set) → the
 *      company and its workspaces from the Company Management Service;
 *   2. otherwise → a stub built from the `company_user` table: a company is
 *      previewable once one of its users has logged in, with NO workspaces (the
 *      template has no local workspace table). Enough to see the shell; an
 *      eligibility policy that needs workspace services will (correctly) send
 *      the preview to /account/get-started.
 *
 * Override `resolvePreviewSubject` when your app keeps companies/workspaces
 * locally — e.g. after installing the client_catalog scaffold:
 *
 *   export async function resolvePreviewSubject(companyId: number) {
 *     const account = await prisma.account.findUnique({
 *       where: { clientCatalogCompanyId: companyId },
 *       select: { id: true, name: true },
 *     });
 *     if (!account) return null;
 *     const workspaces = await prisma.workspace.findMany({
 *       where: { clientCatalogCompanyId: companyId },
 *       select: { clientCatalogWorkspaceId: true, name: true },
 *     });
 *     return {
 *       companyId,
 *       accountId: account.id,
 *       name: account.name,
 *       workspaces: workspaces.map((w) => ({
 *         id: w.clientCatalogWorkspaceId,
 *         name: w.name ?? `Workspace ${w.clientCatalogWorkspaceId}`,
 *       })),
 *       services: config.customerPreview.services,
 *     };
 *   }
 *
 * `accountId` MUST be what `resolveAccountIdForCompany(companyId)` returns for a
 * real login of this company (the default calls it), or the preview resolves a
 * different company context than the customer gets.
 */
import { config } from "@/config";
import { prisma } from "@/lib/prisma/client";
import logger from "@/lib/utils/logger";
import { resolveAccountIdForCompany } from "@/modules/auth/server/company-account-resolver";

export interface PreviewSubjectWorkspace {
  /** Client-catalog workspace id — the `workspaceId` a real session carries. */
  id: number;
  name: string;
  /**
   * Service codes for THIS workspace, when they differ per workspace.
   * Absent = the subject-level `services`.
   */
  services?: string[];
}

export interface PreviewSubject {
  /** Client-catalog company id. */
  companyId: number;
  /** Local Account id, exactly as `resolveAccountIdForCompany` resolves it at login. */
  accountId: number | null;
  name: string;
  /** Every workspace a customer of this company could be granted. */
  workspaces: PreviewSubjectWorkspace[];
  /**
   * Service codes granted on every workspace (unless the workspace sets its
   * own) — the Keycloak claim codes your eligibility policy checks, NOT the
   * client catalog's product names (INTELLIGENCE, FASHION, …).
   */
  services: string[];
}

export async function resolvePreviewSubject(
  companyId: number,
): Promise<PreviewSubject | null> {
  if (process.env.CLIENT_CATALOG_BASE_URL) {
    return resolveFromClientCatalog(companyId);
  }
  return resolveFromCompanyUsers(companyId);
}

async function resolveFromClientCatalog(companyId: number): Promise<PreviewSubject | null> {
  // Imported lazily so an app without the client_catalog env never loads it.
  const { getCompany, getWorkspaces } = await import("@/modules/client_catalog");
  const company = await getCompany(companyId);
  // An inactive company's customers cannot log in, so there is nothing to see.
  if (!company || company.active === false) return null;

  const workspaces = company.workspaces ?? (await getWorkspaces(companyId));
  return {
    companyId,
    accountId: await resolveAccountIdForCompany(companyId),
    name: company.name || `Company ${companyId}`,
    workspaces: workspaces
      // Defensive: never grant a workspace the API attributes to another company.
      .filter(
        (w) =>
          Number.isInteger(w.id) &&
          w.id > 0 &&
          (w.companyId == null || w.companyId === companyId),
      )
      .map((w) => ({ id: w.id, name: w.name || `Workspace ${w.id}` })),
    services: config.customerPreview.services,
  };
}

async function resolveFromCompanyUsers(companyId: number): Promise<PreviewSubject | null> {
  const user = await prisma.companyUser.findFirst({
    where: { companyId },
    orderBy: { lastLoginAt: "desc" },
    select: { account: { select: { name: true, companyName: true } } },
  });
  if (!user) return null;

  logger.debug(
    "Customer preview subject from company_user (client_catalog not configured): no workspaces",
    { companyId },
  );
  return {
    companyId,
    accountId: await resolveAccountIdForCompany(companyId),
    name: user.account?.companyName || user.account?.name || `Company ${companyId}`,
    workspaces: [],
    services: config.customerPreview.services,
  };
}
