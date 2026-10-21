/**
 * Shared Zod Schemas for the Public API
 *
 * Pagination, include, and error envelope schemas used across all endpoints.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Pagination query params
// ---------------------------------------------------------------------------

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// ---------------------------------------------------------------------------
// Include param
// ---------------------------------------------------------------------------

export const includeQuerySchema = z.object({
  include: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Error envelope
// ---------------------------------------------------------------------------

export const fieldErrorSchema = z.object({
  field: z.string(),
  message: z.string(),
});

export const errorEnvelopeSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    field_errors: z.array(fieldErrorSchema).optional(),
  }),
});

// ---------------------------------------------------------------------------
// Pagination metadata
// ---------------------------------------------------------------------------

export const paginationMetaSchema = z.object({
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
  has_more: z.boolean(),
});
