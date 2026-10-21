/**
 * UPC (Unified Product Catalog) API Client
 *
 * Server-side client for the Mapp Product Feed Service internal API.
 * Provides access to product feeds, attributes, and workspace mappings.
 *
 * Authenticates with the shared internal-API OAuth2 credential (realm s2s,
 * see src/lib/internal-api/oauth.ts) — the same credential used by the client
 * catalog. Only the per-service base URL is configured separately.
 *
 * Ported from labs-trends. The template version drops the FTL-specific
 * ingest and transform logic — your app decides what to do with the data.
 */

import { getInternalApiOAuthConfigFromEnv } from "@/lib/internal-api/oauth";
import { internalApiFetch } from "@/lib/internal-api/fetch";
import type {
  FeedDataType,
  ProductFeed,
  ProductAttribute,
  ProductFeedData,
  ProductFeedDataCount,
  PaginatedProductFeedData,
  UpcClientConfig,
  FeedWorkspaceMapping,
} from "./types";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function getConfigFromEnv(): UpcClientConfig {
  const baseUrl = process.env.UPC_API_BASE_URL;

  if (!baseUrl) {
    throw new Error(
      "UPC API config missing. Set UPC_API_BASE_URL (product-feed-service) plus the shared INTERNAL_API_* OAuth env vars.",
    );
  }

  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    oauth: getInternalApiOAuthConfigFromEnv() ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

async function upcFetch(
  config: UpcClientConfig,
  path: string,
  options?: { method?: string; body?: unknown },
): Promise<unknown> {
  const url = `${config.baseUrl}${path}`;
  const method = options?.method ?? "GET";

  // Bearer token + 401 clear-and-retry handled by internalApiFetch.
  const headers: Record<string, string> = { Accept: "application/json" };
  let body: string | undefined;
  if (options?.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  const response = await internalApiFetch(url, config.oauth, {
    method,
    headers,
    body,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `UPC API ${method} ${path} failed (${response.status}): ${text.slice(0, 500)}`,
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("json")) {
    return response.json();
  }
  return response.text();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitizeArray<T>(data: unknown): T[] {
  if (Array.isArray(data))
    return data.filter((x): x is T => !!x && typeof x === "object");
  if (typeof data === "string") {
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed))
        return parsed.filter((x): x is T => !!x && typeof x === "object");
    } catch {
      // not JSON
    }
  }
  // Some endpoints wrap arrays in a content field
  if (
    data &&
    typeof data === "object" &&
    Array.isArray((data as Record<string, unknown>).content)
  ) {
    return (data as Record<string, unknown[]>).content.filter(
      (x: unknown): x is T => !!x && typeof x === "object",
    );
  }
  return [];
}

// ---------------------------------------------------------------------------
// API methods
// ---------------------------------------------------------------------------

/**
 * Search feeds for a company.
 */
export async function listFeeds(
  companyId: number,
  config?: UpcClientConfig,
): Promise<ProductFeed[]> {
  const cfg = config ?? getConfigFromEnv();
  const data = await upcFetch(
    cfg,
    "/rest/internal/product-feed/metadata/feed/search",
    { method: "POST", body: { companyId } },
  );
  return sanitizeArray<ProductFeed>(data);
}

/**
 * Get attributes for a feed.
 */
export async function getFeedAttributes(
  companyId: number,
  feedId: number,
  feedDataType: FeedDataType = "SOURCE",
  config?: UpcClientConfig,
): Promise<ProductAttribute[]> {
  const cfg = config ?? getConfigFromEnv();
  const data = await upcFetch(
    cfg,
    `/rest/internal/product-feed/${companyId}/metadata/feed-to-attribute/${feedDataType}/${feedId}/attributes`,
  );
  return sanitizeArray<ProductAttribute>(data);
}

/**
 * Get product count for a feed.
 */
export async function getProductCount(
  companyId: number,
  feedId: number,
  feedDataType: FeedDataType = "SOURCE",
  config?: UpcClientConfig,
): Promise<number> {
  const cfg = config ?? getConfigFromEnv();
  const data = await upcFetch(
    cfg,
    `/rest/internal/product-feed/${companyId}/data/${feedDataType}/count?feedId=${feedId}`,
  );

  if (typeof data === "number") return data;
  if (Array.isArray(data)) {
    const entry = data.find(
      (item: Record<string, unknown>) => Number(item?.feedId) === feedId,
    ) as ProductFeedDataCount | undefined;
    return entry?.numberOfProducts ?? 0;
  }
  if (data && typeof data === "object" && "numberOfProducts" in data) {
    return (data as ProductFeedDataCount).numberOfProducts;
  }
  return 0;
}

/**
 * Fetch one page of products from a feed using keyset pagination.
 */
export async function getProductPage(
  companyId: number,
  feedId: number,
  feedDataType: FeedDataType = "SOURCE",
  options?: {
    lastId?: string;
    size?: number;
    filters?: Record<string, string>;
    sortBy?: string;
    sortDir?: "ASC" | "DESC";
  },
  config?: UpcClientConfig,
): Promise<PaginatedProductFeedData> {
  const cfg = config ?? getConfigFromEnv();
  const size = options?.size ?? 100;

  const queryParams = new URLSearchParams({
    feedId: String(feedId),
    size: String(size),
  });
  if (options?.lastId) {
    queryParams.set("lastId", options.lastId);
  }

  const body: Record<string, unknown> = {};
  if (options?.filters) body.filters = options.filters;
  if (options?.sortBy) body.sortBy = options.sortBy;
  if (options?.sortDir) body.sortDir = options.sortDir;

  const data = await upcFetch(
    cfg,
    `/rest/internal/product-feed/${companyId}/data/${feedDataType}/paginated?${queryParams}`,
    { method: "POST", body },
  );

  const parsed = data as Record<string, unknown>;
  return {
    nextPageExists: !!parsed?.nextPageExists,
    lastId: (parsed?.lastId as string) ?? null,
    lastSortValue: parsed?.lastSortValue,
    productViewPayloads: sanitizeArray<ProductFeedData>(
      parsed?.productViewPayloads,
    ),
  };
}

/**
 * Fetch a single product by variant ID.
 */
export async function getProductByVariantId(
  companyId: number,
  feedId: number,
  variantId: string,
  feedDataType: FeedDataType = "SOURCE",
  config?: UpcClientConfig,
): Promise<ProductFeedData | null> {
  const cfg = config ?? getConfigFromEnv();
  try {
    const data = await upcFetch(
      cfg,
      `/rest/internal/product-feed/${companyId}/data/${feedDataType}/${feedId}/variant_id/${encodeURIComponent(variantId)}`,
    );
    return (data as ProductFeedData) ?? null;
  } catch {
    return null;
  }
}

/**
 * Get the feed-to-client-catalog-workspace mapping for a company.
 * Returns a map of feedId -> workspace info.
 */
export async function getFeedToWorkspaceMapping(
  companyId: number,
  config?: UpcClientConfig,
): Promise<Map<number, FeedWorkspaceMapping[]>> {
  const cfg = config ?? getConfigFromEnv();
  const data = await upcFetch(
    cfg,
    `/rest/internal/product-feed/${companyId}/metadata/feed-to-client-catalog-workspace/all-by-company-id`,
  );

  const result = new Map<number, FeedWorkspaceMapping[]>();

  if (data && typeof data === "object" && !Array.isArray(data)) {
    for (const [feedIdStr, workspaces] of Object.entries(
      data as Record<string, unknown>,
    )) {
      const feedId = Number(feedIdStr);
      if (!Number.isFinite(feedId)) continue;
      const wsArray = Array.isArray(workspaces) ? workspaces : [];
      result.set(
        feedId,
        wsArray.filter(
          (ws: unknown): ws is FeedWorkspaceMapping =>
            !!ws && typeof ws === "object",
        ),
      );
    }
  }

  return result;
}
