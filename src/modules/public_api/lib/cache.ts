/**
 * Public API Cache-Control Helpers
 *
 * Pick by WHO may see the response, not by endpoint shape:
 *
 * - `cacheHeaders()` / `snapshotCacheHeaders()` are `public` with `s-maxage`:
 *   a shared cache (CDN, proxy) may store the response and answer any later
 *   request for the same URL from it, whichever key sent it — or none. Only for
 *   data that is identical for every key, e.g. a global taxonomy.
 * - `privateCacheHeaders()` is for anything that depends on the calling key:
 *   account-scoped data, or a response shaped by the key type. Only the
 *   caller's own client may reuse it.
 */

const DEFAULT_MAX_AGE = 300; // 5 minutes
const SNAPSHOT_MAX_AGE = 600; // 10 minutes

/** The request header the API key travels in (read by `withApiKeyAuth`). */
export const API_KEY_HEADER = "X-API-Key";

/**
 * Return Cache-Control headers for list/detail endpoints whose response is the
 * same for every API key. Use `privateCacheHeaders()` for anything key-scoped.
 */
export function cacheHeaders(maxAge?: number): Record<string, string> {
  const age = maxAge ?? DEFAULT_MAX_AGE;
  return {
    "Cache-Control": `public, max-age=${age}, s-maxage=${age * 2}`,
  };
}

/**
 * Return Cache-Control headers for snapshot/bulk endpoints whose response is
 * the same for every API key.
 */
export function snapshotCacheHeaders(): Record<string, string> {
  return cacheHeaders(SNAPSHOT_MAX_AGE);
}

/**
 * Cache-Control for responses that depend on the calling API key (an
 * account-scoped key's data, or fields only an internal key sees). A shared
 * cache must never hold these: it could answer another key's request from
 * them. The caller's own client may still reuse a response for `maxAge`
 * seconds; `Vary` on the key header keeps a client that switches keys from
 * reusing one key's response for another.
 */
export function privateCacheHeaders(maxAge?: number): Record<string, string> {
  return {
    "Cache-Control": `private, max-age=${maxAge ?? DEFAULT_MAX_AGE}`,
    Vary: API_KEY_HEADER,
  };
}
