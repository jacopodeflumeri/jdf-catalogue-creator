# Client Catalog

**Type:** Optional
**Module:** `src/modules/client_catalog/`
**Dependencies:** None

## Overview

The Client Catalog capability connects your app to Mapp's Company Management Service (GUM), which is the central registry of companies (customers) and their workspaces across all Mapp products.

- **Companies** in the Client Catalog map to **Accounts** in your app
- **Workspaces** belong to companies and serve one or more Mapp products via a `services` array
- Service values: `INTELLIGENCE`, `ST`, `ENGAGE`, `FASHION`
- Use this to discover which companies your app should serve and what workspaces they have

## Before you implement — get the connection details (agents: do this first)

This capability needs a **base URL** and a **credential**. Both already exist. You
do **not** ask the app owner for them and you do **not** invent placeholder values.

### 1. Base URL — per-environment, match it to your credential

The Company Management Service is deployed **once per environment**. Local dev and
staging use the INT deployment; only production uses the PROD host:

```bash
# staging / local
CLIENT_CATALOG_BASE_URL=https://company-management-service.k8s-int-01.nbg.webtrekk.com/gum-service/api

# production
CLIENT_CATALOG_BASE_URL=https://company-management-service.k8s-prod-01.nbg.webtrekk.com/gum-service/api
```

The base URL and the `INTERNAL_API_*` credential below **must be from the same
environment** — an INT credential against the PROD host (or the reverse) is
rejected. Neither value is a secret. Both are mirrored at
`/mapp-labs[-stg]/catalog/cms-base-url` in shared SSM, which is the source of truth
if a host ever moves — but you don't need an AWS call to get started.

### 2. Credential — read it from shared SSM

The credential is the **shared internal-API credential** (Keycloak realm `s2s`),
not a client-catalog-specific one — the same trio authenticates UPC and every other
internal Mapp service. It is already provisioned once per AWS account; nothing needs
to be created:

> ⚠️ **The shared namespace is per-environment.** Production keeps the unsuffixed
> prefix `/mapp-labs`; staging is `/mapp-labs-stg`. **A staging app that reads
> `/mapp-labs/*` silently talks to PRODUCTION** — it works, so the mistake is
> invisible. The `s2s` client id is `mapp-labs` in both, but the *secret* differs
> per realm: a production secret returns `unauthorized_client` against INT.

| Shared SSM parameter | Env var |
|---|---|
| `/mapp-labs[-stg]/internal-api/token-url` | `INTERNAL_API_TOKEN_URL` |
| `/mapp-labs[-stg]/internal-api/client-id` | `INTERNAL_API_CLIENT_ID` (value: `mapp-labs`) |
| `/mapp-labs[-stg]/internal-api/client-secret` | `INTERNAL_API_CLIENT_SECRET` (SecureString) |

```bash
# staging — use --path /mapp-labs/internal-api for production
aws ssm get-parameters-by-path --path /mapp-labs-stg/internal-api --with-decryption \
  --profile labs-power --region eu-central-1 \
  --query 'Parameters[].[Name,Value]' --output text
```

Write the three values into `.env` (gitignored — never commit the secret).

Notes:

- The `mapp-labs` realm-`s2s` client is already authorized for the
  company-management-service, so no per-app provisioning is needed.
- If a call returns `401`/`403`, that's a labs-platform team task — do not work
  around it by adding a second OAuth trio or falling back to Basic Auth (Basic is
  QA-only, see *Authentication*).
- **For AWS deploys there is no credential setup at all** — `infra/lib/stack.ts`
  reads `/mapp-labs[-stg]/internal-api/*` directly (the prefix for the deploy
  environment), so no SSM parameter is seeded or
  copied. The only step is to **uncomment the `CLIENT_CATALOG_BASE_URL` line** in the
  task definition's `environment` block in `infra/lib/stack.ts`. See the *Deployment*
  section of [docs/template/INTERNAL-API.md](../INTERNAL-API.md).

## Swagger / OpenAPI

- **Swagger UI (INT):** `http://company-management-service.k8s-int-01.nbg.webtrekk.com/gum-service/api/swagger-ui/index.html`
- **OpenAPI Spec (INT):** `http://company-management-service.k8s-int-01.nbg.webtrekk.com/gum-service/api/v3/api-docs`

Both require auth (OAuth2 or Basic Auth).

## Authentication

The Client Catalog API supports two authentication methods:

1. **OAuth2 Client Credentials** (primary) — Uses an IDP token URL with client ID and secret. Tokens are cached and refreshed 60 seconds before expiry.
2. **Basic Auth** (fallback for QA) — Username and password. Used when OAuth2 credentials are not configured.

## API Endpoints

This module uses V2 company endpoints for typed responses. All endpoints are relative to `CLIENT_CATALOG_BASE_URL`.

### Companies (V2)

| Method | Path | Description | Response Type |
|--------|------|-------------|---------------|
| `GET` | `/v2/companies` | List all companies (overview) | `CompanyOverviewResponseDto[]` |
| `GET` | `/v2/companies/{companyId}` | Get full company detail | `CompanyResponseDto` |
| `GET` | `/v2/companies/search` | Search companies (paginated) | `PaginatedResponseDto<CompanyOverviewResponseDto>` |

### Workspaces

| Method | Path | Description | Response Type |
|--------|------|-------------|---------------|
| `GET` | `/workspaces` | List all workspaces | `WorkspaceResponseDto[]` |
| `GET` | `/workspaces/{id}` | Get a single workspace | `WorkspaceResponseDto` |
| `GET` | `/workspaces?companyId={id}` | List workspaces for a company | `WorkspaceResponseDto[]` |

### Fashion-Specific (used by FTL)

| Method | Path | Description | Response Type |
|--------|------|-------------|---------------|
| `GET` | `/fashion/companies` | List fashion-relevant companies | `FashionCompanyResponseDto[]` |
| `GET` | `/fashion/companies/{companyId}` | Get a fashion company | `FashionCompanyResponseDto` |
| `GET` | `/fashion/workspaces?companyId={id}` | Fashion workspaces for a company | `FashionWorkspaceResponseDto[]` |
| `GET` | `/fashion/workspaces/{workspaceId}` | Get a fashion workspace | `FashionWorkspaceResponseDto` |

### Internal API

| Method | Path | Description | Response Type |
|--------|------|-------------|---------------|
| `GET` | `/internal/companies` | List all companies | `CompanyApiResponseDto[]` |
| `GET` | `/internal/companies/{companyId}` | Get a company | `CompanyApiResponseDto` |
| `GET` | `/internal/workspaces` | Filter workspaces by product IDs | `WorkspaceApiResponseDto[]` |
| `GET` | `/internal/workspaces/{workspaceId}` | Get workspace with instance IDs | `WorkspaceApiResponseDto` |

### Company Overview Response (list)

```json
{
  "id": 123,
  "name": "Acme Corp",
  "description": "Global retail",
  "salesforceId": "SF00123",
  "createdAt": "2024-01-15",
  "active": true,
  "linkedWorkspaceNames": ["Acme Analytics", "Acme Fashion"]
}
```

### Company Detail Response (single)

```json
{
  "id": 123,
  "name": "Acme Corp",
  "active": true,
  "description": "Global retail",
  "loginPrefix": "acme",
  "salesforceId": "SF00123",
  "businessAttributes": { "vertical": "retail", "tier": "enterprise" },
  "workspaces": [
    {
      "id": 456,
      "companyId": 123,
      "name": "Acme Analytics",
      "services": ["INTELLIGENCE"],
      "systemId": "sys-001",
      "tenantId": "tenant-acme"
    }
  ]
}
```

### Workspace Response

```json
{
  "id": 456,
  "companyId": 123,
  "tenantId": "tenant-acme",
  "name": "Acme Analytics",
  "description": "Main analytics workspace",
  "accountId": "ACC-123",
  "accountName": "Acme Corp",
  "systemId": "sys-001",
  "dashboardSystemId": "dsys-001",
  "systemName": "Acme Intelligence",
  "fashionNamespaceId": null,
  "fashionSlugName": null,
  "fashionRegion": null,
  "createdAt": "2024-01-15",
  "services": ["INTELLIGENCE"]
}
```

## Environment Variables

| Variable | Required | Value source | Description |
|----------|----------|--------------|-------------|
| `CLIENT_CATALOG_BASE_URL` | Yes | per-environment (below) | Base URL of the Company Management Service |
| `INTERNAL_API_TOKEN_URL` | Yes¹ | `/mapp-labs[-stg]/internal-api/token-url` | Shared internal-API OAuth2 token endpoint (realm `s2s`) |
| `INTERNAL_API_CLIENT_ID` | Yes¹ | `/mapp-labs[-stg]/internal-api/client-id` | Shared internal-API OAuth2 client id (`mapp-labs`) |
| `INTERNAL_API_CLIENT_SECRET` | Yes¹ | `/mapp-labs[-stg]/internal-api/client-secret` | Shared internal-API OAuth2 client secret (SecureString) |
| `CLIENT_CATALOG_BASIC_USERNAME` | No | — | Basic auth username (QA fallback) |
| `CLIENT_CATALOG_BASIC_PASSWORD` | No | — | Basic auth password (QA fallback) |

`CLIENT_CATALOG_BASE_URL` is **per-environment** — `k8s-int-01` for staging and
local, `k8s-prod-01` for production (mirrored at
`/mapp-labs[-stg]/catalog/cms-base-url`). It must match the environment of the
credential. The `INTERNAL_API_*` paths are
shared SSM parameters in account `936190502406` / `eu-central-1`, read with the
`labs-power` profile — see *Before you implement* above.

¹ Auth uses the **shared** internal-API credential (`INTERNAL_API_*`), not a
client-catalog-specific OAuth trio — the same credential authenticates every
internal Mapp service. See [docs/template/INTERNAL-API.md](../INTERNAL-API.md). When the
shared OAuth credential is set it is used (Bearer); otherwise the client falls
back to Basic Auth (QA only). The realm-`s2s` client must be authorized for
company-management-service (the default `mapp-labs` client is).

## Database Schema Changes

When enabling this capability, apply `prisma/schema/client_catalog.prisma.example`:

1. **Add fields to the Account model:**
   - `clientCatalogCompanyId` (Int `@unique`) — the Client Catalog company id; this
     is the **canonical route key** (`/admin/companies/[companyId]`). Required +
     unique in the default customer build. (Make it `Int?` only for a non-customer
     build that creates records by hand — see *Non-customer (hybrid)* below.)
   - `salesforceId` (String?) — Salesforce ID from the Client Catalog
   - `clientCatalogData` (Json?) — Stores raw company metadata from the API
   - `workspaces` (Workspace[]) — relation

2. **Add Workspace model:**
   - `clientCatalogWorkspaceId` (Int `@unique`) — the Client Catalog workspace id;
     the canonical route key (`…/workspaces/[workspaceId]`)
   - `clientCatalogCompanyId` (Int) — the company this workspace belongs to
     (= `Account.clientCatalogCompanyId`); the **scope + relation key**
   - `name`, `tenantId`, `systemId`, `dashboardSystemId`
   - `services` (Json) — `["INTELLIGENCE", "ENGAGE", "FASHION", "ST"]`
   - `metadata` (Json?) — Raw API response

## Companies & Workspaces admin (canonical-id routing)

The base template ships **no** companies/workspaces routes. This capability
provides them as a copy-in scaffold — `src/modules/client_catalog/scaffold/`
(see its `README.md`) — built on the canonical external-id routing convention
(`docs/template/ROUTING.md`):

- Routes use **client-catalog terminology and external ids**:
  `/admin/companies/[companyId]/workspaces/[workspaceId]`, keyed by
  `clientCatalogCompanyId` / `clientCatalogWorkspaceId`. Internal PKs never appear
  in URLs.
- **Boundary resolvers** (`account-routing.ts`) translate external→internal and
  `notFound()` on miss; `resolveWorkspaceByWorkspaceId` enforces the scope-field
  guardrail.
- **Discovery-only:** companies/workspaces are imported via `discoverCompanies()`
  (the "Discover" action upserts them). There is **no manual "add company"**
  path — every record maps to a real Client Catalog company.

### Non-customer (hybrid)

If you're building for **non-customers** (Mapp-internal records created by hand,
not sourced from the catalog), make `clientCatalogCompanyId` nullable (`Int?
@unique`), keep a manual-add path, and have the resolver fall back to the
internal id when the external id is absent.

## Module API

```typescript
import {
  listCompanies,
  getCompany,
  getWorkspaces,
  getWorkspace,
  discoverCompanies,
  clearTokenCache,
} from '@/modules/client_catalog';

import type {
  Company,
  CompanyOverview,
  WorkspaceResponse,
} from '@/modules/client_catalog';

// List all companies (returns overviews with salesforceId, linkedWorkspaceNames)
const companies = await listCompanies();

// List active companies only
const activeCompanies = await listCompanies({ active: true });

// Get full company detail (includes workspaces, businessAttributes)
const company = await getCompany(companyId);

// Get workspaces for a company
const workspaces = await getWorkspaces(companyId);

// Discover all companies with their workspaces (full detail)
const discovered = await discoverCompanies();
// Returns: DiscoveredCompany[] = Array<{ company: Company, workspaces: WorkspaceResponse[] }>

// With custom config (overrides env vars)
const companies = await listCompanies(undefined, {
  baseUrl: 'https://custom-url.example.com',
  clientId: 'my-client-id',
  clientSecret: 'my-secret',
});
```

## Key Types

```typescript
// Company overview (from list endpoint)
type CompanyOverview = {
  id: number;
  name: string;
  description?: string;
  salesforceId?: string;
  createdAt?: string;
  active: boolean;
  linkedWorkspaceNames?: string[];
};

// Full company detail (from single get)
type Company = {
  id: number;
  name: string;
  active: boolean;
  description?: string;
  loginPrefix?: string;
  salesforceId?: string;
  businessAttributes?: Record<string, string>;
  workspaces?: WorkspaceResponse[];
};

// Workspace
type WorkspaceResponse = {
  id: number;
  companyId: number;
  tenantId?: string;
  name?: string;
  description?: string;
  accountId?: string;       // Client Catalog's own account ID (string)
  accountName?: string;
  systemId?: string;        // Intelligence/ST system ID
  dashboardSystemId?: string;
  systemName?: string;
  fashionNamespaceId?: string;
  fashionSlugName?: string;
  fashionRegion?: string;
  createdAt?: string;
  services?: string[];      // ["INTELLIGENCE", "ST", "ENGAGE", "FASHION"]
};
```

## Example Use Cases

- **Account discovery**: Periodically sync companies from the Client Catalog to create/update Account records in your database
- **Workspace mapping**: Link workspaces to your app's data models to scope data by Mapp product instance
- **Multi-product apps**: Build apps that serve Intelligence, Engage, and Fashion customers using the `services` array
- **Onboarding**: Auto-populate account details when a new company is added to the Client Catalog
- **Billing/Metering**: Use `companyId`, `salesforceId`, workspace IDs, and `services` to report usage to billing systems

## Product-Specific Workspace Fields

The Client Catalog is product-agnostic — a single workspace can serve multiple Mapp products. The `services` array on each workspace tells you which products it's enabled for: `"INTELLIGENCE"`, `"ST"`, `"ENGAGE"`, `"FASHION"`.

Some fields on `WorkspaceResponseDto` are product-specific and will be `null` when that product isn't enabled for the workspace:

| Field | Product | Description |
|-------|---------|-------------|
| `systemId` | Intelligence/ST | The Intelligence or ST system instance ID |
| `dashboardSystemId` | Engage | The Engage dashboard system ID |
| `fashionNamespaceId` | Fashion | UUID identifying the fashion namespace |
| `fashionSlugName` | Fashion | URL-friendly slug for the fashion workspace |
| `fashionRegion` | Fashion | Region for the fashion instance (e.g., `eu-central-1`) |

### Fashion-Specific Endpoints

The Company Management Service also exposes fashion-specific controllers that return only fashion-relevant data. These are **not wrapped by the template client** (the template is product-agnostic), but apps that are fashion-specific can call them directly or add wrapper functions:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/fashion/companies` | List companies with a `fashionUniqueId` (fashion-enabled only) |
| `GET` | `/fashion/companies/{companyId}` | Get a fashion company |
| `GET` | `/fashion/workspaces?companyId={id}` | Fashion workspaces for a company |
| `GET` | `/fashion/workspaces/{workspaceId}` | Get a single fashion workspace |
| `GET` | `/fashion/workspaces/by-slug-name/{slugName}` | Look up a fashion workspace by slug |

These return `FashionCompanyResponseDto` and `FashionWorkspaceResponseDto` (types are exported from the module but have no client functions). The fashion company response includes a `fashionUniqueId` and `prefix` not present in the generic response. The fashion workspace response is a subset: `id`, `companyId`, `fashionNamespaceId`, `fashionSlugName`, `fashionRegion`.

### Building a Fashion App

To build a fashion-specific app on top of the generic template:

1. **Identify fashion workspaces** — Use the generic `getWorkspaces(companyId)` and filter to those where `services` includes `"FASHION"`. The `fashionNamespaceId` and `fashionSlugName` fields will be populated on these workspaces.

2. **Connect to UPC for product data** — The UPC module's `getFeedToWorkspaceMapping(companyId)` returns a map of `feedId → FeedWorkspaceMapping[]`. Each `FeedWorkspaceMapping` includes `workspaceId`, `fashionInstanceId`, and `fashionInstanceName`. Match the workspace ID from step 1 to find the corresponding UPC feed.

3. **Fetch product data** — Once you have the `feedId`, use `getProductPage(companyId, feedId)` from the UPC module to pull product catalog data.

The full chain looks like:

```
Client Catalog                    UPC
─────────────                    ───
Company (companyId)
  └── Workspace (workspaceId)
        ├── services: ["FASHION"]
        ├── fashionNamespaceId ──────► identifies the fashion namespace
        └── fashionSlugName          getFeedToWorkspaceMapping(companyId)
                                       └── feedId → [{ workspaceId, fashionInstanceId }]
                                             │
                                             ▼
                                     getProductPage(companyId, feedId)
                                       └── product data
```

**Key identifiers for fashion:**
- `companyId` — shared across Client Catalog and UPC
- `workspaceId` — links Client Catalog workspace to UPC feed-workspace mapping
- `fashionNamespaceId` — UUID from Client Catalog, identifies the fashion namespace
- `fashionInstanceId` — string from UPC's `FeedWorkspaceMapping`, references the fashion instance
- `feedId` — UPC feed containing the product data for this workspace

The FTL project uses this exact chain but calls workspaces "Brands" (a fashion-specific naming convention). In the template, stick with "Workspace" to stay product-agnostic.

## Reference

The FTL (Labs Trends) project at `labs-trends/src/modules/client_catalog/` has a production implementation that:
- Uses fashion-specific endpoints (`/fashion/companies`, `/fashion/workspaces`)
- Runs a `runDiscovery()` process that syncs companies/workspaces to Account/Brand database records
- Cross-references workspaces with UPC feed mappings
- Maps Client Catalog "Workspaces" to FTL "Brands" (fashion-specific naming)

The template version is generic — it uses V2 `/v2/companies` and `/workspaces` paths and returns data without writing to the database. Fashion-specific types (`FashionCompanyResponse`, `FashionWorkspaceResponse`) are exported from the module for apps that need them.
