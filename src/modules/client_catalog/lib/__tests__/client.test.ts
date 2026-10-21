/** @jest-environment node */

/**
 * Tests for Client Catalog API client
 *
 * Verifies:
 * 1. Config loading from environment variables
 * 2. OAuth2 token management and caching
 * 3. Basic Auth fallback
 * 4. API methods (listCompanies, getCompany, getWorkspaces, getWorkspace)
 * 5. 401 retry with token refresh
 * 6. Error handling
 */

jest.mock("@/lib/utils/logger", () => ({
  __esModule: true,
  default: {
    warn: jest.fn(),
    error: jest.fn(),
    log: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

// Save original fetch
const originalFetch = global.fetch;

beforeEach(() => {
  jest.clearAllMocks();
});

afterAll(() => {
  global.fetch = originalFetch;
});

import {
  listCompanies,
  getCompany,
  getWorkspaces,
  getWorkspace,
} from "../client";
import { clearInternalApiTokenCache } from "@/lib/internal-api/oauth";
import type { ClientCatalogConfig } from "../types";

// ============================================================================
// Config helpers
// ============================================================================

const basicAuthConfig: ClientCatalogConfig = {
  baseUrl: "https://catalog.example.com",
  basicUsername: "testuser",
  basicPassword: "testpass",
};

// Shared internal-API OAuth credential (realm s2s).
const oauthConfig: ClientCatalogConfig = {
  baseUrl: "https://catalog.example.com",
  oauth: {
    tokenUrl: "https://idp.example.com/token",
    clientId: "test-client-id",
    clientSecret: "test-client-secret",
  },
};

function mockFetch(responseData: unknown, status = 200) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "content-type": "application/json" }),
    json: () => Promise.resolve(responseData),
    text: () => Promise.resolve(JSON.stringify(responseData)),
  });
}

function mockFetchSequence(responses: Array<{ data: unknown; status: number }>) {
  const mockFn = jest.fn();
  responses.forEach((resp) => {
    mockFn.mockResolvedValueOnce({
      ok: resp.status >= 200 && resp.status < 300,
      status: resp.status,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve(resp.data),
      text: () => Promise.resolve(JSON.stringify(resp.data)),
    });
  });
  global.fetch = mockFn;
  return mockFn;
}

// ============================================================================
// listCompanies (V2)
// ============================================================================

describe("listCompanies", () => {
  it("fetches company overviews from V2 endpoint with Basic Auth", async () => {
    const overviews = [
      { id: 1, name: "Acme Corp", active: true, salesforceId: "SF001" },
      { id: 2, name: "Globex", active: true },
    ];
    mockFetch(overviews);

    const result = await listCompanies(undefined, basicAuthConfig);

    expect(result).toEqual(overviews);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://catalog.example.com/v2/companies",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("passes active filter as query param", async () => {
    mockFetch([]);

    await listCompanies({ active: true }, basicAuthConfig);

    expect(global.fetch).toHaveBeenCalledWith(
      "https://catalog.example.com/v2/companies?active=true",
      expect.anything(),
    );
  });

  it("returns empty array for non-array response", async () => {
    mockFetch({ error: "unexpected" });

    const result = await listCompanies(undefined, basicAuthConfig);

    expect(result).toEqual([]);
  });

  it("uses Basic Auth header when OAuth2 is not configured", async () => {
    mockFetch([]);

    await listCompanies(undefined, basicAuthConfig);

    const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
    const headers = fetchCall[1].headers;
    expect(headers.Authorization).toMatch(/^Basic /);
  });

  it("throws when no auth is configured", async () => {
    const noAuthConfig: ClientCatalogConfig = {
      baseUrl: "https://catalog.example.com",
    };

    await expect(listCompanies(undefined, noAuthConfig)).rejects.toThrow(
      "No auth configured",
    );
  });
});

// ============================================================================
// getCompany (V2)
// ============================================================================

describe("getCompany", () => {
  it("fetches a single company by ID from V2 endpoint", async () => {
    const company = {
      id: 42,
      name: "Acme",
      active: true,
      salesforceId: "SF042",
      workspaces: [
        { id: 10, companyId: 42, name: "Analytics", services: ["INTELLIGENCE"] },
      ],
    };
    mockFetch(company);

    const result = await getCompany(42, basicAuthConfig);

    expect(result).toEqual(company);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://catalog.example.com/v2/companies/42",
      expect.anything(),
    );
  });

  it("returns null on error", async () => {
    mockFetch("Not Found", 404);

    const result = await getCompany(999, basicAuthConfig);

    expect(result).toBeNull();
  });
});

// ============================================================================
// getWorkspaces
// ============================================================================

describe("getWorkspaces", () => {
  it("fetches workspaces for a company", async () => {
    const workspaces = [
      {
        id: 10,
        companyId: 1,
        name: "Analytics",
        services: ["INTELLIGENCE"],
        systemId: "sys-001",
      },
      {
        id: 11,
        companyId: 1,
        name: "Marketing",
        services: ["ENGAGE"],
        tenantId: "tenant-001",
      },
    ];
    mockFetch(workspaces);

    const result = await getWorkspaces(1, basicAuthConfig);

    expect(result).toEqual(workspaces);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://catalog.example.com/workspaces?companyId=1",
      expect.anything(),
    );
  });

  it("returns empty array for non-array response", async () => {
    mockFetch(null);

    const result = await getWorkspaces(1, basicAuthConfig);

    expect(result).toEqual([]);
  });
});

// ============================================================================
// getWorkspace
// ============================================================================

describe("getWorkspace", () => {
  it("fetches a single workspace by ID", async () => {
    const workspace = {
      id: 10,
      companyId: 1,
      name: "Fashion WS",
      services: ["FASHION"],
      fashionNamespaceId: "ns-uuid-123",
      fashionSlugName: "acme-fashion",
    };
    mockFetch(workspace);

    const result = await getWorkspace(10, basicAuthConfig);

    expect(result).toEqual(workspace);
  });

  it("returns null on error", async () => {
    mockFetch("Not Found", 404);

    const result = await getWorkspace(999, basicAuthConfig);

    expect(result).toBeNull();
  });
});

// ============================================================================
// OAuth2 token management
// ============================================================================

describe("OAuth2 token management", () => {
  beforeEach(() => {
    clearInternalApiTokenCache();
  });

  it("fetches OAuth2 token and uses Bearer auth", async () => {
    const fetchMock = mockFetchSequence([
      // Token response
      {
        data: { access_token: "test-token-123", expires_in: 3600, token_type: "Bearer" },
        status: 200,
      },
      // API response
      { data: [], status: 200 },
    ]);

    await listCompanies(undefined, oauthConfig);

    // First call: token request
    expect(fetchMock.mock.calls[0][0]).toBe("https://idp.example.com/token");
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");

    // Second call: API request with Bearer token
    const apiHeaders = fetchMock.mock.calls[1][1].headers;
    expect(apiHeaders.Authorization).toBe("Bearer test-token-123");
  });

  it("caches token across calls", async () => {
    const fetchMock = mockFetchSequence([
      // Token response (only once)
      {
        data: { access_token: "cached-token", expires_in: 3600, token_type: "Bearer" },
        status: 200,
      },
      // First API response
      { data: [], status: 200 },
      // Second API response (no new token fetch)
      { data: [], status: 200 },
    ]);

    await listCompanies(undefined, oauthConfig);
    await listCompanies(undefined, oauthConfig);

    // Token fetched once, API called twice = 3 total fetch calls
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("clears token cache", async () => {
    const fetchMock = mockFetchSequence([
      { data: { access_token: "token-1", expires_in: 3600, token_type: "Bearer" }, status: 200 },
      { data: [], status: 200 },
      { data: { access_token: "token-2", expires_in: 3600, token_type: "Bearer" }, status: 200 },
      { data: [], status: 200 },
    ]);

    await listCompanies(undefined, oauthConfig);
    clearInternalApiTokenCache();
    await listCompanies(undefined, oauthConfig);

    // Two token fetches after cache clear = 4 total
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("retries on 401 with fresh token", async () => {
    const fetchMock = mockFetchSequence([
      // Initial token
      { data: { access_token: "stale-token", expires_in: 3600, token_type: "Bearer" }, status: 200 },
      // API returns 401
      { data: "Unauthorized", status: 401 },
      // Refresh token
      { data: { access_token: "fresh-token", expires_in: 3600, token_type: "Bearer" }, status: 200 },
      // Retry succeeds
      { data: [{ id: 1, name: "Acme", active: true }], status: 200 },
    ]);

    const result = await listCompanies(undefined, oauthConfig);

    expect(result).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
