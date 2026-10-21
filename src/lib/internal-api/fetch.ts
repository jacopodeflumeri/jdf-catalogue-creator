/**
 * Shared fetch wrapper for Mapp internal APIs.
 *
 * Applies the shared OAuth2 Bearer token (see oauth.ts) and, on a 401, clears
 * the token cache and retries ONCE — the cached token may simply be stale. This
 * is the one subtle bit every internal client needs, so it lives here rather
 * than being re-implemented per service.
 *
 * Returns the raw Response; callers own response parsing and error messages
 * (which differ per service). The Authorization header is set here — pass any
 * other headers (Accept, Content-Type) via `init.headers`.
 */

import logger from "@/lib/utils/logger";
import {
  clearInternalApiTokenCache,
  getInternalApiToken,
  type InternalApiOAuthConfig,
} from "./oauth";

export async function internalApiFetch(
  url: string,
  oauth: InternalApiOAuthConfig | undefined,
  init?: { method?: string; headers?: Record<string, string>; body?: BodyInit },
): Promise<Response> {
  const build = (token: string): RequestInit => ({
    method: init?.method ?? "GET",
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` },
    ...(init?.body !== undefined ? { body: init.body } : {}),
  });

  let token = await getInternalApiToken(oauth);
  let response = await fetch(url, build(token));

  if (response.status === 401) {
    logger.warn?.(
      `Internal API: 401 on ${init?.method ?? "GET"} ${url}, refreshing token and retrying`,
    );
    clearInternalApiTokenCache();
    token = await getInternalApiToken(oauth);
    response = await fetch(url, build(token));
  }

  return response;
}
