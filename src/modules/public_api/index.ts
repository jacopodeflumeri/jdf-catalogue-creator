/**
 * Public API Module
 *
 * Reusable infrastructure for building versioned REST APIs
 * with API key auth, Swagger docs, and standard response envelopes.
 */

// Auth
export { withApiKeyAuth } from "./lib/auth";
export type { ApiKeyHandler, ApiKeyContext, ApiKeyAuthOptions } from "./lib/auth";

// Response helpers
export {
  successResponse,
  paginatedResponse,
  errorResponse,
  toSnakeCase,
} from "./lib/response";
export type { PaginationMeta, FieldError, ApiErrorBody } from "./lib/response";

// Pagination
export { parsePaginationParams, buildPaginationMeta } from "./lib/pagination";
export type { PaginationParams } from "./lib/pagination";

// CORS
export { corsHeaders, optionsResponse } from "./lib/cors";

// Cache
export {
  cacheHeaders,
  snapshotCacheHeaders,
  privateCacheHeaders,
  API_KEY_HEADER,
} from "./lib/cache";

// Validation
export { parseQueryParams, parseInclude } from "./lib/validation";

// Key generation
export { generateApiKey } from "./lib/keygen";

// Transform
export { toSnakeCase as transformToSnakeCase } from "./lib/transform";

// OpenAPI
export { registry } from "./openapi/registry";
export { generateOpenApiSpec, generateSwaggerHtml } from "./openapi/generator";
export type { OpenApiSpecOptions } from "./openapi/generator";

// Schemas
export {
  paginationQuerySchema,
  includeQuerySchema,
  errorEnvelopeSchema,
  fieldErrorSchema,
  paginationMetaSchema,
} from "./schemas/common";
