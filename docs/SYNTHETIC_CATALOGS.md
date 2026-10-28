# Synthetic Catalogs

## Purpose

This app creates persistent synthetic fashion catalogs for internal Mapp users.
It is deliberately admin-only: there is no customer-facing `/account` experience,
and company-context login is disabled with `COMPANY_LOGIN_ENABLED=false`.

Phases 1–8 provide the data model, four stable catalog profiles, identifier
rules, deterministic generation domain, resumable job state machine, real
LiteLLM text and image generation, persistent generated-image storage, and an
independent database-backed worker, the internal admin workflow used to operate
them, validated UPC-compatible CSV export, configurable spend guards, full readiness
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
The admin sidebar loads every active catalogue from the database in stable name/slug order, including custom catalogues; inactive deletion tombstones are omitted. Dashboard and LiteLLM Usage remain fixed links.
`/admin/catalogs/{slug}` is the catalog workspace: it shows background progress,
the full persisted product list in a table, job history, retry controls, and
generation settings. The product table can be filtered by department, category,
subcategory, product archive state, and aggregate required-core-image status
(`READY`, `FAILED`, `GENERATING`, or `MISSING`). Filter state is encoded in the
catalogue URL, with defaults omitted, so reloads, bookmarks, and browser history
reproduce the view. The current filter query is also cached in `sessionStorage`
under a catalogue slug-specific key; opening that catalogue's bare URL in the
same tab restores the cached selection, while explicit query parameters take
precedence. Clear resets the URL and removes the catalogue's cache entry.
Product links carry a sanitized `from` URL so the PDP returns to the filtered
catalogue. Information readiness is independent of image readiness. It reports color-style count and stock across every style; the
thumbnail uses the first available FRONT image. Image status is computed from
the two required core roles, independently of product/style information
readiness; a core-image failure in any color is shown as `FAILED`.
Department, category, and subcategory options come only from persisted products
in the selected product-state scope. Department choices use stored department
keys and product display labels; category options narrow to the selected
department, and subcategories narrow to the selected department and category.
Configured Catalogue Mix rows do not create filter choices until a product
exists. Image status narrows rows but does not change taxonomy choices. An
upstream user selection clears only dependent values that no longer exist in
that product scope. Explicit unavailable URL values remain visible as
unavailable and match no products rather than widening to All.
Selecting a row opens `/admin/catalogs/{slug}/products/{externalId}`, where all
color styles, their IDs, size/SKU inventory, and two required core images are
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
Choosing a department or category initializes its selector to the first eligible
Catalogue Mix value, while still allowing the operator to choose another value.
It generates product copy, merchandising fields, colour styles and complete
size/inventory rows. It creates no image assets or image tasks and makes no image
provider calls. All Catalogue derives its base-product count
from the catalogue mix and shows each configured quota; scoped requests retain
an operator-selected parent-product count and distribute it across matching
mix rows, weighted by their configured product counts. Design Mix pattern and
embellishment percentages and row compatibility rules are applied and frozen
during this information job, not during either image-generation step. Its review shows
parent products, styles, zero image assets, size rows, and attributed text-model
calls. Core imagery is a separate manual step.
The visible workflow now exposes a Step 2 action after a completed information
batch, plus an explicit all-active-products-missing-core-images action for
historical catalogue records. Both create separate `CORE_IMAGES` jobs linked to
their source information job when one is selected. They enqueue only missing or
failed `FRONT` and `BACK` roles; READY assets are preserved. Existing
`ON_MODEL` assets remain stored for backwards compatibility but are neither
required nor queued by Step 2.
Catalogue-level transaction locking and active-task checks make repeated
submissions idempotent. A preflight confirmation shows target products, colour
styles, and image calls before queueing.
Step 3 is also manual and offers a source information batch or all eligible
active catalogue products. Before queueing, every active style in the full
catalogue must have READY FRONT and BACK images, even for a batch target;
Legacy `ON_MODEL` assets are irrelevant to this gate. The preflight lists missing/failed roles and affected PDPs,
then summarizes eligible and skipped styles, skip reasons, and image calls.
Complete the Look jobs share the worker's lock, cancellation, retries and lease
recovery. They store one look per colour style and preserve the persisted
pairing across image retries. Companion products must be active, same-catalogue,
same-department, season-compatible, from different products, and have READY
FRONT images. Recipes use the explicit mix slots; neutrals pair broadly,
harmonious colours score higher, competing saturated accents are penalized, and
reuse counts reduce a style's score when it has already been selected often.
References use the anchor FRONT image followed by companion FRONT images in the
saved outfit order. Step 3 creates the model-worn outfit image from those
product-only references. The image edit passes those files through
LiteLLM with feature `synthetic-catalog-image-complete-look`; unsupported
multi-reference edits fail visibly and remain retryable.

Archiving an anchor hides its look. Archiving any companion marks affected looks
STALE and cancels queued image work. Restoring the product leaves those looks
stale until an editor runs Step 3 again. FAILED looks can be regenerated without
changing their saved pairing. Complete the Look does not change core-image
readiness or block ordinary UPC CSV readiness.
Size-row estimates use the exact planned mix rows, category-specific size rule,
and next product sequence used when the job is queued.
Editors can add departments from Settings using a label and product ID code.
Departments retain stable keys, labels, and product ID codes. Viewers see them
without mutation controls; department writes are validated, transactional, and audited.
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
queued or running. Progress reads aggregate task totals by status and count
ready products and styles in the database; they do not hydrate successful task
rows. Failure details are fetched only for jobs with failed tasks, preserving
the retry and failure display without sending every task on each poll. There is
no application-level product-count maximum:
Catalogue Mix defines the All Catalogue total, while Department and Category
requests accept any positive safe integer. `CATALOG_LARGE_JOB_THRESHOLD`
(default 25) controls an explicit spend and operations warning only; confirming
the warning never rejects a job. The obsolete `CATALOG_MAX_PRODUCTS_PER_JOB`
setting is ignored if it remains in an environment. PostgreSQL `Int` sequence
capacity is the remaining technical boundary. Catalog model values are
stored as LiteLLM `provider/model` names and are applied only to new jobs. The
image selector is restricted to the app's reviewed image-capable model list;
already queued jobs retain their recorded model names for attribution and
repeatability.

## UPC-compatible CSV export

The catalog list and workspace provide a downloadable UPC-compatible CSV for
catalogues; this is a file-format compatibility export, not a direct UPC API
integration. The authenticated route remains
`/api/admin/catalogs/{slug}/export.csv`. Viewer-level internal admins may
download it, and successful exports retain the `exported_csv` audit event. The
route returns UTF-8 `text/csv`, RFC 4180 quoting and CRLF rows, disables caching,
and uses a stable filename derived from the catalog slug.

The adapter reads persisted records and emits one row per size variant in this
fixed order: `product_id`, `style_id`, `variant_id`, `sku`, `brand`, `name`,
`description`, `department`, `category`, `subcategory`, `price`, `sale_price`,
`currency`, `color`, `size`, `material`, `season`, `stock`, `availability`,
`images`, `product_url`, `companion_products`, `pattern`, `embellishments`.
Identifiers and SKUs are never regenerated during export. Availability is the
lowercase boolean text `true` when the canonical variant availability is
`IN_STOCK`, and `false` when it is `OUT_OF_STOCK`; validation still requires
stock and canonical availability to agree.

`images` contains a JSON array serialized as one correctly escaped CSV field.
Its deterministic order is FRONT first, BACK second, then the READY Complete the
Look image third when available and valid. Missing optional images are omitted;
the array never uses blank or null placeholders. Legacy `ON_MODEL` images are
not exported. FRONT and BACK remain required and must each be READY with a
storage key, supported MIME type, and at least 512px dimensions. The same image
array repeats for every size row in a style. `imagesReferenced` counts the URLs
in those arrays once per exported style.

Complete the Look is included only when its persisted state and image are READY,
it has non-archived companions, and the image has a public ID and storage key.
Failed, skipped, stale, missing, or archived-companion looks are omitted from
both `images` and `companion_products`. Companion product IDs remain
semicolon-separated in saved outfit order, for example
`PRE-W-000010;PRE-W-000011`. An unusable optional look does not affect core
readiness. The product URL and image URLs use `APP_URL`; deployed environments
must set it to the app's HTTPS hostname. Text beginning with `=`, `+`, `-`, or
`@` is prefixed with an apostrophe to prevent spreadsheet formula execution.
`pattern` and `embellishments` remain the final columns; multiple embellishment
codes use a semicolon separator in deterministic assignment order.

Department validation uses configured department keys and exports configured
labels. Only products whose product and every style are `READY` pass export
validation. The validator checks required values, identifier uniqueness and
parentage, taxonomy and category-specific sizes, positive prices, sale-price
ordering, EUR currency, non-negative stock and matching availability, plus
exactly one ready FRONT and BACK image. The storage adapter decodes generated
sources with Sharp before persistence, so READY images have already passed
decode and non-empty-byte validation.

The Export tab shows products, styles, variant rows, referenced images, excluded
products, and validation issues before download. The companion
`/api/admin/catalogs/{slug}/validation-report.json` download contains the full
issue list, readiness checks, schema version, generation timestamp, the
`images` column and its FRONT/BACK/COMPLETE_LOOK ordering, plus the required
`["FRONT", "BACK"]` roles. A catalog is ready only when it contains at least one
product and variant row, every product is exportable, and there are no
validation issues. A catalog with no exportable variants returns HTTP 422
instead of a header-only file.

## Complete the Look relationship CSV export

The Export tab also offers a separate Complete the Look relationships CSV at
`/api/admin/catalogs/{slug}/complete-look.csv`. It does not replace or alter the
UPC CSV. The relationship file uses the fixed column order
`main_style_id`, `related_style_id_1`, `related_style_id_2`,
`related_style_id_3`, with one row per qualifying main colour style. Each cell
uses the persisted product and style IDs joined as `productId__styleId`.

Rows require an active, non-archived READY main product and style, a persisted
READY Complete the Look result, and its valid READY image (including persisted
public ID and storage key). Companion product and style records must also be
READY and non-archived. If any saved companion is invalid, the whole look is
omitted. FAILED, SKIPPED, STALE, missing-image, and archived-companion looks
are never exported. Saved companions retain their persisted `sortOrder`; fewer
than three companions leave trailing cells blank, and only three related-style
columns are emitted. Rows sort by product ID then style ID, and duplicate main
style IDs collapse to one row. The endpoint returns a valid header-only CSV
when no relationship qualifies. It uses the same authenticated viewer download
access, UTF-8 CSV headers, CRLF/RFC 4180 escaping, no-store response, and
successful-download audit convention as the UPC export.

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

Department configuration is stored as `{ key, label, code }` entries.
Department codes are unique, uppercase alphanumeric values of up to six
characters. Product records and filters keep the stable department key; the
admin table and product detail page display the configured department label.

The catalogue mix, rather than independent department/category lists, controls
generation combinations and is the authoritative quantity configuration. ALL
creates exactly each Catalogue Mix row's `productCount`. Department and
category scopes filter to matching rows and distribute the requested count
deterministically in proportion to each row's `productCount`. A scoped request
with no matching rows is rejected before queueing. The complete mix is included
in each queued task's frozen config snapshot, so later settings edits only affect
new jobs.

### 2026-10-26 — Remove department generation weights

Department weights no longer affect planning or generation; Catalogue Mix row
`productCount` values are the sole quantity configuration. At read time, the
config normalizer accepts legacy `departments[].generationWeight` and strips it
from canonical departments. It also accepts legacy top-level `departmentWeights`
when department metadata is absent, creating Women (`W`) and Men (`M`) entries
without retaining the numeric values. This keeps existing JSON readable while
future settings writes persist the canonical weight-free structure. No database
migration is needed because the configuration is stored as JSON.

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
are selected from each row's compatible vocabulary with the job seed. The
deterministic selection reserves scarce compatibility candidates so choosing
patterns cannot make an otherwise feasible embellishment target fail. A
genuinely incompatible combination produces a configuration error rather than
an allocator exception. A disabled overlap requires disjoint sets; when overlap
is enabled the actual intersection is capped by the rounded maximum. Impossible targets and category
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
- `SyntheticImageAsset` tracks front, back, legacy on-model, and Complete the Look images independently.
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
FRONT, BACK, legacy ON_MODEL regeneration, and Complete the Look prompts preserve these attributes
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
job queues up to 60 assets/tasks and calls. Catalog owners should account for
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
the required core assets/tasks. Back tasks are not
claimable until the front asset is terminal, so back images use the front
reference when it is available and fall back to prompt-only generation
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

Core image readiness uses only the required roles `FRONT` and `BACK`; these are
also the export-required images. A manual core-image job creates the
durable assets/tasks. `generateStyleImages()` processes front first, then supplies the stored
front bytes to back generation through LiteLLM's image-edit
endpoint. If the proxy explicitly reports that edits are unsupported, the same
adapter falls back to attributed prompt-only generation; it never calls a
provider directly.

Role-specific prompts require a complete product-only front/back view. Complete
the Look prompts create the model-worn outfit in Step 3, while prohibiting real brands, logos, text,
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
private. Export URLs use the stable opaque route
`/api/catalog-assets/{publicId}`, which resolves only one persisted generated
asset, calls the framework's `authorizeS3Read()`, and redirects to a fresh
short-lived presigned URL. There is no object listing or caller-controlled key.
The `public/` prefix is deliberate: synthetic media must be fetchable by
the external product-catalogue consumer without an interactive app session,
while the admin application itself remains internal-only.

Admin image components render these stable redirect URLs with Next Image's
`unoptimized` option. The browser must request `/api/catalog-assets/{publicId}`
directly so the route can issue its presigned-S3 redirect; sending that internal
redirect route through `/_next/image` fails in production. This applies to core
images and Complete the Look images alike.

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
- `src/modules/synthetic_catalog/export/upc-csv.ts`
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
pure adapter validates database-shaped input and emits a fixed CSV contract,
while the server layer only loads relations and the authenticated route handles
download/audit concerns. Failed validation excludes the whole product so an
export never contains only some sizes or required images for a style.

### 2026-10-26 — UPC-compatible downloadable CSV

The downloadable schema uses UPC-compatible boolean availability and a JSON
`images` array ordered FRONT, BACK, then a valid READY Complete the Look image.
The CSV remains a file-format compatibility export; it does not enable the UPC
capability or call a UPC API. This keeps export independent of UPC credentials
and preserves the existing authenticated download and audit flow.

### 2026-10-26 — Product quantities are uncapped

Catalogue Mix remains the source of truth for All Catalogue quantities, and
scoped requests accept any positive safe integer. The former configurable and
hard-coded product-count caps were arbitrary operational safeguards that could
block reviewed work; `CATALOG_LARGE_JOB_THRESHOLD` now prompts explicit
confirmation without imposing a ceiling. Positive safe-integer validation and
PostgreSQL `Int` sequence capacity remain technical constraints. Existing
`CATALOG_MAX_PRODUCTS_PER_JOB` environment values are ignored.

### 2026-10-26 — Large plans are stored in one atomic job

The complete product sequence range is reserved atomically before planning;
sequence gaps remain valid if later work fails. The queued job and its task
records are then inserted in one database transaction, with task records sent
to PostgreSQL in internal batches of 300. A worker can only observe the job
after every planned task commits. The job creation API returns job metadata and
does not hydrate the created task collection. The sequence counter remains a
PostgreSQL `Int`; requests that would overflow it receive a technical capacity
error.

### 2026-10-22 — Product archiving is reversible

Products can be archived and restored by editors. Archiving records the actor
and timestamp, cancels that product's queued tasks, and leaves completed data
intact. Running work may finish, but it does not clear the archive marker.
Restoring only clears the archive marker; it does not requeue cancelled tasks.
Overview counts, active product counts, and UPC CSV validation/export
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

### 2026-10-26 — Product tables expose only represented taxonomy

Table filter choices are derived from persisted products and the selected
active/archive scope, not from Catalogue Mix configuration. This prevents an
empty planned combination from appearing as a usable filter and lets archived
products remain discoverable in the Archived view. Image status is deliberately
excluded from option derivation so filtering image readiness does not make
taxonomy choices flicker or disappear.

## Operations and sample approval runbook

1. Confirm the web and worker containers are healthy and that the catalog worker
   is polling. Inspect the `catalog-worker` CloudWatch stream for structured
   task failures; never paste LiteLLM keys or request headers into tickets.
2. Review expected spend and the operational window for large requests.
   `CATALOG_LARGE_JOB_THRESHOLD=25` controls the confirmation warning only and
   can be adjusted independently of the accepted product quantity.
3. Queue a one-product sample in each profile: Premium, Fast Fashion, Luxury,
   and Activewear. This produces four attributed LiteLLM calls per profile.
4. Wait for each job to reach a terminal state. For failures, read the persisted
   task reason in the Jobs tab. Retry the job for failed tasks, or regenerate one
   failed/unsuitable image from its image tile; do not restart successful work.
5. Human-review FRONT and BACK for product consistency and absence of logos/text,
   then review the model-worn Complete the Look output from Step 3. Download the validation report; it
   must say `readyForImport: true` before downloading the UPC-compatible CSV.
6. Verify the required image URLs are fetchable and record manual approval
   outside the application. The downloadable format does not perform an API
   upload or import.
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
- Do not change the UPC CSV columns or `images` ordering without updating its
  export tests and this document. FRONT must remain the first image.
- Keep deployed `APP_URL` aligned with the externally reachable HTTPS hostname;
  it is the origin written into exported image and product URLs.
- Do not send nested `metadata` as a multipart image-edit form field; use the
  LiteLLM spend-metadata header implemented by `llmEditImage()`.
- Do not call generation providers from catalog server actions. Enqueue a task
  and let the worker execute it.
- Do not treat the large-job confirmation threshold as a product ceiling; it is
  a spend and operations warning that requires explicit acknowledgement.
- Do not start full four-catalog generation until one sample from every profile
  has passed human image review and exported-image URL validation.
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
catalogue logo reference only. BACK receives the authoritative FRONT product
image first, then the catalogue logo. Legacy ON_MODEL regeneration retains the
same reference behavior, but Step 2 does not create that role. This exact reference set
requires editing through LiteLLM; unsupported reference processing fails
visibly and uses normal task retries without prompt-only fallback. Ordinary
patterns get no logo reference. Real-world, unassigned, invented, altered, or
other-catalogue logos remain prohibited.

Complete the Look preserves fictional logo repeats and ordinary patterns
already visible in product references. It adds no logo to an unassigned item
and never replaces an ordinary pattern with a logo pattern.
## Catalogue lifecycle

Editors and administrators can create a catalogue from the New catalogue action on `/admin/catalogs`. The form captures catalogue name, brand name, segment, safe URL slug, three-letter external product prefix, and a configuration template. Active catalogues are the templates when any exist; otherwise the built-in profiles are offered. The parsed configuration is cloned, while products, styles, variants, jobs, generated images, and sequence state are not copied. New catalogues start active with product sequence 1. Unknown brand logo slugs continue to show the configured brand name.

Catalogue creation requires editor access. Full deletion requires administrator access and exact typed confirmation using the catalogue name or slug. Deletion refuses while jobs or tasks are queued or running. It removes catalogue products and all cascading product data plus jobs/tasks, while keeping LiteLLM usage, audit history, and the inactive `SyntheticCatalog` row. That tombstone prevents a future seed from recreating a built-in catalogue with the same slug and keeps the audit entity identity stable. Seed updates preserve the existing `active` flag.

Generated image cleanup captures exact non-null storage keys from the selected catalogue's image rows before deleting database rows. After the database transaction succeeds, cleanup accepts only keys under `public/catalogs/<exact-slug>/`; it never resolves or deletes a prefix. S3 delete calls are idempotent. A storage failure leaves the catalogue deleted and is reported and audited by failed-object count.

The admin sidebar reads active catalogue names and slugs in the server layout, sorted by name and slug. It keeps Dashboard and LiteLLM Usage links and omits inactive tombstones.

### Bulk product rename

Bulk rename creates a persistent background preview using LiteLLM feature attribution `synthetic-catalog-bulk-product-name-preview`. It freezes the selected active product names and scope when queued, proposes names in conservative batches, and does not change products during preview. Editors review valid changed proposals and explicitly select which names to apply. Apply changes only `SyntheticProduct.name`, checks that each current name still matches its frozen original, and skips stale rows. Product IDs, SKUs, taxonomy, styles, variants, images, URLs, and Complete the Look relationships remain unchanged.

Job terminal state is derived from every durable task type, including bulk-rename proposal chunks. Product and image counters retain their existing meanings, but a job cannot become terminal while any task type remains queued or running. The `20261027170000_repair_stranded_bulk_rename_jobs` migration reopens only non-cancelled bulk-rename jobs that were incorrectly marked terminal while proposal tasks remained pending; completed chunks are preserved and the worker resumes with the queued chunks.

### Admin cards

Historical job cards and the four catalogue Settings cards can collapse independently. Their contents stay mounted while hidden so unfinished form edits remain in memory. Active generation progress remains expanded.

### Manual catalogue workflow

The catalogue detail workflow uses three matching stage cards. Each card shows a
step badge and status, title and description, progress or context, a control
region, and a full-width primary action footer. The shared flex and grid layout
aligns the action footers on desktop and lets the cards stack without reserved
spacer heights on mobile.

Step 2 has one `Target` selector and one `Generate core images` action. A
`batch:<jobId>` target queues missing or failed FRONT/BACK images only for that
completed catalogue information batch and keeps its source-job lineage. The
`all-missing` target queues missing or failed required core images across all
active catalogue products, including products from earlier batches. Archived
products and already-ready image roles are excluded. The latest completed
information batch is selected by default; when there is no completed batch,
the all-missing target is selected. The all-missing request does not include a
source job ID.

Step 3 retains its existing target selector and generation preflight. Its action
is disabled while the full-catalogue FRONT/BACK prerequisite is incomplete, with
a nearby explanation to complete all required images first. If the authoritative
preflight finds more specific readiness failures, the detailed warning remains
outside the workflow cards.
