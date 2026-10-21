/**
 * Parse a (possibly string, possibly session-derived) entity id into a finite
 * integer, or `null` when it isn't a valid numeric id.
 *
 * Why this exists: services accept string `accountId`/`userId` and `parseInt`
 * them internally. Company-Login customers have no legacy numeric `Account`/`User`
 * id (and their Mapp-Cloud `userId` can be a large numeric that collides with a
 * legacy `User.id`), so passing those into legacy data methods used to crash with
 * `findMany({ where: { accountId: NaN } })`. Use this once per id-accepting read
 * method so the behavior is uniform instead of guarded-by-luck.
 */
export function parseEntityId(
  value: string | number | null | undefined,
): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}
