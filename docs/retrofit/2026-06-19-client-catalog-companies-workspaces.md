# Retrofit prompt — Client Catalog (companies & workspaces, canonical-id routing)

> Implements the **2026-06-19 "Companies/workspaces admin moved into the client_catalog
> capability"** entry (and the canonical-id routing it builds on) in
> [`MIGRATION.md`](../../MIGRATION.md).
>
> **Soft-mandatory.** Listed as an optional capability, but the template's **future
> direction assumes the companies / workspaces / access model is in place**. If your
> app deals with companies/workspaces at all, converge to this — declining accrues
> divergence debt that later updates will force you to pay.
>
> **Prerequisites (do these first):** the **App-Router + routing convention** retrofit
> (`parseRouteId`, error-boundary re-throw), the **internal root CA**, and the **shared
> internal-API `s2s` credential** retrofits. This capability's client authenticates via
> that credential and its routes use that routing convention.
>
> **This retrofit changes the database and replaces UI. It is the riskiest in the
> chain.** It generates — but does not apply — a schema + data migration for review.

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

You are converging the **current project** (an existing Mapp Labs app) onto the
template's **Client Catalog** model: companies and workspaces discovered from Mapp's
Company Management Service (GUM), addressed in admin URLs by their **canonical external
ids** (`clientCatalogCompanyId` / `clientCatalogWorkspaceId`), never internal primary
keys.

The authoritative reference is a fresh checkout of `labs-app-template` at:

    <TEMPLATE_PATH>

If that path is the literal placeholder, empty, or not a `labs-app-template` checkout
(no `prisma/schema/client_catalog.prisma.example`, no
`src/modules/client_catalog/scaffold/`), **stop and ask me for the correct path.** Also
remind me to have pulled the **latest** template, and tell me its version.

### Who I am

Assume I may **not** be a developer and cannot run database migrations or AWS commands
myself. **You** own the git branch and **generate** migrations for review — you never
apply them. Explain everything in plain language.

### Is this for my app? (read me first)

This applies if the app has any notion of **companies/customers and their workspaces**.
The template's future updates assume this model, so:
- If the app has companies/workspaces (almost all do), **converge** — pick the build
  type below.
- If the app genuinely has **no** companies concept at all, this may not apply — tell
  me that, and stop.
- If I want to **decline** despite having companies, **warn me clearly** that I'm
  accruing divergence debt (future template changes assume this model) and that I'll
  likely be told to converge later. Don't let me decline casually.

### Operating principles (read before touching anything)

1. **The template is the reference design, not a literal source to copy.** Match its
   model/conventions; adapt to this app. **No equivalent paradigm here → lean toward
   the template's reference architecture.**
2. **Above all, do not break this app.** Safest partial change over a risky full one.
3. **Copy verbatim only where clearly safe;** otherwise port the *pattern*.
4. **Surface every deviation** and why.
5. **My libraries may differ;** adapt to what's here.
6. **Reuse shared infrastructure — never duplicate per app** (the `s2s` credential, etc.).
7. **Keep libraries reasonably current — toward this template, not the bleeding edge**
   (supply-chain caution; never bump to newest *public* just because it exists).
8. **When something is genuinely complex/risky/ambiguous and I can't answer, tell me to
   get help — don't guess.** Stop and ask; if I don't know, point me to
   **#topic-mapp-labs** / **#topic-ai-support**.
9. **Converge to the reference architecture, and clean up what you replace — scoped to
   this app, never overreaching.** Converge the *model and piping* firmly even where the
   current setup "works"; be conservative with entangled UI (below). Propose AWS/SSM
   cleanup as reviewable scoped commands — never auto-delete, never touch shared infra
   or other apps.

### Step 0 — Branch, verify prerequisites, assess

1. Create a git branch (e.g. `retrofit/client-catalog`). All work goes here.
2. **Verify the prerequisites are present** in this app: the routing convention
   (`src/lib/admin/route-ids.ts` / `parseRouteId` + custom error boundaries that
   re-throw Next control-flow signals), internal root CA trust, and the shared
   internal-API provider (`src/lib/internal-api/`). If any is missing, **stop and tell
   me to run those retrofits first** (App-Router + routing convention → internal root
   CA → shared internal-API credential).
3. Read, in the template: `docs/template/capabilities/CLIENT_CATALOG.md`, `docs/template/ROUTING.md`,
   `src/modules/client_catalog/scaffold/README.md`,
   `prisma/schema/client_catalog.prisma.example`, the module lib
   (`src/modules/client_catalog/lib/` — `client.ts`, `discovery.ts`, `types.ts`), and
   the two **2026-06-19** entries in `MIGRATION.md` (routing base + client_catalog).
4. In **this** app, find the current reality: the existing `Account` model (and any
   `Workspace`/`company`/`accounts` model), the existing accounts/companies **admin
   routes** and any **manual "add account/company"** UI, how records are addressed in
   URLs (internal id vs external), and whether there's existing **data**. Write a short
   plain-words assessment of the current shape vs the target.

### Step 1 — Determine the build type (ASK me, don't assume)

The schema and scaffold differ by build type. **Ask me which this app is** (you may
propose an answer from what you found, but confirm it):

- **Customer build (most apps):** companies come from Client Catalog **discovery**.
  `Account.clientCatalogCompanyId` is **required + unique** (the route key); there is
  **no manual add** — records come only from `discoverCompanies()`.
- **Hybrid / prospect build (a few apps):** some companies are **not** in the Client
  Catalog (e.g. prospects) and are **created by hand**. `clientCatalogCompanyId` is
  **nullable + unique**, a **manual-add path stays**, and the boundary resolver
  **falls back to the internal id** when the external id is absent.

### Step 2 — Module lib

Bring in `src/modules/client_catalog/lib/` (`client.ts`, `discovery.ts`, `types.ts`)
matching this app's layout. It must authenticate via the **shared internal-API
provider** (`internalApiFetch`) from the prerequisite retrofit — not a
client-catalog-specific OAuth/Basic credential. Bring the tests; make them pass.

### Step 3 — Schema + data migration (ASSESS, PROPOSE, GENERATE — do NOT apply)

This is the risky part. Reconcile the fork's current schema to the canonical fragment:

- Add to `Account`: `clientCatalogCompanyId` (`Int @unique` for customer, `Int?
  @unique` for hybrid), `salesforceId String?`, `clientCatalogData Json?`,
  `workspaces Workspace[]`. Add the `Workspace` model exactly as in
  `client_catalog.prisma.example` (route key `clientCatalogWorkspaceId @unique`, scope
  + relation key `clientCatalogCompanyId`, `onDelete: Cascade`, `@@index`, `@@map`).
- **If the fork has an older/divergent shape** (e.g. an `externalWorkspaceId` column, a
  home-grown company/workspace model, internal-id-only accounts), map it onto the
  canonical shape — including any **column renames** and a **data-backfill plan** for
  existing rows (e.g. populate `clientCatalogCompanyId` by matching discovery results).
- **Generate** the migration but **do NOT run it** against any database. Write the
  data-backfill steps explicitly. **Flag this loudly** as requiring review by someone
  technical (and possibly labs-platform) before it runs — it can be destructive.
- Future template changes assume this model is adopted. If I'm hesitating, restate the
  divergence-debt warning rather than quietly producing a half-measure.

### Step 4 — Scaffold copy-in

Copy the 8 scaffold files to their destinations per
`src/modules/client_catalog/scaffold/README.md` (drop the `.example` suffix), adapting
to this app's structure:
- `lib/company-links.ts`, `lib/account-routing.ts` (boundary resolvers —
  `resolveCompanyByCompanyId`, `resolveWorkspaceByWorkspaceId` with the **scope-field
  guardrail**: always `select` `clientCatalogCompanyId`), `lib/company-admin-actions.ts`,
  and the `/admin/companies[/...]` routes incl. the passthrough workspace `layout.tsx`.
- **Build type matters here:** for hybrid, keep the manual-add path and the resolver's
  internal-id fallback; for customer, discovery-only.

### Step 5 — Nav

Add a "Companies" entry to this app's admin nav (template:
`{ name: "Companies", href: "/admin/companies", icon: "users" }`), adapting to how this
app defines navigation.

### Step 6 — Replace the old accounts admin (converge piping firmly; preserve entangled UI)

- **Converge the piping:** remove this app's **internal-id accounts routes** and any
  **manual add-account UI** (unless hybrid, which keeps a manual-add path), in favor of
  discovery + the canonical-id routes.
- **Preserve entangled features:** some CRM bits may be intertwined with **kept**
  features (e.g. a shared `MemberCard`, a `/admin/mapp-team` page, an
  `AccountDetailLayout` context). **Do not break those.** If a component is shared with
  a kept feature, leave it (even if now reachable only from there) and note it rather
  than ripping it out. When unsure whether something is safe to remove, ask me / Slack.

### Step 7 — Env + optional integration

- Set `CLIENT_CATALOG_BASE_URL`. Auth uses the shared `INTERNAL_API_*` credential (from
  the prerequisite retrofit); the QA-only `CLIENT_CATALOG_BASIC_*` is an optional
  fallback. Don't reintroduce a client-catalog-specific OAuth trio.
- **If this app has Company Login (the 2026-06-10 auth work) enabled:** this is where
  you wire the `resolveAccountIdForCompany(companyId)` seam to look up
  `Account.clientCatalogCompanyId`. Optional — only if Company Login is present.

### Clean up — scoped, no overreach (propose, don't auto-delete)

If the old accounts admin had its own per-app SSM/env config that's now obsolete,
produce a **reviewable list** of this app's params + exact scoped delete commands for a
human to run. **Never** delete anything yourself; never touch shared params or other
apps.

### Verify and hand back

- Run typecheck, lint, tests; fix what your changes broke. (Scaffold pages compile only
  after the schema fragment is applied — note that the generated migration must be run
  before a full typecheck of those pages passes.)
- **Do not deploy, do not run the migration, do not run AWS commands.**

### Record state

Before the handback, write/update **`.retrofit-state.json` at this app's repo root**
(create it if absent), following `<TEMPLATE_PATH>/docs/retrofit/RETROFIT-STATE.md`.
Upsert this retrofit under `retrofits["2026-06-19-client-catalog-companies-workspaces"]`
with `status` (applied / partial / skipped / not-applicable), `templateVersion` +
`templateRef` (the template version and exact git tag/SHA you worked against), an
ISO-8601 UTC `at` (`date -u +%Y-%m-%dT%H:%M:%SZ`), `by`, `notes` + any `deviations`, and
`capability: "client_catalog"`. Record the **build type** (customer/hybrid) in `notes`.
Refresh `template.lastRetrofitAgainstVersion` / `lastRetrofitAgainstRef` /
`lastRetrofitAt`; don't remove other entries.

Then give me a **plain-language handback**:
1. The **build type** (customer vs hybrid) we chose and why.
2. What you changed (module lib, schema, scaffold routes, nav, removed/kept admin UI).
3. The **generated migration + data-backfill plan**, with the destructive-risk callout
   and that it must be reviewed and run by someone technical.
4. Anything you **kept** because it was entangled with a still-used feature.
5. The **human steps**, in order: review & run the migration/backfill → set
   `CLIENT_CATALOG_BASE_URL` + confirm `INTERNAL_API_*` → run **discovery** from
   `/admin/companies` to populate companies/workspaces → review & run any scoped SSM
   cleanup → deploy staging-first.
6. Every **deviation** from the template and why.
7. If anything got complicated and I didn't have an answer, remind me I can ask in
   **#topic-mapp-labs** / **#topic-ai-support**.

## PROMPT END
