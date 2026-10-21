# UPC (Unified Product Catalog)

**Type:** Optional
**Module:** `src/modules/upc/`
**Dependencies:** `client_catalog` (for company/workspace context)

## Overview

The UPC capability connects your app to Mapp's Product Feed Service (Unified Product Catalog). It provides access to product feeds — large datasets of product information that companies push into Mapp's platform.

Use this to:
- List available product feeds for a company
- Stream product data with memory-efficient keyset pagination
- Get feed metadata (attributes, product counts)
- Map feeds to workspaces

## Swagger / OpenAPI

- **Swagger UI (INT):** `http://product-feed-service.ingress.int.k8s.muc.domeus.com:8080/swagger-ui/index.html`
- **OpenAPI Specs (INT):**
  - Internal API: `http://product-feed-service.ingress.int.k8s.muc.domeus.com:8080/productfeed-api-docs/internal`
  - Public API: `http://product-feed-service.ingress.int.k8s.muc.domeus.com:8080/productfeed-api-docs/public`
  - Configuration: `http://product-feed-service.ingress.int.k8s.muc.domeus.com:8080/productfeed-api-docs/configuration`

Viewing the Swagger UI / OpenAPI specs requires Basic Auth — that's for the docs
endpoints themselves, **not** how the app authenticates (see Authentication below).

## Authentication

UPC authenticates via the **shared internal-API credential** (Keycloak realm `s2s`,
`INTERNAL_API_*`) — the same Bearer-token credential the Client Catalog uses, **not** a
UPC-specific Basic Auth. The client sends a Bearer token via `internalApiFetch` and
refreshes once on a 401. The realm-`s2s` client must be authorized for
product-feed-service (the default `mapp-labs` client is). See
[docs/template/INTERNAL-API.md](../INTERNAL-API.md).

> Older template versions used Basic Auth (`UPC_API_USERNAME` / `UPC_API_PASSWORD`);
> these were removed in the 2026-06-18 shared-credential switch.

## API Endpoints

All endpoints are relative to `UPC_API_BASE_URL`, under the path `/rest/internal/product-feed/`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/{companyId}/feeds` | List feeds for a company |
| `GET` | `/{companyId}/feeds/{feedId}/attributes?dataType={type}` | Get feed attributes |
| `GET` | `/{companyId}/feeds/{feedId}/count?dataType={type}` | Get product count |
| `GET` | `/{companyId}/feeds/{feedId}/data?dataType={type}` | Get paginated product data |
| `GET` | `/{companyId}/feeds/{feedId}/data/{variantId}?dataType={type}` | Get single product |
| `GET` | `/{companyId}/feed-workspace-mapping` | Get feed-to-workspace mapping |

### Feed Data Types

| Type | Description |
|------|-------------|
| `SOURCE` | Raw product data as submitted by the company |
| `ENRICHED` | Data after Mapp's enrichment processing |
| `COMBINED` | Merged source + enriched data |

### Product Data Response

```json
{
  "data": [
    {
      "variantId": "SKU-001",
      "productId": "PROD-001",
      "feedId": 42,
      "data": {
        "name": "Blue T-Shirt",
        "price": "29.99",
        "currency": "EUR",
        "image_url": "https://..."
      },
      "createdAt": 1700000000000,
      "updatedAt": 1700100000000
    }
  ],
  "lastId": "SKU-001"
}
```

### Feed-to-Workspace Mapping Response

```json
{
  "42": [
    {
      "companyId": 123,
      "workspaceId": 456,
      "workspaceName": "Acme Fashion",
      "intelligenceInstanceId": null,
      "engageInstanceId": null,
      "fashionInstanceId": "acme-fashion-01"
    }
  ]
}
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `UPC_API_BASE_URL` | Yes | Base URL of the Product Feed Service |
| `INTERNAL_API_TOKEN_URL` | Yes | Shared internal-API OAuth2 token endpoint (realm `s2s`) |
| `INTERNAL_API_CLIENT_ID` | Yes | Shared internal-API OAuth2 client id (default `mapp-labs`) |
| `INTERNAL_API_CLIENT_SECRET` | Yes | Shared internal-API OAuth2 client secret (from labs-platform team) |

Auth uses the **shared** internal-API credential (`INTERNAL_API_*`) — the same
one used by the client catalog — not a UPC-specific Basic Auth credential. The
client sends a Bearer token and refreshes once on a 401. The realm-`s2s` client
must be authorized for product-feed-service (the default `mapp-labs` client is).
See [docs/template/INTERNAL-API.md](../INTERNAL-API.md).

## Database Schema Changes

Depends on the **Client Catalog** capability (the `Workspace` model). Apply
`client_catalog.prisma.example` first, then `prisma/schema/upc.prisma.example`,
which adds:

- **Workspace** (existing): `upcCompanyId`, `upcWorkspaceId`, `feeds` relation —
  link the client-catalog workspace to its UPC identity.
- **Feed** (new): `upcFeedId` (`@unique`, the canonical route key), `workspaceId`
  (FK), `feedDataType`, `upcLocale`. A workspace has many feeds.
- **ProductCatalog** (new): `feedId` (FK), `externalId`, raw `data`, with
  `@@unique([feedId, externalId])` — items are unique **per feed** (the same
  externalId can recur across feeds), and the route stays stable across re-imports.

## Companies → Workspaces → Feeds → Items admin (canonical-id routing)

This capability ships a copy-in scaffold — `src/modules/upc/scaffold/` (see its
`README.md`) — adding the feed/item layer under the client_catalog
companies/workspaces routes:

```
/admin/companies/[companyId]/workspaces/[workspaceId]/feeds/[upcFeedId]/item/[externalId]
```

- Routes are keyed by canonical external ids (`upcFeedId`, `externalId`); internal
  PKs never appear. Boundary resolvers (`feed-routing.ts`) scope feed→workspace
  and item→feed with the always-select guardrail (see [docs/template/ROUTING.md](../ROUTING.md)).
- Passthrough layouts at the workspace and feed segments let the deeper routes mount.
- `catalog-links.ts` provides `feedPath` / `feedItemPath` (+ `feedHref` /
  `catalogItemHref`) — the single source of truth for product deep-links; every
  product display uses them with `externalId` as the displayed id.
- **Sync feeds** (`listFeeds`) then **Pull from UPC** (`getProductPage`, keyset
  pagination) populate `Feed` / `ProductCatalog`. The template stores raw `data`;
  add transforms for your app.

## Module API

```typescript
import {
  listFeeds,
  getFeedAttributes,
  getProductCount,
  getProductPage,
  getProductByVariantId,
  getFeedToWorkspaceMapping,
  streamAllProducts,
} from '@/modules/upc';

// List feeds for a company
const feeds = await listFeeds(companyId);

// Get product count
const count = await getProductCount(companyId, feedId, 'SOURCE');

// Get a single page of products
const page = await getProductPage(companyId, feedId, 'SOURCE', {
  limit: 100,
  lastId: 'previous-last-id',
});

// Stream all products (memory-efficient)
for await (const batch of streamAllProducts(companyId, feedId, 'SOURCE', { batchSize: 500 })) {
  // batch is ProductFeedData[]
  await processBatch(batch);
}

// Get feed-to-workspace mapping
const mapping = await getFeedToWorkspaceMapping(companyId);
// Returns: Map<feedId, FeedWorkspaceMapping[]>

// Look up a single product
const product = await getProductByVariantId(companyId, feedId, 'SKU-001');
```

### Streaming Pattern

The `streamAllProducts()` function uses an async generator with keyset pagination (not offset-based), making it safe and efficient for large feeds:

```typescript
// Process millions of products without loading them all into memory
let totalProcessed = 0;
for await (const batch of streamAllProducts(companyId, feedId)) {
  totalProcessed += batch.length;
  await ingestBatch(batch);
  console.log(`Processed ${totalProcessed} products...`);
}
```

## Connecting UPC to Client Catalog Workspaces

The UPC knows which feeds are mapped to which Client Catalog workspaces. The `getFeedToWorkspaceMapping(companyId)` function returns a `Map<feedId, FeedWorkspaceMapping[]>` where each mapping includes:

```typescript
type FeedWorkspaceMapping = {
  companyId: number;
  workspaceId: number;              // Client Catalog workspace ID
  workspaceName: string;
  intelligenceInstanceId?: number;  // populated for Intelligence workspaces
  intelligenceInstanceName?: string;
  engageInstanceId?: number;        // populated for Engage workspaces
  engageInstanceName?: string;
  fashionInstanceId?: string;       // populated for Fashion workspaces
  fashionInstanceName?: string;
};
```

To find the feed for a specific workspace, reverse the mapping:

```typescript
const mapping = await getFeedToWorkspaceMapping(companyId);
for (const [feedId, workspaces] of mapping.entries()) {
  const match = workspaces.find(ws => ws.workspaceId === targetWorkspaceId);
  if (match) {
    // feedId is the UPC feed serving this workspace
    const products = await getProductPage(companyId, feedId);
  }
}
```

For fashion apps specifically, match `fashionInstanceId` from the UPC mapping to `fashionNamespaceId` from the Client Catalog workspace. See [CLIENT_CATALOG.md § Building a Fashion App](./CLIENT_CATALOG.md#building-a-fashion-app) for the full chain.

## Example Use Cases

- **Product data ingestion**: Stream products from a company's feed into your local database for processing
- **Feed monitoring**: Check product counts and last-updated timestamps to detect feed updates
- **Attribute discovery**: List feed attributes to understand what data is available before building features
- **Multi-feed aggregation**: Map feeds to workspaces to understand which products belong to which business unit

## Reference

The FTL project at `labs-trends/src/modules/upc/` has a production implementation that:
- Streams products from UPC and transforms them into a normalized catalog format
- Resolves MAP-typed attributes (locale-specific values)
- Runs a full ingestion pipeline with batching, deduplication (row hashes), and audit records

The template version provides the raw API client and streaming — your app decides what to do with the data.
