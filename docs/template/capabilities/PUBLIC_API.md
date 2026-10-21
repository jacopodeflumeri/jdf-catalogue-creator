# Public API

**Type:** Optional
**Module:** `src/modules/public_api/`
**Dependencies:** None

## Overview

The Public API capability provides reusable infrastructure for exposing your app's data via a versioned REST API. It includes API key authentication, Swagger UI documentation, OpenAPI spec generation, standard response envelopes, pagination, CORS, and caching.

This is not a Mapp service integration — it's a **pattern** for building your own API, using the same architecture proven in the FTL (Labs Trends) project.

## What's Included

| Component | Description |
|-----------|-------------|
| **API Key Auth** | `withApiKeyAuth` higher-order function for protecting routes |
| **Response Envelopes** | Standardized `{ success, data, pagination }` / `{ success, error }` format |
| **Key Generation** | Environment-prefixed keys (`dev_`, `stg_`, `prod_` + 64-char hex) |
| **Pagination** | `limit`/`offset` helpers with `has_more` calculation |
| **Validation** | Zod-based query parameter parsing with field-level error details |
| **CORS** | Pre-configured headers and OPTIONS handler |
| **Caching** | Cache-Control helpers: `privateCacheHeaders()` for key-scoped data, `cacheHeaders()` for global data |
| **Transform** | Automatic camelCase to snake_case conversion for API responses |
| **OpenAPI** | Zod-to-OpenAPI schema registration and spec generation |
| **Swagger UI** | Interactive API documentation served at `/api/v1/docs` |

## Architecture

### API Key Model

API keys are stored in the database with account-level scoping:

```
ApiKey
├── key (unique, env-prefixed)
├── name, description
├── active (soft-delete support)
├── environment (dev/staging/production)
├── accountId (null = internal key, set = account-scoped)
├── expiresAt (optional TTL)
├── lastUsedAt (usage tracking)
└── createdById (audit trail via MappTeam FK)
```

### Route Pattern

```typescript
// src/app/api/v1/your-resource/route.ts
import { withApiKeyAuth } from '@/modules/public_api';

export const dynamic = 'force-dynamic';

export const GET = withApiKeyAuth(async (request, { apiKey, searchParams }) => {
  // apiKey.id, apiKey.name, apiKey.accountId available
  // searchParams pre-parsed from URL

  const data = await fetchYourData();

  return paginatedResponse(data, { total, limit, offset });
});

export async function OPTIONS() {
  return optionsResponse();
}
```

### Response Format

**Success (single resource):**
```json
{
  "success": true,
  "data": { "id": 1, "name": "...", "created_at": "2024-01-01T..." }
}
```

**Success (paginated list):**
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": { "total": 150, "limit": 50, "offset": 0, "has_more": true }
}
```

**Error:**
```json
{
  "success": false,
  "error": { "code": "VALIDATION_ERROR", "message": "...", "field_errors": [...] }
}
```

### Key Scoping

| Key Type | `accountId` | Access |
|----------|-------------|--------|
| Internal | `null` | Full access to all endpoints |
| Account-scoped | set | Restricted to account's data |

Use the `requireInternal` option in `withApiKeyAuth` to block account-scoped keys from sensitive endpoints.

### Caching Rule

**A response that depends on the calling key uses `privateCacheHeaders()`.**
That covers every account-scoped result and any response whose fields differ by
key type (internal vs. account-scoped). `cacheHeaders()` and
`snapshotCacheHeaders()` send `public, s-maxage`, which lets a shared cache
(CDN, proxy) store the response and answer later requests for the same URL from
it, whichever key sent them. Use those only for data that is identical for every
key, such as a global taxonomy.

`privateCacheHeaders()` sends `Cache-Control: private, max-age=…` and
`Vary: X-API-Key`. When in doubt, use it: a private response only costs a
re-fetch; a public one can leak one account's data to another.

### Search Rule

A search reports which rows matched, so it reveals something about every column
it reads. On an external surface:

1. **Search only columns the caller is shown.** Never match on internal ids,
   withheld fields, or another account's data, or a caller can recover them a
   character at a time from which rows come back.
2. **Escape the input.** Prisma's `contains` / `startsWith` / `endsWith` pass
   `%` and `_` through as `LIKE` wildcards, so `?q=%25` (`%`) or `?q=__` matches
   every row. Run the term through `escapeLikePattern()` (or `toContainsTerm()`,
   which also trims and drops a blank term) from `@/lib/utils/search` first:

```typescript
import { toContainsTerm } from '@/lib/utils/search';

const q = toContainsTerm(searchParams.get('q'));
const where = q
  ? { accountId, OR: [{ name: { contains: q, mode: 'insensitive' } }] }
  : { accountId };
```

## Environment Variables

None required — the module uses your existing app configuration and database.

## Database Schema Changes

Apply `prisma/schema/public_api.prisma.example` to add the `ApiKey` model. This also requires adding `apiKeys ApiKey[]` relations to your `Account` and `MappTeam` models.

## Module API

```typescript
import {
  // Auth
  withApiKeyAuth,

  // Responses
  successResponse,
  paginatedResponse,
  errorResponse,

  // Helpers
  parsePaginationParams,
  buildPaginationMeta,
  parseQueryParams,
  corsHeaders,
  optionsResponse,
  cacheHeaders,          // public: same response for every key
  privateCacheHeaders,   // private: depends on the calling key
  toSnakeCase,

  // Key generation
  generateApiKey,
} from '@/modules/public_api';
```

### Setting Up Swagger UI

1. Create `src/app/api/v1/docs/route.ts`:
```typescript
import { generateSwaggerHtml } from '@/modules/public_api';

export async function GET() {
  return new Response(generateSwaggerHtml('/api/v1/docs/spec'), {
    headers: { 'Content-Type': 'text/html' },
  });
}
```

2. Create `src/app/api/v1/docs/spec/route.ts`:
```typescript
import { generateOpenApiSpec } from '@/modules/public_api';

export async function GET() {
  const spec = generateOpenApiSpec({
    title: 'My App API',
    version: '1.0.0',
    description: 'API documentation for My App',
  });
  return Response.json(spec);
}
```

### Registering Schemas for OpenAPI

```typescript
import { registerSchema, registerPath } from '@/modules/public_api';

// Register a Zod schema so it appears in the spec
registerSchema('Widget', widgetSchema);

// Register an endpoint
registerPath({
  method: 'get',
  path: '/api/v1/widgets',
  summary: 'List widgets',
  parameters: [...],
  responses: { 200: { ... } },
});
```

## Building an Endpoint (Full Example)

```typescript
// src/app/api/v1/widgets/route.ts
import {
  withApiKeyAuth,
  paginatedResponse,
  errorResponse,
  parsePaginationParams,
  buildPaginationMeta,
  parseQueryParams,
  corsHeaders,
  optionsResponse,
  privateCacheHeaders,
  toSnakeCase,
} from '@/modules/public_api';
import { z } from 'zod';

const querySchema = z.object({
  q: z.string().optional(),
  active: z.enum(['true', 'false']).optional(),
});

export const dynamic = 'force-dynamic';

export const GET = withApiKeyAuth(async (request, { apiKey, searchParams }) => {
  // Validate query params
  const parsed = parseQueryParams(searchParams, querySchema);
  if (!parsed.success) return parsed.response;

  const { q, active } = parsed.data;
  const { limit, offset } = parsePaginationParams(searchParams);

  // Your data logic, confined to the key's account (null = internal key).
  // getWidgets() passes `q` through escapeLikePattern() before `contains`.
  const [widgets, total] = await getWidgets({
    accountId: apiKey.accountId,
    q,
    active,
    limit,
    offset,
  });

  // Transform and respond. The result depends on the key, so it is private.
  const data = widgets.map(w => toSnakeCase(w));
  const pagination = buildPaginationMeta({ total, limit, offset });

  return paginatedResponse(data, pagination, {
    ...corsHeaders(),
    ...privateCacheHeaders(),
  });
});

export async function OPTIONS() {
  return optionsResponse();
}
```

## npm Dependencies

This capability requires:
- `@asteasolutions/zod-to-openapi` — Zod schema to OpenAPI spec conversion

This is added to `package.json` when enabling this capability. Swagger UI itself
is loaded from `cdn.jsdelivr.net` (pinned to `swagger-ui-dist@5`), which the CSP in
`next.config.ts` allows for scripts and styles — no npm package needed.

## Example Use Cases

- **Partner API**: Expose processed data to external consumers with API key access
- **Internal API**: Provide machine-readable access to your app's data for other Mapp services
- **AI agent access**: Let agents query your app's data programmatically via documented endpoints
- **Data export**: Offer paginated API access as an alternative to CSV exports

## Reference

The FTL project at `labs-trends/src/modules/public_api/` is the production reference. It exposes taxonomy, trends, outfit rules, and products through this exact pattern. The template version includes only the reusable framework — you add your own endpoints and schemas.
