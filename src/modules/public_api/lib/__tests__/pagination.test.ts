/** @jest-environment node */

/**
 * Tests for pagination helpers
 *
 * Verifies:
 * 1. parsePaginationParams defaults, clamping, and custom limits
 * 2. buildPaginationMeta has_more calculation
 */

import { parsePaginationParams, buildPaginationMeta } from "../pagination";

describe("parsePaginationParams", () => {
  it("returns defaults for empty params", () => {
    const params = new URLSearchParams();
    const result = parsePaginationParams(params);

    expect(result.limit).toBe(50);
    expect(result.offset).toBe(0);
  });

  it("parses valid limit and offset", () => {
    const params = new URLSearchParams({ limit: "25", offset: "100" });
    const result = parsePaginationParams(params);

    expect(result.limit).toBe(25);
    expect(result.offset).toBe(100);
  });

  it("clamps limit to max (200)", () => {
    const params = new URLSearchParams({ limit: "500" });
    const result = parsePaginationParams(params);

    expect(result.limit).toBe(200);
  });

  it("clamps limit to min (1)", () => {
    const params = new URLSearchParams({ limit: "0" });
    const result = parsePaginationParams(params);

    expect(result.limit).toBe(50); // falls back to default
  });

  it("clamps negative offset to 0", () => {
    const params = new URLSearchParams({ offset: "-5" });
    const result = parsePaginationParams(params);

    expect(result.offset).toBe(0);
  });

  it("handles NaN values gracefully", () => {
    const params = new URLSearchParams({ limit: "abc", offset: "xyz" });
    const result = parsePaginationParams(params);

    expect(result.limit).toBe(50);
    expect(result.offset).toBe(0);
  });

  it("accepts custom defaults and max", () => {
    const params = new URLSearchParams();
    const result = parsePaginationParams(params, { limit: 200, maxLimit: 1000 });

    expect(result.limit).toBe(200);
  });

  it("clamps to custom max limit", () => {
    const params = new URLSearchParams({ limit: "1500" });
    const result = parsePaginationParams(params, { maxLimit: 1000 });

    expect(result.limit).toBe(1000);
  });
});

describe("buildPaginationMeta", () => {
  it("calculates has_more correctly when more results exist", () => {
    const meta = buildPaginationMeta(100, 50, 0);

    expect(meta).toEqual({
      total: 100,
      limit: 50,
      offset: 0,
      has_more: true,
    });
  });

  it("sets has_more false when at last page", () => {
    const meta = buildPaginationMeta(100, 50, 50);

    expect(meta.has_more).toBe(false);
  });

  it("sets has_more false when offset exceeds total", () => {
    const meta = buildPaginationMeta(10, 50, 0);

    expect(meta.has_more).toBe(false);
  });

  it("handles zero total", () => {
    const meta = buildPaginationMeta(0, 50, 0);

    expect(meta.total).toBe(0);
    expect(meta.has_more).toBe(false);
  });
});
