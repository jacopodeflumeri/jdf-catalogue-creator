/** @jest-environment node */

/**
 * Tests for UPC API client
 *
 * Verifies:
 * 1. Config loading and validation
 * 2. Shared internal-API OAuth2 Bearer auth (realm s2s)
 * 3. API methods: listFeeds, getFeedAttributes, getProductCount, getProductPage
 * 4. getProductByVariantId
 * 5. getFeedToWorkspaceMapping
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

const originalFetch = global.fetch;

beforeEach(() => {
  jest.clearAllMocks();
});

afterAll(() => {
  global.fetch = originalFetch;
  clearInternalApiTokenCache();
});

import {
  listFeeds,
  getFeedAttributes,
  getProductCount,
  getProductPage,
  getProductByVariantId,
  getFeedToWorkspaceMapping,
} from "../client";
import {
  clearInternalApiTokenCache,
  getInternalApiToken,
} from "@/lib/internal-api/oauth";
import type { UpcClientConfig } from "../types";

// Shared internal-API OAuth credential (realm s2s).
const config: UpcClientConfig = {
  baseUrl: "https://upc.example.com",
  oauth: {
    tokenUrl: "https://idp.example.com/token",
    clientId: "test-client-id",
    clientSecret: "test-client-secret",
  },
};

// Prime the shared token cache once so per-test fetch mocks (single response)
// only need to model the API call, not the token exchange. The cached token
// is long-lived relative to the test run.
beforeAll(async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": "application/json" }),
    json: () =>
      Promise.resolve({
        access_token: "upc-token",
        expires_in: 3600,
        token_type: "Bearer",
      }),
    text: () => Promise.resolve(""),
  });
  clearInternalApiTokenCache();
  await getInternalApiToken(config.oauth);
});

function mockFetch(responseData: unknown, status = 200) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "content-type": "application/json" }),
    json: () => Promise.resolve(responseData),
    text: () => Promise.resolve(JSON.stringify(responseData)),
  });
}

// ============================================================================
// listFeeds
// ============================================================================

describe("listFeeds", () => {
  it("sends POST with companyId to search endpoint", async () => {
    const feeds = [{ id: 1, companyId: 100, name: "Main Feed" }];
    mockFetch(feeds);

    const result = await listFeeds(100, config);

    expect(result).toEqual(feeds);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://upc.example.com/rest/internal/product-feed/metadata/feed/search",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ companyId: 100 }),
      }),
    );
  });

  it("uses shared internal-API Bearer token", async () => {
    mockFetch([]);

    await listFeeds(100, config);

    const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
    const headers = fetchCall[1].headers;
    expect(headers.Authorization).toBe("Bearer upc-token");
  });

  it("returns empty array for non-array response", async () => {
    mockFetch({ error: "unexpected" });

    const result = await listFeeds(100, config);

    expect(result).toEqual([]);
  });
});

// ============================================================================
// getFeedAttributes
// ============================================================================

describe("getFeedAttributes", () => {
  it("fetches attributes for SOURCE data type by default", async () => {
    const attrs = [{ id: 1, name: "color", dataType: "STRING" }];
    mockFetch(attrs);

    const result = await getFeedAttributes(100, 1, undefined, config);

    expect(result).toEqual(attrs);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/100/metadata/feed-to-attribute/SOURCE/1/attributes"),
      expect.anything(),
    );
  });

  it("uses specified data type", async () => {
    mockFetch([]);

    await getFeedAttributes(100, 1, "ENRICHED", config);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/ENRICHED/"),
      expect.anything(),
    );
  });
});

// ============================================================================
// getProductCount
// ============================================================================

describe("getProductCount", () => {
  it("returns count from number response", async () => {
    mockFetch(42);

    const result = await getProductCount(100, 1, "SOURCE", config);

    expect(result).toBe(42);
  });

  it("returns count from array response", async () => {
    mockFetch([{ feedId: 1, numberOfProducts: 150 }]);

    const result = await getProductCount(100, 1, "SOURCE", config);

    expect(result).toBe(150);
  });

  it("returns count from object response", async () => {
    mockFetch({ companyId: 100, feedId: 1, numberOfProducts: 75 });

    const result = await getProductCount(100, 1, "SOURCE", config);

    expect(result).toBe(75);
  });

  it("returns 0 for unexpected response format", async () => {
    mockFetch("unexpected");

    const result = await getProductCount(100, 1, "SOURCE", config);

    expect(result).toBe(0);
  });
});

// ============================================================================
// getProductPage
// ============================================================================

describe("getProductPage", () => {
  it("fetches paginated products", async () => {
    const pageData = {
      nextPageExists: true,
      lastId: "SKU-100",
      productViewPayloads: [
        { variantId: "SKU-001", productId: "P1", feedId: 1, data: { name: "Shirt" } },
      ],
    };
    mockFetch(pageData);

    const result = await getProductPage(100, 1, "SOURCE", undefined, config);

    expect(result.nextPageExists).toBe(true);
    expect(result.lastId).toBe("SKU-100");
    expect(result.productViewPayloads).toHaveLength(1);
  });

  it("passes lastId for keyset pagination", async () => {
    mockFetch({ nextPageExists: false, lastId: null, productViewPayloads: [] });

    await getProductPage(100, 1, "SOURCE", { lastId: "SKU-050", size: 50 }, config);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("lastId=SKU-050"),
      expect.anything(),
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("size=50"),
      expect.anything(),
    );
  });

  it("returns empty payloads for missing data", async () => {
    mockFetch({});

    const result = await getProductPage(100, 1, "SOURCE", undefined, config);

    expect(result.nextPageExists).toBe(false);
    expect(result.lastId).toBeNull();
    expect(result.productViewPayloads).toEqual([]);
  });
});

// ============================================================================
// getProductByVariantId
// ============================================================================

describe("getProductByVariantId", () => {
  it("fetches single product", async () => {
    const product = { variantId: "SKU-001", productId: "P1", feedId: 1, data: {} };
    mockFetch(product);

    const result = await getProductByVariantId(100, 1, "SKU-001", "SOURCE", config);

    expect(result).toEqual(product);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/variant_id/SKU-001"),
      expect.anything(),
    );
  });

  it("encodes special characters in variant ID", async () => {
    mockFetch({});

    await getProductByVariantId(100, 1, "SKU/001+special", "SOURCE", config);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/variant_id/SKU%2F001%2Bspecial"),
      expect.anything(),
    );
  });

  it("returns null on error", async () => {
    mockFetch("Not Found", 404);

    const result = await getProductByVariantId(100, 1, "missing", "SOURCE", config);

    expect(result).toBeNull();
  });
});

// ============================================================================
// getFeedToWorkspaceMapping
// ============================================================================

describe("getFeedToWorkspaceMapping", () => {
  it("parses mapping response into Map", async () => {
    const mappingData = {
      "1": [
        { companyId: 100, workspaceId: 200, workspaceName: "WS1" },
        { companyId: 100, workspaceId: 201, workspaceName: "WS2" },
      ],
      "2": [
        { companyId: 100, workspaceId: 300, workspaceName: "WS3" },
      ],
    };
    mockFetch(mappingData);

    const result = await getFeedToWorkspaceMapping(100, config);

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(2);
    expect(result.get(1)).toHaveLength(2);
    expect(result.get(2)).toHaveLength(1);
  });

  it("returns empty Map for empty response", async () => {
    mockFetch({});

    const result = await getFeedToWorkspaceMapping(100, config);

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
  });

  it("skips non-numeric feed IDs", async () => {
    mockFetch({ "not-a-number": [{ companyId: 100 }], "1": [{ companyId: 100 }] });

    const result = await getFeedToWorkspaceMapping(100, config);

    expect(result.size).toBe(1);
    expect(result.has(1)).toBe(true);
  });
});

// ============================================================================
// Error handling
// ============================================================================

describe("error handling", () => {
  it("throws on non-OK response with error details", async () => {
    mockFetch("Internal Server Error", 500);

    await expect(listFeeds(100, config)).rejects.toThrow(
      "UPC API POST /rest/internal/product-feed/metadata/feed/search failed (500)",
    );
  });
});
