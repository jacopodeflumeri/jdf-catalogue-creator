/**
 * Where to send a user after an auth step (sign-in, "view as account").
 *
 * A `callbackUrl` query value is user-controlled: anyone can craft a link to
 * `/auth/...?callbackUrl=https://evil.example` or `javascript:...`. So it is
 * only honoured when it is same-origin AND inside the area the user is being
 * sent to — `/account` for the customer area, `/admin` for Mapp staff. A
 * customer sent to `/admin` would only be bounced back to sign-in, and an open
 * redirect is never acceptable. The returned path is rebuilt from the parsed
 * URL, never echoed raw; anything refused falls back to the area's root.
 *
 * Pure (no Next or NextAuth imports) so it is unit-testable and usable on both
 * the server and the client.
 */

export type CallbackArea = "account" | "admin";

const AREA_ROOT: Record<CallbackArea, string> = {
  account: "/account",
  admin: "/admin",
};

// Base for resolving rooted relative paths when no origin is given. `.invalid`
// is reserved (RFC 6761), so it can never be a real host.
const PLACEHOLDER_ORIGIN = "https://callback-url.invalid";

/**
 * @param raw     The `callbackUrl` query value, if any.
 * @param area    Which area the user is being sent to.
 * @param origin  This app's origin (e.g. `window.location.origin`). Absolute
 *                callback urls must match it exactly. Without it (server
 *                side, where the public origin is not reliably known), only
 *                rooted relative paths are honoured.
 * @returns A same-origin path (with query and hash) inside `area`, or the
 *          area's root.
 */
export function resolveCallbackUrl(
  raw: string | null | undefined,
  area: CallbackArea,
  origin?: string,
): string {
  const root = AREA_ROOT[area];
  // Not a string at runtime if the query repeats the param (`?callbackUrl=a&callbackUrl=b`).
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return root;

  // Backslashes are treated as slashes by browsers, so `/\evil.com` is
  // protocol-relative. Refuse rather than normalise.
  if (value.includes("\\")) return root;

  const isAbsolute = /^https?:\/\//i.test(value);
  if (isAbsolute) {
    if (!origin) return root;
  } else if (!value.startsWith("/") || value.startsWith("//")) {
    // Relative values must be rooted paths; `//host` is protocol-relative, and
    // anything else (`javascript:`, `data:`, `evil.com/x`) is refused.
    return root;
  }

  const base = origin ?? PLACEHOLDER_ORIGIN;
  let url: URL;
  try {
    url = new URL(value, base);
  } catch {
    return root;
  }
  if (url.origin !== base) return root;

  // `new URL` has already collapsed `..` (and `%2e%2e`), so the pathname is final.
  const path = url.pathname;
  if (path !== root && !path.startsWith(`${root}/`)) return root;

  return `${path}${url.search}${url.hash}`;
}
