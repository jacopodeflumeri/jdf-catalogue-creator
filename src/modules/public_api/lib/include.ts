/**
 * Include Parameter Parser
 *
 * Pure utility — no Next.js dependencies, safe for Jest.
 */

/**
 * Parse a comma-separated `include` param into a Set of valid include names.
 */
export function parseInclude(
  searchParams: URLSearchParams,
  allowed: readonly string[],
): Set<string> {
  const raw = searchParams.get("include");
  if (!raw) return new Set();

  const requested = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const allowedSet = new Set(allowed);
  return new Set(requested.filter((r) => allowedSet.has(r)));
}
