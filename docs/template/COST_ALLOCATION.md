# Cost Allocation & Metering

How AWS spend produced by an app deployed from this template is tagged, how to
make those tags show up in AWS billing, and how to reconcile AWS cost with
LiteLLM (AI) spend in a billing/metering system.

The goal: attribute every dollar to **app**, **environment**, and **product**,
and — for AI spend specifically — down to the **customer**.

---

## 1. The tagging model

Tags are applied at the **CDK App level** (`infra/bin/infra.ts`, via
`cdk.Tags.of(app).add(...)`). CDK propagates them to every taggable resource it
**creates** in any stack under the app — so additional stacks a project adds
inherit them automatically. Imported/shared resources are never touched (see
"Tagging infrastructure you add" below).

| Tag key | Value | Source | Notes |
|---------|-------|--------|-------|
| `Project` | app name | `app.config.json` → `appName` | The primary per-app key. Equals `APP_NAME`. |
| `Environment` | `staging` \| `production` | CDK context (`-c env=`) | Per-environment key. |
| `Product` | `fashion` \| `engage` \| `intelligence` \| `internal` | `app.config.json` → `product` | Product **line** (rollup), not the app. Mirrors LiteLLM `APP_PRODUCT`. See hierarchy note below. |
| `Team` | team name | `app.config.json` → `team` | Optional org grouping. **Free text — there is no approved list**, and nothing validates it. Reusing a spelling other apps already use keeps a spreadsheet pivot tidy, but nothing in the cost report groups by team, so it's cosmetic. |
| `AppOwner` | `firstname.lastname` | `app.config.json` → `appOwner` (falls back to `createdBy`) | **The per-person billing key.** Current budget holder. Must be a human, lowercase, no `@mapp.com`. |
| `ManagedBy` | free text | `app.config.json` → `managedBy` | |
| `CreatedBy` | free text | `app.config.json` → `createdBy` | Historical: who first built the app. Never changes. Not the billing key — use `AppOwner`. |

### `AppOwner` vs `CreatedBy`

They answer different questions and diverge as apps are handed over. `CreatedBy`
records who *scaffolded* the app and is immutable; `AppOwner` is whose budget the
spend lands in **today**, and is what the monthly per-person report groups on.

`AppOwner` is normalized to lowercase `firstname.lastname` with no email domain
because billing groups on the exact string — `Jane.Doe`, `jane.doe@mapp.com`, and
`janed` are three separate people as far as Cost Explorer is concerned, and that
mix has occurred in practice. `infra/bin/infra.ts` warns at synth time when the
value is empty or misshapen, but never fails the build over it.

It must also be a **person**. Team names and placeholders (`labs`, a product name)
have shown up here; that spend ends up owned by nobody.

> **Systems not built from this template** (hand-rolled stacks, console-created
> resources) have their own self-contained agent prompt:
> [`docs/template/platform/COST_TAGGING_PROMPT.md`](platform/COST_TAGGING_PROMPT.md).

### `Product` ⊃ `Project`: the billing hierarchy

`Project` and `Product` form a two-level hierarchy, and they are **not**
interchangeable:

- **`Project` (the app) is the per-app billing line item.** Every app gets its
  own `Project` value (its `appName`), so each app is billed separately by
  construction — e.g. the FTL app appears as its own line regardless of which
  product line it belongs to.
- **`Product` is the rollup** — the Mapp product *line* (business unit) that the
  app belongs to: `fashion`, `engage`, `intelligence`, or `internal`. It is a
  1:1 attribute of the app (one value per `app.config.json`) and only ever
  groups apps *upward* into a product line; it is never finer-grained than the
  app.

So `Product` should hold the **product line, not the app name** — the app name
is already captured by `Project`. To bill an app on its own, group by `Project`;
to roll several apps up into a product line, group by `Product`; to see an app
within its line, filter `Product` and group by `Project`.

### What carries these tags

| Resource | Tagged? | How |
|----------|---------|-----|
| ECS Fargate service, task def, **running tasks** | ✅ | Stack tags + `propagateTags: SERVICE` + `enableECSManagedTags: true` on the service. The task propagation is what makes Fargate **compute usage** (usually the biggest line item) attributable. |
| RDS instance + secret | ✅ | Stack tag propagation |
| ALB(s), target groups, security groups | ✅ | Stack tag propagation |
| CloudWatch log groups, IAM roles, EventBridge rule, ACM cert | ✅ | Stack tag propagation |
| **ECR repository** | ✅ (`Project`, `Product`, `ManagedBy`) | Created out-of-band by `scripts/deploy/first-deploy.sh` with `--tags`. One shared repo per app → **no `Environment` tag.** |
| **S3 bucket(s)** | ⚠️ manual | Created via `aws s3 mb` (see DEPLOYMENT.md). `aws s3 mb` can't tag, so a `put-bucket-tagging` step applies `Project` + `Environment` + `Product`. |
| VPC, subnets, Transit Gateway, Route53 zone | ➖ shared | Imported, not owned by the app stack. Shared Mapp infra — not per-app cost. |

> **Gotcha that makes or breaks everything:** tags on resources do **not**
> appear in Cost Explorer or the Cost & Usage Report until the tag *keys* are
> activated as Cost Allocation Tags in the payer account. See §2.

### Tagging infrastructure you add

When an app grows beyond the template's baseline stack (e.g. it adds Neo4j, a
search cluster, a queue, a cache), keep the cost tags complete:

| What you add | Do you tag it? | How |
|--------------|----------------|-----|
| **Resources in the existing `AppStack`** (an EC2 instance, EBS volume, OpenSearch domain, SQS queue, …) | ✅ automatic | App-level tags propagate to everything CDK creates. Nothing to do. |
| **A new CDK stack** in the same app (e.g. a dedicated `Neo4jStack`) | ✅ automatic | Because tags are applied with `cdk.Tags.of(app)`, any stack under the app inherits them. |
| **A second Fargate service** | ⚠️ add propagation | Resource tags propagate, but set `enableECSManagedTags: true` + `propagateTags: SERVICE` on the new service too, or its task **usage** records stay untagged (same fix as the main service). |
| **Out-of-band resources** (created via `aws` CLI / console / a script, like ECR and S3) | ⚠️ tag at creation | Pass `Project` + `Product` (+ `Environment` for per-env resources) when you create them, exactly as `first-deploy.sh` does for ECR. |
| **A separate CDK *app*** (its own `cdk.App`) | ⚠️ replicate | App-level tags only cover one app. Apply the same `cdk.Tags.of(app)` block in that app's entry file. |
| **Managed SaaS** (e.g. Neo4j Aura, a third-party API) | ➖ not AWS | Not in the AWS CUR — it's a separate vendor bill. Reconcile it by app outside AWS billing. |

**Do NOT tag shared, cross-project infrastructure.** The VPC, subnets, Transit
Gateway, Route53 hosted zone, and shared buckets (e.g. `mapp-labs-data-sync`) are
used by *many* Labs apps and are imported, not owned, by your stack. CDK won't
tag imported resources, and you shouldn't either — a per-app `Project`/`Product`
tag on shared infra is misleading and breaks other apps' attribution. Per-app
cost tags belong only on resources this app owns.

---

## 2. Activating cost allocation tags (DevOps runbook)

**This is a one-time, account-level action and is required before any of the
tagging shows up in billing reports.** Hand this section to whoever has billing
admin in the payer/management account.

> **Which account?** The labs deployment account **936190502406** is a *linked
> (member)* account in AWS Organization `o-30nryugd8g`. Cost allocation tags
> **cannot** be managed or even listed from a member account — AWS returns
> `AccessDeniedException: Linked account doesn't have access to cost allocation
> tags`. They must be activated in the **management (payer) account
> `787184414136`** (`aws-master@mapp.com`). The `labs-power` profile can't do
> this; you need credentials for the management account.

1. Sign in to the **AWS Billing & Cost Management** console in the **management
   (payer) account `787184414136`** (`aws-master@mapp.com`).

   To check current status from the CLI (run with management-account creds):

   ```bash
   aws ce list-cost-allocation-tags --region us-east-1 \
     --profile <management-account-profile> \
     --query "CostAllocationTags[?contains(['Project','Environment','Product','Team','ManagedBy','CreatedBy','AppOwner'], TagKey)].[TagKey,Type,Status]" \
     --output table
   ```

   Or do the whole thing from the CLI (batch of up to 20 keys per call):

   ```bash
   aws ce update-cost-allocation-tags-status --region us-east-1 \
     --profile <management-account-profile> \
     --cost-allocation-tags-status \
       TagKey=AppOwner,Status=Active \
       TagKey=Project,Status=Active \
       TagKey=Environment,Status=Active \
       TagKey=Product,Status=Active \
       TagKey=Team,Status=Active \
       TagKey=CreatedBy,Status=Active \
       TagKey=ManagedBy,Status=Active
   ```

   Re-activating an already-active key is a no-op, not an error, so this is safe
   to run wholesale. Verify with `list-cost-allocation-tags` above.

2. Or, in the console: **Billing and Cost Management → Cost allocation tags →
   User-defined cost allocation tags**.

3. Select these keys and click **Activate**:

   - `Project`
   - `Environment`
   - `Product`
   - `Team`
   - `ManagedBy`
   - `CreatedBy`
   - `AppOwner` ← **outstanding as of 2026-08-01**

   > **Status (verified 2026-08-01):** the first six are **active** — they return
   > data in Cost Explorer. **`AppOwner` is not**, because it was only introduced
   > on 2026-08-01. Until someone with billing admin in the payer account activates
   > it, per-person attribution falls back to `CreatedBy`.
   >
   > **This is the single blocking dependency for accurate per-person reporting**,
   > and it cannot be done from `labs-power`. Apps should tag with `AppOwner`
   > regardless — activation is not retroactive, so tags applied before activation
   > are exactly what makes the data useful on day one.

   > **Do not use the key `Owner`.** Many resources in this account carry an AWS-set
   > `Owner: AWSCloudFormation` (CloudFormation stamps it on ECS clusters), plus a
   > few `Owner: <someone>@mapp.com` from an earlier ad-hoc convention. Activating
   > `Owner` would group most of the account under `AWSCloudFormation`. That is why
   > the key is `AppOwner`.

   > A key only appears in this list **after** AWS has observed at least one
   > resource carrying it — i.e., after the first deploy. It can take up to ~24h
   > for a newly seen key to show up. If a key is missing, deploy first, wait,
   > then re-check.

4. (Recommended) also activate the AWS-generated key **`aws:createdBy`** under
   the "AWS-generated cost allocation tags" tab for a provider-level audit trail.

5. **Activation is not retroactive by default — but it can be backfilled.**
   Normally only usage from the activation date forward is broken out. AWS also
   offers `StartCostAllocationTagBackfill`, which retroactively applies the
   activation status from a **first-of-month date up to 12 months back**:

   ```bash
   aws ce start-cost-allocation-tag-backfill --region us-east-1 \
     --profile <management-account-profile> \
     --backfill-from 2026-08-01

   # Watch it (runs asynchronously; can only be requested once per 24h)
   aws ce list-cost-allocation-tag-backfill-history --region us-east-1 \
     --profile <management-account-profile> --output table
   ```

   **What backfill can and cannot recover.** It replays the *activation status*,
   not the tags themselves — it can only surface tag values that were **actually
   on the resources at the time**. Backfilling to a month before a key existed
   recovers nothing. So the useful sequence is:

   > tag resources → wait ~24h for AWS to observe the key → activate → backfill
   > from the first of the month in which tagging happened.

   For `AppOwner` specifically: backfilling to any month before apps started
   applying the tag recovers nothing, because no resource carried the key then.
   Backfilling to the first of the month in which tagging happened **will** work.

   Either way: **tag first, activate second.** Activation can be repaired later;
   untagged usage cannot.

6. **To feed a metering system**, set up a **Cost and Usage Report (CUR 2.0 /
   Data Exports)** delivering to S3, and make sure the export includes the
   resource IDs and the `resource_tags_user_project` / `_environment` /
   `_product` columns. Cost Explorer is fine for humans; the CUR is what a
   billing pipeline should ingest. Allow ~24h after activation for tagged data
   to populate.

---

## 3. Backfilling already-deployed apps

If an app was deployed **before** these template changes, do the following once:

```bash
# 1. Redeploy the stack so the ECS service gets propagateTags/enableECSManagedTags.
#    New tasks launched after this deploy carry the tags; old tasks do not.
make staging-infra-deploy   # and prod-infra-deploy

# 2. Tag the existing ECR repo (shared across envs → no Environment tag)
aws ecr tag-resource \
  --resource-arn arn:aws:ecr:eu-central-1:936190502406:repository/{appName} \
  --tags Key=Project,Value={appName} Key=Product,Value={product} \
  --profile labs-power --region eu-central-1

# 3. Tag existing S3 buckets (per-env)
aws s3api put-bucket-tagging --bucket mapp-labs-{appName}-staging --profile labs-power \
  --tagging 'TagSet=[{Key=Project,Value={appName}},{Key=Environment,Value=staging},{Key=Product,Value={product}}]'
aws s3api put-bucket-tagging --bucket mapp-labs-{appName}-prod --profile labs-power \
  --tagging 'TagSet=[{Key=Project,Value={appName}},{Key=Environment,Value=production},{Key=Product,Value={product}}]'
```

---

## 4. Reconciling AWS cost with LiteLLM (AI) spend

This is the part that lets a billing/metering app combine infrastructure cost
and AI cost for the same app, environment, product — and, for AI, the same
customer.

### The shared keys

The template wires the **same identifiers** into both systems by construction:

| Dimension | AWS billing (tag) | LiteLLM spend log (`spend_logs_metadata`) | Same value? |
|-----------|-------------------|-------------------------------------------|-------------|
| App | `Project` | `app` | ✅ both = `APP_NAME` — **this is the join key** |
| Environment | `Environment` | `environment` | ✅ both = `staging`/`production` (via injected `NEXT_PUBLIC_ENVIRONMENT`) |
| Product | `Product` | (not a standalone field — see below) | ⚠️ derived from the app, not joined directly |

So a pipeline joins **AWS cost grouped by `(Project, Environment)`** to
**LiteLLM spend grouped by `(app, environment)`** with no translation layer.
**App is the reconciliation key**; product is a rollup attribute applied on top.

> **Product is reconciled via the app, not a shared field.** LiteLLM does not
> emit `product` as a first-class `spend_logs_metadata` field — it only appears
> embedded in the `user` string on *internal* calls (`internal:{product}:{app}:{feature}`),
> and not at all on customer calls. Since `product` is 1:1 with the app
> (`app.config.json`), roll LiteLLM spend up to product using the **same
> app→product mapping** AWS uses (the `Product` tag value for that app's
> `Project`). Don't rely on parsing it out of LiteLLM.

### The customer dimension (AI only)

AWS infrastructure (ECS, RDS, ALB) is **shared across all customers** of an app
— there is no per-customer AWS line item, and there can't be, because one
Fargate task serves every customer. **Customer-level attribution exists only on
the LiteLLM side**, where each call carries:

| LiteLLM field | Value | Source |
|---------------|-------|--------|
| `user` | `company:{accountId}:brand:{brandId}` (customer calls) or `internal:{product}:{app}:{feature}` (internal calls) | built in `src/modules/llm/lib/client.ts` |
| `company_id` | `{accountId}` | Client Catalog company ID passed as `accountId` |
| `brand_id` | `{brandId}` | Client Catalog workspace ID passed as `brandId` |
| `feature` | e.g. `email-subject-gen` | caller-provided |

`accountId`/`brandId` come from the **Client Catalog** capability
(`clientCatalogCompanyId` / workspace id), so AI spend can be sliced per
customer and per brand. Calls made without a customer context fall into the
`internal:{product}:{app}:{feature}` bucket — i.e., app overhead, not billable
to a customer.

### Recommended metering model

```
Per (app, environment):
  AWS_infra_cost      = sum of CUR line items where Project=app AND Environment=env
  AI_cost_total       = sum of LiteLLM spend where app=app AND environment=env
  AI_cost_by_customer = LiteLLM spend grouped by company_id (+ brand_id)

Per customer (within an app):
  directly_billable = AI_cost_by_customer[customer]
  infra_overhead    = AWS_infra_cost allocated across customers
                      (evenly, or by a usage proxy such as request count / AI spend share)
  total             = directly_billable + infra_overhead
```

The key point: **AWS cost reconciles at the app/env/product grain; only AI cost
reconciles at the customer grain.** A metering system should treat infra as
app-level overhead and only the LiteLLM `company_id`/`brand_id` spend as
directly customer-attributable.

---

## 5. Quick verification

After deploying and activating tags:

```bash
# Confirm running tasks carry the tags (proves propagateTags worked)
aws ecs list-tasks --cluster {appName}-stg --profile labs-power --region eu-central-1 \
  --query 'taskArns[0]' --output text | xargs -I{} \
  aws ecs describe-tasks --cluster {appName}-stg --tasks {} --include TAGS \
  --profile labs-power --region eu-central-1 --query 'tasks[0].tags'

# Confirm the ECR repo is tagged
aws ecr list-tags-for-resource \
  --resource-arn arn:aws:ecr:eu-central-1:936190502406:repository/{appName} \
  --profile labs-power --region eu-central-1
```

In Cost Explorer (≥24h after activation), group by tag `Project` then filter by
`Environment` / `Product` to confirm the breakdown appears.
