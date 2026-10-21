# Retrofit prompt — Per-environment image tags + Fargate `HOSTNAME` fix

> Implements the **2026-05-04 "Per-environment image tags + Fargate `HOSTNAME`
> override"** entry in [`MIGRATION.md`](../../MIGRATION.md).
>
> **Mandatory infra correctness / applies to every fork deployed to AWS via CDK.** Two
> fixes that surfaced together in a labs-trends incident: (1) staging and production
> were coupled to the same `:latest` ECR digest, and (2) Next.js standalone silently
> fails its health check on Fargate without a `HOSTNAME` override. Pure infra/build
> change — no DB/SSM/schema. Independent of the UPC chain.
>
> The agent prepares the CDK + build-script changes on a branch. **A human runs
> `cdk diff` / `cdk deploy`** (staging first).

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

You are applying two AWS deploy-correctness fixes to the **current project** (an
existing Mapp Labs app): **(1)** make the ECS task definition pull a **per-environment**
ECR tag (`<env>-latest`) instead of a shared `:latest`, and **(2)** set the container
`HOSTNAME` to `0.0.0.0` so the Next.js standalone server binds correctly on Fargate.
Pure infra/build change — **no database, SSM, or schema change.**

The authoritative reference is a fresh checkout of `labs-app-template` at:

    <TEMPLATE_PATH>

If that path is the literal placeholder, empty, or not a `labs-app-template` checkout
(no `infra/lib/stack.ts`, no `scripts/deploy/build-and-push.sh`), **stop and ask me for
the correct path.** Also remind me to have pulled the **latest** template, and tell me
its version.

### Who I am

Assume I may **not** be a developer and cannot run AWS/CDK commands myself. **You** own
the git branch; the `cdk diff` / `cdk deploy` are steps for me or a technical person.
Explain everything in plain language.

### Is this for my app?

Any app deployed to AWS via this template's CDK (Fargate/ECS) should have both fixes.
If this app isn't deployed to AWS on Fargate, tell me which fix (if any) still applies.

### Operating principles (read before touching anything)

1. **The template is the reference design, not a literal source to copy.** Match its
   model/conventions; adapt to this app's `infra/` and deploy scripts. **No equivalent
   paradigm → lean toward the template's reference architecture.**
2. **Above all, do not break this app** (or its deploy). Safest change over a risky one.
3. **Copy verbatim only where clearly safe;** otherwise port the *pattern* into this
   app's existing files.
4. **Surface every deviation** and why.
5. **My libraries (CDK version) may differ;** adapt to what's here.
6. **Reuse shared infrastructure — never duplicate per app.**
7. **Keep libraries reasonably current — toward this template, not the bleeding edge.**
8. **When something is genuinely complex/risky/ambiguous and I can't answer, tell me to
   get help — don't guess.** Stop and ask; if I don't know, point me to
   **#topic-mapp-labs** / **#topic-ai-support**.
9. **Converge to the reference architecture, and clean up what you replace — scoped to
   this app, never overreaching.** Propose AWS changes as reviewable commands; never
   auto-run them or touch shared infra / other apps.

### Step 0 — Branch and assess

1. Create a git branch (e.g. `retrofit/per-env-image-tags`). All work goes here.
2. Read, in the template: `infra/lib/stack.ts` (the
   `ecs.ContainerImage.fromEcrRepository(repo, \`${config.envName}-latest\`)` image ref
   and the `HOSTNAME: "0.0.0.0"` container env with its explanatory comment) and
   `scripts/deploy/build-and-push.sh` (the env-scoped tags — `${ENV}-${APP_VERSION}`,
   `${ENV}-latest`, the commit SHA; no shared `:latest`). Read the **2026-05-04** entry
   in `MIGRATION.md`.
3. In **this** app, find: how the CDK stack references the container image today
   (shared `:latest`? a digest? something else?), whether the container env sets
   `HOSTNAME`, and how the build/push script tags images.

### Fix 1 — Per-environment image tag (CDK)

Change this app's ECS task definition to reference `` `${config.envName}-latest` ``
(e.g. `staging-latest` / `production-latest`) instead of a shared `:latest`. A shared
`:latest` couples staging and production to the same digest — a stale `:latest` can
silently roll either environment on the next task restart, and retagging to fix one env
moves the other. Adapt to this app's `envName` / naming.

### Fix 2 — Fargate `HOSTNAME` override (CDK)

Add `HOSTNAME: "0.0.0.0"` to the container environment. Fargate injects `HOSTNAME` as a
non-resolvable task-id value; Next.js standalone (`server.listen(port, HOSTNAME)`) then
`ENOTFOUND`s on container start and **health checks fail silently**. If this app already
sets `HOSTNAME` (or doesn't use the Next standalone server), note that and adapt rather
than blindly adding it.

### Fix 3 — Build script pushes env-scoped tags only

Update this app's `scripts/deploy/build-and-push.sh` (or equivalent) to push only
env-scoped tags: `${ENV}-${APP_VERSION}`, `${ENV}-latest`, and the commit SHA — **no
shared `:latest`**. After this, deploys are independent: `make staging-deploy` only
touches `staging-*` and ECS pulls `staging-latest`; same for production.

### Human steps (you prepare; you do NOT run these)

Give me an ordered checklist — **do not run AWS/CDK yourself**:
1. `npx cdk diff <staging-stack>` and confirm the **only** ECS-related changes are the
   image ref flipping `:latest` → `:${envName}-latest` (plus the `HOSTNAME` env var if
   it wasn't there). **If the diff shows anything else surprising, stop and investigate.**
2. `npx cdk deploy <staging-stack>`; verify `/api/health` (or this app's health route)
   reports the expected version.
3. Repeat `cdk diff` + `cdk deploy` for the **production** stack. This is a no-op for the
   running app (`production-latest` resolves to whatever's already deployed) but corrects
   the task-def reference so the next `make production-deploy` actually rolls.

> **Rollback note:** this does not introduce per-deploy immutable task-def revisions.
> Rolling back is still "re-push the desired image to `${env}-latest` and run
> `make ${env}-deploy` again." Per-deploy immutable revisions are a separate enhancement,
> out of scope here.

### Verify and hand back

- Run the infra typecheck/tests; fix what your changes broke. **Do not deploy.**

### Record state

Before the handback, write/update **`.retrofit-state.json` at this app's repo root**
(create it if absent), following `<TEMPLATE_PATH>/docs/retrofit/RETROFIT-STATE.md`.
Upsert this retrofit under `retrofits["2026-05-04-per-env-image-tags-hostname"]` with
`status` (applied / partial / skipped / not-applicable), `templateVersion` +
`templateRef` (the template version and exact git tag/SHA you worked against), an
ISO-8601 UTC `at` (`date -u +%Y-%m-%dT%H:%M:%SZ`), `by`, and `notes` + any `deviations`.
Refresh `template.lastRetrofitAgainstVersion` / `lastRetrofitAgainstRef` /
`lastRetrofitAt`; don't remove other entries.

Then give me a **plain-language handback**:
1. What you changed (image ref, `HOSTNAME`, build script) and how this app referenced
   the image before.
2. Whether `HOSTNAME` was already handled (and how), if so.
3. The ordered **human checklist**: `cdk diff` (staging) → confirm only the expected
   changes → `cdk deploy` staging → verify health → same for production.
4. Every **deviation** from the template and why.
5. If anything got complicated and I didn't have an answer, remind me I can ask in
   **#topic-mapp-labs** / **#topic-ai-support**.

## PROMPT END
