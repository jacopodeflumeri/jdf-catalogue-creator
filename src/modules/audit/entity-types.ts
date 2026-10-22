/**
 * The single source of truth for audit-log entity types.
 *
 * `writeAuditLog` only accepts a key from this list, and the /admin/audit-log
 * filter chips are built from it. That is deliberate: a type that could be
 * written without being listed here would land in the table and then be
 * impossible to filter for. Add your app's entities here and they get a writer
 * type, a filter chip and a label at once.
 *
 * NO PRISMA IMPORTS — this file is pulled into client components.
 */

export interface AuditEntityTypeDef {
  /** Stored verbatim in `entity_type`. snake_case, always. */
  key: string;
  /** Chip and row label. */
  label: string;
  /**
   * Admin link for a row of this type. Omit where the entity has no page of its
   * own. `entityId` is null for rows that are not about one specific record.
   */
  href?: (entityId: number | null) => string;
}

export const AUDIT_ENTITY_TYPES = [
  {
    key: "mapp_team",
    label: "Mapp Team",
    href: () => "/admin/mapp-team",
  },
  {
    // A client-catalog company; `entityId` is its company id. Written by
    // "View as customer" (customer_preview_start / customer_preview_end).
    // Apps that install the client_catalog Companies scaffold can point this
    // at `/admin/companies/${id}` instead.
    key: "company",
    label: "Company",
    href: (id) => (id != null ? `/admin/company-users?q=${id}` : "/admin/company-users"),
  },
  {
    key: "synthetic_catalog",
    label: "Synthetic Catalog",
    href: (id) => (id != null ? `/admin/catalogs/${id}` : "/admin/catalogs"),
  },
  {
    key: "synthetic_product",
    label: "Synthetic Product",
  },
  {
    key: "catalog_generation_job",
    label: "Catalog Generation Job",
  },
  {
    key: "synthetic_image_asset",
    label: "Synthetic Image",
  },
  // Add your app's entities here, e.g.:
  //   { key: "api_key", label: "API Key", href: (id) => `/admin/api-keys/${id}` },
] as const satisfies readonly AuditEntityTypeDef[];

export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number]["key"];

const BY_KEY = new Map<string, AuditEntityTypeDef>(
  AUDIT_ENTITY_TYPES.map((def) => [def.key, def]),
);

export function isAuditEntityType(value: unknown): value is AuditEntityType {
  return typeof value === "string" && BY_KEY.has(value);
}

/** Definition for a stored key; undefined for a key no longer in the list. */
export function getAuditEntityTypeDef(
  key: string,
): AuditEntityTypeDef | undefined {
  return BY_KEY.get(key);
}
