# Retrofit prompt — Keycloak auth (company context / Mapp Cloud customers)

> Implements the **2026-06-10 "Company Login (Keycloak / Mapp Cloud) + access-model
> rework"** entry in [`MIGRATION.md`](../../MIGRATION.md), for the **company-context**
> case: an app that serves **Mapp Cloud customers** (external company accounts) in
> addition to internal Mapp admins. It moves internal admin login from **direct
> Microsoft Entra** to **Keycloak-brokered** login, **and** adds the company-context
> customer login path (companyId / tenantId / workspaces[].services), persisting each
> customer to a `CompanyUser` row for durable usage attribution.
>
> If this app is logged into **only by Mapp employees**, stop and use the smaller
> [`2026-06-10-keycloak-auth-internal-only.md`](2026-06-10-keycloak-auth-internal-only.md) instead.

---

## How to use this prompt

1. Pull a **fresh copy of `labs-app-template`** into a separate directory (do **not**
   overlay it on your app).
2. Open **your app** (the one being upgraded) in your agent.
3. Replace `<TEMPLATE_PATH>` below with the path to that fresh template checkout.
4. Paste everything from **PROMPT START** to **PROMPT END** into the agent.

```
<TEMPLATE_PATH> = /absolute/path/to/your/fresh/labs-app-template
```

---

## PROMPT START

You are upgrading the **current project** (an existing Mapp Labs app) to the
template's **Company Login** auth scheme: Keycloak-brokered login with **two paths
through one Keycloak provider** —

- **Mapp Entra ID** (internal Mapp admins), replacing this app's current **direct
  Microsoft Entra (Azure AD)** admin login, and
- **Company Login** (Mapp Cloud customers), whose session is enriched on login with
  `companyId`, `tenantId`, `roles[]`, `workspaces[].services[]` and persisted to a
  `CompanyUser` row for usage/spend attribution.

The authoritative reference implementation is a fresh checkout of
`labs-app-template` at:

    <TEMPLATE_PATH>

If that path is still the literal placeholder, is empty, or doesn't look like a
`labs-app-template` checkout (no `src/modules/auth/`, no `docs/template/capabilities/`),
**stop and ask me for the correct path before doing anything else.** Also remind me
that I should have pulled the **latest** version of `labs-app-template` into that
directory — if mine is stale, the rest of this will be wrong.

### Who I am

Assume I may **not** be a developer. I likely do not know how to use git branches or
run database migrations. **You** own those mechanics. When you finish, explain in
plain language what you changed and exactly what a technical person needs to check
before this goes live. Do not assume I can fill gaps myself.

### Operating principles (read these before touching anything)

1. **The template is the reference design, not a literal source to copy.** Apps
   built from this template have diverged in different ways. Match the template's
   **model, conventions, and security posture** — but adapt the implementation to
   how *this* app is actually structured.
2. **Above all, do not break this app.** A working app with old auth is better than a
   broken app with new auth. If a clean port isn't possible, do the safest partial
   port and tell me what you skipped and why.
3. **Copy verbatim only where it's clearly safe** (e.g. a new self-contained file
   that doesn't already exist here). Where this app already has its own version of
   something, port the *pattern* into the existing file rather than overwriting it.
4. **Surface every deviation.** Whenever you do something differently from the
   template because its exact approach would break this app, note it in your summary.
5. **My libraries may differ from the template's.** If this app is on a different
   major version of `next-auth`/NextAuth, Next.js, or Prisma than the template, do
   **not** blindly change versions. Adapt to what's here and flag the mismatch.
6. **Reuse SHARED infrastructure — never duplicate it per app.** Several pieces of
   the auth setup are shared across *all* Labs apps; changing one should never mean
   touching 50 apps. Do **not** create per-app copies of:
   - the shared Keycloak **`labs-portal` OIDC client** and its client-id/secret —
     they live in shared SSM (`/labs/labs-portal/*` on staging, `/labs-prod/labs-portal/*`
     on prod) and are **auto-copied** into this app's namespace by
     `make <env>-ssm-setup` only if missing. Never hand-mint a new Keycloak client
     or invent a new client secret.
   - the shared **IdP hints** (`mapp-entra-id`, `mapp-cloud-company`) — point at the
     shared aliases, don't define new ones.
   - the vendored **internal root CA** (`ca.internal.mapp.tools`, trusted at the
     image layer) — do **not** add a per-app `KEYCLOAK_CA_PEM` for any host that
     chains to it.
   - the shared **internal-API OAuth credential** (Keycloak realm `s2s`,
     `INTERNAL_API_*`) — this app's company→account mapping via `client_catalog`
     uses it; reuse it, don't create per-integration credentials.

   If you're about to create something that *looks* shared (a credential, cert, or
   OIDC client), stop and find the shared one instead. When in doubt, ask me.
7. **Keep libraries and patterns reasonably current — toward this template, not the
   bleeding edge.** A goal of the template is for apps to stay reasonably up to date.
   Prefer the versions and patterns in the reference template over staying on very old
   ones — but do **not** bump a dependency to the newest *public* release just because
   it exists. Versions newer than the template aren't validated here and carry
   supply-chain risk; the template's pinned version is the target. Flag any risky
   version change instead of silently making it.
8. **When something is genuinely complex, risky, or ambiguous and I can't answer,
   tell me to get help — don't guess.** For irreversible or high-stakes steps you're
   unsure about, stop and ask me; if I don't know either, point me to the Labs Slack
   channels **#topic-mapp-labs** or **#topic-ai-support**.

### Step 0 — Branch and assess (do this first)

1. Create a new git branch (e.g. `retrofit/keycloak-company-login`). All work goes
   here. Never commit straight to the main branch.
2. Read these in the **template** to understand the target design:
   - `<TEMPLATE_PATH>/docs/template/capabilities/COMPANY_LOGIN.md` — **the primary spec**: the
     two IdP hints, the three auth layers (identity / authorization / eligibility),
     fail-closed login routing, the two app-specific seams, usage attribution.
   - `<TEMPLATE_PATH>/docs/template/KEYCLOAK.md` — env vars, SSM wiring, CA handling,
     login-button selection, validation.
   - `<TEMPLATE_PATH>/docs/retrofit/KEYCLOAK-MIGRATION.md` — the internal Entra→Keycloak move
     (the admin half of this).
   - `<TEMPLATE_PATH>/docs/template/PERMISSION-LEVELS.md` and
     `<TEMPLATE_PATH>/docs/template/capabilities/DEV_LOGIN.md`.
   - The relevant `MIGRATION.md` entry dated **2026-06-10**.
3. Read the template auth module under `<TEMPLATE_PATH>/src/modules/auth/` — at
   minimum `config/nextauth.ts`, `config/keycloak/claims.ts`, `types/index.ts`,
   `server/internal-admin-auth.ts`, `server/company-user-auth.ts`,
   `server/company-context.ts`, `server/company-account-resolver.ts`,
   `server/customer-eligibility.ts`, `server/usage-attribution.ts`,
   `server/require-auth.ts`, `server/access-control.ts`, and the
   `components/*ErrorBoundary*` files. Also read
   `src/lib/prisma/services/company-user.ts`.
4. Find this app's **current** auth (NextAuth config, Entra/Azure provider, session
   typing, admin guards) and write a short plain-words assessment: what this app does
   today vs. the template. Show me this assessment before large changes if the
   divergence looks significant.

### ⚠️ Prerequisites & gotchas (check these — they can silently break the app)

These are **not** in this prompt's scope; they are dependencies. Detect whether this
app already has them and warn me if it doesn't:

- **Error boundaries must re-throw Next.js control-flow signals.** A custom
  `AuthErrorBoundary` / `AdminErrorBoundary` that catches *everything* will swallow
  the `redirect()` / `notFound()` throws the login + eligibility flow relies on (e.g.
  the redirect to `/account/get-started` for ineligible customers) and render
  "Something went wrong". Template fix: `src/lib/utils/next-errors.ts`
  (`isNextControlFlowError`) used in both boundaries. See the **2026-06-19**
  `MIGRATION.md` entry. Port it if missing.
- **Internal root CA / Keycloak TLS.** Keycloak backchannel calls must trust the KC
  host cert. Prod INT Keycloak (`auth.shortest-route.com`) uses a public chain; if
  your KC host is on the internal root you may need the vendored CA (the **2026-06-18**
  "internal root CA" entry) or, as a *temporary staging-only* escape hatch,
  `KEYCLOAK_TLS_INSECURE=true`. **Never** TLS-insecure in production — the template
  hard-forces it off there.
- **client_catalog (likely, for the company→account mapping).** The seam
  `resolveAccountIdForCompany(companyId)` typically maps a Mapp Cloud company to a
  local `Account` via `clientCatalogCompanyId`, which comes from the **client_catalog**
  capability. The template default returns `null` (customers still authenticate and
  attribute fine, just unlinked). If this app should link customers to local accounts
  but doesn't have client_catalog, tell me — that's a separate capability decision.
- **Access-model change is security-relevant** — see the next box.

### ⚠️ Access model: this REMOVES pending/approval (for internal users)

The template's access model is: **first Mapp user ever to log in → active admin;
everyone after → active viewer.** No pending/approval queue; `accessStatus` is
`active | suspended | denied`.

If this app **currently gates new internal users to `pending`**, adopting this
verbatim is a **security regression**. **Stop and ask me** whether to (a) adopt the
first-user-admin model, or (b) preserve this app's approval gate and take only the
Keycloak + company-context parts. Do not silently flip the access model.

> Note: this concerns **internal** users. Customer (Company Login) access is governed
> separately by the **eligibility policy** (below), not by `accessStatus`.

### Fail-closed login routing (do not weaken this)

`signIn` must fork by **how** the user logged in, never by email domain:
`identityProvider === 'mapp-cloud'` → **always a customer** (even with an
`@mapp.com` email); `'entra'` → internal admin; `'internal'` (unknown) → internal
admin **only** when corroborated by non-empty `mappLdapGroups`, otherwise customer.
Ambiguous identities get the *less*-privileged customer path. Preserve this exactly.

### Step 1 — Port the auth code

Bring **both** login paths into this app's auth module, matching the template pattern
and adapting to this app's structure:

- **Keycloak provider + callbacks** (`config/nextauth.ts`): the OIDC provider, the
  JWT/session callbacks that set the identity/authorization fields, the **fail-closed
  admin-vs-customer fork** in `signIn`, and the **CA-merge HTTPS agent** (must *merge*
  the Mozilla root store with any custom CA, never replace it). `keycloakIdToken` is
  **JWT-only** — never on `session.user`.
- **Pure claim helpers** (`config/keycloak/claims.ts`, incl. `deriveIsMappEmployee`)
  — unit-tested; bring in whole.
- **Session/JWT types** (`types/index.ts`): `MappSessionClaims` is the single source
  for the enrichment fields (`companyId`, `tenantId`, `workspaces[].services`,
  `authSource`, `identityProvider`, …). Reconcile with this app's existing types.
- **Internal admin hydration** (`server/internal-admin-auth.ts`) **and customer
  hydration** (`server/company-user-auth.ts` → `hydrateCompanyUser`),
  `server/company-context.ts`, `server/usage-attribution.ts`, plus `require-auth` /
  `access-control`. Keep this app's existing admin-guard call sites working.
- **The CompanyUser service** (`src/lib/prisma/services/company-user.ts`).
- Keep the **runtime switches**: `KEYCLOAK_ENABLED` (Keycloak vs legacy Entra
  fallback) and `COMPANY_LOGIN_ENABLED` (default ON — gates the customer path).

Bring the relevant **tests** (e.g. `claims.test.ts`, `company-customer.test.ts`,
`access-control.test.ts`, `first-login.test.ts`) and make them pass here.

### Step 2 — The two app-specific seams (this is where apps customize)

The template ships generic defaults; this app overrides **only** these two:

1. **`server/company-account-resolver.ts` → `resolveAccountIdForCompany(companyId)`**
   — maps a company to a local `Account`. Template default returns `null`. If this
   app maps companies to accounts (e.g. via `clientCatalogCompanyId`), implement it;
   otherwise leave the default and tell me customers will be stored unlinked.
2. **`server/customer-eligibility.ts` → `CustomerEligibilityPolicy`** — the
   entitlement gate. Template default is **allow-all**, enforced at the content layer
   (`requireEligibleCustomer()`), redirecting ineligible customers to
   `/account/get-started` (they still authenticate). If this app has an entitlement
   requirement (a specific `services` entitlement, a provisioned feed, etc.), ask me
   what it is and implement the policy; otherwise leave allow-all.

Ask me about both before guessing app-specific business rules.

### Step 3 — Database migration (generate, do NOT apply)

Reference `<TEMPLATE_PATH>/prisma/migrations/20260610120000_company_login_and_access_model/migration.sql`.
You need **all** of it for the company-context case:

- **`company_user` table** (durable Mapp Cloud customer identities; unique
  `(mapp_user_id, company_id)`; nullable `account_id` FK `onDelete SetNull`).
- `mapp_team.access_status` default → `active`, migrating existing `pending` rows
  (subject to the access-model decision above).
- The functional index `mapp_team_email_lower_idx` on `lower(email)`.

> **⚠️ Functional-index drift caveat.** The `lower(email)` index **cannot** be
> expressed in `schema.prisma`. `prisma migrate dev` can't see it and may generate a
> migration that **drops** it. Keep the raw-SQL migration and **never accept a
> generated migration that drops `mapp_team_email_lower_idx`.**

Add the `CompanyUser` model to `schema.prisma` (match the template's model). If this
app ships a **metering/LLM** capability, also add nullable `companyUserId` /
`companyId` / `workspaceId` columns (`onDelete SetNull`) to its usage tables and feed
them from `resolveUsageAttribution(session, { workspaceId })` (see COMPANY_LOGIN.md →
Usage attribution).

**Generate** the migration file but **do not run it** against any database. Leave it
staged for a technical reviewer.

### Step 4 — Config, env vars, and deploy wiring

- In `app.config.json`: ensure `company_login` **is** in `enabledCapabilities`.
- Set `COMPANY_LOGIN_ENABLED=true` (or leave unset — it defaults ON).
- Add/adjust env vars (see `<TEMPLATE_PATH>/.env.example` + `docs/template/KEYCLOAK.md`):
  `KEYCLOAK_ENABLED`, `KEYCLOAK_ISSUER`, `KEYCLOAK_CLIENT_ID`,
  `KEYCLOAK_CLIENT_SECRET`, `KEYCLOAK_IDP_HINT=mapp-entra-id`, **and**
  `KEYCLOAK_COMPANY_IDP_HINT=mapp-cloud-company` (this is what shows the Company Login
  button and enables the admin Company Users views). Keep `SUPER_ADMINS`,
  `NEXTAUTH_URL`, `NEXTAUTH_SECRET`. Optionally `DEV_AUTH_ENABLED`,
  `AUTH_DEBUG_ENABLED`.
- **Admin Company Users views** ship for apps with `KEYCLOAK_COMPANY_IDP_HINT` set:
  the `/admin/settings` card, `/admin/company-users` (paginated/searchable), and
  `/admin/accounts/[id]/users`. Wire these in, adapting to this app's admin shell.
- **Deploy wiring (CDK/SSM):** port the SSM-parameter wiring from the template's
  `infra/lib/stack.ts` and `scripts/deploy/setup-ssm-params.sh` (including the
  `company-idp-hint`). Adapt rather than overwrite if infra has diverged, and tell
  me. **Do not deploy.**
- **Redirect-URI registration (REQUIRED — easy to miss):** copy
  `scripts/deploy/register-keycloak-uris.sh` from the template into this app and wire
  it as a post-deploy step in this app's deploy script (in the template it is
  `full-deploy.sh` step 4/4 and `first-deploy.sh` step 7/7 — put it wherever this
  app's post-deploy steps live). Without this, Keycloak rejects the callback with
  "Invalid redirect URI" even when everything else is configured correctly, because
  this app's hostname was never added to the shared `labs-portal` client.
  The script needs no new credentials — it reads a service account from shared SSM
  (`/labs/kc-registrar/*`), which labs-platform has already provisioned.
  **Wire it, do NOT run it.** Running it reads SSM and calls the Keycloak Admin API,
  which is out of scope for you — it is my step, staging first, and it needs `jq` plus
  Mapp VPN. Tell me it is wired and that I must run it before the first login attempt.
  See `<TEMPLATE_PATH>/docs/template/KEYCLOAK.md` ("Redirect URI registration on labs-portal").
- Drop dead config if present: `KEYCLOAK_REALM` and `ADMIN_GRANULAR_ACCESS_CONTROL`.

### Step 5 — Local dev sign-in (recommended)

Wire `dev_login` (`DEV_AUTH_ENABLED=true`, non-production only) so I can test the
full **admin / company-customer / eligibility** matrix locally via `/auth/dev`
without AWS/Keycloak — it runs the *real* hydration + eligibility code. See
`<TEMPLATE_PATH>/docs/template/capabilities/DEV_LOGIN.md`.

### Magic-link gotcha (only if this app uses it)

If this app actively uses **email magic-link** login: it is now an opt-in capability
(`MAGIC_LINK_ENABLED`, default off), decoupled from Keycloak. Do **not** silently
break it. Flag that bringing it in line with the template's magic-link style may need
rework. **Important:** magic-link is often used for people who *cannot* log in
through Keycloak (no Mapp identity / not a Mapp Cloud company user) — that
mixed-audience case is **not** something this template covers well. Surface it as a
risk; don't force it into the Keycloak/company model.

### Out of scope (mention, don't implement)

- **Keycloak API token auth** (machine-to-machine bearer tokens on API routes) —
  separate capability; see `<TEMPLATE_PATH>/docs/template/capabilities/KEYCLOAK_API_AUTH.md`.
- Magic-link beyond the gotcha above.

### Step 6 — Verify and hand back

- Run typecheck, lint, and tests. Fix what your changes broke.
- Confirm `/auth/admin` would show **both** buttons when both hints are set, that the
  customer path persists a `CompanyUser`, and that `/admin/auth-debug` reflects the
  identity (per `docs/template/KEYCLOAK.md` → Validation). You can exercise the full
  matrix locally via `/auth/dev`; the live KC flow needs deployed SSM — note that.
- **Do not merge, do not deploy, do not run the migration.**

### Record state

Before the handback, write/update **`.retrofit-state.json` at this app's repo root**
(create it if absent), following `<TEMPLATE_PATH>/docs/retrofit/RETROFIT-STATE.md`.
Upsert this retrofit under `retrofits["2026-06-10-keycloak-auth-company-context"]` with
`status` (applied / partial / skipped / not-applicable), `templateVersion` +
`templateRef` (the template version and exact git tag/SHA you worked against), an
ISO-8601 UTC `at` (`date -u +%Y-%m-%dT%H:%M:%SZ`), `by`, `notes` + any `deviations`
(record the access-model decision + the two seam choices), and
`capability: "company_login"`. Refresh `template.lastRetrofitAgainstVersion` /
`lastRetrofitAgainstRef` / `lastRetrofitAt`; don't remove other entries.

Then give me a **plain-language handback** containing:
1. What you changed, grouped by area (login code, the two seams, database, config,
   admin views, deploy wiring).
2. **What a technical person must do before this is live**, in order: review the
   branch → review & run the database migration → set the Keycloak SSM values
   (including the company IdP hint) → deploy to **staging first** and validate both
   login buttons + `/admin/auth-debug` + that a customer creates a `CompanyUser` →
   only then production.
3. The **two seams** — what you implemented vs. left as default, and why.
4. Every **deviation** from the template and why.
5. Any **prerequisite or gotcha** above that this app was missing.
6. The **access-model decision** you and I made, restated.

## PROMPT END
