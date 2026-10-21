/**
 * Public API Response Helpers
 *
 * Envelope builders for the public API.
 */

import { NextResponse } from "next/server";
import { toSnakeCase } from "./transform";

export { toSnakeCase } from "./transform";

// ---------------------------------------------------------------------------
// Response envelope types
// ---------------------------------------------------------------------------

export interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface FieldError {
  field: string;
  message: string;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  field_errors?: FieldError[];
}

// ---------------------------------------------------------------------------
// Envelope builders
// ---------------------------------------------------------------------------

/**
 * Build a success response for a single resource.
 */
export function successResponse<T>(
  data: T,
  headers?: Record<string, string>,
  status = 200,
): NextResponse {
  return NextResponse.json(
    { success: true, data: toSnakeCase(data) },
    { status, headers },
  );
}

/**
 * Build a success response for a paginated list.
 */
export function paginatedResponse<T>(
  data: T[],
  pagination: PaginationMeta,
  headers?: Record<string, string>,
): NextResponse {
  return NextResponse.json(
    {
      success: true,
      data: toSnakeCase(data),
      pagination,
    },
    { status: 200, headers },
  );
}

/**
 * Build a structured error response.
 */
export function errorResponse(
  code: string,
  message: string,
  status: number,
  fieldErrors?: FieldError[],
): NextResponse {
  const error: ApiErrorBody = { code, message };
  if (fieldErrors?.length) error.field_errors = fieldErrors;
  return NextResponse.json({ success: false, error }, { status });
}
