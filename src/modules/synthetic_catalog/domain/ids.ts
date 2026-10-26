export type CatalogDepartmentCode = string;

const PRODUCT_PREFIX_PATTERN = /^[A-Z]{3}$/;
const PRODUCT_ID_PATTERN = /^[A-Z]{3}-[A-Z0-9]{1,6}-\d{6,}$/;
export const POSTGRES_INT_MAX = 2_147_483_647;

function assertNonEmptyCode(value: string, label: string): void {
  if (!value) {
    throw new Error(`${label} must not be empty`);
  }
}

export function normalizeCatalogCode(value: string, label: string): string {
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  assertNonEmptyCode(normalized, label);
  return normalized;
}

export function formatProductId(input: {
  catalogPrefix: string;
  department: CatalogDepartmentCode;
  sequence: number;
}): string {
  const prefix = input.catalogPrefix.trim().toUpperCase();
  if (!PRODUCT_PREFIX_PATTERN.test(prefix)) {
    throw new Error("Catalog prefix must contain exactly three uppercase letters");
  }
  if (!/^[A-Z0-9]{1,6}$/.test(input.department)) {
    throw new Error("Department code must contain 1 to 6 uppercase letters or digits");
  }
  if (!Number.isSafeInteger(input.sequence) || input.sequence < 1) {
    throw new Error("Product sequence must be a positive safe integer");
  }

  return `${prefix}-${input.department}-${String(input.sequence).padStart(6, "0")}`;
}

export function formatStyleId(productId: string, colorCode: string): string {
  const normalizedProductId = productId.trim().toUpperCase();
  if (!PRODUCT_ID_PATTERN.test(normalizedProductId)) {
    throw new Error("Product ID is not in the expected PREFIX-DEPARTMENT-SEQUENCE format");
  }
  return `${normalizedProductId}-${normalizeCatalogCode(colorCode, "Color code")}`;
}

export function formatVariantId(styleId: string, size: string): string {
  const normalizedStyleId = styleId.trim().toUpperCase();
  assertNonEmptyCode(normalizedStyleId, "Style ID");
  return `${normalizedStyleId}-${normalizeCatalogCode(size, "Size")}`;
}

export const formatSku = formatVariantId;

export function productSequenceRange(first: number, count: number): number[] {
  if (!Number.isSafeInteger(first) || first < 1) {
    throw new Error("First product sequence must be a positive safe integer");
  }
  if (!Number.isSafeInteger(count) || count < 1) {
    throw new Error("Sequence reservation count must be a positive safe integer");
  }
  if (first > POSTGRES_INT_MAX || count > POSTGRES_INT_MAX - first) {
    throw new Error(`Product sequence capacity exhausted: PostgreSQL Int supports values through ${POSTGRES_INT_MAX}`);
  }
  return Array.from({ length: count }, (_, index) => first + index);
}
