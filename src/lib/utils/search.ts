/**
 * Search input helpers.
 *
 * Prisma's `contains` / `startsWith` / `endsWith` filters compile to Postgres
 * `LIKE` / `ILIKE` and pass the value through as a pattern: `%` and `_` stay
 * wildcards and `\` stays the escape character. So a search for `%` or `__`
 * matches every row, and `50%` matches "50 items" as well as "50% off". That
 * is a bug on an admin search bar and a data oracle on an external surface
 * (a caller can page the whole table, or probe columns a character at a time).
 *
 * Run user input through `escapeLikePattern()` before it reaches one of those
 * filters, so it is matched as a literal substring.
 */

/**
 * Escape a string for use as a literal inside a LIKE/ILIKE pattern, including
 * Prisma's `contains` / `startsWith` / `endsWith`. Escapes `\` first (Postgres'
 * default LIKE escape character), then `%` and `_`.
 *
 * Do not use it for `equals`: that is not a pattern, and the escapes would be
 * matched literally.
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/**
 * Trim a raw search term and escape it for `contains`. Returns `undefined` for
 * a missing or blank term, so callers can skip the filter entirely.
 */
export function toContainsTerm(raw: string | null | undefined): string | undefined {
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  return trimmed ? escapeLikePattern(trimmed) : undefined;
}
