/**
 * Canonical external-id routing — shared base helper + convention.
 *
 * The template's routing convention: admin routes identify records by their
 * canonical cross-system EXTERNAL ids (e.g. the client-catalog companyId /
 * workspaceId), NOT internal autoincrement primary keys. Internal ids never
 * appear in URLs. See docs/template/ROUTING.md.
 *
 * A capability that adds such routes (e.g. client_catalog) resolves the external
 * id to an internal record AT THE ROUTE BOUNDARY, then works with the internal
 * record. Two rules keep this correct:
 *
 *   1. Parse the URL segment with `parseRouteId()` and `notFound()` on null.
 *   2. GUARDRAIL: if a boundary resolver does a post-fetch scope check (e.g.
 *      `workspace.companyId === companyId`), it MUST ALWAYS `select` that scope
 *      field itself — never trust a caller-passed `select`. Omitting it leaves
 *      the field `undefined`, the check fails, the resolver returns null → a
 *      spurious `notFound()`/404. (This is a real bug class; see docs/template/ROUTING.md.)
 *
 * This module is dependency-free (no prisma, no next/cache) so it is safe to
 * import from both server and client components.
 */

/**
 * Parse a non-negative integer external id from a URL path segment.
 *
 * Returns the number, or `null` when the segment is not a clean integer (so the
 * caller can `notFound()`). Rejects negatives, decimals, whitespace-only, and
 * any non-digit content.
 */
export function parseRouteId(
  segment: string | undefined | null,
): number | null {
  if (typeof segment !== "string") return null;
  const trimmed = segment.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return Number.isSafeInteger(n) ? n : null;
}
