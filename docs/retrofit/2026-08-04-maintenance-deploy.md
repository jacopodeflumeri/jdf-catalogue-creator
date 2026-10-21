# Retrofit prompt — Maintenance deploy path (`make <env>-deploy-maintenance`)

> Implements the **2026-08-04 "Maintenance deploy path"** entry in
> [`MIGRATION.md`](../../MIGRATION.md).
>
> **Applies to every fork**, but it is **not urgent** — nothing breaks without it.
> It adds a *second* deploy path for the one release a year whose database
> migration the running image cannot survive: an in-place rename, a dropped
> column, a backfill that must not race with live writes. The everyday
> `make <env>-deploy` is unchanged and stays the default.
>
> The reason to add it before you need it: the alternative, at 11pm with a
> half-migrated production database, is hand-composing `update-service` calls in
> a live incident. Ported from **FTL** (`labs-trends`), which learned this during
> a `Trends` → `Derived Attributes` table rename.
>
> **Scripts, Makefile targets, one test file, and docs. No schema, no SSM, no
> CDK, no infrastructure change.** Nothing in this retrofit deploys anything.

---

## How to use this prompt

1. Pull a **fresh copy of `labs-app-template`** into a separate directory.
2. Open **your app** in your agent.
3. Replace `<TEMPLATE_PATH>` below, then paste **PROMPT START** → **PROMPT END**.

```
<TEMPLATE_PATH> = /absolute/path/to/your/fresh/labs-app-template
```

---

## PROMPT START

You are adding a **maintenance deploy path** to the **current project** (an existing
Mapp Labs app). Goal: give this app a deploy that can safely run a
non-backwards-compatible database migration, alongside the rolling deploy it
already has.

The authoritative reference is a fresh checkout of `labs-app-template` at:

    <TEMPLATE_PATH>

If that path is the literal placeholder, empty, or not a `labs-app-template`
checkout (no `app.config.json`, no `scripts/deploy/full-deploy.sh`), **stop and ask
me for the correct path.** Also remind me to have pulled the **latest** template,
and tell me its version.

### Who I am

Assume I may **not** be a developer. **You** own the git branch and the edits. The
one thing you must **not** do is **run a deploy** — that's mine, and this one takes
the app offline. Explain everything in plain language.

### Why this matters (so you can explain it to me)

`full-deploy.sh` — what `make <env>-deploy` runs — builds the image, rolls the ECS
service, and runs the migration **after** the new tasks are live. The app never goes
down. The cost is a short window where an *outgoing* task, running the old code,
serves requests against the *new* schema.

For additive migrations (new table, new column, new index) that is harmless, and it
is the right default. For a rename or a drop it means the old code queries columns
that no longer exist: 500s at best, wrong writes at worst. The maintenance path
trades availability for correctness — it gates the load balancers, drains the
service to **zero**, migrates with nothing serving, and only then brings the app
back on the new image.

### Operating principles

1. **Do not break this app.** The existing `make <env>-deploy` must keep working
   exactly as it does today. You are **adding** a path, not replacing one. If you
   find yourself editing the rolling deploy's behaviour, stop and ask.
2. **The template is the reference target, not a literal source to copy.** Every
   fork has diverged. Match its conventions; adapt names, extra services, and
   extra scheduled jobs to the app you actually find.
3. **Fail closed is a feature, not a bug.** Do not "improve" the script by making
   it restore service after a failed migration. That is the one behaviour the
   whole design exists to prevent.
4. **Never run this against production yourself.** Not even to test.

### Step 1 — read what this app actually deploys

Before copying anything, work out the facts the script needs. Read this app's
`scripts/deploy/` and `infra/lib/stack.ts` (or equivalent) and write down:

- **Cluster and service names.** The template uses `${APP_NAME}-${SHORT_ENV}`
  (e.g. `myapp-stg`, `myapp-prod`) via `scripts/deploy/_config.sh`. If this app
  hardcodes names, or uses `<app>-staging` / `<app>-production` instead, note it —
  the script must use whatever is real.
- **ALB names.** The template's public ALB is named after the same prefix; the
  optional internal one is `<prefix>-int`. **FTL uses `-internal`.** Check the live
  names rather than trusting either:
  ```bash
  aws elbv2 describe-load-balancers --profile labs-power --region eu-central-1 \
    --query 'LoadBalancers[].LoadBalancerName' --output text
  ```
- **Listener ports.** Public 443 (HTTPS), internal 80 (HTTP) in the template.
- **Container name** in the task definition (`App` in the template).
- **Deploy model** — `immutableDeploy` in `app.config.json`. False/absent means the
  task def tracks the floating `${env}-latest` tag; true means it pins
  `${env}-${version}`. The script verifies a different release tag in each case,
  and the template's version handles both. Do not hardcode one.
- **Scheduled jobs.** Any EventBridge rule that can start an app task on its own
  must be quiesced during the window, or it fires the new image against the old
  schema while the service is drained:
  ```bash
  aws events list-rules --profile labs-power --region eu-central-1 \
    --query 'Rules[].[Name,ScheduleExpression]' --output text | grep -i <app>
  aws scheduler list-schedules --profile labs-power --region eu-central-1 \
    --query 'Schedules[].Name' --output text 2>/dev/null
  ```
  The template auto-discovers EventBridge **Rules** named `<cluster>-*` that carry
  a `ScheduleExpression`. Anything named off-prefix, or living in EventBridge
  **Scheduler** (the newer `aws scheduler` API, which the template does not
  discover), has to be passed explicitly via `MAINTENANCE_SCHEDULE_RULES` — tell me
  if you find any, and put the exact value in your handback.
  Do **not** disable event-pattern rules such as
  `<cluster>-ecs-task-state-change`: that one only writes task state changes to
  CloudWatch Logs, which is precisely what you want recorded during a maintenance
  window.
- **Anything that must run after the migration but before traffic returns** — a
  search index rebuild, a materialized-view refresh, a cache warm. The template
  supports one such command via `MAINTENANCE_POST_MIGRATE_COMMAND`. (FTL uses it
  for a knowledge-graph rebuild.) Ask me if you are unsure whether the app has one.

Show me this list before you write code. If the app's shape differs a lot from the
template's — several ECS services, a worker cluster, no internal ALB, an ALB shared
with another app — say so now, because it changes what "drain everything" means.

### Step 2 — copy the scripts and adapt them

From `<TEMPLATE_PATH>/scripts/deploy/`, port:

- `maintenance-deploy.sh` — the deploy path itself
- `runtime-image-verification.sh` — digest/platform matching helpers (sourced)
- `resolve-runtime-image-digest.py` — resolves the `linux/amd64` digest from an
  OCI image index

Adapt names to what you found in step 1. Keep every guard. In particular, these are
load-bearing and must survive the port:

- **Gate before drain.** The 503 rules go up *before* the service scales down, so
  there is no window where the app is down and a client sees a raw connection
  error instead of a 503.
- **Priority-1 rule adoption.** An existing priority-1 rule is adopted only if it
  is tagged `ManagedBy=<app>-maintenance-deploy` and is a fixed 503 — i.e. left
  behind by a previous failed run. Anything else aborts, because it is a real
  routing rule.
- **Wait for the whole task *family* to stop,** not just for the service to be
  stable. `services-stable` returns while a stopping task is still serving.
- **Disable the ECS circuit-breaker rollback** for the window, and restore the
  captured setting afterwards. Otherwise ECS "helpfully" restores the old revision
  on top of a migrated schema.
- **The ECS Exec result marker.** `aws ecs execute-command` exits 0 whenever the
  SSM *session* worked — a failed migration looks exactly like a successful one.
  The remote command echoes `MAINTENANCE_RESULT:<job>:<status>` and the script
  parses it. Without this the script will happily reopen traffic after a failed
  migration.
- **Image digest verification.** ECS may report either the OCI index digest or the
  selected child-manifest digest for the same image; both verified forms are
  accepted, nothing else is. This is what catches "the task came up on last week's
  image".
- **The fail-closed cleanup trap**, including the messages telling the operator
  what state things were left in.

If this app's `_config.sh` differs (or does not exist), wire the script to however
this app resolves `APP_NAME` / `ECR_REPO` / env short names. If it has no
`_config.sh` at all, hardcoding the app's real names is acceptable — say so as a
deviation.

### Step 3 — Makefile targets

Add `staging-deploy-maintenance` and `prod-deploy-maintenance` next to the existing
deploy targets, matching this app's existing style (`.PHONY` list, help text,
`APP_NAME=`/`AWS_PROFILE=` prefixes, the production countdown). Model them on
`<TEMPLATE_PATH>/Makefile`.

**Do not change what `make <env>-deploy` does.** If this app is one of the forks
where `<env>-deploy` was *already* pointed at a maintenance-style script, tell me —
that is FTL's original mistake and we reverted it, but reverting it in *your* app is
my call, not yours.

### Step 4 — tests

Port `<TEMPLATE_PATH>/scripts/deploy/__tests__/maintenance-deploy.test.ts` if this
app has a jest setup that picks up `**/__tests__/**`. The ordering assertions are
the point: they are text-level checks that stop a later edit from quietly moving
"reopen traffic" above "verify the migration succeeded". Update the expected
strings to whatever your adapted script actually says — but if you find yourself
deleting an assertion rather than updating it, that means you dropped a guard in
step 2. Go back.

If this app has no jest, skip the test file and say so.

### Step 5 — document both paths

Update this app's `docs/DEPLOYMENT.md` (`docs/template/DEPLOYMENT.md` in apps on the 2026-10-17 docs layout; or its README, if that is where deploys are
documented) using `<TEMPLATE_PATH>/docs/template/DEPLOYMENT.md` "Deploying Updates" as the
model. It must say:

- Rolling is the default; maintenance is opt-in and **takes downtime**.
- Which migrations require which path, concretely.
- That a failed maintenance deploy **stays down on purpose**, and the retry needs
  `MAINTENANCE_RESTORE_DESIRED_COUNT=1`.
- The optional env vars: `CONFIRM_MAINTENANCE_DOWNTIME`,
  `MAINTENANCE_POST_MIGRATE_COMMAND`, `MAINTENANCE_SCHEDULE_RULES`,
  `MAINTENANCE_RESTORE_DESIRED_COUNT`.
- That it needs the AWS Session Manager plugin (ECS Exec).

Also port the **"write migrations so neither path can half-apply"** section. Do not
skip it as filler — it is the other half of this change, and it comes from a real
incident. A multi-step FTL migration created its indexes with bare
`CREATE UNIQUE INDEX`, failed partway through, and then failed *every* retry on
`relation ... already exists`; because Prisma had recorded it as failed, it blocked
every later migration until someone resolved it by hand. The maintenance path
controls who is *running* during a migration — it cannot save a migration that
half-applies.

While you are there, check this app's **existing** migrations directory for the same
defect. Report what you find; **do not rewrite already-applied migrations** (editing
an applied migration breaks the checksum in `_prisma_migrations` and is its own
outage). This is guidance for the *next* migration:

```sql
CREATE UNIQUE INDEX foo_slug_key ON foo (slug);            -- not re-runnable
CREATE UNIQUE INDEX IF NOT EXISTS foo_slug_key ON foo (slug);  -- re-runnable
```

Recovery for a half-applied migration, once a human has verified the end state is
genuinely correct: `npx prisma migrate resolve --applied <migration_name>`. That
changes bookkeeping, not data — never suggest it before the data has been checked.

### Step 6 — tell future agents how to choose between the two paths

This app is worked on by coding agents, and the failure mode this retrofit
introduces is an agent that "helpfully" reaches for the maintenance deploy because
it sounds safer. It isn't safer — it is a deliberate trade of availability for
correctness, and it fails closed.

Port the **"Choosing a Deploy Path"** section from `<TEMPLATE_PATH>/AGENTS.md` into
this app's `AGENTS.md` (or `CLAUDE.md`, or whatever agent-instructions file it
actually has — if it has none, put it in the deployment doc from Step 5 and say so). It must
state:

- **`make {env}-deploy` is the default and is unchanged.** Never substitute the
  maintenance path silently.
- The maintenance path is **suggested, not chosen** — the agent raises it as a
  question and the user decides.
- The specific signals worth raising it for: an in-place rename, a dropped or
  narrowed column the running version still selects, a **large batch of migrations
  going out at once**, a backfill that must not race with live writes, or a
  migration that will hold locks a long time. Additive migrations and code-only
  releases do **not** qualify.
- The trade-off, in plain language: rolling has no downtime but lets old code
  briefly meet the new schema; maintenance guarantees old code never sees the new
  schema but the app is **down for the whole window** and **stays down on failure**.
- That when unsure, the answer is to deploy to **staging** with the default path
  first.

Also add the maintenance targets to whatever "requires explicit confirmation" list
this app's agent instructions keep — it is an ECS scale-to-zero, and it belongs
next to `cdk destroy` and database resets.

### Verify and hand back

- `bash -n` every script you added or touched.
- Run the app's test suite (`npm test`) and type-check.
- Confirm `make help` lists both deploy targets, and that `make <env>-deploy` is
  byte-for-byte unchanged in behaviour.
- **Do not deploy.** In particular, do not "smoke test" the maintenance path
  against staging without asking me — it takes staging offline for several
  minutes, and if it fails it leaves it offline on purpose.

### Record state

Before handback, write/update **`.retrofit-state.json` at this app's repo root**
(create if absent), following `<TEMPLATE_PATH>/docs/retrofit/RETROFIT-STATE.md`.
Upsert this retrofit under `retrofits["2026-08-04-maintenance-deploy"]` with
`status` (applied / partial / skipped / not-applicable), `templateVersion` +
`templateRef`, an ISO-8601 UTC `at` (`date -u +%Y-%m-%dT%H:%M:%SZ`), `by`, and
`notes` + any `deviations`. Good things to record: the real cluster/service/ALB
names you targeted, whether an internal ALB exists, which scheduled rules get
quiesced (and any that auto-discovery cannot see), whether the app uses
`MAINTENANCE_POST_MIGRATE_COMMAND`, and whether the app is on the immutable or
floating deploy model. Refresh `template.lastRetrofitAgainstVersion` /
`lastRetrofitAgainstRef` / `lastRetrofitAt`; don't remove other entries.

### Plain-language handback

1. That the app now has **two** deploy commands, that **the default one has not
   changed**, and the one-line rule for choosing: use the default unless the
   currently-running image cannot survive the migration.
2. That the maintenance one **takes the app offline** for the length of the
   migration, and roughly how long that is for this app (drain + build + migrate +
   start ≈ the usual deploy time plus the migration).
3. That a **failed maintenance deploy leaves the app down on purpose**, what the
   error output will tell them, and the exact retry command.
4. Any scheduled jobs that will be paused during the window — and any the script
   **cannot** see automatically, with the `MAINTENANCE_SCHEDULE_RULES` value to
   pass.
5. Whether any existing migrations look non-idempotent, and that the fix is for
   future migrations rather than rewriting old ones.
6. That it is **untested against this app's AWS** until the first real use, and
   that the sane first use is a staging release during working hours.
7. Every **deviation** from the template and why.
8. If anything got complicated and I didn't have an answer, remind me I can ask in
   **#topic-mapp-labs**.

## PROMPT END
