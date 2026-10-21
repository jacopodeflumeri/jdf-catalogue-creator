# Synthetic Catalogs

## Purpose

This app creates persistent synthetic fashion catalogs for internal Mapp users.
It is deliberately admin-only: there is no customer-facing `/account` experience,
and company-context login is disabled with `COMPANY_LOGIN_ENABLED=false`.

Phases 1–5 provide the data model, four stable catalog profiles, identifier
rules, deterministic generation domain, resumable job state machine, real
LiteLLM text and image generation, persistent generated-image storage, and an
independent database-backed worker. Catalog pages are not implemented yet.

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
- `CatalogGenerationTask` is the durable, retryable unit claimed by the worker.

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

The Phase 2 application service remains a narrow product-generation test seam.
The production workflow is owned by the Phase 5 worker described below.

## Background worker

`npm run worker` starts a single-concurrency polling process. It uses
`CatalogGenerationTask` as a PostgreSQL queue and never holds an HTTP request
open. A claim is one atomic `FOR UPDATE SKIP LOCKED` update that records the
worker ID, lease time, and attempt before returning the task. Multiple ECS tasks
can therefore poll safely without generating the same item twice.

Completing a product transaction creates its product, style, variants, three
image assets, and one `GENERATE_IMAGE` task per role. Non-front tasks are not
claimable until the front asset is terminal, so back and on-model images use the
front reference when it is available and fall back to prompt-only generation
after a permanent front failure.

Transient network/proxy/S3 errors return the task to `QUEUED` with exponential
backoff. Invalid output and other permanent errors become `FAILED` immediately;
all attempts are bounded by the task's persisted `maxAttempts`. The production
worker configures each provider for one in-process attempt, preventing provider
retries from multiplying three durable task attempts into nine billable calls.
Locks older than 30 minutes are checked at startup and every minute, so a task
killed during a deployment becomes eligible again after its conservative lease.
Product and image counters, the job stage, and final status are recalculated
from persisted task state after every item, so refreshes and worker restarts do
not lose progress.

ECS runs the command in a second, essential container in the existing Fargate
task. It shares the app image, task role, network, tags, and deployment lifecycle,
but has its own process and a three-connection database pool. This avoids a
second always-on Fargate service. If the web service scales out, the atomic claim
protocol safely allows the additional worker containers to help. SIGTERM stops
new polling, lets the current item settle, then disconnects Prisma.

Cancellation is intentionally deferred: the task enum has no cancelled state,
and in-flight LiteLLM image calls cannot yet be interrupted safely. A future
cancel action must stop new claims without presenting an active remote call as
cancelled.

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

## Image generation

Each style owns exactly three durable `SyntheticImageAsset` rows: `FRONT`,
`BACK`, and `ON_MODEL`. Product persistence creates these rows in `QUEUED`
state. `generateStyleImages()` processes front first, then supplies the stored
front bytes to back and on-model generation through LiteLLM's image-edit
endpoint. If the proxy explicitly reports that edits are unsupported, the same
adapter falls back to attributed prompt-only generation; it never calls a
provider directly.

Role-specific prompts require a complete product-only front/back view or a
clearly visible on-model garment, while prohibiting real brands, logos, text,
watermarks, and recognizable campaigns. Every non-streaming call uses the
persisted image model, a role-specific feature name, and a 240-second timeout.
JSON image-generation requests carry normal billing metadata. Multipart image
edits carry the same spend metadata through LiteLLM's
`x-litellm-spend-logs-metadata` header because forwarding a multipart
`metadata` form field to OpenAI is rejected.

`regenerateImageAsset()` targets one role only. Generation completes before the
deterministic S3 key is overwritten, and failures remain on that asset without
regenerating its siblings.

## Storage

Generated media will use the app-owned S3 bucket
`mapp-labs-catalogues-creator-{staging|prod}`. ECS receives access through its
task role, so no S3 access-key secret is required in AWS. The S3 service now
uses the standard AWS credential chain when an explicit key pair is absent;
local development can therefore use the `labs-power` profile or another normal
SDK credential source rather than long-lived app secrets. Set
`AWS_PROFILE=labs-power` locally when that profile is not already selected.

Generated images are normalized to WebP and stored at deterministic validated
keys such as
`public/catalogs/premium-apparel/PRE-W-000001-IVY/front.webp`. The bucket stays
private. CSV-safe URLs use the stable opaque route
`/api/catalog-assets/{publicId}`, which resolves only one persisted generated
asset, calls the framework's `authorizeS3Read()`, and redirects to a fresh
short-lived presigned URL. There is no object listing or caller-controlled key.
The `public/` prefix is deliberate: synthetic media must be fetchable by
Demoware without an interactive app session, while the admin application itself
remains internal-only.

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
- `src/modules/synthetic_catalog/providers/image-prompt.ts`
- `src/modules/synthetic_catalog/providers/litellm-image-generator.ts`
- `src/modules/synthetic_catalog/server/image-assets.ts`
- `src/modules/synthetic_catalog/server/catalog-worker.ts`
- `src/modules/synthetic_catalog/storage/generated-asset-storage.ts`
- `src/modules/llm/lib/images.ts`
- `src/app/api/catalog-assets/[publicId]/route.ts`
- `src/modules/synthetic_catalog/server/generation-jobs.ts`
- `src/modules/synthetic_catalog/server/sequence-reservation.ts`
- `src/workers/catalog-generation-worker.ts`
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

### 2026-10-21 — Reference images remain proxy-attributed

Front-reference edits use the same LiteLLM virtual key and spend subject as
normal image generation. LiteLLM's dedicated spend-metadata header is used for
the multipart edit endpoint; dropping metadata or calling OpenAI directly would
make cost attribution incomplete and is not an acceptable fallback.

### 2026-10-21 — Stable application URLs over a private bucket

S3 keys are deterministic for replacement and persistence, while public URLs
are opaque database IDs owned by the application. This keeps URLs stable across
deployments and regenerations without exposing a bucket, directory listing, or
one-hour S3 signature in exported feeds.

### 2026-10-21 — PostgreSQL tasks are the queue

The existing task table already provides availability, locks, attempts, and
dedupe keys, so adding Redis or an external queue would create another system to
operate without improving this low-volume internal workflow. Atomic
`SKIP LOCKED` claims provide safe horizontal polling, while the database remains
the single source of truth for UI progress and restarts.

### 2026-10-21 — Worker sidecar shares the app deployment

The worker is a separate process/container but remains in the existing ECS task.
This guarantees routine floating-tag and immutable deployments update web and
worker together, reuses task-role S3 credentials and cost tags, and avoids the
fixed cost of a second service. Worker concurrency remains one per ECS task and
is coordinated by database claims.

## Pitfalls

- Do not decrement or manually recycle `nextProductSequence`.
- Do not derive IDs from row IDs; external IDs follow the documented hierarchy.
- Do not put LiteLLM or AWS credentials in profile JSON, prompts, logs, or docs.
- Do not perform long-running image work inside a Next.js request.
- Do not fetch a queued task and update it in separate queries; all workers must
  use the atomic claim function or duplicate LiteLLM spend becomes possible.
- Keep the worker provider adapters at one local attempt unless the durable task
  attempt policy is changed at the same time.
- Before adding media routes, use the S3 prefix registry and `authorizeS3Read()`.
- Do not write direct S3/CDN URLs to catalog exports; use the opaque asset route.
- Do not send nested `metadata` as a multipart image-edit form field; use the
  LiteLLM spend-metadata header implemented by `llmEditImage()`.
- When authenticated admin actions are added, their consequential generation,
  retry, regeneration, and deletion requests must write audit records using the
  entity types registered in `src/modules/audit/entity-types.ts`. The Phase 4
  worker-facing services intentionally have no session or actor context.
