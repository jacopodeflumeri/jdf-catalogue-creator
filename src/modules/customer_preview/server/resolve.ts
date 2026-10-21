/**
 * The "View as customer" overlay: an admin session + a valid preview cookie
 * becomes a read-only CUSTOMER session for one company.
 *
 * Hooked in at exactly one place — `getCustomerRequestSession` in
 * `src/modules/auth/server/require-auth.ts`, the per-request session every
 * `requireCustomer` caller reads (the customer layout, pages,
 * `getCustomerPageScope`, eligibility, company context, customer actions). So
 * everything downstream runs UNCHANGED against the synthesized session, which
 * is what makes the preview faithful, and nothing else in the app needs to know
 * a preview exists — except mutations, which must refuse (see lib/guard.ts).
 *
 * The synthesized session:
 *   - role `customer`, authSource `keycloak`, identityProvider `mapp-cloud`:
 *     a Company-Login customer, so `isCompanyCustomer` is true and the company
 *     customer layout is used;
 *   - `companyId`, `accountId` (via the subject seam, which uses the same
 *     `resolveAccountIdForCompany` a real login does), `accountName`;
 *   - workspaces: every workspace of the company, or — when the admin chose
 *     some — only those of them that the company STILL has (intersected on
 *     every request, so the token's list narrows and never widens), each with
 *     the configured service codes;
 *   - NO admin powers: `access`, `adminId`, `accessStatus` absent,
 *     `isSuperAdmin` false; no `userId`, so nothing resolves a CompanyUser row;
 *   - `customerPreview` set — mutations refuse it and the layout shows a banner.
 *
 * The cookie is bound to the admin who started it (email), re-checked against
 * the live session on every request, and only honoured while that session
 * still has admin access (admin level or SuperAdmin, active, and passing the
 * admin security checks the caller supplies).
 */
import { cookies } from "next/headers";
import type { Session } from "next-auth";
import { config } from "@/config";
import logger from "@/lib/utils/logger";
import { isSessionSuperAdmin } from "@/modules/auth/utils/auth-helpers";
import { CUSTOMER_PREVIEW_COOKIE } from "../lib/constants";
import { verifyCustomerPreviewToken } from "../lib/token";
import type { PreviewSubject, PreviewSubjectWorkspace } from "../config/subject";
import { getPreviewSubject } from "./subject-cache";

export type CustomerPreviewInvalidReason =
  | "invalid-or-expired"
  | "other-admin"
  | "no-admin-access"
  | "missing-subject"
  | "subject-error";

export type CustomerPreviewResolution =
  | { kind: "none" }
  | { kind: "active"; session: Session }
  /**
   * A preview cookie is present but unusable. The caller ends the preview by
   * sending the admin to the end route with `status` (which clears the cookie).
   */
  | {
      kind: "invalid";
      reason: CustomerPreviewInvalidReason;
      status: "ended" | "unavailable";
    };

/** The capability switch (CUSTOMER_PREVIEW_ENABLED, and Company Login on). */
export function isCustomerPreviewEnabled(): boolean {
  return config.customerPreview.enabled === true;
}

/** The signing secret — the NextAuth secret, already required by every app. */
export function customerPreviewSecret(): string {
  return process.env.NEXTAUTH_SECRET ?? "";
}

/**
 * Who may preview: an admin-level Mapp user or a SuperAdmin, not suspended or
 * denied. Viewers and editors may not — a preview shows a customer's data as
 * the customer, which is an admin power.
 */
export function canPreviewAsCustomer(session: Session | null | undefined): boolean {
  if (!session || session.user.role !== "admin") return false;
  if (isSessionSuperAdmin(session)) return true;
  const status = session.user.accessStatus || "active";
  return session.user.access === "admin" && status === "active";
}

/** Show a launch point? The capability is on AND this admin may preview. */
export function canStartCustomerPreview(session: Session | null | undefined): boolean {
  return isCustomerPreviewEnabled() && canPreviewAsCustomer(session);
}

function mappUserIdOf(adminId: unknown): number | null {
  const n = Number(adminId);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * The customer session an admin sees while previewing. Pure — exported for
 * tests. Builds `user` field by field; NOTHING of the admin's is spread in
 * except their display identity.
 */
export function buildCustomerPreviewSession(
  adminSession: Session,
  preview: {
    subject: PreviewSubject;
    /** The workspaces to grant (already intersected with the subject's). */
    granted: PreviewSubjectWorkspace[];
    expiresAt: Date;
    /** True when the admin chose some workspaces (the banner names them). */
    narrowed: boolean;
  },
): Session {
  const { user } = adminSession;
  const { subject } = preview;
  return {
    expires: adminSession.expires,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      role: "customer",
      authSource: "keycloak",
      identityProvider: "mapp-cloud",
      isMappEmployee: false,
      companyId: String(subject.companyId),
      accountId: subject.accountId != null ? String(subject.accountId) : undefined,
      accountName: subject.name,
      roles: [],
      workspaces: preview.granted.map((w) => ({
        workspaceId: String(w.id),
        services: [...(w.services ?? subject.services)],
      })),
      // No admin powers inside the preview.
      access: undefined,
      accessStatus: undefined,
      adminId: undefined,
      isSuperAdmin: false,
      customerPreview: {
        adminEmail: (user.email ?? "").toLowerCase(),
        adminMappUserId: mappUserIdOf(user.adminId),
        companyId: subject.companyId,
        companyName: subject.name,
        expiresAt: preview.expiresAt.toISOString(),
        ...(preview.narrowed ? { workspaceNames: preview.granted.map((w) => w.name) } : {}),
      },
    },
  } as Session;
}

export interface ResolveCustomerPreviewOptions {
  /**
   * Extra admin checks for the live session (IP allow-list, superadmin-only
   * mode, …). `requireCustomer` passes the same checks `requireAdmin` runs.
   * Only called when a preview cookie is present.
   */
  adminGate?: (session: Session) => Promise<boolean> | boolean;
}

/**
 * Turn an admin session + preview cookie into a customer session, if valid.
 * Free when the capability is off (the cookie is not even read) and cheap when
 * no cookie is set: no database or network access at all.
 */
export async function resolveCustomerPreview(
  session: Session | null,
  options: ResolveCustomerPreviewOptions = {},
): Promise<CustomerPreviewResolution> {
  if (!isCustomerPreviewEnabled()) return { kind: "none" };
  if (!session || session.user.role !== "admin") return { kind: "none" };

  const token = (await cookies()).get(CUSTOMER_PREVIEW_COOKIE)?.value;
  if (!token) return { kind: "none" };

  const email = (session.user.email ?? "").toLowerCase();
  const claims = verifyCustomerPreviewToken(token, customerPreviewSecret());
  let reason: CustomerPreviewInvalidReason | null = null;
  if (!claims) reason = "invalid-or-expired";
  else if (!email || claims.adminEmail !== email) reason = "other-admin";
  else if (
    !canPreviewAsCustomer(session) ||
    (options.adminGate && !(await options.adminGate(session)))
  ) {
    reason = "no-admin-access";
  }
  if (reason || !claims) {
    logger.warn("Customer preview cookie rejected", { adminEmail: email || null, reason });
    return { kind: "invalid", reason: reason ?? "invalid-or-expired", status: "ended" };
  }

  let subject: PreviewSubject | null;
  try {
    subject = await getPreviewSubject(claims.subject);
  } catch (error) {
    logger.error("Customer preview subject could not be resolved", {
      companyId: claims.subject,
      error: error instanceof Error ? error.message : String(error),
    });
    return { kind: "invalid", reason: "subject-error", status: "unavailable" };
  }
  if (!subject) {
    logger.warn("Customer preview subject no longer exists", { companyId: claims.subject });
    return { kind: "invalid", reason: "missing-subject", status: "unavailable" };
  }

  // A narrowed preview grants the chosen workspaces the company still has —
  // intersected, so a stale or foreign id grants nothing.
  const chosen = claims.workspaceIds ? new Set(claims.workspaceIds) : null;
  const granted = chosen
    ? subject.workspaces.filter((w) => chosen.has(w.id))
    : subject.workspaces;

  return {
    kind: "active",
    session: buildCustomerPreviewSession(session, {
      subject,
      granted,
      expiresAt: new Date(claims.exp),
      narrowed: chosen !== null,
    }),
  };
}
