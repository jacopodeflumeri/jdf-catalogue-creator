/**
 * `resolvePreviewSubject`, memoized for a short time across requests.
 *
 * During a preview the subject is resolved on every customer request. With the
 * client_catalog default that is an HTTP call to the Company Management
 * Service per page, so the result is kept for `SUBJECT_CACHE_TTL_MS`: a
 * workspace removed from the company stops being granted within a minute.
 * Applies to app overrides of the seam too, so they need no caching of their
 * own. `null` (unknown company) is cached as well; errors are not.
 */
// Type-only: the seam (and Prisma / the client catalog behind it) is loaded
// lazily, on the first preview request, so require-auth stays light for
// every app and every request without a preview.
import type { PreviewSubject } from "../config/subject";

export const SUBJECT_CACHE_TTL_MS = 60_000;
const MAX_ENTRIES = 500;

const entries = new Map<number, { at: number; value: PreviewSubject | null }>();

export async function getPreviewSubject(
  companyId: number,
  options: { fresh?: boolean; now?: number } = {},
): Promise<PreviewSubject | null> {
  const now = options.now ?? Date.now();
  const hit = options.fresh ? undefined : entries.get(companyId);
  if (hit && now - hit.at < SUBJECT_CACHE_TTL_MS) return hit.value;

  const { resolvePreviewSubject } = await import("../config/subject");
  const value = await resolvePreviewSubject(companyId);
  if (entries.size >= MAX_ENTRIES) entries.clear();
  entries.set(companyId, { at: now, value });
  return value;
}

/** Drop the cache — tests, or after a change an admin wants to see at once. */
export function clearPreviewSubjectCache(): void {
  entries.clear();
}
