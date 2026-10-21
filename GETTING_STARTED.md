# Getting Started

This guide walks you through creating a new Mapp Labs application from this template. It covers project setup, capability selection, and getting your AI agent oriented.

## Prerequisites

- Node.js 22+ and npm 10+ (`.nvmrc` pins the major; `nvm use` picks it up)
- Git
- PostgreSQL (local install with `psql` and `createdb`) — see [docs/template/LOCAL-POSTGRES.md](docs/template/LOCAL-POSTGRES.md)
- For deployment: Docker, AWS CLI v2, Session Manager Plugin, `jq`, and Mapp VPN
- **Windows:** use Git Bash and install `make` — see [docs/template/WINDOWS.md](docs/template/WINDOWS.md)

Run `make dev-check-prerequisites` to verify.

## Step 1: Create Your GitHub Repo

Before cloning the template, create an empty repo for your new app in the **mapp-labs** org:

1. Go to [https://github.com/organizations/mapp-labs/repositories/new](https://github.com/organizations/mapp-labs/repositories/new)
2. Name it `labs-{your-app-name}` (e.g., `labs-campaign-insights`)
3. Keep it **Private**
4. **Do not** initialize with a README, .gitignore, or license — the template provides all of that
5. Click **Create repository** and copy the SSH URL

## Step 2: Clone and Configure

```bash
git clone git@github.com:mapp-digital/labs-app-template.git labs-{your-app-name}
cd labs-{your-app-name}
./scripts/setup.sh
```

The setup script will:
- Ask for your app name, display name, database name, team info
- Ask which **capabilities** to enable (Client Catalog, UPC, FTL, Public API, LLM, Data Sync, User Feedback, SFTP)
- Update all configuration files
- Reinitialize git with a clean history (removes template commits)
- Ask for your new repo URL (paste the SSH URL from Step 1)
- Install a pre-push hook that prevents accidental pushes back to the template repo

## Step 3: Database and Dependencies

```bash
createdb my-project              # use the DB name you chose
make dev-initial-setup           # install deps, run migrations, seed
```

On the first run, `.env` is created from `.env.example`. Fill in your credentials (database, any capability-specific env vars). Login needs no Azure AD values: set `DEV_AUTH_ENABLED=true` and use `/auth/dev`, or copy `KEYCLOAK_CLIENT_SECRET` from shared SSM to test against the real Keycloak (see `docs/template/KEYCLOAK.md`), then re-run `make dev-initial-setup`.

## Step 4: Start Developing

```bash
make dev-server
```

- Customer portal: http://localhost:3000
- Admin dashboard: http://localhost:3000/admin

## Step 5: Enable Capabilities (if you didn't during setup)

Check `docs/template/capabilities/README.md` for the full list. For each capability:

1. Set the required env vars in `.env`
2. If the capability has schema changes, copy the fragment from `prisma/schema/*.prisma.example` into `prisma/schema.prisma`
3. Run `npx prisma migrate dev --name add_capability_name`
4. Import the module from `src/modules/` in your code

## Step 6: Deploy

```bash
make version-patch         # bump version
make staging-first-deploy  # first-time AWS setup (SSM, image, infra, migrate, seed, Keycloak URIs)
```

Be on Mapp VPN: the last step registers your app's redirect URI with Keycloak.
See [docs/template/DEPLOYMENT.md](docs/template/DEPLOYMENT.md) for full deployment
instructions and [docs/template/KEYCLOAK.md](docs/template/KEYCLOAK.md) for how login
works. Updating an older app instead of starting fresh? See
[docs/retrofit/](docs/retrofit/README.md).

## Step 7: Document as you build

`docs/` is for **your app's** docs; the template's reference lives in
`docs/template/`. Keep one living doc per feature area in `docs/` and link it from
[docs/README.md](docs/README.md) — see "Documenting your work" in `AGENTS.md`.

---

## Working with an AI Agent

This template is designed to be AI-agent friendly. The documentation structure, capabilities registry, and code patterns are all designed so that an AI agent (Claude Code, Cursor, etc.) can understand the codebase and help you build effectively.

### Agent Orientation Prompt

When starting a new project, paste the following prompt into your AI agent to get it oriented:

---

**Copy everything between the lines below into your AI agent:**

---

```
I'm starting a new project using the Mapp Labs App Template. Before we start building, please familiarize yourself with the project by reading these files in order:

1. Read `AGENTS.md` — safety guidelines, capabilities system overview, Keycloak/auth specifics, and how to document your work
2. Read `docs/README.md` — where this app's own docs go vs. the template reference in `docs/template/`
3. Read `docs/template/README.md` — index of the template reference docs
4. Read `docs/template/KEYCLOAK.md` — the two login buttons, session fields, isMappEmployee derivation, redirect-URI registration (skim the rest — useful when an auth question comes up)
5. Read `docs/template/capabilities/_registry.json` — machine-readable list of available integrations
6. Read `docs/template/capabilities/README.md` — how capabilities work
7. Read `app.config.json` — current project configuration and enabled capabilities
8. Read `docs/template/DESIGN-SYSTEM.md` — UI/visual design standards (glass morphism, color tokens, shadows)
9. Read `docs/template/CUSTOMIZATION.md` — how to extend navigation, roles, and access control
10. Read `docs/template/PERMISSION-LEVELS.md` — the access control matrix

Here's what I'm building: [DESCRIBE YOUR APP HERE]

Based on what I'm building, please:
- Identify which capabilities from the registry I should enable
- Tell me what env vars I'll need to set
- Tell me what Prisma schema changes are needed
- Suggest the data models and page structure I should create
- Outline a plan for implementation
- Confirm whether my app should show one or both Keycloak login buttons (Mapp Entra ID and/or Company Login). Recommend based on the use case.

The app should follow the design system in docs/template/DESIGN-SYSTEM.md (glass morphism, brand purple #8D77F7, no pure black, frosted glass surfaces, desktop-only minimum 1280px).

Do NOT run any AWS commands or `make {staging,prod}-*` deploy targets in this session. Deployment has its own prompt below — stop after planning.
```

---

### What the Agent Will Learn

After reading those files, your AI agent will understand:

- **What services are available**: Client Catalog (company/workspace discovery), UPC (product feeds), FTL (fashion taxonomy and trends), Public API (versioned REST API with Swagger), LLM (AI/LLM calls via LiteLLM proxy), Data Sync, User Feedback, SFTP
- **What's already built**: Authentication (Keycloak: Mapp Entra ID + Company Login; local dev-login bypass), admin audit log, S3 image and file storage, navigation system, admin dashboard with Settings, customer portal
- **Where docs go**: the app's own feature docs in `docs/`, template reference in `docs/template/`
- **How to extend the app**: Module pattern (`src/modules/`), Prisma schema, server actions, API routes
- **Design standards**: Glass morphism, brand purple, shadow system, spacing rules, desktop-only layout
- **Safety boundaries**: What AWS resources this app owns vs. shared infrastructure

### Capability-Specific Prompts

If you know what you need, you can be more specific:

**"I need to discover which Mapp companies my app should serve"**
→ Agent will read `docs/template/capabilities/CLIENT_CATALOG.md` and set up the client catalog module

**"I need to pull product data from Mapp feeds"**
→ Agent will read `docs/template/capabilities/UPC.md`, enable Client Catalog (dependency), and set up streaming ingestion

**"I want to display fashion trends from FTL"**
→ Agent will read `docs/template/capabilities/FTL.md` and build API integration with trend endpoints

**"I need to expose my app's data via a REST API"**
→ Agent will read `docs/template/capabilities/PUBLIC_API.md` and scaffold API routes with Swagger docs

**"I need to record who changed what in the admin"**
→ Agent will read `docs/template/capabilities/AUDIT_LOG.md` and call `writeAuditLog` from the consequential server actions

**"I need to add AI-powered text generation or chat features"**
→ Agent will read `docs/template/capabilities/LLM.md` and set up the LLM module with billing attribution via the LiteLLM proxy

### Deployment Prompts

Separate prompts for the two deployment phases. Use these only when your app is built locally and tested.

#### Staging deploy prompt

Prerequisites your agent will check: AWS SSO logged in (`labs-power` profile), Mapp VPN connected, `jq` installed. The deploy scripts auto-handle the macOS `DYLD_LIBRARY_PATH` workaround and AWS SSO credential export — no manual `eval` needed.

```
I'm deploying my Mapp Labs app to staging for the first time. The app is built
locally and the dev server works. I'm in the project directory, on Mapp VPN,
and `aws sso login --profile labs-power` succeeded.

Please do this in order:

1. Read these files first:
   - AGENTS.md (esp. the "AWS CLI Safety Rules" and "CDK Safety Rules" sections)
   - docs/template/DEPLOYMENT.md (first-time setup)
   - docs/template/KEYCLOAK.md ("Redirect URI registration on labs-portal" and
     "TLS and the CA bundle" sections)

2. Verify prerequisites read-only (no AWS writes yet):
   - `aws sts get-caller-identity --profile labs-power` succeeds
   - `command -v jq` shows jq is installed
   - app.config.json appName looks correct for the URL I'll get

3. Walk me through what `make staging-first-deploy` will do step by step BEFORE
   running it. Stop and ask for confirmation.

4. Once I confirm, run `make staging-first-deploy`. Watch the output for:
   - SSO credential errors (auto-handled by _config.sh now, but flag if seen)
   - Step 7/7 "Registering Keycloak labs-portal URIs" — requires VPN. If it
     fails with nginx 404, I'm not on VPN.

5. After completion, validate in a private browser window:
   - https://stg-<appname>.labs.mapp.com/auth/admin loads
   - Both login buttons appear (or just one if I configured single-button)
   - Click each visible button → full round-trip → Mapp Entra ID lands on
     /admin, Company Login on the customer area
   - /admin/auth-debug shows expected claims

6. If anything fails, paste the error and we'll debug. Don't try recovery
   actions without my confirmation.
```

#### Production deploy prompt

Production deploys are typically done by the labs-platform team after staging is validated. If you have the access, use this:

```
I'm deploying my Mapp Labs app (already running on staging) to production for
the first time. The app is in the current directory.

App info:
- Staging URL (already working): https://stg-<appname>.labs.mapp.com
- Target prod URL: https://<appname>.labs.mapp.com

Please do this in order:

1. Read these files first:
   - AGENTS.md (esp. AWS/CDK safety + Keycloak sections)
   - docs/template/KEYCLOAK.md ("Redirect URI registration on labs-portal" incl. the
     VPN requirement, and "TLS and the CA bundle")
   - scripts/deploy/_config.sh (env detection: accepts both "prod" and "production")

2. Verify prerequisites read-only:
   - `aws sts get-caller-identity --profile labs-power` succeeds
   - I'm on Mapp VPN (auth-admin.deproxy.muc.domeus.com should resolve)
   - Shared SSM keys exist:
     aws ssm get-parameters-by-path --path /labs-prod/labs-portal \
       --region eu-central-1 --profile labs-power
     aws ssm get-parameters-by-path --path /labs-prod/kc-registrar \
       --region eu-central-1 --profile labs-power
     Both should return populated keys; if empty, escalate to labs-platform team.
   - app.config.json appName matches the desired prod URL pattern

3. Walk me through what `make prod-first-deploy` will do step by step BEFORE
   running it. Highlight cost implications (RDS, ECS Fargate, ALB). Stop and
   ask for confirmation.

4. Once I confirm, run `make prod-first-deploy`. This creates real AWS
   resources. If anything looks wrong mid-deploy, ask before recovery actions.

5. After completion, validate in a private browser window. Same checks as
   staging validation.

6. If something fails: paste the error. Common ones:
   - Nginx 404 on URI registration step → I'm not on VPN
   - "security token expired" → SSO expired; re-run `aws sso login --profile labs-power`
   - ECS deployment circuit breaker → check task logs first, don't redeploy blindly
```

---

## Project Structure

```
├── AGENTS.md                    # AI agent safety guidelines + capabilities overview
├── GETTING_STARTED.md           # This file
├── app.config.json              # Project config (name, enabled capabilities)
├── prisma/
│   ├── schema.prisma            # Database schema
│   ├── schema/                  # Capability schema fragments (.prisma.example)
│   ├── migrations/              # Database migrations (tracked in git)
│   └── seed.ts                  # Seed script
├── src/
│   ├── app/                     # Next.js App Router pages
│   │   ├── account/             # Customer portal
│   │   ├── admin/               # Admin dashboard
│   │   ├── api/                 # API routes
│   │   └── auth/                # Authentication pages
│   ├── components/              # React components (ui/, admin/, account/, shared/)
│   ├── config/                  # App configuration
│   ├── lib/                     # Business logic (actions/, prisma/, utils/)
│   ├── modules/                 # Feature modules
│   │   ├── audit/               # Admin audit log (writeAuditLog)
│   │   ├── auth/                # Authentication & authorization
│   │   ├── client_catalog/      # Mapp Company Management Service client
│   │   ├── mapp_engage/         # Mapp Engage email marketing
│   │   ├── navigation/          # Sidebar and navigation system
│   │   ├── public_api/          # Versioned REST API infrastructure
│   │   ├── s3_images/           # AWS S3 image/file management
│   │   ├── sftp/                # SFTP file operations
│   │   ├── upc/                 # Mapp Product Feed Service client
│   │   ├── user_feedback/       # In-app feedback → Notion
│   │   └── llm/                 # LLM calls via LiteLLM proxy
│   └── types/                   # TypeScript type definitions
├── docs/
│   ├── README.md                # Index of THIS APP's docs (write feature docs here)
│   ├── template/                # Reference shipped by the template (don't edit)
│   │   ├── README.md            # Index of the template docs
│   │   ├── capabilities/        # Capability documentation + registry
│   │   ├── KEYCLOAK.md          # Login, session fields, redirect-URI registration
│   │   ├── DEPLOYMENT.md        # Full AWS deployment guide
│   │   ├── DESIGN-SYSTEM.md     # UI/visual design standards
│   │   └── ...
│   └── retrofit/                # Prompts for catching up with newer template versions
├── infra/                       # AWS CDK infrastructure
└── scripts/
    ├── setup.sh                 # Interactive project setup
    └── deploy/                  # Deployment scripts
```

## Available Capabilities

The full, current list (standard and optional, one line each) is the
capabilities table in `AGENTS.md`; the machine-readable source is
[`docs/template/capabilities/_registry.json`](docs/template/capabilities/_registry.json),
and each capability has its own doc in
[`docs/template/capabilities/`](docs/template/capabilities/README.md).

## Further Reading

- [`docs/template/README.md`](docs/template/README.md) — index of all template reference docs
- `docs/template/LOCAL-POSTGRES.md` — Installing PostgreSQL for local development (macOS, Linux, Windows)
- `docs/template/WINDOWS.md` — Developing and deploying from Windows (Git Bash)
- `docs/template/TROUBLESHOOTING.md` — Common local-setup, npm and AWS CLI problems
- `docs/template/DEPLOYMENT.md` — Full AWS deployment guide
- `docs/template/DESIGN-SYSTEM.md` — UI design standards and component specifications
- `docs/template/CUSTOMIZATION.md` — Extending navigation, roles, and access control
- `AGENTS.md` — AI agent safety guidelines and scope restrictions
