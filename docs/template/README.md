# Template reference docs

Shipped by `labs-app-template`. They describe how the template's built-in pieces
work — read them, but don't edit them in an app except when applying a template
retrofit ([`../retrofit/`](../retrofit/README.md)). The app's own docs live one
level up in [`docs/`](../README.md).

## Start

- [LOCAL-POSTGRES.md](LOCAL-POSTGRES.md) — installing PostgreSQL for local development (macOS, Linux, Windows)
- [WINDOWS.md](WINDOWS.md) — developing and deploying from Windows (Git Bash, required tools, line endings, path conversion)
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) — common local-setup, npm and AWS CLI problems

## Build

- [CUSTOMIZATION.md](CUSTOMIZATION.md) — extending navigation, roles and pages
- [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md) — UI components, tokens, layout rules (read before any frontend work)
- [APP-BRANDING.md](APP-BRANDING.md) — app name, logo and identity
- [ROUTING.md](ROUTING.md) — admin routing convention: canonical external IDs in URLs
- [PERMISSION-LEVELS.md](PERMISSION-LEVELS.md) — viewer / editor / admin and server-side enforcement

## Auth

- [KEYCLOAK.md](KEYCLOAK.md) — Keycloak login: the two buttons, session fields, SSM, redirect-URI registration, TLS, troubleshooting
- [ENTRA-SETUP.md](ENTRA-SETUP.md) — legacy direct-Entra login (`KEYCLOAK_ENABLED=false` only)
- [INTERNAL-CA.md](INTERNAL-CA.md) — the vendored Mapp internal root CA
- [INTERNAL-API.md](INTERNAL-API.md) — the shared internal-API credential for Mapp services

## Deploy & operate

- [DEPLOYMENT.md](DEPLOYMENT.md) — AWS architecture, first deploy, releases, maintenance deploys, troubleshooting
- [MONITORING.md](MONITORING.md) — Icinga health checks
- [COST_ALLOCATION.md](COST_ALLOCATION.md) — cost-allocation tags and metering

## Capabilities

- [capabilities/README.md](capabilities/README.md) — how capabilities work and how to enable one
- [capabilities/_registry.json](capabilities/_registry.json) — machine-readable registry (read first)
- [capabilities/ADDING_CAPABILITIES.md](capabilities/ADDING_CAPABILITIES.md) — adding a new capability to the template
- [capabilities/AUDIT_LOG.md](capabilities/AUDIT_LOG.md) — who changed what, and when (standard)
- [capabilities/COMPANY_LOGIN.md](capabilities/COMPANY_LOGIN.md) — Keycloak / Mapp Cloud customer login (standard)
- [capabilities/DEV_LOGIN.md](capabilities/DEV_LOGIN.md) — local mock login without AWS (standard)
- [capabilities/S3_STORAGE.md](capabilities/S3_STORAGE.md) — images and files in the per-app bucket (standard)
- [capabilities/CLIENT_CATALOG.md](capabilities/CLIENT_CATALOG.md) — Mapp companies and workspaces
- [capabilities/UPC.md](capabilities/UPC.md) — product feeds and catalog items
- [capabilities/FTL.md](capabilities/FTL.md) — fashion taxonomy, trends, outfit rules
- [capabilities/PUBLIC_API.md](capabilities/PUBLIC_API.md) — versioned REST API with Swagger
- [capabilities/LLM.md](capabilities/LLM.md) — LLM calls via the LiteLLM proxy
- [capabilities/KEYCLOAK_API_AUTH.md](capabilities/KEYCLOAK_API_AUTH.md) — Keycloak bearer tokens on API routes
- [capabilities/DATA_SYNC.md](capabilities/DATA_SYNC.md) — prod → staging config dumps via the shared bucket
- [capabilities/SFTP.md](capabilities/SFTP.md) — file exchange with one external SFTP endpoint
- [capabilities/USER_FEEDBACK.md](capabilities/USER_FEEDBACK.md) — in-app feedback widget into Notion
- [capabilities/CUSTOMER_PREVIEW.md](capabilities/CUSTOMER_PREVIEW.md) — optional "View as customer": admins preview a company's customer pages, read-only

## Platform

- [platform/README.md](platform/README.md) — for labs-platform maintainers; app builders can ignore this folder
