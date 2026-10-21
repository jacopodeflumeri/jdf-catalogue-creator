# Agent Safety Guidelines

This file provides mandatory instructions for AI coding agents (Claude Code, Cursor, Copilot, etc.) working in this repository. These rules protect the shared AWS environment and other projects in the Mapp Labs account.

## Scope Restriction

This repository manages **one application** identified by the `appName` in `app.config.json`. All actions MUST be scoped to this application's resources only.

**Before running any destructive or modifying AWS command**, read `app.config.json` and confirm the app name. Only operate on resources that match the pattern `{appName}-{env}` (e.g., `myapp-stg`, `myapp-prod`).

### What this app owns

Resources created by this app's CDK stack follow the naming convention `{appName}-{env}` where env is `stg` or `prod`:

- **CloudFormation stack**: `{appName}-stg`, `{appName}-prod`
- **ECS Cluster/Service**: `{appName}-stg`, `{appName}-prod`
- **ALB (public)**: `{appName}-stg`, `{appName}-prod`
- **ALB (internal)**: `{appName}-stg-int`, `{appName}-prod-int`
- **RDS database instance**: `{appName}-{env}-database*` (CDK-suffixed)
- **CloudWatch Log Groups**: `/ecs/{appName}-stg`, `/ecs/{appName}-prod`
- **EventBridge Rule**: `{appName}-stg-ecs-task-state-change`, `{appName}-prod-ecs-task-state-change`
- **ECR repository**: `{appName}`
- **S3 bucket**: `mapp-labs-{appName}-staging`, `mapp-labs-{appName}-prod`
- **SSM parameters**: `/{appName}-stg/*`, `/{appName}-prod/*`
- **Secrets Manager**: `{appName}-{env}/db-credentials`
- **Route53 records**: `stg-{appName}.labs.mapp.com`, `{appName}.labs.mapp.com`
- **Icinga services**: `http_stg-{appName}.labs.mapp.com`, `http_{appName}.labs.mapp.com`

### What this app does NOT own

These are shared Mapp Labs account resources. **NEVER modify or delete these**:

- **VPC**: `vpc-019564bfe26ac6eeb` (`mapp-labs-vpc`)
- **Route53 Hosted Zone**: `labs.mapp.com` (Z03706141H2K96TGWE8I9) — you may add/remove records for this app's domain only
- **Security Group**: `sg-0895e19a44c05aad1` (Mapp VPN/Office)
- **CDK Bootstrap stack**: `CDKToolkit`
- **Other apps' stacks**: Any CloudFormation stack not matching `{appName}-*`
- **Other apps' ECR repos, S3 buckets, RDS instances, ECS clusters**
- **Icinga Director / monitoring infrastructure**: `mon11.muc.domeus.com` — you may add/remove services for this app only
- **Shared data-sync bucket**: `s3://mapp-labs-data-sync` — provisioned by the `mapp-labs-shared` template. This app may only read/write under `config/{env}/{appName}/*` (enforced by IAM via the `DataSyncIntegration` construct). Never modify the bucket policy, lifecycle, or anything outside this app's prefix.

## Documenting Your Work

Docs are split by owner:

- **`docs/`** (top level) — **this app's own docs**. You write and maintain these.
- **`docs/template/`** — reference shipped by `labs-app-template` (auth, deploy,
  capabilities, design system). Read it; **do not edit it** except when applying a
  template retrofit. Index: `docs/template/README.md`.
- **`docs/retrofit/`** — prompts for catching up with newer template versions.

When you build a feature or make a structural decision, document it **in the same
commit as the code**:

1. **One living doc per feature area** in `docs/` (e.g. `docs/ORDERS.md`): what it
   does, how it works, key files, data model, decisions (dated, with the *why*),
   and pitfalls. Extend the existing doc rather than starting a new one per change.
2. **Update the doc when behaviour changes** — a stale doc is worse than none.
3. **Link every new doc from `docs/README.md`.**
4. **Cross-cutting pitfalls** (things any future change could trip over) go in
   "App Notes and Pitfalls" at the end of this file.
5. **Never put secrets in docs** — name the SSM parameter instead.
6. **Tests travel with behaviour:** add or update tests when behaviour changes —
   unit tests, plus `*.db.test.ts` where real database behaviour matters.

## Prohibited Actions

The following actions are **NEVER allowed** without explicit user confirmation AND a clear understanding that the action is scoped to this app only:

### Hard prohibitions (never do these, even if asked)

1. **Do not delete or modify the VPC, subnets, NAT gateway, or internet gateway**
2. **Do not delete or modify the Route53 hosted zone itself** (adding/removing records for this app is fine)
3. **Do not delete or modify other applications' CloudFormation stacks, ECS clusters, RDS instances, S3 buckets, or ECR repositories**
4. **Do not run `aws` CLI commands with broad wildcards** that could affect resources outside this app (e.g., `aws s3 rm s3:// --recursive` without a specific bucket)
5. **Do not modify IAM policies, roles, or users** that are shared across applications
6. **Do not modify the CDK bootstrap stack**
7. **Do not run `cdk destroy` for any stack other than this app's stacks**
8. **Do not delete the ECR repository** — it contains images shared across environments

### Require explicit confirmation (ask the user first)

1. **`cdk destroy`** — Only for this app's stacks (`{appName}-stg` or `{appName}-prod`). Always confirm which environment.
2. **Database reset/drop** — `prisma migrate reset --force`, `prisma db push --force-reset`, `DROP SCHEMA`, etc. Always confirm which environment and database.
3. **S3 bucket deletion or emptying** — Only for this app's buckets. Confirm the bucket name matches `mapp-labs-{appName}-*`.
4. **SSM parameter deletion** — Only under this app's prefix `/{appName}-{env}/` (where env is `stg` or `prod`). Confirm the path.
5. **Secrets Manager secret deletion** — Only `{appName}-{env}/db-credentials` (where env is `stg` or `prod`).
6. **Route53 record deletion** — Only this app's records (`stg-{appName}.labs.mapp.com` or `{appName}.labs.mapp.com`).
7. **ECS service scale to zero** or stopping all tasks. This includes
   `make staging-deploy-maintenance` / `make prod-deploy-maintenance`, which drain
   the service on purpose — it is the *sanctioned* way to do it for a breaking
   migration, but it takes the app offline and fails closed (a failed run leaves
   the service down deliberately). Confirm the environment and the window first,
   and never compose the individual `update-service` calls by hand instead. See
   [docs/template/DEPLOYMENT.md](docs/template/DEPLOYMENT.md#deploying-updates).
8. **RDS instance deletion or snapshot deletion**.
9. **Any `--force` flag on a production command**.
10. **Icinga service removal** — `make staging-monitoring-remove` or `make prod-monitoring-remove`. Removing a monitoring service means the app will no longer be checked by Icinga. Confirm which environment.

## Interpreting Ambiguous Requests

When a user says something vague or potentially dangerous, interpret it conservatively:

| User says | Interpret as | NOT as |
|-----------|-------------|--------|
| "Clean up" | Remove local build artifacts (`make dev-clean`) | Delete AWS resources |
| "Delete everything" | Ask what specifically they want deleted | Delete all AWS resources |
| "Start from scratch" | Reset the local dev database and reinstall deps | Destroy AWS infrastructure |
| "Reset the database" | Reset the LOCAL dev database | Reset staging/production databases |
| "Tear it down" | Ask which environment and confirm | Destroy all environments |
| "Remove the staging environment" | `cdk destroy` for staging only, after confirmation | Delete production too |
| "Clean up AWS" | List resources for this app and ask what to remove | Delete any/all AWS resources |
| "Delete old deployments" | Remove old Docker image tags from ECR (keep recent) | Delete ECS services or CloudFormation stacks |

**When in doubt, ask.** It is always better to ask a clarifying question than to take an irreversible action.

## Do NOT Invent Blockers

Being conservative about *destructive* actions is correct. Being conservative
about *documented, automated, non-destructive* steps is not — it stalls app
owners on work the template already handles for them.

Before telling the user something is "blocked", "needs platform-team approval",
or "needs a credential I don't have", you MUST:

1. **Search the docs and scripts for the thing you think is missing.** Grep
   `scripts/deploy/`, `AGENTS.md`, and `docs/` first.
2. **Actually attempt the documented path** and read the real error. A
   hypothesis about a missing permission is not a blocker; a failed command
   with output is.
3. **Never infer a blocker from the absence of a credential in the app's own
   SSM namespace.** Several automated steps deliberately read credentials from
   *shared* SSM paths (`/labs/*`, `/labs-prod/*`) on the deployer's machine and
   never copy them into the app namespace. That separation is intentional
   blast-radius containment, not a missing setup step.

### Self-serviceable: Keycloak redirect-URI registration

Registering this app's redirect URI on the shared `labs-portal` Keycloak client
is **self-serviceable — it never requires the labs-platform team.** The
credentials to do it are already provisioned in shared SSM.

The script authenticates to the Keycloak Admin REST API with a dedicated service
account whose credentials live in `/labs/kc-registrar/*` (staging) or
`/labs-prod/kc-registrar/*` (production). Your app's own SSM namespace
intentionally contains **only** the `labs-portal` OIDC client secret and **no**
admin-capable credential — that separation is by design, and is NOT a reason to
escalate.

**First, check whether this app actually has the script:**

```bash
ls scripts/deploy/register-keycloak-uris.sh
grep -rn "register-keycloak-uris" scripts/deploy/
```

**Case A — the script exists and is wired into the deploy scripts.** (True for
apps created from a recent template clone.) Registration is automatic:

- `make staging-first-deploy` → step 7/7
- `make staging-deploy` → step 4/4
- or standalone: `bash scripts/deploy/register-keycloak-uris.sh staging`

**Case B — the script is missing, or exists but nothing calls it.** This is
expected for **retrofitted apps** — apps forked from the template before
Keycloak support landed, then retrofitted via `docs/retrofit/2026-06-10-keycloak-*`.
Those guides historically omitted this step. Copy the script from the template
and wire it into this app's deploy script (`full-deploy.sh` / `first-deploy.sh`,
or wherever this app's post-deploy steps live), then run it. Still no
platform-team involvement.

In **both** cases, `KEYCLOAK_ENABLED` must be `true` in this app's SSM for the
Keycloak path to be active. Retrofitted apps often have it `false` pending
validation — flipping it after you have registered the URI and verified login is
a normal app-owner action, not something to escalate.

When the registration step genuinely fails, the cause is almost always one of
these two — both fixable by the app owner:

| Symptom | Cause | Fix |
|---|---|---|
| `HTTP status: 404` with an nginx HTML error body | Not connected to Mapp VPN. The Keycloak admin host is internally routed. | Connect to Mapp VPN and re-run |
| `ERROR: 'jq' is required but not installed` | `jq` missing | `brew install jq` (macOS) / `apt-get install jq` (Linux) |

Escalate to labs-platform **only** if the shared `/labs/kc-registrar/*`
parameters are absent, or the token request returns `401 invalid_client`.

## Safe Operations (no confirmation needed)

These are safe and can be run freely:

- `make dev-*` commands (local development operations)
- `npm install`, `npm run build`, `npm run dev`
- `npx prisma generate`, `npx prisma studio`
- `git` operations (commit, push, branch, etc.)
- Reading AWS resources (`aws ecs describe-*`, `aws rds describe-*`, `aws logs filter-*`, etc.)
- `make staging-ecs-status`, `make prod-ecs-status` (read-only status checks)
- `make staging-logs`, `make prod-logs` (read-only log tailing)
- `make staging-infra-diff`, `make prod-infra-diff` (read-only CDK diff)
- `make dev-db-reset` (local database only)
- Running tests (`make dev-test`, `make dev-test-unit`)
- TypeScript type checking, linting
- `make staging-monitoring-add`, `make prod-monitoring-add` (registers health check in Icinga — non-destructive, idempotent)

## AWS CLI Safety Rules

When running `aws` CLI commands:

1. **Always include `--profile labs-power`** — never use default credentials
2. **Always include `--region eu-central-1`** — this is the only region for Mapp Labs
3. **Always scope to this app's resources** — use the app name from `app.config.json` in filters and resource names
4. **Never use `--no-cli-pager` with destructive commands** — let the user see the output
5. **For any `delete`, `remove`, `terminate`, or `destroy` command**: state exactly which resource will be affected and ask for confirmation
6. **Never run `aws iam`** commands unless explicitly instructed and the scope is clearly this app's task/execution roles only

## CDK Safety Rules

1. **Always pass `-c env=staging` or `-c env=production`** — never run CDK commands without specifying the target environment
2. **Run `cdk diff` before `cdk deploy`** — always show what will change
3. **Never run `cdk destroy` on production without multiple explicit confirmations**
4. **The CDK stack creates resources with `RemovalPolicy.RETAIN` for production** — this is intentional; do not change it to `DESTROY`
5. **Never modify `RemovalPolicy` on production RDS instances**
6. **Cost-allocation tags must cover any infrastructure you add.** App-level tags (`cdk.Tags.of(app)` in the CDK entry file) auto-cover everything CDK creates, including new stacks — so in-stack additions need nothing. But a **new Fargate service** needs `enableECSManagedTags: true` + `propagateTags: SERVICE`, and **out-of-band resources** (created via `aws` CLI/console) must be tagged at creation with `Project`/`Product` (+ `Environment` if per-env). **Never tag shared cross-project infrastructure** (VPC, Transit Gateway, Route53 zone, shared buckets) — those aren't owned by this app. See `docs/template/COST_ALLOCATION.md`.

## Versioning on Deploy

The app version (`package.json`) is **baked into the Docker image at build time** (`NEXT_PUBLIC_APP_VERSION`, surfaced at `/api/health`). `make {env}-deploy` does **not** bump it — versioning is a separate step (`make version-patch|minor|major`, which commits and git-tags).

A version bump is **not mandatory and is the user's decision** — but when you deploy on the user's behalf, **remind them that bumping the version before deploying is recommended** (so the release is git-tagged and `/api/health` reports the right version). Because the version is baked at build time, any bump must happen **before** the build/deploy step. Default to suggesting **`make version-patch`** — most releases are patches. Suggest `version-minor` only for a significant new capability or user-visible feature set, and `version-major` only for breaking changes. The template itself only ever bumps patch (`1.0.x`), so an app's **first** `version-minor` (e.g. `1.0.x` → `1.1.0`) is a good way to mark that it has moved past the template version it was created from — suggest it once the app ships its own features, then go back to patches. Do not bump automatically, and confirm before pushing tags.

## Choosing a Deploy Path

**`make {env}-deploy` is the default and has not changed.** It builds, pushes, rolls
the ECS service, and migrates afterwards. Use it for essentially every release. Do
not switch a user to the maintenance path on your own initiative, and never
substitute it silently — it takes the app offline.

`make {env}-deploy-maintenance` exists for the rare release where the *running*
image cannot survive the migration. **Suggest** it — as a question, not an action —
when you see:

- an in-place table or column **rename**, or a **dropped/narrowed** column the
  current version still selects
- a **large batch of migrations** going out at once (a long-lived branch, a merge
  that accumulated several), where the odds that one of them is breaking are high
  and the migration window is long
- a **backfill or data migration** that must not race with live writes
- a migration expected to hold locks long enough that a serving task would error

Additive migrations — new table, new column, new index, new enum value — do **not**
need it. Neither does a code-only release.

When you raise it, **explain the trade-off in plain language and let the user
decide**. Roughly:

| | `make {env}-deploy` (default) | `make {env}-deploy-maintenance` |
|---|---|---|
| Downtime | None | Yes — from ALB gate to restored service |
| Risk it covers | — | Old code never sees the new schema |
| Risk it carries | Outgoing tasks briefly serve requests against the new schema | The app is down for the whole window |
| On failure | ECS circuit breaker rolls back; app keeps serving | **Stays down on purpose**; needs a fix-forward and `MAINTENANCE_RESTORE_DESIRED_COUNT=1` to retry |
| Typical use | Every release | A handful per year |

Say explicitly that the maintenance path **fails closed** — a failed run leaves the
service at desired count 0 deliberately, because restarting old code against a
migrated database is worse than being down. That is the single most important thing
for the user to understand before agreeing to it, and it is why it should be run
during working hours, staging first.

If the user is unsure, the safe answer is: run the default deploy to **staging**
first and see whether anything breaks. Also see
[docs/template/DEPLOYMENT.md](docs/template/DEPLOYMENT.md#deploying-updates), including the section on
writing migrations idempotently — that matters on **both** paths, since neither can
rescue a migration that half-applies.

## Frontend Development Standards

When creating or modifying any frontend code (components, pages, layouts, styles), you MUST consult the design and UX documentation in `docs/template/` first:

- **`docs/template/DESIGN-SYSTEM.md`** — Component library standards, color tokens, typography, spacing, and design patterns. All new UI must use the existing design system components and tokens.

**Rules:**

1. Read the relevant docs before writing any new component or page.
2. Use existing UI components from `src/components/ui/` — do not create new ones unless the design system docs explicitly call for it. The full list, with when to use each, is in `docs/template/DESIGN-SYSTEM.md` §11.
3. Follow the established color tokens, spacing scale, and typography from the design system — do not introduce ad-hoc values.

## Getting Started / Initial Setup

When a user asks to set up the project for the first time (or asks "what do I need to do to get started"), follow this sequence:

1. **Check prerequisites** — Run `make dev-check-prerequisites` or guide the user through `./scripts/setup.sh` (which checks automatically). The required tools are:

   | Tool | Required For | Install |
   |------|-------------|---------|
   | `node` (v22+, see `.nvmrc`) | Everything | https://nodejs.org/ |
   | `npm` | Everything | Included with node |
   | `git` | Version control | https://git-scm.com/ |
   | `psql` | Local database operations | `brew install postgresql@17` or `apt install postgresql-client` — see `docs/template/LOCAL-POSTGRES.md` |
   | `createdb` | Creating local database | Included with PostgreSQL client |
   | Git Bash + `make` (Windows only) | Every `make` target and script — cmd/PowerShell are unsupported | See `docs/template/WINDOWS.md` |

   These are **optional** but needed for deployment:

   | Tool | Required For | Install |
   |------|-------------|---------|
   | `docker` | Building and pushing container images | https://docs.docker.com/get-docker/ |
   | `aws` CLI v2 | All AWS operations | https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html |
   | `session-manager-plugin` | ECS Exec (remote migrations, seeding) | https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html |
   | `jq` | Keycloak URI registration (last deploy step) | `brew install jq` / `apt-get install jq` / `winget install jqlang.jq` |
   | `openssl` | Generating secrets for SSM parameters | Usually pre-installed on macOS/Linux |

2. **Clone and rename** — The user should clone the template into a directory named for their project: `git clone git@github.com:mapp-digital/labs-app-template.git labs-{appName}` and `cd` into it.
3. **Configure the project** — Run `./scripts/setup.sh`. This prompts for app name, display name, database name, team, super admin email(s), etc. It also:
   - Auto-generates `NEXTAUTH_SECRET`
   - Reinitializes git with a clean history (removes the template's commit history)
   - Prompts for the new repository URL and sets it as the `origin` remote
   - Suggests renaming the directory if it still has the template name
4. **Create local database** — `createdb {dbName}` (using the database name from setup)
5. **Run initial setup** — `make dev-initial-setup` (installs deps, migrates, seeds)
6. **Start developing** — `make dev-server`
7. **Push initial commit** — `git push -u origin main`

**Login needs no Entra setup.** Keycloak is the default (`KEYCLOAK_ENABLED=true`) and brokers to Entra itself, so a new app needs **no** Azure credentials, **no** `make shared-ssm-setup`, and **no** `make {env}-entra-*` step. Do not send an app owner down that path. The only login-related deploy step is the Keycloak redirect-URI registration, which `make {env}-deploy` runs automatically (see "Self-serviceable: Keycloak redirect-URI registration" above).

The `*-entra-*` and `shared-ssm-setup` targets remain for the **legacy direct-Entra path** only — an app deliberately running with `KEYCLOAK_ENABLED=false`. `make {env}-infra-deploy` skips the Entra registration when Keycloak is enabled. See `docs/template/ENTRA-SETUP.md`.

Do NOT skip the prerequisite check. If a required tool is missing, help the user install it before proceeding.

**Important:** The setup script reinitializes git, which means the template's commit history is removed. This is intentional — each new project starts with a clean "Initial commit from labs-app-template" as its first commit.

## Permission Level Rules

The admin panel enforces three access levels stored in `MappTeam.accessLevel` (default: `"viewer"`):

| Level | DB Value | Display Label | Capabilities |
|-------|----------|---------------|-------------|
| Regular User | `viewer` | Viewer | Read-only everywhere. Default for new logins (after the first). |
| Editor | `editor` | Editor | All viewer capabilities + modify accounts, manage users, data operations. Cannot manage team access. |
| Admin | `admin` | Admin | Full access including team management. |

**Bootstrap / access status (no pending/approval):** the FIRST Mapp user ever to
log in becomes `active`/`admin`; everyone after is `active`/`viewer`. There is no
pending state — `MappTeam.accessStatus` is `active|suspended|denied` (suspended/
denied are for moderation). `accessStatus` is refreshed per request in the JWT
callback and carried on the session, so `require-auth` enforces it without a
second DB read. SuperAdmins (via `SUPER_ADMINS` env var) bypass access checks.

### Server-Side Enforcement

- **Read/list actions**: Use `requireAdmin()` (allows any active admin regardless of level)
- **Mutation actions**: Use `requireAdmin({ requireEditorAccess: true })` (requires editor or admin level)
- **Team management actions**: Use `requireAdmin({ requireAdminAccess: true })` (requires admin level)
- **SuperAdmin-only actions**: Use `requireAdmin({ requireSuperAdmin: true })`

When adding new server actions:
1. Import `requireAdmin` from `@/modules/auth/server`
2. Read-only actions: `await requireAdmin({})`
3. Mutations: `await requireAdmin({ requireEditorAccess: true })`
4. Team/access management: `await requireAdmin({ requireAdminAccess: true })`
5. **Consequential** mutations (see "What to record" in `docs/template/capabilities/AUDIT_LOG.md`): after the change succeeds, record it with `writeAuditLog({ ...sessionAuditActor(session), action, entityType, entityId, message })` from `@/modules/audit`. It never throws, so it needs no `try/catch`. Never put secrets in `message` or `data`

New admin pages are reached from **Settings** (`/admin/settings`): add a card to `SETTINGS_SECTIONS` in `src/app/admin/settings/client.tsx` rather than another sidebar entry.

### Client-Side UI

- Use `useAccessLevel()` hook from `@/modules/auth/client` in client components
- Returns `{ accessLevel, isSuperAdmin, canEdit, isAdmin }`
- **Hide** (don't disable) mutation buttons when `canEdit === false`
- Server components: compute `canEdit` from `session.user.access` and pass as prop

### Permission Matrix

The full matrix is defined in `src/modules/auth/utils/access-control.ts` (`ACCESS_PERMISSIONS`). Convenience checkers: `canViewAccounts()`, `canEditAccounts()`, `canManageUsers()`, `canViewAnalytics()`, `canManageTeam()`.

### Documentation

- Full permission system reference: `docs/template/PERMISSION-LEVELS.md`

## Capabilities System

This template includes a capabilities system for optional integrations with Mapp's internal services. When a user describes what they want to build, check the capabilities registry to determine which integrations to enable.

### Key Files

- `docs/template/capabilities/README.md` — Overview of the system
- `docs/template/capabilities/_registry.json` — Machine-readable registry (read this first)
- `docs/template/capabilities/*.md` — Individual capability documentation
- `prisma/schema/*.prisma.example` — Database schema fragments for each capability

### Available Capabilities

| ID | Name | Type |
|----|------|------|
| `audit_log` | Audit Log | Standard (always included) — who changed what, and when. Server actions call `writeAuditLog` (`src/modules/audit`); read at `/admin/audit-log`, linked from Settings. **Nothing is recorded automatically: when you build a feature, record its *consequential* changes as part of the same work** — access/permissions, deletes, behaviour-changing configuration, bulk operations, publishing, acting on a customer's behalf. Not reads, not every edit. A new kind of entity needs one line in `src/modules/audit/entity-types.ts` (no migration). See "What to record" in `docs/template/capabilities/AUDIT_LOG.md` |
| `client_catalog` | Client Catalog | Optional — company/workspace discovery |
| `upc` | UPC | Optional — product feed access |
| `ftl` | Fashion Trends Lab | Optional — taxonomy, trends, outfit rules |
| `public_api` | Public API | Optional — versioned REST API with Swagger |
| `llm` | LLM (LiteLLM Proxy) | Optional — LLM calls via proxy with billing attribution |
| `data_sync` | Data Sync | Optional — cross-env config dump/restore via shared S3 bucket (purpose-built for prod→staging refreshes; not a general S3 capability) |
| `s3_storage` | S3 Storage (images & files) | Standard — upload/serve images and files from the per-app S3 bucket (WebP, variants, presigned URLs). **Access is declared in one place**, `src/modules/s3_images/config/prefixes.ts`: `public/` anonymous-readable, `content/`/`temp/` authenticated, `mapp-team/` admin-write. A new route serving S3 objects MUST call `authorizeS3Read()`. See `docs/template/capabilities/S3_STORAGE.md` |
| `sftp` | SFTP | Optional — file exchange with ONE external SFTP endpoint for counterparties that only speak SFTP. Confined to a per-app directory (`{SFTP_ROOT_PATH}/{appName}`), host key pinned. **Confinement is code-enforced, not IAM-enforced** — chroot the service account. Prefer S3 / `data_sync` when you control both ends. See `docs/template/capabilities/SFTP.md` |
| `company_login` | Company Login (Keycloak / Mapp Cloud) | Standard (default-on, opt-out) — Keycloak auth + company-context customer path + CompanyUser attribution. **The internal-only-vs-external switch:** `COMPANY_LOGIN_ENABLED=false` makes the app Mapp-internal-only (external company logins refused, Company Users views hidden). App-specific behavior via two seams (company→account, eligibility). See `docs/template/capabilities/COMPANY_LOGIN.md` |
| `dev_login` | Dev Login Bypass | Standard — local mock login without AWS/Keycloak (`/auth/dev`, `DEV_AUTH_ENABLED`, non-prod only). See `docs/template/capabilities/DEV_LOGIN.md` |
| `keycloak_api_auth` | Keycloak API Token Auth | Optional — accept Keycloak bearer tokens on API routes (`withKeycloak` / `withHybridAuth`). See `docs/template/capabilities/KEYCLOAK_API_AUTH.md` |
| `user_feedback` | User Feedback | Optional — in-app feedback widget writing to a shared Notion database (reporter/app/owner/company auto-filled). No Prisma model, no in-app LLM (a centralized Notion agent triages). Copy-in scaffold for the widget + route. See `docs/template/capabilities/USER_FEEDBACK.md` |
| `customer_preview` | Customer Preview ("View as customer") | Optional (off by default; needs `company_login`, `client_catalog` recommended) — an admin-level user previews a company's `/account` pages exactly as its Company-Login customers see them: read-only, 30 min, bound to that admin, audited (`customer_preview_start`/`_end`, entity `company`). Launch points on `/admin/company-users` and the client_catalog company page. **Every customer mutation must call `assertNotPreview(session)`** (`@/modules/customer_preview`); `requireCustomer` also refuses server actions during a preview unless they pass `{ readOnly: true }`. Data seam: `src/modules/customer_preview/config/subject.ts`; set `CUSTOMER_PREVIEW_SERVICES` to the codes your eligibility policy checks. The design decisions are already made — read the doc before changing any of them. See `docs/template/capabilities/CUSTOMER_PREVIEW.md` |

### When to Check Capabilities

- User mentions connecting to Mapp services (companies, workspaces, products, feeds)
- User mentions exposing an API or needing Swagger documentation
- User mentions fashion taxonomy, trends, outfit rules
- User describes building something for Intelligence, Engage, or Fashion customers
- User mentions LLM calls, AI features, text generation, or chat functionality
- User mentions copying or refreshing config / taxonomy / rules / settings from prod into staging (or any cross-environment data move) — see `data_sync`
- User mentions collecting user feedback, a feedback widget/button, bug reports, or feature requests from within the app — see `user_feedback`
- User wants admins or support staff to see the customer side "as the customer sees it", impersonate or preview a company, or debug what a customer sees — see `customer_preview`
- User mentions SFTP, a file drop, an inbound/outbound feed directory, or a partner who can only exchange files (not APIs) — see `sftp`
- User mentions image uploads, avatars, file attachments, a media library, or serving user-uploaded content — see `s3_storage`
- During initial project setup when the user describes their app's purpose

### How to Enable a Capability

1. Read `docs/template/capabilities/_registry.json` to find the capability
2. Read the capability's `.md` file for full details
3. Set the required environment variables in `.env` — for capabilities that call
   internal Mapp services, **read the values from shared SSM** (see below); do not
   leave placeholders and do not ask the app owner for them
4. If schema changes are needed, apply the `.prisma.example` fragment to `prisma/schema.prisma`
5. Run `npx prisma migrate dev` to apply schema changes
6. Import the module from `src/modules/` in your app code
7. Update `app.config.json` `enabledCapabilities` array

### Credentials for internal Mapp services (client_catalog, upc, …)

Capabilities that call internal Mapp services need a base URL and an OAuth2
credential. **These already exist — you look them up, you never invent them and
never ask the app owner for them.** They live in the shared, account-wide SSM
namespace `/mapp-labs*` (account `936190502406`, `eu-central-1`, profile
`labs-power`), which is read-only from an app's perspective.

> ⚠️ **The shared namespace is per-environment.** Production keeps the unsuffixed
> prefix `/mapp-labs`; staging is `/mapp-labs-stg`. **A staging app that reads
> `/mapp-labs/*` silently talks to PRODUCTION** — it works, so the mistake is
> invisible. The `s2s` client id is `mapp-labs` in both, but the *secret* differs
> per realm. Per-service base URLs (e.g. `CLIENT_CATALOG_BASE_URL`) are
> per-environment too, and must match the credential's environment.

| Shared SSM parameter | Env var | Used by |
|---|---|---|
| `/mapp-labs[-stg]/internal-api/token-url` | `INTERNAL_API_TOKEN_URL` | all internal services |
| `/mapp-labs[-stg]/internal-api/client-id` | `INTERNAL_API_CLIENT_ID` (`mapp-labs`) | all internal services |
| `/mapp-labs[-stg]/internal-api/client-secret` | `INTERNAL_API_CLIENT_SECRET` (SecureString) | all internal services |

```bash
# staging — use --path /mapp-labs/internal-api for production
aws ssm get-parameters-by-path --path /mapp-labs-stg/internal-api --with-decryption \
  --profile labs-power --region eu-central-1 \
  --query 'Parameters[].[Name,Value]' --output text
```

Write them into `.env` (gitignored). Never commit the secret. One credential
serves **all** internal services *within an environment* — do not add a
per-capability OAuth trio.

**Base URLs are not secrets and not per-environment** — each internal service is a
single shared deployment, so the base URL is a constant you paste straight into
`.env`, no AWS call:

| Env var | Value |
|---|---|
| `CLIENT_CATALOG_BASE_URL` | `https://company-management-service.k8s-prod-01.nbg.webtrekk.com/gum-service/api` |

The `_registry.json` `envVarSources` field carries the same mapping in
machine-readable form. Full detail: `docs/template/INTERNAL-API.md`.

## Local Development Safety

1. `make dev-db-reset` operates on the LOCAL database only — this is always safe
2. `make dev-clean` removes `node_modules`, `.next`, `dist`, `coverage`, `src/generated` — always safe
3. Never run `prisma migrate reset` against a remote database URL without explicit confirmation
4. The `.env` file contains local credentials only — staging/production secrets are in AWS SSM Parameter Store

## Keycloak Auth (Mapp Entra ID + Company Login)

This template ships with Keycloak-backed `/auth/admin` that shows two buttons:
**Mapp Entra ID** and **Company Login**. Both go through the shared INT KC
`labs` realm via the `labs-portal` OIDC client.

### Local login WITHOUT AWS (dev auth bypass)

For most local work you don't need AWS or a real Keycloak. Set
`DEV_AUTH_ENABLED=true` in `.env` (only honored when `NODE_ENV!=production`) and
visit **`/auth/dev`** — a mock IdP that lets you sign in as an admin or a
company customer. It mocks only the identity; the REAL `signIn` hydration +
eligibility code runs, so you can exercise the full admin/customer/eligibility
matrix offline. The `/auth/dev` route 404s entirely in production.

`NEXTAUTH_URL` must match the dev port — Next falls back to 3001/3002 if 3000 is
busy, and a mismatched `NEXTAUTH_URL` makes auth redirects 404.

To test the REAL INT Keycloak instead, use the Keycloak path below.

### What you (the AI agent) should do when an app owner asks about login

- **Default to Keycloak login** for new apps. `KEYCLOAK_ENABLED=true` is the
  template default. Do not flip it to `false` unless explicitly asked.
- **Never ask the user to provide a KC client secret.** The labs-portal client
  secret is shared across all Labs apps and lives in `/labs/labs-portal/client-secret`
  SSM. `make staging-ssm-setup` copies it into the app's namespace
  automatically. If the auto-copy reports "SHARED PARAM MISSING", the labs-platform
  team needs to populate the shared SSM; that's outside the app owner's scope.
- **For local dev, use port 3000 first.** If 3000 is taken, try 3001, then 3002
  (the labs-portal client has only `localhost:3000`, `localhost:3001`,
  `localhost:3002` pre-registered). `register-keycloak-uris.sh` only registers
  `https://` hostnames, so it cannot add another localhost port — free one of the
  three instead. Keep `NEXTAUTH_URL` in `.env` on the same port.
- **For local dev, populate `KEYCLOAK_CLIENT_SECRET` in `.env`** from shared SSM:
  ```bash
  aws ssm get-parameter --name /labs/labs-portal/client-secret --with-decryption \
    --query Parameter.Value --output text --profile labs-power --region eu-central-1
  ```
  Never write the value into the repo. `.env` is gitignored.
- **Deploy registers the URI automatically.** `make staging-deploy` includes a
  post-deploy step (`scripts/deploy/register-keycloak-uris.sh`) that calls KC
  Admin REST via a dedicated service account (creds in `/labs/kc-registrar/*`
  SSM) to register the app's hostname on labs-portal. No manual KC admin step.
- **Do not modify the labs-portal client config via the admin UI**. If you need
  redirect URIs added or removed, use the `register-keycloak-uris.sh` script.
  Direct UI edits drift from automation.

### Common pitfalls (already fixed in template — do not regress)

- `src/app/auth/signout/page.tsx` MUST pass next-auth's `getToken()` the cookie
  **store** (`req: { cookies: await cookies(), headers: {} }`), never a raw `Cookie`
  header. `getToken()` ignores the header and returns `null`, which silently disables
  Keycloak logout — the app cookie clears, but the SSO session survives and the next
  login passes straight through. This was broken from 2026-06-10 to 2026-10-09.
  `src/__tests__/signout-page.test.ts` guards it with the real `getToken`.
- `src/app/auth/signout/page.tsx` MUST have `export const dynamic = 'force-dynamic'`.
  Without it, Next.js statically prerenders the page at Docker build time when
  `KEYCLOAK_ENABLED=false` (the build-stage dummy), which freezes the signout to
  local-only mode and leaves KC sessions alive after logout.
- **Never put a list, or anything that grows with the user's profile, on the
  NextAuth JWT** (`token.*` in the `jwt` callback). The JWT is the session
  cookie and is sent on every request; `roles`, `workspaces`, `mappLdapGroups`
  and the Keycloak `id_token` used to live there and gave users with many LDAP
  groups **HTTP 431 on every page** (Node's 16 KB header limit). They are stored
  on the `auth_session` row instead (`src/modules/auth/server/auth-session.ts`)
  and the token carries only `authSessionId`. Scalars on the token are fine. A
  size test in `nextauth-auth-session.test.ts` fails if this regresses.
- `isMappEmployee` is derived in `src/modules/auth/config/nextauth.ts` from
  THREE signals, in order of preference:
  1. explicit `isMappEmployee` claim (from `LabsCompanyContextMapper` mapper)
  2. non-empty `mappLdapGroups` (from `LabsLdapGroupsMapper` mapper)
  3. `@mapp.com` email-domain fallback (for Entra-only logins where neither
     mapper has data — common when LDAP env vars aren't set on the KC pod)

  Do not narrow this to just one signal. Each covers a different gap: the
  claim is most reliable when mapp-cloud SSO is available; LDAP groups cover
  Mapp employees without mapp-cloud accounts; the email fallback covers
  Entra-path logins when neither mapper has data.
- `package-lock.json` is **committed** (the Docker build runs `npm ci`). If your host's `~/.npmrc` points to an
  internal npm mirror, `npm install` will rewrite `resolved` URLs to that mirror
  and the Docker build will fail with `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`. Before
  committing or deploying, check: `grep -c 'nexus.internal.mapp.tools' package-lock.json`
  should be `0`. If non-zero, regenerate the lockfile against the public registry.
- **Route handlers redirect with a relative `Location`.** Behind the ALB,
  `request.url` is the container's own address, so
  `NextResponse.redirect(new URL(path, request.url))` sends users to
  `https://0.0.0.0:3000/...`. Return
  `new NextResponse(null, { status: 307, headers: { Location: path } })` instead.
- **Never redirect to a raw `callbackUrl` / `returnTo` / `from` param.** Pass it
  through `resolveCallbackUrl(raw, 'admin' | 'account', origin?)`
  (`src/modules/auth/lib/callback-url.ts`): same-origin, confined to its area,
  falls back to the area root.
- **Escape user input in `contains` / `startsWith` / `endsWith` searches** with
  `escapeLikePattern()` / `toContainsTerm()` (`src/lib/utils/search.ts`). Prisma
  passes `%` and `_` through as wildcards, so a search for `%` matches every row.
  On external surfaces, search only the columns the caller is shown.
- **Public API responses that depend on the key use `privateCacheHeaders()`**
  (`src/modules/public_api/lib/cache.ts`). `cacheHeaders()` is `public` and is only
  for data identical for every caller — otherwise a shared cache can hand one
  customer's response to another.
- **Customer pages get their session through `getCustomerPageScope()` /
  `requireEligibleCustomerPageScope()`** (`@/modules/auth/server`). It reads the
  session once per request and runs eligibility and company context in parallel,
  all `cache()`d. Don't chain `requireCustomer` → eligibility → context by hand,
  and keep eligibility policies side-effect free (they are cached per request).
- **Layouts never gate `{children}` on the client session** (`useSession()`
  loading) and use `NavigationComponent`, not the default `NavigationWrapper`
  export, so the server HTML contains the page and the nav doesn't pop in.
- **Nav "active" state uses `isNavItemActive(href, pathname)`**
  (`src/modules/navigation/utils/navigation-filters.ts`) — path only, whole
  segments. Don't write `pathname.startsWith(href)`.
- **Deploy/setup scripts must keep working in Git Bash on Windows** — see
  `docs/template/WINDOWS.md`: pass paths to node via `to_node_path` +
  `process.argv`, add any new `/`-leading SSM/log prefix to `MSYS2_ARG_CONV_EXCL`
  (in both `_config.sh` and the Makefile), use `add_exit_trap` and `run_python`,
  and commit new scripts executable (`git update-index --chmod=+x`).

## App Notes and Pitfalls

<!-- App-specific: cross-cutting pitfalls and conventions for THIS app that any
future change could trip over. One bullet each, with a date and a pointer to the
feature doc in docs/ that explains it. Template-owned pitfalls stay in the
sections above. -->

_None yet._
