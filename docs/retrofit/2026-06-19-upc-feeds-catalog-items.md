# Retrofit prompt — UPC (feeds & catalog-items, canonical-id routing)

> Implements the **2026-06-19 "UPC feeds + catalog-items layer"** entry in
> [`MIGRATION.md`](../../MIGRATION.md).
>
> **Optional capability.** Adds the product-catalog layer (feeds → items) under a
> workspace, for apps that work with Mapp product feeds (e.g. fashion/product apps).
>
> **Prerequisites (do these first, in order):** App-Router + routing convention →
> internal root CA → shared internal-API `s2s` credential → **Client Catalog
> (companies/workspaces)**. UPC mounts *under* the Client Catalog workspace routes and
> reuses its resolvers — it cannot be installed without it.
>
> The schema change here is **purely additive** (new tables + nullable columns), so it
> is lower-risk than the Client Catalog migration — but you still **generate, not
> apply**, the migration for review.

---

## How to use this prompt

1. Pull a **fresh copy of `labs-app-template`** into a separate directory.
2. Open **your app** in your agent.
3. Replace `<TEMPLATE_PATH>` below, then paste **PROMPT START** → **PROMPT END**.

```
<TEMPLATE_PATH> = /absolute/path/to/your/fresh/labs-app-template
```

---

## PROMPT START

You are adding the template's **UPC (Unified Product Catalog)** layer to the **current
project** (an existing Mapp Labs app): product **feeds** and their **catalog items**,
under each Client Catalog workspace, addressed by canonical external ids
(`Feed.upcFeedId`, `ProductCatalog.externalId`):

    /admin/companies/[companyId]/workspaces/[workspaceId]/feeds/[upcFeedId]/item/[externalId]

The authoritative reference is a fresh checkout of `labs-app-template` at:

    <TEMPLATE_PATH>

If that path is the literal placeholder, empty, or not a `labs-app-template` checkout
(no `prisma/schema/upc.prisma.example`, no `src/modules/upc/scaffold/`), **stop and ask
me for the correct path.** Also remind me to have pulled the **latest** template, and
tell me its version.

### Who I am

Assume I may **not** be a developer and cannot run migrations or AWS commands myself.
**You** own the git branch and **generate** migrations for review — never apply them.
Explain everything in plain language.

### Is this for my app? (read me first)

UPC is for apps that consume **Mapp product feeds** (product/fashion catalogs). If this
app has no product-feed use case, skip it. If it does, it **requires the Client Catalog
capability to already be installed** (companies/workspaces routes + resolvers) — if that
isn't done, stop and tell me to run the Client Catalog retrofit first.

### Operating principles (read before touching anything)

1. **The template is the reference design, not a literal source to copy.** Match its
   model/conventions; adapt to this app. **No equivalent paradigm → lean toward the
   template's reference architecture.**
2. **Above all, do not break this app.** Safest partial change over a risky full one.
3. **Copy verbatim only where clearly safe;** otherwise port the *pattern*.
4. **Surface every deviation** and why.
5. **My libraries may differ;** adapt to what's here.
6. **Reuse shared infrastructure — never duplicate per app** (UPC authenticates via the
   shared `s2s` credential, **not** a UPC-specific Basic Auth).
7. **Keep libraries reasonably current — toward this template, not the bleeding edge**
   (supply-chain caution; never bump to newest *public* just because it exists).
8. **When something is genuinely complex/risky/ambiguous and I can't answer, tell me to
   get help — don't guess.** Stop and ask; if I don't know, point me to
   **#topic-mapp-labs** / **#topic-ai-support**.
9. **Converge to the reference architecture, and clean up what you replace — scoped to
   this app, never overreaching.** Propose AWS/SSM cleanup as reviewable scoped
   commands; never auto-delete or touch shared infra / other apps.

### Step 0 — Branch, verify prerequisites, assess

1. Create a git branch (e.g. `retrofit/upc`). All work goes here.
2. **Verify prerequisites are present:** the Client Catalog capability (the `Workspace`
   model + `/admin/companies/[companyId]/workspaces/[workspaceId]` routes +
   `src/lib/admin/account-routing.ts` + `company-links.ts`), plus routing convention,
   internal root CA, and the shared internal-API provider. If Client Catalog isn't
   installed, **stop and tell me to run that retrofit first.**
3. Read, in the template: `docs/template/capabilities/UPC.md`, `docs/template/ROUTING.md`,
   `src/modules/upc/scaffold/README.md`, `prisma/schema/upc.prisma.example`, the module
   lib (`src/modules/upc/lib/` — `client.ts`, `streaming.ts`, `types.ts`), and the
   **2026-06-19** UPC entry in `MIGRATION.md`.
4. In **this** app, check for any **existing UPC integration** — especially an older
   one using **Basic Auth** (`UPC_API_USERNAME` / `UPC_API_PASSWORD`). If present, it
   gets repointed to the shared provider and those creds cleaned up (below). If absent,
   this is a clean additive install.

### Step 1 — Module lib

Bring in `src/modules/upc/lib/` (`client.ts`, `streaming.ts`, `types.ts`) matching this
app's layout. It must authenticate via the **shared internal-API provider**
(`internalApiFetch`, Bearer + 401 refresh-and-retry) — **not** Basic Auth. If this app
had an older Basic-Auth UPC client, repoint it and remove `UPC_API_USERNAME` /
`UPC_API_PASSWORD`. Bring the tests; make them pass.

### Step 2 — Schema migration (additive; GENERATE — do NOT apply)

Apply `prisma/schema/upc.prisma.example` **after** the Client Catalog fragment:
- Add to `Workspace`: `upcCompanyId Int?`, `upcWorkspaceId Int?`, `feeds Feed[]`,
  `@@index([upcCompanyId])`.
- New `Feed` model: `upcFeedId @unique` (route key), `workspaceId` FK
  (`onDelete: Cascade`), `feedDataType` (SOURCE|ENRICHED|COMBINED), `upcLocale`, etc.
- New `ProductCatalog` model: `feedId` FK, denormalized `workspaceId`, `externalId`,
  `@@unique([feedId, externalId])` (items unique **per feed**), raw `data Json`,
  `rowHash` for dedup, indexes.

This is **additive** (new tables + nullable columns) — no data backfill or destructive
reconciliation. Still: **generate** the migration, **do not run it**, and leave it for
review.

### Step 3 — Scaffold copy-in

Copy the 9 scaffold files to their destinations per
`src/modules/upc/scaffold/README.md` (drop `.example`), adapting to this app:
- `lib/catalog-links.ts` (deep-link helper — `feedPath` / `feedItemPath` + `feedHref` /
  `catalogItemHref`; every product display links via these, keyed on canonical ids with
  `externalId` shown), `lib/feed-routing.ts` (boundary resolvers — `resolveFeedByUpcFeedId`
  always selects `workspaceId`; item→feed scope), `lib/upc-catalog-actions.ts`
  (`syncWorkspaceFeeds`, `pullFeedProducts`).
- The `…/feeds/[upcFeedId]/item/[externalId]` routes, **including the passthrough
  `layout.tsx` at both the workspace and feed segments** (required so Next mounts the
  layout-router for the deeper routes).
- Note: any query feeding a product-display component must select
  `clientCatalogCompanyId`, `clientCatalogWorkspaceId`, `upcFeedId`, and `externalId`.

### Step 4 — Wire the entry point

Add a **"Feeds"** link to the Client Catalog **workspace detail page**
(`src/app/admin/companies/[companyId]/workspaces/[workspaceId]/page.tsx` from the
Client Catalog scaffold), pointing at `feedsPath(companyId, workspaceId)`.

### Step 5 — Env + cleanup

- **Wire `UPC_API_BASE_URL` into the container — two parts, both required.** A value in
  SSM alone is invisible to the app: the container only receives an env var that
  `stack.ts` explicitly injects (there is no runtime SSM fetch in `docker-entrypoint.sh`).
  So:
  1. **Infra wire (`infra/lib/stack.ts`):** add `UPC_API_BASE_URL` to the ECS task
     definition's `secrets:` block, next to the existing `INTERNAL_API_*` entries, using
     the same pattern:
     ```ts
     UPC_API_BASE_URL: ecs.Secret.fromSsmParameter(
       ssm.StringParameter.fromSecureStringParameterAttributes(this, "UpcApiBaseUrl", {
         parameterName: `/${prefix}/UPC_API_BASE_URL`,
       }),
     ),
     ```
     (The execution role already has `ssm:GetParameter*` on `/${prefix}/*`, so no IAM
     change is needed.)
  2. **SSM value (human step, staging-first):** create the parameter with the internal
     product-feed-service base URL, e.g.
     `aws ssm put-parameter --name /<appName>-stg/UPC_API_BASE_URL --type SecureString
     --value 'http://product-feed-service.ingress.int.k8s.muc.domeus.com:8080'`.
     Include this in the handback as a command for me to run — do not invent/guess the
     host if you're unsure; ask.
  - Use the name **`UPC_API_BASE_URL`** (what `src/modules/upc/lib/client.ts` reads).
    Some older apps (FTL) call this `UPC_INTERNAL_BASE_URL` — that's their local name;
    match this template's `UPC_API_BASE_URL`. Auth uses the shared `INTERNAL_API_*`
    credential (from the prerequisite retrofit). **Do not** add
    `UPC_API_USERNAME` / `UPC_API_PASSWORD`.
  - **Reachability prerequisite:** `product-feed-service` is an internal host reachable
    only over the Transit Gateway. If this app is still on a standalone (non-TGW) VPC —
    e.g. `mapp-labs-vpc-OLD` — the URL will not resolve/route no matter how it's wired.
    Point me at the **shared-VPC migration** retrofit
    (`docs/retrofit/2026-03-25-shared-vpc-migration.md`) first if so.
- If an old Basic-Auth UPC integration existed, produce a **reviewable list** of this
  app's now-obsolete per-app SSM/env params + exact scoped delete commands for a human
  to run. **Never** auto-delete; never touch shared params or other apps.

### Step 6 — Data + import (human/admin steps, after the migration runs)

- For each workspace to sync, set `Workspace.upcCompanyId` (the Product Feed Service
  company id — see UPC.md's feed-to-workspace mapping if it differs from the
  client-catalog company id).
- Then from a workspace's `…/feeds` page: **Sync feeds**, then open a feed and **Pull
  from UPC** to import products. The template stores raw `data`; add the product fields
  and transforms this app needs.

### Verify and hand back

- Run typecheck, lint, tests; fix what your changes broke. (Scaffold pages compile only
  after the UPC + Client Catalog fragments are applied — note the generated migration
  must run before a full typecheck of those pages passes.)
- **Do not deploy, do not run the migration, do not run AWS commands.**

### Record state

Before the handback, write/update **`.retrofit-state.json` at this app's repo root**
(create it if absent), following `<TEMPLATE_PATH>/docs/retrofit/RETROFIT-STATE.md`.
Upsert this retrofit under `retrofits["2026-06-19-upc-feeds-catalog-items"]` with
`status` (applied / partial / skipped / not-applicable), `templateVersion` +
`templateRef` (the template version and exact git tag/SHA you worked against), an
ISO-8601 UTC `at` (`date -u +%Y-%m-%dT%H:%M:%SZ`), `by`, `notes` + any `deviations`, and
`capability: "upc"`. Refresh `template.lastRetrofitAgainstVersion` /
`lastRetrofitAgainstRef` / `lastRetrofitAt`; don't remove other entries.

Then give me a **plain-language handback**:
1. What you changed (module lib, additive schema, scaffold routes, "Feeds" link, env).
2. Whether there was an **old Basic-Auth UPC** to repoint, and what you cleaned up.
3. The **generated migration** (additive — lower risk, still review-before-run).
4. The **human steps**, in order: review & run the migration → put `UPC_API_BASE_URL` in
   SSM (the `stack.ts` wire is already in your code change) +
   confirm `INTERNAL_API_*` → set each `Workspace.upcCompanyId` → **Sync feeds** →
   **Pull from UPC** → review & run any scoped SSM cleanup → deploy staging-first.
5. Every **deviation** from the template and why.
6. If anything got complicated and I didn't have an answer, remind me I can ask in
   **#topic-mapp-labs** / **#topic-ai-support**.

## PROMPT END
