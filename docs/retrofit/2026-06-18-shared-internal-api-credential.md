# Retrofit prompt — Shared internal-API credential (Keycloak realm `s2s`)

> Implements the **2026-06-18 "Shared internal-API OAuth credential (realm `s2s`)"**
> entry in [`MIGRATION.md`](../../MIGRATION.md).
>
> **Foundation / prerequisite.** This installs the **one** credential and shared HTTP
> client that every internal Mapp-service integration authenticates with. It pairs
> with — and comes immediately before — **Client Catalog** and **UPC**, which consume
> it. Applies to any fork that calls (or is about to call) an internal Mapp service.
> Depends on the **internal root CA** retrofit (so TLS to those services works).

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

You are converging the **current project** (an existing Mapp Labs app) onto the
template's **shared internal-API credential**: a single Keycloak **realm-`s2s`**
client-credentials token, used through one shared HTTP client, to authenticate **all**
calls to internal Mapp services (company-management-service, product-feed-service, and
any other internal integration) — instead of per-integration OAuth/Basic credentials.

The authoritative reference implementation is a fresh checkout of `labs-app-template`
at:

    <TEMPLATE_PATH>

If that path is still the literal placeholder, is empty, or doesn't look like a
`labs-app-template` checkout (no `src/lib/internal-api/oauth.ts`, no
`docs/template/INTERNAL-API.md`), **stop and ask me for the correct path before doing anything
else.** Also remind me I should have pulled the **latest** template, and tell me its
version.

### Who I am

Assume I may **not** be a developer. **You** own the git branch. I likely cannot run
AWS commands or know secret values myself — call those out as steps for me or a
technical person. Explain everything in plain language.

### Operating principles (read these before touching anything)

1. **The template is the reference design, not a literal source to copy.** Match its
   model and conventions, adapt to how *this* app is structured. **If this app has no
   equivalent paradigm, lean toward the template's reference architecture.**
2. **Above all, do not break this app.** A working app beats a broken one. Safest
   partial change over a risky full one; tell me what you skipped.
3. **Copy verbatim only where it's clearly safe.** Where this app already has its own
   version, port the *pattern* in rather than overwriting.
4. **Surface every deviation** from the template and why.
5. **My libraries may differ from the template's.** Adapt to what's here.
6. **Reuse shared infrastructure — never duplicate it per app.** The `s2s` credential
   is shared. Do **not** mint a new OAuth client or secret. Use the shared **`mapp-labs`**
   realm-`s2s` client (the reference) unless labs-platform has provisioned a dedicated
   one for this app.
7. **Keep libraries and patterns reasonably current — toward this template, not the
   bleeding edge.** Prefer the template's versions/patterns; never bump to the newest
   *public* release just because it exists (supply-chain risk, unvalidated here).
8. **When something is genuinely complex, risky, or ambiguous and I can't answer, tell
   me to get help — don't guess.** Stop and ask me; if I don't know, point me to the
   Labs Slack channels **#topic-mapp-labs** or **#topic-ai-support**.
9. **Converge to the reference architecture, and clean up what you replace — scoped to
   this app, never overreaching.** Bring this app in line with the template *even where
   the current setup works* (a pre-template pattern that still functions is still a
   deviation to converge). Remove this app's own dead config; *propose* removing its
   now-dead per-app SSM params as reviewable, scoped commands — don't auto-delete.
   **Never** touch shared infra, shared credentials/clients, or any *other* app's
   resources, and never deprovision a shared client just because this app changed.

### Step 0 — Branch and assess

1. Create a git branch (e.g. `retrofit/shared-internal-api`). All work goes here.
2. Read, in the template: `<TEMPLATE_PATH>/docs/template/INTERNAL-API.md`,
   `src/lib/internal-api/oauth.ts` + `fetch.ts` (+ their tests), the `INTERNAL_API_*`
   block of `scripts/deploy/setup-ssm-params.sh`, the `INTERNAL_API_*` wiring in
   `infra/lib/stack.ts`, and the `INTERNAL_API_*` block of `.env.example`. Also read
   the **2026-06-18** internal-API entry in `MIGRATION.md`.
3. In **this** app, find **every existing internal-Mapp-service integration** and how
   it authenticates today — look for per-integration OAuth or Basic credentials and
   private token caches (e.g. `*_IDP_TOKEN_URL`, `*_CLIENT_ID`, `*_CLIENT_SECRET`,
   `*_API_USERNAME` / `*_API_PASSWORD`, a local `clearTokenCache`). List them; these
   are what you'll repoint and clean up. If the app has **no** internal integration
   yet, you're just installing the plumbing for Client Catalog / UPC to use later.

### Part 1 — The shared provider (code)

Bring the shared provider into this app (it's base library code in the template, not
capability-gated): `src/lib/internal-api/oauth.ts` (`getInternalApiToken`,
`getInternalApiOAuthConfigFromEnv`, `clearInternalApiTokenCache` — client-credentials,
per-issuer in-memory token cache) and `src/lib/internal-api/fetch.ts` (`internalApiFetch`
— the shared Bearer + clear-cache-and-retry-once-on-401 wrapper). Match this app's file
layout. Bring the tests and make them pass.

### Part 2 — Env vars

Add the `INTERNAL_API_*` block to `.env.example` / `.env`, matching the template:
- `INTERNAL_API_TOKEN_URL` — `https://<idp-int.shortest-route.com (lower) | auth.shortest-route.com (prod)>/realms/s2s/protocol/openid-connect/token`
- `INTERNAL_API_CLIENT_ID` — `mapp-labs` (the shared reference client)
- `INTERNAL_API_CLIENT_SECRET` — placeholder locally; the real value comes from SSM in
  deployed envs (see Part 4).

### Part 3 — CDK wiring

In this app's CDK stack, inject the three as `ecs.Secret.fromSsmParameter` from
`/${prefix}/INTERNAL_API_TOKEN_URL|CLIENT_ID|CLIENT_SECRET`, mirroring the template's
`infra/lib/stack.ts`. Adapt to this app's stack if it has diverged; don't overwrite
wholesale. **Do not deploy.**

### Part 4 — SSM seeding (you prepare; a human runs it)

Port the `INTERNAL_API_*` seeding block from `scripts/deploy/setup-ssm-params.sh` into
this app's equivalent if it's missing: env-aware token host, `client-id` default
`mapp-labs`, and the **secret seeded as a placeholder**. Then tell me to run
`make <env>-ssm-setup` (it seeds these per-app params). **You should not run AWS
commands yourself** — assume you may not have credentials, and that whoever does will
use their own AWS access. 

**The secret now lives in shared SSM — per environment.** (Corrected 2026-08-04; this
prompt previously said no shared source existed and treated the secret as a
labs-platform handoff.) There is one shared set **per environment**, because internal
Mapp services are deployed per environment and the `s2s` secret differs per Keycloak
realm even though the client id is the same (`mapp-labs`):

| Environment | Shared prefix |
|---|---|
| staging | `/mapp-labs-stg` |
| production | `/mapp-labs` |

`infra/lib/stack.ts` resolves the prefix from the deploy environment, so there is
nothing app-scoped to seed or hand over. **Never point staging at `/mapp-labs/*`** — a
production credential plus the production base URL succeeds from staging, which means
staging silently reads PRODUCTION data. If this app already has a working
`INTERNAL_API_CLIENT_SECRET` in its own SSM, keep it as a fallback and do not delete
it until the app is verifiably reading the correct per-environment shared values. See
the 2026-08-04 `MIGRATION.md` entry. If unsure, ask in **#topic-mapp-labs** /
**#topic-ai-support**.

### Part 5 — Repoint existing integrations + converge the credential

- **Repoint** every existing internal client found in Step 0 to authenticate via the
  shared provider (`internalApiFetch` / `getInternalApiToken`). Keep only the
  per-service **base URL**; remove the per-integration OAuth/Basic env vars and any
  private token cache (use `clearInternalApiTokenCache` for 401 retries). If the app
  has no such clients yet, skip — Client Catalog / UPC will wire this when added.
- **The credential value:** the reference is the shared **`mapp-labs`** realm-`s2s`
  client. If this app currently uses a **dedicated** per-app client or per-integration
  credentials, treat that as a pre-template deviation to converge **toward the shared
  client** — but converging the client *value* (and deprovisioning a dedicated client)
  needs labs-platform and is not something you do unilaterally. Flag it, recommend it,
  and don't rip out a working credential without sign-off (principle 8/9, Slack).
- **Authorization:** the realm-`s2s` client must be authorized for the internal
  services this app calls. The shared `mapp-labs` client is already authorized for
  company-management-service and product-feed-service. If this app calls a *different*
  internal service, confirm authorization with labs-platform.

### Clean up AWS — scoped, no overreach (propose, don't auto-delete)

For the per-integration credentials you replaced, produce a **reviewable list** of this
app's now-obsolete per-app SSM params and the exact scoped delete commands (e.g.
`aws ssm delete-parameter --name /<thisapp>-<env>/<OLD_PARAM> …`) for a human to run
after review. **Do not delete anything yourself.** **Never** propose deleting shared
params (`/labs/*`, `/labs-prod/*`), other apps' params, or deprovisioning a shared
client. List only the obsolete creds this specific app no longer uses.

### Verify and hand back

- Run typecheck, lint, tests; fix what your changes broke.
- Confirm every internal call now flows through the shared provider; no per-integration
  OAuth/Basic creds remain in code or `.env.example`.
- **Do not deploy and do not run AWS commands.**

### Record state

Before the handback, write/update **`.retrofit-state.json` at this app's repo root**
(create it if absent), following `<TEMPLATE_PATH>/docs/retrofit/RETROFIT-STATE.md`.
Upsert this retrofit under `retrofits["2026-06-18-shared-internal-api-credential"]` with
`status` (applied / partial / skipped / not-applicable), `templateVersion` +
`templateRef` (the template version and exact git tag/SHA you worked against), an
ISO-8601 UTC `at` (`date -u +%Y-%m-%dT%H:%M:%SZ`), `by`, `notes` + any `deviations`, and
the `capability` id if this retrofit maps to one. Refresh
`template.lastRetrofitAgainstVersion` / `lastRetrofitAgainstRef` / `lastRetrofitAt`;
don't remove other entries.

Then give me a **plain-language handback**:
1. What you changed (provider code, env, CDK, setup script, repointed clients).
2. Which integrations you repointed, and what old config you removed from the codebase.
3. The **credential decision**: shared `mapp-labs` vs an existing dedicated client, and
   whether convergence needs labs-platform follow-up.
4. The **human steps**, in order: run `make <env>-ssm-setup` → fill
   `INTERNAL_API_CLIENT_SECRET` from labs-platform → review & run the scoped SSM
   cleanup commands → deploy staging-first → confirm an internal-service call succeeds.
5. The **scoped AWS-cleanup command list** (for review — not run).
6. If anything got complicated and I didn't have an answer, remind me I can ask in
   **#topic-mapp-labs** or **#topic-ai-support**.

## PROMPT END
