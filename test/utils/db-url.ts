/**
 * Connection-string helpers for test utilities. Kept apart from `db.ts`, which
 * opens a Prisma client on import, so they can be unit-tested without a
 * database.
 */

/**
 * Mask the password of a connection string, so a misconfigured run never
 * prints credentials to the console or CI logs. Unparseable values are not
 * echoed at all.
 */
export function redactDatabaseUrl(url: string | undefined): string {
  if (!url) return '(not set)';
  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = '***';
    return parsed.toString();
  } catch {
    return '(unparseable connection string)';
  }
}
