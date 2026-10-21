# Retrofit Prompts

This directory holds **agent-runnable retrofit prompts** — copy-paste prompts you
give to a coding agent (Claude Code, Cursor, etc.) to bring an **existing Labs app**
up to a specific template change *without* hand-editing it yourself.

## ▶ Just want to catch your app up? Start here.

**New to this? Read [FOR-BUILDERS.md](FOR-BUILDERS.md)** — the plain-language "what to do"
for anyone who owns a forked app (hand it to non-developers too).

If you don't want to pick individual prompts, use the **orchestrator**:
**[START-HERE.md](START-HERE.md)**. It tells an agent to figure out where your fork
diverged, build an ordered plan of everything not yet applied, ask you which optional
capabilities you want, and apply them **one at a time** without breaking your app. It
uses the dedicated prompts below where they exist and falls back to `MIGRATION.md` for
small entries.

The individual prompts below are for when you want to apply **one specific** change.

Either way, every retrofit records what it did in **[`.retrofit-state.json`](RETROFIT-STATE.md)**
at the app's repo root (committed) — the template version/ref it ran against, per-retrofit
status, and any app-specific deviations. It's how the orchestrator resumes and how a fleet
dashboard can see every app's state. Format: [RETROFIT-STATE.md](RETROFIT-STATE.md) +
[retrofit-state.schema.json](retrofit-state.schema.json).

---

They are the companion to [`MIGRATION.md`](../../MIGRATION.md):

| | `MIGRATION.md` | `docs/retrofit/*.md` |
|---|---|---|
| Audience | a human reading a changelog | an **agent** doing the work |
| Form | "what changed + steps" | a self-contained prompt the agent executes |
| Voice | descriptive | imperative, with guardrails |

Each retrofit prompt corresponds to a dated `MIGRATION.md` entry. That entry links
down here; the prompt links back up. To retrofit something historical, find the
`MIGRATION.md` entry and follow its **▶ Retrofit prompt** link.

## How a person uses one of these

1. **Pull a fresh copy of `labs-app-template`** into a *separate* directory (not on
   top of their app). This is the reference the agent reads from.
2. Open their **own app** in their agent.
3. Paste the chosen prompt, fill in the one placeholder at the top
   (`<TEMPLATE_PATH>` = where they put the fresh template), and let the agent run.

The prompts assume the person may **not** be a developer. The agent is told to own
the git branch and the database migration, and to hand the work back with a
plain-language summary of what a technical reviewer must check before it ships.

## Design rules for prompts in this directory

- **Reference design, not literal copy.** Every app has diverged differently. The
  template is the *model and conventions* to match — the agent adapts to the app it
  finds and is told, above all, **not to break the user's app**.
- **Self-contained.** A person runs exactly one prompt; it does not assume they read
  the others. Shared guardrails are duplicated rather than cross-referenced.
- **Point at in-repo docs.** The fresh template checkout contains the authoritative
  capability docs — prompts link to those (e.g. `docs/template/capabilities/COMPANY_LOGIN.md`)
  instead of restating them.
- **Branch + hand back.** Prompts never auto-apply DB migrations or auto-deploy.

## Naming convention

```
docs/retrofit/<migration-date>-<topic>[-<variant>].md
```

e.g. `2026-06-10-keycloak-auth-company-context.md`. The date matches the
`MIGRATION.md` entry the prompt implements.

## Available prompts

| Date | Topic | Prompt | For |
|---|---|---|---|
| 2026-10-17 | Docs layout (`docs/` = app, `docs/template/` = template) | [docs-layout](2026-10-17-docs-layout.md) | **Optional, docs-only — worth taking.** Moves the template-owned reference docs into `docs/template/` and keeps the app's own docs at `docs/`, with a `docs/README.md` index, so agents can tell template reference from app docs and know where to write. The agent **classifies each doc against the template and asks when unsure**; template docs are **moved, not refreshed** (their content keeps matching this app's code), and app-specific sections inside template docs move out to app docs. Adds the AGENTS.md "Documenting Your Work" and "App Notes and Pitfalls" sections and updates references in AGENTS.md, Makefile, scripts and code comments. No code behaviour, schema, SSM or infra; no deploy. |
| 2026-10-17 | Customer Preview ("View as customer") | [customer-preview](2026-10-17-customer-preview.md) | **Optional — Company-Login apps only.** Lets an admin-level Mapp user open a company's `/account` pages exactly as its Company-Login customers see them: read-only, 30 minutes, bound to that admin, audited (`customer_preview_start` / `_end`, entity type `company`), optionally narrowed to one workspace. A signed cookie makes `requireCustomer` (via `getCustomerRequestSession`) return a synthesized customer session; the capability is **off by default and inert when off**. The agent **asks whether to enable it or install only the inert hooks**, inventories the app's **own customer mutations and adds `assertNotPreview`** to each, adapts the subject seam (`resolvePreviewSubject`) if the app has its own companies/workspaces tables, and must keep every security invariant in `CUSTOMER_PREVIEW.md`. Supersedes `/auth/admin-view-account` for Company-Login apps (legacy unchanged). **Requires the customer-side render/scope retrofit first.** No schema, no SSM; enabling adds two plain env vars to the task definition in `infra/lib/stack.ts` (`infra-deploy`). Default deploy path. |
| 2026-10-17 | Customer pages: server-session render + once-per-request scope | [customer-side-render-and-scope](2026-10-17-customer-side-render-and-scope.md) | **All forks with an `/account` customer area.** Every customer page's server HTML was a full-screen spinner (the layout waited on `useSession()`, which is always `"loading"` during SSR), the top nav popped in after hydration, the footer floated, and `/account` had no loading boundary. Renders the shell from the server session, uses `NavigationComponent` directly, pins the footer, adds `src/app/account/loading.tsx`, and `cache()`s the session (admin helpers too), eligibility, company context and profile, with `getCustomerPageScope` / `requireEligibleCustomerPageScope` running eligibility and context **in parallel**. The scope helpers need Company Login (2026-06-10 company context); without it the rest still applies (`partial`). **Eligibility policies must be pure reads** (now memoized). Page-level redirects under `/account` now arrive after streaming starts (HTTP 200 + client redirect, not 307). Code only, default deploy path. |
| 2026-10-17 | Safe redirects, private API caching, escaped search | [redirects-caching-search](2026-10-17-redirects-caching-search.md) | **All forks — security.** Covers two MIGRATION entries. **Open redirect:** `/auth/admin-view-account` followed `callbackUrl` unchecked (off-site or `javascript:`); a shared `resolveCallbackUrl` now allows only same-origin paths inside `/account` or `/admin`, and sign-in (`/auth/admin`, `/auth/dev`, `/auth/signin`) honours `callbackUrl` so bookmarks survive session expiry. **API caching** (`public_api` forks): key-scoped responses were `public` + `s-maxage`, so a CDN could serve one key's data to another; adds `privateCacheHeaders()` + `Vary: X-API-Key`. **Search:** `%` / `_` reached Prisma `contains` as LIKE wildcards; adds `escapeLikePattern` / `toContainsTerm`. The prompt makes the agent **inventory the app's own redirect sinks, cache headers and searches** — the template only fixed its own. Code only, default deploy path. |
| 2026-10-17 | Windows (Git Bash) setup/deploy + Docker disk cleanup | [windows-git-bash](2026-10-17-windows-git-bash.md) | **All forks.** From Git Bash, `node` got `/c/...` paths, `/`-leading SSM/log-group/ECS-Exec arguments were rewritten to Windows paths, a CRLF entrypoint made the container exit 255 with an empty log, ECR `docker login` overflowed Windows Credential Manager, and Keycloak registration failed on the internal CA. Adds `to_node_path`, `add_exit_trap`, `run_python` and `MSYS2_ARG_CONV_EXCL` (`_config.sh` + `Makefile`), `.gitattributes` `eol=lf`, a Dockerfile CR strip, the ECR credential helper, a Windows CA bundle (bash-3.2-safe array expansion), `jq` checks; plus a post-push Docker cleanup on **every OS** (`DOCKER_CLEANUP`, `DOCKER_BUILD_CACHE_MAX`). Windows-only branches are `uname`-guarded. Old forks checked out on Windows run `git add --renormalize .` once — **careful with CRLF `migration.sql`** (checksums). Scripts only; no deploy to adopt. |
| 2026-10-09 | Admin audit log + Settings link | [audit-log-and-settings](2026-10-09-audit-log-and-settings.md) | **All forks.** The audit log becomes a real **standard capability**: an `audit_log` table, a `writeAuditLog` helper (`src/modules/audit`), and a page at `/admin/audit-log` answering "who changed what, and when". Until now `/admin/settings` had **no link anywhere in the navigation**, which also made Company Users unreachable, and its Audit Log card pointed at a page that was never built. Adds a **Settings** sidebar entry (Mapp Team moves off the sidebar and onto a Settings card) and records Mapp Team access changes out of the box; **the app's own consequential changes must be wired in by hand** (one call each, one line per entity type, no migration per type) — the capability doc's "What to record" section says which ones. One **additive** migration, default deploy path, no SSM/infra. **Forks that already built their own `audit_log`** keep it — the migration only adds `actor_email`, and the prompt reconciles rather than overwrites. |
| 2026-10-09 | Session cookie size (HTTP 431) | [session-cookie-size](2026-10-09-session-cookie-size.md) | **All forks with Keycloak login.** Users with many LDAP groups or workspaces get **HTTP 431 on every page**: the `jwt` callback stored `roles`, `workspaces`, `mappLdapGroups` *and* the full Keycloak `id_token` (which contains all three again) in the session cookie, and past ~50 groups that exceeds Node's 16 KB request-header limit. Nothing is logged — the request is rejected before app code runs. Moves all four to a new **`auth_session`** table (one row per login) and leaves only an id in the cookie, which becomes a flat ~0.7 KB. **`session.user.*` is unchanged**; only code reading the raw JWT via `getToken()` breaks. **Also fixes Keycloak logout, which never ran:** `/auth/signout` passed `getToken()` a raw Cookie header it ignores, so the token was always `null` and the SSO session survived every sign-out — users will now be prompted at their next login, and a fork whose logout URI was never registered will see Keycloak's "Invalid redirect uri" page until `register-keycloak-uris.sh` is run. **Do not just delete the `id_token`** — logout needs it. One **additive** migration, default deploy path, no SSM/infra. Existing sessions keep working; users already stuck on 431 must clear cookies once. |
| 2026-09-22 | App identity (display name + optional logo) | [app-branding](2026-09-22-app-branding.md) | **Optional, cosmetic — worth taking for consistency.** Deployed apps showed their AWS resource slug (ECS sets `APP_NAME` to it) or a hardcoded "Mapp Labs". Adds a server-side name resolver (`APP_DISPLAY_NAME` → `app.config.json` `displayName`), an optional `logoPath` (a file in `public/`, never a remote URL), and one shared `AppIdentity` component used by the sidebar, a new mobile header, top navigation, company-customer header, login page and tab title. **UI + one config field**; no schema, SSM or infra. Touches `Sidebar.tsx` / `Navigation.tsx` / `layout.tsx`, which forks customise heavily — port the pattern, and keep any branding the app owner already chose. **Never change `appName`/`APP_NAME` to change the visible name** — that is the resource slug. |
| 2026-09-10 | RDS storage gp2 → gp3 | [rds-gp3-storage](2026-09-10-rds-gp3-storage.md) | **All forks with `infra/`.** The template never set `storageType`, so every app inherited CDK's default — **gp2** — where performance is sized from the volume: 3 IOPS/GiB, floored at 100. At the template's 20 GiB that's a **100 IOPS baseline**, reaching 3,000 only by spending a burst credit balance a migration or seed can drain. When it empties nothing errors and nothing pages; the app just gets slow hours later. gp3 gives a flat **3,000 IOPS / 125 MiB/s**, no credits, at the **same per-GiB price** (this is not a cost saving). **One CDK property + one deploy**; no schema, SSM, code, or image rebuild. **The conversion is online — no downtime, no reboot.** The sharp edges are elsewhere: `cdk diff` will likely warn *"may be replaced"* (a known CloudFormation display defect — verify with a `--no-execute` changeset, then **don't cancel mid-deploy**), and RDS locks out further storage changes for **~6 hours**, so a failed update in that window can strand the stack in `UPDATE_ROLLBACK_FAILED`. Deploy it **alone**, staging first, snapshot first. Never add `iops`/`storageThroughput` below 400 GiB. |
| 2026-09-07 | Next.js 16 + dependency refresh | [nextjs-16-and-dependency-updates](2026-09-07-nextjs-16-and-dependency-updates.md) | **All forks.** Next.js 15.5 → 16.3 plus a security/currency dependency pass; `npm audit` 13 → 4 (the 4 that remain are Prisma-CLI-tier and are left deliberately). **Three things break if you only bump the version:** `next build --no-lint` is removed — the template's Dockerfile used it, so it hard-fails **every image build and deploy**; the `middleware` file convention is renamed to `proxy` (old path still honoured with a warning, so nothing is silently unprotected); and `experimental.middlewareClientMaxBodySize` → `proxyClientMaxBodySize` **fails silently**, restoring the default body limit. Also: `next build` no longer runs ESLint, so the Docker build is no longer a lint backstop, and the first build rewrites `tsconfig.json` in place. Includes a `proxy` test that fails a half-applied upgrade. **Read the Next-version risk table first** — 15.x below 15.5.21 and 16.0–16.2.10 are *exposed* to the recent CVE batch; a newer-looking major is not automatically safer. No schema, no SSM; CDK is a library-only bump with no re-bootstrap. |
| 2026-08-22 | S3 access model (anonymous read of `content/`) | [s3-access-model](2026-08-22-s3-access-model.md) | **All forks** — the S3 module is wired into the template's admin UI, so almost every app has it. `/api/images/[...path]` served **every object under `content/` to unauthenticated callers**, while `content/` is the default upload destination and accepts non-image files; `/api/files/[...path]` required a session for the same prefix, so its checks were bypassable. Replaces per-route inline rules with one declared prefix policy (`public/` anonymous + admin-write, `content/`/`temp/` authenticated, `mapp-team/` admin-write), validates the upload `path` field instead of casting it, and stops `/api/upload` writing to `mapp-team/`. **Breaking:** logged-out pages rendering `content/` images must move those objects to `public/`. No schema, no infra, no deploy. |
| 2026-08-22 | SFTP rewrite (unauthenticated file read + path traversal) | [sftp-capability](2026-08-22-sftp-capability.md) | **Mandatory for any fork with `src/modules/sftp/`** — the shipped module had an *unauthenticated* `'use server'` export returning any file the SFTP service account could read, and confined no path to `SFTP_ROOT_PATH` (`normalizePath` never resolved `..`). Rewritten around a single confinement resolver, per-app directory encapsulation (`{SFTP_ROOT_PATH}/{appName}`, mirroring `data_sync`'s S3 prefix isolation but **code-enforced, not IAM-enforced** — chroot the account), pinned host key, and server-side size/extension limits. **Breaking:** every action signature changed, `downloadSFTPFileForCustomer` and `deleteSFTPFile` removed. Optional for forks without the module (it becomes the `sftp` capability). No schema, no infra, no deploy. |
| 2026-08-04 | Maintenance deploy path (`make <env>-deploy-maintenance`) | [maintenance-deploy](2026-08-04-maintenance-deploy.md) | **All forks, not urgent.** Adds a *second* deploy path for migrations the running image cannot survive (in-place rename, dropped column, backfill that must not race with live writes): gate the ALBs with a 503, drain the service to zero, migrate through ECS Exec with nothing serving, verify the release digest, restore. The everyday `make <env>-deploy` is unchanged. **Fails closed** — a failed run leaves the service down on purpose rather than restarting old code against a migrated schema. Scripts + Makefile + tests + docs; **no schema, SSM, or CDK**, and nothing in the retrofit deploys. Also carries the migration-idempotency guidance (`IF NOT EXISTS`, `prisma migrate resolve`) from the FTL incident that prompted it. |
| 2026-08-01 | Cost tag hygiene (`AppOwner` + ECS task propagation) | [cost-tag-hygiene](2026-08-01-cost-tag-hygiene.md) | **All forks (mandatory infra).** Adds the `AppOwner` cost tag (current budget holder; `CreatedBy` stays historical) and verifies **every** ECS service sets `propagateTags: SERVICE` + `enableECSManagedTags: true`. Without that, Fargate compute — usually the app's largest line item — bills **completely untagged**, the single biggest source of unattributable spend across the fleet. Config + CDK only, no schema. **Needs a deploy**, and corrects gradually as tasks recycle. Finishes 2026-05-22. Non-template systems use [`docs/template/platform/COST_TAGGING_PROMPT.md`](../template/platform/COST_TAGGING_PROMPT.md) instead. |
| 2026-07-11 | Dependency updates (security + Notion SDK v5 + CDK) | [dependency-updates](2026-07-11-dependency-updates.md) | **Soft-mandatory** (security bumps); Notion piece only affects User Feedback apps, CDK piece only apps with `infra/`. Clears a **HIGH** `ws` advisory (transitive, `npm audit fix`), `next` 15.5.x patch, `axios`, Prisma 7.8, drops deprecated `@types/sharp`. `@notionhq/client` v2→v5 (API `2025-09-03`) — modern payload shape needs no edit; tests mocked so do one real staging submission. CDK `aws-cdk-lib`/CLI → current — **no re-bootstrap** (live bootstrap v29 ≥ required 6/8); library-only, staging-first `cdk diff`. Defers `next-auth`→Auth.js v5 (beta). |
| 2026-07-10 | Immutable image tags + ECR lifecycle | [immutable-image-tags-ecr-lifecycle](2026-07-10-immutable-image-tags-ecr-lifecycle.md) | **Mandatory:** a safe 3-rule ECR lifecycle policy (the actual outage fix, no IAM needed). **Opt-in (default off):** an `immutableDeploy` toggle that pins the task def to `${env}-${version}` and registers real task-def revisions (rollbacks) — **requires `iam:PassRole`, which `labs-power`/PowerUserAccess lacks**, so it's off by default (deploys via `--force-new-deployment` on the floating `${env}-latest` tag). Corrected 2026-07-11. Finishes 2026-05-04. CDK + scripts; the ECR policy call is safe to run. |
| 2026-07-08 | User Feedback | [user-feedback](2026-07-08-user-feedback.md) | Optional. In-app feedback widget → shared Notion "App Feedback" database, reporter/app/owner/company auto-filled. **No Prisma schema, no in-app LLM** (a centralized Notion agent triages). Copy-in scaffold + shared-SSM Notion secret. |
| 2026-06-19 | App-Router correctness + routing convention | [app-router-routing-convention](2026-06-19-app-router-routing-convention.md) | **All forks (mandatory).** Latent error-boundary + admin-SSR bug fixes, server error logging, and the `parseRouteId` routing convention that Client Catalog / UPC build on. Pure code — no migration/infra. |
| 2026-06-18 | Internal root CA | [internal-root-ca](2026-06-18-internal-root-ca.md) | **All forks (mandatory).** Trust `ca.internal.mapp.tools` at the image layer so the app can call internal Mapp services + Keycloak. Image/entrypoint only — no migration/SSM/infra. |
| 2026-06-18 | Shared internal-API credential (`s2s`) | [shared-internal-api-credential](2026-06-18-shared-internal-api-credential.md) | Forks calling any internal Mapp service. The one `s2s` credential + shared HTTP client that Client Catalog / UPC authenticate with. Code + CDK + SSM. **Corrected 2026-08-04** — the shared namespace is **per environment** (`/mapp-labs-stg` staging, `/mapp-labs` production); the secret is no longer a labs-platform handoff. Pointing staging at the production prefix makes it silently read PRODUCTION data. See the 2026-08-04 `MIGRATION.md` entry. |
| 2026-06-19 | Client Catalog (companies & workspaces) | [client-catalog-companies-workspaces](2026-06-19-client-catalog-companies-workspaces.md) | **Soft-mandatory** (future updates assume this model). Discover companies/workspaces from GUM, canonical-id admin routes. Schema + data migration (assess/propose/generate-not-apply) + scaffold. Prereqs: routing, CA, `s2s`. |
| 2026-06-19 | UPC (feeds & catalog-items) | [upc-feeds-catalog-items](2026-06-19-upc-feeds-catalog-items.md) | Optional. Product feeds → items under a workspace. Additive schema + scaffold. Prereqs: routing, CA, `s2s`, **Client Catalog**. |
| 2026-05-22 | Cost allocation tags | [cost-allocation-tags](2026-05-22-cost-allocation-tags.md) | **All forks (mandatory infra).** Tag AWS spend by app/env/product + LiteLLM reconciliation. CDK + scripts; deploy + backfill + tag activation in the management account are human/DevOps steps. |
| 2026-05-14 | Data Sync | [data-sync](2026-05-14-data-sync.md) | Optional/niche. Dump admin-editable config to the shared S3 bucket and restore between envs (prod→staging). Additive; restore is destructive. CDK construct + scripts. |
| 2026-05-04 | Per-env image tags + `HOSTNAME` fix | [per-env-image-tags-hostname](2026-05-04-per-env-image-tags-hostname.md) | **All forks (mandatory infra).** Per-env ECR tag (decouple staging/prod) + Fargate `HOSTNAME` override (Next standalone health). CDK + build script; `cdk diff`/`deploy` are human steps. |
| 2026-03-25 | ⚠️ Shared MappLabs VPC migration (Transit Gateway) — **operational runbook, run standalone, NOT via the orchestrator** | [shared-vpc-migration](2026-03-25-shared-vpc-migration.md) | **Forks created before 2026-03-25** (or any fork whose `vpcId` still points at a standalone/non-TGW VPC like `mapp-labs-vpc-OLD`). Moves the app onto the shared TGW-attached VPCs so it can reach internal Mapp services (UPC / Client Catalog / internal Keycloak). **Stateful, destructive ops runbook** — `cdk deploy` replaces the RDS/ALB/SGs/cluster, so it's backup-first (`pg_dump`/`pg_restore`), staging-only, deploy-and-run-AWS with stop-and-confirm gates. Unlike every other prompt here, it *does* deploy. |
| 2026-06-10 | Keycloak auth — **internal only** | [keycloak-auth-internal-only](2026-06-10-keycloak-auth-internal-only.md) | Apps used **only by Mapp employees**. Replaces direct Entra login with Keycloak-brokered admin login; no customer/company path. **Corrected 2026-08-04** — earlier revisions omitted the redirect-URI registration step, so a fork that followed them gets fully-configured Keycloak that still fails login with "Invalid redirect URI". Apps that already applied this prompt should follow the 2026-08-04 `MIGRATION.md` entry. |
| 2026-06-10 | Keycloak auth — **company context** | [keycloak-auth-company-context](2026-06-10-keycloak-auth-company-context.md) | Apps that also serve **Mapp Cloud customers** with company context (companyId / workspaces / services), persisted for usage attribution. **Corrected 2026-08-04** — earlier revisions omitted the redirect-URI registration step, so a fork that followed them gets fully-configured Keycloak that still fails login with "Invalid redirect URI". Apps that already applied this prompt should follow the 2026-08-04 `MIGRATION.md` entry. |

Not sure which? If your app is logged into **only by Mapp staff**, use *internal
only*. If **external customers** (or Mapp Cloud company accounts) log in, use
*company context*. [KEYCLOAK-MIGRATION.md](KEYCLOAK-MIGRATION.md) is the short human
overview of that move (not a prompt).

## Mandatory vs optional

Each retrofit is one of two kinds — the orchestrator uses this to decide what to ask:

- **Mandatory (foundational / correctness):** App-Router fixes, routing conventions,
  CA trust, infra correctness. They fix latent bugs or are depended on by other
  changes, so they apply regardless of which features an app wants.
- **Optional (a capability):** only needed if the app uses that feature (Client
  Catalog, UPC, Data Sync, LLM, Company Login, Customer Preview). The orchestrator asks before applying
  — **but** an optional capability's prerequisites become required once you opt into it.

A single retrofit can be **partly** each. **Immutable image tags + ECR lifecycle
(2026-07-10)** is the notable case: the ECR lifecycle policy is **mandatory** (the real
outage fix, no IAM), while the immutable task-def revision is **opt-in** — it requires
`iam:PassRole`, which the standard `labs-power`/PowerUserAccess deploy identity lacks, so
it's off by default. Apply the mandatory part everywhere; enable the opt-in only where a
privileged deployer runs deploys.

## Dependency order (how the orchestrator sequences work)

Apply prerequisites first. The dependency-relevant chain:

```
App-Router + routing convention (2026-06-19, mandatory)
        └─ Internal root CA (2026-06-18, mandatory)
                └─ Shared internal-API s2s credential (2026-06-18)
                        └─ Client Catalog companies/workspaces (2026-06-19, optional)
                                └─ UPC feeds + catalog-items (2026-06-19, optional)

Independent (no UPC-chain dependency):
  • Cost allocation tags (2026-05-22, mandatory infra)
        └─ Cost tag hygiene — Owner tag + ECS task propagation (2026-08-01,
           mandatory infra). Finishes 2026-05-22: that entry added the tags,
           this one makes Fargate compute actually carry them and adds the
           per-person Owner key. Needs a deploy
  • Data Sync (2026-05-14, optional)
  • User Feedback (2026-07-08, optional)
  • Per-env image tags + HOSTNAME fix (2026-05-04, mandatory infra)
        └─ Immutable image tags + ECR lifecycle (2026-07-10; corrected 2026-07-11)
           — MANDATORY part = the ECR lifecycle policy (no IAM). The immutable
             task-def revision is OPT-IN (needs iam:PassRole; off by default).
             Finishes 2026-05-04; apply it after, or together with, that entry
  • Dependency updates — security + Notion SDK v5 (2026-07-11, soft-mandatory)
        — standalone; Notion part depends on User Feedback (2026-07-08) being present
        └─ Next.js 16 + dependency refresh (2026-09-07, all forks)
           — standalone and supersedes the dependency half of 2026-07-11. Carries a
             framework major. Safe to run on a fork that never applied 2026-07-11;
             it reconciles from whatever versions it actually finds. No deploy to
             adopt the code, but the CDK bump wants a staging `cdk diff` first
  • RDS storage gp2 → gp3 (2026-09-10, all forks with infra/)
        — standalone; touches one CDK property and nothing else. Deliberately NOT
          batched with any other infra change: RDS locks storage modifications for
          ~6 hours once started, so a co-deployed failure can strand the stack in
          UPDATE_ROLLBACK_FAILED. If the orchestrator has other infra retrofits
          pending, land those first and let them settle, then do this one alone
  • Docs layout — docs/ vs docs/template/ (2026-10-17, optional)
        — standalone, docs and comments only. Apply it LAST in a catch-up run:
          other prompts may still name the app's old doc paths, and it is
          easiest to move everything once they are done
  • Customer pages: server-session render + scope (2026-10-17, all forks with /account)
        — the scope helper requires Company Login (2026-06-10 company context);
          without it, apply the rest and record partial. Apply after Session cookie
          size (2026-10-09) if both are pending: both change how the session
          is resolved per request. Default deploy path
  • Customer Preview — "View as customer" (2026-10-17, optional, Company-Login apps)
        — requires Company Login (2026-06-10 company context), Customer pages:
          server-session render + scope (2026-10-17: it hooks into
          getCustomerRequestSession) and the Admin audit log (2026-10-09). Apply
          after all three; not-applicable without Company Login. Ask the owner
          whether to enable it or install only the inert hooks. Enabling is a CDK
          change (two env vars in infra/lib/stack.ts), so if RDS gp3 (2026-09-10)
          is also pending, keep their infra deploys apart
  • Safe redirects, private API caching, escaped search (2026-10-17, all forks)
        — standalone security fix; apply early in a catch-up. The sign-in half
          assumes the Keycloak /auth/admin page (2026-06-10); the search half
          touches the audit-log service if 2026-10-09 is applied, so do it after
          that one. API caching applies only with the public_api capability
  • Windows (Git Bash) + Docker cleanup (2026-10-17, all forks)
        — standalone, scripts only. The Keycloak CA-bundle part needs the vendored
          internal root CA (2026-06-18); skip that block without it
  • Admin audit log + Settings link (2026-10-09, all forks)
        — standalone. One additive table, default deploy path. Apply it after
          App identity (2026-09-22) if both are pending: both touch the admin
          navigation. Wiring the app's own mutations into the log is per-app
          work the orchestrator should scope with the owner, not guess at
  • Session cookie size / HTTP 431 (2026-10-09, all forks with Keycloak login)
        — requires Keycloak auth (2026-06-10, either variant) to be present;
          not applicable otherwise. One additive table, so the default deploy
          path is correct — do NOT route it through the maintenance deploy
  • App identity — display name + optional logo (2026-09-22, optional)
        — standalone and cosmetic. Ask before applying, and apply it late:
          it edits shared layout files other retrofits may also touch
  • Maintenance deploy path (2026-08-04, all forks, not urgent)
        — standalone and additive: adds a second deploy path, changes nothing about
          the existing one. Reads app.config.json `immutableDeploy`, so it works
          whichever side of 2026-07-10 the app is on. No deploy required to adopt

Handled inline from MIGRATION.md (too small for a dedicated prompt):
  • Admin sidebar: Settings pinned to the bottom + one active-link rule (2026-10-17)
  • Prisma pg pool errors logged at error level (2026-10-17)
  • Test tooling: Jest 30 DB-test flag, redacted DB URLs, .claude/ ignored (2026-10-17)
  • Entra redirect registration skipped for Keycloak apps (2026-10-09)
  • "Pre-Authorize Employee" removed from Mapp Team (2026-10-09, optional)
  • LLM MODELS.OPUS → 4.8 bump (2026-06-18)
  • LLM model-list refresh + self-service keys (2026-05-26)
  • LLM streaming include_usage convention (2026-05-26)
```

All other entries above have dedicated prompts (see the table). The entries under
"Handled inline" remain intentionally promptless — the orchestrator applies them inline
from MIGRATION.md.
