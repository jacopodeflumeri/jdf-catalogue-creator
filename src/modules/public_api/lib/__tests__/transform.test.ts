/** @jest-environment node */

/**
 * Tests for camelCase-to-snake_case transformation
 *
 * Verifies:
 * 1. Known field mappings (FIELD_MAP)
 * 2. Automatic camelCase conversion
 * 3. Recursive object transformation
 * 4. Array handling
 * 5. Date conversion to ISO string
 * 6. Null/undefined passthrough
 * 7. Primitive passthrough
 */

import { toSnakeCase } from "../transform";

describe("toSnakeCase", () => {
  // --------------------------------------------------------------------------
  // Primitives and edge cases
  // --------------------------------------------------------------------------

  it("passes null through", () => {
    expect(toSnakeCase(null)).toBeNull();
  });

  it("passes undefined through", () => {
    expect(toSnakeCase(undefined)).toBeUndefined();
  });

  it("passes strings through", () => {
    expect(toSnakeCase("hello")).toBe("hello");
  });

  it("passes numbers through", () => {
    expect(toSnakeCase(42)).toBe(42);
  });

  it("passes booleans through", () => {
    expect(toSnakeCase(true)).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Date handling
  // --------------------------------------------------------------------------

  it("converts Date objects to ISO strings", () => {
    const date = new Date("2024-01-15T10:30:00.000Z");
    expect(toSnakeCase(date)).toBe("2024-01-15T10:30:00.000Z");
  });

  // --------------------------------------------------------------------------
  // Known field mappings
  // --------------------------------------------------------------------------

  it("transforms known FIELD_MAP keys", () => {
    const input = {
      createdAt: "2024-01-01",
      updatedAt: "2024-01-02",
      accountId: 42,
      expiresAt: "2025-01-01",
      lastUsedAt: "2024-06-15",
      hasMore: true,
      fieldErrors: [],
    };

    const result = toSnakeCase(input) as Record<string, unknown>;

    expect(result.created_at).toBe("2024-01-01");
    expect(result.updated_at).toBe("2024-01-02");
    expect(result.account_id).toBe(42);
    expect(result.expires_at).toBe("2025-01-01");
    expect(result.last_used_at).toBe("2024-06-15");
    expect(result.has_more).toBe(true);
    expect(result.field_errors).toEqual([]);
  });

  // --------------------------------------------------------------------------
  // Automatic camelCase conversion
  // --------------------------------------------------------------------------

  it("converts unknown camelCase keys via regex", () => {
    const input = {
      firstName: "John",
      lastName: "Doe",
      customFieldName: "value",
    };

    const result = toSnakeCase(input) as Record<string, unknown>;

    expect(result.first_name).toBe("John");
    expect(result.last_name).toBe("Doe");
    expect(result.custom_field_name).toBe("value");
  });

  it("preserves already-snake_case keys", () => {
    const input = { already_snake: "value" };
    const result = toSnakeCase(input) as Record<string, unknown>;
    expect(result.already_snake).toBe("value");
  });

  // --------------------------------------------------------------------------
  // Recursive objects
  // --------------------------------------------------------------------------

  it("transforms nested objects recursively", () => {
    const input = {
      accountId: 1,
      accountData: {
        createdAt: "2024-01-01",
        contactInfo: {
          firstName: "Jane",
        },
      },
    };

    const result = toSnakeCase(input) as Record<string, unknown>;
    const accountData = result.account_data as Record<string, unknown>;
    const contactInfo = accountData.contact_info as Record<string, unknown>;

    expect(result.account_id).toBe(1);
    expect(accountData.created_at).toBe("2024-01-01");
    expect(contactInfo.first_name).toBe("Jane");
  });

  // --------------------------------------------------------------------------
  // Arrays
  // --------------------------------------------------------------------------

  it("transforms arrays element-by-element", () => {
    const input = [
      { accountId: 1, createdAt: "2024-01-01" },
      { accountId: 2, createdAt: "2024-02-01" },
    ];

    const result = toSnakeCase(input) as Array<Record<string, unknown>>;

    expect(result).toHaveLength(2);
    expect(result[0].account_id).toBe(1);
    expect(result[1].account_id).toBe(2);
  });

  it("handles arrays with mixed types", () => {
    const input = [42, "hello", { accountId: 1 }, null];

    const result = toSnakeCase(input) as unknown[];

    expect(result).toEqual([42, "hello", { account_id: 1 }, null]);
  });

  it("handles empty arrays", () => {
    expect(toSnakeCase([])).toEqual([]);
  });

  // --------------------------------------------------------------------------
  // Complex nested structures
  // --------------------------------------------------------------------------

  it("handles deeply nested arrays within objects", () => {
    const input = {
      trendGroups: [
        {
          groupId: 1,
          trends: [
            { trendId: 10, featureCategoryName: "Neckline" },
          ],
        },
      ],
    };

    const result = toSnakeCase(input) as Record<string, unknown>;
    const groups = result.trend_groups as Array<Record<string, unknown>>;
    const trends = groups[0].trends as Array<Record<string, unknown>>;

    expect(trends[0].trend_id).toBe(10);
    expect(trends[0].feature_category_name).toBe("Neckline");
  });
});
