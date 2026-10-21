/**
 * Client Catalog (Company Management Service) API Client
 *
 * Read-only client for discovering companies and workspaces.
 * Uses V2 company endpoints for typed responses.
 * Authenticates with the shared internal-API OAuth2 credential (realm s2s,
 * see src/lib/internal-api/oauth.ts) and falls back to Basic Auth (QA only)
 * when the shared OAuth credential is not configured.
 *
 * IMPORTANT: This client must ONLY perform GET requests.
 * The client catalog is treated as a read-only system.
 */

import { getInternalApiOAuthConfigFromEnv } from "@/lib/internal-api/oauth";
import { internalApiFetch } from "@/lib/internal-api/fetch";
import type {
  Company,
  CompanyOverview,
  WorkspaceResponse,
  ClientCatalogConfig,
} from "./types";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function getConfigFromEnv(): ClientCatalogConfig {
  const baseUrl = process.env.CLIENT_CATALOG_BASE_URL;
  if (!baseUrl) {
    throw new Error(
      "CLIENT_CATALOG_BASE_URL is required. Set it in environment variables.",
    );
  }

  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    oauth: getInternalApiOAuthConfigFromEnv() ?? undefined,
    basicUsername: process.env.CLIENT_CATALOG_BASIC_USERNAME || undefined,
    basicPassword: process.env.CLIENT_CATALOG_BASIC_PASSWORD || undefined,
  };
}

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

async function ccFetch(
  config: ClientCatalogConfig,
  path: string,
): Promise<unknown> {
  const url = `${config.baseUrl}${path}`;
  const headers: Record<string, string> = { Accept: "application/json" };

  // Prefer the shared internal-API OAuth2 credential (Bearer + 401 retry handled
  // by internalApiFetch); fall back to Basic Auth (QA only).
  let response: Response;
  if (config.oauth) {
    response = await internalApiFetch(url, config.oauth, {
      method: "GET",
      headers,
    });
  } else if (config.basicUsername && config.basicPassword) {
    const encoded = Buffer.from(
      `${config.basicUsername}:${config.basicPassword}`,
    ).toString("base64");
    response = await fetch(url, {
      method: "GET",
      headers: { ...headers, Authorization: `Basic ${encoded}` },
    });
  } else {
    throw new Error(
      "No auth configured for client catalog. Set the shared INTERNAL_API_* OAuth env vars or Basic Auth.",
    );
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Client catalog GET ${path} failed (${response.status}): ${text.slice(0, 300)}`,
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  return contentType.includes("json") ? response.json() : response.text();
}

// ---------------------------------------------------------------------------
// API methods — Companies (V2)
// ---------------------------------------------------------------------------

/**
 * List all companies (overview).
 * Uses V2 endpoint which returns typed CompanyOverviewResponseDto.
 */
export async function listCompanies(
  options?: { active?: boolean },
  config?: ClientCatalogConfig,
): Promise<CompanyOverview[]> {
  const cfg = config ?? getConfigFromEnv();
  const params = new URLSearchParams();
  if (options?.active !== undefined) {
    params.set("active", String(options.active));
  }
  const query = params.toString();
  const path = `/v2/companies${query ? `?${query}` : ""}`;
  const data = await ccFetch(cfg, path);
  return Array.isArray(data) ? data : [];
}

/**
 * Get a single company by ID with full detail (including workspaces).
 * Uses V2 endpoint which returns typed CompanyResponseDto.
 */
export async function getCompany(
  companyId: number,
  config?: ClientCatalogConfig,
): Promise<Company | null> {
  const cfg = config ?? getConfigFromEnv();
  try {
    const data = await ccFetch(cfg, `/v2/companies/${companyId}`);
    return (data as Company) ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// API methods — Workspaces
// ---------------------------------------------------------------------------

/**
 * Get workspaces for a company.
 */
export async function getWorkspaces(
  companyId: number,
  config?: ClientCatalogConfig,
): Promise<WorkspaceResponse[]> {
  const cfg = config ?? getConfigFromEnv();
  const data = await ccFetch(cfg, `/workspaces?companyId=${companyId}`);
  return Array.isArray(data) ? data : [];
}

/**
 * Get a single workspace by ID.
 */
export async function getWorkspace(
  workspaceId: number,
  config?: ClientCatalogConfig,
): Promise<WorkspaceResponse | null> {
  const cfg = config ?? getConfigFromEnv();
  try {
    const data = await ccFetch(cfg, `/workspaces/${workspaceId}`);
    return (data as WorkspaceResponse) ?? null;
  } catch {
    return null;
  }
}
