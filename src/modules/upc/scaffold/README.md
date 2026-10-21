# UPC — Feeds & catalog-items admin scaffold

These `.example` files add the **product-catalog layer** under a workspace:

```
/admin/companies/[companyId]/workspaces/[workspaceId]/feeds/[upcFeedId]/item/[externalId]
```

They build on the **client_catalog** capability (UPC depends on it) — the
companies/workspaces routes, `account-routing.ts` resolvers, and
`company-links.ts` must already be installed. See
[docs/template/capabilities/UPC.md](../../../../docs/template/capabilities/UPC.md) and
[docs/template/ROUTING.md](../../../../docs/template/ROUTING.md).

`.example` because they reference the `Feed` / `ProductCatalog` models from
`prisma/schema/upc.prisma.example`, present only after you apply that fragment.

## Install

1. Apply `prisma/schema/upc.prisma.example` (after client_catalog's) and
   `npx prisma migrate dev && npx prisma generate`.
2. Set the `Workspace.upcCompanyId` for each workspace you sync (the Product Feed
   Service company id). Set `UPC_API_BASE_URL` + the shared `INTERNAL_API_*`
   credential.
3. Copy these files (drop `.example`):

   | scaffold file | destination |
   |---|---|
   | `lib/catalog-links.ts.example` | `src/lib/admin/catalog-links.ts` |
   | `lib/feed-routing.ts.example` | `src/lib/admin/feed-routing.ts` |
   | `lib/upc-catalog-actions.ts.example` | `src/lib/actions/admin/upc-catalog-actions.ts` |
   | `app/companies/[companyId]/workspaces/[workspaceId]/feeds/page.tsx.example` | same path under `src/app/admin/` |
   | `app/.../feeds/FeedsClient.tsx.example` | same path under `src/app/admin/` |
   | `app/.../feeds/[upcFeedId]/layout.tsx.example` | same path under `src/app/admin/` |
   | `app/.../feeds/[upcFeedId]/page.tsx.example` | same path under `src/app/admin/` |
   | `app/.../feeds/[upcFeedId]/PullFromUpcForm.tsx.example` | same path under `src/app/admin/` |
   | `app/.../feeds/[upcFeedId]/item/[externalId]/page.tsx.example` | same path under `src/app/admin/` |

4. Add a "Feeds" link to the workspace detail page (the client_catalog scaffold's
   `workspaces/[workspaceId]/page.tsx`) pointing at `feedsPath(companyId, workspaceId)`.
5. From a workspace's `…/feeds` page: **Sync feeds**, then open a feed and
   **Pull from UPC** to import products.

## Conventions baked in

- **Canonical external ids** — feed = `Feed.upcFeedId`, item = `ProductCatalog.externalId`.
  Items are unique **per feed** (`@@unique([feedId, externalId])`).
- **Boundary resolvers** (`feed-routing.ts`) scope feed→workspace and item→feed,
  with the always-select guardrail (`resolveFeedByUpcFeedId` always selects
  `workspaceId`).
- **Passthrough layouts** at both the workspace and feed segments (they have child
  routes) — required so Next mounts the layout-router for deeper routes.
- **Deep-link helper** `catalog-links.ts` (`feedPath` / `feedItemPath` +
  `feedHref` / `catalogItemHref`). Every product display links via these, keyed
  off the canonical ids, with `externalId` as the displayed identifier. Any query
  feeding a product-display component must select `clientCatalogCompanyId`,
  `clientCatalogWorkspaceId`, `upcFeedId`, and `externalId`.

## Lean by design

The item detail shows raw product `data` only — no FTL-specific trends/taxonomy.
Add the product fields and transforms your app needs.
