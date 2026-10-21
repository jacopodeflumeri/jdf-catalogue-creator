# Client Catalog — Companies & Workspaces admin scaffold

These `.example` files are the **canonical-id companies/workspaces admin** that
ships with the Client Catalog capability. The base template intentionally has no
companies/workspaces routes (see [docs/template/ROUTING.md](../../../../docs/template/ROUTING.md));
copy these in when enabling the capability.

They are `.example` on purpose: they reference Prisma columns
(`Account.clientCatalogCompanyId`, the `Workspace` model) that exist only after
you apply `prisma/schema/client_catalog.prisma.example`. They compile once copied
into a project that has applied the fragment — base `tsc` never sees them.

## Install

1. Apply the schema fragment and regenerate:
   - merge `prisma/schema/client_catalog.prisma.example` into `prisma/schema.prisma`
   - `npx prisma migrate dev && npx prisma generate`
2. Copy these files to their destinations (drop the `.example` suffix):

   | scaffold file | destination |
   |---|---|
   | `lib/company-links.ts.example` | `src/lib/admin/company-links.ts` |
   | `lib/account-routing.ts.example` | `src/lib/admin/account-routing.ts` |
   | `lib/company-admin-actions.ts.example` | `src/lib/actions/admin/company-admin-actions.ts` |
   | `app/companies/page.tsx.example` | `src/app/admin/companies/page.tsx` |
   | `app/companies/CompaniesClient.tsx.example` | `src/app/admin/companies/CompaniesClient.tsx` |
   | `app/companies/[companyId]/page.tsx.example` | `src/app/admin/companies/[companyId]/page.tsx` |
   | `app/companies/[companyId]/workspaces/[workspaceId]/layout.tsx.example` | `src/app/admin/companies/[companyId]/workspaces/[workspaceId]/layout.tsx` |
   | `app/companies/[companyId]/workspaces/[workspaceId]/page.tsx.example` | `src/app/admin/companies/[companyId]/workspaces/[workspaceId]/page.tsx` |

3. Add a "Companies" entry to the admin nav (`src/modules/navigation/config/navigation-items.tsx`):
   `{ name: "Companies", href: "/admin/companies", icon: "users" }`.
4. Set `CLIENT_CATALOG_BASE_URL` + the shared `INTERNAL_API_*` credential
   (see [docs/template/capabilities/CLIENT_CATALOG.md](../../../../docs/template/capabilities/CLIENT_CATALOG.md)).
5. Run discovery from `/admin/companies` to populate companies + workspaces.

## Conventions baked in

- **Canonical external ids in URLs** — `/admin/companies/[companyId]/workspaces/[workspaceId]`,
  keyed by `clientCatalogCompanyId` / `clientCatalogWorkspaceId`. Internal PKs never appear.
- **Boundary resolvers** (`account-routing.ts`) translate external→internal and
  `notFound()` on miss. `resolveWorkspaceByWorkspaceId` enforces the
  scope-field guardrail (always selects `clientCatalogCompanyId`).
- **Discovery-only** — companies/workspaces come from `discoverCompanies()`; there
  is no manual "add company" path. For a non-customer build (manually-created
  records), make `clientCatalogCompanyId` nullable and add a hybrid resolver
  fallback to the internal id.

## "View as customer" launch point

The company page carries the optional `customer_preview` capability's launch
point (`<CustomerPreviewLaunch>`) and its `?preview=` notice. Both render
nothing until you enable that capability (`CUSTOMER_PREVIEW_ENABLED=true`), so
they are safe to copy in either way. When you do enable it, also override its
subject seam (`src/modules/customer_preview/config/subject.ts`) to read these
local `Account` / `Workspace` tables instead of calling the catalog per request
— the seam's header shows the exact code. See
[docs/template/capabilities/CUSTOMER_PREVIEW.md](../../../../docs/template/capabilities/CUSTOMER_PREVIEW.md).

## Not included here

The UPC product-catalog layer
(`…/workspaces/[workspaceId]/feeds/[upcFeedId]/item/[externalId]`) and the
`catalog-links.ts` helper ship with the **UPC** capability, not this one.
