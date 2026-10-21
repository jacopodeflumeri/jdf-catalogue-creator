/**
 * Pure helpers shared by the server and the client.
 */
import { resolveCallbackUrl } from "@/modules/auth/lib/callback-url";
import {
  CUSTOMER_PREVIEW_DEFAULT_RETURN_TO,
  CUSTOMER_PREVIEW_STATUSES,
  type CustomerPreviewStatus,
} from "./constants";

/**
 * The preview's end time as `HH:MM`, in `timeZone` (default: the runtime's).
 *
 * Only call this in the BROWSER (see `PreviewEndTime`). On the server the
 * runtime's zone is the container's (UTC), so formatting during server render
 * prints a different hour than the browser's first render — a hydration
 * mismatch on every preview page. The explicit `timeZone` parameter exists for
 * tests and for callers that genuinely know the zone.
 */
export function formatPreviewEndTime(iso: string, timeZone?: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
}

export function isCustomerPreviewStatus(value: unknown): value is CustomerPreviewStatus {
  return (
    typeof value === "string" &&
    (CUSTOMER_PREVIEW_STATUSES as readonly string[]).includes(value)
  );
}

/**
 * A sanitised admin path to return to: same-site and under /admin, else the
 * default. Any `preview` param already on it is dropped (a page the admin left
 * with a notice should not show that notice again).
 */
export function sanitizePreviewReturnTo(raw: string | null | undefined): string {
  const resolved = resolveCallbackUrl(raw, "admin");
  // resolveCallbackUrl falls back to the area root (/admin) for anything it
  // refuses; the preview's own default is more useful.
  const path = resolved === "/admin" && raw?.trim() !== "/admin"
    ? CUSTOMER_PREVIEW_DEFAULT_RETURN_TO
    : resolved;
  const url = new URL(path, "https://return-to.invalid");
  url.searchParams.delete("preview");
  return `${url.pathname}${url.search}${url.hash}`;
}

/** `returnTo` with `?preview=<status>` set (replacing any existing one). */
export function withPreviewStatus(returnTo: string, status: CustomerPreviewStatus): string {
  const url = new URL(sanitizePreviewReturnTo(returnTo), "https://return-to.invalid");
  url.searchParams.set("preview", status);
  return `${url.pathname}${url.search}${url.hash}`;
}
