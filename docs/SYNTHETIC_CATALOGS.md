# Synthetic Catalogs

## Purpose

This app creates persistent synthetic fashion catalogs for internal Mapp users.
It is deliberately admin-only: there is no customer-facing `/account` experience,
and company-context login is disabled with `COMPANY_LOGIN_ENABLED=false`.

Phases 1–8 provide the data model, four stable catalog profiles, identifier
rules, deterministic generation domain, resumable job state machine, real
LiteLLM text and image generation, persistent generated-image storage, and an
independent database-backed worker, the internal admin workflow used to operate
them, validated Catalogue CSV export, configurable spend guards, full readiness
reporting, and operational recovery guidance.

## Admin workflow

`/admin` redirects to `/admin/catalogs`, where every active profile appears as
one overview card with product, style, variant, image, and latest-job state.
Cards and catalogue workspace headers show app-owned fictional logos using the
stable slug mapping: `premium-apparel` → `/img/aureline.png`, `fast-fashion` →
`/img/loopline.png`, `luxury-fashion` → `/img/maison-veyra.png`, and `activewear`
→ `/img/kinetiq-form.png`. These static files live in `public/img` and are
included in the application image. Lookup uses the catalogue slug, never
editable brand text; unavailable images fall back to the visible brand name.
The supplied Activewear image wordmark reads `KINETIQ`, while the configured
catalogue brand remains `Kinetic Form`; neither value is auto-renamed.
The admin sidebar also links directly to Premium, Fast Fashion, Luxury, and
Activewear using their stable profile slugs.
`/admin/catalogs/{slug}` is the catalog workspace: it shows background progress,
the full persisted product list in a table, job history, retry controls, and
generation settings. The product table can be filtered by department, category,
subcategory, and aggregate required-core-image status (`READY`, `FAILED`, `GENERATING`, or
`MISSING`). Information readiness is independent of image readiness. It reports color-style count and stock across every style; the
thumbnail uses the first available FRONT image. Image status is computed from
the three required core roles, independently of product/style information
readiness; a core-image failure in any color is shown as `FAILED`.
Selecting a row opens `/admin/catalogs/{slug}/products/{externalId}`, where all
color styles, their IDs, size/SKU inventory, and three required core images are
shown, followed by an optional Complete the Look image and ordered companion
products when available. Editors can regenerate an individual style image. Numeric catalog and
product IDs are also accepted so audit-log links remain stable.

All reads use `requireAdmin({})`. Viewer-level users see the same operational
state but no mutation controls. Adding products, manually retrying failures,
regenerating one image, and changing catalog defaults all require editor access
and write audit records. A batch at or above the configured large-job threshold
(`CATALOG_LARGE_JOB_THRESHOLD`, default 25) requires a separate
confirmation showing the expected LiteLLM call count. The request enqueues work
only; browser navigation and polling never perform model or S3 work.

The first manual workflow step is catalogue information. Its wizard selects
all-catalogue, department, or category scope, then two or three color variants.
It generates product copy, merchandising fields, colour styles and complete
size/inventory rows. It creates no image assets or image tasks and makes no image
provider calls. All Catalogue derives its base-product count
from the catalogue mix and shows each configured quota; scoped requests retain
an operator-selected parent-product count and distribute it across matching
mix rows by their configured counts. Its review shows
parent products, styles, zero image assets, size rows, and attributed text-model
calls. Core imagery is a separate manual step.
The visible workflow now exposes a Step 2 action after a completed information
batch, plus an explicit all-active-products-missing-core-images action for
historical catalogue records. Both create separate `CORE_IMAGES` jobs linked to
their source information job when one is selected. They enqueue only missing or
failed `FRONT`, `BACK`, and `ON_MODEL` roles; READY assets are preserved.
Catalogue-level transaction locking and active-task checks make repeated
submissions idempotent. A preflight confirmation shows target products, colour
styles, and image calls before queueing.
Step 3 is also manual and offers a source information batch or all eligible
active catalogue products. Before queueing, every active style in the full
catalogue must have READY FRONT and BACK images, even for a batch target;
ON_MODEL is optional. The preflight lists missing/failed roles and affected PDPs,
then summarizes eligible and skipped styles, skip reasons, and image calls.
Complete the Look jobs share the worker's lock, cancellation, retries and lease
recovery. They store one look per colour style and preserve the persisted
pairing across image retries. Companion products must be active, same-catalogue,
same-department, season-compatible, from different products, and have READY
FRONT images. Recipes use the explicit mix slots; neutrals pair broadly,
harmonious colours score higher, competing saturated accents are penalized, and
reuse counts reduce a style's score when it has already been selected often.
Anchors use ON_MODEL first when READY, then FRONT, followed by companion FRONT
images in the saved outfit order. The image edit passes those files through
LiteLLM with feature `synthetic-catalog-image-complete-look`; unsupported
multi-reference edits fail visibly and remain retryable.

Archiving an anchor hides its look. Archiving any companion marks affected looks
STALE and cancels queued image work. Restoring the product leaves those looks
stale until an editor runs Step 3 again. FAILED looks can be regenerated without
changing their saved pairing. Complete the Look does not change core-image
readiness or block ordinary Catalogue CSV readiness.
Size-row estimates use the exact planned mix rows, category-specific size rule,
and next product sequence used when the job is queued.
Editors can add departments from Settings. Departments retain stable keys,
labels, product ID codes, and generation weights. Viewers see them without
mutation controls; department writes are validated, transactional, and audited.
Categories and subcategories are edited in Catalogue Mix only.

Settings also includes the editable Catalogue Mix table. Each canonical row is
`{ id, departmentKey, category, subcategory, productCount, outfitSlot }`; row
tuples and IDs are unique. Assigned rows need a department, positive quota, and
outfit slot. Unassigned rows use a null department, zero quota, and null slot;
they preserve category/subcategory combinations that existed in the old
catalog-wide taxonomy without inventing department assignments or changing
generation totals. Assigning a department and configuring quota and slot makes
that combination available for generation. The mix is the only persisted source
for department/category/subcategory relationships, quotas, and outfit slots.
Removing a row affects future jobs and Complete the Look planning. Supported
slots are `TOP`,
`BOTTOM`, `ONE_PIECE`, `OUTERWEAR`, `FOOTWEAR`, `BAG`, and `ACCESSORY`. Built-in
rows have explicit mappings; legacy known rows normalize through exact
category/subcategory keys, and new assigned rows must choose a slot. Categories
and subcategories that were absent from the old mix become visible as
unassigned rows and are never assigned to departments by a generated
cross-product.

Catalogue Mix row IDs are persisted and remain stable while their editable
values change. New rows receive an ID once when added. The ID is also the React
key, so category and subcategory edits keep focus and removing a neighboring
row does not move another row's state.

The detail client polls persisted state every three seconds only while a job is
queued or running. Product batches use `CATALOG_MAX_PRODUCTS_PER_JOB` (default
100, hard safety ceiling 500), enforced independently in the form, server action,
and job service. Catalog model values are
stored as LiteLLM `provider/model` names and are applied only to new jobs. The
image selector is restricted to the app's reviewed image-capable model list;
already queued jobs retain their recorded model names for attribution and
repeatability.

## Catalogue CSV export

The UI calls this the Catalogue CSV; its persisted adapter and schema remain the
Demoware-compatible integration contract. The catalog list and each detail
workspace expose an authenticated CSV download.
The download route is
`/api/admin/catalogs/{slug}/export.csv`; viewer-level internal admins may export,
and each successful export is audited as `exported_csv`. The route returns
UTF-8 `text/csv`, RFC 4180 quoting and CRLF rows, disables caching, and uses a
stable filename derived from the catalog slug.

The adapter reads persisted catalog records and emits one row per variant in a
fixed 27-column order. The original 23 fields keep their order; Complete the
Look fields and then Design Mix fields are appended. Every style of a parent product gets its own size rows,
style ID, color, and image URLs. IDs and SKUs are never regenerated during
export. Front, back, and on-model assets map to
`image_url_1`, `image_url_2`, and `image_url_3` respectively, and the same three
stable opaque URLs repeat across every size row in a style. URL values use
`APP_URL`; deployed environments must set it to the HTTPS hostname Demoware can
reach. Text beginning with `=`, `+`, `-`, or `@` is prefixed with an apostrophe
to prevent spreadsheet formula execution when an operator opens the file. The
Complete the Look columns are `complete_look_image_url` and `companion_products`; the URL is
the stable asset endpoint only for a READY non-stale look, and companion product
IDs are semicolon-separated in persisted outfit order. For example:
`PRE-W-000010;PRE-W-000011`. Without a usable look, both cells are blank and
this optional data does not affect core export readiness.
The last two columns are `pattern` and `embellishments`. Empty design values are
exported as blank cells. Multiple embellishment codes use a semicolon separator
in the saved deterministic assignment order.

Department validation uses the catalog's configured department keys and exports
the configured label, preserving the existing `Women` and `Men` values. Only
products whose product and every style are `READY` pass export validation. The
validator also checks required values, identifier uniqueness and parentage,
profile taxonomy and category-specific sizes, positive prices, sale-price
ordering, EUR currency, non-negative stock and matching availability, plus
exactly three ready images with stored keys, allowed MIME metadata, and minimum
512px dimensions. The storage adapter already decodes every generated source
with Sharp before it can be persisted as WebP, so an image with READY metadata
has passed decode and non-empty-byte validation at write time.

The Export tab shows products, styles, variant rows, referenced images, excluded
products, and the first validation issues before download. The companion
`/api/admin/catalogs/{slug}/validation-report.json` download contains the full
issue list, readiness checks, schema version, generation timestamp, and the
front/back/on-model contract. A catalog is `readyForImport` only when it contains
at least one product and variant row, every product is exportable, and there are
no validation issues. A catalog with no
exportable variants returns HTTP 422 instead of a misleading header-only file.
The optional ZIP archive is not implemented: hosted image URLs are the intended
Demoware contract and avoid duplicating persisted media.

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

Each profile owns its price and stock ranges, department mix, initial
category/subcategory entries, palette, materials, sizes, seasons, naming tone,
visual direction, and default text/image models. Seeding creates Catalogue Mix
defaults for new catalogs. On
existing catalogs it refreshes static profile settings while merging in the
current normalized Catalogue Mix, so departments and mix rows survive a reseed.
Existing mix rows are retained and profile defaults are added only for missing
tuples. Keep the seed idempotent and update
existing profiles by `slug`; never reset `nextProductSequence` during an update.

Department configuration is now stored as `{ key, label, code, generationWeight }`
entries. Existing JSON with `departmentWeights` is normalized at read time to
Women (`W`) and Men (`M`), preserving existing IDs and historical products.
Department codes are unique, uppercase alphanumeric values of up to six
characters. Product records and filters keep the stable department key; the
admin table and product detail page display the configured department label.

The catalogue mix, rather than independent department/category lists, controls
generation combinations. ALL creates exactly the sum of row quotas. Department
and category scopes filter to matching rows and distribute the requested count
deterministically in proportion to each row's `productCount`. A scoped request
with no matching rows is rejected before queueing. The complete mix is included
in each queued task's frozen config snapshot, so later settings edits only affect
new jobs.

The `20261022150000_catalogue_mix_defaults` migration upgrades the four existing
profile configs with explicit, reviewed rows when `assortmentPlan` is absent.
The `20261023100000_catalogue_mix_canonical` migration assigns stable IDs to
existing rows, folds taxonomy-only category/subcategory combinations into
unassigned zero-quota rows, and removes the duplicated `categories` and
`subcategories` config properties. Production does not depend on running the
development seed for either upgrade.

Complete the Look recommendations use persisted style colour hex values and
catalogue mix slots. `src/modules/synthetic_catalog/domain/outfit-planner.ts`
applies department and season constraints, compact slot recipes, colour harmony,
and companion reuse balancing locally without another model call. The schema
stores one `SyntheticCompleteLook` per anchor colour style and ordered
`SyntheticCompleteLookItem` companion styles, including a scoring snapshot or a
useful `SKIPPED` reason when no valid recipe exists.

## Identifier hierarchy

### Design Mix

Catalogue Settings includes Design Mix percentages for patterned and embellished
products, whether the two attributes may overlap, an overlap ceiling, controlled
pattern and embellishment vocabularies, and per Catalogue Mix row compatibility
rules. Vocabulary codes are uppercase stable machine identifiers; labels are
editor-facing text. `SOLID` is represented by a null pattern. Existing configs
without Design Mix safely parse as zero percent for both targets. When a row has
no explicit compatibility rule, category defaults permit patterns for apparel
categories and embellishments for categories suited to decorative construction;
bags and unrelated accessories are not implicitly eligible. An explicit rule
can narrow or exclude either attribute. Settings writes require editor access and
are audited; seeding preserves the saved Design Mix.
New profile seeds start with reviewed targets: Premium 30% / 15%, Fast Fashion
45% / 20%, Luxury 20% / 35%, and Activewear 25% / 10% (pattern / embellishment).

For information jobs, the planner uses half-up rounding (`floor(x + 0.5)`) on
`N × percentage / 100`. It selects exact patterned and embellished product
sets from the scoped assortment, balancing selections across eligible Catalogue
Mix rows in proportion to their planned counts. Pattern and embellishment codes
are selected from each row's compatible vocabulary with the job seed. A
disabled overlap requires disjoint sets; when overlap is enabled the actual
intersection is capped by the rounded maximum. Impossible targets and category
eligibility conflicts fail before sequence reservation or task creation. The
wizard runs the same planner and displays its exact counts. Each queued product
task stores its complete assignment and configuration snapshot, so retries and
later catalogue setting edits do not change the planned design.

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
- `SyntheticProduct` also stores canonical pattern and embellishment codes;
  migration `20261023110000_synthetic_product_design` adds nullable pattern and
  non-null JSONB embellishment fields with an empty-list default for legacy rows.
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

The information task's frozen assignment is the source of truth for structured
output and persistence. Provider output must return the exact planned pattern
and ordered embellishment code list. The product row is canonical across colors;
each style's `visualSpec` carries the same codes and construction details.
FRONT, BACK, ON_MODEL, and Complete the Look prompts preserve these attributes
and forbid unassigned decoration. Image requests continue through the attributed
LiteLLM module.

`createGenerationJob()` reserves all sequences before persisting one
`GENERATE_PRODUCT` task per planned product. `runGenerationJob()` persists each
product, its single MVP color style, all size variants, and task completion in
one transaction. A bounded run returns the job to `QUEUED`; calling it again
processes only unfinished tasks. Provider failures become `FAILED` tasks and a
`COMPLETED_WITH_ERRORS` job. `resumeGenerationJob()` is the explicit manual
retry boundary: it requeues failed tasks and resets their bounded attempt budget.
Automatic worker retries remain bounded by `maxAttempts`.

Editors can stop a queued or running job. Cancellation locks the job row, marks
queued tasks `CANCELLED`, and leaves completed products, styles, variants, and
images intact. Workers check cancellation after provider calls and before
persisting or uploading follow-up work; an already-started LiteLLM or image
request may still finish and incur cost. Cancelled jobs are terminal and cannot
be resumed or included in retry-failures operations.

New requests carry a frozen scope, color count, taxonomy/palette, brand, and
segment snapshot in their persisted product tasks. Product text and all image
tasks use that queued context even if catalog settings change later. Legacy
tasks without the brand and segment fields fall back to the current catalog.
Each parent product uses one text generation call; the generated primary color is followed by deterministic, seed-selected
distinct palette colors. Each style gets its own normal size assortment and
color-seeded inventory. New information jobs have type `CATALOG_INFO`; their
styles and products are information-ready when persisted. For `P` products, the
expected first-step attributed LiteLLM calls are `P`. Failed work can be
resumed without rebuilding completed styles or images, and persisted image task
context protects queued work from later catalog settings edits. For example,
10 products with 3 colors create 10 products, 30 styles and complete variant
inventory, with 10 first-step text calls and no image tasks. A later core-image
job queues up to 90 assets/tasks and calls. Catalog owners should account for
the image-call growth when choosing batch size and palette count.

The Phase 2 application service remains a narrow product-generation test seam.
The production workflow is owned by the Phase 5 worker described below.

## Background worker

`npm run worker` starts a single-concurrency polling process. It uses
`CatalogGenerationTask` as a PostgreSQL queue and never holds an HTTP request
open. A claim is one atomic `FOR UPDATE SKIP LOCKED` update that records the
worker ID, lease time, and attempt before returning the task. Multiple ECS tasks
can therefore poll safely without generating the same item twice.

Completing a product transaction creates its product, styles, and variants.
It does not create image assets or image tasks. A later `CORE_IMAGES` job creates
the required core assets/tasks. Non-front tasks are not
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

Every worker failure is logged with job/task IDs, catalog, persisted entity IDs,
model, image role, attempt, retry category, and the sanitized error message.
The Jobs tab displays persisted failed-task reasons and attempt counts. “Retry
failures” resets and requeues only failed tasks; completed products and images
remain untouched.

ECS runs the command in a second, essential container in the existing Fargate
task. It shares the app image, task role, network, tags, and deployment lifecycle,
but has its own process and a three-connection database pool. This avoids a
second always-on Fargate service. If the web service scales out, the atomic claim
protocol safely allows the additional worker containers to help. SIGTERM stops
new polling, lets the current item settle, then disconnects Prisma.

The deployment pipeline rolls out the application image before running Prisma
migrations. During that bootstrap window the worker treats Prisma `P2021`
(missing queue tables) as temporary and waits five seconds before checking
again. The worker remains alive as an essential container, allowing the web
container's ECS Exec agent to run the migration; other startup failures still
terminate the worker and restart the task normally.

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

Core image readiness uses the required roles `FRONT`, `BACK`, and `ON_MODEL`;
these remain the export-required images. A manual core-image job creates the
durable assets/tasks. `generateStyleImages()` processes front first, then supplies the stored
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

The admin regeneration action targets one role only and creates a dedicated
`REGENERATE_IMAGE` job/task with an explicit regeneration payload. Duplicate
queued/running work for the same asset is rejected. The worker honors that flag
even when the current asset is `READY`; generation completes before the
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

`make {env}-first-deploy` creates the environment bucket if it is missing,
enforces S3 Block Public Access, and applies the app/environment cost tags. CDK
imports this out-of-band bucket by name, so a plain infrastructure deployment
cannot detect that it is absent.

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
- `src/modules/synthetic_catalog/config/generation-limits.ts`
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
- `src/modules/synthetic_catalog/server/admin-catalogs.ts`
- `src/modules/synthetic_catalog/server/admin-actions.ts`
- `src/modules/synthetic_catalog/server/catalog-export.ts`
- `src/modules/synthetic_catalog/export/demoware-csv.ts`
- `src/app/admin/catalogs/page.tsx`
- `src/app/admin/catalogs/[catalogRef]/page.tsx`
- `src/modules/synthetic_catalog/storage/generated-asset-storage.ts`
- `src/modules/llm/lib/images.ts`
- `src/app/api/catalog-assets/[publicId]/route.ts`
- `src/app/api/admin/catalogs/[catalogRef]/export.csv/route.ts`
- `src/app/api/admin/catalogs/[catalogRef]/validation-report.json/route.ts`
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

### 2026-10-21 — Admin actions enqueue; workers execute

The internal UI never waits for LiteLLM. Server actions authorize, validate,
persist a job/task, audit the request, and return. The worker owns every remote
generation call and the page derives progress from database state. This keeps
request timeouts, refreshes, and duplicate clicks from becoming duplicate spend.

### 2026-10-21 — Catalog defaults, not per-job model overrides

Editors can maintain each catalog's default text model, image model, brand, and
visual direction. The add-products dialog deliberately does not expose a model
override: one reviewed default per catalog is easier to operate, while the
persisted job still records the exact models used.

### 2026-10-21 — Export is a strict persisted-data adapter

The CSV never serializes an LLM response or partially generated record. One
pure adapter validates database-shaped input and emits the fixed Demoware
contract, while the server layer only loads relations and the authenticated
route handles download/audit concerns. Failed validation excludes the whole
product so Demoware never receives only some sizes or images for a style.

No Demoware importer implementation, private staging endpoint, or exact schema
was available in this repository or public documentation. Phase 7 therefore
uses the explicit schema approved in the project plan. An actual staging import
remains an external integration check once Demoware access and the current
importer are supplied; it is not represented as completed by unit tests.

### 2026-10-21 — Generation caps fail closed

The per-job limit is environment-configurable but cannot exceed 500 products.
Invalid or inconsistent values fail startup/request validation instead of
silently authorizing more LiteLLM calls. Large jobs require a second explicit UI
confirmation and the enforced values are returned with each catalog view so the
browser and server cannot drift.

### 2026-10-22 — Product archiving is reversible

Products can be archived and restored by editors. Archiving records the actor
and timestamp, cancels that product's queued tasks, and leaves completed data
intact. Running work may finish, but it does not clear the archive marker.
Restoring only clears the archive marker; it does not requeue cancelled tasks.
Overview counts, active product counts, and Catalogue CSV validation/export
exclude archived products. The Products tab defaults to Active and offers an
Archived filter for restore. The table omits Season and Stock to keep product
identity, style count, price, and aggregate image state visible at desktop width.

### 2026-10-23 — Catalogue Mix is the canonical taxonomy

Persisted catalog config stores category/subcategory relationships, generation
quotas, and Complete the Look slots only in Catalogue Mix rows. Legacy taxonomy
combinations without an existing department assignment migrate to visible,
zero-quota unassigned rows. This preserves the old vocabulary without
fabricating a department or altering existing All Catalogue generation totals.
Departments remain a separate settings list because their keys, labels, ID
codes, and generation weights have independent identity and use.

## Operations and sample approval runbook

1. Confirm the web and worker containers are healthy and that the catalog worker
   is polling. Inspect the `catalog-worker` CloudWatch stream for structured
   task failures; never paste LiteLLM keys or request headers into tickets.
2. Keep `CATALOG_MAX_PRODUCTS_PER_JOB=100` and
   `CATALOG_LARGE_JOB_THRESHOLD=25` unless the expected spend and operational
   window have been reviewed. A change requires a normal app deployment.
3. Queue a one-product sample in each profile: Premium, Fast Fashion, Luxury,
   and Activewear. This produces four attributed LiteLLM calls per profile.
4. Wait for each job to reach a terminal state. For failures, read the persisted
   task reason in the Jobs tab. Retry the job for failed tasks, or regenerate one
   failed/unsuitable image from its image tile; do not restart successful work.
5. Human-review all three roles for garment consistency, absence of logos/text,
   and correct front/back/on-model framing. Download the validation report; it
   must say `readyForImport: true` before downloading the CSV.
6. With the current Demoware staging importer contract and access supplied,
   import each small CSV, verify all three image URLs are fetchable, then run the
   Labeller. Record manual approval outside the application.
7. Only after all four samples are manually approved may an operator queue larger
   batches. The application does not automatically expand a sample into a full
   four-catalog generation run.

If a worker stops mid-task, restart or redeploy it normally; the lease recovery
loop requeues expired work. Do not edit task rows, reset sequence counters, or
delete stored assets as a recovery mechanism.

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
- Do not change CSV column names or image role ordering without validating the
  current Demoware importer. `image_url_1` must remain the front/primary image.
- Keep deployed `APP_URL` aligned with the externally reachable HTTPS hostname;
  it is the origin written into exported image and product URLs.
- Do not send nested `metadata` as a multipart image-edit form field; use the
  LiteLLM spend-metadata header implemented by `llmEditImage()`.
- Do not call generation providers from catalog server actions. Enqueue a task
  and let the worker execute it.
- Do not raise generation limits merely to bypass the large-job confirmation;
  the 500-product hard ceiling is a spend-safety boundary.
- Do not start full four-catalog generation until one sample from every profile
  has passed human image review and Demoware staging validation.
- Archived products are soft-hidden. Their styles, variants, images, tasks, and
  usage history remain stored; active overview counts and CSV validation/export
  omit them. Restore does not restart cancelled queued product work.
- Do not add free-form per-job model controls; validate and store catalog
  defaults as LiteLLM `provider/model` names.
- When authenticated admin actions are added, their consequential generation,
  retry, regeneration, and deletion requests must write audit records using the
  entity types registered in `src/modules/audit/entity-types.ts`. The Phase 4
  worker-facing services intentionally have no session or actor context.

## Catalogue brand-logo pattern

The full pattern vocabulary is `STRIPED`, `CHECKED`, `FLORAL`, `GEOMETRIC`,
`ABSTRACT`, `ANIMAL`, `POLKA_DOT`, `COLOR_BLOCKED`, and
`BRAND_LOGO_REPEAT`. Logo repeat is one optional pattern code. It does not
become the default, alter the patterned-product percentage, or replace ordinary
patterns. Deterministic planning chooses from the exact codes permitted by each
Catalogue Mix row and balances their use across the batch. Rows can exclude the
logo while allowing ordinary patterns, allow the logo with selected ordinary
patterns, or prohibit all patterns. Products outside the exact pattern target
remain solid, and retries retain their frozen assignments.

The existing compatibility editor exposes `Brand logo repeat`. Built-in
eligibility applies only to plausible clothing, bags, caps, accessories,
scarves, socks, and textiles; row compatibility remains administrator
controlled. Migration `20261023120000_catalogue_brand_logo_pattern` appends the
new choice idempotently to existing vocabulary arrays without changing
percentages, other patterns, embellishments, or compatibility rules.

The static slug mapping is `premium-apparel` → `/img/aureline.png`,
`fast-fashion` → `/img/loopline.png`, `luxury-fashion` →
`/img/maison-veyra.png`, and `activewear` → `/img/kinetiq-form.png`. For a
planned logo repeat, only that catalogue's supplied fictional logo is allowed,
as a restrained repeated textile or surface motif. FRONT receives the
catalogue logo reference only. BACK and ON_MODEL receive the authoritative
FRONT product image first, then the catalogue logo. This exact reference set
requires editing through LiteLLM; unsupported reference processing fails
visibly and uses normal task retries without prompt-only fallback. Ordinary
patterns get no logo reference. Real-world, unassigned, invented, altered, or
other-catalogue logos remain prohibited.

Complete the Look preserves fictional logo repeats and ordinary patterns
already visible in product references. It adds no logo to an unassigned item
and never replaces an ordinary pattern with a logo pattern.
