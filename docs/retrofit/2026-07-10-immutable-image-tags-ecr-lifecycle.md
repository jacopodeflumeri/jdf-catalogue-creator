# Retrofit prompt — Immutable image tags + ECR lifecycle policy

> Implements the **2026-07-10 "Immutable image tags + ECR lifecycle policy"**
> entry in [`MIGRATION.md`](../../MIGRATION.md), **as corrected by the 2026-07-11
> entry** (the register-task-definition path requires `iam:PassRole`, which the
> standard `labs-power`/PowerUserAccess deploy identity does not have).
>
> **The mandatory fix is the ECR lifecycle policy.** It is what actually prevented
> the 2026-07-10 outage and it needs **no elevated IAM**. Finishes the 2026-05-04
> per-env-tag work, which left the ECS task def pointing at the **floating**
> `${envName}-latest`. On 2026-07-10 a bad ECR lifecycle policy expired
> `production-latest` out of ECR: the running task survived, but every new task
> launch (scheduled jobs, `RunTask`, restarts, redeploys) failed with
> `CannotPullContainerError`.
>
> So this retrofit has two parts:
> - **Mandatory (every fork):** install a safe, prefix-/age-scoped ECR lifecycle
>   policy. IAM-free.
> - **Opt-in (only if your deployer has `iam:PassRole`):** flip the task def to an
>   **immutable** `${envName}-${version}` tag and make deploys register real
>   task-def revisions, via a single `immutableDeploy` toggle in `app.config.json`.
>   The default is **off** — floating tag + `update-service --force-new-deployment`,
>   which needs no `iam:PassRole`. **If you deploy with `labs-power` (the standard
>   Mapp Labs identity, AWSReservedSSO_PowerUserAccess), leave the toggle off** —
>   PowerUserAccess denies all `iam:*`, so `register-task-definition` (which needs
>   `iam:PassRole` on the task/exec roles) fails every deploy.
>
> Pure infra/build/deploy change — no DB/SSM/schema.
>
> The agent prepares the CDK + script changes on a branch and applies the ECR
> lifecycle policy (an idempotent, additive CLI call). **A human runs the per-env
> `make <env>-deploy` + `cdk diff`** (staging first).

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

You are applying an AWS deploy-correctness fix to the **current project** (an
existing Mapp Labs app). It has two parts, and the split is the whole point:

1. **Mandatory:** install a **safe ECR lifecycle policy**. This is the actual fix
   for the outage this retrofit exists to prevent, and it needs **no elevated IAM**.
2. **Opt-in (default OFF):** an `immutableDeploy` toggle in `app.config.json` that,
   when on, points the ECS task def at an **immutable** `${envName}-${version}` tag
   and makes each deploy register a new **task-definition revision**. When off (the
   default), the task def tracks the floating `${envName}-latest` tag and deploys
   via `update-service --force-new-deployment`. **The opt-in path requires
   `iam:PassRole`, which the standard `labs-power`/PowerUserAccess deploy identity
   does not have — so leave the toggle off unless a privileged deployer (e.g. a CI
   role) will run deploys.**

Pure infra/build/deploy change — **no database, SSM, or schema change.**

The authoritative reference is a fresh checkout of `labs-app-template` at:

    <TEMPLATE_PATH>

If that path is the literal placeholder, empty, or not a `labs-app-template` checkout
(no `infra/lib/stack.ts`, no `scripts/deploy/deploy-app.sh`, no
`scripts/deploy/set-ecr-lifecycle.sh`), **stop and ask me for the correct path.** Also
remind me to have pulled the **latest** template, and tell me its version.

### Who I am

Assume I may **not** be a developer and cannot run AWS/CDK commands myself. **You**
own the git branch and may run the **one** idempotent ECR CLI call (it only sets a
lifecycle policy — additive, reversible); the `make <env>-deploy` / `cdk diff` are
steps for me or a technical person. Explain everything in plain language.

### Is this for my app?

Any app deployed to AWS via this template's CDK (Fargate/ECS) needs the **mandatory**
ECR lifecycle policy. The **opt-in** immutable-revision path is only worth enabling
if this app's deployer holds `iam:PassRole` (see Fix 2); with the standard
`labs-power` identity, leave it off. If this app isn't deployed to AWS on Fargate,
tell me that only the ECR lifecycle policy might still apply (if it has an ECR repo
at all) and skip the rest.

### Operating principles (read before touching anything)

1. **The template is the reference design, not a literal source to copy.** Match its
   model/conventions; adapt to this app's `infra/` and deploy scripts. **No equivalent
   paradigm → lean toward the template's reference architecture.**
2. **Above all, do not break this app** (or its deploy). Safest change over a risky one.
3. **Copy verbatim only where clearly safe;** otherwise port the *pattern* into this
   app's existing files.
4. **Surface every deviation** and why.
5. **My libraries (CDK version) may differ;** adapt to what's here.
6. **Reuse shared infrastructure — never duplicate per app.** The ECR repo is shared
   across both environments; there is exactly one lifecycle policy.
7. **Keep libraries reasonably current — toward this template, not the bleeding edge.**
8. **When something is genuinely complex/risky/ambiguous and I can't answer, tell me to
   get help — don't guess.** Stop and ask; if I don't know, point me to
   **#topic-mapp-labs** / **#topic-ai-support**.
9. **Converge to the reference architecture, and clean up what you replace — scoped to
   this app, never overreaching.** Propose AWS changes as reviewable commands; the ECR
   lifecycle call is the only one you may run yourself; never `cdk deploy` / touch shared
   infra or other apps.

### Step 0 — Branch and assess

1. Create a git branch (e.g. `retrofit/immutable-image-tags-ecr-lifecycle`). All work
   goes here.
2. Read, in the template: `scripts/deploy/set-ecr-lifecycle.sh` (the three-rule
   policy — the mandatory fix), `infra/lib/stack.ts` (the `APP_VERSION` read from
   `package.json`, the `IMMUTABLE_DEPLOY` toggle read from `app.config.json`, and the
   task-def image that switches between `` `${config.envName}-latest` `` and
   `` `${config.envName}-${APP_VERSION}` `` on that toggle), `scripts/deploy/_config.sh`
   (where the shell side reads `immutableDeploy`), `scripts/deploy/deploy-app.sh` (the
   default `update-service --force-new-deployment` path and the opt-in
   describe → swap image → strip read-only fields → `register-task-definition` →
   `update-service --task-definition` path), `scripts/deploy/build-and-push.sh`
   (pushes both `${envName}-${version}` and `${envName}-latest`),
   `scripts/deploy/full-deploy.sh`, `scripts/deploy/first-deploy.sh`, and the `Makefile`
   `ecr-lifecycle-*` targets. Read the **2026-07-10** and **2026-07-11** entries in
   `MIGRATION.md` — the 2026-07-11 entry is the correction that made the immutable path
   opt-in.
3. In **this** app, find:
   - **whether the ECR repo has a lifecycle policy today**
     (`aws ecr get-lifecycle-policy --repository-name <repo>`), and whether it's a
     dangerous one (a single `tagStatus:any` keep-N rule, or an untagged-**by-count**
     rule — both can expire the running image). **This is the thing that matters most.**
   - **the task-def image reference** — does it point at `${envName}-latest` (the common
     case, if 2026-05-04 was applied), a shared `:latest` (if 2026-05-04 was skipped —
     apply that entry first), a digest, or something else?
   - **how `deploy-app.sh` works** — `--force-new-deployment`, or already registering
     revisions?
   - **who deploys this app** — is it `labs-power`/PowerUserAccess (the standard, which
     denies `iam:PassRole`), or a privileged CI role? This decides whether the opt-in
     immutable path (Fix 2) is even usable.

### Fix 1 (MANDATORY) — Safe ECR lifecycle policy (script; you may run it)

**This is the actual fix for the outage, and it needs no elevated IAM.** Add
`scripts/deploy/set-ecr-lifecycle.sh` (port the template's) and wire it into this app's
first-deploy path + a `make ecr-lifecycle-set` target. It applies a **three-rule**
policy via `aws ecr put-lifecycle-policy` (idempotent full replace):
- keep last N `production-*` (default 10),
- keep last N `staging-*` (default 25) — **separate** from production so staging churn
  can't expire the production image,
- expire **untagged** images by **age** (`sinceImagePushed`, default 14 days) — **not by
  count** (an untagged-by-count rule can delete a child manifest a tagged manifest list
  still references and break the image).

A two-rule (prod/staging only) version is a trap — buildx pushes untagged child
manifests/attestations that only rule 3 catches. Make the counts configurable
(`app.config.json` `ecrKeep*` keys or env overrides), matching the template.

**You may run this one call** (it only sets a lifecycle policy — additive, reversible).
Show me `make ecr-lifecycle-show` (dry-run: the policy it would apply + this repo's
current one) first. If this app already has a **dangerous** policy, note that
`ecr-lifecycle-set` **replaces** it, and that this is the actual fix.

### Fix 2 (OPT-IN, default OFF) — Immutable tag + task-def revisions

**Only wire this on if this app's deployer has `iam:PassRole`.** With `labs-power`/
PowerUserAccess, leave the toggle off and skip the enable step — the default path
already works and needs no IAM.

Introduce **one** committed source of truth both the stack and the deploy script read
— in the template it's `"immutableDeploy": false` in `app.config.json`, read by
`infra/lib/stack.ts` and by `scripts/deploy/_config.sh` (adapt the exact key/name to
this app, but keep it a single value both consumers read, defaulting to the safe
floating path when absent). Then:

- **Default (toggle off):** the task def references the floating `${envName}-latest`
  tag, and `deploy-app.sh` deploys via `aws ecs update-service --force-new-deployment`
  — **no** `register-task-definition`, so no `iam:PassRole`. This is what the app gets
  automatically. Keep `build-and-push.sh` pushing both `${envName}-${version}` and
  `${envName}-latest`.
- **Toggle on:** the stack pins the immutable `` `${config.envName}-${APP_VERSION}` ``
  tag (derive `APP_VERSION` from `package.json`'s `version`; do **not** use a bare
  commit-SHA tag — it isn't `${envName}-`prefixed, so it escapes the lifecycle rules and
  accumulates forever), and `deploy-app.sh` registers a revision per deploy: read the
  service's **current** task def, swap **only** the container image to
  `${ECR_URI}:${envName}-${APP_VERSION}`, strip the read-only fields
  (`taskDefinitionArn`, `revision`, `status`, `requiresAttributes`, `compatibilities`,
  `registeredAt`, `registeredBy`), `register-task-definition`, then
  `update-service --task-definition <new-arn>`. This gives explicit, rollback-able
  revisions: `./deploy-app.sh <env> <env>-<older-version>`.

Keep the image-exists-in-ECR precheck (a pure `ecr:DescribeImages` read — no elevated
perms) in **both** paths.

**IAM prerequisite for the opt-in path.** `register-task-definition` requires
`iam:PassRole` on the task role and execution role embedded in the task def. With the
standard `labs-power` identity (AWSReservedSSO_PowerUserAccess), every deploy fails
with `AccessDeniedException ... iam:PassRole`. To enable the toggle, an admin must
attach this scoped policy to the deployer's permission set (substitute `<ACCOUNT_ID>`
and this app's `<appName>`). Note the trade-off: it lets that principal pass **any**
matching `<appName>-*` role to an ECS task, bounded by the `ecs-tasks` condition:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "AllowPassAppEcsRoles",
    "Effect": "Allow",
    "Action": "iam:PassRole",
    "Resource": [
      "arn:aws:iam::<ACCOUNT_ID>:role/<appName>-*-TaskRole*",
      "arn:aws:iam::<ACCOUNT_ID>:role/<appName>-*-ExecutionRole*"
    ],
    "Condition": { "StringEquals": { "iam:PassedToService": "ecs-tasks.amazonaws.com" } }
  }]
}
```

### Human steps (you prepare; you do NOT run the deploys)

Give me an ordered checklist — **do not run `make <env>-deploy` / `cdk deploy`
yourself**:
1. `make ecr-lifecycle-show` then `make ecr-lifecycle-set` (safe first; fixes the
   expiry footgun immediately — this is the mandatory fix and it's done here).
2. `make staging-deploy`, then `npx cdk diff -c env=staging`. With the toggle **off**
   (the default), confirm there is **no** ECS task-def image change and the deploy runs
   `update-service --force-new-deployment`. Verify `/api/health` reports the expected
   version. **If the diff shows anything surprising, stop and investigate.**
3. Repeat for **production**: `make prod-deploy`, then `npx cdk diff -c env=production`.
4. **Only if you enabled `immutableDeploy` (and your deployer has `iam:PassRole`):** the
   first deploy per env flips the task-def image `staging-latest` → `staging-<version>`
   (an image-content no-op — same digest, new revision); confirm the `cdk diff` shows
   **only** that image change.

> **Why this is safe for the running app:** with the toggle **off** (default), nothing
> about the task-def image changes — deploys just force a new deployment of the same
> floating tag. If you later enable `immutableDeploy`, the first deploy moves `-latest`
> → `-${version}`, which points at the **same digest** the running task already uses
> (the build tags both together) — an image-content no-op, just a new revision.
>
> **Rollback:** with the toggle off, rebuild/push so `${env}-latest` points at the
> desired image and redeploy. With the toggle on, roll back explicitly:
> `./scripts/deploy/deploy-app.sh <env> <env>-<older-version>`, or redeploy the prior
> task-def revision. The lifecycle policy is independent and can stay in either case.

### Verify and hand back

- Run the infra typecheck/tests and `bash -n` on the changed scripts; fix what your
  changes broke. **Do not deploy.**

### Record state

Before the handback, write/update **`.retrofit-state.json` at this app's repo root**
(create it if absent), following `<TEMPLATE_PATH>/docs/retrofit/RETROFIT-STATE.md`.
Upsert this retrofit under
`retrofits["2026-07-10-immutable-image-tags-ecr-lifecycle"]` with `status` (applied /
partial / skipped / not-applicable), `templateVersion` + `templateRef` (the template
version and exact git tag/SHA you worked against), an ISO-8601 UTC `at`
(`date -u +%Y-%m-%dT%H:%M:%SZ`), `by`, and `notes` + any `deviations` (e.g. "app was
still on shared `:latest` — applied 2026-05-04 first", "repo had a `keep-10 /
tagStatus:any` policy — replaced", or "left `immutableDeploy` off — app deploys with
`labs-power`, which lacks `iam:PassRole`"). Record whether the `immutableDeploy` toggle
was left off (default) or enabled, and if enabled, that the deployer holds `iam:PassRole`.
Refresh `template.lastRetrofitAgainstVersion` / `lastRetrofitAgainstRef` /
`lastRetrofitAt`; don't remove other entries.

Then give me a **plain-language handback**:
1. What you changed (the ECR lifecycle policy — the mandatory fix — plus the
   `immutableDeploy` toggle, `deploy-app.sh`, and the task-def image ref) and how this
   app referenced the image / expired images before.
2. What the ECR repo's lifecycle policy was before, and what it is now.
3. Whether you left `immutableDeploy` **off** (default, no `iam:PassRole`) or **on**, and
   — if on — that the deployer has `iam:PassRole` (with the scoped policy above).
4. The ordered **human checklist**: lifecycle set → staging deploy + `cdk diff` +
   health → same for production.
5. Every **deviation** from the template and why.
6. If anything got complicated and I didn't have an answer, remind me I can ask in
   **#topic-mapp-labs** / **#topic-ai-support**.

## PROMPT END
