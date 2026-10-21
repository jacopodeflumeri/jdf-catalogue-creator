# Admin Routing Convention — Canonical External IDs

The template's convention for admin routes that expose records sourced from
external Mapp systems (client catalog, UPC): **identify records in the URL by
their canonical cross-system external id, never by the internal autoincrement
primary key.**

- Company ⇔ client-catalog `companyId` → `/admin/companies/[companyId]`
- Workspace ⇔ client-catalog `workspaceId` → `…/workspaces/[workspaceId]`
- Catalog item ⇔ UPC `externalId` → `…/feeds/[upcFeedId]/item/[externalId]`

Internal ids stay server-side. External ids are stable across re-imports/discovery,
match the terminology of the source systems, and don't leak DB internals.

> The base template ships the **convention + the `parseRouteId` helper** only
> (`src/lib/admin/route-ids.ts`). The actual companies/workspaces routes,
> schema columns, and boundary resolvers ship with the **client_catalog**
> capability (and the catalog-item layer with **UPC**). See
> [capabilities/CLIENT_CATALOG.md](capabilities/CLIENT_CATALOG.md).

## The two rules

1. **Parse + `notFound()` at the boundary.** Parse the dynamic segment with
   `parseRouteId(segment)`; if it returns `null`, call `notFound()`.

2. **Scope-field guardrail.** A boundary resolver that does a post-fetch scope
   check — e.g. "does this workspace belong to this company?"
   (`workspace.companyId === companyId`) — **MUST always `select` that scope
   field itself**, regardless of any caller-passed `select`. If you omit it, the
   field comes back `undefined`, the check fails, the resolver returns `null`,
   and the page renders a spurious `notFound()`/404. Always merge the scope
   field into the select:

   ```ts
   const select = opts?.select
     ? { ...opts.select, companyId: true } // force the scope field
     : undefined;
   ```

## Why `notFound()`/`redirect()` must reach the framework

Boundary resolvers call `notFound()` (and some flows `redirect()`), which work by
**throwing** a control-flow signal that Next catches to render a 404 / perform a
redirect. Any custom React error boundary that catches everything will swallow
these and render its generic fallback instead.

So every custom error boundary re-throws control-flow signals via
`isNextControlFlowError()` (`src/lib/utils/next-errors.ts`) — see
`AdminErrorBoundary` / `AuthErrorBoundary`. Server-side render errors are logged
by `onRequestError` (`src/instrumentation.ts`), and the admin segment has a
graceful `src/app/admin/error.tsx` retry boundary.

## Server-render the page, don't gate it on the client session

Admin route `{children}` must **always** be rendered by the layout. Auth is
enforced server-side in `src/app/admin/layout.tsx` (`requireAdmin()`); the client
shell (`AdminLayoutClient`) renders the chrome (sidebar/topnav) and reflects
session state there, but never withholds `{children}` while the client session is
`loading` — otherwise nothing server-renders (SSR session status is always
`loading`), breaking deep nested routes, SEO, and TTFB.
