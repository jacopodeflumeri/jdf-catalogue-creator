/**
 * The signed token behind "View as customer".
 *
 * Pure apart from `node:crypto` — no Next, no Prisma — so it is unit-testable.
 * `startCustomerPreviewAction` sets it in the preview cookie; the overlay in
 * `requireCustomer` and the end route read it.
 *
 * What it carries, and why so little:
 *   - `adminEmail` — the preview is bound to the admin who started it. Another
 *     admin presenting the cookie gets nothing; the overlay re-checks it
 *     against the live session on every request.
 *   - `subject` — the client-catalog company id being viewed.
 *   - `exp` — expiry (ms since epoch).
 *   - `workspaceIds` (optional) — the workspaces to grant, when the admin chose
 *     some. The workspaces themselves are re-resolved on every request through
 *     the subject seam; this list only NARROWS them, never widens.
 *   - `returnTo` (optional) — the admin page the preview was started from, so
 *     the end route can go back there. Re-sanitised when used.
 *
 * Format: `base64url(json).base64url(hmacSha256(json))`, keyed with
 * NEXTAUTH_SECRET. Verification is constant-time and never throws.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export interface CustomerPreviewClaims {
  v: 1;
  /** Lower-cased email of the admin who started the preview. */
  adminEmail: string;
  /** Client-catalog company id being viewed. */
  subject: number;
  /** Expiry, ms since epoch. */
  exp: number;
  /**
   * Client-catalog workspace ids to grant, as a customer whose Keycloak claim
   * grants only those would have. Absent = every workspace of the company
   * (the "whole company" grant).
   */
  workspaceIds?: number[];
  /** Admin path the preview was started from (validated again on use). */
  returnTo?: string;
}

/** Bounds the list a token may carry; companies have a handful of workspaces. */
export const MAX_PREVIEW_WORKSPACES = 50;
const MAX_RETURN_TO_LENGTH = 512;

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createCustomerPreviewToken(
  claims: Omit<CustomerPreviewClaims, "v">,
  secret: string,
): string {
  if (!secret) throw new Error("Customer preview needs a signing secret");
  const payload = Buffer.from(
    JSON.stringify({ v: 1, ...claims, adminEmail: claims.adminEmail.toLowerCase() }),
  ).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/**
 * The claims of a token signed with `secret` and well-formed, IGNORING expiry,
 * or `null`. Only for housekeeping that must work on an expired token (the end
 * route reading `returnTo`). Anything that grants access uses
 * `verifyCustomerPreviewToken`.
 */
export function readCustomerPreviewToken(
  token: string | null | undefined,
  secret: string,
): CustomerPreviewClaims | null {
  if (typeof token !== "string" || !token || !secret) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;

  const expected = Buffer.from(sign(payload, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const c = parsed as Partial<CustomerPreviewClaims>;
  if (
    c.v !== 1 ||
    typeof c.adminEmail !== "string" ||
    !c.adminEmail ||
    !isPositiveInt(c.subject) ||
    typeof c.exp !== "number" ||
    !Number.isFinite(c.exp)
  ) {
    return null;
  }
  if (
    c.workspaceIds !== undefined &&
    (!Array.isArray(c.workspaceIds) ||
      c.workspaceIds.length === 0 ||
      c.workspaceIds.length > MAX_PREVIEW_WORKSPACES ||
      !c.workspaceIds.every(isPositiveInt))
  ) {
    return null;
  }
  if (
    c.returnTo !== undefined &&
    (typeof c.returnTo !== "string" || c.returnTo.length > MAX_RETURN_TO_LENGTH)
  ) {
    return null;
  }
  return c as CustomerPreviewClaims;
}

/**
 * The claims, or `null` for anything that is not a valid, UNEXPIRED token
 * signed with `secret`. Never throws on bad input.
 */
export function verifyCustomerPreviewToken(
  token: string | null | undefined,
  secret: string,
  now: number = Date.now(),
): CustomerPreviewClaims | null {
  const claims = readCustomerPreviewToken(token, secret);
  if (!claims || claims.exp <= now) return null;
  return claims;
}
