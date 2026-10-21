/**
 * Public API Pagination Helpers
 */

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const MIN_OFFSET = 0;

export interface PaginationParams {
  limit: number;
  offset: number;
}

/**
 * Parse pagination query params with sane defaults and clamping.
 */
export function parsePaginationParams(
  searchParams: URLSearchParams,
  defaults?: { limit?: number; maxLimit?: number },
): PaginationParams {
  const defaultLimit = defaults?.limit ?? DEFAULT_LIMIT;
  const maxLimit = defaults?.maxLimit ?? MAX_LIMIT;

  let limit = parseInt(searchParams.get("limit") ?? "", 10);
  if (isNaN(limit) || limit < 1) limit = defaultLimit;
  if (limit > maxLimit) limit = maxLimit;

  let offset = parseInt(searchParams.get("offset") ?? "", 10);
  if (isNaN(offset) || offset < MIN_OFFSET) offset = MIN_OFFSET;

  return { limit, offset };
}

/**
 * Build pagination metadata from query result count.
 */
export function buildPaginationMeta(
  total: number,
  limit: number,
  offset: number,
): { total: number; limit: number; offset: number; has_more: boolean } {
  return {
    total,
    limit,
    offset,
    has_more: offset + limit < total,
  };
}
