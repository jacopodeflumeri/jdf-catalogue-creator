# Data Sync (cross-environment config dumps)

**Type:** Optional
**Module:** None (this is an infra + ops capability, not a `src/modules/` integration)
**Dependencies:** None
**CDK Construct:** `infra/lib/constructs/data-sync-integration.ts`

## Overview

Data Sync wires the app's ECS task into the shared `mapp-labs-data-sync` S3
bucket so admin-editable config (taxonomy, rules, settings — whatever the app
treats as "config") can be dumped from one environment and restored into
another. There is no direct DB-to-DB connectivity between environments: each
ECS task only talks to its own RDS instance.

The capability was created for one specific job: **moving config from prod to
staging for better, more realistic testing**. Once a project has the wiring in
place, the reverse direction works too (the construct grants symmetric reads),
but the design center is "prod → staging for testing realism." If your app
doesn't have config worth syncing between environments, you don't need it.

> **This is not a general-purpose S3 capability.** The `mapp-labs-data-sync`
> bucket is shared across all labs apps, private, and SSO-only — and the IAM
> grants this capability sets up are scoped exclusively to `config/{env}/{app}/*`
> for the same app slug. If your app needs S3 for any other purpose (public
> assets, user uploads, customer-facing exports), use the per-app bucket the
> template already provisions (see [S3_STORAGE.md](S3_STORAGE.md)). Don't try to
> extend this capability to cover those — it will either become too permissive
> (defeating the per-app isolation) or its abstractions will resist what you are
> trying to do.

## How it works

```
  prod ECS task                                       staging ECS task
       │                                                    ▲
       │  dump-config-to-s3.ts                              │
       │  (writes config/prod/{app}/<ts>.json.gz)           │
       ▼                                                    │
  ┌─────────────────────────────────────────────────────────┴───┐
  │           s3://mapp-labs-data-sync (shared, private)        │
  │                                                              │
  │   config/prod/{app}/<timestamp>.json.gz                      │
  │   config/staging/{app}/<timestamp>.json.gz                   │
  └─────────────────────────────────────────────────────────────┘
                       ▲  restore-config-from-s3.ts
                       │  (reads config/prod/{app}/latest)
```

## S3 layout & lifecycle

- **Key convention**: `config/{envSlug}/{appSlug}/{ISO-timestamp}.json.gz`
- **Bucket policy**: private, public access fully blocked, SSE-S3 encryption
- **Access**: SSO via `labs-power` profile (humans), per-app ECS task roles (envs)
- **Lifecycle**: 90 days on current versions, 30 days on noncurrent (managed by
  the `mapp-labs-shared` bucket setup, not by individual apps)

The bucket name and ARN are exported via SSM in every account+region:

```
/mapp-labs/shared/data-sync/bucket-name
/mapp-labs/shared/data-sync/bucket-arn
```

The CDK construct reads these at deploy time — no per-app config required.

## IAM model

`DataSyncIntegration` grants the ECS task role:

| Action | Resource | Notes |
|---|---|---|
| `s3:PutObject` | `bucket/config/{envSlug}/{appSlug}/*` | Own prefix only |
| `s3:AbortMultipartUpload` | `bucket/config/{envSlug}/{appSlug}/*` | Own prefix only |
| `s3:GetObject` | `bucket/config/*/{appSlug}/*` | Any env, same app |
| `s3:ListBucket` (prefix-conditioned) | `bucket` | Both own and any-env-same-app |

**Per-app isolation is enforced.** `myapp` can never read or write
`otherapp`'s prefix. Cross-env reads ARE allowed within the same app — so
staging can read prod dumps (the typical refresh) and prod can read staging
dumps (rare but supported, e.g. promoting a staging-built ruleset to prod).

`s3:DeleteObject` is **not** granted. The 90-day bucket lifecycle handles
cleanup. If a project really needs deletes, add that grant explicitly in the
stack.

## Environment variables

These are **injected by CDK** (not set by the user in `.env`):

| Variable | Required | Source | Description |
|----------|----------|--------|-------------|
| `DATA_SYNC_BUCKET` | yes | CDK | Shared bucket name (from SSM at deploy time) |
| `DATA_SYNC_KEY_PREFIX` | yes | CDK | This env's write prefix, e.g. `config/prod/myapp/` |
| `NEXT_PUBLIC_ENVIRONMENT` | yes | CDK | Existing env var — included in dump manifests |

## Database schema changes

None. The capability operates on whatever tables the project lists in
`scripts/data-sync/_shared.ts`.

## Operational surface

| Resource | Purpose |
|----------|---------|
| `infra/lib/constructs/data-sync-integration.ts` | CDK construct |
| `scripts/data-sync/_shared.ts.example` | Shared helpers + `CONFIG_TABLES` list (the per-project bit) |
| `scripts/data-sync/dump-config-to-s3.ts.example` | Read tables → gzipped JSON → S3 |
| `scripts/data-sync/restore-config-from-s3.ts.example` | S3 → transaction → wipe + restore |
| `scripts/deploy/run-dump-config-to-s3.sh.example` | ECS Exec wrapper |
| `scripts/deploy/run-restore-config-from-s3.sh.example` | ECS Exec wrapper |
| `Makefile` (Data Sync section) | `{env}-dump-config-to-s3`, `{env}-restore-config-from-s3`, `data-sync-list-dumps`, `dev-pull-config-dump` |

The `.example` suffix is intentional — each project copies them and fills in
the TODOs (step 2 below).

## Enabling Data Sync in your project

### 1. Wire the construct into your CDK stack

In `infra/lib/stack.ts`, import the construct and instantiate it after the task
role is created:

```ts
import { DataSyncIntegration } from "./constructs/data-sync-integration";

// ... inside AppStack constructor, after `const taskRole = ...` ...

const dataSyncEnvSlug = config.envName === "production" ? "prod" : "staging";
const dataSync = new DataSyncIntegration(this, "DataSync", {
  taskRole,
  appSlug: config.appName,  // must be <= 20 chars
  envSlug: dataSyncEnvSlug,
});
```

Then add the env vars to the container `environment` block:

```ts
DATA_SYNC_BUCKET: dataSync.bucketName,
DATA_SYNC_KEY_PREFIX: dataSync.keyPrefix,
NEXT_PUBLIC_ENVIRONMENT: config.envName,  // already present in most apps
```

Note the `envSlug` translation: the rest of this template uses `prod`/`stg` for
ECS resource naming, but the data-sync bucket convention is `prod`/`staging`
(matching the shared `mapp-labs-shared` template's documentation). The construct
does NOT do this translation itself — you pass the slug explicitly, which keeps
the coupling visible at the call site.

`appSlug` is validated to be ≤ 20 characters at construction time. AWS resource
naming downstream often prefixes the slug, so very long names break elsewhere
first.

### 2. Copy and customize the script skeletons

```sh
cp scripts/data-sync/_shared.ts.example                 scripts/data-sync/_shared.ts
cp scripts/data-sync/dump-config-to-s3.ts.example       scripts/data-sync/dump-config-to-s3.ts
cp scripts/data-sync/restore-config-from-s3.ts.example  scripts/data-sync/restore-config-from-s3.ts

cp scripts/deploy/run-dump-config-to-s3.sh.example      scripts/deploy/run-dump-config-to-s3.sh
cp scripts/deploy/run-restore-config-from-s3.sh.example scripts/deploy/run-restore-config-from-s3.sh
chmod +x scripts/deploy/run-*-config-*.sh
```

(On Windows, `chmod +x` does not reach git — also run
`git update-index --chmod=+x scripts/deploy/run-*-config-*.sh`; see
[WINDOWS.md](../WINDOWS.md).)

Then fill in the TODOs:

| File | What to fill in |
|---|---|
| `scripts/data-sync/_shared.ts` | `CONFIG_TABLES` list — every table you consider "config" |
| `scripts/data-sync/restore-config-from-s3.ts` | Soft-FK nullouts, orphan cleanup, per-row filtering for tables that reference entities not in the dump |

The dump script is generic — once `CONFIG_TABLES` is filled in, it needs no
further changes.

The restore script's TODO blocks are where you adapt the generic
wipe-and-restore to your app's FK reality. The default flow:

1. Wipe each `CONFIG_TABLES` row in reverse order (using the same `where`
   filter if one is set, so out-of-scope rows aren't touched)
2. (Your filter logic) — drop rows whose soft-FK references won't resolve
3. Insert each table in order, preserving original IDs
4. (Your nullout SQL) — null any cross-scope FK columns
5. (Your orphan cleanup) — fix rows OUTSIDE the dump that referenced IDs that
   may have changed
6. Reset autoincrement sequences (auto-discovered from
   `information_schema.columns`)

All in one Postgres transaction with FK checks bypassed via
`SET LOCAL session_replication_role = 'replica'` — which is why the scripts are
Postgres-only.

### 3. Deploy the infra changes

```sh
make staging-infra-deploy
make prod-infra-deploy
```

This grants the new IAM permissions and injects the new env vars on the ECS
task definitions.

### 4. Try it

```sh
make prod-dump-config-to-s3
make staging-restore-config-from-s3-dry-run
make staging-restore-config-from-s3
```

## Operational workflows

### Refresh staging from prod (the common case)

```sh
make prod-dump-config-to-s3
make staging-restore-config-from-s3
```

### Backup staging before a risky change

```sh
make staging-dump-config-to-s3
# ... do the risky thing ...
# if it goes wrong, restore from the dump you just made:
make staging-restore-config-from-s3 EXTRA="--source=staging --key=config/staging/{app}/<your-backup>.json.gz"
```

### Pull a prod dump to your laptop for local development

```sh
make dev-pull-config-dump  # downloads to tmp/
gunzip -c tmp/*.json.gz | jq .manifest
# then write your own loader script for local DB if needed
```

### See what's in S3

```sh
make data-sync-list-dumps
```

### Dry-run a restore

```sh
make staging-restore-config-from-s3-dry-run
```

Downloads + parses the dump, prints the manifest, exits before any DB writes.

## Manifest format

Each dump includes a manifest:

```json
{
  "manifest": {
    "createdAt": "2026-05-14T15:30:00.000Z",
    "sourceEnv": "production",
    "sourceApp": "myapp",
    "tableCounts": { "taxonomy_category": 142, "settings_rule": 28 },
    "schemaVersion": 1
  },
  "tables": {
    "taxonomy_category": [ ... rows ... ],
    "settings_rule":     [ ... rows ... ]
  }
}
```

`schemaVersion` is a hook for future format changes — the current restore
script doesn't enforce it, but bumping it when you change the dump format
prevents silent breakage.

## Caveats

- **Schema drift**: if the source env has migrations the target hasn't applied
  (or vice-versa), the restore fails loudly when fields don't match. Run
  `make {env}-db-migrate` first if needed.
- **`rds_superuser` requirement**: `SET LOCAL session_replication_role` requires
  elevated privilege. RDS's default `postgres` user has `rds_superuser` — if you
  have created an app-specific limited role, this capability won't work unless
  that role has the privilege.
- **Out-of-scope FK references**: if a dumped table references an entity not in
  the dump scope (Account, User, etc.), rows without a valid target are dropped
  or nulled out per your filter logic. This degrades silently — a dropped FK row
  becomes a row that "doesn't exist" in the new env, which can broaden scoping
  unintentionally. Document these in your restore script's TODOs.
- **ID preservation**: the restore preserves original IDs. This is deliberate
  (cross-env testing is predictable when prod's row #42 stays row #42 in
  staging). It also means **never restore prod from staging if staging has IDs
  prod doesn't** — you'll clobber prod entities. The
  `prod-restore-config-from-s3` Makefile target exists but has a 10-second
  warning timer.
- **Soft-deleted rows**: if your tables use soft-deletes, the dump includes them
  and the restore re-inserts them. Filter them in `CONFIG_TABLES[].where` if you
  don't want that.
- **Sensitive data**: the bucket is private and SSO-only, but treat it as if
  anyone with `labs-power` access can read everything. Don't dump tables
  containing PII, secrets, or API keys.

## Example use cases

- **Reproduce a prod bug locally** with a recent prod config snapshot
- **Test a migration against realistic data** by pulling prod config into
  staging first
- **Snapshot before a risky config change** so you can roll back
- **Sync ruleset experiments built in staging back to prod** (rare, but
  supported)

## What this capability is NOT

- ❌ A general-purpose S3 client / file storage layer (use the per-app bucket
  `mapp-labs-{app}-{env}` via [S3_STORAGE.md](S3_STORAGE.md))
- ❌ A way to share data across DIFFERENT apps — the bucket policy and IAM grants
  enforce per-app isolation
- ❌ A backup/restore tool for full DB state (no users, no accounts, no
  transactional data — by design)
- ❌ A scheduled job — there's no default cron; each project decides whether to
  schedule or trigger manually

## Reference

The FTL project (`labs-trends`) is the original implementation and production
reference. Its `scripts/data-sync/` directory is the worked-out version of these
`.example` files: `CONFIG_TABLES` covering taxonomy, outfit/color/shape rules,
trends and brand-scoped joins; a restore script with brand filtering, soft-FK
nullouts to `Account`/`MappTeam`, and product-catalog orphan cleanup. Worth
reading if your app has comparable FK complexity.
