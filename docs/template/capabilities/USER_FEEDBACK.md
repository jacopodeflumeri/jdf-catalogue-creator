# User Feedback

**Type:** Optional
**Module:** `src/modules/user_feedback/` (UI ships as a copy-in scaffold under `scaffold/`)
**Dependencies:** None
**npm:** `@notionhq/client`

## Overview

A floating **Feedback** button, available to every authenticated user, opens a
small modal where they pick a category (report issue / request feature / give
feedback), optionally rate their experience, and leave a comment. Each
submission is written straight to a **shared Notion "App Feedback" database** —
that Notion database is the system of record. **There is no Prisma model and no
database migration.**

The design center is *lightweight and safe by default*:

- **No LLM runs in the app.** The submit path writes one `pending` row and stops.
  Triage, categorization (priority/sentiment/AI category), and the weekly digest
  are handled by a **separate centralized Notion agent** operating on the shared
  database. This keeps every app off the LLM-cost path and confines
  prompt-injection risk to one controlled place. (See
  [Why no in-app LLM](#why-no-in-app-llm).)
- **Almost everything is auto-filled.** The user supplies at most three things
  (category, comment, and — for general feedback only — a rating). Reporter
  identity, app name, responsible person, company, and timestamp are filled
  server-side.
- **Shared secrets.** Every Labs app writes to the *same* Notion database, so the
  Notion token and database id live in a **shared** SSM path, not per-app.

## Authentication

The `POST /api/feedback` route accepts either an admin or a company-customer
session (`getAdminSession()` / `getCustomerSession()` from `@/modules/auth/server`).
Any authenticated user may submit; unauthenticated requests get `401`. The widget
renders on the client for everyone, but only authenticated submissions succeed.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/feedback` | Submit feedback. Body: `{ category, comment, rating? }`. Everything else is auto-filled. Returns `201` on success, `400` on validation error, `401` if unauthenticated. |

The route is a **copy-in scaffold** (`scaffold/app/api/feedback/route.ts.example`),
so it only exists once you enable the capability.

## What gets auto-filled

The user picks a **category**, (for general feedback) a **rating**, and types a
**comment**. Everything else is derived server-side:

| Notion column | Type | Source |
|---|---|---|
| `Title` | title | `Feedback from <name/email> — <date>` |
| `App Name` | text | `app.config.json` `appName` |
| `Responsible Person` | text | `app.config.json` `createdBy` (falls back to `managedBy`) — the app builder |
| `User Name` | text | `getUserDisplayName(session)` |
| `User Email` | email | `getUserEmail(session)` |
| `Company` | text | `resolveCompanyContext(session)` — account/company name; empty for internal users |
| `Submitted At` | date | now |
| `Triage Status` | select | `pending` |
| `Rating` | number | user — **only for "give feedback"**; empty for bug/feature |
| `Comment` | text | user (sanitized + capped at 2000 chars) |
| `Category` | select | user — `bug` / `feature` / `other` |

The remaining columns — `AI Category`, `Priority`, `Sentiment`, `Summary Tag` —
are written later by the **centralized Notion agent**, not by the app.

### Rating is conditional

A 1–5 star rating is only shown and required for **general feedback**
(`category = other`). It's meaningless for a bug ("how many stars is this
crash?") or a feature request, so it's hidden there and the Notion `Rating`
column is left empty.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NOTION_API_KEY` | yes | Notion integration token. **Shared** across all Labs apps. |
| `NOTION_FEEDBACK_DATABASE_ID` | yes | Id of the shared "App Feedback" database. **Shared** across all Labs apps. |

Both are the same for every app, so store them once as **SSM SecureStrings** at a
shared path and point each app's ECS task role at it:

```
/labs-shared/feedback/NOTION_API_KEY
/labs-shared/feedback/NOTION_FEEDBACK_DATABASE_ID
```

Grant the task role `ssm:GetParameter` (+ `kms:Decrypt` for the SecureString key)
on that path. Rotating the Notion token is then a one-time change for the whole
fleet. Because both values are shared and `appName`/`createdBy` come from
`app.config.json`, **this capability adds no per-app secrets.**

## Database Schema Changes

**None in Postgres/Prisma.** Notion is the store, and the shared "App Feedback"
database already carries every column this capability writes — including
**`Company` (text)** (added 2026-07-08 for company-context attribution). A new
fork needs **no** Notion schema change; just point at the shared database. Full
current schema:

| Property | Type | Notes |
|---|---|---|
| `Title` | title | |
| `App Name` | text | |
| `Responsible Person` | text | filled at submit from `createdBy` |
| `Triage Status` | select | `pending` → `triaged` (agent) |
| `Rating` | number | nullable |
| `Comment` | text | |
| `Sentiment` | select | agent: `negative` / `neutral` / `positive` |
| `Priority` | select | agent: `low` / `medium` / `high` |
| `Category` | select | `feature` / `bug` / `other` |
| `User Name` | text | |
| `User Email` | email | |
| `Submitted At` | date | |
| `AI Category` | select | agent |
| `Summary Tag` | text | agent |
| `Company` | text | filled at submit from company context |

## Module API

```ts
import { submitFeedback, FeedbackValidationError } from "@/modules/user_feedback";

await submitFeedback({
  category: "bug",           // "bug" | "feature" | "other"
  comment: userComment,      // sanitized + capped inside
  rating: null,              // required 1–5 only when category === "other"
  userName: getUserDisplayName(session),
  userEmail: getUserEmail(session) ?? "",
  company: null,             // account/company name, or null for internal users
});
```

`submitFeedback` validates input (throwing `FeedbackValidationError` → map to
`400`), auto-fills the app/owner columns, and writes the Notion page. Also
exported: `sanitizeComment`, `FEEDBACK_COMMENT_MAX_LENGTH`, and the
`FeedbackCategory` type.

## Enabling

1. `npm install @notionhq/client` (already in the template's `package.json`).
2. Copy the scaffold UI into place — see
   [`src/modules/user_feedback/scaffold/README.md`](../../../src/modules/user_feedback/scaffold/README.md):
   - `scaffold/components/feedback/FeedbackWidget.tsx.example` → `src/components/feedback/FeedbackWidget.tsx`
   - `scaffold/app/api/feedback/route.ts.example` → `src/app/api/feedback/route.ts`
3. Mount `<FeedbackWidget />` once in the root layout (inside your providers).
4. Set the shared `NOTION_*` vars (locally in `.env`, in AWS via shared SSM).
5. Share the Notion database with the integration; make sure `app.config.json`
   `createdBy` is set (it becomes "Responsible Person").
6. Add `"user_feedback"` to `enabledCapabilities` in `app.config.json`.

## Security notes

### Why no in-app LLM

An earlier version of this feature (in `labs-feedback-app`) called an LLM
synchronously on every submit to triage feedback. That put the LLM on the
per-app request path and created real problems: every submission triggered LLM
calls (cost scaled 1:1 with submissions, with no rate limit), comment length was
unbounded (input-token DoS), and the triage endpoint was directly invokable. It
also batched *all apps'* feedback into one prompt, so a malicious comment from
one tenant could poison another tenant's triage.

Pulling the LLM out entirely removes all of that from the app: no per-app LLM
credentials, no app-path cost, and prompt-injection risk confined to one
centralized agent you control. The classification/digest value is preserved —
it just runs centrally over the shared Notion database.

### Comment handling

- **Hard cap** at `FEEDBACK_COMMENT_MAX_LENGTH` (2000 chars — one Notion text
  block), enforced both client-side and in `submitFeedback`. This bounds the
  tokens any single comment can ever cost the downstream agent.
- **Sanitization** strips control characters and zero-width / bidi-control
  unicode, and normalizes whitespace.
- **No content-based injection filtering.** It's brittle (false positives on
  legitimate feedback) and easily bypassed. Semantic defense — delimiting the
  comment as data and validating the model's output against the select-option
  allow-list — belongs in the centralized agent, not here.

### No server-side rate limit

Behind the Mapp VPN, users share egress IPs (an IP guard would throttle the whole
office), and per-instance in-memory counters don't work across ECS tasks. With no
LLM cost on the line, spam just means deletable Notion rows, so a shared-state
throttle (Redis/DB) isn't worth it. The widget prevents accidental double-submits
client-side; that covers the realistic case.

## The centralized triage agent (out of app scope)

Triage/categorization/digest and any Slack alerting are handled by a Notion-side
agent operating on the shared "App Feedback" database — deliberately **not**
shipped in the app. It reads `pending` rows, fills `AI Category` / `Priority` /
`Sentiment` / `Summary Tag`, flips `Triage Status` to `triaged`, and produces the
weekly digest. Because it's one controlled process, it's where comment
truncation, per-app batching, and model-output allow-listing live.

## Example Use Cases

- Let internal admins report bugs and request features without leaving the app.
- Collect satisfaction ratings from Mapp Cloud customers, attributed to their
  company.
- Centralize feedback across every Labs app in one Notion database with a single
  triage workflow.

## Reference

- Reference implementation: `labs-feedback-app` (the original, LLM-in-app version
  this capability deliberately simplifies).
- Scaffold enable guide:
  [`src/modules/user_feedback/scaffold/README.md`](../../../src/modules/user_feedback/scaffold/README.md).
- Retrofit prompt: [`docs/retrofit/2026-07-08-user-feedback.md`](../../retrofit/2026-07-08-user-feedback.md).
