/** @jest-environment node */

/**
 * Tests for Public API response helpers
 *
 * Verifies:
 * 1. successResponse envelope structure and snake_case transform
 * 2. paginatedResponse with pagination metadata
 * 3. errorResponse with error codes and field errors
 */

import { successResponse, paginatedResponse, errorResponse } from "../response";

describe("successResponse", () => {
  it("wraps data in success envelope with snake_case keys", async () => {
    const response = successResponse({ accountId: 1, createdAt: "2024-01-01" });
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.data.account_id).toBe(1);
    expect(body.data.created_at).toBe("2024-01-01");
    expect(response.status).toBe(200);
  });

  it("accepts custom status code", async () => {
    const response = successResponse({ id: 1 }, undefined, 201);

    expect(response.status).toBe(201);
  });

  it("accepts custom headers", async () => {
    const response = successResponse({ id: 1 }, { "X-Custom": "value" });

    expect(response.headers.get("X-Custom")).toBe("value");
  });
});

describe("paginatedResponse", () => {
  it("includes data array and pagination metadata", async () => {
    const data = [
      { accountId: 1, name: "Acme" },
      { accountId: 2, name: "Globex" },
    ];
    const pagination = { total: 50, limit: 10, offset: 0, has_more: true };

    const response = paginatedResponse(data, pagination);
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.data[0].account_id).toBe(1);
    expect(body.pagination).toEqual(pagination);
    expect(response.status).toBe(200);
  });

  it("handles empty data array", async () => {
    const pagination = { total: 0, limit: 50, offset: 0, has_more: false };

    const response = paginatedResponse([], pagination);
    const body = await response.json();

    expect(body.data).toEqual([]);
    expect(body.pagination.total).toBe(0);
  });
});

describe("errorResponse", () => {
  it("returns error envelope with code and message", async () => {
    const response = errorResponse("NOT_FOUND", "Resource not found", 404);
    const body = await response.json();

    expect(body.success).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.message).toBe("Resource not found");
    expect(response.status).toBe(404);
  });

  it("includes field errors when provided", async () => {
    const fieldErrors = [
      { field: "limit", message: "Must be between 1 and 200" },
      { field: "offset", message: "Must be non-negative" },
    ];

    const response = errorResponse("VALIDATION_ERROR", "Invalid params", 400, fieldErrors);
    const body = await response.json();

    expect(body.error.field_errors).toEqual(fieldErrors);
  });

  it("omits field_errors when empty", async () => {
    const response = errorResponse("INTERNAL_ERROR", "Oops", 500);
    const body = await response.json();

    expect(body.error.field_errors).toBeUndefined();
  });
});
