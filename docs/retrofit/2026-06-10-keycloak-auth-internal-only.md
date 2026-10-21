# Retrofit prompt — Keycloak auth (internal-only / Mapp employees)

> Implements the **2026-06-10 "Company Login (Keycloak / Mapp Cloud) + access-model
> rework"** entry in [`MIGRATION.md`](../../MIGRATION.md), for the **internal-only**
> case: an app logged into **only by Mapp employees**. It moves internal admin
> login from **direct Microsoft Entra** to **Keycloak-brokered** login, and adopts
> the new access model. It deliberately **does not** enable the company/customer
> login path.
>
> If external customers (Mapp Cloud company accounts) also log into this app, stop
> and use [`2026-06-10-keycloak-auth-company-context.md`](2026-06-10-keycloak-auth-company-context.md) instead.

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

You are upgrading the **current project** (an existing Mapp Labs app) to use
**Keycloak-brokered internal login**, replacing its current **direct Microsoft
Entra (Azure AD)** admin login, and adopting the template's new access model. This
app is used **only by Mapp employees** — you are **not** enabling any customer /
company-context login path.

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
2. **Above all, do not break this app.** A working app with old auth is better than
   a broken app with new auth. If a clean port isn't possible, do the safest partial
   port and tell me what you skipped and why.
3. **Copy verbatim only where it's clearly safe** (e.g. a new self-contained file
   that doesn't already exist here). Where this app already has its own version of
   something, port the *pattern* into the existing file rather than overwriting it.
4. **Surface every deviation.** Whenever you do something differently from the
   template because the template's exact approach would break this app, note it in
   your final summary.
5. **My libraries may differ from the template's.** If this app is on a different
   major version of `next-auth`/NextAuth, Next.js, or Prisma than the template, do
   **not** blindly downgrade/upgrade. Adapt to what's here and flag the mismatch.
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
     `INTERNAL_API_*`) — if this app calls internal services, reuse it; don't create
     per-integration credentials.

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

1. Create a new git branch (e.g. `retrofit/keycloak-internal-auth`). All work goes
   here. Never commit straight to the main branch.
2. Read these in the **template** to understand the target design:
   - `<TEMPLATE_PATH>/docs/retrofit/KEYCLOAK-MIGRATION.md` — the human migration guide for
     exactly this internal Entra→Keycloak move. Your north star.
   - `<TEMPLATE_PATH>/docs/template/KEYCLOAK.md` — env vars, SSM wiring, CA handling,
     login-button selection, validation.
   - `<TEMPLATE_PATH>/docs/template/PERMISSION-LEVELS.md` — the access model.
   - `<TEMPLATE_PATH>/docs/template/capabilities/DEV_LOGIN.md` — local sign-in without AWS.
   - The relevant `MIGRATION.md` entry dated **2026-06-10**.
3. Read the template auth module under `<TEMPLATE_PATH>/src/modules/auth/` —
   especially `config/nextauth.ts`, `config/keycloak/claims.ts`, `types/index.ts`,
   `server/internal-admin-auth.ts`, `server/require-auth.ts`,
   `server/access-control.ts`, and the `components/*ErrorBoundary*` files.
4. Find this app's **current** auth: its NextAuth config, the Entra/Azure provider,
   its session/JWT typing, and its admin guards. Write a short diff-in-plain-words:
   what this app does today vs. what the template does. Show me this assessment
   before making large changes if the divergence looks significant.

### ⚠️ Prerequisites & gotchas (check these — they can silently break the app)

These are **not** included in this prompt's scope; they are dependencies. Detect
whether this app already has them and warn me if it doesn't:

- **Error boundaries must re-throw Next.js control-flow signals.** If this app has a
  custom `AuthErrorBoundary` / `AdminErrorBoundary` that catches *everything*, it
  will swallow the `redirect()` / `notFound()` throws the Keycloak login flow relies
  on and render "Something went wrong" instead of redirecting. The template fix is
  `src/lib/utils/next-errors.ts` (`isNextControlFlowError`) used in both boundaries.
  See the **2026-06-19** `MIGRATION.md` entry. Port this if missing — it is small
  and the auth flow depends on it.
- **Internal root CA / Keycloak TLS.** Keycloak backchannel calls must trust the
  Keycloak host's cert. Production INT Keycloak (`auth.shortest-route.com`) uses a
  public chain, but if your KC host is on the internal root you may need the vendored
  CA (see the **2026-06-18** "internal root CA" entry) or, as a *temporary* staging
  escape hatch only, `KEYCLOAK_TLS_INSECURE=true`. **Never** set TLS-insecure in
  production — the template hard-forces it off when `NODE_ENV=production`.
- **Access-model change is a security-relevant behavior change** — see the next box.

### ⚠️ Access model: this REMOVES pending/approval

The template's access model is: **first Mapp user ever to log in → active admin;
everyone after → active viewer.** There is **no pending/approval queue**;
`accessStatus` is `active | suspended | denied`.

If this app **currently gates new internal users to `pending` until an admin
approves them**, adopting this verbatim is a **security regression** — every new
Mapp user would become auto-active. **Stop and ask me** whether to:
(a) adopt the template's first-user-admin model, or
(b) preserve this app's approval gate and take only the Keycloak parts.
Do not silently flip the access model.

### Step 1 — Port the auth code

Bring the internal Keycloak login path into this app's auth module, matching the
template pattern and adapting to this app's structure:

- **Keycloak provider + callbacks** (from `config/nextauth.ts`): the Keycloak OIDC
  provider, the JWT/session callbacks that set `authSource`, `identityProvider`,
  `ldapGroups`, `role`, `isSuperAdmin`, `access`, and the **CA-merge HTTPS agent**
  (it must *merge* the Mozilla root store with any custom CA, never replace it).
- **Pure claim helpers** (`config/keycloak/claims.ts`, including
  `deriveIsMappEmployee`) — these are unit-tested and safe to bring in whole.
- **Session/JWT types** (`types/index.ts`) — the `MappSessionClaims` shape is the
  single source for the enrichment fields. Reconcile with this app's existing types.
  `keycloakIdToken` is **JWT-only** — never put it on `session.user`.
- **Internal admin hydration** (`server/internal-admin-auth.ts`) +
  `require-auth` / `access-control`. Keep this app's existing admin-guard call sites
  working; the goal is compatibility, not a rewrite of the app's authorization.
- Keep the **runtime switch**: `KEYCLOAK_ENABLED=true` routes `/auth/admin` to
  Keycloak; `false` falls back to the legacy direct-Entra path (don't delete the old
  path — leave it as the fallback).

Bring the **tests** that cover what you port (e.g. `claims.test.ts`,
`access-control.test.ts`, `first-login.test.ts`) and make them pass against this app.

### Step 2 — Database migration (generate, do NOT apply)

The access-model rework needs schema changes. Look at the template migration
`<TEMPLATE_PATH>/prisma/migrations/20260610120000_company_login_and_access_model/migration.sql`.

For an internal-only app, the parts you need are:

- `mapp_team.access_status` default → `active`, and migrate existing `pending` rows
  to `active` (subject to the access-model decision above).
- The functional index `mapp_team_email_lower_idx` on `lower(email)` for the
  per-request auth lookup.

> **⚠️ Functional-index drift caveat.** That `lower(email)` index **cannot** be
> expressed in `schema.prisma`. `prisma migrate dev` can't see it and may generate a
> migration that **drops** it. Keep the raw-SQL migration, and **never accept a
> generated migration that drops `mapp_team_email_lower_idx`.**

The migration also creates a `company_user` table. For a strictly internal-only app
you have two safe options — pick based on how much of the template auth module you
ported, and **tell me which you chose**:
- **Simpler / recommended:** include the `company_user` table even though it's
  unused. It's inert with the customer path disabled and avoids ripping out code.
- **Leaner:** omit `company_user`, but then you must also *not* port the
  company-customer code (`company-user-auth.ts`, `company-context.ts`, the
  CompanyUser branch of `usage-attribution.ts`) — or the app won't compile.

**Generate** the migration file but **do not run it** against any database. Leave it
staged for a technical reviewer.

### Step 3 — Config, env vars, and deploy wiring

- In `app.config.json`: ensure `company_login` is **not** in `enabledCapabilities`.
- Set `COMPANY_LOGIN_ENABLED=false` so the customer path is fail-closed.
- Add/adjust env vars (see `<TEMPLATE_PATH>/.env.example` and `docs/template/KEYCLOAK.md`):
  `KEYCLOAK_ENABLED`, `KEYCLOAK_ISSUER`, `KEYCLOAK_CLIENT_ID`,
  `KEYCLOAK_CLIENT_SECRET`, `KEYCLOAK_IDP_HINT=mapp-entra-id`. **Do not set**
  `KEYCLOAK_COMPANY_IDP_HINT` (that button is for customers — leaving it unset keeps
  the login page single-button, Mapp Entra ID only). Keep `SUPER_ADMINS`,
  `NEXTAUTH_URL`, `NEXTAUTH_SECRET`. Optionally `DEV_AUTH_ENABLED` (local) and
  `AUTH_DEBUG_ENABLED`.
- **Deploy wiring (CDK/SSM):** port the SSM-parameter wiring from the template's
  `infra/lib/stack.ts` and `scripts/deploy/setup-ssm-params.sh` so these values flow
  through SSM→ECS. If this app's infra has diverged, adapt rather than overwrite, and
  tell me. **Do not deploy** — just wire it.
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
- Drop dead config if present: `KEYCLOAK_REALM` (realm is in the issuer path) and
  `ADMIN_GRANULAR_ACCESS_CONTROL`.

### Step 4 — Local dev sign-in (optional but recommended)

Wire `dev_login` (`DEV_AUTH_ENABLED=true`, non-production only) so I can test admin
login locally without AWS/Keycloak via `/auth/dev`. See
`<TEMPLATE_PATH>/docs/template/capabilities/DEV_LOGIN.md`.

### Magic-link gotcha (only if this app uses it)

If this app actively uses **email magic-link** login: it is now an opt-in capability
(`MAGIC_LINK_ENABLED`, default off) decoupled from Keycloak. Do **not** silently
break it. Flag to me that bringing it in line with the template's magic-link style
may require rework. **Important:** magic-link is often used for people who *cannot*
log in through Keycloak (no Mapp identity) — that mixed-audience case is **not**
something this template covers well. Surface this as a risk; don't try to force it
into the Keycloak model.

### Out of scope (mention, don't implement)

- **Keycloak API token auth** (machine-to-machine bearer tokens on API routes) — a
  separate capability; see `<TEMPLATE_PATH>/docs/template/capabilities/KEYCLOAK_API_AUTH.md`.
- Magic-link beyond the gotcha above.

### Step 5 — Verify and hand back

- Run the app's typecheck, lint, and tests. Fix what your changes broke.
- Confirm `/auth/admin` would start the Keycloak flow when `KEYCLOAK_ENABLED=true`,
  and that `/admin/auth-debug` would show `authSource=keycloak` (per
  `docs/template/KEYCLOAK.md` → Validation). You cannot fully test the live KC flow
  without deployed SSM — note that.
- **Do not merge, do not deploy, do not run the migration.**

### Record state

Before the handback, write/update **`.retrofit-state.json` at this app's repo root**
(create it if absent), following `<TEMPLATE_PATH>/docs/retrofit/RETROFIT-STATE.md`.
Upsert this retrofit under `retrofits["2026-06-10-keycloak-auth-internal-only"]` with
`status` (applied / partial / skipped / not-applicable), `templateVersion` +
`templateRef` (the template version and exact git tag/SHA you worked against), an
ISO-8601 UTC `at` (`date -u +%Y-%m-%dT%H:%M:%SZ`), `by`, `notes` + any `deviations`
(record the access-model decision), and `capability: "company_login"`. Refresh
`template.lastRetrofitAgainstVersion` / `lastRetrofitAgainstRef` / `lastRetrofitAt`;
don't remove other entries.

Then give me a **plain-language handback** containing:
1. What you changed, grouped by area (login code, database, config, deploy wiring).
2. **What a technical person must do before this is live**, in order: review the
   branch → review & run the database migration → set the Keycloak SSM values →
   deploy to **staging first** and validate `/auth/admin` + `/admin/auth-debug` →
   only then production. (Reference `docs/retrofit/KEYCLOAK-MIGRATION.md`'s staging-first rule.)
3. Every **deviation** from the template and why.
4. Any **prerequisite or gotcha** above that this app was missing.
5. The **access-model decision** you and I made, restated.

## PROMPT END
