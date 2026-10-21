/** @jest-environment node */

/**
 * Tests for query parameter validation
 *
 * Verifies:
 * 1. parseQueryParams with valid data
 * 2. parseQueryParams with validation errors
 * 3. parseInclude with allowed values
 */

import { z } from "zod";
import { parseQueryParams } from "../validation";
import { parseInclude } from "../include";

describe("parseQueryParams", () => {
  const schema = z.object({
    q: z.string().optional(),
    active: z.enum(["true", "false"]).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
  });

  it("returns parsed data for valid params", () => {
    const params = new URLSearchParams({ q: "test", active: "true", limit: "25" });

    const result = parseQueryParams(params, schema);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.q).toBe("test");
      expect(result.data.active).toBe("true");
      expect(result.data.limit).toBe(25);
    }
  });

  it("returns parsed data with missing optional fields", () => {
    const params = new URLSearchParams({ q: "search" });

    const result = parseQueryParams(params, schema);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.q).toBe("search");
      expect(result.data.active).toBeUndefined();
    }
  });

  it("returns error response for invalid params", () => {
    const params = new URLSearchParams({ active: "maybe" });

    const result = parseQueryParams(params, schema);

    expect(result.success).toBe(false);
  });

  it("returns error response for out-of-range values", () => {
    const params = new URLSearchParams({ limit: "500" });

    const result = parseQueryParams(params, schema);

    expect(result.success).toBe(false);
  });
});

describe("parseInclude", () => {
  const allowed = ["children", "features", "parent"] as const;

  it("returns empty set for missing include param", () => {
    const params = new URLSearchParams();

    const result = parseInclude(params, allowed);

    expect(result.size).toBe(0);
  });

  it("parses comma-separated includes", () => {
    const params = new URLSearchParams({ include: "children,features" });

    const result = parseInclude(params, allowed);

    expect(result.size).toBe(2);
    expect(result.has("children")).toBe(true);
    expect(result.has("features")).toBe(true);
  });

  it("ignores invalid include values", () => {
    const params = new URLSearchParams({ include: "children,invalid,unknown" });

    const result = parseInclude(params, allowed);

    expect(result.size).toBe(1);
    expect(result.has("children")).toBe(true);
  });

  it("handles whitespace around values", () => {
    const params = new URLSearchParams({ include: " children , features " });

    const result = parseInclude(params, allowed);

    expect(result.size).toBe(2);
  });

  it("is case-insensitive", () => {
    const params = new URLSearchParams({ include: "Children,FEATURES" });

    const result = parseInclude(params, allowed);

    expect(result.size).toBe(2);
  });

  it("returns empty set for empty string", () => {
    const params = new URLSearchParams({ include: "" });

    const result = parseInclude(params, allowed);

    expect(result.size).toBe(0);
  });
});
