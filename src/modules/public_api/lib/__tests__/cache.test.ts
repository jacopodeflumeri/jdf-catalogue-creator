/** @jest-environment node */

/**
 * Cache-Control helpers: key-scoped responses must never be storable by a
 * shared cache; global data may be.
 */

import {
  API_KEY_HEADER,
  cacheHeaders,
  privateCacheHeaders,
  snapshotCacheHeaders,
} from "../cache";
import { successResponse } from "../response";

describe("cacheHeaders (data identical for every key)", () => {
  it("is public with a shared-cache max age", () => {
    expect(cacheHeaders()).toEqual({
      "Cache-Control": "public, max-age=300, s-maxage=600",
    });
    expect(cacheHeaders(60)["Cache-Control"]).toBe("public, max-age=60, s-maxage=120");
    expect(snapshotCacheHeaders()["Cache-Control"]).toBe(
      "public, max-age=600, s-maxage=1200",
    );
  });
});

describe("privateCacheHeaders (key-scoped data)", () => {
  it("is private, has no shared-cache max age, and varies on the API key header", () => {
    const headers = privateCacheHeaders();
    expect(headers["Cache-Control"]).toBe("private, max-age=300");
    expect(headers["Cache-Control"]).not.toMatch(/public|s-maxage/);
    expect(headers.Vary).toBe(API_KEY_HEADER);
  });

  it("honours a custom max age", () => {
    expect(privateCacheHeaders(30)["Cache-Control"]).toBe("private, max-age=30");
  });

  it("names the header withApiKeyAuth reads the key from", () => {
    expect(API_KEY_HEADER.toLowerCase()).toBe("x-api-key");
  });

  it("reaches the response unchanged", () => {
    const response = successResponse({ id: 1 }, privateCacheHeaders());
    expect(response.headers.get("cache-control")).toBe("private, max-age=300");
    expect(response.headers.get("vary")).toBe("X-API-Key");
  });
});
