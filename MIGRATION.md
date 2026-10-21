# Migration Notes

Upgrade instructions for projects that forked this template at various points in time. **Entries are ordered newest first.** To bring an existing fork up to date, find the entries dated *after* your fork date and apply them in order from oldest to newest.

If you don't know your fork date, check `git log --reverse --format='%aI' | head -1` in your project repo — the first commit's date is a safe lower bound.

**Prefer to have an agent do it?** Download the latest template into a separate
directory, open your app in a coding agent, and use the orchestrator prompt at
[`docs/retrofit/START-HERE.md`](docs/retrofit/START-HERE.md) — it figures out which of
the entries below apply to your fork and applies them one at a time. Individual
agent-runnable prompts for the more involved entries live in
[`docs/retrofit/`](docs/retrofit/).

---

## 2026-10-17 — Template cleanup: orphaned CRM/Salesforce code and dead helpers removed

**Informational — nothing to do.** Forks are **not** required to remove anything.
The template simply no longer ships the code below. If your app uses any of it
(many apps built or rebuilt account pages on it), **keep your copy** — it is yours
now, and nothing else in the template depends on it. No schema change, no env/SSM
change, no deploy step. `Account.sfAccountId` is unchanged.

### What the template no longer ships

- **Account-detail CRM UI:** `AccountDetailLayout` (+ `useAccountDetailSafe`), the
  Stage-update / Account-edit / Contact / Magic-link / Send-email / Mapp-team /
  Add-account / Matching-key modals, `DomainManager`, `UnsynchronizedContactsList`,
  `ADMIN_ACCOUNT_MENU_ITEMS` / `SubMenuItem` / `filterSubMenuItems`, and the account
  CRUD server actions in `admin-actions.ts` that only they called. `MemberCard` stays;
  its magic-link/email buttons (which needed that layout's context) are gone.
- **Salesforce integration:** `src/lib/salesforce/**`, `/api/admin/salesforce`,
  `useSalesforce`, `salesforce-utils`, `salesforce-actions`,
  `components/admin/salesforce/**`, `config.salesforce`, `SALESFORCE_*` env parsing,
  and the `canViewSalesforce` / `canManageSalesforce` permissions.
  `validateEnvironmentSecurity()` no longer reports a missing
  `SALESFORCE_CLIENT_SECRET` as an error. If your app keeps this integration, note
  that the template's `/api/admin/salesforce` route let any viewer-level admin run
  an arbitrary query when `SALESFORCE_ENABLED=true`, and `releaseReviewContact`
  built its query with an unescaped email — worth tightening in your copy.
- **Unused helpers and files:** `useAdminAction`, `useAccountActivityLogs`,
  `template-variables`, `api-monitoring`, `chart-data`, `data-transformers`,
  `url-download-actions`, `AdminUserProfileCard`, `SidebarTopNav`,
  `NavigationLoadingOverlay` (a no-op), `lib/security/enhanced-logging`
  (`logSecurityEvent` — use the app logger), `connectDB()` / `disconnectDB()`, the
  never-wired Microsoft Graph sync modal on `/admin/user`,
  `test/fixtures/seed-data.ts`, and dead types (`AdminAccountData`,
  `SubscriptionData`, the dashboard types, …).
- **Unused config keys:** `app.supportEmail` (`SUPPORT_EMAIL`), `auth.redirectUrls`,
  `database.*` (`DIRECT_DATABASE_URL`), `build.enableSourceMaps`, and Google
  Analytics (`analytics.googleAnalyticsId`, `NEXT_PUBLIC_GA_MEASUREMENT_ID` — no GA
  script ever shipped). `ENABLE_SOURCE_MAPS` / `npm run build:debug` still work.

### Small behaviour change

- `/admin/ldap-groups-example` is now gated like `/admin/auth-debug`: available
  outside production, 404 in production unless `AUTH_DEBUG_ENABLED=true`. Copy the
  `notFound()` guard from the template's page if you want the same.

### Docs

- `docs/template/DESIGN-SYSTEM.md` §11 — an inventory of every `src/components/ui`
  component and when to use it.

### Optional cleanup (only if you confirm it's unused in YOUR app)

If `grep` shows your app never imports one of the files above, you may delete it.
Re-check `*.example` scaffolds and your own docs first. When in doubt, leave it.

---

## 2026-10-17 — Template cleanup: CSP, unused dependencies, Node 22

**Informational.** Forks are not required to change anything; remove a dependency
only if your app doesn't use it. One optional infra change (below).

- **CSP (`next.config.ts`)** pruned to hosts the template uses. Removed: Tailwind
  CDN, Vercel analytics, HubSpot, an n8n webhook host, Salesforce,
  `storage.googleapis.com`, Google Tag Manager, Google Fonts (`next/font`
  self-hosts), Microsoft login/Graph (page navigation / server-side only), and
  `*.mapp.com` frames. **Added** `cdn.jsdelivr.net` to `script-src`/`style-src` —
  Swagger UI (`public_api`) loads from it and was previously blocked. If your app
  embeds third-party forms, analytics or iframes, keep the hosts it needs.
  `serverExternalPackages: ["nodemailer"]` removed (nodemailer was never a
  dependency).
- **Dependencies removed from the template:** `axios`, `@hello-pangea/dnd`,
  `@testing-library/user-event`, `ts-jest` (+ the `globals['ts-jest']` block in
  `jest.config.ts`), `autoprefixer` (+ its `postcss.config.mjs` entry; Tailwind v4
  prefixes itself), `swagger-ui-dist` (Swagger UI comes from the CDN). Keep any
  your app imports. `ts-node` stays at the root (jest loads `jest.config.ts` with
  it on Node < 22.18).
- **infra:** `ts-node` added to `infra/package.json` devDependencies (`cdk.json`
  runs `npx ts-node`; it previously resolved from the root by accident).
  `NEXT_PUBLIC_APP_URL` is no longer injected into the ECS task definition — nothing
  read it, and a runtime `NEXT_PUBLIC_*` value never reaches client bundles anyway.
  Optional for forks: removing it shows up in `make <env>-infra-diff` as one
  environment entry removed and rolls a new task-definition revision on
  `make <env>-infra-deploy`. Leaving it is harmless.
- **Node 22:** `engines` `>=22.12.0` (root + infra; Prisma 7's floor on the 22
  line), `.nvmrc` = `22`, `@types/node` `^22`, and `make dev-check-prerequisites` /
  `setup.sh` require 22+. `scripts/deploy/deploy-infra.sh` now accepts any 22.x
  (it used to exit on machines without exactly 22.16.0) and stops with a clear
  error below 22. **AWS impact: none.** The Docker image was already
  `node:22.16.0`; the synthesized CloudFormation for both environments is
  byte-identical apart from CDK's analytics metadata recording the Node version
  used for synth; infra has no Lambda, custom resource or CodeBuild runtime.
- **Housekeeping:** `.dockerignore` now excludes `tmp/` (where
  `make dev-pull-config-dump` writes production config dumps), `.claude/`,
  `private/`, `test/`, `docs/`. Deleted `.vscode/` (Windows-only tasks calling
  scripts that no longer exist), `.github/copilot-instructions.md` (stale;
  `AGENTS.md` covers it), `tailwind.config.ts` (never loaded under Tailwind v4),
  `public/sitemap.xml`, `private/email/auth-generator.ps1` (`.env.example` shows
  the `printf 'user:pass' | base64` one-liner for `ENGAGE_AUTH_TOKEN`).
  `.env.example` drops `NEXT_PUBLIC_APP_URL`, `SUPPORT_EMAIL` and the Salesforce
  block, and documents `ALLOWED_ORIGINS`, `KEYCLOAK_CA_PEM`, `DATABASE_URL_TEST`.
  `.gitignore` ignores `.claude/worktrees/`. `.githooks/pre-push` checks the URL
  actually being pushed to.

---

## 2026-10-17 — Optional capability: Customer Preview ("View as customer")

**Optional — only for apps with Company Login (external company customers).**
Off by default and **inert when off**. Requires the
[customer-side render/scope entry](#2026-10-17--customer-pages-render-from-the-server-session-auth-lookups-once-per-request)
(`getCustomerRequestSession`, `getCustomerPageScope`) to be applied first. **No
schema change, no new secret, no SSM.** Enabling it in AWS needs one CDK change (two
plain env vars on the task definition). Default `make <env>-deploy` for the code.

▶ **Retrofit prompt:** [`docs/retrofit/2026-10-17-customer-preview.md`](docs/retrofit/2026-10-17-customer-preview.md)

### Problem

Admins and support had no faithful way to see what a Company-Login customer sees.
`/auth/admin-view-account` only writes an `accountId` onto the admin's own JWT and
shows the legacy account pages: no company, no workspaces, no eligibility, no expiry,
no audit, and the admin can still write as the customer.

### What changed

New module `src/modules/customer_preview/` (token, cookie constants, start/options
actions, end route at `/admin/customer-preview/end`, subject seam, banner / notice /
launcher components). An admin-level Mapp user (admin access level or SuperAdmin)
opens a company's `/account` pages **as its Company-Login customers see them** —
read-only, 30 minutes, bound to that admin, audited — optionally narrowed to one
workspace. Launch points: `/admin/company-users` (one per company) and the
client_catalog scaffold company page. Full reference:
[`docs/template/capabilities/CUSTOMER_PREVIEW.md`](docs/template/capabilities/CUSTOMER_PREVIEW.md).

**What changes even when the capability is not enabled** (all no-ops without a
preview cookie, and the cookie is not even read while the capability is off):

- **`requireCustomer` overlay hook.** `getCustomerRequestSession`
  (`src/modules/auth/server/require-auth.ts`) now returns `{ session, preview }`:
  admin session + valid preview cookie becomes a synthesized customer session. A
  cookie that no longer verifies redirects to the end route instead of to sign-in.
  During a preview, `requireCustomer` refuses every **server-action** request
  (`CustomerPreviewReadOnlyError`) unless the caller passes `readOnly: true`.
- **`RequireCustomerOptions.readOnly`** and **`getCustomerPageScope({ readOnly })`**
  (the scope memo is now keyed on it). Only for actions that genuinely only read.
- **`session.user.customerPreview`** (`CustomerPreviewSessionInfo` in
  `src/modules/auth/types`) — set only on a preview session, never on the JWT.
- **Usage attribution:** `resolveUsageAttribution` attributes anything metered during
  a preview to the **admin** (`userId`), never the company.
- **Template customer mutations refuse preview sessions** via `assertNotPreview` /
  `isPreviewSession` (`account-actions.ts`, `account-profile-actions.ts`,
  `activity-actions.ts` — magic-link minting, activity rows and page-visit logging
  included). Pinned by `customer-preview-readonly.test.ts`.
- **Audit:** new entity type `company` in `src/modules/audit/entity-types.ts`
  (`customer_preview_start` / `customer_preview_end`). No migration.
- **`CompanyCustomerLayout`** shows the preview banner and swaps **Sign out** for
  **Exit preview** during a preview (signing out there would sign the admin out).
- **Proxy** (`src/proxy.ts`, `allowsCustomerArea`): an admin carrying the preview
  cookie may enter `/account` **pages** — only when the capability is enabled; never
  `/api/account/*`. Customers and the legacy admin-with-`accountId` are unchanged.
- `src/config/index.ts` gains `config.customerPreview` (`enabled` is false unless
  `CUSTOMER_PREVIEW_ENABLED=true` **and** Company Login is on); `scripts/setup.sh`
  option 9; `.env.example` stubs; registry entry.

**Relation to `/auth/admin-view-account`:** for Company-Login apps,
`customer_preview` supersedes it. The legacy page (and `AdminImpersonationBanner`) is
kept **unchanged** for legacy magic-link apps; a valid preview cookie takes precedence.

### To enable it

1. **`.env`**: `CUSTOMER_PREVIEW_ENABLED=true` and `CUSTOMER_PREVIEW_SERVICES=` — the
   comma-separated Keycloak workspace service codes your `customerEligibilityPolicy`
   checks (not client-catalog product names). Empty is right only with the template's
   allow-all policy; get it wrong and every preview lands on `/account/get-started`.
2. **Staging/production:** both are plain, non-secret flags, so they go in the ECS
   task definition **`environment`** block of `infra/lib/stack.ts` (CDK) — **not** in
   SSM / `setup-ssm-params.sh`, which only feed the `secrets` block. That is a CDK
   change: `make <env>-infra-diff`, then `make <env>-infra-deploy`.
   `make <env>-deploy` alone does not change the task definition (it re-pulls the
   image), so the flags would not reach the container.
3. **Review the subject seam** `src/modules/customer_preview/config/subject.ts`
   (`resolvePreviewSubject`). The default reads the client catalog when
   `CLIENT_CATALOG_BASE_URL` is set, otherwise a `company_user` stub with no
   workspaces. If the app keeps companies/workspaces in its own tables, override it
   (the file's header has the code). `accountId` must equal
   `resolveAccountIdForCompany(companyId)`; workspace ids are client-catalog ids.
4. Add `"customer_preview"` to `app.config.json` `enabledCapabilities`.
5. **The read-only rule:** every app-specific customer mutation calls
   `assertNotPreview(session)` before it writes (add it to the read-only test).

### Steps

1. Apply the 2026-10-17 customer-side render/scope entry first.
2. Copy `src/modules/customer_preview/`, `src/app/admin/customer-preview/end/`, and
   port the changes to `require-auth.ts`, `customer-page-scope.ts`,
   `usage-attribution.ts`, `auth/types`, `proxy.ts`, `config/index.ts`,
   `audit/entity-types.ts`, `CompanyCustomerLayout.tsx`, the three template action
   files and the Company Users page; then the tests. `npm run type-check && npm test`.
3. Add `assertNotPreview` to the app's own customer mutations.
4. Ship with the default **`make <env>-deploy`** — there is no migration, so the
   maintenance path is not needed. The capability stays off.
5. To turn it on: the "To enable it" steps, staging first; sign in as an admin, open
   `/admin/company-users`, **View as customer**, check the banner, try a mutation
   (refused), **Exit**, and confirm the start/end rows in `/admin/audit-log`.

---

## 2026-10-17 — Docs layout: `docs/` is the app's, `docs/template/` is the template's

**Optional, docs-only — worth taking.** Docs, code comments and user-facing strings
only: **no code behaviour, no schema, no SSM, no infra, no deploy.** In a catch-up
run, **apply it last**: other retrofit prompts may still name the old doc paths, and
it is easiest to move everything once they are done.

▶ **Retrofit prompt:** [`docs/retrofit/2026-10-17-docs-layout.md`](docs/retrofit/2026-10-17-docs-layout.md)

### Problem

The template's reference docs and an app's own docs sat side by side in `docs/`.
Neither people nor agents could tell which was which, and agents stopped writing app
docs because `docs/` already looked complete.

### What changed

- **Moved to `docs/template/`:** `APP-BRANDING`, `COST_ALLOCATION`, `CUSTOMIZATION`,
  `DEPLOYMENT`, `DESIGN-SYSTEM`, `ENTRA-SETUP`, `INTERNAL-API`, `INTERNAL-CA`,
  `LOCAL-POSTGRES`, `MONITORING`, `PERMISSION-LEVELS`, `ROUTING`;
  `docs/capabilities/` → `docs/template/capabilities/`.
- **Merged:** `KEYCLOAK-SETUP.md` → `docs/template/KEYCLOAK.md`;
  `HACKATHON_QUICKSTART.md` and `KEYCLOAK-URI-AUTO-REGISTRATION.md` into `KEYCLOAK.md`
  and a new `docs/template/TROUBLESHOOTING.md`; `DATA-SYNC.md` into
  `capabilities/DATA_SYNC.md` (the registry's `operationalDocFile` field is gone).
- **Platform-only docs** (labs-platform team, not app owners) →
  `docs/template/platform/` (`COST_TAGGING_PROMPT.md`, `KEYCLOAK-REGISTRAR-SETUP.md`).
  `KEYCLOAK-MIGRATION.md` → `docs/retrofit/`.
- **New:** `docs/README.md` (the app's docs index), `docs/template/README.md` (one line
  per template doc), `docs/template/WINDOWS.md`, and a rewritten cross-platform
  `docs/template/LOCAL-POSTGRES.md`.
- **`AGENTS.md`:** a new **Documenting Your Work** section (one living doc per feature
  area in `docs/`, in the same commit as the code; never edit `docs/template/` outside
  a retrofit), an empty **App Notes and Pitfalls** section for the app's own
  cross-cutting pitfalls, and versioning guidance that defaults to
  `make version-patch`. The template only ever bumps patch (`1.0.x`); an app's first
  `version-minor` (`1.1.0`) marks that it has moved past the template. All doc paths
  now point into `docs/template/`.
- **`.github/copilot-instructions.md` removed.** It was out of date (Next.js 15,
  Salesforce pages) and duplicated `AGENTS.md`, which Copilot also reads. Forks can
  delete theirs, or keep it only if it holds app-specific instructions.
- **Corrections in `AGENTS.md`:** the `HOSTNAME_OVERRIDE=localhost:3003 …
  register-keycloak-uris.sh` recipe is removed — **the script never supported it**; it
  registers `https://` hostnames only, so a fourth localhost port cannot be added (use
  3000–3002). Also: `package-lock.json` is committed (not gitignored), and `setup.sh`
  no longer pre-populates Azure AD credentials.

### Steps

Run the retrofit prompt. It classifies each doc against the template and asks when
unsure; template docs are **moved, not refreshed** (their content keeps matching
*this* app's code), and app-written sections inside template docs move out to app
docs. Verify with a relative-link check over the moved files.

---

## 2026-10-17 — Customer pages render from the server session; auth lookups once per request

**Applies to every fork with the `/account` customer area.** The scope helpers
(`getCustomerPageScope`) need the Company Login pieces from the 2026-06-10 Keycloak
company-context retrofit (`evaluateCustomerEligibility`, `resolveCompanyContext`);
forks without them still take the layout, navigation, footer, loading and session-memo
parts. **Code only — no schema, no SSM, no infra, no env vars.** The default
`make <env>-deploy` is the right path.

▶ **Retrofit prompt:** [`docs/retrofit/2026-10-17-customer-side-render-and-scope.md`](docs/retrofit/2026-10-17-customer-side-render-and-scope.md)

### Problem

- **Every customer page's server HTML was a full-screen spinner.**
  `CustomerLayoutClient` waited on `useSession()`, whose status is always `"loading"`
  during SSR, so nothing painted until the browser had fetched `/api/auth/session`.
- **The top nav popped in after hydration** and pushed the page down: the layout used
  `NavigationWrapper` (the module's default export), which renders nothing until
  mounted.
- **The footer floated mid-screen** on short pages and jumped as content arrived.
- **`/account` had no loading boundary**, so a slow page showed nothing at all.
- **Auth lookups repeated.** Each `requireCustomer` / `requireAdmin` call decoded the
  session again (JWT + session callbacks and their DB reads); eligibility and the
  company-context lookup ran one after the other; the settings page loaded the
  customer profile three times.
- `PageActivityLogger` sent a server-action request on every navigation for
  Company-Login customers, who have no local `User` to record against.

### What changed

- **`CustomerLayoutClient`** renders `{children}` straight away; anything
  session-dependent reads the server-passed `session` prop. It renders
  `NavigationComponent` directly and reads `?simple=true` itself. `main` is a flex
  column with a `flex-1` content wrapper, so the footer stays at the bottom
  (`CompanyCustomerLayout`'s `main` is a flex column too).
- **`src/app/account/loading.tsx`** (new) — an `aria-busy` skeleton shaped like the
  customer home.
- **`getCurrentSession`** (`require-auth.ts`) is wrapped in React `cache()`: every
  `require*` helper in a request — **admin as well as customer** — shares one session
  read and one session object. `requireCustomer` reads through
  `getCustomerRequestSession`, the single place a session could later be substituted.
- **`src/modules/auth/server/customer-page-scope.ts`** (new) —
  `getCustomerPageScope()` / `requireEligibleCustomerPageScope()` return
  `{ session, isCompanyCustomer, eligibility, context }`, running eligibility and
  company context **in parallel**, memoized per request. `evaluateCustomerEligibility`,
  `resolveCompanyContext` and the customer-profile load are `cache()`d too.
- **`/account` layout** runs the disabled check and profile load with `Promise.all`;
  it deliberately awaits only the bare session, so the shell and skeleton are not held
  back by the page's lookups. The home, settings and get-started pages use the scope.
- **`PageActivityLogger`** returns early for Company-Login customers.
- **`PageHeader`** gains `size="compact"` (text-3xl title, text-sm description) for
  customer pages; the customer home uses it.
- **`docs/template/DESIGN-SYSTEM.md`** gains rules for route skeletons, Suspense
  streaming, layouts that never gate on the client session, empty states, the entry
  animation classes, page-header sizes and bookmarkable URLs.
  `capabilities/COMPANY_LOGIN.md` documents the scope helpers.

### Behaviour worth knowing

- **Eligibility policies must now be pure reads.** `evaluateCustomerEligibility` is
  memoized per request, so a policy with side effects (writes, counters, logging that
  must happen per call) runs once, not once per caller.
- **Redirects from `/account` *pages* now arrive after streaming starts.** With
  `loading.tsx`, a page's `redirect()` (ineligible → `/account/get-started`,
  `requireFeature`) is delivered inside an already-started response: the browser still
  lands in the right place, but the HTTP status is 200, not 307. The layout's
  sign-in redirect runs before the skeleton and is unaffected. Monitors or tests that
  assert a 307 on an `/account/*` page need updating.
- `react`'s `cache()` only memoizes inside a server request; tests and scripts see no
  change.

### Steps

1. Port the `CustomerLayoutClient` / `CompanyCustomerLayout` changes and copy
   `src/app/account/loading.tsx` (reshape it to the page your customers land on).
2. Wrap `getCurrentSession` in `cache()` and add `getCustomerRequestSession`.
3. Copy `customer-page-scope.ts`, export it from `src/modules/auth/server.ts`, `cache()`
   the eligibility, company-context and profile loaders, and move the account pages
   onto the scope.
4. Port `PageActivityLogger`, `PageHeader` `size`, and the tests
   (`CustomerLayoutClient.test.tsx`, `customer-page-scope.test.ts`,
   `PageActivityLogger.test.tsx`); `npm run type-check && npm test`.
5. `make staging-deploy`; open an `/account` page with a slow connection and confirm
   the page (not a spinner) is in the first paint, the nav doesn't jump, and the
   footer sits at the bottom.

---

## 2026-10-17 — Sign-in redirects: open redirect fixed, `callbackUrl` honoured

**Security fix. Applies to every fork with `/auth/admin-view-account`; the sign-in
half applies to forks with the Keycloak `/auth/admin` page (2026-06-10) and the dev
login (`/auth/dev`).** Code only — **no schema, no SSM, no infra, no env vars.**
Default `make <env>-deploy`.

▶ **Retrofit prompt:** [`docs/retrofit/2026-10-17-redirects-caching-search.md`](docs/retrofit/2026-10-17-redirects-caching-search.md)

### Problem

- **Open redirect.** `/auth/admin-view-account` navigated to its `callbackUrl` query
  parameter with `window.location.href` unchecked. A crafted link could send an admin
  off-site or run a `javascript:` URL in the app's origin.
- **Bookmarks were lost on session expiry.** NextAuth's middleware sends a signed-out
  visitor to sign-in with the requested page in `callbackUrl`, but `/auth/signin`
  dropped repeated query keys and `/auth/admin` and `/auth/dev` hard-coded `/admin` or
  `/account`, so everyone landed on the dashboard.

### What changed

- **`src/modules/auth/lib/callback-url.ts`** (new) — `resolveCallbackUrl(raw, area,
  origin?)`. Honours only a same-origin path inside the area root (`/account` or
  `/admin`); refuses backslashes, protocol-relative `//`, other schemes and paths that
  resolve outside the area; rebuilds the path from the parsed URL rather than echoing
  it; otherwise returns the area root. Without an `origin` (server side) only rooted
  relative paths pass. Pure, so it is usable on server and client.
- **`/auth/admin-view-account`** resolves `callbackUrl` server-side before handing it
  to the client.
- **`AdminSignInClient`** and **`DevLoginClient`** pass the resolved `callbackUrl` to
  `signIn` (Company Login → `account` area, Mapp Entra → `admin`). `/auth/admin` shows a
  **Developer login (local only)** link when `DEV_AUTH_ENABLED`, forwarding
  `callbackUrl`.
- **`/auth/signin`** forwards the whole query, repeated keys included
  (`withPreservedSearchParams`, `src/app/_lib/preserve-search-params.ts`).

### Steps

1. Copy `callback-url.ts` and `preserve-search-params.ts` with their tests.
2. Use `resolveCallbackUrl` in `/auth/admin-view-account/page.tsx`,
   `AdminSignInClient` and `DevLoginClient`; update `/auth/signin`.
3. **Search the fork for other `callbackUrl` / `returnTo` / `next` consumers**
   (`grep -rn "callbackUrl\|window.location.href =" src`) and route them through
   `resolveCallbackUrl` too.
4. `npm run type-check && npm test`; `make staging-deploy`. While signed out, open a
   deep `/admin/...` link: after login you land on it. `/auth/admin-view-account?
   accountId=…&callbackUrl=https://example.com` lands on `/account`.

---

## 2026-10-17 — Public API: key-scoped responses are `private`; search input is escaped

**Security fix.** The caching half applies to forks with the `public_api` capability
(`src/modules/public_api/`). The search half applies to **every fork** — the Mapp Team
search exists everywhere; the audit-log and Company Users searches exist in forks that
took 2026-10-09 / Company Login — and to any search the app added itself. Code only —
**no schema, no SSM, no infra, no env vars.** Default `make <env>-deploy`.

▶ **Retrofit prompt:** [`docs/retrofit/2026-10-17-redirects-caching-search.md`](docs/retrofit/2026-10-17-redirects-caching-search.md)

### Problem

- **Shared caches could serve one account's data to another.** `cacheHeaders()` sends
  `public, max-age, s-maxage`, so a CDN or proxy may store the response and answer any
  later request for the same URL from it, whichever API key sent it. The capability
  doc's examples used it for key-scoped endpoints.
- **Search terms were LIKE patterns.** Prisma's `contains` / `startsWith` / `endsWith`
  compile to `LIKE` / `ILIKE` and pass `%` and `_` through as wildcards, so `%` or `__`
  matched every row and `50%` matched "50 items". On an external surface that makes a
  search an oracle that can page through a table or probe a column a character at a
  time.

### What changed

- **`src/modules/public_api/lib/cache.ts`** — `privateCacheHeaders(maxAge?)`
  (`private, max-age=…` plus `Vary: X-API-Key`) and an `API_KEY_HEADER` constant, which
  `withApiKeyAuth` now reads the key from. Both exported from the module index.
  `cacheHeaders()` / `snapshotCacheHeaders()` are unchanged and remain correct for data
  identical for every key.
- **`src/lib/utils/search.ts`** (new) — `escapeLikePattern()` (escapes `\`, then `%`
  and `_`) and `toContainsTerm()` (trim, escape, `undefined` when blank). Used in the
  audit-log, Company User and Mapp Team services. A numeric search still matches the
  company id exactly.
- **`docs/template/capabilities/PUBLIC_API.md`** — a **Caching Rule** (pick headers by
  who may see the response; when in doubt, private) and a **Search Rule** (on external
  surfaces search only columns the caller is shown, and escape the input). Endpoint
  examples now use `privateCacheHeaders()` and the real `withApiKeyAuth` /
  `paginatedResponse` signatures.
- Tests: `cache.test.ts`, `search.test.ts`, and `search-escaping.db.test.ts` (against
  Postgres; `test/utils/db.ts` now also truncates `company_user`).

### Steps

1. Copy `cache.ts` changes (+ index exports, `auth.ts`) and `search.ts` with tests.
2. **Audit every endpoint that uses `cacheHeaders()`.** If the response depends on the
   key in any way (account scope, key type), switch it to `privateCacheHeaders()`.
3. **Find every `contains` / `startsWith` / `endsWith` fed by user input**
   (`grep -rnE "contains:|startsWith:|endsWith:" src`) and pass the term through
   `toContainsTerm()` / `escapeLikePattern()`. Not for `equals`.
4. `npm run type-check && npm test` (and `make dev-test-db`); `make staging-deploy`. A
   search for `%` in Mapp Team returns nothing; an API response shows
   `Cache-Control: private` and `Vary: X-API-Key`.

---

## 2026-10-17 — Admin sidebar: Settings pinned to the bottom; one active-link rule

**Applies to every fork.** The Settings half assumes the 2026-10-09 Settings entry.
UI only — **no schema, no SSM, no infra, no env vars.** Default `make <env>-deploy`.
No dedicated retrofit prompt.

### Problem

- Settings was the second main sidebar item, mixed in with feature navigation.
- Active states used `pathname.startsWith(href)` or `pathname === href` inline, which
  broke on hrefs carrying `?query` or `#hash` and had no segment boundary
  (`/admin/user` lit up on `/admin/users`).

### What changed

- **`ADMIN_UTILITY_NAVIGATION_ITEMS`** (`navigation-items.tsx`, exported from the
  module) holds Settings; `Sidebar` takes a `utilityNavigationItems` prop and renders
  it at the bottom, below a divider and above the impersonation banner and user card,
  in the expanded, collapsed and mobile sidebars. `AdminLayoutClient` passes it.
- **`isNavItemActive(href, pathname)`** and **`navHrefPath(href)`**
  (`navigation-filters.ts`) — path-only compare, whole-segment match, exact match for
  the area roots `/`, `/admin` and `/account`. `isActive` / `isParentActive` and every
  nav surface use it.
- Top-nav item states (`getParentActiveClasses`) and `SidebarViewTopBar`
  (`SidebarTopNav.tsx`) use the glass design tokens instead of gray Tailwind defaults.
- `docs/template/CUSTOMIZATION.md` documents the utility group and the active-state
  rule.

### Steps

1. Move Settings from `ADMIN_NAVIGATION_ITEMS` to `ADMIN_UTILITY_NAVIGATION_ITEMS`;
   port the `Sidebar` rendering and pass the prop from `AdminLayoutClient` (both
   desktop and mobile instances). Add the new export to any test mocks of
   `@/modules/navigation`.
2. Port `isNavItemActive` / `navHrefPath` and replace inline `startsWith` checks in
   **any nav component the fork added** as well.
3. `npm test` (`navigation-filters.test.ts`); check the sidebar in all three variants.

---

## 2026-10-17 — Setup and deploy scripts work from Windows (Git Bash); Docker disk cleanup

**Applies to every fork.** Nothing changes on macOS/Linux except the Docker cleanup
(all OSes) and the `jq` prerequisite check. Scripts, `Makefile`, `.gitattributes`,
`Dockerfile`, `package.json` — **no app code, no schema, no SSM, no infra.** Adopting
it needs no deploy; the `Dockerfile` change rides along with your next ordinary
`make <env>-deploy`. Optional env knobs: `DOCKER_CLEANUP`, `DOCKER_BUILD_CACHE_MAX`.

▶ **Retrofit prompt:** [`docs/retrofit/2026-10-17-windows-git-bash.md`](docs/retrofit/2026-10-17-windows-git-bash.md)

### Problem

From Git Bash on Windows, almost every step failed:

- `node` was handed `/c/Users/...` paths it cannot open (`setup.sh`, `_config.sh` and
  every script that sources it).
- Git Bash rewrote `/`-leading arguments into Windows paths
  (`/myapp-stg/X` → `C:/Program Files/Git/myapp-stg/X`): SSM setup failed with
  "Parameter name must be a fully qualified name", shared params looked missing, log
  tailing found no group, and the maintenance deploy's ECS Exec command would have
  been mangled.
- A CRLF `scripts/docker-entrypoint.sh` made the container exit 255 with an **empty
  CloudWatch log**, tripping the ECS circuit breaker on the first deploy.
- `docker login` to ECR failed with "The stub received bad data" (Windows Credential
  Manager holds at most 2,560 bytes; SSO-session ECR tokens are longer).
- Keycloak URI registration failed with HTTP 000 (Schannel curl doesn't trust the
  internal root CA).
- `python3` is often the Microsoft Store stub, and Windows Python writes CRLF
  (`"RUNNING\r" != "RUNNING"`); `aws` wasn't found in a Git Bash window opened before
  its install; `npm run build:debug` used POSIX `VAR=value` syntax that cmd.exe rejects.

Separately, on every OS, each build left several GB of build cache and an image
behind; after a day of deploys Docker failed with "read-only file system".

### What changed

- **`scripts/deploy/_config.sh`** — `to_node_path` (`cygpath -m` when present;
  unchanged elsewhere; paths go to node via `process.argv`, never interpolated);
  `add_exit_trap` (appends to the EXIT trap, bash 3.2-safe); on MINGW/MSYS only:
  `MSYS2_ARG_CONV_EXCL` for `/{app}-;/labs;/mapp-labs;/ecs/;/aws/;/app/` (idempotent,
  preserves a user value), `PYTHON_BIN` selection + `run_python` (strips CR, keeps the
  exit status), and an `aws` PATH fallback to `C:\Program Files\Amazon\AWSCLIV2`.
- **`Makefile`** exports the same `MSYS2_ARG_CONV_EXCL` list for its own `aws`
  recipes, and `dev-check-prerequisites` lists `jq`. `scripts/setup.sh` gets its own
  `to_node_path` and the `jq` check.
- **`.gitattributes`** pins `eol=lf` for `*.sh`, `*.sh.example`, `*.py`, `Makefile`,
  `Dockerfile`, `.githooks/*`, `*.crt`, `*.sql`. **`Dockerfile`** strips CR from the
  entrypoint next to the `chmod`.
- **`build-and-push.sh`** — on Git Bash with `docker-credential-ecr-login` available,
  a throwaway `DOCKER_CONFIG` routes this account's ECR registry to the helper (keeps
  the user's other settings, contexts and CLI plugins); otherwise plain `docker login`
  with an install hint. **After the push (all OSes):** prunes build cache to
  `DOCKER_BUILD_CACHE_MAX` (default `10GB`) and untags this app's local images by
  reference (only this app's ECR repo; never by ID, no `-f`). Never fails the deploy;
  `DOCKER_CLEANUP=false` opts out.
- **`register-keycloak-uris.sh`** — on Windows, a temp CA bundle (Git's public bundle +
  `certs/ca.internal.mapp.tools.crt`) with `--ssl-revoke-best-effort`; the array is
  expanded as `${CURL_TLS_ARGS[@]+"${CURL_TLS_ARGS[@]}"}`, because the plain form
  aborts macOS `/bin/bash` 3.2 under `set -u` when it is empty. Windows install hints
  for `jq`; `maintenance-deploy.sh` for `session-manager-plugin`.
- `maintenance-deploy.sh` and `update-keycloak-ca.sh` use `run_python`;
  `refresh-labs-aws-creds.sh` inlines the same selection. `build:debug` sets
  `ENABLE_SOURCE_MAPS` via `node -e`. New `docs/template/WINDOWS.md`.

### Steps

1. Copy `_config.sh`, `build-and-push.sh`, `register-keycloak-uris.sh`, and port the
   other script, `Makefile`, `.gitattributes`, `Dockerfile` and `package.json` edits.
2. **Forks that have been checked out on Windows:** after adding `.gitattributes`, run
   `git add --renormalize .` once and commit the result. Check
   `git ls-files --eol prisma/migrations` first — a migration committed with CRLF
   changes checksum when normalised (see the retrofit prompt).
3. Verify on macOS (bash 3.2): `make staging-ecs-status` and
   `bash scripts/deploy/register-keycloak-uris.sh staging` still run. On Windows, run
   `make staging-ssm-list` and a staging deploy.

---

## 2026-10-17 — Prisma pg pool connection errors are logged at error level

**Applies to every fork on Prisma 7 with `@prisma/adapter-pg`** (a `new PrismaPg(...)`
in `src/lib/prisma/client.ts`). Small. Code only — **no schema, no SSM, no infra, no
env vars.** Default `make <env>-deploy`. No dedicated retrofit prompt.

### Problem

`@prisma/adapter-pg` already keeps an error listener on its pool, so a dropped idle
connection can't crash the process — but it only `debug()`-logs it. An RDS restart or
failover was invisible in CloudWatch.

### What changed

- **`src/lib/prisma/pg-pool-errors.ts`** (new) — `onPoolError` / `onConnectionError`,
  passed to `PrismaPg` as its second argument (`pgAdapterErrorHooks`). They log
  `[db] <context> (<code>): <message>` via the app logger: code and message only, URL
  userinfo and `DB_PASSWORD` redacted, never the error object; the hooks never throw.
- `docs/template/DEPLOYMENT.md` documents the pool env settings (`DB_MAX_CONNECTIONS`,
  `DB_CONNECTION_TIMEOUT`, `DB_IDLE_TIMEOUT` — unchanged) and what to search for.
  `connection_limit` / `pool_timeout` in `DATABASE_URL` are no-ops with the adapter.
  One-off scripts that build their own adapter (`prisma/seed.ts`, data-sync) don't get
  the hooks.

### Steps

1. Copy `pg-pool-errors.ts` and its two tests; pass `pgAdapterErrorHooks` as the second
   `PrismaPg` argument. If `tsc` rejects the second argument, the fork's adapter is too
   old — take the 2026-09-07 dependency refresh first (the template is on 7.10).
2. `npm test` and `make dev-test-db` (the DB test kills a pooled connection with
   `pg_terminate_backend` and checks it is logged once and the next query reconnects).

---

## 2026-10-17 — Test tooling: Jest 30 DB-test flag, redacted DB URLs, agent worktrees ignored

**Applies to every fork on Jest 30** (`npx jest --version`). Test tooling only — **no
app code, no deploy.** No dedicated retrofit prompt.

### What changed

- **`make dev-test-db` and `npm run test:db` were broken on Jest 30**, which replaced
  `--testPathPattern` with `--testPathPatterns` and rejects the old flag; they ran no
  tests and failed. Both now use `--testPathPatterns`.
- **`requireTestDatabase()` printed both database URLs in full, passwords included**,
  when `DATABASE_URL` and `DATABASE_URL_TEST` differed, and named `make test` /
  `make test-db`, which don't exist. It now masks passwords (`redactDatabaseUrl`,
  `test/utils/db-url.ts`) and names `make dev-test` / `make dev-test-db`.
- `test/utils/db.ts` truncates `company_user` too (only if the fork has that table).
- **`jest.config.ts`** adds `<rootDir>/.claude/` to `modulePathIgnorePatterns`, so
  full checkouts made by coding agents under `.claude/worktrees/` don't run their
  copies of every test.

### Steps

1. Replace `--testPathPattern=` with `--testPathPatterns=` in the `Makefile` and
   `package.json`.
2. Copy `test/utils/db-url.ts` + its test and the `test/utils/db.ts` message changes.
3. Add `"<rootDir>/.claude/"` to `modulePathIgnorePatterns` (not
   `testPathIgnorePatterns` — the CLI flag replaces that config value).
4. `make dev-test-db` runs the `*.db.test.ts` files.

---

## 2026-10-09 — Session cookie no longer grows with the user's profile (fixes HTTP 431)

**Applies to every fork with Keycloak login** — i.e. any app whose `jwt` callback in
`src/modules/auth/config/nextauth.ts` assigns `token.mappLdapGroups`,
`token.workspaces`, `token.roles` or `token.keycloakIdToken`. Forks that never took
the 2026-06-10 Keycloak retrofit are **not affected**. **One additive table, one
migration, auth-module code. No SSM, no infra, no Keycloak-side change.** The default
`make <env>-deploy` is the right path.

▶ **Retrofit prompt:** [`docs/retrofit/2026-10-09-session-cookie-size.md`](docs/retrofit/2026-10-09-session-cookie-size.md)

### Problem

Some users get **HTTP 431 (Request Header Fields Too Large) on every page**, from the
first request after logging in. It is per-user, permanent for that user, and nothing
appears in the application logs — Node's HTTP parser rejects the request before any
app code runs. Reported from `ai-engage-editor` staging.

The NextAuth session is a JWT, and the JWT **is the session cookie** — the whole
thing is sent on every request. At sign-in the `jwt` callback stored four things on
it whose size depends on the user's profile:

- `roles`, `workspaces`, `mappLdapGroups`
- `keycloakIdToken` — the full Keycloak `id_token`, kept for federated logout

The `id_token` *already contains* the first three, so they were stored twice, and the
copy inside the `id_token` is base64-encoded twice. Each byte of LDAP group data cost
about **three bytes of cookie**. Measured with next-auth's own `encode()`
(~60-character group names):

| LDAP groups / workspaces | Cookie before | Cookie now |
|---|---|---|
| 0 / 0 | 2.7 KB | ~0.7 KB |
| 25 / 5 | 9.2 KB | ~0.7 KB |
| 50 / 10 | 15.7 KB | ~0.7 KB |
| 60 / 10 | **17.6 KB** | ~0.7 KB |
| 100 / 20 | **28.6 KB** | ~0.7 KB |

Node rejects a request whose headers total more than **16 KB**, so the cliff was
around 50 groups. The comment above the callback still claimed it kept cookies
"<4KB"; that stopped being true when the Keycloak enrichment landed.

**Dropping one of the two is not enough.** Removing only the `id_token` leaves ~12 KB
at 100 groups; removing only the lists leaves ~17 KB, because the `id_token` still
carries them. **And the `id_token` cannot simply be deleted** — `/auth/signout` needs
it as Keycloak's `id_token_hint` to end the SSO session. If your fork worked around
the 431 by deleting those lines, this retrofit puts it back in the right place.

### Second bug, found while testing this: Keycloak logout never actually ran

`/auth/signout` is meant to end the Keycloak SSO session as well as the app session.
**It never did.** The page called next-auth's `getToken()` with only a raw `Cookie`
header; `getToken()` reads `req.cookies` and ignores the header, so it returned
`null` every time. No token meant no `id_token`, no end-session redirect, and no
error: the app cookie was cleared, the user landed on the login page, and the next
"Log in" click **passed straight through Keycloak without a prompt**. This has been
the case since Keycloak login landed (2026-06-10) and affects every fork that has it.

The page now hands `getToken()` the cookie store. Verified end to end against a real
Keycloak: before the fix a login after sign-out is silent; after it, Keycloak asks
for credentials. `src/__tests__/signout-page.test.ts` covers it with the real
`encode`/`getToken` — a mocked `getToken` is how this went unnoticed.

### What changed

The profile-sized data moved to the database; the cookie keeps a pointer.

- **New table `auth_session`** (`AuthSession` model, migration
  `20261009120000_auth_session`) — one row **per login**, holding `roles`,
  `workspaces`, `mappLdapGroups` and the `id_token`. Per login rather than per user
  because an `id_token` identifies one Keycloak SSO session; two browsers must not
  share one.
- **`src/modules/auth/server/auth-session.ts`** (new) — create / load / delete, and
  the rule for future claims: *a scalar may go on the JWT; a list goes here.*
- **`jwt` callback** — writes the row at sign-in and stores only `authSessionId`.
- **`session` callback** — reads the row and populates `session.user.roles`,
  `.workspaces`, `.mappLdapGroups` **exactly as before**. Code reading the session
  needs no change.
- **`events.signOut`** — deletes the row.
- **`/auth/signout`** — takes the `id_token` from the row, and reads the session
  token correctly (see the second bug above), so Keycloak logout now really happens.
- **Tests** — `signout-page.test.ts` (above); `nextauth-auth-session.test.ts` includes a size assertion (200 groups,
  40 workspaces, a 20 KB `id_token` → cookie under 1.5 KB) that fails if anything
  profile-sized is put back on the token; `auth-session.db.test.ts` covers the table.

### Behaviour worth knowing

- **Users will notice one thing: signing out now signs them out.** After "Sign out",
  the next login asks for credentials (or goes through Entra) instead of passing
  straight through. That is the intended behaviour, but it is new to them.
- **The logout redirect must be registered in Keycloak.** Keycloak only redirects
  back to a registered post-logout URI (`https://<host>/auth/signout*`).
  `scripts/deploy/register-keycloak-uris.sh` registers it, and `make <env>-deploy`
  runs that script. Because logout never reached Keycloak before, a fork that never
  ran the script has not found out yet: its users would now see Keycloak's "Invalid
  redirect uri" page after signing out. Run
  `bash scripts/deploy/register-keycloak-uris.sh <env>` if in doubt — it is idempotent.
- **A rollback, or the overlap during a rolling deploy, degrades gracefully but not
  invisibly.** A session created by the new code carries no inline claims, so if it
  is served by the *old* code its `session.user` has no roles/workspaces/groups until
  the new code serves it again. Access checks based on those fail closed.
- **Breaking only if you read the raw JWT.** `session.user.*` is unchanged, but code
  that calls `getToken()` and reads `token.roles`, `token.workspaces`,
  `token.mappLdapGroups` or `token.keycloakIdToken` directly will find them missing
  on new logins. Use the session, or `loadAuthSessionClaims(token.authSessionId)`.
  The template had exactly one such reader (`/auth/signout`).
- **One extra primary-key read per session resolution.** The `jwt` callback already
  does a `mapp_team` read per request for admins; this adds one for anyone with a row.
- **Existing sessions keep working, and keep their old cookie**, until the user next
  logs in. Both callbacks still honour inline claims on tokens issued before this
  change. Nobody is logged out by the deploy.
- **Users already stuck on 431 must clear their cookies for the app's domain once.**
  Their request never reaches the app, so the app cannot shrink the cookie for them
  — and they cannot reach `/auth/signout` either. After clearing, they log in and
  get the small cookie.
- **Deploy ordering is handled.** `make <env>-deploy` rolls the new image out
  *before* migrating, so for a few minutes the code runs without the table. A login
  in that window falls back to the old inline behaviour (only on Prisma `P2021`,
  "table does not exist") instead of failing. Any other write failure fails the
  login — a session silently missing its groups is worse than a retry.
- **Rows expire with the session.** `expiresAt` rolls forward while the session is in
  use (one write per half-lifetime); expired rows are pruned at the next login. No
  scheduler.
- **The `id_token` is now at rest in the app database** rather than in an encrypted
  cookie. It is an identity assertion, not an API credential — it cannot be used to
  call anything — and it is never selected by the query that feeds `session.user`.
- **LDAP groups are not filtered.** All groups Keycloak sends are stored, as before.

### Steps

1. Add the `AuthSession` model and the `20261009120000_auth_session` migration.
2. Add `src/lib/prisma/services/auth-session.ts` (register it in the services index)
   and `src/modules/auth/server/auth-session.ts`.
3. Update the `jwt` and `session` callbacks, add `events.signOut`, update
   `/auth/signout` and the JWT types.
4. Move any **other** list your fork added to the token onto the row as well, and
   fix any direct `getToken()` readers of the moved fields.
5. Copy both test files; `npm run type-check && npm test`.
6. `make staging-deploy`, then log in, check `/admin/auth-debug` still lists your
   groups and workspaces, sign out, confirm you land back on the login page (not a
   Keycloak error page), and confirm the next login **prompts** rather than passing
   straight through.

---

## 2026-10-09 — Admin audit log and a Settings link in the sidebar

**Applies to every fork.** The audit log is a **standard capability**: every app
should be able to answer "who changed that, and when?". **One additive table, one
migration, a small module, one page, one sidebar entry. No SSM, no infra.** The
default `make <env>-deploy` is the right path.

▶ **Retrofit prompt:** [`docs/retrofit/2026-10-09-audit-log-and-settings.md`](docs/retrofit/2026-10-09-audit-log-and-settings.md)

### Problem

Three loose ends that turned out to be one:

- **`/admin/settings` existed but nothing linked to it.** The sidebar had Dashboard
  and Mapp Team; the Settings page was reachable only by typing the URL.
- **So Company Users was unreachable too.** Its only link is the card on that page.
- **The Audit Log card on that page went to a 404.** `/admin/audit-log` was in the
  access-control map and on the Settings page, but the page was never built. What
  the template called "audit log" was per-account *customer activity*
  (`account_activity`), which needs a `User` and an `Account` and records page
  views — not who changed an admin setting. Its admin UI had also left the base
  template with the CRM pages.

### What changed

- **`AuditLog` model** (table `audit_log`, migration `20261009130000_audit_log`):
  actor, action, entity type + id, outcome, a message, optional JSON detail. The
  actor is stored as both a `MappTeam` link (`SetNull` on delete) and a plain
  `actorEmail`, so history survives a team member being removed.
- **`src/modules/audit/`** — `writeAuditLog` (never throws), `writeAuditLogTx` (for
  use inside a transaction; does throw), `sessionAuditActor`, and
  `AUDIT_ENTITY_TYPES`, the one list that types the writer and builds the page's
  filter chips. Adding an entity type is one line and **no migration**.
- **`/admin/audit-log`** — newest first, 50 per page, search and type filter done in
  Postgres. Readable by any active admin.
- **Mapp Team access changes are recorded** (update, bulk update, revoke, grant), as
  the built-in example.
- **Sidebar:** a **Settings** entry at the end of the admin navigation, and **Mapp
  Team is no longer a sidebar entry** — it is a card on Settings, like Company
  Users and Audit Log. Settings is the hub for the standard admin pages; new ones
  are added as cards there. The separate admin-only sidebar section
  (`ADMIN_NAVIGATION_ADMIN_ITEMS`) still works but ships empty and is hidden while
  empty.
- **Docs:** `docs/template/capabilities/AUDIT_LOG.md` rewritten around the admin audit log,
  with account activity kept as a clearly separate section, and a "What to record"
  section telling whoever builds on the app to record its consequential changes.
  `AGENTS.md` points agents at it.

### Behaviour worth knowing

- **Only Mapp Team access changes are recorded out of the box.** The template has
  no other admin mutations of its own. Your app's mutations are recorded when you
  add the one-line call — nothing is captured automatically.
- **The log starts empty.** Nothing is backfilled from before the deploy.
- **Viewers can read it.** Do not put secrets in `message` or `data`.
- **Nothing is pruned.** Retention is left to the app.
- **Deploy window.** The default deploy rolls the image before migrating. Until the
  migration runs, `writeAuditLog` fails quietly (it never throws, so the access
  change itself still succeeds) and `/admin/audit-log` shows the error page. Both
  clear as soon as the migration finishes; changes made in those minutes are not
  recorded.
- **Apps that already have an `audit_log` table** (some forks built their own
  first): the migration is written to reconcile — it leaves the table and its
  indexes alone and only adds `actor_email`. Reconcile the *Prisma model* by hand;
  see the retrofit prompt.

### Steps

1. Add the `AuditLog` model (and `auditLogs AuditLog[]` on `MappTeam`) and the
   `20261009130000_audit_log` migration.
2. Copy `src/modules/audit/`, `src/lib/prisma/services/audit-log.ts` (register it in
   the services index) and `src/app/admin/audit-log/`.
3. Add the `Settings` entry to `ADMIN_NAVIGATION_ITEMS`, and remove `Mapp Team`
   from `ADMIN_NAVIGATION_ADMIN_ITEMS` once the Settings card is confirmed working.
4. Add audit calls to the Mapp Team access actions, then to **your app's own**
   admin mutations, adding each entity to `AUDIT_ENTITY_TYPES`.
5. Copy the tests; `npm run type-check && npm test`.
6. `make staging-deploy`, change a team member's access level, and confirm the
   change appears under **Settings → Audit Log**.

---

## 2026-10-09 — "Pre-Authorize Employee" removed from Mapp Team

**Optional. Applies to any fork with `/admin/mapp-team`.** UI and one server action.
**No schema, no SSM, no infra.** No dedicated retrofit prompt.

### Why

The button created a `MappTeam` record with a chosen access level before someone's
first login. It existed for the pending/approval access model, where a new employee
could not get in until an admin had acted. That model was removed on 2026-06-10:
every Mapp employee can now log in and starts as a viewer, and an admin changes
their level afterwards with the edit-access dialog. Pre-authorizing was no longer
needed for access — only to save that one edit — and its help text still described
signing in "via Microsoft" with details "fetched from Azure Active Directory".

### What changed

- Removed the **Pre-Authorize Employee** button from `/admin/mapp-team`.
- Deleted `src/components/admin/modals/PreAuthorizeModal.tsx` and the
  `preAuthorizeEmployee` server action.
- The edit-access dialog's "Never logged in (pre-authorized)" hint now reads
  "Never logged in".

### What did not change

- **Existing pre-authorized records are untouched and still honoured.** Login looks
  a person up by email and uses the access level already on their record, so anyone
  pre-authorized before this change still arrives with the level they were given.
- No data is deleted and there is no migration.

### Steps

1. Remove the button, the modal's import/state/usage from the Mapp Team page.
2. Delete `PreAuthorizeModal.tsx` and `preAuthorizeEmployee`.
3. **If your app relies on this** — for example it gates the whole app on access
   level and onboards editors ahead of time — skip this entry and keep the button.

---

## 2026-10-09 — Entra redirect registration is skipped for Keycloak apps

**Applies to every fork with the `*-entra-*` make targets. Small, not urgent.** A
Makefile + script change and a documentation correction. **No schema, no SSM, no
infra, no deploy needed to adopt it.** No dedicated retrofit prompt — the steps
below are the whole change.

### Problem

`make staging-infra-deploy` and `make prod-infra-deploy` always registered
`https://<host>/api/auth/callback/azure-ad` on the **shared** Mapp Labs Entra app
registration. That URI is only used by the direct Azure AD login provider, which
the app registers **only when `KEYCLOAK_ENABLED=false`**. With Keycloak on — the
default since 2026-06-10 — Keycloak brokers to Entra through its own redirect URI,
and the app's `azure-ad` callback is never reached.

So every Keycloak app was adding a dead entry to a list shared by all Labs apps,
and printing a "registration failed" warning on accounts where the Graph
credentials were never set up. The setup docs compounded it: `AGENTS.md` told
agents that `make shared-ssm-setup` was a one-time requirement, and the README,
getting-started and Copilot instructions still described login as "Magic Link +
Microsoft Entra".

### What changed

- **`scripts/deploy/entra-redirect-uri.sh`** — when called with
  `ENTRA_SKIP_IF_KEYCLOAK=true`, `add` reads this app's
  `/{appName}-{env}/KEYCLOAK_ENABLED` SSM parameter and exits cleanly if it is
  `true`. If the parameter is missing or unreadable it behaves as before.
- **`Makefile`** — the two `*-infra-deploy` targets pass that flag. The manual
  targets (`make {env}-entra-add`, `make {env}-entra-remove`) do **not**, so they
  always act; `make help` now labels them as legacy.
- **`staging-infra-destroy` is unchanged** and still removes the URI — on a Keycloak
  app that is the cleanup for an entry registered before this change.
- **Docs** — `AGENTS.md`, `docs/template/DEPLOYMENT.md`, `GETTING_STARTED.md`, `README.md`,
  `.github/copilot-instructions.md` and `docs/template/CUSTOMIZATION.md` now describe
  Keycloak as the login path and direct Entra as a legacy branch.
  `docs/template/ENTRA-SETUP.md` documents the skip. `docs/template/CUSTOMIZATION.md` also drops its
  description of `ADMIN_GRANULAR_ACCESS_CONTROL` as a manual-activation switch: the
  app has not read that variable since the 2026-06-10 access-model change.

### Steps

1. Copy `scripts/deploy/entra-redirect-uri.sh` from the template (or port the
   `ENTRA_SKIP_IF_KEYCLOAK` block and header comment into yours).
2. In the `Makefile`, prefix the Entra line in `staging-infra-deploy` and
   `prod-infra-deploy` with `ENTRA_SKIP_IF_KEYCLOAK=true`.
3. **Apps still on `KEYCLOAK_ENABLED=false`:** nothing changes for you — the
   registration still runs.
4. **Optional cleanup for Keycloak apps:** `make staging-entra-remove` /
   `make prod-entra-remove` deletes the unused entry your earlier infra deploys
   registered. It only touches this app's own URI. Check with
   `make entra-redirects-list`.

---

## 2026-09-22 — App identity in navigation and login (display name + optional logo)

**Optional, cosmetic. Applies to any fork that wants it** — and is worth taking for
consistency: deployed apps currently identify themselves by their AWS resource slug
(`myapp`) or a hardcoded "Mapp Labs". **No schema, no SSM, no infra, no migration.**
Takes effect on the next ordinary build + deploy.

▶ **Retrofit prompt:** [`docs/retrofit/2026-09-22-app-branding.md`](docs/retrofit/2026-09-22-app-branding.md)

### Problem

The UI took the app's name from `config.app.name`, i.e. the `APP_NAME` environment
variable. Locally that is a human-readable name. On ECS, CDK sets `APP_NAME` to the
**resource/billing slug**, so a deployed app showed `sales-coach` where it meant
"Sales Coach" — and the admin login page said "Mapp Labs Login" for every app
regardless. With several Labs apps open, the tabs and sidebars were
indistinguishable.

### What changed

- **`src/config/branding.ts`** (new, server-only) — `getAppBranding()` resolves the
  name in this order: `APP_DISPLAY_NAME` → `APP_NAME` *when it differs from the slug*
  → `app.config.json` `displayName` → `APP_NAME` → `"Mapp Labs"`. Also resolves an
  optional logo.
- **`src/components/shared/layout/AppBranding.tsx`** (new) — a provider plus the
  `AppIdentity` component; **`MobileAppHeader.tsx`** (new) — menu button + name on
  small screens.
- **`app.config.json`** gains `"logoPath": ""`; `scripts/setup.sh` writes it.
  `.env.example` documents the optional `APP_DISPLAY_NAME`.
- **Wired in:** root layout (provider + page title / OpenGraph), sidebar (expanded,
  collapsed, mobile), top navigation, company-customer header, admin login page,
  per-page titles (`pageTitle()` in `src/lib/utils/metadata.ts`) and the
  signing-out screen.
- **Docs:** `docs/template/APP-BRANDING.md`, plus an "App identity" section in
  `docs/template/DESIGN-SYSTEM.md`.

### Visible differences

- The **collapsed sidebar** shows the app's logo or initials instead of the Mapp icon.
- The **top navigation** shows the name as plain text; the rocket "pill" is gone.
- The **admin login page** shows the app's initials or logo and "<App> Login".
- A **header bar appears on mobile** above admin and customer pages.

### Notes

- **Do not change `appName` or `APP_NAME` to change the visible name.** They are the
  resource and billing slug. Set `displayName`.
- **The logo is a file in `public/`**, referenced by a root-relative path
  (`/img/my-app.svg`). Remote URLs, protocol-relative URLs and backslashes are
  rejected; a missing file falls back to text. There is no upload screen.
- **`pageTitle()` is now server-only.** It reads the resolved name through
  `src/config/branding.ts`. Every caller in the template is a server page's
  `metadata`; a fork that calls it from a client component must use
  `useAppBranding()` there instead.
- **`config.app.name` is no longer what the UI shows.** Anything else in your fork
  that renders it will still show the slug on ECS — grep for it.
- **Expect merge work in customised layouts.** `Sidebar.tsx`, `Navigation.tsx` and
  `layout.tsx` are among the files forks change most. Port the pattern; don't
  overwrite.

### Steps

1. Add `src/config/branding.ts`, `AppBranding.tsx` and `MobileAppHeader.tsx`.
2. Add `"logoPath": ""` to `app.config.json` and confirm `displayName` is the name
   you want people to see.
3. Wrap the root layout in `AppBrandingProvider` and use `getAppBranding().name` in
   its metadata.
4. Replace the app-name markup in the sidebar, top navigation, company-customer
   header and admin login with `<AppIdentity />`; add `<MobileAppHeader />` to the
   admin and customer layouts.
5. Point `pageTitle()` and the signing-out screen at the resolved name, and grep
   for any other `config.app.name` your fork renders.
6. Optional: add a square SVG/PNG/WebP under `public/img/` and set `logoPath`.

---

## 2026-09-10 — RDS storage gp2 → gp3

**Applies to every fork with an `infra/` directory.** The template never set
`storageType` on the RDS instance, so it inherited CDK's default: **gp2**. Every app
created from this template before today is running on it. The fix is **one CDK
property**, `storageType: rds.StorageType.GP3`, and one `make <env>-infra-deploy`.
**No schema, no SSM, no code, no image rebuild.** The conversion is performed
**online by RDS** — no downtime, no reboot — but the deploy around it has sharp
edges worth reading about before you run it.

▶ **Retrofit prompt:** [`docs/retrofit/2026-09-10-rds-gp3-storage.md`](docs/retrofit/2026-09-10-rds-gp3-storage.md)

### Problem

gp2 sizes disk performance from the **volume size**: 3 IOPS per GiB, floored at 100.
The template allocates **20 GiB**, so every labs database has a **baseline of 100
IOPS**. It reaches 3,000 only by spending a **burst credit balance** that refills
slowly — and a migration, a seed, a backfill, a `pg_restore`, or a single
sequential scan over a table that outgrew its index can drain it.

When the balance hits zero nothing errors and nothing pages. The database just
runs at 100 IOPS until the credits come back. What you observe is the app becoming
inexplicably slow, typically hours after whatever actually caused it, with no
signal in the application logs. It is one of the least legible failure modes in the
stack, and it is a **default we never overrode** rather than a capacity problem.

gp3 deletes the mechanism: a flat **3,000 IOPS / 125 MiB/s**, always, no credits.

**This is not a cost change.** On RDS — unlike EC2's EBS, where gp3 is ~20% cheaper
— gp2 and gp3 are priced the **same per GiB-month**. The win is entirely
predictability. Don't sell it internally as a saving.

### What changed in the template

`infra/lib/stack.ts` — one property on the RDS construct, with a comment explaining
why it is pinned:

```ts
allocatedStorage: config.dbAllocatedStorage,
maxAllocatedStorage: config.dbAllocatedStorage * 2,
storageType: rds.StorageType.GP3,
storageEncrypted: true,
```

It is **hardcoded, not a config field**, deliberately — alongside `storageEncrypted:
true` and `multiAz: false`. There is no environment for which gp2 is the right
answer at these sizes, and a knob is an invitation to set it back.

`docs/template/DEPLOYMENT.md` gains a **"Storage type — gp3, not gp2"** section under
*Database Management*, and its resource tables now read `20 GiB gp3`.

### Do not add `iops` or `storageThroughput`

Below **400 GiB**, gp3 on RDS PostgreSQL has **no provisionable range** above the
3,000 IOPS / 125 MiB/s baseline — AWS's table lists both as *"Not applicable"*. CDK
will synthesize the properties without complaint; RDS rejects the modification at
deploy time, mid-change, which is the worst place to discover it. They become
meaningful only if `dbAllocatedStorage` crosses 400 GiB, at which point the baseline
rises to **12,000 IOPS / 500 MiB/s** on its own anyway.

### The deploy: what to expect

**Downtime: none.** AWS performs a gp2 → gp3 conversion online. The instance is not
rebooted and connections are not dropped. Afterwards it sits in
`storage-optimization` for a while, during which disk latency may rise by **under
~10 ms**. At 20 GiB that window is short. Schedule it for a quiet period regardless
— and not alongside a release or a large migration.

Three things that are *not* obvious:

1. **`cdk diff` will probably say the database "may be replaced".** CloudFormation
   reports `StorageType` as a *conditional* replacement in changesets. This is a
   known CloudFormation defect
   ([#1788](https://github.com/aws-cloudformation/cloudformation-coverage-roadmap/issues/1788));
   AWS documents `StorageType` as a **"Some interruptions"** update and RDS does it
   in place. Verify with a `--no-execute` changeset before deploying rather than
   trusting either the warning or this paragraph — and then **do not cancel the
   deploy partway through** because of it.

2. **It is effectively one-way for 6 hours.** Once RDS begins the modification it
   refuses any further storage change — size, type, or performance — for roughly
   six hours. If the stack update fails for any reason in that window,
   CloudFormation's rollback tries to set the storage back to gp2, RDS rejects it,
   and the *rollback* fails, leaving the stack in **`UPDATE_ROLLBACK_FAILED`**
   ([#1499](https://github.com/aws-cloudformation/cloudformation-coverage-roadmap/issues/1499)).
   Consequences: deploy this change **on its own** (never bundled with a storage
   resize, instance-class change, or engine upgrade), staging first, and if it
   fails, **stop** — do not retry and do not revert the code to gp2.

3. **Snapshot first.** Production has `deletionProtection: true` and
   `RemovalPolicy.RETAIN`, so a genuine replacement would fail rather than destroy.
   **Staging has neither.** `aws rds create-db-snapshot` before each deploy is the
   real safety net, and it costs a few minutes.

### Steps

1. Add `storageType: rds.StorageType.GP3` to the RDS construct in
   `infra/lib/stack.ts`. Do not add `iops` or `storageThroughput`.
2. `make staging-infra-diff`, then a `--no-execute` changeset to confirm
   `Replacement` is not `True`.
3. Snapshot staging; `make staging-infra-deploy`; wait for the instance to return
   to `available`.
4. Only then: snapshot production; `make prod-infra-deploy`; wait.

**Already on gp3?** Some apps were switched by hand in the console. Apply the CDK
change anyway — otherwise the next unrelated `cdk deploy` reconciles the drift in
the wrong direction and puts you *back* on gp2.

---

## 2026-09-07 — Next.js 16 + dependency refresh (13 advisories → 4)

**Applies to every fork.** A dependency-currency pass that carries one **major**:
**Next.js 15.5 → 16.3**. `npm audit` goes from **13 advisories (7 HIGH, 6 MODERATE)
to 4**, and the four that remain are all inside the Prisma CLI's own pinned tree.
**Three things break if you bump the version and stop there** — `next build
--no-lint` (which the Dockerfile used) no longer exists, the `middleware` file
convention is renamed to `proxy`, and `next build` silently stops running ESLint.
**No schema changes, no SSM, no infra changes** beyond a routine CDK library bump.

▶ **Retrofit prompt:** [`docs/retrofit/2026-09-07-nextjs-16-and-dependency-updates.md`](docs/retrofit/2026-09-07-nextjs-16-and-dependency-updates.md)

### Problem

Two separate problems, fixed together because the second one's fix resolves the first.

**1. The template had drifted.** Most direct dependencies were months behind. The
security-relevant ones:

- **`dompurify`** — a MODERATE XSS (`IN_PLACE` hook removal leaves a detached
  subtree executable). This is the only advisory that was directly reachable from
  application code.
- **The Prisma CLI tree** — `prisma` was pinned at `7.8.0` and dragged in five
  advisories transitively (`fast-uri` SSRF ×3, `hono` ×4, `@hono/node-server` ×2,
  `valibot`, `@prisma/dev`).
- **`nanoid`** — HIGH, an infinite loop on zero-size custom generators.

There was also a **live pin drift**: `prisma` was pinned to an exact `7.8.0` while
`@prisma/client` and `@prisma/adapter-pg` used `^7.8.0` and had floated to `7.9.1`.
The three are supposed to move in lockstep. The 2026-07-11 entry warned about exactly
this and it drifted anyway, because only one of the three is pinned exactly.

**2. Next.js bundled a vulnerable postcss.** Next 15.5.x ships `postcss@8.4.31`
internally, which carries **four HIGH advisories** (XSS via unescaped `</style>`,
and three arbitrary-file-read / path-traversal issues via attacker-controlled
`sourceMappingURL`). No patch on the 15.5 line fixes it — Next 16.3 is the first
release that bundles a patched `postcss` (8.5.23).

**What was *not* a problem, despite appearances:** the recent Next.js CVE batch —
SSRF in Server Actions, SSRF via rewrites, the cache-confusion set, middleware/proxy
bypass, image-optimization DoS — was patched in **15.5.21**, and the template was
already on **15.5.22**. The `next` entry in `npm audit` was the bundled `postcss`
showing through, not Next's own code. If you are reading this because of those CVEs:
a fork on 15.5.21+ was never exposed. A fork on Next **16.0–16.2.10** *is* exposed,
because 16.x was not patched until **16.2.11**.

### What changed

**Next.js 15.5 → 16.3.** Three breaking changes affect this template:

- **`src/middleware.ts` → `src/proxy.ts`.** Next 16 renamed the file convention.
  Next 16 *still honours* the old path with a deprecation warning, so a fork that
  skips this does **not** silently lose route protection — but the rename should be
  done while there is a reason to touch the file. Official codemod:
  `npx @next/codemod@canary middleware-to-proxy .`
- **`experimental.middlewareClientMaxBodySize` → `proxyClientMaxBodySize`.** Unlike
  the file rename, this one **fails silently**: the old key is ignored, quietly
  restoring the default body limit on a deployment that deliberately raised it to
  100mb.
- **`next build --no-lint` is removed.** `Dockerfile:72` used it, so the flag would
  have hard-failed **every image build and therefore every deploy** with
  `error: unknown option '--no-lint'`. This is the change most likely to bite a fork.

There is a fourth, non-breaking but surprising behaviour: **the first `next build`
rewrites `tsconfig.json` in place**, flipping `"jsx": "preserve"` → `"react-jsx"`,
adding `.next/dev/types/**/*.ts` to `include`, and reformatting the file. Commit it
deliberately rather than discovering it as a dirty working tree later.

**Next 16 also stopped running ESLint during `next build`.** Nothing fails, which is
the problem: the Docker build used to be a backstop that caught unused variables, and
that backstop is gone. `make dev-check-all` is now the only thing enforcing lint, so
treat it as a required pre-deploy step. `docs/template/DEPLOYMENT.md` has been corrected — it
previously promised the opposite.

**Dependency bumps.** Security-relevant: `dompurify` → 3.4.14, the Prisma trio →
7.10.0 (all three together, including the exact-pinned CLI). Routine currency:
`@aws-sdk/*` → 3.1121.0, `@notionhq/client` → 5.26.0, `axios` → 1.20.0, `jose` →
6.2.10, `pg` → 8.23.0, `sharp` → 0.35.4, `swagger-ui-dist` → 5.32.14, `zod` → 4.5.4,
`jest` (+`@jest/globals`, `jest-environment-jsdom`) → 30.5.0, `@testing-library/*`,
`eslint-config-next` → 16.3.3, `postcss` → 8.5.26, `tsx` → 4.23.13. Infra:
`aws-cdk-lib` → 2.267.0, `aws-cdk` CLI → 2.1139.0, `constructs` → 10.8.1 —
**library-only, no re-bootstrap**, same as 2026-07-11.

**`@types/dompurify` removed** — a deprecated stub; `dompurify` has shipped its own
types since 3.0, and the stub only conflicts with them. Same call as `@types/sharp`
in the 2026-07-11 entry.

**New test: `src/__tests__/proxy.test.ts`.** Guards the matcher (admin/account trees
protected, `/api/images` deliberately excluded, no catch-all entry) and pins all three
Next 16 migration steps — `src/proxy.ts` exists, `src/middleware.ts` does not, the
config key is the renamed one, and the Dockerfile carries no `--no-lint`. A
half-applied upgrade now fails in `npm test` rather than in a deploy.

### The version policy this pass followed

**Nothing published within the last 7 days.** A brand-new release is where supply-chain
compromises and regressions surface, and a template is copied into many apps before
anyone would notice. The mechanism is npm's own date cutoff rather than hand-pinning:

```bash
npm install --before=<today minus 7 days>
```

This matters because caret ranges defeat the intent — a plain `npm install` on the
same manifest pulled `next@15.5.25` and `postcss@8.5.28`, both days old. Held back on
that basis: `@aws-sdk/*` 3.1127.0, `jose` 6.2.12, `dompurify` 3.4.15,
`eslint-config-next` 16.3.4, `aws-cdk-lib` 2.268.0.

Skipped for a different reason: **`echarts-for-react` 3.0.7** exists but npm's `latest`
dist-tag still points at 3.0.6 — published out of band and never tagged. Left alone.

### What was deliberately *not* fixed

**Four HIGH advisories remain**, all inside the Prisma CLI's own exact-pinned tree:
`mysql2`, `deepmerge-ts`, `@prisma/config`, and `prisma` itself. Closing them means
`overrides` reaching into another package's pinned dependencies — including a
`deepmerge-ts` 7→8 **major** inside Prisma's config loader. They are devtool-tier, and
`mysql2` is a MySQL driver that a Postgres app never loads. **Prisma will fix these
upstream; that is the intended path.** Note `npm audit fix --force` proposes
`prisma@6.19.3` here, which is a **downgrade** — do not run it.

The cautionary example is in a real fork: an override added to fix an old
`fast-xml-parser` advisory now pins that package *into* a newer vulnerable range. A
stale override is worse than the advisory it closed.

**Still deferred:** `next-auth` 4.24.15 → Auth.js v5 (a breaking migration, not a
bump), and the other majors — `eslint` 10, `typescript` 7, `openai` 7, `@types/node`
26, `@testing-library/jest-dom` 7, `@asteasolutions/zod-to-openapi` 9,
`eslint-plugin-security` 4.

**Known warnings, not addressed here:** `eslint-config-next` 16.3.x adds the
`@next/next/no-location-assign-relative-destination` rule, producing **8 new warnings**
(0 errors) across 7 files that use `window.location.href` for internal navigation.
Real, but a code change rather than a dependency change, so it is tracked separately.

### Verification this pass was held to

`npm audit` 13 → 4 (app) and 0 (infra); `npm run type-check` clean; `npm test`
**450 passed** across 32 suites (443 before, plus 7 new); `npm run lint` 0 errors;
`next build` (production, standalone) succeeds and reports `ƒ Proxy (Middleware)`;
`infra` `tsc` build clean. No deploy was performed.

---

## 2026-08-22 — S3 access model (fixes anonymous read of `content/`)

**Applies to every fork** — the S3 module is wired into the template's admin UI,
so almost every app has it. `/api/images/[...path]` served **every object under
`content/` to unauthenticated callers**, while `content/` is the default upload
destination and accepts non-image files. Access is now decided by a declared
prefix policy in one place. **Breaking:** `content/` requires a session; a new
`public/` prefix carries deliberately public assets. **No schema changes, no
infra changes.**

▶ **Retrofit prompt:** [`docs/retrofit/2026-08-22-s3-access-model.md`](docs/retrofit/2026-08-22-s3-access-model.md)

### Problem

Two sibling routes read the same bucket and disagreed about who may read it:

- `/api/files/[...path]` required a session for **all** prefixes and blocked
  executable extensions.
- `/api/images/[...path]` treated `content/` as public — no session, and no check
  that the object was even an image.

So the file route's protections were bypassable by requesting the same key
through the image route. `src/middleware.ts` documents `/api/images` as
deliberately excluded from the matcher ("it handles its own auth"), which is what
made it the weaker of the two paths rather than an oversight anyone would notice.

Meanwhile `/api/upload` accepts **any signed-in user** (not just admins), takes
the destination from a form field, and defaults it to `content/`. So a
customer-role session could upload a PDF that any anonymous caller holding the
key could then retrieve. The same form field was *cast* rather than validated
(`path as 'content' | 'mappTeam' | 'temp'`), so an unrecognised value produced a
key literally beginning `"undefined"` — an object no read path could reach
afterwards. `/api/upload` could also write into `mapp-team/`, the team
profile-image prefix.

### What changed

- **`src/modules/s3_images/config/prefixes.ts`** (new) — the single access
  decision point. Each prefix declares `read` and `write` levels; a key matching
  no declared prefix is rejected, with no permissive default.

  | Prefix | Read | Write |
  |---|---|---|
  | `public/` (new) | public | admin |
  | `content/` | authenticated | authenticated |
  | `mapp-team/` | authenticated | **admin** |
  | `temp/` | authenticated | authenticated |

- **`src/modules/s3_images/server/authorize.ts`** (new) — `authorizeS3Read` /
  `authorizeS3Write`, used by every route. 401 for anonymous callers on a
  protected prefix, 403 for signed-in callers who still lack the level.
- **Both `[...path]` routes** rewritten as thin wrappers over that policy. They
  now differ only in response headers. Presigned URLs for non-public prefixes are
  no longer sent with a shared-cache `Cache-Control`.
- **The read-side executable-extension blocklist was dropped, not duplicated.**
  It implied protection the sibling route did not provide, and uploads already
  enforce a MIME allowlist plus magic-byte verification — an allowlist at write
  time beats a blocklist at read time.
- **Both upload routes** validate the destination with `parsePathName` (400 on an
  unknown value, instead of silently rewriting it to `content/`) and enforce the
  prefix's write level.
- **`S3_CONFIG.paths`** is derived from `S3_PREFIXES` so the literal prefixes
  cannot drift from the access levels declared beside them.
- **Key generation** uses `crypto.randomUUID()` instead of `Math.random()`.
- **`getPresignedUrl`** validates the key itself, so a route that forgets to
  authorize still cannot mint a URL for an undeclared prefix.
- Capability paperwork: `docs/template/capabilities/S3_STORAGE.md`, `_registry.json`,
  `.env.example`, `AGENTS.md`. 30 new tests.

### Breaking changes

| Old | New |
|---|---|
| `GET /api/images/content/...` anonymous | Requires a session |
| `path` form field silently coerced to `content` | 400 for an unrecognised value |
| `/api/upload` could write to `mapp-team/` | Admin only |
| `S3_CONFIG.paths` had 3 entries | 4, including `public` |
| `'content' \| 'mappTeam' \| 'temp'` unions | `S3PathName` from `config/prefixes` |

If your app renders S3 images on a **logged-out** page, those objects must move
to `public/` — see the retrofit prompt, which walks the move.

### Known limitation (deliberately not fixed here)

`S3ImageService.getPublicUrl()` returns a **direct** S3 or CloudFront URL, stored
on the `S3Image` record, that bypasses this app and therefore all of the above.
It fails closed only because the bucket blocks public access. The template's
buckets are created by hand (`aws s3 mb`) rather than by CDK, so nothing verifies
that. **Check once per environment:**

```bash
aws s3api get-public-access-block --bucket mapp-labs-{appName}-{staging|prod} --profile labs-power
# all four settings must be true
```

---

## 2026-08-22 — Remove the pre-ECS docs and the EC2/PM2 deploy layer

**No action required for any fork.** Template-only cleanup: deletes documentation
and scripts for a deploy model the template abandoned when it moved to ECS
Fargate. **No code, schema, or infra changes** — nothing in a running app
depends on any of it. If your fork still deploys to a host with PM2, keep your
copies; this only removes the template's.

### Problem

`.guides/` was written in Feb 2026, before the ECS/CDK deploy path existed, and
was never updated. Nothing referenced it except a directory-tree line in
`GETTING_STARTED.md`. Two of its six files described infrastructure that no
longer exists:

- `4_AWS_DEPLOYMENT.md` (419 lines) documented deploying to **EC2 with PM2** via
  SSM. The app deploys to ECS Fargate with `make <env>-deploy`.
- `3_AWS_TUNNEL_SETUP.md` documented SSH-tunnelling to a **private RDS through an
  EC2 bastion**. RDS runs in public subnets and there is no bastion.

`5_TEMPLATE_UPDATES.md` (1011 lines) was the sharper hazard. Despite its name it
was a *customization* guide overlapping `docs/template/CUSTOMIZATION.md` — but an agent
looking for how to take template updates would find it by name and follow a
pre-capabilities document instead of this file plus
[`docs/retrofit/START-HERE.md`](docs/retrofit/START-HERE.md).

The PM2 layer had rotted rather than been maintained: all eleven `pm2:*` scripts
in `package.json` invoked `ecosystem.config.js`, while the file on disk was
`ecosystem.config.cjs`. Every one of them failed. `scripts/setup.sh` also tried
to rewrite an app name inside `ecosystem.config.cjs` during project setup.

### What changed

- **Deleted** `.guides/0_GITHUB_SETUP.md`, `1_FIRST_TIME_SETUP.md`,
  `3_AWS_TUNNEL_SETUP.md`, `4_AWS_DEPLOYMENT.md`, `5_TEMPLATE_UPDATES.md`.
  Superseded by `GETTING_STARTED.md`, `scripts/setup.sh`, `docs/template/DEPLOYMENT.md`,
  `docs/template/CUSTOMIZATION.md`, and the retrofit system.
- **Moved** `.guides/2_LOCAL_POSTGRES_SETUP.md` → **`docs/template/LOCAL-POSTGRES.md`**.
  It was the only guide with content not duplicated elsewhere (native PostgreSQL
  install on Windows); `GETTING_STARTED.md` Step 3 assumes Postgres already
  exists. `.guides/` is now gone.
- **Deleted** `.deploy/` (`connect-to-ec2.ps1`, `forward-rds-port.ps1`,
  `rds-keepalive.js`, `test-db-connection.js`), `ecosystem.config.cjs`, and
  `deploy.sh`.
- **`package.json`** — removed all eleven `pm2:*` scripts.
- **`scripts/setup.sh`** — removed the `ecosystem.config.cjs` rewrite step.
- **`GETTING_STARTED.md`** — project tree and Further Reading updated.
- **`.dockerignore`** / **`.gitignore`** — dropped entries for the removed paths.

### If your fork still deploys with PM2

Nothing here touches your app. Keep your `ecosystem.config.cjs`, `deploy.sh`, and
`pm2:*` scripts — but note the template's copies were broken (the `.js` / `.cjs`
mismatch above), so check yours resolve the right filename. The retrofit prompt
[`2026-06-18-internal-root-ca`](docs/retrofit/2026-06-18-internal-root-ca.md)
still treats a host/PM2 deploy as a supported shape and is unaffected.

---

## 2026-08-22 — SFTP capability (rewrite; fixes unauthenticated file read)

**Mandatory for any fork with `src/modules/sftp/`.** The SFTP module that
shipped in the template from the initial commit until today exposed an
**unauthenticated server action that returned any file the SFTP service account
could read**, and confined no path to `SFTP_ROOT_PATH`. It has been rewritten
and registered as the `sftp` capability. **Breaking:** every action signature
changed and two exports were removed. **No schema changes, no infra changes.**

▶ **Retrofit prompt:** [`docs/retrofit/2026-08-22-sftp-capability.md`](docs/retrofit/2026-08-22-sftp-capability.md)

### Problem

`downloadSFTPFileForCustomer(remotePath)` had no auth guard, while every other
export in the same file called `requireAdmin()`. Because it was an export of a
`'use server'` module, Next.js generated a callable action id for it: a public
POST endpoint, reachable with no session, with no UI referencing it, and not
covered by middleware. It returned the file base64-encoded.

Nothing confined the path. `getSFTPRootPath()` was only ever read to *display*
the configured root — no operation joined to it — and `normalizePath()` did not
resolve `..`. So a plain `/etc/passwd` reached the server untouched, and any
caller inherited the service account's full read scope.

Three further problems in the same module: no host key verification (any host
key accepted, a MITM path to the credential), no server-side size or extension
limits (both were enforced only in the upload component, so calling the action
directly bypassed them), and `uploadSFTPFile` doing a recursive `mkdir` plus
write at an arbitrary caller-supplied path.

The module was never wired into the template — no route imported it — so the
bare template was not itself exploitable. **Forks that use the module are.**

### What changed

- **`src/modules/sftp/lib/paths.ts`** (new) — the single confinement chokepoint.
  Segment-walking resolver that actually resolves `..` and rejects escapes
  rather than clamping them. All paths in the module's API are now **app-relative**:
  `/` means the app's SFTP area, never the remote filesystem root.
- **Per-app encapsulation** — the effective root is
  `{SFTP_ROOT_PATH}/{appName from app.config.json}`, mirroring how `data_sync`
  isolates apps in S3 (`config/{envSlug}/{appSlug}/`). Two apps on the same SFTP
  host can no longer overwrite each other. **Unlike `data_sync`, this is
  enforced in code, not by IAM** — the real boundary is chrooting the service
  account. `SFTP_DISABLE_APP_PREFIX=true` opts out for counterparty-dictated
  layouts.
- **`lib/actions.ts`** — `downloadSFTPFileForCustomer` deleted. Every remaining
  export is gated at editor-level admin via `getAdminSession()` (not
  `requireAdmin()`, whose `redirect()` throws `NEXT_REDIRECT` inside an action).
  All return an `SFTPOperationResult<T>` envelope, with internal errors logged
  server-side and reported generically so remote paths don't leak to the browser.
- **`lib/client.ts`** — host key pinned via `SFTP_HOST_FINGERPRINT` (required;
  `SFTP_ALLOW_UNKNOWN_HOST_KEY` is dev-only and refused in production),
  `diffie-hellman-group14-sha1` dropped from the kex list, a `withSFTP()` scope
  helper so connections can't leak, and a stat-then-cap on download.
- **`lib/policy.ts`** (new) — pluggable transfer policy (`allowWrites`,
  `allowedUploadExtensions`, `maxFileBytes`), same seam convention as
  `customer-eligibility.ts`, enforced **server-side** in `uploadSFTPFile`.
- **`lib/utils.ts`** — `normalizePath` / `joinPath` / `getParentPath` removed.
  They looked like sanitizers but weren't; display formatters only now.
- **`server.ts`** (new) — non-action entry point for jobs and API routes that
  move files themselves.
- **`deleteSFTPFile`** removed (it was a stub that always returned failure).
- Capability paperwork: `docs/template/capabilities/SFTP.md`, `_registry.json`,
  `.env.example`, `scripts/setup.sh`, `AGENTS.md`.
- Tests: `src/modules/sftp/lib/__tests__/` — 37 cases, mostly traversal.

### Breaking changes

| Old | New |
|---|---|
| `downloadSFTPFileForCustomer(path)` | **removed** (was unauthenticated) |
| `deleteSFTPFile(path)` | **removed** (was a non-functional stub) |
| `listSFTPDirectory(path)` → listing, threw on error | → `SFTPOperationResult<SFTPDirectoryListing>` |
| `downloadSFTPFile(path)` | → `SFTPOperationResult<SFTPDownloadData>` |
| `uploadSFTPFile({remotePath, fileData, originalFilename})` | `uploadSFTPFile({directory, filename, fileDataBase64})` |
| `getSFTPRootPathConfig()` | `getSFTPAreaInfo()` |
| `normalizePath` / `joinPath` / `getParentPath` | **removed** — use `resolveSftpPath` |
| `<SFTPBrowser disableRootAccess>` | **removed** — `/` is the app root now |

### Not changed

`ROUTE_ACCESS_REQUIREMENTS` in `src/modules/auth/utils/access-control.ts` keeps
its `/admin/sftp` and `/admin/s3` entries even though the template has neither
route. Removing an entry there does not remove a requirement — `canAccessRoute`
falls through to `viewer` for unlisted routes, so deleting them would *downgrade*
those routes from `editor` to `viewer` in any fork that does have them.

---

## 2026-08-04 — Shared internal-API namespace is now per-environment (staging was reading PRODUCTION)

**Applies to every fork that calls an internal Mapp service (Client Catalog, UPC) —
i.e. anything with `INTERNAL_API_*` wiring. CDK + scripts + docs. No schema changes.**
Corrects the 2026-07-28 entry, and **retracts its step 5**.

### Problem

The 2026-07-28 change consolidated internal-API credentials into a shared SSM
namespace and introduced `const sharedSsm = "/mapp-labs"` in `infra/lib/stack.ts`. It
was built on this stated premise:

> There is one Company Management Service shared by all Labs apps **and all
> environments**, so this is a literal value, not a lookup.

**That premise is wrong.** Internal Mapp services are deployed per environment, and
the account data is unambiguous — every `*-stg` app points at INT, every `*-prod` app
at PROD:

| | Company Management Service | Keycloak `s2s` realm |
|---|---|---|
| staging | `k8s-int-01` | `idp-int.shortest-route.com` |
| production | `k8s-prod-01` | `auth.shortest-route.com` |

The `s2s` client id is `mapp-labs` in both realms, but **the secret differs**: the
production secret returns `unauthorized_client` against INT. (An unknown client id
returns `invalid_client`, which is how you can tell the two apart.)

So `/mapp-labs/*` was seeded with **production** values, while `sharedSsm` resolved to
that prefix for *every* environment. Two failure modes:

1. **Half-migrated app** — credential switched to shared (prod) but base URL still INT:
   fails with `401`. This is the visible symptom that surfaced the bug.
2. **Fully-migrated staging app** — both from `/mapp-labs/*`: **silently calls
   PRODUCTION** internal services with production credentials from staging. It
   succeeds, so nothing looks wrong. Step 4's "verify before cleanup" check cannot
   detect it, and step 5 then deletes the app's working INT credential.

Nobody appears to have completed step 5 — all per-app `INTERNAL_API_*` parameters are
still present across the fleet — so the working INT credentials are intact.

### What changed

- **`infra/lib/stack.ts`** — `sharedSsm` is now per-environment:
  ```ts
  const sharedSsm = shortEnv === "prod" ? "/mapp-labs" : `/mapp-labs-${shortEnv}`;
  ```
  Production keeps the unsuffixed prefix, so **prod apps are unaffected**. The comment
  claiming base URLs are "NOT per-environment" is corrected.
- **`scripts/deploy/setup-ssm-params.sh`** — the shared-secret presence check is
  env-aware, and no longer advises deleting the per-app params unconditionally.
- **`docs/template/INTERNAL-API.md`** — documents both prefixes, the per-env base URLs, the
  "never mix environments" rule, and that the INT secret's upstream source of truth is
  `CLIENT_MAPP_LABS_SECRET` on the INT Keycloak pod.
- **`.env.example`** — the INTERNAL_API / Client Catalog block now points local dev at
  **INT** (`/mapp-labs-stg/*`, `k8s-int-01`). It previously carried the PROD URL and
  the instruction "do not guess a per-env variant", i.e. local dev was aimed at
  production.
- **`MIGRATION.md`** — the 2026-07-28 entry carries a SUPERSEDED-IN-PART banner and
  its step 5 is retracted.

### New shared parameters (already provisioned — nothing to create)

Seeded and verified end-to-end (token issued against INT `s2s`, authenticated
`GET /v2/companies` against INT CMS returned `200`):

| Parameter | Type | Value |
|---|---|---|
| `/mapp-labs-stg/internal-api/client-id` | String | `mapp-labs` |
| `/mapp-labs-stg/internal-api/token-url` | String | `https://idp-int.shortest-route.com/realms/s2s/protocol/openid-connect/token` |
| `/mapp-labs-stg/internal-api/client-secret` | SecureString | INT `s2s` secret |
| `/mapp-labs-stg/catalog/cms-base-url` | String | `https://company-management-service.k8s-int-01.nbg.webtrekk.com/gum-service/api` |

Production continues to use `/mapp-labs/internal-api/*` and
`/mapp-labs/catalog/cms-base-url` unchanged.

### Action for existing forks

Record under `.retrofit-state.json` id **`2026-08-04-per-env-shared-internal-api`**.

**Which case am I in?** Determine this from the repo alone — no AWS calls needed:

```bash
grep -n 'sharedSsm' infra/lib/stack.ts
```

| Result | State | Action |
|---|---|---|
| `const sharedSsm = "/mapp-labs"` (hardcoded) | migrated, **affected** — staging reads production | apply this entry |
| `shortEnv === "prod" ? "/mapp-labs" : ...` (ternary) | already applied | nothing to do |
| no match, and `setup-ssm-params.sh` seeds `INTERNAL_API_*` | not yet migrated — safe | apply the code changes; switching is optional |
| no match, and no `INTERNAL_API_*` anywhere | app calls no internal service | not applicable |

**If you already migrated to the shared credential** (hardcoded `sharedSsm` above):

1. Port the `sharedSsm` change from `infra/lib/stack.ts`, plus the
   `setup-ssm-params.sh` and `.env.example` changes.
2. `make staging-infra-diff` — you should see the staging task definition's `Secrets`
   ARNs and execution-role policy move from `/mapp-labs/internal-api/*` to
   `/mapp-labs-stg/internal-api/*`. **Production should show no change.**
3. `make staging-infra-deploy`, then `make staging-deploy` so the task restarts.
4. Verify an authenticated Client Catalog call succeeds **and** that it hit INT — check
   the resolved `CLIENT_CATALOG_BASE_URL` contains `k8s-int-01`, not `k8s-prod-01`.
   This is the check the previous entry was missing.

**If you have not migrated yet** (still on `/{appName}-stg/INTERNAL_API_*`): you are
in the safe state. Apply the code changes above, then switch — or stay as you are;
per-app parameters keep working.

**Either way: do not delete `/{appName}-stg/INTERNAL_API_*` yet.** Keep them until the
app is verifiably reading `/mapp-labs-stg/*` and calling INT. They are the fallback if
the shared path is misconfigured.

### Note

`/csm-copilot-stg/INTERNAL_API_CLIENT_SECRET` differs from the INT secret every other
staging app uses — possibly a dedicated client, possibly stale. If that is your app,
confirm which before switching to the shared value.
---

## 2026-08-04 — Maintenance deploy path (`make <env>-deploy-maintenance`)

**Applies to every fork.** New opt-in deploy path for releases whose database
migration the running image cannot survive. **No schema changes, no infra
changes** — three new scripts, two new Makefile targets, and docs. The default
`make <env>-deploy` is unchanged and stays the everyday path.

▶ **Retrofit prompt:** [`docs/retrofit/2026-08-04-maintenance-deploy.md`](docs/retrofit/2026-08-04-maintenance-deploy.md)

### Problem

`full-deploy.sh` builds, rolls the ECS service, then migrates. The service never
goes down, but for a short window an *outgoing* task serves requests against the
*new* schema. For additive migrations that is harmless and it is the right
default. For a rename, a drop, or a backfill that must not race with live
writes, it means the old code meets a schema it does not understand — 500s at
best, wrong writes at worst.

Ported from **FTL** (`labs-trends`), where a `Trends` → `Derived Attributes`
release contained an in-place table rename and needed a deploy path that
guarantees nothing is serving while the migration runs. FTL initially made the
maintenance path the *only* path (`make <env>-deploy` drained the service on
every release); that was reverted, and both paths now exist side by side with
rolling as the default. The template ships the reverted, two-path shape.

### What changed

- **`scripts/deploy/maintenance-deploy.sh`** (new) — gate every application load
  balancer with a fixed `503` at listener priority 1, quiesce the app's own
  scheduled EventBridge rules, drain the service to zero and wait for **every**
  task in the family to stop, build/push, verify the published ECR tags all
  resolve to one manifest digest, start exactly one new-image task behind the
  gates, run `prisma migrate deploy` through ECS Exec, then restore capacity,
  deployment config, schedules and listeners.
- **`scripts/deploy/runtime-image-verification.sh`** + **`resolve-runtime-image-digest.py`**
  (new) — the digest/platform checks that confirm the gated task is running
  *this* release's `linux/amd64` image. ECS may report either the OCI index
  digest or the selected child-manifest digest for the same image; both verified
  forms are accepted and nothing else is.
- **`Makefile`** — `staging-deploy-maintenance` / `prod-deploy-maintenance`; the
  help text now distinguishes rolling from maintenance.
- **`scripts/deploy/full-deploy.sh`** — header explains it is the rolling path
  and points at the maintenance path for breaking migrations.
- **`scripts/deploy/__tests__/maintenance-deploy.test.ts`** (new) — contract
  tests for the ordering and safety properties (gate → drain → migrate →
  verify → reopen) plus real execution of the pure helpers.
- **`docs/template/DEPLOYMENT.md`** — "Deploying Updates" now documents both paths, the
  fail-closed behaviour, the optional env vars, and **how to write migrations so
  neither path can half-apply**.
- **`AGENTS.md`** — new "Choosing a Deploy Path" section. `make <env>-deploy`
  stays the default and agents must not substitute the maintenance path on their
  own; they *suggest* it (rename, drop, a large batch of migrations at once,
  racing backfill, long lock holds), explain the trade-off, and let the app owner
  decide. The maintenance targets are also called out in the
  "require explicit confirmation" list as an ECS scale-to-zero.

Safety properties worth knowing before you use it:

- **It fails closed.** If anything after the drain fails, the service stays at
  desired count 0 and the gates stay up. The ECS circuit-breaker rollback is
  disabled for the window so ECS cannot resurrect the old revision against a
  migrated schema. A failed maintenance deploy is an outage to fix forward.
- A retry after a failed attempt must acknowledge that explicitly:
  `MAINTENANCE_RESTORE_DESIRED_COUNT=1 make staging-deploy-maintenance`.
- It works with **both** deploy models (`immutableDeploy` true or false) — the
  release tag it verifies follows whichever model the app is on.
- Schedule discovery only finds EventBridge **Rules** named `<app>-<env>-*` with
  a `ScheduleExpression`. Apps using EventBridge Scheduler, or off-prefix names,
  must pass `MAINTENANCE_SCHEDULE_RULES`. The template's own
  `<app>-<env>-ecs-task-state-change` rule is event-pattern based and stays
  enabled on purpose.

### Migration idempotency (the other half of the lesson)

This landed alongside a real incident in FTL: a multi-step migration that
created its indexes with bare `CREATE UNIQUE INDEX` failed partway through, and
every retry then died on `relation ... already exists`. Prisma had already
recorded the migration as failed, which blocked every later migration until it
was resolved by hand.

The maintenance path controls *who is running* during a migration; it cannot
save a migration that half-applies. Write DDL with `IF NOT EXISTS` / `IF EXISTS`
and make backfill `UPDATE`s idempotent. Production has more rows than staging,
so the slow passes are *more* likely to time out there — a migration that
survived staging is not evidence. Recovery, once you have verified by hand that
the end state is genuinely correct, is
`npx prisma migrate resolve --applied <migration_name>`. See
[`docs/template/DEPLOYMENT.md`](docs/template/DEPLOYMENT.md#deploying-updates).

### Action for existing forks

Nothing is required until you have a breaking migration — but adding it *before*
you need it is the point, since the alternative under time pressure is a
hand-composed sequence of `update-service` calls in a live incident. Run the
retrofit prompt above, or copy the three scripts and the two Makefile targets by
hand and adapt the cluster/service/ALB names to your app.

---

## 2026-08-04 — Keycloak redirect-URI registration was missing from the retrofit guides

**Applies to any fork that retrofitted Keycloak auth before 2026-08-04** (i.e. that
already has `keycloak-auth-internal-only` or `keycloak-auth-company-context` marked
`applied` in `.retrofit-state.json`). **No schema changes.** Fresh clones of the
template are unaffected — they already ship the wiring.

### Problem

Both Keycloak retrofit prompts
([`internal-only`](docs/retrofit/2026-06-10-keycloak-auth-internal-only.md),
[`company-context`](docs/retrofit/2026-06-10-keycloak-auth-company-context.md))
omitted the redirect-URI registration step. Their deploy-wiring step said to port
`infra/lib/stack.ts` and `scripts/deploy/setup-ssm-params.sh`, and stopped there —
neither guide mentioned `scripts/deploy/register-keycloak-uris.sh` or the
`kc-registrar` service account at all.

A fork that followed those guides therefore ends up with Keycloak fully configured
but **no way for its hostname to reach the shared `labs-portal` client**. Login
fails with "Invalid redirect URI" even though every env var is correct, and the
cause is non-obvious: the app's own SSM namespace holds only the `labs-portal` OIDC
client secret and no admin-capable credential, which reads like a permissions
problem requiring the labs-platform team. It isn't — the `kc-registrar` service
account has been provisioned in shared SSM (`/labs/kc-registrar/*`) since
2026-05-22; the guides just never told anyone to use it.

### What changed

- **Both Keycloak retrofit prompts** — deploy-wiring step now includes an explicit
  "Redirect-URI registration (REQUIRED — easy to miss)" bullet: copy
  `register-keycloak-uris.sh` and wire it as a post-deploy step, with the failure
  symptom and the `jq` + Mapp VPN runtime requirements.
- **`docs/template/KEYCLOAK.md`** — the "this happens automatically as part of
  `make staging-deploy`" claim is now qualified (true for recent clones, not for
  retrofitted forks) with a one-line `grep` to tell which case you are in, plus a
  new subsection answering *"My app's SSM only has the client secret — how do I
  register my URI?"*.
- **`AGENTS.md`** — new "Do NOT Invent Blockers" section, so an agent that finds no
  admin credential investigates instead of escalating, and handles both the
  script-present and script-absent (retrofitted) cases.

### Action for existing forks

There is no dedicated retrofit prompt — this is small enough to follow inline (the
orchestrator handles such entries directly per
[`docs/retrofit/START-HERE.md`](docs/retrofit/START-HERE.md)). Record it in
`.retrofit-state.json` under the id **`2026-08-04-keycloak-uri-registration`**.

Steps 1–2 are file edits (safe for an agent). **Step 3 runs an AWS/Keycloak command —
that is the app owner's step, staging first, never the agent's.**

Check whether this app can register its own redirect URI:

```bash
grep -rn "register-keycloak-uris" scripts/deploy/
```

**If that matches, you are done** — nothing to do.

**If it returns nothing**, (1) copy the script from the template and wire it in:

```bash
cp <TEMPLATE_PATH>/scripts/deploy/register-keycloak-uris.sh scripts/deploy/
chmod +x scripts/deploy/register-keycloak-uris.sh
```

(2) Add it as a post-deploy step in this app's deploy script — in the template it is
`full-deploy.sh` step 4/4 and `first-deploy.sh` step 7/7. Prefer the app-deploy path
over the infra-deploy path, so registration also runs on an app-code-only redeploy.

(3) **App owner only — not the agent.** Register the URI (needs `jq` and Mapp VPN, as
the Keycloak admin host is internally routed):

```bash
bash scripts/deploy/register-keycloak-uris.sh staging
```

A second run should report `(no changes — all entries already present ...)`. Once the
URI is registered and login verified, set `KEYCLOAK_ENABLED=true` in this app's SSM
if it is still `false`.

Escalate to labs-platform **only** if the shared `/labs/kc-registrar/*` parameters
are absent or the token request returns `401 invalid_client`.

---

## 2026-08-01 — Cost tag hygiene (`AppOwner` tag + ECS task tag propagation)

**Applies to every fork. No schema changes.** Makes each app's AWS spend attributable
to the app and to a person in the monthly cost report. An agent-runnable prompt is at
[`docs/retrofit/2026-08-01-cost-tag-hygiene.md`](docs/retrofit/2026-08-01-cost-tag-hygiene.md).

### Problem

Two gaps in how apps tag their AWS resources, which together left a large share of
the Labs account's spend impossible to attribute to any app or person.

**1. Untagged Fargate compute.** AWS bills Fargate vCPU/GB-hours against the running
**task**, not the ECS service. Tags reach tasks only when the service sets
`propagateTags: SERVICE` + `enableECSManagedTags: true`. Many services had neither,
so their compute — normally an app's largest line item — billed with no `Project`
tag at all, while their ALB and RDS billed correctly. That makes an affected app
look dramatically cheaper than it is: some had **no ECS line whatsoever**, despite
running Fargate tasks around the clock.

**2. `CreatedBy` is not a person key.** In practice it accumulated several spellings
per person — `jane.doe`, `janed`, and `jane.doe@mapp.com` all count as different
people to the billing system — along with values that aren't people at all (team
names, `labs`). It also answers the wrong question: it records who *scaffolded* the
app, which drifts from who owns the budget as apps change hands.

### What changed

- **New `AppOwner` cost-allocation tag** — the app's *current* budget holder, and the key
  the per-person report groups on. `CreatedBy` stays as the historical record. `AppOwner`
  falls back to `createdBy` so an un-migrated fork still attributes to somebody.
  - `app.config.json` gains an `appOwner` field.
  - `infra/bin/infra.ts` adds `AppOwner` to `costAllocationTags`.
  - **Named `AppOwner`, not `Owner`, deliberately.** Many resources in this account
    already carry an AWS-set `Owner: AWSCloudFormation` (CloudFormation stamps it on
    ECS clusters), which we can't remove and which would swamp per-person grouping.
  - ⚠️ **`AppOwner` must be activated as a Cost Allocation Tag in payer account
    `787184414136` before it reaches Cost Explorer** — it can't be done from
    `labs-power`. Until then the report falls back to `CreatedBy` and says so. Tag
    anyway: activation is not retroactive.
- **Synth-time format warning** on `AppOwner` — warns if empty or not `firstname.lastname`.
  It **only warns**; a deploy must never fail because a name is formatted oddly.
- **New-app path also updated**, so a fresh fork is correct without any retrofit:
  - `scripts/setup.sh` prompts for the app owner (defaulting to the local part of
    your git email, which is usually already `firstname.lastname`) and normalizes
    pasted emails / spaces / underscores before writing `app.config.json`.
  - `scripts/deploy/_config.sh` exports `APP_OWNER`, falling back to `createdBy`
    exactly as `infra/bin/infra.ts` does, so out-of-band resources agree with
    CDK-created ones.
  - `scripts/deploy/first-deploy.sh` tags the ECR repo with `AppOwner`.
  - `docs/template/DEPLOYMENT.md` adds `AppOwner` to the S3 bucket tagging commands.
- **[`docs/template/platform/COST_TAGGING_PROMPT.md`](docs/template/platform/COST_TAGGING_PROMPT.md)** — a self-contained
  agent prompt for tagging systems **not** built from this template (hand-rolled
  stacks, console-created resources). No template checkout needed to run it.

> The monthly reporting itself is operator tooling and does not live in this
> template — apps only need to be tagged correctly. Nothing here requires you to run
> or read a report.

### What you need to do

1. Set `appOwner` in `app.config.json` — lowercase `firstname.lastname`, no `@mapp.com`,
   and a **human** rather than a team name. The report groups on the exact string.
2. Confirm **every** ECS service in your stack — including workers and sidecars added
   since your fork — sets `enableECSManagedTags: true` and
   `propagateTags: ecs.PropagatedTagSource.SERVICE`.
3. Deploy. **Tags only reach tasks started after the deploy**, so billing corrects
   gradually as tasks recycle rather than immediately.
4. Tag out-of-band resources (ECR, S3, and especially EBS volumes and Elastic IPs,
   the two most commonly missed).

### Caveats

**This improves August onward; it cannot fix July.** Tags only describe usage that
happens after they're applied. AWS's `StartCostAllocationTagBackfill` can replay tag
*activation* up to 12 months back, but it can only surface values that were already
on the resources — so it can recover a month in which you tagged but hadn't yet
activated, not a month in which the tag didn't exist. **Tag first, activate second.**

The report is intentionally tolerant of partial adoption — it gets better each month
as forks migrate, and never breaks because some haven't.

---

## 2026-08-01 — `sharp` bumped to 0.35.3 (libvips CVEs, reachable from image upload)

**Security fix. No schema changes.** Applies to **every fork** — `s3_images` is not an
optional capability, so every app built on this template has the affected code path.

### Problem

`sharp` resolved to `0.34.5`, which inherits four libvips CVEs
(CVE-2026-33327, CVE-2026-33328, CVE-2026-35590, CVE-2026-35591) — memory-safety bugs in
a native image parser.

This is runtime-reachable, not a build-time-only advisory:
`src/modules/s3_images/services/s3-image-service.ts` calls `sharp(buffer)` at six sites
over **user-uploaded file buffers**, exposed through `src/app/api/upload/route.ts` and
`src/app/api/admin/upload/route.ts`. The upload route requires a session and is rate
limited, but this template ships a **customer portal** as well as an admin dashboard, so
"authenticated" does not necessarily mean trusted internal staff. A malicious image
reaching a native decoder is a classic RCE surface.

### What changed

- `sharp` bumped `^0.34.5` → `^0.35.3` in `dependencies`.
- **Added a bounded override**: `"overrides": { "sharp": "^0.35.3" }`. This is necessary
  because `next@15.5.22` pins `sharp: ^0.34.3` as an optional dependency — bumping only
  the direct dependency would leave Next's image optimizer on a vulnerable nested `0.34.5`.
  With the override, `npm ls sharp` shows a single deduped `0.35.3`.
- `engines.node` tightened `>=20.0.0` → `>=20.9.0`, which `sharp@0.35` requires. The
  Docker image already runs Node 22.16, so nothing else changes.

### About that override

This template deliberately removed an `overrides` block on the same day (see the `cookie`
entry below), so re-adding one warrants a word. The `cookie` override was wrong because it
was **unbounded** (`>=0.7.0`, which eventually resolved to an ESM-only `cookie@2` and
500'd every page) and **redundant** (next-auth's own range already excluded the CVE).

This one is neither: it is bounded to `^0.35.3`, it is load-bearing (nothing else forces
Next's nested copy up), and the lockfile is now committed, so it cannot silently
re-resolve. **Remove it** once `next`'s own `sharp` range covers `>=0.35.0`.

### What was deliberately NOT fixed

`npm audit` still reports `postcss` (high) and a `prisma` → `@prisma/dev` →
`@hono/node-server`/`valibot` cluster (moderate). Both were assessed and left:

- **`postcss`** is build-time only, compiling the app's own CSS. Its advisories need
  attacker-controlled CSS or `sourceMappingURL` comments. Not runtime-reachable.
- **`@hono/node-server` / `valibot`** live inside `@prisma/dev`, Prisma's *local dev
  server*, which is never invoked in production. One advisory is Windows-only.

Both would need `npm audit fix --force` (breaking major bumps). `sharp` was the only
advisory where an attacker-controlled byte stream reaches vulnerable native code. Re-check
periodically with `make dev-deps-audit`.

### How to apply

```bash
# 1. Set sharp to ^0.35.3 in dependencies, add the overrides block, bump engines.node.
# 2. Regenerate and confirm there is exactly one sharp, deduped:
rm -rf node_modules package-lock.json && npm install
npm ls sharp --all      # expect 0.35.3 at root AND "0.35.3 deduped" under next

# 3. sharp ships platform-specific native binaries, so verify in the container,
#    not just locally:
docker build --platform linux/amd64 -t verify . && \
docker run --rm --platform linux/amd64 --entrypoint node verify \
  -e "const s=require('/app/node_modules/sharp'); console.log(s.versions.vips)"
```

### Note

`sharp@0.35` tightened its `exports` map — `require('sharp/package.json')` no longer
resolves. Nothing in this template imports a `sharp/` subpath, but check your fork if you
read sharp's manifest directly. The APIs used here (`sharp(buffer)`, `.resize()`,
`.webp()`, `.jpeg()`, `.metadata()`) are unchanged, verified against libvips 8.18.3 both
locally and in a `linux/amd64` container.

---

## 2026-08-01 — `make dev-check-all` is green on a fresh checkout again

**Lint-config change. No schema changes, no behavior changes.** Applies to every fork
that runs lint in CI or as a pre-commit gate. Optional otherwise.

### Problem

`npm run lint` failed with 19 errors on a clean checkout, so a newly scaffolded app had
a red `make dev-check-all` on day one. Nothing regressed — `eslint-config-next` floated
to `16.2.12` and `@typescript-eslint` to `8.65.0`, which turn on the React Compiler rule
set, and that set flags pre-existing template code. (This was previously invisible
because the lockfile wasn't committed; see the entry below.)

A red baseline is worse than it looks for a template: it trains builders to ignore lint,
and it buries the errors they actually introduce in 19 lines of pre-existing noise.

### What changed

Fixed the four errors that had a correct, zero-risk fix, and downgraded the rest to
warnings rather than refactoring untested UI:

- **`security/detect-non-literal-fs-filename` ×2** (`src/modules/auth/config/nextauth.ts`)
  — false positives. The path is `NODE_EXTRA_CA_CERTS`, written by our own container
  entrypoint from SSM, never user input, and the only operation is reading a CA bundle at
  boot. Now carries a scoped `eslint-disable-next-line` per call plus a comment saying why.
- **`@typescript-eslint/no-require-imports` ×3**
  (`src/modules/public_api/lib/__tests__/keygen.test.ts`) — legitimate. Those tests
  `jest.resetModules()` then re-`require("../keygen")` to exercise its module-init-time
  read of `config.app.environment`. `import` cannot express this: ESM imports hoist and
  cache, binding the module before the per-test `jest.mock()` takes effect. Now a
  file-scoped disable with that rationale.
- **`react-hooks/set-state-in-effect` ×12 and `react-hooks/immutability` ×2 → `"warn"`**
  in `eslint.config.mjs`.

### Why the React Compiler rules are warnings, not fixes

The 12 `set-state-in-effect` hits are three different idioms — an SSR mount guard in
`Modal.tsx`, prop-to-state sync in five admin modals, and genuinely derived state in four
more files — and they live in **nine files with zero test coverage**. Fixing them
"properly" (key-based remount, derive-during-render) is a multi-hour refactor of admin UI
verifiable only by manual clicking, in files every fork has already diverged from.

The 2 `immutability` hits are `MatchingKeyModal` calling `analyzeColumns` and
`findBestClientMatch` from effects declared above them. **This is safe at runtime** — the
effect callbacks run after the component body finishes, so the `const`s are initialized.
It is a refactor hazard, not a live bug, and the fix is a ~107-line block move that would
conflict in every fork for no behavior gain.

Warnings keep all 14 visible as a cleanup list without blocking the build. Builders are
expected to address them in their own app, where they own the components and can test the
changes.

### How to apply

Copy the `react-hooks` rule overrides from `eslint.config.mjs`, and the two disable
comments if your fork still has those files unchanged. If your fork already fixed some of
these properly, keep your fixes — the warnings simply won't fire.

To raise the bar back in your own app once you've cleaned up:

```js
"react-hooks/set-state-in-effect": "error",
"react-hooks/immutability": "error",
```

---

## 2026-08-01 — Lockfiles are now committed; `cookie` override removed (fixes 500s on fresh installs)

**Build/dependency change. No schema changes.** Applies to **every fork**. Urgent for
any fork scaffolded on or after ~2026-07-20, which may be serving 500s on every page.

### Problem

Two defects that compound each other.

**1. The `cookie` override was unbounded.** `package.json` carried
`"overrides": { "cookie": ">=0.7.0" }` with no upper bound. It was added in `bed4319`
alongside a `next-auth` bump, to move off the pre-0.7.0 advisory (CVE-2024-47764) —
but that same commit bumped `next-auth` from `^4.24.7` (which wanted `cookie@^0.5.0`)
to `^4.24.11` (which wants `cookie@^0.7.0`). The version bump already fixed the
advisory, so the override was redundant the day it landed.

It stopped being merely redundant when `cookie@2.0.0` shipped. `cookie@2` is
ESM-only (`"type": "module"`, no CommonJS entry point) and `next-auth@4` calls
`cookie.serialize()` as CommonJS. Any fresh resolve picked up `cookie@2.0.1`, and:

- Every page returned 500: `TypeError: (0, _cookie.serialize) is not a function`
  inside `getServerSession`.
- The `src/modules/auth` Jest suites failed to load: `SyntaxError: Unexpected token 'export'`.

`next-auth` is the *only* package in the tree that depends on `cookie` at all, and its
own `^0.7.0` range is both the security floor and an upper bound — so the override was
purely the thing causing the breakage.

**2. `package-lock.json` was gitignored**, which is why #1 could land silently.
Without a committed lockfile, every fresh clone re-resolved the entire tree against
whatever the registry held that day. Existing apps had `cookie@1.1.1` or `0.7.2`
already sitting in their untracked local lockfile and never re-resolved, so the bug
was invisible to everyone except people scaffolding a brand new app.

The same gap left `Dockerfile` **already broken on a clean checkout**: it does
`COPY package.json package-lock.json ./` with an explicit filename, and Docker `COPY`
hard-fails on a missing non-glob source. Every image build to date only worked because
it ran from a developer's working tree where an untracked lockfile happened to exist.

### What changed

- **Removed the `overrides` block** from `package.json` entirely. `next-auth`'s own
  `cookie@^0.7.0` constraint now governs: it excludes the CVE range and caps below
  `0.8.0`, so it can never reach the ESM-only 2.x. Resolves to `cookie@0.7.2`.
- **Committed `package-lock.json` and `infra/package-lock.json`**; removed the bare
  `package-lock.json` line from `.gitignore`.
- **Added `.gitattributes`** marking both lockfiles `merge=binary linguist-generated`,
  so retrofit merges don't produce a line-by-line lockfile merge that npm then chokes on.
- **`Dockerfile` now runs `npm ci --ignore-scripts`** instead of `npm install`. The old
  comment said `npm ci` crashed in the container with npm's "Exit handler never called!"
  bug — retested on `node:22.16.0-bookworm-slim` and it now installs cleanly.
- **Added `make dev-deps-audit` and `make dev-deps-update`** so the now-frozen tree gets
  refreshed deliberately instead of drifting.
- **Stopped `infra/dist` from polluting lint and test runs.** `infra/dist` is gitignored,
  but if it exists from a prior `cd infra && npm run build`, Jest's `testMatch` picked up
  the compiled `__tests__/*.js` copies (one suite failed with a bogus `app.config.json`
  `ENOENT`, because the relative path resolves differently from `dist/` than from source)
  and ESLint linted the generated `.js` as if hand-written — 32 spurious errors. Added
  `**/dist/**` to `eslint.config.mjs` ignores and `modulePathIgnorePatterns` to
  `jest.config.ts`.

### How to apply

```bash
# 1. Remove the override from package.json (delete the whole "overrides" block)
#    and the `package-lock.json` line from .gitignore.

# 2. Regenerate the lockfiles from scratch, so they reflect the removed override.
rm -rf node_modules package-lock.json && npm install
rm -rf infra/node_modules infra/package-lock.json && (cd infra && npm install)

# 3. Confirm cookie resolved to a CommonJS build with a working serialize.
node -e "console.log(require('cookie/package.json').version, typeof require('cookie').serialize)"
#    expected: 0.7.2 function

# 4. Switch the Dockerfile deps stage from `npm install` to `npm ci`.

# 5. Verify, then commit BOTH lockfiles.
npm run check-all && npx jest --testPathIgnorePatterns="\.db\.test\."
```

If your fork has diverged in `package.json`, and step 3 still reports a `2.x` version,
check for a local `overrides` entry before assuming the removal didn't take.

### Notes

- Copy `.gitattributes` and the two Makefile targets from the template if you want them;
  neither is required for the fix.
- Committing the lockfile freezes today's transitive versions. `npm audit` currently
  reports advisories in `next`, `sharp`, `postcss`, `@hono/node-server` and `valibot`
  that only clear with `npm audit fix --force` (breaking major bumps) — deliberately
  **not** taken here, since that is a separate decision from the reproducibility fix.
  This is not a regression: those same versions are what an un-pinned fresh clone was
  already installing. Handle them via `make dev-deps-audit` on a schedule.
- `infra`'s `brace-expansion` advisory is vendored inside `aws-cdk-lib` and cannot be
  resolved without bumping the pinned CDK version. Build-time surface only.
- **`npm run lint` also failed on a clean checkout** — 19 errors, mostly
  `react-hooks/set-state-in-effect`, from `eslint-config-next` floating to `16.2.12` and
  `@typescript-eslint` to `8.65.0`. Confirmed pre-existing and unrelated to the `cookie`
  removal: the pre-change `package.json` resolves the identical lint toolchain. It is the
  same drift class this entry fixes, and now that the lockfile is committed it is pinned
  in one place. **Addressed separately in the `make dev-check-all` entry above** — apply
  both together.

---

## 2026-07-28 — Internal-service credentials now referenced from shared SSM (no per-app copy); GUM connection details documented

> ### ⚠️ SUPERSEDED IN PART — corrected 2026-08-04. Read this before following the steps below.
>
> This entry assumed internal Mapp services are **environment-agnostic** ("one
> Company Management Service shared by all Labs apps and all environments"). **That
> is wrong.** There is an INT deployment (`k8s-int-01`, realm `s2s` on
> `idp-int.shortest-route.com`) and a PROD deployment (`k8s-prod-01`, realm `s2s` on
> `auth.shortest-route.com`), and the `s2s` secret differs between them.
>
> Because of that, the shared namespace described below (`/mapp-labs/*`) contains
> **production values only**, and the `sharedSsm` constant it introduced was
> hardcoded to that prefix for every environment. Two consequences:
>
> 1. A **staging** app that follows the steps below starts calling **production**
>    internal services with production credentials. It *works*, so the mistake is
>    silent — which is exactly why it went unnoticed.
> 2. **Do NOT run step 5 (deleting `/{appName}-stg/INTERNAL_API_*`).** Those per-app
>    parameters hold the correct **INT** credential. Step 4's verification cannot
>    detect the problem, because the production credential legitimately succeeds
>    against the production service.
>
> The fix — a per-environment shared prefix (`/mapp-labs-stg` for staging) plus an
> env-aware `sharedSsm` — is in the **2026-08-04 — Shared internal-API namespace is
> now per-environment** entry above. Follow that entry instead; it supersedes steps
> 1–5 here. The rest of this entry (the rationale for referencing shared SSM rather
> than copying per app, and the blast-radius discussion) still stands.

**Docs + infra change. No schema changes.** Applies to every fork that calls an
internal Mapp service (**Client Catalog**, **UPC**), and to any fork whose agent has
been asked to implement one.

### Problem

The docs described the Client Catalog API in full but never said **where the
connection details come from**. `docs/template/INTERNAL-API.md` said the client secret was
"obtained from the labs-platform team" and `.env.example` shipped
`CLIENT_CATALOG_BASE_URL=https://your-client-catalog-url`. An agent following those
docs had no self-service path to a working config — it would either stall asking the
app owner for values the owner doesn't have, or fill in a placeholder URL and produce
an integration that fails at the first call. Reported by a template user who "didn't
understand how to use the client catalog."

Underneath that was a real infra problem: the credential exists **once** per AWS
account in shared SSM, but `infra/lib/stack.ts` pointed the ECS task at app-scoped
`/{appName}-{env}/INTERNAL_API_*`, and `setup-ssm-params.sh` seeded the secret there
as a **placeholder**. Every app therefore carried its own copy that someone had to
hand-populate — and a rotation meant editing N apps.

### What changed

Nothing needs to be provisioned — both the credential and the base URL already exist.
Apps now **reference** them instead of copying them:

**Base URL — a known constant.** There is one Company Management Service shared by
all Labs apps and all environments, so this is a literal value, not a lookup:

```
CLIENT_CATALOG_BASE_URL=https://company-management-service.k8s-prod-01.nbg.webtrekk.com/gum-service/api
```

(Mirrored at `/mapp-labs/catalog/cms-base-url`, the source of truth if the host moves.)

**Credential — already in shared SSM**, provisioned once per AWS account:

| Shared SSM parameter | Env var |
|---|---|
| `/mapp-labs/internal-api/token-url` | `INTERNAL_API_TOKEN_URL` |
| `/mapp-labs/internal-api/client-id` | `INTERNAL_API_CLIENT_ID` (`mapp-labs`) |
| `/mapp-labs/internal-api/client-secret` | `INTERNAL_API_CLIENT_SECRET` (SecureString) |

Read with `--profile labs-power --region eu-central-1` (account `936190502406`).
`/mapp-labs/*` is read-only from an app's perspective; app-scoped params stay under
`/{appName}-{env}/*`.

Files updated:

- **`infra/lib/stack.ts`** — new `sharedSsm = "/mapp-labs"` constant; all three
  `INTERNAL_API_*` secrets now reference `${sharedSsm}/internal-api/*` instead of
  `/${prefix}/*`. CDK grants the task execution role read on the shared ARNs
  automatically. Also adds a commented-out `CLIENT_CATALOG_BASE_URL` in the task
  definition's `environment` block, sourced via
  `ssm.StringParameter.valueForStringParameter(this, `${sharedSsm}/catalog/cms-base-url`)`
  — a CloudFormation dynamic reference, since base URLs are non-secret constants.
- **`scripts/deploy/setup-ssm-params.sh`** — stops seeding `/{appName}-{env}/INTERNAL_API_*`
  entirely (including the placeholder secret). It now just verifies
  `/mapp-labs/internal-api/client-secret` is readable and warns if it isn't.
- **`docs/template/INTERNAL-API.md`** — new *Where the values come from — shared SSM* section
  with the credential table, `aws ssm` command, and the base-URL constant; *Deployment*
  section rewritten around direct shared references, including the rotation model
  (one write + restart each service, because ECS resolves secrets at task start) and
  the trade-off that a broken shared parameter breaks every app.
- **`docs/template/capabilities/CLIENT_CATALOG.md`** — new *Before you implement — get the
  connection details* section directly after the overview, split into "base URL is a
  constant, use it" and "credential comes from shared SSM"; env var table gained a
  **Value source** column.
- **`docs/template/capabilities/_registry.json`** — new `envVarSources` map on `client_catalog`
  and `upc` (machine-readable `ssm:` paths, since agents read the registry first).
- **`docs/template/capabilities/README.md`**, **`AGENTS.md`** — enable-a-capability steps now
  point at `envVarSources` / shared SSM, with an explicit "do not invent values, do not
  ask the app owner" rule and a new *Credentials for internal Mapp services* section.
- **`.env.example`** — placeholder URLs replaced with the `aws ssm` commands that yield
  the real values.

### How to apply

1. Copy the changed files above from the template. In `infra/lib/stack.ts`, port two
   things: the `sharedSsm` constant + the three `INTERNAL_API_*` `parameterName`
   changes, and (if the app uses the Client Catalog) the `CLIENT_CATALOG_BASE_URL`
   line in `environment` — uncommented.
2. `make staging-infra-diff` — you should see only the task definition's `Secrets`
   ARNs and the execution role policy changing from `/{appName}-stg/INTERNAL_API_*`
   to `/mapp-labs/internal-api/*`.
3. `make staging-infra-deploy`, then `make staging-deploy` so the task restarts and
   picks up the shared values.
4. **Verify before cleanup**: confirm the app can still reach the internal service
   (an authenticated Client Catalog / UPC call succeeds).
5. Only then delete the now-unused app-scoped params:
   ```bash
   aws ssm delete-parameters --names \
     "/{appName}-stg/INTERNAL_API_TOKEN_URL" \
     "/{appName}-stg/INTERNAL_API_CLIENT_ID" \
     "/{appName}-stg/INTERNAL_API_CLIENT_SECRET" \
     --profile labs-power --region eu-central-1
   ```
   Repeat for `-prod`. Leaving them costs nothing but is dead config.

**Note the blast radius change.** The credential is now a single shared parameter
behind every app. Rotating it is one write plus a restart of each app — but a bad
write breaks all of them. Treat `/mapp-labs/*` as production-critical, and never
write to it from an app stack or deploy script.

---

## 2026-07-11 — Deploy model correction: immutable task-def revisions are now opt-in (`iam:PassRole`)

**All forks deployed to AWS via CDK — corrects the [2026-07-10 entry](#2026-07-10--immutable-image-tags--ecr-lifecycle-policy).**
The 2026-07-10 change made **register-a-new-task-definition-revision-per-deploy the
default**, and that default is structurally un-runnable by the standard Mapp Labs
deploy identity. This entry makes it **opt-in** and restores the IAM-free default,
**without weakening the ECR lifecycle policy** (which is the part that actually
prevented the outage and needs no elevated IAM).

### Root cause

`RegisterTaskDefinition` requires **`iam:PassRole`** on the task role and execution
role embedded in the task def. The standard labs deployer is the **`labs-power`
profile → `AWSReservedSSO_PowerUserAccess`** SSO role, and AWS-managed
PowerUserAccess **denies all `iam:*`**. So the 2026-07-10 `deploy-app.sh`
(`describe → register-task-definition → update-service`) failed on **every** deploy:

```
An error occurred (AccessDeniedException) when calling the RegisterTaskDefinition
operation: User: .../AWSReservedSSO_PowerUserAccess-.../<user> is not authorized to
perform: iam:PassRole on resource: .../role/<app>-production-TaskRole... because no
identity-based policy allows the iam:PassRole action
```

The first adopter (the `ftl` app) hit this. Because every fork deploys with
`labs-power`, every fork adopting the retrofit would hit the same wall on every
deploy. Granting `PassRole` to the shared permission set is not an option here.

### What changed

1. **New single-source toggle `immutableDeploy` in `app.config.json` (default
   `false`).** The CDK stack (`infra/lib/stack.ts`) and `deploy-app.sh` (via
   `scripts/deploy/_config.sh`) both read this one committed value, so they never
   disagree about which image tag the task def uses.

2. **Default (`immutableDeploy: false`) — no `iam:PassRole`, restored pre-2026-07-10
   behavior.** The task def references the floating `${envName}-latest` tag again
   (built and pushed by `build-and-push.sh` alongside `${env}-${version}`), and
   `deploy-app.sh` deploys via `aws ecs update-service --force-new-deployment`. No
   `describe`/`register-task-definition`/`PassRole`. The image-exists-in-ECR precheck
   (a pure `ecr:DescribeImages` read) is preserved.

3. **Opt-in (`immutableDeploy: true`) — the 2026-07-10 behavior, intact.** The stack
   pins `${envName}-${APP_VERSION}` and `deploy-app.sh` runs the register-revision
   flow (immutability + `deploy-app.sh <env> <older-tag>` rollbacks). **This path
   requires `iam:PassRole`** on the app's ECS task/execution roles — enable it only if
   your deployer (e.g. a dedicated CI role) holds it. An admin can attach this scoped
   policy to the deployer's permission set (substitute `<ACCOUNT_ID>`/`<appName>`); the
   trade-off is that it lets that principal pass any matching `<appName>-*` role to an
   ECS task, bounded by the `ecs-tasks` condition:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Sid": "AllowPassAppEcsRoles",
       "Effect": "Allow",
       "Action": "iam:PassRole",
       "Resource": [
         "arn:aws:iam::<ACCOUNT_ID>:role/<appName>-*-TaskRole*",
         "arn:aws:iam::<ACCOUNT_ID>:role/<appName>-*-ExecutionRole*"
       ],
       "Condition": { "StringEquals": { "iam:PassedToService": "ecs-tasks.amazonaws.com" } }
     }]
   }
   ```

4. **The ECR lifecycle policy is unchanged and remains mandatory.**
   `set-ecr-lifecycle.sh`, its 3-rule policy, the `make ecr-lifecycle-*` targets, the
   `app.config.json` `ecrKeep*` keys, and the first-deploy wiring are all untouched.
   This is the IAM-free fix that actually prevents the outage.

### How to apply

A fork re-pulling the template gets the safe default automatically (no `PassRole`).
`build-and-push.sh` already pushes both `${env}-${version}` and `${env}-latest`, so
no build change is needed. Leave `immutableDeploy` off if you deploy with
`labs-power`. Only set it to `true` if a privileged deployer will run deploys and an
admin has attached the `PassRole` policy above. See
[`docs/template/DEPLOYMENT.md`](docs/template/DEPLOYMENT.md) → *Image Tags & Deploy Models*.

▶ Retrofit prompt: [docs/retrofit/2026-07-10-immutable-image-tags-ecr-lifecycle.md](docs/retrofit/2026-07-10-immutable-image-tags-ecr-lifecycle.md)
(updated to the corrected, opt-in model).

---

## 2026-07-11 — Dependency updates (security + Notion SDK v5)

**All forks (soft-mandatory — the security bumps; the Notion piece only affects
User Feedback apps).** A routine dependency refresh whose headline is a **HIGH**
severity fix and one **major** SDK jump. Nothing structural changed in the
template's own code — the only source edits were forced by the Notion SDK major.

### What changed

1. **`ws` → 8.21.0 (security, HIGH).** `ws` 8.0.0–8.20.1 has an uninitialized
   memory disclosure + a memory-exhaustion DoS
   ([GHSA-58qx-3vcg-4xpx](https://github.com/advisories/GHSA-58qx-3vcg-4xpx),
   [GHSA-96hv-2xvq-fx4p](https://github.com/advisories/GHSA-96hv-2xvq-fx4p)). It's
   a **transitive** dep (via `openai` at runtime and `jsdom` in tests), so there's
   no manifest line to bump — it's fixed by re-resolving the lockfile
   (`npm audit fix`, no breaking change). This cleared **all HIGH** advisories in
   the root project.

2. **`next` 15.5.18 → 15.5.20** (patch, in the 15.5.x line — **not** the 16.x
   major). Next patch releases routinely carry security fixes; stay current on the
   line, don't chase the major here.

3. **`axios` 1.16.1 → 1.18.1** (in-range minor; axios has a history of
   SSRF/redirect CVEs).

4. **Prisma 7.7.0 → 7.8.0** — `@prisma/client`, `@prisma/adapter-pg`, **and** the
   pinned `prisma` CLI moved together. The CLI is pinned to an **exact** version in
   `dependencies` (no caret), so it must be bumped explicitly or the three drift
   apart. `postinstall` regenerates the client.

5. **`@notionhq/client` 2.3.0 → 5.x (major — only matters if you have the User
   Feedback capability).** This is the one with real surface:
   - **v3** raised the Node floor to 18 (template requires ≥20 ✓) and switched to
     built-in `fetch`. No code impact.
   - **v4** removed the legacy pre-2021 page-`properties` shape. The template's
     `src/modules/user_feedback/lib/notion.ts` already uses the **new** polymorphic
     shape (`{ rich_text: [...] }`, `{ number }`, `{ email }`, …), so no change was
     needed. `NotionProperties` is *derived* from the SDK
     (`Parameters<NotionClient["pages"]["create"]>[0]`), so `tsc` is the guard that
     the payload still satisfies the SDK's types — it does.
   - **v5** defaults to Notion API version **`2025-09-03`**, which reshapes
     databases into a *database → data-source* model. The template's only call is
     `pages.create({ parent: { database_id }, … })`, which stays
     **backward-compatible for a database with a single data source** — the normal
     case for the shared "App Feedback" DB. **Caveat that automated tests can't
     catch:** `submit.test.ts` *mocks* `@notionhq/client`, so green tests prove the
     validation/payload logic, **not** a real write under `2025-09-03`. If that
     shared database is ever given **multiple data sources**, a `{ database_id }`
     parent will start failing and must become
     `{ type: "data_source_id", data_source_id }`. Do one real feedback submission
     against staging after adopting this.

6. **Removed `@types/sharp` (deprecated stub).** `sharp` has shipped its own type
   definitions since 0.32; the `@types/sharp` package is now a deprecated stub
   ("sharp provides its own type definitions, so you do not need this installed")
   that can only conflict with the real, bundled types. Dropped from
   `devDependencies`; `tsc` still resolves `sharp`'s types from the package itself.

7. **`infra/` CDK 2.160.0 → current (`aws-cdk-lib` 2.261.0, `aws-cdk` CLI 2.1130.0)
   — validated to need NO re-bootstrap.** The prior pin was believed to be
   bootstrap-bound; it is not. The live bootstrap in account 936190502406 is
   **version 29**, and `cdk synth` (both envs) requires only **6/8** — so a current
   2.x deploys against the existing bootstrap with ~21 versions of headroom. The
   real payoff is getting CDK's managed custom-resource Lambdas onto current
   runtimes (off the deprecated nodejs16/18). `aws-cdk` (CLI) and `aws-cdk-lib` are
   now on **separate version numbers** (the CLI decoupled after ~2.177), so they're
   no longer pinned to the same value. `cdk.json` feature flags are left **as-is**
   so no deployed resource behavior shifts. **Fleet-safe:** each fork owns its own
   `infra/package.json` pin and bootstrap is backward-compatible, so bumping the
   template changes nothing in already-deployed forks. **Note:** `cdk bootstrap`
   itself requires `iam:*` (CreateRole/PassRole), which the `labs-power`/PowerUserAccess
   deployer lacks — but since this upgrade needs no re-bootstrap, that limit doesn't
   block it. See [`docs/retrofit/2026-07-11-dependency-updates.md`](docs/retrofit/2026-07-11-dependency-updates.md)
   for the per-fork go/no-go check.

### Not taken (deliberately deferred)

- **`next-auth` 4.24.14 → Auth.js v5** — v4 is its *terminal* release and drags in
  the moderate `uuid@8` advisory ([GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq));
  `npm audit fix --force` would *downgrade* it to v3, which is wrong. The real fix
  is the v5 migration — a separate, breaking piece of work, and Auth.js v5 is still
  **beta** (`5.0.0-beta.x`; npm `latest` is 4.24.14), so it's tracked on its own and
  should wait for v5 GA.
- Majors left alone: `typescript` 7, `eslint` 10, `eslint-plugin-security` 4,
  `sharp` 0.35, `next` 16.

### How to apply

App deps: `npm install` the manifest bumps (2–5), then `npm audit fix` for the
transitive `ws` (1), and drop `@types/sharp` (6). Run `npm run type-check` and
`npm test` (349 tests). Infra (7): in `infra/`, bump the two CDK packages,
`npm install`, `npm run build`, then **`cdk synth -c env=<env>`** and confirm
`requiresBootstrapStackVersion` ≤ the live bootstrap version
(`aws ssm get-parameter --name /cdk-bootstrap/hnb659fds/version`) — if so, deploy
**staging first** after reviewing `cdk diff` (expect only benign custom-resource
Lambda runtime bumps). See the retrofit prompt below for the agent-runnable version.

▶ **Retrofit prompt:** [`docs/retrofit/2026-07-11-dependency-updates.md`](docs/retrofit/2026-07-11-dependency-updates.md)

---

## 2026-07-10 — Immutable image tags + ECR lifecycle policy

> **⚠️ Corrected by the [2026-07-11 entry](#2026-07-11--deploy-model-correction-immutable-task-def-revisions-are-now-opt-in-iampassrole).**
> Parts 1–2 below (immutable task-def pin + register-a-revision-per-deploy) required
> `iam:PassRole`, which the standard `labs-power`/PowerUserAccess deployer does not
> have — so they are now **opt-in** (`immutableDeploy` in `app.config.json`, default
> off) and the default deploy is again the floating `${env}-latest` tag +
> `update-service --force-new-deployment`. **Part 3 (the ECR lifecycle policy) is the
> mandatory fix and is unchanged.** Read the 2026-07-11 entry before following the
> steps below.

**All forks deployed to AWS via CDK (mandatory infra).** Finishes the job the
2026-05-04 entry started — that change env-scoped the image tag but left the ECS
task def pointing at the **floating** `${envName}-latest`, and flagged the
residual risk. On 2026-07-10 that risk landed: a bad `keep-10 / tagStatus:any`
ECR lifecycle policy on the `ftl` repo expired `production-latest` out of ECR.
The running task survived (ECS doesn't re-pull a running task), so the site
looked healthy — but **every new task launch** (scheduled feed syncs, `RunTask`,
restarts, redeploys) failed with `CannotPullContainerError: ...:production-latest:
not found`. Two independent defects had to be fixed together.

### What changed

1. **The ECS task def now references an immutable tag `${envName}-${APP_VERSION}`,
   never `${envName}-latest`** (`infra/lib/stack.ts`). The tag is derived from
   `package.json`'s `version` — the same source `build-and-push.sh` already uses —
   so the build, the CDK stack, and `deploy-app.sh` independently compute the
   identical tag with nothing threaded through CDK context / env / SSM (and no
   chicken-and-egg: `build-and-push.sh` runs before `cdk deploy` in both
   `full-deploy.sh` and `first-deploy.sh`). The `${envName}-` prefix keeps the
   tag inside the lifecycle keep-last-N rules below — a bare commit-SHA tag would
   escape them and accumulate forever.

2. **`deploy-app.sh` now registers a new task-definition revision per deploy**
   instead of `update-service --force-new-deployment`. It reads the service's
   current task def, swaps **only** the container image to
   `${ECR_URI}:${envName}-${APP_VERSION}`, strips the read-only fields, registers
   the revision, and points the service at it. This makes each deploy an explicit,
   diffable revision and gives real rollbacks (`./deploy-app.sh <env> <older-tag>`,
   or redeploy a prior revision). It also verifies the image exists in ECR before
   touching the service.

3. **New `scripts/deploy/set-ecr-lifecycle.sh` — an idempotent, three-rule ECR
   lifecycle policy** (`make ecr-lifecycle-set`). Forks *import* the ECR repo and
   both env stacks share the one repo, so CDK can't own its policy; the repo is
   created by the CLI in `first-deploy.sh`, and its lifecycle policy is now managed
   the same way (`put-lifecycle-policy` is a declarative full replace → idempotent).
   `first-deploy.sh` applies it automatically after creating the repo. The three
   rules, and why two is a trap:
   - **rule 10** — keep last **10** `production-*` (configurable),
   - **rule 20** — keep last **25** `staging-*` (configurable),
     *separate from production so staging build churn can never again expire the
     production image,*
   - **rule 30** — expire **untagged** images by **age** (`sinceImagePushed`, 14
     days), **not by count**. buildx pushes untagged child manifests / attestation
     objects that the prefix rules don't match; without this they pile up forever.
     An untagged-**by-count** rule is unsafe — it can delete a child manifest a
     tagged manifest list still references and break the image.

   Counts are per-project: `app.config.json` keys `ecrKeepProduction` /
   `ecrKeepStaging` / `ecrUntaggedDays`, or `ECR_KEEP_PRODUCTION` /
   `ECR_KEEP_STAGING` / `ECR_UNTAGGED_DAYS` env overrides.

`build-and-push.sh` still pushes `${envName}-latest` (health-check / human
convenience) — the **task def** just no longer depends on it.

### Upgrade steps

Pulling this update is a **no-op for the running app** — the code is inert until
you deploy, and the first deploy moves `-latest` → `-${version}`, which points at
the **same digest** the running task already uses (`build-and-push.sh` tags both
together). So it's an image-content no-op; only a new task-def revision.

1. Pull the template changes into `infra/lib/stack.ts`, `scripts/deploy/`
   (`deploy-app.sh`, `build-and-push.sh`, `full-deploy.sh`, `first-deploy.sh`,
   new `set-ecr-lifecycle.sh`), and the `Makefile` (`ecr-lifecycle-set` /
   `ecr-lifecycle-show` targets). Adapt to your app's naming.

2. **Set the ECR lifecycle policy on your existing repo** (this is the fix for
   the outage, and it's safe to run first):
   ```
   make ecr-lifecycle-show   # preview the policy + your current one, no changes
   make ecr-lifecycle-set    # apply it (idempotent — re-running changes nothing)
   ```
   If a fork already has a bad policy (e.g. the `keep-10 / tagStatus:any` that
   caused this), this **replaces** it.

3. **Move the task def onto the immutable tag — deploy once per env, staging
   first.** Do a full deploy so the `${envName}-${version}` tag is guaranteed
   present before the task def references it:
   ```
   make staging-deploy
   ```
   Then run `npx cdk diff -c env=staging` and confirm the **only** ECS change is
   the task-def image flipping `staging-latest` → `staging-<version>`. If the diff
   shows anything else surprising, stop and investigate.

4. Repeat for production once staging is verified:
   ```
   make prod-deploy
   npx cdk diff -c env=production   # only change: production-latest -> production-<version>
   ```

### Rollback

Deploys are now immutable revisions, so rollback is explicit:
`./scripts/deploy/deploy-app.sh <env> <env>-<older-version>` (e.g.
`deploy-app.sh production production-1.0.25`) — or redeploy the prior task-def
revision in the ECS console. To revert the mechanism itself, restore the old
`deploy-app.sh` and set the task-def image back to `${envName}-latest`; the
lifecycle policy is independent and can stay.

▶ Retrofit prompt: [docs/retrofit/2026-07-10-immutable-image-tags-ecr-lifecycle.md](docs/retrofit/2026-07-10-immutable-image-tags-ecr-lifecycle.md).

---

## 2026-07-08 — User feedback capability (Notion-backed, no in-app LLM)

**Optional — applies to forks that want in-app user feedback.** Adds a
`user_feedback` capability: a floating feedback widget for authenticated users
that writes each entry (rating, comment, category) straight to a shared Notion
"App Feedback" database. Reporter identity, app name, responsible person
(`app.config.json` `createdBy`), and company are auto-filled. **No Prisma model —
Notion is the system of record.** **No LLM runs in the app**; a centralized Notion
agent handles triage/categorization/digest out of band. See
[docs/template/capabilities/USER_FEEDBACK.md](docs/template/capabilities/USER_FEEDBACK.md).
▶ Retrofit prompt: [docs/retrofit/2026-07-08-user-feedback.md](docs/retrofit/2026-07-08-user-feedback.md).

### What changed

- **New module** `src/modules/user_feedback/` (compiled in base): `submitFeedback`
  + the Notion property builder + comment sanitization (strips control/invisible
  characters, caps at 2000 chars). Public barrel `@/modules/user_feedback`.
- **Copy-in scaffold** `src/modules/user_feedback/scaffold/` (`.example`): the
  `FeedbackWidget` and the `POST /api/feedback` route. Nothing renders until
  copied in and `<FeedbackWidget />` is mounted in the root layout.
- **npm** `@notionhq/client` added to `package.json`.
- **Registry** entry `user_feedback` (optional; no `schemaFragment`), `.env.example`
  stubs, `scripts/setup.sh` selector (option 7), and the AGENTS.md +
  `docs/template/capabilities/README.md` tables.
- **No schema migration.** No Prisma change and no per-fork Notion change — the
  shared "App Feedback" database already has every column, including `Company`
  (text, added 2026-07-08). Forks just point at the shared database.
- Rating is conditional — shown/required only for general feedback; hidden for
  bug/feature. Secrets (`NOTION_API_KEY`, `NOTION_FEEDBACK_DATABASE_ID`) are
  **shared** across all apps (SSM `/labs-shared/feedback/*`), so no per-app secret.

### How to apply to an existing fork

1. `npm install @notionhq/client`.
2. Copy `src/modules/user_feedback/` (module + `scaffold/`) from the template.
   Copy the two scaffold `.example` files into `src/components/feedback/` and
   `src/app/api/feedback/`, and mount `<FeedbackWidget />` in the root layout.
3. Set the shared `NOTION_API_KEY` + `NOTION_FEEDBACK_DATABASE_ID` (SSM
   `/labs-shared/feedback/*`) and grant the ECS task role read access.
4. Ensure `app.config.json` `createdBy` is set (it becomes "Responsible Person")
   and add `"user_feedback"` to `enabledCapabilities`. (The shared Notion database
   already has every column, including `Company` — no Notion schema change needed.)

## 2026-06-19 — UPC feeds + catalog-items layer (canonical-id routing)

**Applies to forks with the UPC capability.** Adds the product-catalog layer under
the companies/workspaces routes, as a copy-in scaffold with the UPC capability.
Depends on the client_catalog companies/workspaces scaffold (same date, below).
See [docs/template/capabilities/UPC.md](docs/template/capabilities/UPC.md) + [docs/template/ROUTING.md](docs/template/ROUTING.md).

### What changed

- **Schema fragment** (`upc.prisma.example`) reworked to a feed-aware shape:
  `Workspace` gains `upcCompanyId`/`upcWorkspaceId` + `feeds`; new **Feed** model
  (`upcFeedId @unique` = route key, `workspaceId` FK, `feedDataType`, locale); new
  **ProductCatalog** model (`feedId` FK, `externalId`, raw `data`,
  `@@unique([feedId, externalId])` — items unique **per feed**). Registry
  `prismaChanges` updated. (Was previously a naive single-model shape with
  `upcFeedId` on the workspace.)
- **Capability scaffold** `src/modules/upc/scaffold/` (`.example`, copied in on
  enable): `catalog-links.ts` (`feedPath`/`feedItemPath` + `feedHref`/
  `catalogItemHref`, dependency-free), `feed-routing.ts` (`resolveFeedByUpcFeedId`
  with scope guardrail, `resolveItemByExternalId` by composite key),
  `upc-catalog-actions.ts` (`syncWorkspaceFeeds` via `listFeeds`, `pullFeedProducts`
  via `getProductPage` keyset pagination), and the
  `…/workspaces/[workspaceId]/feeds/[upcFeedId]/item/[externalId]` routes (incl.
  passthrough layouts at the workspace + feed segments).
- Routes key on canonical external ids (`upcFeedId`, `externalId`); item detail is
  lean (raw `data`, no FTL trends/taxonomy).

### How to apply to an existing fork

1. Apply `client_catalog.prisma.example` then `upc.prisma.example`; `prisma migrate`.
2. Copy `src/modules/upc/scaffold/` into place per its `README.md`; add a "Feeds"
   link to the workspace detail page.
3. Set each `Workspace.upcCompanyId`; Sync feeds, then Pull from UPC.

## 2026-06-19 — Companies/workspaces admin moved into the client_catalog capability (canonical-id routing)

**Applies to all forks.** The base template no longer ships an accounts/companies
admin. The canonical external-id companies/workspaces admin now ships as a copy-in
scaffold with the **client_catalog** capability. Builds on the routing convention
below (same date). See [docs/template/ROUTING.md](docs/template/ROUTING.md) and
[docs/template/capabilities/CLIENT_CATALOG.md](docs/template/capabilities/CLIENT_CATALOG.md).

### What changed

- **Removed from base:** `src/app/admin/accounts/**`, `src/app/api/admin/accounts/**`,
  and the dashboard client (`src/app/admin/client.tsx`). The base admin dashboard
  (`src/app/admin/page.tsx`) is now empty. The "Accounts" nav entry is gone (a
  commented "Companies" entry documents how to re-add it).
- **Added capability scaffold** `src/modules/client_catalog/scaffold/` (`.example`
  files, copied in on enable — not compiled in base): boundary resolvers
  (`account-routing.ts` — `resolveCompanyByCompanyId`,
  `resolveWorkspaceByWorkspaceId` with the scope-field guardrail,
  `revalidateCompanyPaths`), dependency-free path builders (`company-links.ts`),
  discovery-driven server actions (`company-admin-actions.ts`), and the
  `/admin/companies/[companyId]/workspaces/[workspaceId]` routes (incl. the
  passthrough workspace `layout.tsx`).
- **Schema fragment reconciled** (`client_catalog.prisma.example`):
  `Account.clientCatalogCompanyId` is the canonical route key (`Int @unique`,
  nullable only for non-customer/hybrid builds); `Workspace.externalWorkspaceId`
  → `clientCatalogWorkspaceId` (route key) + `clientCatalogCompanyId` (scope +
  relation key). Registry `prismaChanges` updated.
- **Terminology:** routes are **companies/workspaces** (client-catalog terms), not
  accounts. Discovery-only — no manual "add company" path.

### Follow-up (done 2026-10-17)

The leftover CRM components/actions mentioned here (`AccountDetailLayout`, the
account modals, the account functions in `admin-actions.ts`,
`useAccountActivityLogs`) were removed from the template on 2026-10-17, and
`MemberCard` was kept and untangled. Nothing to do for forks; see
[the 2026-10-17 cleanup entry](#2026-10-17--template-cleanup-orphaned-crmsalesforce-code-and-dead-helpers-removed).

### How to apply to an existing fork

1. Apply the reconciled `client_catalog.prisma.example`; `prisma migrate`.
2. Copy `src/modules/client_catalog/scaffold/` into place per its `README.md`;
   add the "Companies" nav entry.
3. Remove your internal-id accounts routes / manual add-account UI; rely on
   discovery + the canonical-id routes.

## 2026-06-19 — App Router correctness: error boundaries, instrumentation, admin SSR + routing convention

**Applies to all forks.** Generic App-Router fixes plus the base for canonical
external-id routing. Two were **latent correctness bugs** every fork inherits.
See [docs/template/ROUTING.md](docs/template/ROUTING.md).

### What changed

- **Error boundaries now re-throw Next control-flow signals.** `AuthErrorBoundary`
  and `AdminErrorBoundary` previously caught everything — including the throws
  behind `notFound()`/`redirect()` — and rendered "Something went wrong" instead
  of a 404/redirect. New `src/lib/utils/next-errors.ts` `isNextControlFlowError()`
  (matches `error.digest` against `NEXT_HTTP_ERROR_FALLBACK*`, `NEXT_REDIRECT*`,
  `NEXT_NOT_FOUND`); both boundaries skip it in `componentDidCatch` and re-`throw`
  it in `render()`. **Prerequisite for any `notFound()`-based route resolver.**
- **`src/instrumentation.ts`** exports `onRequestError`, logging
  `message`/`digest`/`stack`/route via raw `console.error` — server-render errors
  are stripped from prod client bundles and otherwise never reach CloudWatch.
- **`src/app/admin/error.tsx`** — graceful Retry/Reload boundary for the admin
  segment (also handles post-deploy RSC/server-action skew).
- **Admin shell no longer gates `{children}` on client session.**
  `AdminLayoutClient` rendered only a spinner while `useSession().status ===
  "loading"`, but SSR status is always `"loading"` → no admin page's children
  ever server-rendered (broke deep routes, SEO, TTFB). It now always renders
  `{children}`; session state only drives chrome. Auth stays enforced
  server-side in `app/admin/layout.tsx`.
- **Routing convention + helper.** New `src/lib/admin/route-ids.ts`
  (`parseRouteId` + the scope-field guardrail rule) and `docs/template/ROUTING.md`
  establish canonical external-id routing. The companies/workspaces routes,
  schema columns, and resolvers that use it ship with the **client_catalog**
  capability (a later change), not the base template.

### How to apply to an existing fork

1. Copy `src/lib/utils/next-errors.ts`; in every custom React error boundary add
   the `isNextControlFlowError` skip (in `componentDidCatch`) and re-throw (in
   `render()`).
2. Copy `src/instrumentation.ts` (Next 15 picks it up automatically) and
   `src/app/admin/error.tsx` (restyle to taste).
3. Audit any client layout/shell that uses `useSession()`: ensure route
   `{children}` render regardless of session status; show loading as chrome only.
4. Copy `src/lib/admin/route-ids.ts` + `docs/template/ROUTING.md` for the routing
   convention (into `docs/ROUTING.md`, or `docs/template/ROUTING.md` in apps on the 2026-10-17 docs layout).

## 2026-06-18 — Shared internal-API OAuth credential (realm `s2s`)

**Applies to forks with the Client Catalog or UPC capability enabled** (and any
fork adding a new internal-Mapp-service integration). Standardizes all internal
API auth on **one** Keycloak realm-`s2s` client-credentials credential instead of
per-integration OAuth/Basic env vars. Pairs with the internal-root-CA vendoring
below. See [docs/template/INTERNAL-API.md](docs/template/INTERNAL-API.md).

### What changed

- **New shared provider** `src/lib/internal-api/oauth.ts` — `getInternalApiToken()`
  (client-credentials, per-issuer in-memory cache),
  `getInternalApiOAuthConfigFromEnv()`, and `clearInternalApiTokenCache()` for
  401 retries. Reads `INTERNAL_API_TOKEN_URL` / `INTERNAL_API_CLIENT_ID` /
  `INTERNAL_API_CLIENT_SECRET`. The shared Bearer + 401-clear-and-retry fetch
  wrapper `internalApiFetch` lives in `src/lib/internal-api/fetch.ts` (used by
  both internal clients).
- **Client catalog** (`src/modules/client_catalog/lib/`) now gets Bearer tokens
  from the shared provider. Removed `CLIENT_CATALOG_IDP_TOKEN_URL` /
  `CLIENT_CATALOG_CLIENT_ID` / `CLIENT_CATALOG_CLIENT_SECRET` and the client's
  private token cache (`clearTokenCache` export gone — use
  `clearInternalApiTokenCache`). `CLIENT_CATALOG_BASE_URL` and the QA-only
  `CLIENT_CATALOG_BASIC_*` fallback remain.
- **UPC** (`src/modules/upc/lib/`) switched from Basic Auth to the shared OAuth
  Bearer (with 401 refresh-and-retry). Removed `UPC_API_USERNAME` /
  `UPC_API_PASSWORD`; `UPC_API_BASE_URL` remains.
- **CDK** (`infra/lib/stack.ts`) wires `INTERNAL_API_TOKEN_URL` /
  `INTERNAL_API_CLIENT_ID` / `INTERNAL_API_CLIENT_SECRET` as
  `ecs.Secret.fromSsmParameter`.
- **`setup-ssm-params.sh`** seeds `INTERNAL_API_*` with env-aware defaults: token
  host `auth.shortest-route.com` (prod) / `idp-int.shortest-route.com` (lower),
  realm `s2s`, client id `mapp-labs`. Secret seeded as a placeholder — get the
  real value from the labs-platform team.
- **Docs/`.env.example`** updated; new `docs/template/INTERNAL-API.md`.

### How to apply to an existing fork

1. Copy `src/lib/internal-api/oauth.ts` and `src/lib/internal-api/fetch.ts`
   (`internalApiFetch` — the shared Bearer + 401-retry wrapper the clients use).
2. Repoint your client catalog / UPC clients (and any other internal client) at
   the shared provider; delete their per-integration OAuth/Basic token-url/
   client-id/secret env vars and private token caches. Keep only base URLs.
3. Add the `INTERNAL_API_*` trio to the CDK stack and re-run
   `make <env>-setup-ssm` (or `setup-ssm-params.sh`). Set the real
   `INTERNAL_API_CLIENT_SECRET` from the labs-platform team.
4. Confirm the realm-`s2s` client (`mapp-labs` by default) is authorized for the
   internal services you call — verified for both company-management-service and
   product-feed-service.

## 2026-06-18 — Trust the Mapp internal root CA at the image layer

**Applies to all forks.** Lets every app call internal Mapp HTTPS services
(`company-management-service`, `product-feed-service`, internal Keycloak, …)
without TLS errors and **without** per-app/per-service `*_CA_PEM` SSM secrets.
All internal ingress certs chain to one self-signed, public root,
`ca.internal.mapp.tools` (valid to 2034). See
[docs/template/INTERNAL-CA.md](docs/template/INTERNAL-CA.md).

### What changed

- **Vendored root** at `certs/ca.internal.mapp.tools.crt` (`.crt`, not `.pem`, so
  it isn't swallowed by the `*.pem` gitignore rule). Source of truth:
  `mapp-digital/devops-kube-ansible` → `roles/ca_certs/files/ca.internal.mapp.tools.crt`.
- **`Dockerfile` (runner stage)** now `apt-get install`s `ca-certificates openssl`,
  copies the cert into `/usr/local/share/ca-certificates/`, and runs
  `update-ca-certificates` (system trust store for non-Node tooling).
- **`scripts/docker-entrypoint.sh`** builds a single `NODE_EXTRA_CA_CERTS` bundle
  that **always** includes the vendored root and **additively** appends
  `KEYCLOAK_CA_PEM` when set (lone-space placeholder treated as empty). The root is
  never overwritten. `NODE_EXTRA_CA_CERTS` adds to — does not replace — the Mozilla
  roots.
- **Docs/notes** added in `docs/template/INTERNAL-CA.md`, `docs/template/KEYCLOAK.md`,
  `.env.example`, `infra/lib/stack.ts`, and `scripts/deploy/setup-ssm-params.sh`
  explaining that the internal root is vendored and that `KEYCLOAK_CA_PEM` is only
  for a Keycloak host NOT under the internal root.

### How to apply to an existing fork

1. Copy `certs/ca.internal.mapp.tools.crt` from the template (or from
   `devops-kube-ansible`). Verify it's a self-signed root:
   `openssl x509 -in certs/ca.internal.mapp.tools.crt -noout -subject -issuer`
   (subject must equal issuer).
2. Port the runner-stage `Dockerfile` block and the `docker-entrypoint.sh` CA-bundle
   block. (If your fork is on an Alpine base, use `apk add --no-cache ca-certificates openssl`
   instead of `apt-get`.)
3. Rebuild and redeploy. **No infra/SSM changes needed** — do *not* add `*_CA_PEM`
   parameters for internal services. Remove any you previously invented for them.

## 2026-06-18 — LLM: `MODELS.OPUS` bumped to Opus 4.8; attribution docs clarified

**Applies to forks with the LLM capability enabled.**

- **`MODELS.OPUS` now resolves to `anthropic/claude-opus-4-8`** (was `4-7`), the
  latest/most-capable Opus served by the proxy. The previous default is still
  available as the new pinned alias **`MODELS.OPUS_4_7`**; `MODELS.OPUS_4_6`
  remains. Any code using `MODELS.OPUS` will start routing to 4.8 on the next
  deploy — pin `MODELS.OPUS_4_7` if you need the old behavior.
- **Spend-attribution docs corrected** (`docs/template/capabilities/LLM.md`): customer
  attribution keys off the **client-catalog company id / workspace id** from
  `resolveUsageAttribution(session, { workspaceId })` — **not** the local
  `Account.id`. The `accountId`/`brandId` params are unchanged (they always meant
  the catalog company/workspace id), but the docs now make the source explicit to
  avoid mis-attributing spend. No code change required for this part.

## 2026-06-10 — Company Login (Keycloak / Mapp Cloud) + access-model rework

**Applies to all forks created before 2026-06-10.** Backports the generalizable
Keycloak IdP + Microsoft Entra + Mapp-Cloud "Company Login" + company-context
session-enrichment work (proven in FTL) into the template auth module. See
[docs/template/capabilities/COMPANY_LOGIN.md](docs/template/capabilities/COMPANY_LOGIN.md).

**▶ Retrofit prompts** (agent-runnable — point an agent at your app + a fresh
template checkout): for an app used **only by Mapp staff**,
[docs/retrofit/2026-06-10-keycloak-auth-internal-only.md](docs/retrofit/2026-06-10-keycloak-auth-internal-only.md);
for an app that also serves **Mapp Cloud customers**,
[docs/retrofit/2026-06-10-keycloak-auth-company-context.md](docs/retrofit/2026-06-10-keycloak-auth-company-context.md).
See [docs/retrofit/README.md](docs/retrofit/README.md).

### What changed

- **Keycloak claim helpers extracted** to `src/modules/auth/config/keycloak/claims.ts`
  (pure, unit-tested) including `deriveIsMappEmployee`. `nextauth.ts` imports them.
- **`MappSessionClaims`** is now the single source for the session/JWT/user
  enrichment fields in `src/modules/auth/types/index.ts` (replaces ~4 duplicated
  blocks). `keycloakIdToken` is **JWT-only** (never on `session.user`).
- **Fail-closed admin-vs-customer `signIn` fork**: `entra` (or `internal` +
  `mappLdapGroups`) → admin; `mapp-cloud`/unknown → customer. Adds
  `hydrateCompanyUser` alongside `hydrateInternalAdminUser`.
- **`CompanyUser` model + service** (`src/lib/prisma/services/company-user.ts`)
  for durable Mapp-Cloud customer identities + usage attribution.
- **Two app-specific seams** (template ships generic defaults):
  - `resolveAccountIdForCompany(companyId)` — company→local-Account mapping
    (`server/company-account-resolver.ts`), default returns `null`.
  - `CustomerEligibilityPolicy` — entitlement gate
    (`server/customer-eligibility.ts`), default **allow-all**.
- **`company-context` + `usage-attribution`** server helpers added.
- **Access model: pending/approval removed.** First Mapp user → active/admin,
  everyone after → active/viewer. `AccessStatus` is now `active|suspended|denied`.
  `accessStatus` is carried on the JWT and read by `require-auth` (no second
  per-request DB read).
- **Dev auth bypass** (`DEV_AUTH_ENABLED`, non-prod only) + `/auth/dev` page;
  **auth-debug** gated behind `AUTH_DEBUG_ENABLED` (on in dev).
- **Admin Company Users views** (settings-hub card + `/admin/company-users`
  paginated page + `/admin/accounts/[id]/users`), shown for apps with
  `KEYCLOAK_COMPANY_IDP_HINT` set.
- **Company Login is a toggleable capability** (`company_login` in
  `app.config.json`, env `COMPANY_LOGIN_ENABLED`, **default on**). Set it to
  `false` for a Mapp-internal-only app: the company-context customer login path
  is refused (fail-closed) and the admin Company Users views are hidden.
- **Two more capabilities registered** from this work: `dev_login` (local mock
  login without AWS/Keycloak) and `keycloak_api_auth` (accept KC bearer tokens on
  API routes; from CONNECT-1446, already in the template — now documented and the
  JWKS init hardened so a no-Keycloak build doesn't crash).
- **Magic-link is now an opt-in capability** behind `MAGIC_LINK_ENABLED`
  (default off), decoupled from `KEYCLOAK_ENABLED`.
- **Removed dead config**: `KEYCLOAK_REALM` (realm is in the issuer path) and
  `ADMIN_GRANULAR_ACCESS_CONTROL` (superseded by first-user-admin).
- **TLS-insecure prod gate**: `config.keycloak.tlsInsecure` is forced `false`
  when `NODE_ENV==='production'`.

### Migration steps

1. `npx prisma generate`, then apply migration
   `20260610120000_company_login_and_access_model` (`npx prisma migrate deploy`).
   It adds `company_user`, flips `mapp_team.access_status` default to `active`
   (and migrates existing `pending` rows), and adds the `mapp_team(lower(email))`
   functional index. **Drift caveat:** that functional index is not representable
   in `schema.prisma`; never accept a generated migration that drops
   `mapp_team_email_lower_idx`.
2. `.env`: drop `KEYCLOAK_REALM` and `ADMIN_GRANULAR_ACCESS_CONTROL`; add
   `MAGIC_LINK_ENABLED` (default `false`), `DEV_AUTH_ENABLED`, and optionally
   `AUTH_DEBUG_ENABLED`. Apps with an explicit CDK `secrets:` map must drop the
   `KEYCLOAK_REALM` SSM mapping (see `infra/lib/stack.ts`).
3. If your app maps companies to local accounts, override
   `resolveAccountIdForCompany`. If it has an entitlement requirement, install a
   `CustomerEligibilityPolicy`. Otherwise the defaults (no mapping, allow-all)
   are correct.
4. If you relied on magic-link, set `MAGIC_LINK_ENABLED=true` (it no longer keys
   off `KEYCLOAK_ENABLED`).

### ⚠️ Retrofit caution for live multi-user apps

The pending/approval removal means **new internal users are auto-active**. On an
app that previously gated new users to `pending`, taking this verbatim is a
security regression. Preserve your app's policy if you need approval — adopt the
first-user-admin model only when that's acceptable.

---

## 2026-05-26 — Model list refresh + self-service LiteLLM keys

**Applies to all forks created before 2026-05-26.** Brings the LLM model
constants in sync with what the proxy actually serves, and replaces the old
"file an ITHELPDESK ticket" key process with the self-service key portal.

### What changed

- **`src/modules/llm/lib/models.ts`** — reconciled against the proxy's live
  `/v1/models` (12 models). New constants `OPUS_4_6`, `GPT_5_5`, `GPT_5_5_MINI`,
  `GPT_5_5_NANO`. **`MODELS.OPUS` now resolves to `anthropic/claude-opus-4-7`**
  (was `claude-opus-4-6`) so the unversioned alias always means the latest/most
  capable Opus. The OpenAI `GPT_5_4*`/`GPT_4O*` constants are unchanged but are
  now framed as previous/older generations behind the new `GPT_5_5*` set.
- **`docs/template/capabilities/LLM.md`** — model table updated to match the constants;
  "Get a Virtual Key", the env-var table, and the 401 row now point to the
  self-service key portal instead of ITHELPDESK.
- **`scripts/setup.sh`** and **`scripts/deploy/setup-ssm-params.sh`** — the
  `LITELLM_API_KEY` hints now reference the self-service portal.
- **External usage guide** (the cross-language doc posted to Confluence/Notion)
  — model tables, key-acquisition steps, checklist, and FAQ updated the same way.

### Self-service key portal

Anyone at Mapp can now create as many LiteLLM virtual keys as they need, with no
ticket and no approval:
**https://infra-tools.deproxy.muc.domeus.com/ai-keys/gptkeyreq.php**

Note that each key carries a **default budget of $50/month**. Creating keys is
self-service, but **raising a key's budget cap is not** — that still requires an
ITHELPDESK ticket for the specific key. A key over its cap returns `429`
everywhere it's used (local, staging, production).

### Action for existing forks

- If any code relied on `MODELS.OPUS` meaning Opus **4.6**, switch those call
  sites to the new `MODELS.OPUS_4_6` constant. Leaving them on `MODELS.OPUS`
  will silently upgrade them to Opus 4.7.
- Update any internal runbooks/onboarding docs that still tell people to file an
  ITHELPDESK ticket for LLM keys — point them at the self-service portal above.

---

## 2026-05-26 — LLM streaming must set `stream_options: { include_usage: true }`

**Applies to all forks created before 2026-05-26.** Documents (and type-enables)
the one non-obvious requirement for streaming LLM calls: usage tracking. The
proxy is the source of truth for LLM spend, and a streaming call without
`include_usage` silently produces **no spend log** — it returns content fine,
so the failure is invisible until usage fails to reconcile.

### What changed

- **`src/modules/llm/lib/types.ts`** — `LLMCompletionParams` gains optional
  `stream?: boolean` and `stream_options?: { include_usage?: boolean }`, so a
  streaming call through `llmCompletion()` type-checks instead of needing a raw
  client cast.
- **`docs/template/capabilities/LLM.md`** — new **"Streaming and Usage Tracking"**
  section (concrete `llmCompletion` streaming example, what breaks without
  `include_usage`, why non-streaming is unaffected, and a "fail loudly, no
  untracked calls" rationale), a prominent ⚠️ callout in the Overview, the
  `stream`/`stream_options` params added to the `llmCompletion` table, and the
  existing advanced/raw-client streaming example fixed to include
  `stream_options: { include_usage: true }`.

### Action for existing forks

Audit any existing `stream: true` calls (both `llmCompletion()` and raw
`getLLMClient()` usage) and add `stream_options: { include_usage: true }`.
There is nothing to run — this is a code/usage convention, not a migration.

---

## 2026-05-22 — Cost allocation tags + AWS↔LiteLLM reconciliation

**Applies to all forks created before 2026-05-22.** Makes AWS spend
attributable per app / environment / product in billing reports, and aligns the
AWS tags with LiteLLM spend metadata so the two can be reconciled in a
billing/metering system.

**Convention (`Product` ⊃ `Project`):** the `Project` tag (= your `appName`) is
the **per-app billing line item** — every app is billed separately by
construction. The `Product` tag is a **rollup**: the Mapp product *line*
(`fashion` / `engage` / `intelligence` / `internal`) the app belongs to. Put the
product **line** in `product`, **not the app name** — the app already has its own
line via `Project`. See [docs/template/COST_ALLOCATION.md](docs/template/COST_ALLOCATION.md).

### What changed

- **New `product` field in `app.config.json`** (default `internal`). Holds the
  Mapp product *line* (rollup), not the app name. Drives the AWS `Product` tag
  *and* the container's `APP_PRODUCT` env var from one source so they never drift.
- **`infra/bin/infra.ts`** — cost tags added `Product` and **removed the
  duplicate `CostCenter`** tag; tags now applied at the **App level**
  (`cdk.Tags.of(app)`) instead of per-stack `StackProps.tags`, so any additional
  stack a project adds inherits them automatically. Empty values are skipped.
- **`infra/lib/stack.ts`**:
  - ECS service now sets `propagateTags: ecs.PropagatedTagSource.SERVICE` and
    `enableECSManagedTags: true` — **without this, Fargate compute usage (the
    biggest line item) carries no tags in the Cost & Usage Report.**
  - Container env now always sets `NEXT_PUBLIC_ENVIRONMENT: config.envName` and
    `APP_PRODUCT: config.product`. Previously `APP_PRODUCT` was a commented-out
    LLM-only line, and `NEXT_PUBLIC_ENVIRONMENT` was never injected — so the
    LLM module's `environment` attribution fell back to `NODE_ENV` (always
    `production`) and **mislabeled staging AI spend as production.**
- **`infra/lib/config/environments.ts`** — `EnvironmentConfig` gains `product`.
- **`scripts/deploy/{_config.sh,first-deploy.sh}`** — ECR repo is now created
  with `--tags` (`Project`, `Product`, `ManagedBy`).
- **`scripts/setup.sh`** — prompts for the product *line* (for every app, not
  just LLM apps) and writes it to `app.config.json`.
- **`infra/lib/config/__tests__/environments.test.ts`** (new) — guards that
  `product` is plumbed from `app.config.json` into every `EnvironmentConfig`.
  Runs under the existing root `npm test` (no infra test runner needed).
- **`docs/template/COST_ALLOCATION.md`** (new) — tagging model, the **DevOps runbook to
  activate cost allocation tags**, backfill steps, the AWS↔LiteLLM
  reconciliation model (incl. per-customer attribution via Client Catalog), and
  a **"Tagging infrastructure you add"** section: in-stack/new-stack additions
  are auto-tagged, a second Fargate service needs the propagation flags,
  out-of-band resources are tagged at creation, and **shared cross-project infra
  (VPC, Transit Gateway, Route53 zone, shared buckets) is never tagged.**
- **`AGENTS.md`** — new CDK rule that added infra must carry the cost tags (and
  shared infra must not), plus a **"Versioning on Deploy"** reminder: bumping the
  version is the user's choice, but the agent should remind them before a
  deploy-on-behalf (the version is baked at build time, so a bump must precede
  the build). Not mandatory; never auto-bump.
- Doc updates: `docs/template/DEPLOYMENT.md` (tagged ECR/S3 creation),
  `docs/template/capabilities/LLM.md`, `.env.example`.

### Upgrade steps

1. Add `"product": "<fashion|engage|intelligence|internal>"` to your
   `app.config.json` (between `dbName` and `team`). This is the product **line**
   — if the app already sets `APP_PRODUCT` for LiteLLM, use that exact value;
   never use the app name (the `Project` tag already covers that).
2. Pull the `infra/` changes (tags, `propagateTags`/`enableECSManagedTags`, the
   `NEXT_PUBLIC_ENVIRONMENT` + `APP_PRODUCT` env vars, the `product` config
   field). If you renamed the stack file, port the same edits. Per-stack
   `StackProps.tags` still works for a single-stack app; if this app defines
   **more than one stack** (or you want future stacks covered), move the tags to
   app-level `cdk.Tags.of(app)` as the template now does. Ensure any infra
   created **outside** the stack carries the tags too — but **never tag shared
   cross-project infra** (VPC, Transit Gateway, Route53 zone, shared buckets).
3. Redeploy: `make staging-infra-deploy` / `make prod-infra-deploy`. New Fargate
   tasks pick up the tags; old ones don't.
4. Backfill existing ECR/S3 tags — see "Backfilling already-deployed apps" in
   [docs/template/COST_ALLOCATION.md](docs/template/COST_ALLOCATION.md).
5. **Have DevOps activate the cost allocation tags** in the **management/payer
   account `787184414136`** (the labs deploy account `936190502406` is a member
   account and can't manage them). One-time, not retroactive — see the runbook
   in [docs/template/COST_ALLOCATION.md](docs/template/COST_ALLOCATION.md).

---

## 2026-05-14 — Data Sync capability (cross-environment config dumps)

**Applies to forks created before 2026-05-14. Optional — only adopt if your app has admin-editable config worth syncing between environments.**

A new optional capability lets an app dump its admin-editable config
(taxonomy, rules, settings — whatever the app treats as "config") to the
shared `mapp-labs-data-sync` S3 bucket and restore it in another
environment. Built specifically for refreshing staging from prod for
realistic testing; not a general-purpose S3 capability.

### What was added (purely additive — no existing files changed structurally)

- `infra/lib/constructs/data-sync-integration.ts` — reusable CDK construct
- `scripts/data-sync/{_shared,dump-config-to-s3,restore-config-from-s3}.ts.example` — script skeletons (Prisma+pg)
- `scripts/deploy/run-{dump,restore}-config-from-s3.sh.example` — ECS Exec wrappers
- `docs/DATA-SYNC.md` — operational guide
- `docs/capabilities/DATA_SYNC.md` — capability overview
  (2026-10-17: both merged into `docs/template/capabilities/DATA_SYNC.md`)
- New `data_sync` entry in `docs/template/capabilities/_registry.json` (introduces three new optional fields: `infraChanges`, `scriptsToCopy`, `operationalDocFile`, `constructFile`)
- New Data Sync section in `Makefile` (`{env}-dump-config-to-s3`, `{env}-restore-config-from-s3[-dry-run]`, `data-sync-list-dumps`, `dev-pull-config-dump`)
- Option 6 in `scripts/setup.sh` capability selector
- Cross-references in `AGENTS.md`, `docs/template/CUSTOMIZATION.md`, `docs/template/DEPLOYMENT.md`, and `docs/template/capabilities/{README,ADDING_CAPABILITIES}.md`

### Upgrade steps (only if you want to adopt the capability)

If you don't have config worth syncing between envs, skip this — nothing
breaks if you ignore the new files.

1. Pull the new files listed above into your fork.

2. In your CDK stack (`infra/lib/stack.ts` or whatever your project renamed
   it to), after the task role is created, instantiate the construct and
   inject the env vars on the container. See [docs/template/capabilities/DATA_SYNC.md](docs/template/capabilities/DATA_SYNC.md)
   for the exact snippet. Note the explicit `envSlug` translation: the
   data-sync bucket convention is `prod`/`staging`, not the
   `prod`/`stg` shortening used elsewhere in this template.

3. Copy the `.example` files (drop the suffix), `chmod +x` the shell
   wrappers, and fill in the TODO blocks:
   - `scripts/data-sync/_shared.ts` — list your `CONFIG_TABLES`
   - `scripts/data-sync/restore-config-from-s3.ts` — per-app FK filter
     / soft-FK nullouts / orphan cleanup

4. `make staging-infra-deploy && make prod-infra-deploy` to apply the new
   IAM grants and env vars.

5. Try it: `make prod-dump-config-to-s3`, then
   `make staging-restore-config-from-s3-dry-run`.

### Prerequisites this depends on

- Shared `mapp-labs-data-sync` bucket provisioned via the `mapp-labs-shared`
  template, with the SSM exports `/mapp-labs/shared/data-sync/bucket-name`
  and `/mapp-labs/shared/data-sync/bucket-arn` in your AWS account. If those
  SSM parameters aren't present, CDK synth will fail at deploy time — fix
  by deploying the shared template first.
- DB role with `rds_superuser` (RDS) or `superuser` (vanilla Postgres) to
  use `SET LOCAL session_replication_role = 'replica'`. The default RDS
  `postgres` user has this.

### What this is NOT

Don't try to extend this capability to also handle public-facing S3
(user uploads, customer exports, etc.). The IAM grants are deliberately
scoped to `config/{env}/{app}/*` with cross-app isolation. For other S3
use cases, provision a separate bucket and grants. The per-app
`mapp-labs-{app}-{env}` bucket the template already creates is the right
home for app-private data.

---

## 2026-05-04 — Per-environment image tags + Fargate `HOSTNAME` override

**Applies to forks created before 2026-05-04.**

Two structural fixes that surfaced together during a labs-trends incident:

1. **CDK ECS task def now references `${envName}-latest` instead of `:latest`.** The shared `:latest` tag coupled staging and production to the same ECR digest — a stale `:latest` would silently roll either environment on the next task restart, and retagging to fix one environment would move the other.
2. **Container env now sets `HOSTNAME: "0.0.0.0"`.** Fargate injects `HOSTNAME` to a non-resolvable task-id value, which makes Next.js standalone (`server.listen(port, HOSTNAME)`) ENOTFOUND on container start. Health checks fail silently.
3. **Build script pushes only env-scoped tags** (`${ENV}-${APP_VERSION}`, `${ENV}-latest`, plus the commit SHA). No shared `:latest` is pushed.

### Upgrade steps

1. Pull the template changes into your project's `infra/lib/stack.ts` (or whatever your project named it) and `scripts/deploy/build-and-push.sh`.

2. Run `npx cdk diff <staging-stack-name>` and confirm the only ECS-related change is the image reference flipping from `:latest` to `:${envName}-latest` (plus the `HOSTNAME` env var if you didn't have it). If the diff shows surprises, stop and investigate.

3. Run `npx cdk deploy <staging-stack-name>` and verify your `/api/health` (or equivalent) reports the version you expect.

4. Run the same `cdk diff` + `cdk deploy` for your production stack. This will be a no-op for the running app (`production-latest` resolves to whatever's already deployed) but corrects the task-def reference so the next `make production-deploy` actually rolls.

After both stacks are aligned, deploys are independent: `make staging-deploy` only ever pushes to `staging-*` tags and ECS pulls `staging-latest`; same for production. The `:latest` tag in ECR becomes irrelevant — you can leave it pointing at whatever.

### A note about rollbacks

This change does not introduce per-deploy immutable task-definition revisions. Rolling back is still done by re-pushing the desired image to `${env}-latest` and running `make ${env}-deploy` again. If you want clean per-deploy rollbacks (each deploy producing a new task-def revision pinned to its commit SHA), that's a separate enhancement — not in scope here.

---

## 2026-03-25 — Move to the shared MappLabs VPCs (Transit Gateway)

*(Documented 2026-07-20 — the template change landed on 2026-03-25 but never shipped a migration path; the first stranded fork surfaced it.)*

**Applies to forks created before 2026-03-25** — or any fork whose `infra/lib/config/environments.ts` still points `vpcId` at a standalone VPC (e.g. `vpc-019564bfe26ac6eeb`, now renamed **`mapp-labs-vpc-OLD`** in AWS).

The template originally scaffolded apps into a standalone VPC with **no Transit Gateway attachment** to Mapp's internal network. Apps there **cannot reach internal Mapp HTTPS services** — `product-feed-service` (UPC), `company-management-service` (Client Catalog), internal Keycloak — because internal hostnames (`*.int.k8s.muc.domeus.com`) don't resolve/route without the TGW path. It presents as DNS/connection failures, not auth errors.

Since 2026-03-25 the template deploys into the shared, **TGW-attached** VPCs (account `936190502406`, region `eu-central-1`):

| Env | VPC ID | Name | CIDR |
|---|---|---|---|
| staging | `vpc-093d8085c3684d09a` | MappLabs-Staging | 10.224.0.0/16 |
| production | `vpc-0b8d0ded5bc6f647e` | MappLabs-Production | 10.225.0.0/16 |

Both carry a live attachment to `tgw-0fb20738477b486dd`.

### Why this is more than a config edit

The stack imports the VPC via `Vpc.fromLookup`, so the change in code is a one-line `vpcId` swap per environment. **But `cdk deploy` will replace every VPC-bound resource — the RDS instance, its DB subnet group, the ALB(s), the security groups, and the ECS cluster — in the new VPC.** The database contents are **not** migrated automatically: you must `pg_dump` before and `pg_restore` after, or lose the data. SSM parameters are keyed by `/<appName>-<env>/...` and are VPC-independent, so they survive untouched.

Because this is a stateful, destructive, deploy-required migration (not the usual code-only change), it has a dedicated **ops-runbook** prompt with backup-first / staging-only / stop-and-confirm gates rather than the standard "don't deploy" handback.

**▶ Retrofit prompt:** [`docs/retrofit/2026-03-25-shared-vpc-migration.md`](docs/retrofit/2026-03-25-shared-vpc-migration.md)

### Gotcha

`infra/cdk.context.json` caches the `Vpc.fromLookup` result. A stale fork has the **old** VPC cached there; clear it (`cdk context --clear`) before deploying or CDK keeps resolving the old VPC. Commit the refreshed context after the first successful synth.
