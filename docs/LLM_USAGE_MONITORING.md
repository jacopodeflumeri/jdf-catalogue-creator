# LiteLLM Usage Monitoring

## What it does

The app records a local, admin-facing cost estimate for every successful non-streaming
LiteLLM text completion and image response. LiteLLM remains the authoritative source
for billing, budgets, and spend enforcement; this table is an operational view for this
application only.

Tracking starts when migration `20261022120000_llm_usage_tracking` is deployed. Calls
made before that point are not backfilled.

## How cost is calculated

Pricing is defined in `src/modules/llm/lib/pricing.ts` and snapshotted onto every usage
row so a later price update does not rewrite historical estimates. Prices were checked
against the OpenAI model and image-generation documentation on 2026-10-22.

- `openai/gpt-5.4-mini`: token usage, including the separate cached-input rate.
- `openai/gpt-image-2`: text input, image input, and image output token rates when the
  response contains usage. If usage is absent, the official per-image output estimate
  for the requested size and quality is used.
- `openai/gpt-image-1.5`: the same strategy. This model is deprecated and scheduled to
  shut down on 2026-12-01.
- Unknown models are recorded as `UNPRICED`; the app never invents a rate.

`CATALOG_ESTIMATE` rows cover image output only and can exclude prompt/reference-image
input cost. Regional processing uplifts, proxy markups, negotiated pricing, retries that
return no usable response, and calls made outside this app are not represented. Reconcile
material discrepancies against LiteLLM spend logs.

## Data model

`LlmUsage` stores model, feature, operation, token counts, estimated USD cost, calculation
basis, raw usage, pricing snapshot, request ID, and timestamp. Indexes support filtering
by time, model, feature, and operation. Tracking writes are best-effort: a database or
monitoring failure is logged but never fails catalog generation.

## Key files

- `src/modules/llm/lib/pricing.ts` — rate registry and pure cost calculations.
- `src/modules/llm/lib/usage-recorder.ts` — non-blocking persistence.
- `src/modules/llm/lib/client.ts` — completion instrumentation.
- `src/modules/llm/lib/images.ts` — image generation/edit instrumentation.
- `prisma/schema.prisma` — `LlmUsage` and cost/operation enums.

## Decisions

- **2026-10-22 — Preserve Mapp attribution.** Calls still use `buildBillingParams`; local
  monitoring observes responses and does not replace LiteLLM spend metadata.
- **2026-10-22 — Snapshot prices.** Each row retains the exact rate table used at call
  time so historical totals remain stable.
- **2026-10-22 — Fail open for monitoring only.** Generation is the business operation;
  monitoring persistence must not turn a successful paid call into a failed job.

## Pitfalls

- Update rates and the effective date when models or vendor prices change.
- Do not present local totals as invoices. They are estimates, even when based on exact
  response token counts.
- Streaming calls continue to be attributed in LiteLLM but are not currently persisted
  locally because their usage arrives on the final stream chunk.
