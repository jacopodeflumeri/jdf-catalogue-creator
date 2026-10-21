/**
 * "View as customer" constants.
 *
 * NO IMPORTS, on purpose: `src/proxy.ts` needs the cookie name, and the proxy
 * must not pull in `node:crypto`, Prisma or Next server APIs. The proxy only
 * checks the cookie is PRESENT; the signature, expiry and admin binding are
 * verified server-side by the overlay in `requireCustomer`.
 */

/** Name of the httpOnly cookie that carries the signed preview token. */
export const CUSTOMER_PREVIEW_COOKIE = "labs_customer_preview";

/** How long one preview lasts. Start it again to extend. */
export const CUSTOMER_PREVIEW_TTL_SECONDS = 30 * 60;

/**
 * The cookie outlives the token by this much. The token's own `exp` is what
 * ends the preview; the extra cookie lifetime only means the server still SEES
 * the expired token, so it can send the admin to the end route with an "ended"
 * notice (and back to where they started) instead of the browser silently
 * dropping the cookie and the admin landing on a sign-in error.
 */
export const CUSTOMER_PREVIEW_COOKIE_GRACE_SECONDS = 10 * 60;

/**
 * The end route. A GET route handler under /admin (so the proxy already
 * requires an admin session). Link to it with a plain `<a>`, never `<Link>`:
 * a client-side navigation would try to fetch a route handler as a page.
 */
export const CUSTOMER_PREVIEW_END_PATH = "/admin/customer-preview/end";

/** Where the end route (and a refused start) goes when there is no better place. */
export const CUSTOMER_PREVIEW_DEFAULT_RETURN_TO = "/admin/company-users";

/** Where a started preview opens. */
export const CUSTOMER_PREVIEW_START_PATH = "/account";

/**
 * Values of the `?preview=` query param the admin page receives after a
 * preview ends or a start is refused. `CustomerPreviewNotice` renders them.
 */
export const CUSTOMER_PREVIEW_STATUSES = [
  "exited", // the admin pressed Exit
  "ended", // expired, forged, another admin's, or the admin lost admin access
  "unavailable", // the company could not be resolved any more (seam returned null)
  "not-found", // start refused: unknown company, or a workspace not in it
  "disabled", // start refused: the capability is off
] as const;

export type CustomerPreviewStatus = (typeof CUSTOMER_PREVIEW_STATUSES)[number];

/**
 * The proxy's gate for the customer area (`/account`, `/api/account`). Lives
 * here (dependency-free) so it is unit-testable without loading the proxy.
 * Who may enter:
 * - customers;
 * - admins with an `accountId` on their token (the legacy accountId-only
 *   "view account" — /auth/admin-view-account);
 * - admins carrying a "View as customer" preview cookie, for PAGES only and
 *   only while the capability is on. The proxy checks the cookie is PRESENT;
 *   its signature, expiry and admin binding are verified server-side in
 *   `requireCustomer`. Customer API routes don't get the preview overlay, so
 *   an admin is not let into them on the cookie alone.
 */
export function allowsCustomerArea(input: {
  role?: "customer" | "admin";
  accountId?: string;
  isApi: boolean;
  previewEnabled: boolean;
  hasPreviewCookie: boolean;
}): boolean {
  if (input.role === "customer") return true;
  if (input.role !== "admin") return false;
  if (input.accountId) return true;
  return !input.isApi && input.previewEnabled && input.hasPreviewCookie;
}

/** Shown when a customer mutation is refused during a preview. */
export const CUSTOMER_PREVIEW_READ_ONLY_MESSAGE =
  "You're viewing as this customer. Changes can't be made in a preview.";
