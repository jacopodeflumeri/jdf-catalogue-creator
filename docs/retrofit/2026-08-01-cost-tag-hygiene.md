# Retrofit prompt — Cost tag hygiene (`AppOwner` tag + ECS task propagation)

> Implements the **2026-08-01 "Cost tag hygiene"** entry in
> [`MIGRATION.md`](../../MIGRATION.md).
>
> **Applies to every fork.** Two changes: a new `AppOwner` tag that identifies the
> app's *current* budget holder (distinct from `CreatedBy`, which records who
> originally built it), and a check that every ECS service propagates its tags to
> its running tasks. The second one is the important one — a service that does not
> propagate tags bills its **entire Fargate compute untagged**, which for most apps
> is the single largest line item. Across the fleet this is the biggest single
> source of unattributable spend, and it makes affected apps look dramatically
> cheaper than they are.
>
> Small change: a couple of `app.config.json` fields, one CDK property per ECS
> service, and tags on out-of-band resources. **No schema, SSM, or source changes.**
> It does require a **deploy** to take effect — tags reach tasks only when tasks
> restart — but a human decides when that happens.

---

## How to use this prompt

1. Pull a **fresh copy of `labs-app-template`** into a separate directory.
2. Open **your app** in your agent.
3. Replace `<TEMPLATE_PATH>` below, then paste **PROMPT START** → **PROMPT END**.

```
<TEMPLATE_PATH> = /absolute/path/to/your/fresh/labs-app-template
```

> **Not built from this template?** If your system is a hand-rolled stack, a raw EC2
> box, or anything without `app.config.json`, use
> [`docs/template/platform/COST_TAGGING_PROMPT.md`](../template/platform/COST_TAGGING_PROMPT.md) instead — it's
> self-contained and doesn't assume a template checkout.

---

## PROMPT START

You are applying a **cost-tagging** pass to the **current project** (an existing Mapp
Labs app). Goal: make this app's AWS spend correctly attributable to the app and to a
person in the monthly cost report. Two parts — a new `AppOwner` tag, and making sure ECS
services propagate tags to their tasks.

The authoritative reference is a fresh checkout of `labs-app-template` at:

    <TEMPLATE_PATH>

If that path is the literal placeholder, empty, or not a `labs-app-template` checkout
(no `app.config.json`, no `infra/bin/infra.ts`), **stop and ask me for the correct
path.** Also remind me to have pulled the **latest** template, and tell me its version.

### Who I am

Assume I may **not** be a developer. **You** own the git branch and the edits. The one
thing you must **not** do yourself is **deploy** — that's mine. Explain everything in
plain language.

### Why this matters (so you can explain it to me)

AWS bills Fargate vCPU/GB-hours against the **running task**, not the ECS service.
Tags land on tasks only if the service is configured to propagate them. If it isn't,
the app's compute is billed with **no `Project` tag at all** — invisible to per-app
reporting — even though the service, load balancer, and database are tagged fine. The
app then shows up in the cost report far cheaper than it really is, and the missing
money lands in a shared "unattributed" bucket nobody owns.

### Operating principles

1. **Do not break this app.** These are additive tag changes. If any step looks like
   it would alter runtime behaviour beyond a rolling restart, stop and ask.
2. **The template is the reference target, not a literal source to copy.** Match its
   conventions; adapt to this app's structure.
3. **Never tag shared infrastructure.** The VPC, subnets, Transit Gateway, Route 53
   hosted zone, and shared buckets (e.g. `mapp-labs-data-sync`) are imported, not
   owned by this app. CDK won't tag imported resources and neither should you — a
   per-app tag on shared infra corrupts every other app's numbers.
4. **Ask rather than guess about identity.** A wrong `AppOwner` bills the wrong person,
   which is worse than an empty one.

### Step 1 — add the `AppOwner` tag

Compare this app's `app.config.json` and `infra/bin/infra.ts` against the template's.

In **`app.config.json`**, add an `appOwner` field next to `createdBy`:

```json
"team": "",
"appOwner": "",
"createdBy": "",
```

> **Why `AppOwner` and not `Owner`?** Many resources in this account already carry
> an AWS-set `Owner: AWSCloudFormation` tag — CloudFormation stamps it on ECS
> clusters. We can't remove it, and it would swamp per-person grouping with a value
> nobody controls. `AppOwner` is unambiguous and ours. Don't "simplify" it back to
> `Owner`.

Then ask me who the owner is and fill it in. Rules — these matter more than they
look, because the report groups on the exact string:

- Format is **`firstname.lastname`**: lowercase, dot-separated, **no `@mapp.com`**.
  `Jane.Doe`, `jane.doe@mapp.com`, and `janed` are three
  different people to the billing system. This has already happened in real data.
- It must be a **human**. Not a team, not `labs`, not `Mapp Labs`, not a product name.
  Non-human values are reported as unattributed.
- `AppOwner` is who owns the budget **today**. `CreatedBy` is who first built the app and
  never changes. If the app has changed hands they differ — that's the whole point of
  the new tag. Propose `createdBy`'s value as the default, but ask me to confirm, and
  normalize it to the format above if it isn't already.

While you're there, check `team` and `product` too:

- `product` must be exactly one of `fashion`, `engage`, `intelligence`, `internal` —
  it's the product **line** this app rolls up to, **not** the app name (`Project`
  already carries that).
- `team` is **free text — there is no approved list.** Put whatever team name I
  give you. Do not block on it, do not try to map it onto some canonical set, and
  do not leave it empty just because you're unsure. If I already have a spelling in
  mind, use mine verbatim.

  The one *suggestion* (not a rule): if other apps I own already spell the team a
  particular way, reusing that spelling makes it group more neatly in a
  spreadsheet. `Deliverability` and `deliverability` will show up as two labels if
  someone pivots on the column. That's cosmetic — nothing in the cost report groups
  by team, so an inconsistent spelling costs nothing and is never worth a delay.

In **`infra/bin/infra.ts`**, port the template's `AppOwner` entry into the
`costAllocationTags` object, plus the warning block beneath it:

```ts
AppOwner: appConfig.appOwner || appConfig.createdBy || "",
```

The key is **`AppOwner`**, and the config field is **`appOwner`** — check both
spellings against the template rather than trusting this snippet. The fallback to
`createdBy` matters: it means an app that hasn't filled in `appOwner` yet still
attributes to somebody instead of dropping into "unattributed".

Copy the template's comment explaining why `AppOwner` and `CreatedBy` are separate. The
warning block only warns — it must **never** fail the synth. A deploy must not break
because someone's name is formatted oddly.

### Step 2 — fix ECS tag propagation (the important one)

Find **every** ECS service this app defines — the main one plus any workers,
sidecars, or extra services added since the fork. In the CDK this is any
`FargateService`, `ApplicationLoadBalancedFargateService`, or `Ec2Service`.

Each one needs **both** of:

```ts
enableECSManagedTags: true,
propagateTags: ecs.PropagatedTagSource.SERVICE,
```

Miss one service and that service's compute stays untagged, so grep rather than
eyeball it. Compare against how the template's `infra/lib/stack.ts` does it.

Now check what's actually deployed, which may differ from the code:

```bash
export AWS_PROFILE=labs-power AWS_REGION=eu-central-1

for C in $(aws ecs list-clusters --query 'clusterArns[]' --output text); do
  for S in $(aws ecs list-services --cluster $C --query 'serviceArns[]' --output text); do
    aws ecs describe-services --cluster $C --services $S \
      --query 'services[0].[serviceName,propagateTags,enableECSManagedTags]' --output text
  done
done | grep -i <this app's name>
```

You want `SERVICE` and `True`. Anything else is broken for billing.

**Fix it in the CDK source, not with a live `update-service`.** A live change is
reverted by the next deploy and the problem silently returns. Tell me the live state
so I know whether the deploy will actually change anything.

**Tags only reach tasks started after the deploy.** Existing tasks keep running
untagged until replaced, so billing corrects itself gradually. Say this plainly in
your handback — I should not expect the numbers to change overnight.

### Step 3 — tag out-of-band resources

Some resources are created outside CDK and so miss the app-level tags. Check and fix
each. Ask me before creating anything; only add tags to what already exists.

```bash
APP=<appName from app.config.json>
OWNER=<owner>

# ECR repo — shared across environments, so NO Environment tag
aws ecr tag-resource \
  --resource-arn $(aws ecr describe-repositories --repository-names $APP \
                   --query 'repositories[0].repositoryArn' --output text) \
  --tags Key=Project,Value=$APP Key=AppOwner,Value=$OWNER Key=Product,Value=<product>

# S3 buckets — per environment.
# put-bucket-tagging REPLACES the whole tag set: read existing tags and merge first.
aws s3api get-bucket-tagging --bucket <bucket>
aws s3api put-bucket-tagging --bucket <bucket> \
  --tagging 'TagSet=[{Key=Project,Value='"$APP"'},{Key=AppOwner,Value='"$OWNER"'},{Key=Environment,Value=<env>}]'
```

Then sweep for anything else of this app's that has no `Project` tag — EBS volumes
and Elastic IPs are the two most commonly missed, and both bill real money:

```bash
aws resourcegroupstaggingapi get-resources \
  --query 'ResourceTagMappingList[?!not_null(Tags[?Key==`Project`].Value | [0])].ResourceARN' \
  --output text | tr '\t' '\n' | grep -i $APP
```

Show me what you find and what you propose to tag **before** applying anything. If a
resource might be shared with another app, leave it and flag it.

### Verify and hand back

- Run `npm run type-check` and `npm test`, plus `cd infra && npx cdk synth -c env=staging`
  to confirm the stack still synthesizes and to surface the new tag warnings.
- Confirm the synthesized template carries `AppOwner` — e.g. grep the synth output, or
  `npx cdk diff -c env=staging` to show me the tag additions.
- **Do not deploy.** Tell me a deploy is required for the ECS change to take effect,
  and that it is a normal rolling restart.

### Record state

Before handback, write/update **`.retrofit-state.json` at this app's repo root**
(create if absent), following `<TEMPLATE_PATH>/docs/retrofit/RETROFIT-STATE.md`.
Upsert this retrofit under `retrofits["2026-08-01-cost-tag-hygiene"]` with `status`
(applied / partial / skipped / not-applicable), `templateVersion` + `templateRef`, an
ISO-8601 UTC `at` (`date -u +%Y-%m-%dT%H:%M:%SZ`), `by`, and `notes` + any
`deviations`. Good things to record: how many ECS services needed the propagation fix
and which, whether `AppOwner` differs from `CreatedBy`, which out-of-band resources you
tagged, and anything you deliberately left alone as shared. Refresh
`template.lastRetrofitAgainstVersion` / `lastRetrofitAgainstRef` / `lastRetrofitAt`;
don't remove other entries.

### Plain-language handback

1. Who you set as `AppOwner`, and whether that differs from `CreatedBy`.
2. **How many ECS services were not propagating tags** — and therefore roughly how
   much of this app's compute has been billing untagged.
3. That a **deploy is needed**, and that billing corrects gradually as tasks recycle,
   not immediately.
4. That the **per-person numbers won't move until `AppOwner` is activated** as a cost
   allocation tag in the payer account (`787184414136`) — a one-time action by
   whoever has billing admin, which nobody can do from `labs-power`. Until then the
   cost report falls back to `CreatedBy`. **This is not a reason to delay**: tags must
   exist before activation can pick them up, and AWS's backfill can only replay
   activation for tags that were already on the resources. Tag now, activate later.
5. Which out-of-band resources you tagged, and anything you couldn't tag or left
   alone because it looked shared. A known gap is fine; a false all-clear is not.
6. Every **deviation** from the template and why.
7. If anything got complicated and I didn't have an answer, remind me I can ask in
   **#topic-mapp-labs**.

## PROMPT END
