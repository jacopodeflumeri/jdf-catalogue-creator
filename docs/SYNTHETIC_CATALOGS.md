# Synthetic Catalogs

## Purpose

This app creates persistent synthetic fashion catalogs for internal Mapp users.
It is deliberately admin-only: there is no customer-facing `/account` experience,
and company-context login is disabled with `COMPANY_LOGIN_ENABLED=false`.

Phases 1–3 provide the data model, four stable catalog profiles, identifier
rules, deterministic generation domain, resumable job state machine, and real
LiteLLM text generation. Catalog pages and image generation are not implemented
yet.

## Catalog profiles

The four profiles are defined in
`src/modules/synthetic_catalog/config/profiles.ts` and upserted by
`prisma/seed.ts`:

| Profile | Brand | Prefix | Segment |
|---|---|---|---|
| Premium Apparel | Aureline | `PRE` | premium |
| Fast Fashion | Loopline | `FAS` | fast-fashion |
| Luxury Fashion | Maison Veyra | `LUX` | luxury |
| Activewear | Kinetic Form | `ACT` | activewear |

Each profile owns its price and stock ranges, department mix, taxonomy inputs,
palette, materials, sizes, seasons, naming tone, visual direction, and default
text/image models. Keep the seed idempotent and update existing profiles by
`slug`; never reset `nextProductSequence` during an update.

## Identifier hierarchy

Identifiers are deterministic and globally unique:

- Product: `{PREFIX}-{W|M}-{SEQUENCE}`, for example `PRE-W-000042`
- Style: `{PRODUCT_ID}-{COLOR_CODE}`
- Variant/SKU: `{STYLE_ID}-{SIZE_CODE}`

`reserveProductSequenceRange()` increments `SyntheticCatalog.nextProductSequence`
atomically before generation starts. Reserved numbers are never returned or
reused, even when generation fails; gaps are intentional. Formatting and
normalization live in `src/modules/synthetic_catalog/domain/ids.ts`.

## Data model

- `SyntheticCatalog` stores profile configuration and the next product sequence.
- `SyntheticProduct` stores catalog-level merchandising data and prices.
- `SyntheticStyle` stores a color execution and its visual specification.
- `SyntheticVariant` stores size, stock, availability, external ID, and SKU.
- `SyntheticImageAsset` tracks front, back, and on-model generation independently.
- `CatalogGenerationJob` records one requested operation and aggregate progress.
- `CatalogGenerationTask` is the durable, retryable unit for the future worker.

The migration is additive and lives under `prisma/migrations/`. Task records are
included now so later image generation does not rely on in-memory or request-bound
work.

## Phase 2 generation domain

`planAssortment()` deterministically allocates department, category, and
subcategory slots from a seed and reserved sequences. Application code—not the
generation provider—owns prices, sale eligibility, currency, sizes, stock,
availability, IDs, and URLs.

`ProductGenerator` is the structured seam for product copy and visual concepts.
Phase 2 tests use `MockProductGenerator`, which is deterministic and
network-free. Phase 3 adds `LiteLLMProductGenerator` for real calls.

`createGenerationJob()` reserves all sequences before persisting one
`GENERATE_PRODUCT` task per planned product. `runGenerationJob()` persists each
product, its single MVP color style, all size variants, and task completion in
one transaction. A bounded run returns the job to `QUEUED`; calling it again
processes only unfinished tasks. Provider failures become `FAILED` tasks and a
`COMPLETED_WITH_ERRORS` job; `resumeGenerationJob()` requeues failures below the
attempt limit.

Phase 2 executes the state machine as an application service for tests. Durable
worker polling, task claiming/locks, concurrency limits, and deployment belong
to Phase 5.

## LiteLLM and spend attribution

The `llm` capability is enabled in `app.config.json`. Deployments inject
`LITELLM_API_KEY` and `LITELLM_BASE_URL` from this app's SSM namespace. Every
future call must use `src/modules/llm`, passing a descriptive feature so
`buildBillingParams()` attaches `APP_NAME`, `APP_PRODUCT=internal`, environment,
and feature metadata. Never call a model provider directly or bypass the proxy.

The key is a LiteLLM virtual key and is the only additional LLM secret. Do not
commit it. The setup script writes it as a SecureString for each environment.

`LiteLLMProductGenerator` calls only the framework's `llmCompletion()` helper
with feature `synthetic-catalog-product-generation`. The job's persisted
`textModel` is passed through, so catalog defaults and per-job overrides remain
observable. Responses must be a single JSON object and pass both Zod shape
validation and the catalog's material, season, and color-pair vocabularies.

Only transient proxy/network failures (`408`, `409`, `425`, `429`, `5xx`, and
selected connection errors) receive bounded exponential-backoff retries.
Authentication/configuration errors and invalid model output fail immediately to
avoid wasteful repeat spend. There is no direct-provider fallback.

## Storage

Generated media will use the app-owned S3 bucket
`mapp-labs-catalogues-creator-{staging|prod}`. ECS receives access through its
task role, so no S3 access-key secret is required in AWS. Local development can
eventually use the normal AWS credential chain, but the template's current S3
validator still requires explicit access-key variables. Do not add long-lived
keys to work around that: the validator will be corrected in the storage phase.
Stable media storage and authorization are scheduled for that later phase;
Phase 1 stores only nullable object metadata.

## Key files

- `prisma/schema.prisma`
- `prisma/seed.ts`
- `src/modules/synthetic_catalog/config/profiles.ts`
- `src/modules/synthetic_catalog/domain/ids.ts`
- `src/modules/synthetic_catalog/domain/planner.ts`
- `src/modules/synthetic_catalog/domain/rules.ts`
- `src/modules/synthetic_catalog/providers/product-generator.ts`
- `src/modules/synthetic_catalog/providers/mock-product-generator.ts`
- `src/modules/synthetic_catalog/providers/product-prompt.ts`
- `src/modules/synthetic_catalog/providers/litellm-product-generator.ts`
- `src/modules/synthetic_catalog/server/generation-jobs.ts`
- `src/modules/synthetic_catalog/server/sequence-reservation.ts`
- `infra/lib/stack.ts`
- `scripts/deploy/setup-ssm-params.sh`

## Decisions

### 2026-10-21 — Internal admin surface only

Company login is disabled and no customer routes will be built. Keycloak remains
the framework's internal Mapp authentication broker.

### 2026-10-21 — Persistent work from the start

Jobs, tasks, image states, and model names are persisted rather than kept in a
route handler. This makes retries, auditability, spend analysis, and an eventual
independent worker possible without replacing the domain model.

### 2026-10-21 — Reserve IDs before generation

Sequence allocation uses one atomic database increment. Failed work may leave a
gap, which is preferable to reusing an identifier that may already appear in
logs, model metadata, or stored assets.

### 2026-10-21 — Deterministic application rules around a narrow AI seam

The provider can supply controlled product copy and a visual concept, but it
cannot select IDs, prices, inventory, sizes, or catalog distribution. This keeps
retries reproducible and prevents a future model response from violating feed
constraints.

### 2026-10-21 — Task transactions are the resume boundary

Product, style, variants, and task completion are committed together. A stopped
run leaves other tasks queued; a retry upserts the same deterministic identities
instead of generating duplicates.

### 2026-10-21 — Proxy-only structured text generation

Real product copy uses `src/modules/llm` and the job's stored model. Direct
provider clients are intentionally absent, ensuring every successful call has
Mapp app/product/environment/feature spend attribution. Controlled-vocabulary
validation remains outside the prompt as an enforceable application boundary.

## Pitfalls

- Do not decrement or manually recycle `nextProductSequence`.
- Do not derive IDs from row IDs; external IDs follow the documented hierarchy.
- Do not put LiteLLM or AWS credentials in profile JSON, prompts, logs, or docs.
- Do not perform long-running image work inside a Next.js request.
- Before adding media routes, use the S3 prefix registry and `authorizeS3Read()`.
- Consequential generation, retry, regeneration, and deletion actions must use
  the audit entity types registered in `src/modules/audit/entity-types.ts`.
