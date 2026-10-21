# Synthetic Fashion Catalog Generator - Codex Implementation Plan

## Purpose

Build an internal Mapp Labs application that generates and maintains four reusable synthetic fashion catalogs for Demoware:

- Premium
- Fast Fashion
- Luxury
- Activewear

The app must generate core product data, product variants, and three images per color style, then export a Demoware-ready CSV whose image columns point to stable hosted image URLs.

The app is not a replacement for Demoware enrichment. The Demoware Fashion Labelling Agent remains responsible for additional taxonomy/contextual enrichment after import.

---

# 1. How Codex should use this document

This file is the product and implementation plan. It does **not** replace the Mapp Labs template's existing `AGENTS.md`.

Codex must obey the existing repository instructions first and use this file as project-specific scope.

Before changing code, Codex must read at least:

- `AGENTS.md`
- `GETTING_STARTED.md`
- `docs/capabilities/_registry.json`
- `docs/capabilities/README.md`
- the LLM capability documentation under `docs/capabilities/`
- `app.config.json`
- `docs/DESIGN-SYSTEM.md`
- the current Prisma schema
- existing infrastructure/storage patterns
- existing background-job or worker patterns, if any

Codex must inspect the repository rather than assuming paths, APIs, deployment details, or framework behavior.

Do not overwrite or substantially rewrite the framework's existing `AGENTS.md` unless explicitly asked.

---

# 2. First prompt to give Codex

Paste this into Codex after placing this file in the repository root:

```text
Read the repository instructions and project documentation before making changes.

Start with a READ-ONLY discovery pass. Read:
- AGENTS.md
- GETTING_STARTED.md
- SYNTHETIC_CATALOG_CODEX_PLAN.md
- docs/capabilities/_registry.json
- docs/capabilities/README.md
- the LLM capability docs
- app.config.json
- docs/DESIGN-SYSTEM.md
- prisma/schema.prisma (or the actual Prisma schema location)
- relevant existing storage, job/worker, API, auth, and admin UI code

Do not implement anything yet.

Report back with:
1. The relevant Mapp Labs framework patterns we should reuse.
2. Whether the LLM capability is already enabled and how src/modules/llm is intended to be used.
3. Whether the existing LLM module supports image generation through LiteLLM; if not, propose the smallest extension that preserves Mapp spend attribution.
4. The existing persistent file/object-storage pattern, if any.
5. The existing background-job/worker pattern, if any.
6. The proposed Prisma models and migrations for this project.
7. The proposed route/page structure using existing framework conventions.
8. Any conflicts between this plan and the current repository.
9. A phase-by-phase implementation plan with files likely to change.

Wait for approval before starting Phase 1.
```

---

# 3. Product scope

## 3.1 Fixed catalog types

The application manages exactly four catalog profiles:

| Catalog | Positioning | Departments |
| --- | --- | --- |
| Premium | Contemporary premium fashion | Women, Men |
| Fast Fashion | Trend-led accessible fashion | Women, Men |
| Luxury | High-end designer-inspired fashion | Women, Men |
| Activewear | Performance and athleisure | Women, Men |

The four profiles are seeded application data, not created dynamically by users.

Brand names and visual identities should be configurable per catalog. Initial brand names may be placeholders, but the UI must allow an administrator to edit them before generation.

## 3.2 Main user actions

The internal user must be able to:

1. View the four catalog profiles.
2. See current counts: Products, Styles, Variants, Images.
3. Generate an initial amount of products for a catalog.
4. Add more products later by entering an amount.
5. Monitor generation progress and failures.
6. Review generated products and images.
7. Regenerate an individual image when visual quality is poor.
8. Retry failed products/images without regenerating successful ones.
9. Download the catalog CSV.
10. Optionally download an archive containing the CSV and images.

Adding products must append to the existing catalog and must never renumber or overwrite existing IDs.

---

# 4. Scope boundary with Demoware

This generator creates the synthetic source catalog. It does **not** generate Demoware's advanced enriched fashion attributes.

The generated CSV should contain core product information required to produce a plausible catalog and to give the Demoware Labeller enough context.

Demoware/Fashion Labelling Agent remains responsible for enrichment such as:

- normalized product type/taxonomy refinements
- occasions
- style aesthetic
- climate
- modesty
- outfit impact
- wardrobe/context attributes
- shape solution
- other FLA-generated contextual attributes

Do not duplicate the Labeller inside this application.

---

# 5. Recommended Mapp Labs capabilities

For the MVP, enable/reuse:

- **LLM capability** - required for text and image generation through the Mapp LiteLLM proxy.

Do not enable these unless repository discovery reveals a concrete need:

- Client Catalog - not required because this is an internal synthetic-catalog generator with no customer/company context.
- UPC - not required because products are created synthetically rather than imported from customer feeds.
- FTL - not required for MVP because Demoware's Labeller performs enrichment after import.
- Public API - not required for MVP unless needed to expose generated image files or an integration endpoint; prefer the smallest existing framework mechanism.

Use the framework's existing LLM integration instead of creating direct provider integrations.

---

# 6. LiteLLM requirements

## 6.1 Mandatory integration rules

All model calls must go through the Mapp Labs LiteLLM proxy and the existing Labs LLM module/pattern.

Never:

- put a raw OpenAI key in the app
- put a raw Anthropic key in the app
- expose `LITELLM_API_KEY` to browser/client code
- call providers directly if the framework proxy can perform the operation
- bypass Mapp spend attribution

The application is internal, so calls should use the internal billing subject conventions already implemented by the Mapp Labs LLM capability.

Use clear feature names, for example:

- `catalog-assortment-generation`
- `catalog-product-generation`
- `catalog-image-front`
- `catalog-image-back`
- `catalog-image-on-model`
- `catalog-image-regeneration`
- `catalog-generation-qa`

## 6.2 Model selection

Model selection must be configurable server-side.

Available models shown by the current Labs environment include text models from Anthropic and OpenAI plus:

- `openai/gpt-image-1.5`
- `openai/gpt-image-2`
- `openai/text-embedding-3-small`

Recommended defaults for the first implementation:

```text
Text generation: openai/gpt-5.4-mini
Image generation: openai/gpt-image-2
Image fallback: openai/gpt-image-1.5
```

Do not hard-code the complete model inventory as permanently authoritative. If the existing Labs LLM module exposes the proxy's available models, use it. Otherwise add a server-side model-discovery helper around the LiteLLM `/v1/models` endpoint, following the existing authentication/attribution conventions.

At minimum, expose separate settings for:

- Catalog text model
- Image model
- Optional QA model

Image model selection must only offer image-capable models.

## 6.3 Budget protection

Generation can create many expensive image calls. Add safeguards:

- Show the expected number of images before starting a job.
- Require explicit confirmation for large jobs.
- Add a configurable per-job maximum product count.
- Store model name and generation timestamps for every asset.
- Track completed/failed image calls by job.
- Make jobs resumable.

Do not implement an exact monetary estimate unless reliable price metadata is available from the proxy or framework.

---

# 7. Catalog hierarchy and ID semantics

There are three externally meaningful identity levels.

## 7.1 Product ID

Represents the conceptual garment independent of color and size.

Example:

```text
PRE-W-000001
```

## 7.2 Style ID

Represents Product + Color.

Example:

```text
PRE-W-000001-IVY
```

All sizes for the Ivory version share this Style ID and share the same three generated images.

## 7.3 Variant ID

Represents Product + Color + Size, the deepest sellable level.

Example:

```text
PRE-W-000001-IVY-M
```

## 7.4 SKU

Keep a `sku` column for compatibility. For MVP, `sku` may equal `variant_id` unless the target importer requires a different convention.

Do not use database primary keys as external catalog identifiers. Use immutable generated IDs plus internal UUIDs/database IDs.

## 7.5 Stable ID generation

IDs must be deterministic from stored catalog sequence numbers and must never be reused.

Recommended catalog prefixes:

```text
PRE = Premium
FAS = Fast Fashion
LUX = Luxury
ACT = Activewear
```

Recommended department codes:

```text
W = Women
M = Men
```

Store a monotonically increasing `nextProductSequence` per catalog and update it transactionally when new products are reserved.

Color codes should be stable short slugs generated from a controlled color vocabulary, not arbitrary truncated AI text.

---

# 8. Product and variant strategy

## 8.1 MVP style count

Default to **one color style per Product ID** for the initial MVP to keep image generation cost manageable.

The data model must support multiple styles/colors per product later without schema changes.

If a future UI setting adds multiple colors, each additional color creates:

- a new Style ID
- three new images
- a new set of size Variant IDs

## 8.2 Sizes

Use deterministic size ranges based on department/category, not LLM-generated arbitrary sizes.

Suggested apparel defaults:

Women:

```text
XS, S, M, L, XL
```

Men:

```text
S, M, L, XL, XXL
```

If accessories are added later, use a controlled `ONE_SIZE` convention or category-specific sizing.

For MVP, prefer apparel categories and avoid footwear because shoe sizing adds unnecessary complexity.

## 8.3 Department balance

Every catalog must contain both Women and Men.

Allow the generation dialog to support:

- Auto distribution - default
- Women only
- Men only

For Auto distribution, use catalog-specific target ratios stored in the catalog profile, for example:

```text
Premium: 55% Women / 45% Men
Fast Fashion: 60% Women / 40% Men
Luxury: 55% Women / 45% Men
Activewear: 50% Women / 50% Men
```

These ratios are defaults, not validation constraints.

---

# 9. Core CSV schema

Export one row per Variant ID.

Required columns for the MVP:

```text
product_id
style_id
variant_id
sku
brand
name
description
department
category
subcategory
price
sale_price
currency
color
size
material
season
stock
availability
image_url_1
image_url_2
image_url_3
product_url
```

Column semantics:

| Column | Meaning |
| --- | --- |
| `product_id` | Parent garment/product identity |
| `style_id` | Product + color identity |
| `variant_id` | Product + color + size identity |
| `sku` | Sellable SKU; may equal Variant ID in MVP |
| `brand` | Synthetic brand for the catalog |
| `name` | Product name |
| `description` | Natural-language product description |
| `department` | `Women` or `Men` |
| `category` | Core category used by the source catalog |
| `subcategory` | More specific source taxonomy |
| `price` | Regular price |
| `sale_price` | Optional sale price; blank when not on sale |
| `currency` | `EUR` for MVP unless made configurable |
| `color` | Human-readable color name |
| `size` | Size for this variant row |
| `material` | Primary material/composition description |
| `season` | Synthetic collection/season marker |
| `stock` | Synthetic stock number |
| `availability` | e.g. `in_stock`, `out_of_stock` |
| `image_url_1` | Front product-only image; primary |
| `image_url_2` | Back product-only image |
| `image_url_3` | On-model image |
| `product_url` | Synthetic stable relative/absolute product URL |

Do not export advanced Labeller attributes from this generator.

CSV requirements:

- UTF-8
- deterministic column order
- RFC-compatible quoting
- decimal point `.` for numeric prices
- blank optional values rather than strings such as `null`
- stable IDs across repeated exports
- identical style image URLs repeated across all size variants of the style

Before finalizing the exporter, Codex must inspect the current Demoware CSV importer and align exact column naming with it. Preserve `image_url_1` as the primary image. If Demoware currently accepts later image columns untyped, keep `image_url_2` and `image_url_3` in the intended order.

---

# 10. Image requirements

Generate exactly three images per Style ID.

## 10.1 Front image - `image_url_1`

Purpose: primary PLP/PDP image.

Prompt requirements:

- garment alone
- front view
- full garment visible
- consistent neutral studio background for that catalog
- no person
- no hanger unless explicitly selected as part of the visual system
- no logo
- no text
- no watermark
- no props that obscure the product

Semantic role: `primary` / `front`.

## 10.2 Back image - `image_url_2`

Purpose: alternate PDP view.

Prompt requirements:

- same exact garment/color as front
- garment alone
- rear view
- same framing and studio background as front
- no person
- no text/logo/watermark

Semantic role: `alternate` / `back`.

## 10.3 On-model image - `image_url_3`

Purpose: lifestyle/PDP image.

Prompt requirements:

- adult model wearing the same exact garment/color
- department-appropriate styling
- garment clearly visible
- catalog-specific art direction
- no brand logo
- no text
- no watermark
- avoid additional garments that obscure the generated product

Semantic role: `on_model`.

## 10.4 Consistency strategy

Do not generate all three images as unrelated prompts.

For each Style ID:

1. Create a structured `visual_spec` containing silhouette, color, material appearance, closures, collar/neckline, sleeve length, hem, pockets, pattern, and distinctive details.
2. Generate the front image from the `visual_spec`.
3. Generate the back image from the same `visual_spec`, using the front image as a reference/input when supported by the image model/API.
4. Generate the on-model image from the same `visual_spec`, again using the front image as a reference/input when supported.
5. Store the exact prompts, model names, and generation metadata for reproducibility/debugging.

If the Labs LLM module does not yet expose reference-image editing, Codex should implement the smallest server-side extension consistent with the module rather than bypassing LiteLLM.

## 10.5 Image dimensions

Use portrait e-commerce images. Prefer a 3:4-ish output if supported by the selected image model.

Do not make dimensions a hardcoded business rule if the model API supports only specific sizes. Store the actual width/height and validate minimum quality.

---

# 11. Catalog creative profiles

Seed one prompt/assortment profile per catalog. Store these as structured data, not a single giant prompt string.

Each profile should define:

- segment name
- synthetic brand name
- price range
- department mix
- allowed categories/subcategories
- controlled color palette
- material vocabulary
- visual direction
- studio background direction
- on-model photography direction
- naming tone
- description tone
- default season

Example positioning:

## Premium

- contemporary premium
- polished neutral palette
- refined materials
- clean studio imagery
- restrained naming/copy

## Fast Fashion

- trend-led and accessible
- brighter colors
- seasonal shapes
- more energetic on-model images
- shorter commercial copy

## Luxury

- sophisticated and elevated
- premium material vocabulary
- minimal and editorial visual direction
- higher prices
- refined product names/copy

## Activewear

- technical performance + athleisure
- leggings, tops, shorts, jackets, training layers
- clean athletic studio look
- on-model images can imply movement but must clearly display the garment

Do not imitate a real fashion brand's logo, trademarks, or exact campaign style.

---

# 12. Assortment generation approach

Use a hybrid deterministic + generative approach.

## Deterministic application logic owns

- IDs
- product sequence numbers
- department allocation
- category quotas/distribution
- size variants
- stock quantities
- price validation
- sale-price rules
- currency
- color codes
- CSV structure
- filenames/storage keys

## LLM owns

- product name
- concise description
- specific design concept
- material wording within allowed vocabulary
- color selection within allowed palette
- visual specification

The LLM must return validated structured JSON, not prose that is parsed heuristically.

Use Zod or the framework's existing schema-validation pattern for model responses.

Generate in small batches to reduce cost and improve retry behavior.

---

# 13. Recommended application data model

Use the existing Prisma/PostgreSQL patterns. Exact names can be adapted to repo conventions.

## Catalog

Suggested fields:

```text
id
slug
name
segment
brandName
configJson
nextProductSequence
createdAt
updatedAt
```

Exactly four seeded rows.

## Product

```text
id                  internal DB ID
catalogId
productId           external stable ID, unique
name
description
department
category
subcategory
material
season
basePrice
salePrice
currency
productUrl
status
createdAt
updatedAt
```

## Style

```text
id
productId           FK to Product
styleId             external stable ID, unique
colorName
colorCode
visualSpecJson
status
createdAt
updatedAt
```

## Variant

```text
id
styleId             FK to Style
variantId           external stable ID, unique
sku                  unique
size
stock
availability
createdAt
updatedAt
```

## ImageAsset

```text
id
styleId
role                 FRONT | BACK | ON_MODEL
status               QUEUED | GENERATING | READY | FAILED
storageKey
publicUrl
width
height
model
prompt
referenceAssetId     nullable
errorMessage         nullable
createdAt
updatedAt
```

Unique constraint on `(styleId, role)`.

## GenerationJob

```text
id
catalogId
jobType              INITIAL | ADD_PRODUCTS | RETRY | REGENERATE_IMAGE
requestedProducts
requestedDepartmentMode
textModel
imageModel
status
stage
completedProducts
failedProducts
completedImages
failedImages
errorMessage
createdBy
createdAt
startedAt
finishedAt
```

## Optional GenerationTask

If needed for robust queue processing:

```text
id
generationJobId
entityType
entityId
taskType
status
attempts
lockedAt
lastError
createdAt
updatedAt
```

Only add this table if it materially simplifies resumable worker execution.

---

# 14. Background generation architecture

Do not generate a full catalog inside a single browser request.

Generation must be asynchronous/resumable because one catalog may require hundreds of model calls.

Codex must first inspect whether the Mapp Labs framework already has a background-job/worker pattern.

## Preferred order

1. Reuse an existing framework worker/job abstraction if present.
2. If none exists, implement a minimal Postgres-backed worker in the same codebase.
3. Do not add Redis solely for this MVP.
4. Do not introduce a separate microservice repository.

A minimal worker can:

- poll/claim queued jobs
- reserve product IDs transactionally
- create products/styles/variants
- generate images style-by-style
- persist progress after every item
- retry transient failures with bounded attempts/backoff
- mark permanent failures for manual retry

Keep concurrency low and configurable to respect model rate limits and budget.

Suggested local command if a custom worker is needed:

```text
npm run worker
```

Use the framework's existing deployment/IaC mechanism to run the worker in staging/production. Do not introduce a different infrastructure framework.

---

# 15. Image storage and public URLs

Generated images must survive application restarts and deployments.

Do not rely on ECS/container local disk in staging/production.

Codex must inspect existing object-storage patterns first. Prefer existing S3/storage helpers if present.

Recommended abstraction:

```text
GeneratedAssetStorage
  - put(...)
  - get(...)
  - delete(...)
  - getStablePublicUrl(...)
```

Development implementation may use local storage.

Staging/production should use persistent object storage.

Demoware needs fetchable image URLs. URLs written into the CSV must be stable and should not expire shortly after export.

Preferred secure MVP pattern:

- keep the storage bucket private
- expose generated synthetic assets through a narrow unauthenticated GET route using opaque asset IDs/keys
- serve only generated catalog media through this route
- do not expose directory listing

If the framework already has a safer/better static asset or CDN pattern, reuse it.

---

# 16. File naming

Use stable names derived from external IDs and roles.

Example:

```text
PRE-W-000001-IVY-front.webp
PRE-W-000001-IVY-back.webp
PRE-W-000001-IVY-model.webp
```

Storage keys should include catalog scope, for example:

```text
catalogs/premium/PRE-W-000001-IVY/front.webp
```

Never include user-supplied raw text directly in paths without slugification/validation.

---

# 17. UI proposal

Follow `docs/DESIGN-SYSTEM.md` and existing authenticated/admin patterns.

Do not invent a separate UI framework.

## Catalog list page

Four cards:

- Premium
- Fast Fashion
- Luxury
- Activewear

Each card displays:

- brand name
- Product count
- Style count
- Variant count
- Image count / failed image count
- last generation date
- current job status

Actions:

- Open catalog
- Add products
- Download CSV

## Catalog detail page

Sections:

1. Summary
2. Product grid/table
3. Generation jobs
4. Settings

Product preview should show:

- product name
- Product ID
- Style ID
- department/category
- color
- price
- front image
- back image
- on-model image
- generation status

Actions:

- Regenerate front
- Regenerate back
- Regenerate on-model
- Retry failed generation

## Add products dialog

Fields:

- amount: integer
- department: Auto / Women / Men
- text model: default from app setting, optionally override
- image model: default from app setting, optionally override

Before submit show:

```text
Products to add: N
Styles to create: N (MVP default one style/product)
Images to generate: N * 3
Expected variant rows: based on generated department/category sizes
```

Require confirmation for large jobs.

---

# 18. Product generation flow

For a job requesting N products:

## Stage A - Plan assortment

Application deterministically calculates target counts by:

- department
- category/subcategory
- catalog profile

Avoid asking the LLM to decide the entire distribution freely.

## Stage B - Generate product specs

Generate structured product specifications in small batches.

Example internal shape:

```json
{
  "department": "Women",
  "category": "Knitwear",
  "subcategory": "Cardigans",
  "name": "Elara Ribbed Cardigan",
  "description": "...",
  "material": "Cotton blend",
  "color": "Ivory",
  "design": {
    "silhouette": "relaxed",
    "neckline": "v-neck",
    "sleeves": "long sleeves",
    "closure": "tonal buttons",
    "pattern": "ribbed",
    "details": ["wide cuffs", "straight hem"]
  }
}
```

Validate against controlled vocabularies where appropriate.

## Stage C - Create IDs, styles and variants

Reserve Product IDs in the database.

Create one Style ID/color per product for MVP.

Generate deterministic variants/sizes.

## Stage D - Generate front image

Generate and persist the front image first.

## Stage E - Generate back image

Use the same visual spec and front image as reference when possible.

## Stage F - Generate on-model image

Use the same visual spec and front image as reference when possible.

## Stage G - Validate

Validate:

- all required fields
- all IDs unique
- price rules
- style/variant relationships
- all image files available
- correct image role count
- image URLs resolvable

## Stage H - Mark product ready

A Product is exportable only when its Style has all required images and valid variants.

Failed products remain visible for retry and must not silently disappear.

---

# 19. Price and inventory rules

Use deterministic rules per catalog profile.

Example price bands:

```text
Premium:      EUR 60 - 350
Fast Fashion: EUR 12 - 89
Luxury:       EUR 250 - 2500
Activewear:   EUR 25 - 180
```

Do not allow the LLM to emit arbitrary out-of-range prices.

Sale rules:

- sale price is optional
- sale price must be lower than regular price
- use configurable probability by catalog

Inventory:

- generated deterministically/randomly from configured safe ranges
- stock >= 0
- `availability = out_of_stock` when stock == 0
- otherwise `availability = in_stock`

Use a seeded random generator where practical so test fixtures are reproducible.

---

# 20. Export behavior

## CSV

Generate the CSV from persisted database records, not directly from an LLM response.

Only export records whose required core data is valid.

Default export behavior should include READY products and visibly report any excluded failed/incomplete products.

Provide a validation summary alongside download:

```text
Products exported
Styles exported
Variants/rows exported
Images referenced
Incomplete products excluded
```

## Optional ZIP

Provide an optional archive containing:

```text
catalog.csv
images/
manifest.json
validation-report.json
```

The CSV inside the archive can still use hosted absolute image URLs for Demoware compatibility.

---

# 21. Demoware compatibility

Before implementing the final CSV adapter, Codex must inspect the current Demoware importer or its latest documented schema if that code is available in the repository/workspace.

Known compatibility requirements to preserve:

- `image_url_1` is the primary image.
- Later image URL columns should remain in source order unless the importer has a semantic-role mechanism.
- The intended mapping for this generator is:
  - `image_url_1` = front / primary
  - `image_url_2` = back / alternate
  - `image_url_3` = on-model

The Demoware Labeller runs after import and remains the source of advanced enriched attributes.

Do not couple this generator to Demoware's database directly. The integration contract is the exported CSV plus fetchable images unless a later requirement explicitly changes this.

---

# 22. Validation and QA

## Automated data validation

Must cover:

- required fields
- unique `product_id`
- unique `style_id`
- unique `variant_id`
- unique `sku`
- Style belongs to correct Product
- Variant belongs to correct Style
- department values limited to Men/Women
- valid category/subcategory values for profile
- valid sizes
- price > 0
- sale_price < price when present
- valid currency
- non-negative stock
- exactly three required image roles per ready Style
- image URLs present for exports

## Image technical validation

Validate:

- image file decodes successfully
- minimum dimensions
- allowed MIME type
- no empty/zero-byte files

## Image semantic QA

MVP requirement:

- human review in the app
- per-image regenerate action

Optional later enhancement:

- use a multimodal model to compare image vs visual spec and detect severe mismatches

Do not make automatic multimodal QA a blocker for MVP unless it is straightforward with the existing Labs LLM module.

---

# 23. Error handling and retries

Every model call should have:

- bounded retries for transient errors
- exponential/backoff behavior using existing framework helper if available
- persisted failure reason
- no infinite loops

A failed back/on-model image must not regenerate the already-approved front image unless explicitly requested.

Regeneration replaces the active ImageAsset for that role but should retain enough metadata/history to diagnose previous attempts if easy to support.

At minimum, log:

- job ID
- catalog
- Product ID / Style ID
- feature name
- model
- role
- attempt
- failure category

Never log API keys or sensitive headers.

---

# 24. Security requirements

- LLM key is server-side only.
- Use existing Mapp auth/permissions.
- Catalog-management UI is authenticated internal UI.
- Public image route, if required, must expose only synthetic generated assets and use opaque unguessable asset references.
- Sanitize CSV fields and filenames.
- Prevent CSV formula injection for any field beginning with `=`, `+`, `-`, or `@` if content could be opened in spreadsheet software.
- Apply existing CSRF/rate-limit patterns for mutation routes.
- No raw provider credentials.

---

# 25. Testing requirements

Use the repository's existing testing stack and commands.

## Unit tests

Cover at least:

- external ID generation
- non-reuse of sequence numbers
- Product -> Style -> Variant hierarchy
- size generation
- department allocation
- price/sale rules
- stock/availability rules
- CSV flattening and column order
- CSV injection sanitization
- image filename generation
- prompt builder snapshots or structured assertions

## Integration tests

Use mocked LLM/image adapters to test:

- generating a small job
- retrying one failed image
- appending products to an existing catalog
- resuming an interrupted job
- producing a valid CSV with repeated style image URLs across sizes

## UI/E2E tests where framework supports them

Validate:

- catalog cards render
- Add Products form validates amount
- job progress updates
- product preview shows all three image roles
- CSV download succeeds

Before declaring a phase complete, run the framework-prescribed checks such as `make dev-check-all` and relevant tests if those commands are present in this repository.

---

# 26. Implementation phases

Codex must stop at the end of each phase, report validation, and wait for approval before proceeding to the next phase unless explicitly told otherwise.

## Phase 0 - Repository discovery

No code changes.

Deliver:

- framework reuse plan
- capability status
- existing LLM/image support assessment
- storage pattern assessment
- worker/job pattern assessment
- proposed file change map
- risks/questions

## Phase 1 - Project configuration and data model

Implement:

- LLM capability enablement if not already enabled
- four catalog profile seeds/configuration
- Prisma data model
- migration
- ID generation utilities
- unit tests

No real model calls yet.

Acceptance:

- database migration applies locally
- exactly four catalog profiles available
- ID hierarchy tests pass

## Phase 2 - Catalog generation domain logic

Implement:

- assortment planner
- deterministic price/stock/size rules
- structured product generation interface
- mock AI provider
- persisted Products/Styles/Variants
- generation job state machine

Acceptance:

- a mocked job can append products without ID collisions
- job is resumable in tests

## Phase 3 - LiteLLM text generation

Implement:

- product spec prompt builder
- structured response validation
- real Labs LLM adapter through existing `src/modules/llm` pattern
- model settings
- retry/error handling

Acceptance:

- small real generation produces valid structured products
- no provider key bypass
- spend attribution follows Labs conventions

## Phase 4 - Image generation and persistent storage

Implement:

- image API support through Labs LiteLLM pattern
- front/back/on-model prompt builders
- reference-image flow when supported
- persistent storage adapter
- stable public/fetchable URLs
- ImageAsset persistence
- per-image regeneration

Acceptance:

- one Style produces three accessible images
- back and on-model generation can use front reference when model/API supports it
- assets survive app restart/deploy environment pattern

## Phase 5 - Background worker and progress

Implement/reuse:

- worker execution model
- job claiming
- progress counters
- retries
- cancellation only if existing patterns make it straightforward

Acceptance:

- a 5-product test job completes without keeping one HTTP request open for the full job
- refreshing UI does not lose job state

## Phase 6 - Catalog UI

Implement:

- four catalog overview cards
- detail page
- Add Products dialog
- generation progress
- product/image preview
- retry/regenerate controls
- model selection/settings if approved

Acceptance:

- internal user can add N products to a catalog end-to-end

## Phase 7 - CSV export and Demoware validation

Implement:

- final Demoware CSV adapter
- validation summary
- CSV download
- optional ZIP archive if still desired

Run an import against Demoware staging with a small catalog.

Acceptance:

- Product ID, Style ID, Variant ID semantics remain intact
- primary image is front
- second image is back
- third image is on-model
- Demoware importer accepts the file
- images are fetchable by Demoware
- Labeller can run after import

## Phase 8 - Hardening and full generation

Implement/finalize:

- missing QA cases
- clearer failure recovery
- generation limits
- full validation
- operational documentation

Then generate a small approved sample from each of the four catalog profiles before running large batches.

Do not launch the full 4-catalog generation until samples have been manually approved.

---

# 27. MVP acceptance criteria

The MVP is complete when all of the following are true:

1. Four catalog profiles exist: Premium, Fast Fashion, Luxury, Activewear.
2. Every profile supports both Women and Men.
3. User can add an arbitrary positive number of products, subject to configured job limits.
4. Existing products are not overwritten when new products are added.
5. Each Product has a stable Product ID.
6. Each product color has a stable Style ID.
7. Each size has a unique Variant ID.
8. Each Style has exactly three usable images: front, back, on-model.
9. Generated images have stable URLs that Demoware can fetch.
10. CSV has one row per Variant ID and includes all required core columns.
11. `image_url_1/2/3` map to front/back/on-model.
12. CSV imports successfully into Demoware staging.
13. Demoware Labeller can enrich the imported products.
14. Failed images can be retried independently.
15. Model calls use the Mapp LiteLLM proxy with proper Labs attribution.
16. No model/provider secret is exposed to the browser.
17. Generation jobs are resumable and observable.
18. Relevant repository tests/typechecks/lint checks pass.

---

# 28. Explicit non-goals for MVP

Do not build these unless separately approved:

- customer/prospect catalog scraping
- UPC ingestion
- Demoware FLA replacement
- recommendation generation
- outfit generation
- behavioral/customer event generation
- order simulation
- real-time inventory
- automatic Shopify/Magento publishing
- support for arbitrary user-created catalog segments
- footwear sizing
- multiple color styles per product by default
- complex image similarity scoring
- public third-party API

---

# 29. Key implementation principles

1. Reuse the Mapp Labs framework instead of recreating framework services.
2. Use `src/modules/llm` and LiteLLM, never raw provider keys.
3. Keep AI outputs structured and schema-validated.
4. Keep IDs, variants, prices, stock, and CSV generation deterministic.
5. Generate images per Style, not per size Variant.
6. Persist after every meaningful generation step.
7. Make retries granular.
8. Treat images as first-class persisted assets.
9. Keep Demoware integration file-based: CSV + fetchable images.
10. Let the Demoware Labeller own enrichment.
11. Start with tiny sample jobs and only then scale to full catalog generation.
12. Prefer simple, observable architecture over unnecessary microservices.

---

# 30. Decisions Codex must not silently make

Codex should stop and ask before:

- introducing Redis or another new infrastructure dependency
- introducing a new cloud/IaC framework
- making generated media broadly public instead of using a narrow asset-serving mechanism
- changing the Demoware importer
- changing the Labeller workflow
- generating multiple colors per product by default
- changing the core CSV field names
- running a large/expensive generation job
- deploying to staging or production
- committing/pushing changes unless explicitly asked

---

# 31. Final deliverables from the implemented app

For each of the four catalogs the application must ultimately be able to produce:

```text
catalog.csv
images/
  <style-id>-front.webp
  <style-id>-back.webp
  <style-id>-model.webp
  ...
manifest.json        optional but recommended
validation-report.json optional but recommended
```

The CSV should normally reference the hosted HTTPS versions of the images rather than local archive-relative paths so the same CSV can be imported directly into Demoware.

