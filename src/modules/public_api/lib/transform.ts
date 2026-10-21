/**
 * camelCase-to-snake_case Key Transformation
 *
 * Pure utility — no Next.js dependencies, safe for Jest.
 */

const FIELD_MAP: Record<string, string> = {
  createdAt: "created_at",
  updatedAt: "updated_at",
  accountId: "account_id",
  expiresAt: "expires_at",
  lastUsedAt: "last_used_at",
  hasMore: "has_more",
  fieldErrors: "field_errors",
  parentId: "parent_id",
  createdById: "created_by_id",
  totalPages: "total_pages",
  generatedAt: "generated_at",
};

function toSnakeCaseKey(key: string): string {
  return (
    FIELD_MAP[key] ?? key.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase())
  );
}

/**
 * Recursively transform all keys in an object from camelCase to snake_case.
 * - Date objects are converted to ISO 8601 strings.
 * - Arrays are handled element-by-element.
 * - Primitives and null/undefined pass through unchanged.
 */
export function toSnakeCase(value: unknown): unknown {
  if (value === null || value === undefined) return value;

  if (value instanceof Date) return value.toISOString();

  if (Array.isArray(value)) return value.map(toSnakeCase);

  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[toSnakeCaseKey(k)] = toSnakeCase(v);
    }
    return result;
  }

  return value;
}
