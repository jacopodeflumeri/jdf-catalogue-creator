# Audit Log

**Type:** Standard (always included)
**Module:** `src/modules/audit/` · **Page:** `/admin/audit-log` (linked from **Settings**)
**Dependencies:** None

## Overview

Every app records **who changed what, and when**. Server actions call
`writeAuditLog`; admins read the result at `/admin/audit-log`. It needs no setup and
no environment variables.

This page covers two different things that both get called "audit log":

| | Admin audit log | Account activity |
|---|---|---|
| Answers | "Who changed this setting, and when?" | "What did this customer do in their account?" |
| Written by | Admin server actions, explicitly | Automatically on customer page views, plus custom events |
| Table | `audit_log` | `account_activity` |
| Read at | `/admin/audit-log` | Per-account (no page in the base template) |
| Requires | Nothing | A `User` and an `Account` |

**Use the admin audit log for changes.** Account activity is described at the end.

## What is recorded out of the box

| Entity | Action | When |
|---|---|---|
| `mapp_team` | `access_updated` | An admin edits a team member's level or status (single or bulk) |
| `mapp_team` | `access_revoked` | An admin suspends or denies a team member |
| `mapp_team` | `access_granted` | An admin grants or restores access |
| `company` | `customer_preview_start` / `customer_preview_end` | An admin starts / ends "View as customer" (only with the optional [customer_preview](CUSTOMER_PREVIEW.md) capability enabled) |

Everything else is yours to add — see the next section.

## What to record (read this if you are building the app)

**The audit log only contains what your code writes to it.** Nothing is captured
automatically. If you are an agent or developer adding a feature to this app,
recording its consequential changes is **part of building the feature**, not a
follow-up: add the `writeAuditLog` call in the same change that adds the server
action.

It does **not** need to be everything. Record what someone would later need to
answer "who did that, and when?" about:

| Record it | Examples |
|---|---|
| **Access and permissions** | granting, changing or revoking someone's access; creating, rotating or revoking an API key or token |
| **Deleting or archiving** | removing a record, a customer, a file set — anything that is hard or impossible to undo |
| **Configuration that changes behaviour** | rules, mappings, thresholds, feature switches, templates, prompts, integration settings |
| **Bulk and one-off operations** | imports, exports of customer data, backfills, re-syncs, "apply to all" |
| **Publishing and state changes** | approving, publishing, enabling/disabling, moving something between stages |
| **Acting on someone else's behalf** | an admin editing a customer's data, or viewing a customer account as them |
| **Money and limits** | quotas, plans, budgets, anything that changes what a customer is charged or allowed |

| Leave it out | Why |
|---|---|
| Reads, searches, page views, logins | Not changes. Account activity (below) covers customer page views |
| A user editing their own profile or preferences | Low consequence, high volume |
| Drafts and autosaves | Record the publish, not every keystroke |
| Automatic background refreshes with no person behind them | Noise — unless a job changes something important, in which case record the job once |

**A quick test:** if this change turned out to be a mistake, or was disputed, would
someone go looking for who made it? If yes, record it. If you are unsure, record
it — an extra row costs nothing, and a missing one cannot be recovered.

**Make each row useful on its own.** The `message` should make sense to someone who
was not there: "API key 'Reporting' revoked", not "update ok". Put the before and
after in `data` when the old value matters.

When you add a new kind of thing to record, add it to `AUDIT_ENTITY_TYPES` first
(see "Adding an entity type").

## Recording a change

```typescript
import { sessionAuditActor, writeAuditLog } from "@/modules/audit";

export async function renameWidget(id: number, name: string) {
  const session = await requireAdmin({ requireEditorAccess: true });
  const widget = await prisma.widget.update({ where: { id }, data: { name } });

  await writeAuditLog({
    ...sessionAuditActor(session),       // who
    action: "renamed",                   // verb, snake_case
    entityType: "widget",                // must be listed in entity-types.ts
    entityId: widget.id,
    message: `Widget renamed to "${name}"`, // the line the table shows
    data: { name },                      // optional structured detail
  });
}
```

**Rules of thumb**

- **Write after the change succeeds**, not before. A refused or failed change should
  leave no "success" row. To record a failure deliberately, pass `outcome: "error"`.
- **`writeAuditLog` never throws.** A failed audit write is logged and swallowed, so
  it cannot fail the change it describes. You do not need a `try/catch` around it.
- **Inside `prisma.$transaction`, use `writeAuditLogTx(tx, …)`.** A row written on the
  outer client survives a rollback and records a change that never happened. The
  `Tx` variant *does* throw, because a swallowed error would still poison the
  transaction.
- **Never put secrets in `message` or `data`** — tokens, passwords, API keys. Every
  admin, including viewers, can read this page.
- **One row per thing changed.** A bulk action writes a row per record, so each
  record's history is complete on its own.

## Adding an entity type

`entityType` is not free text. Add your entity to `AUDIT_ENTITY_TYPES` in
`src/modules/audit/entity-types.ts`:

```typescript
{ key: "widget", label: "Widget", href: (id) => `/admin/widgets/${id}` },
```

That one line gives it a TypeScript type (so `writeAuditLog` accepts it), a filter
chip on the page, a label, and a link from each row. It is a list in code rather
than a database enum, so **adding a type needs no migration**. The filter chips
appear once there is more than one type.

If you later remove a type, its existing rows still display (with the raw key as
the label); they just lose their chip.

## Data model

`AuditLog` in `prisma/schema.prisma` (table `audit_log`):

| Field | Type | Description |
|-------|------|-------------|
| `id` | Int (PK) | Auto-incrementing ID |
| `createdAt` | DateTime | When it happened |
| `mappUserId` | Int? (FK → `MappTeam`) | Who did it. `SetNull` on delete |
| `actorEmail` | String? | Plain copy of who did it |
| `action` | String | Verb, snake_case |
| `entityType` | String | Key from `AUDIT_ENTITY_TYPES` |
| `entityId` | Int? | The record, when the row is about one |
| `outcome` | String? | `success` (default) or `error` |
| `message` | String? | One human-readable line |
| `data` | Json? | Structured detail |

**Indexes:** `(entityType, entityId)`, `createdAt`, `mappUserId`.

**Why the actor is stored twice.** `mappUserId` is the joinable link, and it goes
`NULL` if that team member is ever deleted — deleting a person must never delete
their history. `actorEmail` survives that, and also names SuperAdmins who have no
`MappTeam` row at all.

## The page

`/admin/audit-log` is readable by **any active admin** (viewer and up) and is
linked from the Audit Log card on `/admin/settings`. It lists newest first, 50 per
page, with search over the description, action and actor, and a filter by entity
type. Search, filter and pagination run in Postgres — the table only grows.

## Key files

| File | Purpose |
|------|---------|
| `src/modules/audit/write.ts` | `writeAuditLog`, `writeAuditLogTx` |
| `src/modules/audit/entity-types.ts` | `AUDIT_ENTITY_TYPES` — the list of auditable entities (client-safe, no Prisma) |
| `src/modules/audit/actor.ts` | `sessionAuditActor(session)` |
| `src/lib/prisma/services/audit-log.ts` | `prismaService.auditLog.listPaginated()` — the read side |
| `src/app/admin/audit-log/` | The page |
| `src/lib/actions/admin/access-management-actions.ts` | The built-in example: Mapp Team access changes |

## Retention

Nothing is deleted automatically. Rows are small, and for most Labs apps the table
stays modest for years. If yours writes at high volume, add a scheduled prune that
suits your retention needs — the template deliberately does not pick one for you.

---

## Account activity (customer page views and events)

A separate, older mechanism: per-account tracking of what **customers** do. It is
tied to a `User` and an `Account`, so it only applies to apps that use local
accounts.

### Architecture

#### Database Model

The `AccountActivity` model in `prisma/schema.prisma`:

| Field | Type | Description |
|-------|------|-------------|
| `id` | Int (PK) | Auto-incrementing ID |
| `createdAt` | DateTime | When the activity occurred |
| `userId` | Int (FK) | The user who performed the action |
| `accountId` | Int (FK) | The account context |
| `type` | String | Activity type (e.g., `view`, `forms`, custom) |
| `details` | String? | Activity-specific details (e.g., page path) |
| `message` | String? | Human-readable description |
| `linkedId` | Int? | Reference to a related record |
| `mappUserId` | Int? (FK) | Mapp team member who performed an admin action |

**Indexes:** `accountId`, `userId`, `createdAt`

#### Built-in Event Types

| Type | Description | Details Field |
|------|-------------|---------------|
| `view` | Page visit | Page path (e.g., `/account/dashboard`) |
| `forms` | Form submission | Form identifier |

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/prisma/services/account-activity.ts` | `PrismaAccountActivityService` — CRUD operations |
| `src/lib/actions/admin/activity-actions.ts` | Server actions: `accountActivity()`, `logPageVisit()`, `getAccountActivityLogs()` |
| `src/app/api/account/activity-logs/route.ts` | Customer API endpoint (GET/POST) |
| `src/components/account/PageActivityLogger.tsx` | Automatic page visit logger + `useActivityLogger` hook |
| `src/types/activity.ts` | TypeScript types |

### How to Use

#### Automatic Page Visit Logging

The `PageActivityLogger` component is already included in the root layout. It automatically logs page visits for authenticated customers. Admin and auth pages are excluded.

#### Log Custom Events from Server Actions

```typescript
import { prismaService } from '@/lib/prisma/services';

await prismaService.accountActivity.createActivity({
  userId: 123,
  accountId: 456,
  type: 'data_export',        // your custom type
  details: 'exported_csv',     // specifics
  message: 'User exported account data as CSV',
  linkedId: 789,               // optional: related record ID
  mappUserId: 10,              // optional: admin who triggered it
});
```

#### Log Custom Events from Client Components

```typescript
import { useActivityLogger } from '@/components/account/PageActivityLogger';

function MyComponent() {
  const { logCustomActivity } = useActivityLogger();

  const handleExport = async () => {
    await logCustomActivity('data_export', 'exported_csv', 'User exported data');
  };
}
```

#### Query Logs via API

**Customer endpoint:**
```
GET /api/account/activity-logs
POST /api/account/activity-logs  { type, details, message }
```

There is no admin endpoint in the base template — admin code reads the logs
server-side (below).

#### Query Logs from Server Code

```typescript
import { prismaService } from '@/lib/prisma/services';

// By account
const logs = await prismaService.accountActivity.getActivityLogsByAccountId(accountId);

// By type
const views = await prismaService.accountActivity.getActivityByType(accountId, 'view');

// Admin dashboard (last N days across all accounts)
const allLogs = await prismaService.accountActivity.getAllActivityLogs(30);
```

### Extending the Audit Log

#### Adding Custom Event Types

1. Define your type string (e.g., `api_key_created`, `data_import`, `settings_changed`)
2. Use `createActivity()` with your custom type
3. No schema changes needed — the `type` field is a free-form string

#### Showing Custom Types in an Admin UI

The base template ships no admin page for account activity (see below). If you
build one, give each custom type an icon and a filter option there, e.g.:

```typescript
// type icon mapping
case 'data_export': return <Icon type="download" size="sm" />;

// filter dropdown
<option value="data_export">Data Exports</option>
```

### Admin Dashboard Features

> The admin UI described below (`/admin/accounts/[id]/logs/`) is **not part of the
> base template any more** — it shipped with the account/CRM pages that moved out
> of base, and so did its client hook (`useAccountActivityLogs`) and the
> `/api/admin/accounts/{id}/activity-logs` endpoint it called. The services and
> server actions above remain; build the page in your app if you use account
> activity.

The admin activity log UI at `/admin/accounts/[id]/logs/` included:

- **Summary cards**: Total activities, page views, most active user
- **Activity chart**: Line chart showing activity trends over time
- **Advanced filtering**: Time range (7d/30d/90d/all), activity type, user, full-text search
- **Activity insights**: Peak activity time, busiest day, unique users, daily average
- **Paginated table**: Type icons, details, user, timestamp (10 items per page)

#### Performance Patterns

- O(1) user lookup via pre-built map
- Single-pass filtering and statistics calculation
- Debounced search (150ms)
- Memoized chart data and summary calculations
- Client-side pagination to avoid re-fetching
