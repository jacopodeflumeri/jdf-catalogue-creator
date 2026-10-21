# Fashion Trends Lab (FTL)

**Type:** Optional
**Module:** None (external API — use `fetch` or a lightweight client)
**Dependencies:** None

## Overview

The Fashion Trends Lab (FTL, also called Labs Trends) is a Mapp Labs application that manages fashion taxonomy, trends, outfit rules, shape rules, and color rules. It exposes a public REST API that your app can consume.

Unlike Client Catalog and UPC which are platform services, FTL is another Labs application. Your app connects to it as an API consumer.

## Authentication

API key via the `X-API-Key` header.

```bash
curl -H "X-API-Key: stg_a1b2c3..." https://stg-ftl.labs.mapp.com/api/v1/categories
```

### API Key Format

Keys include an environment prefix: `dev_`, `stg_`, or `prod_` followed by a 64-character hex string. A staging key only works against the staging FTL instance.

### API Key Types

| Type | Scope | Access |
|------|-------|--------|
| **Internal** (`accountId = null`) | Full access | All endpoints: categories, features, mappings, snapshot, outfit rules, trends, products |
| **Account-scoped** (`accountId` set) | Limited | Trend groups and trends only, scoped to the account's brands |

### Getting an API Key

1. Log into the FTL admin dashboard (requires Mapp Azure AD SSO)
2. Navigate to `/admin/api-keys` for internal keys
3. Navigate to `/admin/accounts/{id}/api-keys` for account-scoped keys
4. Create a key with a descriptive name

## API Documentation

FTL provides interactive API documentation:

| Resource | URL | Auth Required |
|----------|-----|---------------|
| **Swagger UI** | `{FTL_API_BASE_URL}/api/v1/docs` | Admin session |
| **OpenAPI 3.1 Spec** | `{FTL_API_BASE_URL}/api/v1/docs/spec` | API key or admin session |

### FTL Instances

| Environment | URL |
|-------------|-----|
| Staging | `https://stg-ftl.labs.mapp.com` |
| Production | `https://ftl.labs.mapp.com` |

## Endpoints

All endpoints are under `/api/v1`.

### Taxonomy

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/categories` | List garment categories | Internal key |
| `GET` | `/categories/{id}` | Get single category | Internal key |
| `GET` | `/feature-categories` | List feature categories (e.g., Neckline, Fit) | Internal key |
| `GET` | `/feature-categories/{id}` | Get single feature category | Internal key |
| `GET` | `/features` | List features (e.g., V-Neck, Slim Fit) | Internal key |
| `GET` | `/features/{id}` | Get single feature | Internal key |
| `GET` | `/mappings` | Category-to-feature-category mappings | Internal key |

### Snapshot

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/snapshot` | Complete taxonomy in one response | Internal key |
| `GET` | `/snapshot/taxonomy/versions` | List taxonomy versions | Internal key |
| `GET` | `/snapshot/taxonomy/versions/{version}` | Get specific version | Internal key |

### Outfit Rules

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/outfit-rules` | List outfit combination rules | Internal key |
| `GET` | `/outfit-rules/{id}` | Get single rule | Internal key |

Outfit rules define whether specific feature pairs are allowed across garment categories (e.g., "V-Neck top + Round neckline jacket = allowed").

### Trends

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/trend-groups` | List trend groups | Internal or account-scoped |
| `GET` | `/trend-groups/{id}` | Get trend group detail | Internal or account-scoped |
| `GET` | `/trend-groups/{id}/trends` | List trends in a group | Internal or account-scoped |
| `GET` | `/trends/{id}` | Get trend with products | Internal or account-scoped |
| `GET` | `/trend-groups/search?q={query}` | Search trend groups | Internal or account-scoped |
| `GET` | `/trends/search?q={query}` | Search trends | Internal or account-scoped |

### Products

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/categories/{id}/products` | Products by category | Internal key |
| `GET` | `/features/{id}/products` | Products by feature | Internal key |
| `GET` | `/brands/{brandId}/products/{externalId}` | Single product | Both key types |

## Response Format

All responses use a consistent envelope:

```json
{
  "success": true,
  "data": { ... },
  "pagination": {
    "total": 150,
    "limit": 50,
    "offset": 0,
    "has_more": true
  }
}
```

### Common Query Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | int | 50 | Results per page (max 200, 1000 for mappings) |
| `offset` | int | 0 | Number of results to skip |
| `q` | string | — | Full-text search |
| `include` | string | — | Comma-separated relationship names to load |
| `sort_by` | string | varies | Sort field |
| `sort_order` | `asc`/`desc` | `asc` | Sort direction |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `FTL_API_BASE_URL` | Yes | Base URL of the FTL instance (e.g., `https://stg-ftl.labs.mapp.com`) |
| `FTL_API_KEY` | Yes | API key for authentication |

## Database Schema Changes

None — FTL is consumed as an external API. No local schema changes needed.

## Usage Example

```typescript
const FTL_BASE = process.env.FTL_API_BASE_URL;
const FTL_KEY = process.env.FTL_API_KEY;

async function fetchCategories() {
  const res = await fetch(`${FTL_BASE}/api/v1/categories?active=true&include=children`, {
    headers: { 'X-API-Key': FTL_KEY! },
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error.message);
  return json.data;
}

async function fetchTrends(groupId: number) {
  const res = await fetch(`${FTL_BASE}/api/v1/trend-groups/${groupId}/trends`, {
    headers: { 'X-API-Key': FTL_KEY! },
  });
  const json = await res.json();
  return json.data;
}

// Get the full taxonomy snapshot
async function fetchTaxonomySnapshot() {
  const res = await fetch(`${FTL_BASE}/api/v1/snapshot`, {
    headers: { 'X-API-Key': FTL_KEY! },
  });
  const json = await res.json();
  return json.data; // { categories, feature_categories, features, mappings, generated_at }
}
```

## Additional Resources

### Shape Rules (Internal Only — Not Yet in Public API)

Shape rules map garment features to body shapes with 3-valued recommendations (Y/N/OK). These are documented in the FTL codebase at `docs/SHAPE-RULES.md` but are not yet exposed via the public API.

### Outfit Color Rules (Internal Only — Not Yet in Public API)

Color-to-color compatibility rules across categories with texture/feature conditions. Documented at `docs/OUTFIT-COLOR-RULES.md` in the FTL codebase.

## Example Use Cases

- **Product categorization**: Use the taxonomy snapshot to categorize products by garment type and features
- **Trend display**: Show current fashion trends in a customer-facing dashboard
- **Outfit validation**: Check if product combinations follow outfit rules
- **Style recommendations**: Use trend data and taxonomy to generate recommendations
- **Data enrichment**: Augment your product data with FTL taxonomy classifications
