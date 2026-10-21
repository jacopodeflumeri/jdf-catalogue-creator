/**
 * Shared OAuth2 client-credentials token provider for Mapp internal APIs.
 *
 * A single Keycloak (realm `s2s`) credential authenticates the app to ALL
 * internal Mapp services — the Company Management Service (client catalog) and
 * the Product Feed Service (UPC) alike. Rather than each integration carrying
 * its own copy of the token URL / client id / secret, they share this provider
 * and one set of env vars:
 *   - INTERNAL_API_TOKEN_URL   (e.g. https://auth.shortest-route.com/realms/s2s/protocol/openid-connect/token)
 *   - INTERNAL_API_CLIENT_ID   (e.g. mapp-labs)
 *   - INTERNAL_API_CLIENT_SECRET
 *
 * The realm-`s2s` client must be authorized for whichever internal services the
 * app calls. The default `mapp-labs` client is authorized for both
 * company-management-service and product-feed-service.
 *
 * TLS to the internal hosts is handled by the vendored ca.internal.mapp.tools
 * root (see certs/ + Dockerfile + docker-entrypoint.sh) — no per-service CA env.
 */

import logger from "@/lib/utils/logger";

export type InternalApiOAuthConfig = {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
};

/** Read the shared internal-API OAuth config from env, or null if not configured. */
export function getInternalApiOAuthConfigFromEnv(): InternalApiOAuthConfig | null {
  const tokenUrl = process.env.INTERNAL_API_TOKEN_URL;
  const clientId = process.env.INTERNAL_API_CLIENT_ID;
  const clientSecret = process.env.INTERNAL_API_CLIENT_SECRET;
  if (!tokenUrl || !clientId || !clientSecret) return null;
  return { tokenUrl, clientId, clientSecret };
}

type CachedToken = {
  accessToken: string;
  expiresAt: number; // epoch ms
};

// Cache keyed by token URL + client id so multiple credentials never collide.
const tokenCache = new Map<string, CachedToken>();

/**
 * Get a valid OAuth2 access token, fetching/refreshing as needed.
 * Tokens are cached in memory and refreshed 60s before expiry.
 */
export async function getInternalApiToken(
  config?: InternalApiOAuthConfig,
): Promise<string> {
  const cfg = config ?? getInternalApiOAuthConfigFromEnv();
  if (!cfg) {
    throw new Error(
      "Internal API OAuth config missing. Set INTERNAL_API_TOKEN_URL, INTERNAL_API_CLIENT_ID, INTERNAL_API_CLIENT_SECRET.",
    );
  }

  const cacheKey = `${cfg.tokenUrl}|${cfg.clientId}`;
  const now = Date.now();
  const bufferMs = 60_000; // refresh 60s before expiry

  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt - bufferMs > now) {
    return cached.accessToken;
  }

  const body = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    grant_type: "client_credentials",
  });

  const response = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Internal API OAuth token request failed (${response.status}): ${text.slice(0, 300)}`,
    );
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
    token_type: string;
  };

  if (!data.access_token) {
    throw new Error("Internal API OAuth response missing access_token");
  }

  tokenCache.set(cacheKey, {
    accessToken: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  });

  logger.info?.(
    `Internal API: OAuth token obtained (client ${cfg.clientId}), expires in ${data.expires_in}s`,
  );

  return data.access_token;
}

/** Clear cached token(s) (useful for testing or forced refresh after a 401). */
export function clearInternalApiTokenCache(): void {
  tokenCache.clear();
}
