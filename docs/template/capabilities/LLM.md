# LLM (LiteLLM Proxy)

**Type:** Optional
**Module:** `src/modules/llm/`
**Dependencies:** None
**npm packages:** `openai` (installed with the template)

## Overview

All Mapp Labs apps that make LLM calls must route through the shared **LiteLLM proxy** at `https://llm-proxy.labs.mapp.com`. The proxy sits between your app and LLM providers (OpenAI, Anthropic) and provides:

- **Virtual key management** — one proxy key per app instead of raw provider keys
- **Spend tracking** — every call is attributed to an app, environment, feature, and optionally a customer
- **Budget controls** — per-app and per-customer spend limits
- **Model routing** — switch providers without changing app code

Your app never holds provider API keys directly. The proxy holds them; your app only needs a LiteLLM virtual key.

The proxy is the **source of truth** for LLM spend tracking, attribution, and budget enforcement — every call's cost and billing subject come from the proxy's spend logs, not from your app.

> ⚠️ **Streaming calls require `stream_options: { include_usage: true }`.** Without it, the streaming response carries no token counts, the call never reaches LiteLLM's spend logs, and the cost is silently untracked. See [Streaming and Usage Tracking](#streaming-and-usage-tracking) before you ship any `stream: true` call.

## Quick Start

### 1. Get a Virtual Key

Create a LiteLLM virtual key at the **self-service key portal** — anyone at Mapp can create as many keys as they need, no ticket required:

**https://infra-tools.deproxy.muc.domeus.com/ai-keys/gptkeyreq.php**

Virtual keys look like this:

```
sk-RkCHQTSWBblz7qcIN3lUFg
```

If your key starts with `sk-ant-` (Anthropic) or `sk-proj-` (OpenAI), that's a **raw provider key**, not a LiteLLM virtual key. Do not use raw provider keys — create a virtual key at the portal instead.

> 💰 **Each key has a default budget of $50/month.** When a key reaches that cap, calls on it start failing with `429` until the budget resets or is raised — this applies everywhere the key is used (local testing, staging, **and** production). Raising the cap is **not** self-service: file an **ITHELPDESK ticket** to increase the limit on the specific key.

### 2. Set Environment Variables

Add to your `.env`:

```env
LITELLM_API_KEY=sk-your-virtual-key-here
LITELLM_BASE_URL=https://llm-proxy.labs.mapp.com
APP_PRODUCT=fashion    # or engage, intelligence, internal
```

`APP_NAME` is already set by the template's setup script. `APP_PRODUCT` identifies which Mapp product your app belongs to.

### 3. Make Your First Call

```typescript
import { llmCompletion, MODELS } from '@/modules/llm';

const response = await llmCompletion({
  model: MODELS.SONNET,
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello!' },
  ],
  feature: 'chat',
});

console.log(response.choices[0].message.content);
```

That's it. Billing attribution, spend metadata, and proxy routing are handled automatically.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `LITELLM_API_KEY` | Yes | Virtual key from LiteLLM proxy (create one at the [self-service key portal](https://infra-tools.deproxy.muc.domeus.com/ai-keys/gptkeyreq.php)) |
| `LITELLM_BASE_URL` | Yes | Proxy URL: `https://llm-proxy.labs.mapp.com` |
| `APP_NAME` | Yes | Your app name (already set by setup script) |
| `APP_PRODUCT` | Yes | Mapp product: `fashion`, `engage`, `intelligence`, or `internal` |

## Module API

### `llmCompletion(params)` — Primary API

The main way to make LLM calls. Handles all billing and metadata automatically.

```typescript
import { llmCompletion, MODELS } from '@/modules/llm';

// Simple call (internal / no customer context)
const response = await llmCompletion({
  model: MODELS.HAIKU,
  messages: [{ role: 'user', content: 'Classify this text.' }],
  feature: 'text-classification',
  temperature: 0,
  response_format: { type: 'json_object' },
});

// Customer-attributed call. The attribution keys are the CLIENT-CATALOG
// company id and workspace id — resolve them from the session with
// resolveUsageAttribution() (see Billing Attribution below). Do NOT pass the
// local Account.id.
const { companyId, workspaceId } = await resolveUsageAttribution(session, {
  workspaceId: workspace.id,
});

const response = await llmCompletion({
  model: MODELS.SONNET,
  messages: [
    { role: 'system', content: 'Generate an email subject line.' },
    { role: 'user', content: briefing },
  ],
  feature: 'email-subject-gen',
  accountId: companyId ?? undefined,   // client-catalog company id
  brandId: workspaceId ?? undefined,   // client-catalog workspace id
});
```

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `model` | `string` | Yes | Model name from `MODELS` constant |
| `messages` | `ChatCompletionMessageParam[]` | Yes | OpenAI-format messages array |
| `feature` | `string` | Yes | Feature identifier (lowercase, hyphenated) |
| `accountId` | `string \| number` | No | **Client-catalog company id** — the `companyId` from `resolveUsageAttribution()` / the Company Login session, **not** the local `Account.id`. Tags the call to a customer. See [Billing Attribution](#billing-attribution). |
| `brandId` | `string \| number` | No | **Client-catalog workspace id** — the `workspaceId` from `resolveUsageAttribution()`. |
| `temperature` | `number` | No | Sampling temperature (0-2) |
| `max_tokens` | `number` | No | Maximum tokens to generate |
| `max_completion_tokens` | `number` | No | Maximum completion tokens (newer API param) |
| `response_format` | `{ type: 'json_object' \| 'text' }` | No | Constrain response format |
| `stream` | `boolean` | No | Stream the response. Returns an async-iterable stream instead of a single response |
| `stream_options` | `{ include_usage?: boolean }` | No | **Required when `stream: true`** — set `{ include_usage: true }` so usage is tracked. See [Streaming and Usage Tracking](#streaming-and-usage-tracking) |

**Returns:** Standard OpenAI `ChatCompletion` response object — or, when `stream: true`, an async-iterable stream of `ChatCompletionChunk`s.

### `getLLMClient()` + `buildBillingParams()` — Advanced API

For streaming, tool-use loops, or other advanced scenarios where you need the raw OpenAI client.

```typescript
import { getLLMClient, buildBillingParams, MODELS } from '@/modules/llm';

const client = getLLMClient();
const billing = buildBillingParams({
  feature: 'chat-tool-use',
  accountId: 42,
  brandId: 7,
});

// Streaming example
const stream = await client.chat.completions.create({
  model: MODELS.SONNET,
  messages: conversationHistory,
  stream: true,
  stream_options: { include_usage: true }, // REQUIRED — see "Streaming and Usage Tracking"
  ...billing,
} as any);

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || '');
}
```

`buildBillingParams()` returns the `user` and `metadata` fields that the proxy requires. You spread them into any raw client call.

> ⚠️ `stream_options: { include_usage: true }` is **mandatory** on every streaming call (raw client or `llmCompletion`). Omitting it produces no spend log. See [Streaming and Usage Tracking](#streaming-and-usage-tracking).

## Streaming and Usage Tracking

When you stream a response (`stream: true`), the client **MUST** include
`stream_options: { include_usage: true }`. This applies whether you use
`llmCompletion()` or the raw client from `getLLMClient()`.

```typescript
import { llmCompletion, MODELS } from '@/modules/llm';

const stream = await llmCompletion({
  model: MODELS.SONNET,
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: userPrompt },
  ],
  feature: 'chat',
  accountId: companyId ?? undefined,   // client-catalog company id (see Billing Attribution)
  brandId: workspaceId ?? undefined,   // client-catalog workspace id
  stream: true,
  stream_options: { include_usage: true }, // ← REQUIRED for spend tracking
});

let text = '';
for await (const chunk of stream) {
  // Content arrives incrementally on each chunk's delta.
  text += chunk.choices[0]?.delta?.content ?? '';

  // With include_usage, the proxy appends a final chunk that carries the
  // token counts. It has an empty `choices` array, so always guard on
  // `delta` (as above) before reading content.
  if (chunk.usage) {
    // { prompt_tokens, completion_tokens, total_tokens }
    // This usage object is what LiteLLM records as spend.
  }
}
```

### What breaks without `include_usage`

A streaming call *without* `stream_options: { include_usage: true }` still
returns content and looks like it worked. But:

- The final chunk contains **no token counts**, so the proxy has nothing to
  meter.
- The call is **missing from LiteLLM spend logs** entirely.
- Spend can't be attributed to the billing subject — neither
  `company:{companyId}:brand:{brandId}` (customer calls) nor
  `internal:{product}:{app}:{feature}` (internal calls).
- The call **won't appear in usage dashboards**, and won't flow to Lago once
  metering is live.

The failure is silent: nothing errors, nothing logs a warning — the spend just
never shows up. That makes it easy to ship and only discover months later when
a customer's usage doesn't reconcile.

### Non-streaming calls are unaffected

Standard (non-streaming) completions always return a `usage` object in the
response, so they are tracked correctly with no extra options. You only need
`stream_options` when `stream: true`.

> **Why this is not optional.** The LLM client is built on a *"fail loudly, no
> untracked calls"* principle — there is deliberately no fallback to direct
> provider calls, so when the proxy is down the call fails visibly (see
> [Error Handling](#error-handling)). A streaming call without `include_usage`
> is the silent inverse of that contract: it succeeds, returns text, and looks
> healthy while producing **no spend log at all**. Setting
> `stream_options: { include_usage: true }` is what keeps streaming honest —
> treat it as mandatory, not a tuning knob.

## Image Generation

`llmCompletion()` is chat-only. Image generation still routes through the same
proxy and virtual key, so it **must carry the same billing attribution** — drop
to the raw client and spread in `buildBillingParams()`:

```typescript
import { getLLMClient, buildBillingParams } from '@/modules/llm';

const client = getLLMClient();
const billing = buildBillingParams({
  feature: 'hero-image-gen',
  accountId: companyId ?? undefined,   // client-catalog company id
  brandId: workspaceId ?? undefined,   // client-catalog workspace id
});

const result = await client.images.generate({
  model: 'openai/gpt-image-1.5',
  prompt: 'A minimalist product banner for a summer campaign',
  ...billing,                          // same user + spend_logs_metadata as chat
} as any);
```

Two spend-tracking rules specific to images:

- **Never stream image generation.** Image streaming (`partial_images`) errors
  out through the proxy — a known, unfixable upstream limitation — and a failed
  stream leaves no clean spend log. Always request images non-streaming.
- **Allow up to 240s.** Image models routinely exceed the 60s a chat call
  allows; the proxy waits up to 240s. Don't add a short client-side timeout that
  cuts the request off before it completes and is metered.

## Prompt Caching and Spend

You can use [Anthropic prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)
through the proxy to cut cost on repeated context (large system prompts, long
documents, tool definitions). Add `cache_control` blocks to your messages exactly
as you would calling Anthropic directly — the proxy forwards them unchanged and
injects the required beta header. Cache activity is recorded in the spend logs as
`cache_creation_input_tokens` (written to cache, billed at a premium) and
`cache_read_input_tokens` (cache hits, ~10% of the input rate).

- **Non-streaming:** nothing extra to do — cache usage is always returned and metered.
- **Streaming:** keep `stream_options: { include_usage: true }` (you already
  must — see above). The cached-token counts ride in on that same final usage
  chunk; without it you lose both the call's spend *and* its cache accounting.

## Model Constants

Import `MODELS` instead of hardcoding model strings. When models change, this is a single-file update.

```typescript
import { MODELS } from '@/modules/llm';
```

| Constant | Value | Use Case |
|----------|-------|----------|
| `MODELS.OPUS` | `anthropic/claude-opus-4-8` | Most capable, complex reasoning (latest Opus) |
| `MODELS.OPUS_4_7` | `anthropic/claude-opus-4-7` | Previous-generation Opus |
| `MODELS.OPUS_4_6` | `anthropic/claude-opus-4-6` | Older Opus |
| `MODELS.SONNET` | `anthropic/claude-sonnet-4-6` | Balanced performance and cost |
| `MODELS.HAIKU` | `anthropic/claude-haiku-4-5-20251001` | Fast/cheap, structured output |
| `MODELS.GPT_5_5` | `openai/gpt-5.5` | Most capable OpenAI model |
| `MODELS.GPT_5_5_MINI` | `openai/gpt-5.5-mini` | Balanced OpenAI model |
| `MODELS.GPT_5_5_NANO` | `openai/gpt-5.5-nano` | Cheapest OpenAI model |
| `MODELS.GPT_5_4` | `openai/gpt-5.4` | Previous-gen full model |
| `MODELS.GPT_5_4_MINI` | `openai/gpt-5.4-mini` | Previous-gen balanced model |
| `MODELS.GPT_5_4_NANO` | `openai/gpt-5.4-nano` | Previous-gen cheapest model |
| `MODELS.GPT_4O` | `openai/gpt-4o` | Older-gen full model |
| `MODELS.GPT_4O_MINI` | `openai/gpt-4o-mini` | Older-gen fast/cheap model |

All model names use the `provider/model` format required by LiteLLM routing. The proxy is the source of truth for what's routable — query `GET https://llm-proxy.labs.mapp.com/v1/models` with your key to confirm the current list.

## Billing Attribution

Every LLM call is tagged with a billing subject and metadata for spend tracking.

### Where the attribution IDs come from

Customer attribution keys off the **client-catalog company id** (and, when the
action is workspace-scoped, the **client-catalog workspace id**) — *not* your
app's local `Account.id`. In the company-context model these are the `companyId`
/ `workspaceId` returned by `resolveUsageAttribution(session, { workspaceId })`
(see [Company Login → Usage attribution](./COMPANY_LOGIN.md#usage-attribution)).
Pass them straight through as `accountId` / `brandId`:

```typescript
import { resolveUsageAttribution } from '@/modules/auth/server';
import { llmCompletion, MODELS } from '@/modules/llm';

const { companyId, workspaceId } = await resolveUsageAttribution(session, {
  workspaceId: ws?.id ?? null,
});

await llmCompletion({
  model: MODELS.SONNET,
  messages,
  feature: 'email-subject-gen',
  accountId: companyId ?? undefined,   // client-catalog company id
  brandId: workspaceId ?? undefined,   // client-catalog workspace id
});
```

> ⚠️ The `accountId` parameter name is historical — it must receive the
> client-catalog **company id**, which is a different number from the local
> `Account.id`. Passing the local account id mis-attributes spend to the wrong
> (or a non-existent) customer. Apps with the Client Catalog capability can also
> read the same value from `Account.clientCatalogCompanyId`; either way it is the
> catalog company id that lands in the `user` field and the `company_id`
> spend-log metadata. Internal calls (no customer) omit both — see below.

### How the `user` field works

The `user` field on each request identifies who to bill:

- **Customer calls** (when `accountId` is provided):
  ```
  company:{accountId}:brand:{brandId}
  ```
  Example: `company:42:brand:7`

- **Internal calls** (no customer context):
  ```
  internal:{product}:{app}:{feature}
  ```
  Example: `internal:fashion:my-app:trend-analysis`

### Spend metadata

Every call also carries `spend_logs_metadata` with these fields:

| Field | Source | Example |
|-------|--------|---------|
| `app` | `APP_NAME` env var | `"my-app"` |
| `environment` | `NEXT_PUBLIC_ENVIRONMENT` or `NODE_ENV` | `"staging"` |
| `feature` | Caller-provided | `"email-subject-gen"` |
| `user` | Constructed (see above) | `"company:42:brand:7"` |
| `company_id` | Client-catalog company id, from `accountId` (when provided) | `"42"` |
| `brand_id` | Client-catalog workspace id, from `brandId` (when provided) | `"7"` |

This metadata enables spend reports sliced by app, environment, feature, and customer.

### The `feature` parameter

The `feature` string identifies what part of your app made the call. It should be:

- **Lowercase and hyphenated**: `"email-subject-gen"`, `"chat-synthesis"`, `"trend-analysis"`
- **Descriptive**: someone reading the spend report should understand what it does
- **Consistent**: use the same feature name for the same functionality across calls

Examples:
- `"text-summarization"` — a route that summarizes user-provided text
- `"email-subject-gen"` — generating email subject lines for campaigns
- `"chat-synthesis"` — the final synthesis pass in a multi-step chat pipeline
- `"intent-parsing"` — classifying user intent from a chat message

## Local Development

Local development uses the same LiteLLM proxy as staging and production. There is no local proxy or mock — you need a real virtual key even for local dev.

The environment is tracked via `NEXT_PUBLIC_ENVIRONMENT` (set to `development` in your `.env`), so local dev spend is attributed separately from staging/production in the proxy's spend reports.

## Deployment

### SSM Parameters

When deploying to staging or production, add these parameters to AWS SSM Parameter Store:

```bash
# Added by: make staging-ssm-setup (or make prod-ssm-setup)
/{app-name}-stg/LITELLM_API_KEY      # Your virtual key
/{app-name}-stg/LITELLM_BASE_URL     # https://llm-proxy.labs.mapp.com
```

The CDK stack includes commented-out secret mappings in `infra/lib/stack.ts`. Uncomment them when enabling this capability.

### APP_PRODUCT and environment in deployment

`APP_PRODUCT` is set automatically as a plain environment variable in the ECS
task definition, sourced from the `product` field in `app.config.json` (which
`scripts/setup.sh` prompts for). It also drives the AWS `Product` cost-allocation
tag, so the two never drift. To change it, edit `product` in `app.config.json`
and redeploy — you don't touch `infra/lib/stack.ts`.

`NEXT_PUBLIC_ENVIRONMENT` is also injected automatically (`staging` /
`production`) so the `environment` field in your LiteLLM spend logs matches the
AWS `Environment` tag. Previously this fell back to `NODE_ENV` (always
`production`), which mislabeled staging spend. See
[docs/template/COST_ALLOCATION.md](../COST_ALLOCATION.md) for how AWS tags reconcile
against LiteLLM spend metadata.

## Spend-Tracking Checklist

Before shipping any code path that calls the proxy:

- [ ] Using a LiteLLM **virtual key** (`sk-…`) pointed at `LITELLM_BASE_URL` — never a raw provider key or a direct provider URL.
- [ ] `APP_NAME` and `APP_PRODUCT` are set, and every call passes a descriptive `feature`.
- [ ] Customer calls pass the **client-catalog** company/workspace id (`accountId`/`brandId`) from `resolveUsageAttribution()` — **not** the local `Account.id`. Internal calls omit both and fall back to the `internal:{product}:{app}:{feature}` subject.
- [ ] `environment` is correct per deploy (`development` / `staging` / `production`).
- [ ] Every streaming call (`stream: true`) also sets `stream_options: { include_usage: true }` — without it the call produces **no spend log**.
- [ ] Image-generation calls are **non-streaming**, allow up to 240s, and carry `buildBillingParams()`.
- [ ] No fallback to direct provider calls — if the proxy is down, the call fails visibly.

## Error Handling

If the proxy is unreachable or returns an error, `llmCompletion()` throws the standard OpenAI SDK error. There is no fallback to direct provider calls — if the proxy is down, your app should surface the error so the issue is visible.

Common errors:

| Error | Cause | Fix |
|-------|-------|-----|
| `401 Unauthorized` | Invalid or expired virtual key | Create a new key at the [self-service key portal](https://infra-tools.deproxy.muc.domeus.com/ai-keys/gptkeyreq.php) |
| `429 Rate Limited` | Budget ($50/month default cap) or rate limit exceeded | If it's the budget cap, file an ITHELPDESK ticket to raise the key's limit; otherwise back off and retry |
| `Connection refused` | Proxy unreachable | Check proxy status, VPN connection |

## Example Use Cases

- **Email subject generation** — generate subject lines for marketing campaigns, attributed to the customer account
- **Text summarization** — summarize long documents for internal use
- **Chat synthesis** — multi-step chat pipeline with intent parsing (Haiku) and response generation (Sonnet)
- **Content classification** — classify user-submitted content into categories using structured output
- **Data extraction** — extract structured data from unstructured text with JSON response format

## Reference

- **LiteLLM Proxy**: `https://llm-proxy.labs.mapp.com`
- **Reference implementation**: FTL app (`labs-trends` repo, `src/modules/knowledge_graph/chat/llm-client.ts`)
- **LiteLLM docs**: https://docs.litellm.ai/
