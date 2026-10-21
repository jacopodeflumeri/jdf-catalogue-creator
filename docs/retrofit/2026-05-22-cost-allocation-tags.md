# Retrofit prompt — Cost allocation tags

> Implements the **2026-05-22 "Cost allocation tags + AWS↔LiteLLM reconciliation"**
> entry in [`MIGRATION.md`](../../MIGRATION.md).
>
> **Mandatory infra / applies to every fork deployed to AWS via CDK.** Makes AWS spend
> attributable per **app** / **environment** / **product**, and aligns the AWS tags
> with LiteLLM spend metadata so the two can be reconciled. Independent of the UPC chain.
>
> The agent prepares the CDK / script / config / doc changes on a branch. **A human
> deploys and backfills; a billing admin activates the tag keys in the management
> account** (a cross-account step the agent cannot do).

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

You are adding the template's **cost-allocation tagging** to the **current project** (an
existing Mapp Labs app) so its AWS spend is attributable by **app** (`Project`),
**environment** (`Environment`), and **product line** (`Product`), and so AWS cost can
be reconciled with LiteLLM (AI) spend.

The authoritative reference is a fresh checkout of `labs-app-template` at:

    <TEMPLATE_PATH>

If that path is the literal placeholder, empty, or not a `labs-app-template` checkout
(no `docs/template/COST_ALLOCATION.md`, no `infra/bin/infra.ts`), **stop and ask me for the
correct path.** Also remind me to have pulled the **latest** template, and tell me its
version.

### Who I am

Assume I may **not** be a developer and cannot run AWS or CDK commands myself. **You**
own the git branch and prepare the changes; deploys, AWS backfill, and the
billing-account activation are steps for me or a technical/DevOps person. Explain
everything in plain language.

### Is this for my app?

Any app deployed to AWS via this template's CDK (`infra/`) should have this — it's
mandatory infra. If this app isn't deployed to AWS at all, it may not apply; tell me.

### Operating principles (read before touching anything)

1. **The template is the reference design, not a literal source to copy.** Match its
   model/conventions; adapt to this app's `infra/`. **No equivalent paradigm → lean
   toward the template's reference architecture.**
2. **Above all, do not break this app** (or its deploy). Safest change over a risky one.
3. **Copy verbatim only where clearly safe;** otherwise port the *pattern* into this
   app's existing infra files (don't overwrite a diverged stack wholesale).
4. **Surface every deviation** and why.
5. **My libraries (CDK version, etc.) may differ;** adapt to what's here.
6. **Reuse shared infrastructure — never duplicate per app.** And (critical here)
   **never tag shared cross-project infra** — see the guardrail below.
7. **Keep libraries reasonably current — toward this template, not the bleeding edge**
   (supply-chain caution; never bump to newest *public* just because it exists).
8. **When something is genuinely complex/risky/ambiguous and I can't answer, tell me to
   get help — don't guess.** Stop and ask; if I don't know, point me to
   **#topic-mapp-labs** / **#topic-ai-support**.
9. **Converge to the reference architecture, and clean up what you replace — scoped to
   this app, never overreaching.** Propose AWS changes as reviewable commands; never
   auto-run them or touch shared infra / other apps.

### Step 0 — Branch and assess

1. Create a git branch (e.g. `retrofit/cost-allocation-tags`). All work goes here.
2. Read, in the template: `docs/template/COST_ALLOCATION.md` (the model + the DevOps activation
   runbook + the backfill + "tagging infrastructure you add"), `infra/bin/infra.ts`
   (the `cdk.Tags.of(app)` block), `infra/lib/stack.ts` (the ECS
   `propagateTags`/`enableECSManagedTags` + the `NEXT_PUBLIC_ENVIRONMENT` / `APP_PRODUCT`
   container env), `infra/lib/config/environments.ts` (`product`),
   `scripts/deploy/{_config.sh,first-deploy.sh}` (ECR `--tags`), `scripts/setup.sh`,
   `infra/lib/config/__tests__/environments.test.ts`, and `AGENTS.md`. Read the
   **2026-05-22** entry in `MIGRATION.md`.
3. In **this** app, find: `app.config.json` (does it have a `product` field?), how its
   infra applies tags today (per-stack `StackProps.tags` vs app-level), whether it has a
   stale/duplicate `CostCenter` tag, the ECS service config, and the ECR/S3 creation
   scripts. Note how many CDK stacks the app defines.

### Step 1 — The `product` line (ASK me)

Set `app.config.json` `product` to the Mapp **product line** this app rolls up to —
one of `fashion` | `engage` | `intelligence` | `internal`. **This is the product
*line*, NOT the app name** (the app name is already the `Project` tag). **Ask me which
line** (if the app already sets `APP_PRODUCT` for LiteLLM, use that exact value).
Plumb it through `infra/lib/config/environments.ts` (`EnvironmentConfig.product`) so the
tag and the container `APP_PRODUCT` come from one source.

### Step 2 — App-level cost tags (`infra/bin/infra.ts`)

Apply tags with `cdk.Tags.of(app).add(key, value)` (skip empty values):
`Project` = `appName`, `Environment` = env, `Product` = `product`, plus `Team` /
`ManagedBy` / `CreatedBy` from `app.config.json`.
- If this app currently tags **per-stack** (`StackProps.tags`), move to **app-level**
  `cdk.Tags.of(app)` so any stack the app adds later inherits them. (For a strictly
  single-stack app, per-stack still works — but prefer app-level to match the template.)
- **Remove a duplicate `CostCenter` tag** if present (the template dropped it). If this
  app genuinely relies on `CostCenter` for something, flag it instead of removing.

### Step 3 — ECS task tag propagation + env (`infra/lib/stack.ts`)

On the Fargate **service**, set `enableECSManagedTags: true` and
`propagateTags: ecs.PropagatedTagSource.SERVICE`. **Without this, Fargate compute usage
— usually the biggest line item — carries no tags in the Cost & Usage Report.** Also set
the container env `NEXT_PUBLIC_ENVIRONMENT: config.envName` and
`APP_PRODUCT: config.product` (a missing `NEXT_PUBLIC_ENVIRONMENT` makes the LLM module
mislabel staging AI spend as production). If the app defines a **second Fargate
service**, set the same two flags on it.

### Step 4 — Out-of-band resources (ECR / S3)

Update the ECR creation in `scripts/deploy/{first-deploy.sh,_config.sh}` to create the
repo `--tags Key=Project,… Key=Product,… Key=ManagedBy,…` (ECR is one shared repo per
app across envs → **no `Environment` tag**). For S3, `aws s3 mb` can't tag, so a
`put-bucket-tagging` step applies `Project` + `Environment` + `Product` (per-env). Match
the template's scripts, adapting to this app's deploy scripts.

### Step 5 — Setup prompt + test guard

Add the product-line prompt to `scripts/setup.sh` (writes `product` to
`app.config.json`), and bring `infra/lib/config/__tests__/environments.test.ts` (guards
that `product` is plumbed into every `EnvironmentConfig`), adapting to this app.

### Step 6 — Docs + agent rules

Bring the template's `docs/template/COST_ALLOCATION.md` into this app (as
`docs/COST_ALLOCATION.md`, or `docs/template/COST_ALLOCATION.md` in apps on the 2026-10-17 docs layout). If this app has an `AGENTS.md` /
`CLAUDE.md`, add the template's rule that **added infra must carry the cost tags (and
shared infra must not)**, plus the "bump the version before a deploy-on-behalf" reminder.

### ⚠️ Guardrail — never tag shared cross-project infra

Do **not** put per-app `Project`/`Product` tags on the **VPC, subnets, Transit Gateway,
Route53 hosted zone, or shared buckets** (e.g. `mapp-labs-data-sync`). They're imported
and used by many apps; tagging them is misleading and breaks other apps' attribution.
Per-app tags belong only on resources this app owns. (CDK won't tag imported resources;
don't add tags to them by hand either.)

### Human / DevOps steps (you prepare; you do NOT run these)

Produce these as a clear, ordered checklist for me — **do not run AWS or CDK yourself**:
1. **Deploy:** `cdk diff` then `make <env>-infra-deploy` (staging, then production).
   New Fargate tasks pick up the tags; old ones don't.
2. **Backfill** existing resources (give me the exact scoped commands, for review):
   `aws ecr tag-resource` for this app's repo (Project + Product), and
   `aws s3api put-bucket-tagging` for this app's per-env buckets (Project + Environment
   + Product). **Don't run them.**
3. **Activate the Cost Allocation Tag keys** (`Project`, `Environment`, `Product`,
   `Team`, `ManagedBy`, `CreatedBy`) in the **management/payer account `787184414136`**
   — this **cannot** be done from the labs deploy account (`936190502406`) or the
   `labs-power` profile, and it's **not retroactive**. Hand whoever has billing admin
   the runbook in `docs/template/COST_ALLOCATION.md` §2. If no one knows who that is, ask in
   **#topic-mapp-labs** / **#topic-ai-support**.

### Verify and hand back

- Run the infra typecheck/tests (`npm test` covers `environments.test.ts`); fix what
  your changes broke. **Do not deploy or run AWS commands.**

### Record state

Before the handback, write/update **`.retrofit-state.json` at this app's repo root**
(create it if absent), following `<TEMPLATE_PATH>/docs/retrofit/RETROFIT-STATE.md`.
Upsert this retrofit under `retrofits["2026-05-22-cost-allocation-tags"]` with `status`
(applied / partial / skipped / not-applicable), `templateVersion` + `templateRef` (the
template version and exact git tag/SHA you worked against), an ISO-8601 UTC `at`
(`date -u +%Y-%m-%dT%H:%M:%SZ`), `by`, and `notes` + any `deviations` (note the
`product` line chosen). Refresh `template.lastRetrofitAgainstVersion` /
`lastRetrofitAgainstRef` / `lastRetrofitAt`; don't remove other entries.

Then give me a **plain-language handback**:
1. The `product` **line** chosen and why.
2. What you changed (config, `infra/bin`, `infra/lib/stack.ts`, environments, scripts,
   test, docs, agent rules), and whether you moved per-stack → app-level tags.
3. Anything you **kept/flagged** (e.g. an in-use `CostCenter`).
4. The ordered **human/DevOps checklist**: deploy → backfill (scoped commands) →
   **activate tags in the management account** (non-retroactive).
5. Every **deviation** from the template and why.
6. If anything got complicated and I didn't have an answer, remind me I can ask in
   **#topic-mapp-labs** / **#topic-ai-support**.

## PROMPT END
