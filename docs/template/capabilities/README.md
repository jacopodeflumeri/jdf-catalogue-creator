# Capabilities System

## What Are Capabilities?

Capabilities are optional integrations with Mapp's internal services and infrastructure patterns that your app can adopt. Each capability provides a specific piece of functionality — connecting to the Client Catalog, accessing product feeds, exposing a public API, etc.

Capabilities are designed to be **discovered and enabled** by both developers and AI agents. When you describe what your app needs to do, an agent can check this registry to determine which capabilities to enable and how to wire them up.

## How It Works

1. **Registry** — `_registry.json` is the machine-readable index of all capabilities. Agents should read this first.
2. **Capability Docs** — Each `.md` file describes one capability in detail: what it does, what env vars it needs, what database schema changes are required, and example use cases.
3. **Modules** — Most capabilities have a corresponding module in `src/modules/` with the API client code.
4. **Schema Fragments** — Capabilities that need database changes provide `.prisma.example` files in `prisma/schema/` that can be merged into `prisma/schema.prisma`.

## Available Capabilities

| ID | Name | Type | Description |
|----|------|------|-------------|
| `audit_log` | Audit Log | **Standard** | Who changed what, and when — `writeAuditLog` + `/admin/audit-log` (always included) |
| `client_catalog` | Client Catalog | Optional | Discover companies and workspaces from Mapp's Company Management Service |
| `upc` | UPC | Optional | Access product feeds from Mapp's Unified Product Catalog |
| `ftl` | Fashion Trends Lab | Optional | Access taxonomy, trends, outfit rules from the FTL API |
| `public_api` | Public API | Optional | Expose your app's data via versioned REST API with Swagger docs |
| `llm` | LLM (LiteLLM Proxy) | Optional | LLM calls (OpenAI, Anthropic) via proxy with billing attribution |
| `data_sync` | Data Sync | Optional | Dump app config to shared S3 bucket and restore between envs (purpose-built for prod→staging refreshes) |
| `sftp` | SFTP | Optional | File exchange with one external SFTP endpoint, confined to a per-app directory. For counterparties that only speak SFTP |
| `s3_storage` | S3 Storage (images & files) | Standard | Upload/serve images and files from the per-app S3 bucket. Access decided by a declared prefix policy (`public/` anonymous, `content/` authenticated) |
| `user_feedback` | User Feedback | Optional | In-app feedback widget → shared Notion database, reporter/app/owner/company auto-filled (no Prisma, no in-app LLM) |
| `customer_preview` | Customer Preview (View as customer) | Optional | Admins preview a company's customer pages exactly as its Company-Login customers see them — read-only, 30 min, audited (needs `company_login`; `client_catalog` recommended) |

## Enabling a Capability

### For Agents

1. Read `_registry.json` to find the capability
2. Check `dependencies` — enable those first
3. Add `requiredEnvVars` to `.env`. If the entry has an **`envVarSources`** map,
   those values already exist in shared SSM — read them yourself with
   `aws ssm get-parameter[s-by-path] --profile labs-power --region eu-central-1`.
   Do not invent values, leave placeholders, or ask the app owner for them.
   All internal Mapp services (client catalog, UPC, …) share **one** credential per
   environment at `/mapp-labs[-stg]/internal-api/*` — `/mapp-labs` is PRODUCTION,
   `/mapp-labs-stg` is staging, and a staging app reading `/mapp-labs/*` silently
   talks to production. Per-service base URLs are per-environment too. See
   [`../INTERNAL-API.md`](../INTERNAL-API.md)
4. If `prismaChanges` is non-empty, apply the schema fragment from `prisma/schema/`
5. Run `npx prisma migrate dev` to apply schema changes
6. Import the module from `src/modules/{moduleDir}` in your app code (skip if `moduleDir` is null — e.g. `data_sync` is infra-only)
7. If `infraChanges` is present, follow those CDK wiring steps (typically: instantiate a construct in `infra/lib/stack.ts` and inject env vars on the task definition)
8. If `scriptsToCopy` is present, copy each `.example` file to the destination and fill in the TODOs noted in the registry entry
9. Update `app.config.json` `enabledCapabilities` array

### For Developers

1. Read the capability's documentation file
2. Run `scripts/setup.sh` — the interactive setup will ask which capabilities to enable
3. Follow the env var and schema instructions output by the setup script

## Mapp Products

Mapp has three main products. Capabilities may relate to one or more:

- **Mapp Intelligence** — Analytics and customer intelligence
- **Mapp Engage** — Marketing automation and email
- **Mapp Fashion (FTL)** — Fashion trends, taxonomy, and product categorization

The Client Catalog segments workspaces by product, so your app can work with any combination.

## Adding New Capabilities

See **[ADDING_CAPABILITIES.md](ADDING_CAPABILITIES.md)** for the complete guide. It covers every file that needs to be created or updated, with templates, conventions, and a checklist.

Quick summary — a fully integrated capability touches:
1. `docs/template/capabilities/YOUR_CAPABILITY.md` — documentation
2. `docs/template/capabilities/_registry.json` — registry entry
3. `src/modules/your_capability/` — module code
4. `prisma/schema/your_capability.prisma.example` — schema fragment
5. `.env.example` — env var stubs
6. `scripts/setup.sh` — interactive selector
7. `AGENTS.md` — capabilities table
8. `docs/template/capabilities/README.md` — available capabilities table
