"use server";

/**
 * "View as customer" server actions — the ONLY way a preview starts.
 *
 * Ending one is the GET route `/admin/customer-preview/end` (see
 * `server/end-route.ts`), so the banner's Exit link and an expired cookie land
 * in the same place.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/modules/auth/server/require-auth";
import { sessionAuditActor, writeAuditLog } from "@/modules/audit";
import logger from "@/lib/utils/logger";
import {
  CUSTOMER_PREVIEW_COOKIE,
  CUSTOMER_PREVIEW_COOKIE_GRACE_SECONDS,
  CUSTOMER_PREVIEW_START_PATH,
  CUSTOMER_PREVIEW_TTL_SECONDS,
} from "../lib/constants";
import { sanitizePreviewReturnTo, withPreviewStatus } from "../lib/format";
import { createCustomerPreviewToken, MAX_PREVIEW_WORKSPACES } from "../lib/token";
import type { PreviewSubjectWorkspace } from "../config/subject";
import { getPreviewSubject } from "./subject-cache";
import { customerPreviewSecret, isCustomerPreviewEnabled } from "./resolve";

export interface StartCustomerPreviewInput {
  /** Client-catalog company id. */
  companyId: number;
  /**
   * Narrow the preview to these of the company's client-catalog workspace ids
   * — what a customer whose Keycloak claim grants only those sees. Omit for
   * the whole company.
   */
  workspaceIds?: number[];
  /** Admin path to come back to when the preview ends (sanitised). */
  returnTo?: string;
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/**
 * Admin access level (or SuperAdmin) only. Sets the signed preview cookie for
 * one company, writes `customer_preview_start` to the audit log and opens
 * /account.
 *
 * Workspace ids are REFUSED, never dropped or coerced: anything that is not a
 * positive integer number, or not a workspace of THIS company, sends the admin
 * back with `?preview=not-found` and sets no cookie. An admin who picked
 * "<workspace> only" must never silently get the whole company, or another
 * company's workspace.
 */
export async function startCustomerPreviewAction(
  input: StartCustomerPreviewInput,
): Promise<void> {
  const session = await requireAdmin({ requireAdminAccess: true });
  const returnTo = sanitizePreviewReturnTo(input?.returnTo);

  if (!isCustomerPreviewEnabled()) {
    redirect(withPreviewStatus(returnTo, "disabled"));
  }

  const companyId = input?.companyId;
  let subject: Awaited<ReturnType<typeof getPreviewSubject>> = null;
  let lookupFailed = false;
  if (isPositiveInt(companyId)) {
    try {
      subject = await getPreviewSubject(companyId, { fresh: true });
    } catch (error) {
      lookupFailed = true;
      logger.error("Customer preview could not resolve the company", {
        companyId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  if (lookupFailed) {
    redirect(withPreviewStatus(returnTo, "unavailable"));
  }
  if (!subject) {
    redirect(withPreviewStatus(returnTo, "not-found"));
  }

  let chosen: PreviewSubjectWorkspace[] | null = null;
  if (input.workspaceIds !== undefined) {
    const wanted = input.workspaceIds;
    const valid =
      Array.isArray(wanted) &&
      wanted.length > 0 &&
      wanted.length <= MAX_PREVIEW_WORKSPACES &&
      wanted.every(isPositiveInt) &&
      new Set(wanted).size === wanted.length;
    const byId = new Map(subject.workspaces.map((w) => [w.id, w]));
    const found = valid ? wanted.map((id) => byId.get(id)) : [];
    if (!valid || found.some((w) => w === undefined)) {
      redirect(withPreviewStatus(returnTo, "not-found"));
    }
    chosen = found as PreviewSubjectWorkspace[];
  }

  const adminEmail = (session.user.email ?? "").toLowerCase();
  const expiresAt = Date.now() + CUSTOMER_PREVIEW_TTL_SECONDS * 1000;
  const token = createCustomerPreviewToken(
    {
      adminEmail,
      subject: subject.companyId,
      exp: expiresAt,
      returnTo,
      ...(chosen ? { workspaceIds: chosen.map((w) => w.id) } : {}),
    },
    customerPreviewSecret(),
  );

  (await cookies()).set(CUSTOMER_PREVIEW_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CUSTOMER_PREVIEW_TTL_SECONDS + CUSTOMER_PREVIEW_COOKIE_GRACE_SECONDS,
  });

  await writeAuditLog({
    ...sessionAuditActor(session),
    action: "customer_preview_start",
    entityType: "company",
    entityId: subject.companyId,
    message: `Started viewing ${subject.name} as a customer${
      chosen ? ` (${chosen.map((w) => w.name).join(", ")} only)` : ""
    }`,
    data: {
      companyId: subject.companyId,
      workspaceIds: chosen ? chosen.map((w) => w.id) : "all",
      expiresAt: new Date(expiresAt).toISOString(),
    },
  });
  logger.info("Customer preview started", { adminEmail, companyId: subject.companyId });

  redirect(CUSTOMER_PREVIEW_START_PATH);
}

export type CustomerPreviewOptionsResult =
  | { ok: true; companyName: string; workspaces: Array<{ id: number; name: string }> }
  | { ok: false };

/**
 * The workspaces an admin can choose from for one company — for a launch
 * point that does not have them at hand (e.g. a list of users). Read-only;
 * same access rule as starting.
 */
export async function getCustomerPreviewOptionsAction(
  companyId: number,
): Promise<CustomerPreviewOptionsResult> {
  await requireAdmin({ requireAdminAccess: true });
  if (!isCustomerPreviewEnabled() || !isPositiveInt(companyId)) return { ok: false };
  try {
    const subject = await getPreviewSubject(companyId);
    if (!subject) return { ok: false };
    return {
      ok: true,
      companyName: subject.name,
      workspaces: subject.workspaces.map((w) => ({ id: w.id, name: w.name })),
    };
  } catch (error) {
    logger.error("Customer preview options could not be loaded", {
      companyId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { ok: false };
  }
}
