# Retrofit prompt — RDS storage gp2 → gp3

> Implements the **2026-09-10 "RDS storage gp2 → gp3"** entry in
> [`MIGRATION.md`](../../MIGRATION.md).
>
> **Applies to every fork with an `infra/` directory.** Every app created from
> this template before 2026-09-10 is on **gp2**, because that is CDK's default
> and the template never set `storageType`. At the template's 20 GiB, gp2 means
> a **baseline of 100 IOPS** with a burst credit balance papering over it. gp3
> gives a flat **3,000 IOPS / 125 MiB/s**, at the **same per-GiB price**.
>
> **One CDK property and one deploy.** No schema, no SSM, no code, no image
> rebuild. The storage conversion itself is **online** — no downtime and no
> reboot — but it is **not free of risk**, and the risk is almost entirely in
> how the deploy is driven rather than in the conversion. Read the "What can
> actually go wrong" section before running anything.

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

You are switching the **current project**'s RDS PostgreSQL storage from **gp2** to
**gp3** (an existing Mapp Labs app forked from `labs-app-template`).

The authoritative reference is a fresh checkout of `labs-app-template` at:

    <TEMPLATE_PATH>

If that path is the literal placeholder, empty, or not a `labs-app-template`
checkout (no `app.config.json`, no `infra/lib/stack.ts`), **stop and ask me for the
correct path.** Also remind me to have pulled the **latest** template, and tell me
its version.

If this app has **no `infra/` directory** — some forks run on PM2 or were never
deployed to ECS — this retrofit is **not applicable**. Say so, record it as
`not-applicable`, and stop.

### Who I am

Assume I may **not** be a developer. **You** own the git branch and the edits. The
**deploy is mine** — you prepare it, explain it, and hand it back. Explain
everything in plain language.

### Why this matters (so you can explain it to me)

RDS gp2 sizes disk performance from the **volume size**: 3 IOPS per GiB, with a
floor of 100 IOPS. This app's database is almost certainly **20 GiB**, so its
**baseline is 100 IOPS**. It reaches 3,000 IOPS only by spending a **burst credit
balance**, which refills slowly and can be drained by a migration, a seed, a
backfill, a `pg_restore`, or one badly-planned query doing a sequential scan.

When the balance hits zero the database does not error and does not page anyone —
it just runs at 100 IOPS. What you see instead is the app getting mysteriously,
persistently slow, hours after the thing that actually caused it. This is one of
the least legible failure modes in the stack, and it is a **configuration
default**, not a capacity problem.

gp3 removes the mechanism entirely: a flat **3,000 IOPS and 125 MiB/s**, always,
with no credits to run out of. On RDS, gp2 and gp3 cost the **same per GiB-month**
(unlike EC2's EBS, where gp3 is cheaper), so this is a **reliability change, not a
cost saving** — do not tell me it will save money.

### What can actually go wrong (read this before touching anything)

The conversion is documented by AWS as **online**: no downtime, no reboot. The
instance enters `storage-optimization` and keeps serving; expect added latency of
**under ~10 ms** while it runs. At 20 GiB it is quick. That is the easy part.

Three things are genuinely worth knowing, and you must carry all three into your
handback:

1. **`cdk diff` will most likely say the database "may be replaced".**
   CloudFormation's changeset reports `StorageType` as a *conditional* replacement.
   This is a **known CloudFormation reporting defect**
   ([coverage-roadmap #1788](https://github.com/aws-cloudformation/cloudformation-coverage-roadmap/issues/1788));
   AWS documents `StorageType` as a **"Some interruptions"** update, and RDS
   performs it in place. **Do not let this scare either of us into cancelling
   mid-deploy** — a cancelled RDS storage modification is worse than a completed
   one. But also **do not take my word or yours for it**: confirm with a real
   changeset before deploying (step 3), and take a snapshot first (step 4).

2. **The change is effectively one-way for 6 hours.** Once RDS starts the
   modification, it refuses any further storage change — size, type, or
   performance — for roughly **6 hours**. So:
   - If the stack update fails for *any* reason in that window, CloudFormation's
     automatic rollback will try to set the storage back to gp2, RDS will reject
     it, and the rollback itself fails — leaving the stack in
     **`UPDATE_ROLLBACK_FAILED`**
     ([coverage-roadmap #1499](https://github.com/aws-cloudformation/cloudformation-coverage-roadmap/issues/1499)).
     Recovering means continuing the rollback while skipping the DB resource, or
     waiting out the 6 hours. **Tell me this before I deploy, not after.**
   - Therefore: deploy **only this change**. Do not bundle it with a storage
     resize, an instance-class change, an engine upgrade, or anything else that
     touches the DB resource. If this app's `infra/` has other uncommitted or
     unreleased CDK drift, deploy that **separately and first**, and let it settle.
   - Do not "undo" it by flipping back to gp2 if it looks slow. There is nothing
     to undo; gp3 at 20 GiB is strictly faster than gp2 at 20 GiB.

3. **Storage autoscaling can collide with it.** The template sets
   `maxAllocatedStorage` to twice `allocatedStorage`. If RDS happens to trigger an
   autoscale event around the same time, one of the two modifications loses. This
   is unlikely at 20 GiB but it is the reason to check the instance is in
   `available` state, with no modification pending, immediately before deploying.

### Operating principles

1. **Do not break this app.** This is one property. If you find yourself
   restructuring the RDS construct, stop and ask.
2. **Do not deploy.** Not staging, not production. You prepare and verify; I run
   `make <env>-infra-deploy`.
3. **Staging first, always**, and let staging fully settle (instance back to
   `available`, `storage-optimization` finished) before production goes.
4. **Read-only AWS calls are fine** — `describe-db-instances`, `cdk diff`,
   changeset creation with `--no-execute`. Anything that mutates is mine.

### Step 1 — find out what this app actually has

Do not assume. Read this app's `infra/lib/stack.ts` (or equivalent) and its
environment config, and report:

- Whether `storageType` is set at all on the RDS construct. **If it is already
  `GP3`, this retrofit is already applied** — verify against the live instance
  (below), record it, and stop.
- The `allocatedStorage` / `dbAllocatedStorage` value per environment, and
  `maxAllocatedStorage`.
- Whether the app uses `rds.DatabaseInstance` (the template's shape) or something
  else — `DatabaseCluster` / Aurora is a **different** storage model and this
  retrofit does **not** apply to it. If you find Aurora, say so and stop.
- Whether there is more than one database instance (some forks added a replica or
  a second instance for a capability).

Then check what is actually running, for each environment this app has:

```bash
aws rds describe-db-instances --profile labs-power --region eu-central-1 \
  --query 'DBInstances[].{Id:DBInstanceIdentifier,Status:DBInstanceStatus,Type:StorageType,Alloc:AllocatedStorage,Max:MaxAllocatedStorage,Iops:Iops,Class:DBInstanceClass}' \
  --output table
```

Report the table to me. Three outcomes worth calling out explicitly:

- **`gp2`** — the expected case; proceed.
- **`gp3` already** — someone changed it by hand in the console. The CDK change is
  then a **no-op that reconciles drift**, which is still worth doing (otherwise the
  next unrelated `cdk deploy` would try to set it *back* to gp2). Say clearly that
  this is what is happening, because the risk profile is completely different.
- **`standard`** (magnetic) — AWS has deprecated it and auto-migrated volumes to
  gp3; treat as the drift case above and tell me.

If the AWS CLI is not configured or the profile does not resolve, say so and
continue with the code change — the live check is diagnostic, not blocking.

### Step 2 — make the change

In this app's RDS construct, add `storageType` alongside the existing storage
props. Match `<TEMPLATE_PATH>/infra/lib/stack.ts`:

```ts
allocatedStorage: config.dbAllocatedStorage,
maxAllocatedStorage: config.dbAllocatedStorage * 2,
storageType: rds.StorageType.GP3,
storageEncrypted: true,
```

Carry the template's explanatory comment across, adapted to this app's wording.
Future readers need to know why it is pinned, or someone deletes it as noise.

**Do not add `iops`. Do not add `storageThroughput`.** Below 400 GiB, gp3 on RDS
PostgreSQL has **no provisionable range** above the 3,000 IOPS / 125 MiB/s
baseline; passing either value makes RDS reject the modification. CDK will happily
synthesize them — the failure surfaces at deploy time, mid-modification, which is
the worst place for it. Confirm the synthesized template has **`StorageType: gp3`
and no `Iops` / `StorageThroughput` key at all**:

```bash
npx cdk synth <stack-name> 2>/dev/null | grep -A3 -i 'StorageType\|Iops\|StorageThroughput'
```

If this app's `dbAllocatedStorage` is **already at or above 400 GiB**, the rules
change — the baseline rises to 12,000 IOPS / 500 MiB/s and provisioning *is*
available. Stop and ask me; do not guess at values.

### Step 3 — prove it is not a replacement

Run a diff for **staging**:

```bash
make staging-infra-diff
```

Expect a modification of `AWS::RDS::DBInstance` showing `StorageType` going to
`gp3`, and — very likely — CDK annotating it as **"may be replaced"**. That
annotation is the known CloudFormation defect from above, not reality. Prove it
rather than asserting it, with a changeset that you **do not execute**:

```bash
npx cdk deploy <staging-stack> --no-execute --change-set-name gp3-check \
  --profile labs-power

aws cloudformation describe-change-set --profile labs-power --region eu-central-1 \
  --stack-name <staging-stack> --change-set-name gp3-check \
  --query 'Changes[?ResourceChange.ResourceType==`AWS::RDS::DBInstance`].ResourceChange.{Action:Action,Replacement:Replacement,Scope:Scope}' \
  --output table
```

`Replacement: Conditional` (or `False`) with `Scope` containing `Properties` is the
expected, safe result. **`Replacement: True` is a hard stop** — that means
something *else* in the diff is replacing the database, and this retrofit is not
what is causing it. Delete the changeset, show me the full diff, and do not
proceed.

Then delete the changeset so it does not linger:

```bash
aws cloudformation delete-change-set --profile labs-power --region eu-central-1 \
  --stack-name <staging-stack> --change-set-name gp3-check
```

Show me the diff output and the changeset table before we go further.

### Step 4 — the snapshot (write it into the handback, do not run it)

Production has `deletionProtection: true` and `RemovalPolicy.RETAIN` in the
template, so an accidental replacement fails rather than destroys. **Staging has
neither** — `deletionProtection: false`, `RemovalPolicy.DESTROY`. Check what *this*
app actually sets and tell me, because it decides how much the snapshot matters.

Give me the exact snapshot command for each environment to run **before** its
deploy, with the real instance identifiers filled in:

```bash
aws rds create-db-snapshot --profile labs-power --region eu-central-1 \
  --db-instance-identifier <real-instance-id> \
  --db-snapshot-identifier <app>-<env>-pre-gp3-$(date +%Y%m%d)
```

Note that the snapshot itself is online and takes a few minutes, and that the
deploy should wait for it to reach `available`.

### Step 5 — write the handback runbook

Do not deploy. Produce the ordered list I will actually follow:

1. Confirm the instance is `available` with no modification pending (the
   `describe-db-instances` command from step 1).
2. Take the snapshot (step 4); wait for `available`.
3. `make staging-infra-deploy`.
4. Watch it: the instance goes `modifying` → `storage-optimization` →
   `available`. Give me the polling command and roughly how long to expect at this
   app's size.
5. Confirm `StorageType` is `gp3` and the app still serves traffic.
6. **Only after staging is fully back to `available`**, repeat for production:
   snapshot, `make prod-infra-deploy`, watch.
7. What to do if the stack update fails: **do not** immediately retry, and **do
   not** revert the code to gp2 — the 6-hour lock will turn a failed update into a
   failed *rollback*. Contact a developer / `#topic-mapp-labs`.

Include the exact command names this app uses. If its Makefile targets are named
differently from `staging-infra-deploy` / `prod-infra-deploy`, use the real ones.

### Verify and hand back

- Type-check the infra package (`npx tsc --noEmit` in `infra/`, or whatever this
  app uses).
- Run the app's test suite if `infra/` has one; add nothing new unless this app
  already snapshot-tests its CDK stack, in which case update the snapshot.
- `git diff` should be **one property plus a comment** in the CDK stack, plus docs.
  If it is bigger than that, explain every extra line.
- Update this app's deployment docs where they describe the database — the
  template's `docs/template/DEPLOYMENT.md` has a **"Storage type — gp3, not gp2"** section
  under *Database Management* and mentions `20 GiB gp3` in its resource tables. Port
  the equivalent.
- **Do not deploy.**

### Record state

Before handback, write/update **`.retrofit-state.json` at this app's repo root**
(create if absent), following `<TEMPLATE_PATH>/docs/retrofit/RETROFIT-STATE.md`.
Upsert under `retrofits["2026-09-10-rds-gp3-storage"]` with `status` (use
`partial` until I have actually deployed both environments — the code change alone
does not change the running database), `templateVersion` + `templateRef`, an
ISO-8601 UTC `at` (`date -u +%Y-%m-%dT%H:%M:%SZ`), `by`, and `notes` +
`deviations`. Good things to record: the live `StorageType` you observed per
environment before the change, the real instance identifiers, `allocatedStorage`,
whether the instance was already drifted to gp3, and whether either environment
has been deployed yet. Refresh `template.lastRetrofitAgainstVersion` /
`lastRetrofitAgainstRef` / `lastRetrofitAt`; don't remove other entries.

### Plain-language handback

1. What changed: **one line of infrastructure config**. The database's disk goes
   from a type whose speed depends on how big it is (and on a credit balance that
   can silently run out) to one that is fast at a fixed rate. It costs the same.
2. That nothing happens until **I** run `make <env>-infra-deploy`.
3. **The downtime answer, plainly:** AWS performs this conversion **online** — the
   database stays up, does not reboot, and connections are not dropped. During the
   `storage-optimization` window afterwards, disk operations may be a few
   milliseconds slower; at this app's size that window is short. **Plan it for a
   quiet period anyway.** Do not run it alongside a release, a large migration, or
   a data import.
4. **The real risk is not downtime, it's the 6-hour lock.** Once started, RDS
   refuses further storage changes for ~6 hours, and a stack update that fails in
   that window can leave CloudFormation stuck in `UPDATE_ROLLBACK_FAILED`. So:
   deploy this change **on its own**, staging first, and if it fails, stop and get
   a developer rather than retrying.
5. That `cdk diff` will probably warn the database **"may be replaced"**, that this
   is a known CloudFormation display bug, that you verified with a changeset that
   it is not a replacement — and that I should **not cancel the deploy partway
   through** on the strength of that warning.
6. The snapshot commands, and that taking one first is the actual safety net.
7. Every **deviation** from the template and why.
8. If anything got complicated and I didn't have an answer, remind me I can ask in
   **#topic-mapp-labs**.

## PROMPT END
