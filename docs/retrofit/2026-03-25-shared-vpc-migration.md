# Retrofit prompt — Migrate to the shared MappLabs VPCs (Transit Gateway)

> Implements the **2026-03-25 "Move to the shared MappLabs-Staging / MappLabs-Production
> VPCs"** entry in [`MIGRATION.md`](../../MIGRATION.md). (Documented 2026-07-20 — the
> template change landed in March but never shipped a migration path; the first stranded
> fork surfaced it.)
>
> **Applies to any fork created before 2026-03-25** (or any fork whose
> `infra/lib/config/environments.ts` still points `vpcId` at a standalone VPC such as
> `vpc-019564bfe26ac6eeb`, a.k.a. `mapp-labs-vpc-OLD`). Newer forks already ship the
> correct VPCs and can skip this entirely.
>
> **⚠️ Run this one STANDALONE, deliberately — do NOT let the `START-HERE.md`
> orchestrator apply it as part of a sweep.** The orchestrator is built to change code
> on a branch and hand back without deploying; this runbook must back up the database,
> deploy, and restore, with you at the keyboard. It's flagged ⚠️ in the README index and
> the orchestrator is told to defer it to you.
>
> **⚠️ This is NOT a normal code-only retrofit. It is a stateful, destructive
> operations runbook.** Changing the VPC causes CloudFormation to **replace** the RDS
> instance, the ALB(s), the security groups, and the ECS cluster in the new VPC. **The
> database is NOT migrated automatically — you dump it first and restore it after, or you
> lose the data.** Unlike every other prompt in this directory, this one **does** deploy
> and **does** run AWS commands — but only against **staging**, one gate at a time, with a
> verified backup in hand first.

---

## Why this migration exists (read before running)

The template originally scaffolded new apps into a standalone VPC
(`vpc-019564bfe26ac6eeb`, now renamed **`mapp-labs-vpc-OLD`** in AWS). That VPC has **no
Transit Gateway attachment** to Mapp's internal network. As a result, apps living there
**cannot reach internal Mapp HTTPS services** — `product-feed-service` (UPC),
`company-management-service` (Client Catalog), internal Keycloak, etc. — because the
internal hostnames (`*.int.k8s.muc.domeus.com`) don't resolve or route without the TGW
path. This shows up as DNS/connection failures, **not** auth errors.

Since 2026-03-25 the template deploys into the **shared, TGW-attached** VPCs:

| Env | VPC ID | Name | CIDR | TGW |
|---|---|---|---|---|
| staging | `vpc-093d8085c3684d09a` | MappLabs-Staging | 10.224.0.0/16 | `tgw-0fb20738477b486dd` ✅ |
| production | `vpc-0b8d0ded5bc6f647e` | MappLabs-Production | 10.225.0.0/16 | `tgw-0fb20738477b486dd` ✅ |

These live in account **936190502406**, region **eu-central-1**. This migration moves
your app onto them so internal connectivity works the way it does for every other
current Labs app (e.g. FTL / labs-trends).

---

## How to use this prompt

1. Pull a **fresh copy of `labs-app-template`** into a separate directory (do **not**
   overlay it on your app).
2. Confirm you can reach the **Mapp VPN** (you will need it to dump/restore the database —
   RDS is only reachable from Mapp VPN/office IPs and from inside the VPC).
3. Confirm you are authenticated to AWS as the deploy identity (`labs-power` profile,
   account 936190502406, region eu-central-1) and that `aws sts get-caller-identity`
   returns that account.
4. Open **your app** (the one being migrated) in your agent.
5. Replace `<TEMPLATE_PATH>` below with the path to the fresh template checkout.
6. Paste everything from **PROMPT START** to **PROMPT END** into the agent.

```
<TEMPLATE_PATH> = /absolute/path/to/your/fresh/labs-app-template
```

---

## PROMPT START

You are migrating the **current project** (an existing Mapp Labs app) off its old
standalone VPC and onto the **shared, Transit-Gateway-attached MappLabs VPCs**, so it can
reach internal Mapp services. This is a **stateful infrastructure migration**: it changes
CDK config, then deploys, and the deploy **replaces the RDS database, the load
balancer(s), the security groups, and the ECS cluster in the new VPC.** The database
contents are **not** carried over automatically — you must **back them up first and
restore them after**, or the data is gone.

The authoritative reference implementation is a fresh checkout of `labs-app-template` at:

    <TEMPLATE_PATH>

If that path is still the literal placeholder, is empty, or doesn't look like a
`labs-app-template` checkout (no `infra/lib/config/environments.ts`, no `infra/lib/stack.ts`),
**stop and ask me for the correct path before doing anything else.** Tell me the
template's version (`package.json` `version`) so we both know what you're matching against.

### Who I am

Assume I may **not** be a developer. **You** own the git branch and you drive the
runbook. Explain every step in plain language and **stop at each confirmation gate below
and wait for my explicit "go" before continuing.** Do not assume I can fill gaps myself.

### Non-negotiable guardrails

1. **STAGING ONLY.** Do everything against **staging** first. Do **not** touch
   production in this run. If production isn't provisioned yet (the common case for a
   stranded app), say so and skip it entirely.
2. **Backup before you break anything.** You must have a **verified** `pg_dump` of the
   staging database saved locally (and its row counts recorded) **before** you run any
   deploy that replaces the database. No verified dump → **stop**.
3. **You will run AWS commands and deploy — but only the ones this runbook authorizes,
   and only after I say go.** Never run a destructive command (`cdk destroy`, RDS delete,
   dropping data) without showing me the exact command and getting explicit approval.
4. **Never touch shared or other-apps' infrastructure.** Do **not** delete the old VPC
   (`mapp-labs-vpc-OLD` may be shared), the Transit Gateway, the Route53 zone, shared S3
   buckets, or any resource not owned by this app's stack. If old per-app resources
   should be cleaned up, produce a **reviewable, scoped list of exact commands** for me to
   run — never auto-delete.
5. **Above all, do not lose data and do not leave the app in a broken state.** A working
   app on the old VPC beats a half-migrated app with no database. If you can't complete a
   step safely, stop and hand back cleanly with exactly what's left.

### Step 0 — Confirm this app actually needs the migration

- Read this app's `infra/lib/config/environments.ts`. Find the **current** `vpcId`
  value(s) for staging (and production, if present).
- If staging already points at `vpc-093d8085c3684d09a` (and prod, if present, at
  `vpc-0b8d0ded5bc6f647e`), **this migration is already done** — record it as
  `not-applicable` in `.retrofit-state.json` and stop.
- Otherwise, report the current `vpcId`(s) to me and confirm we're proceeding. Note
  whether production exists at all.
- Verify (read-only) that the target VPCs and their TGW attachment are real, so we fail
  fast if the account is wrong:
  ```
  aws ec2 describe-vpcs --vpc-ids vpc-093d8085c3684d09a --region eu-central-1 \
    --profile labs-power --query 'Vpcs[].Tags[?Key==`Name`].Value' --output text
  aws ec2 describe-transit-gateway-attachments --region eu-central-1 --profile labs-power \
    --filters Name=resource-type,Values=vpc Name=resource-id,Values=vpc-093d8085c3684d09a \
    --query 'TransitGatewayAttachments[].State' --output text
  ```
  Expect `MappLabs-Staging` and `available`. If not, **stop and tell me** — the account or
  region is wrong and nothing below is safe.

### Step 1 — Back up the staging database (GATE)

The staging RDS is reachable on 5432 only from the Mapp VPN/office IPs (see
`mappVpnCidrs` in `environments.ts`) and from inside the VPC. Confirm I'm on the VPN.

- Find the staging DB endpoint and credentials. The password lives in Secrets Manager
  under `<appName>-stg/db-credentials` (or the equivalent this app uses — read
  `stack.ts` to confirm the secret name), and the endpoint is on the running RDS
  instance. Retrieve them with `aws secretsmanager get-secret-value` / `aws rds
  describe-db-instances` and show me the commands first.
- Take a full dump and record verification:
  ```
  pg_dump "postgresql://USER:PASS@ENDPOINT:5432/DBNAME?sslmode=require" \
    -Fc -f ./staging-predump-$(date +%Y%m%d).dump
  ```
  Then record, for my review: the dump file size, and per-table row counts
  (`SELECT relname, n_live_tup FROM pg_stat_user_tables ORDER BY 1;`).
- **GATE:** Show me the dump path, size, and row counts. **Do not proceed until I
  confirm the backup looks right.** If `pg_dump`/`psql` aren't available, tell me how to
  install them (or offer to run the dump via an ECS-exec into the running task) rather
  than skipping the backup.

### Step 2 — Change the VPC config **and the subnet strategy** (code only, on a branch)

Create a branch (e.g. `migrate/shared-vpc`). Match the **current template's**
`environments.ts` **and `stack.ts`** — the references are at
`<TEMPLATE_PATH>/infra/lib/config/environments.ts` and
`<TEMPLATE_PATH>/infra/lib/stack.ts`:

**2a — VPC ids (`environments.ts`):**

- The shared `vpcId` on `baseConfig` (old pattern) is **removed**; instead **each
  environment** gets its own `vpcId`:
  - `staging.vpcId = "vpc-093d8085c3684d09a"`  // MappLabs-Staging (TGW)
  - `production.vpcId = "vpc-0b8d0ded5bc6f647e"` // MappLabs-Production (TGW)
- If this app is missing `mappVpnCidrs`, port it in from the template's `baseConfig`
  (`["195.140.184.24/32", "91.192.40.14/32", "91.192.40.15/32"]`) so DB access from the
  VPN still works after the RDS is replaced.

**2b — Subnet strategy (`stack.ts`) — THE LOAD-BEARING CHANGE, DO NOT SKIP.** The
shared VPCs have **no NAT gateway.** Egress works via **public subnets + a public IP on
the task + the Internet Gateway**; those same subnets also route to the TGW for internal
Mapp access. So a fork whose `stack.ts` requests `PRIVATE_WITH_EGRESS` subnets (which
only worked in the old VPC *because it had a NAT*) **will fail to synth** here — CDK sees
no "private with egress" subnet type. Match the template exactly:

- **RDS** `vpcSubnets`: `{ subnetType: ec2.SubnetType.PUBLIC }` (the DB is still private —
  `publiclyAccessible: false` + SG-restricted; it just lives in a public subnet).
- **ECS service** `vpcSubnets`: `{ subnetType: ec2.SubnetType.PUBLIC }` **and**
  `assignPublicIp: true`.
- **Internal ALB** (only if this app sets `enableInternalAlb: true`): `PUBLIC` as well.
- **Do NOT "fix" the synth error by switching to `ISOLATED`.** That makes the error go
  away but silently removes internet egress — any external API this app calls (e.g.
  OpenAI/Anthropic, non-Mapp services) would break in a *successful* deploy, which is far
  worse than a synth failure. `PUBLIC` + `assignPublicIp: true` is the correct fix and is
  how every current app in this VPC runs (verified: FTL staging runs
  `assignPublicIp: ENABLED` in IGW-routed public subnets).

The task getting a public IP is intended and safe: its security group only allows inbound
from the ALB, so the public IP is **egress-only**.

- Do **not** invent other changes beyond 2a + 2b (and `mappVpnCidrs` if absent). Keep it
  minimal so the `cdk diff` is readable.

**Clear the stale VPC lookup cache.** This app almost certainly has
`infra/cdk.context.json` caching the *old* VPC lookup. If you deploy without clearing it,
CDK keeps resolving the old VPC. Remove the stale entry:
```
cd infra && npx cdk context --clear   # or delete the vpc-provider entries for the old VPC id
```
Then commit `cdk.context.json` after the first successful synth so the new lookup is
pinned.

### Step 3 — Review the diff (GATE — this is where you prove nothing surprising dies)

Run a **staging** diff and read it carefully:
```
cd infra && npx cdk diff <StagingStackName>
```
Confirm to me, in plain language, that the diff shows the expected **replacements** and
nothing you didn't intend:
- **Replace** (not just modify): the RDS `DatabaseInstance`, its DB subnet group, the
  ALB, the security groups, the ECS cluster — because they're VPC-bound. This is
  expected and is exactly why we took the backup.
- The ACM certificate re-validates via DNS automatically; the Route53 alias record
  re-points to the new ALB automatically. A brief DNS cutover on staging is fine.
- **SSM parameters are NOT in this stack** and are keyed by `/<appName>-stg/...`, which
  does **not** change with the VPC — so Keycloak / `INTERNAL_API_*` / any UPC params
  **survive** the migration untouched. Confirm the diff does not delete them.
- If the diff proposes deleting anything you can't explain, **STOP and show me.**

**GATE:** Do not deploy until I approve the diff.

### Step 4 — Deploy staging into the new VPC (GATE before running)

- With backup verified (Step 1) and diff approved (Step 3), deploy staging:
  ```
  cd infra && npx cdk deploy <StagingStackName>
  ```
  (or this app's `make staging-infra-deploy` equivalent — check its `Makefile`).
- This replaces the DB, ALB, SGs, and cluster in the new VPC. Expect it to take a while
  (new RDS instance provisioning). Report progress; if it fails or rolls back, stop and
  show me the CloudFormation error — do **not** retry blindly.

### Step 5 — Restore the database and re-verify secrets

- The new staging RDS is **empty**. Restore the Step 1 dump into the new endpoint:
  ```
  pg_restore --no-owner --no-privileges -d \
    "postgresql://USER:PASS@NEW_ENDPOINT:5432/DBNAME?sslmode=require" \
    ./staging-predump-YYYYMMDD.dump
  ```
  (New endpoint + new password from the newly-created `<appName>-stg/db-credentials`
  secret.) If this app uses Prisma migrations, confirm the schema is present — run
  `prisma migrate deploy` / the app's migration command **before** restoring data if the
  restore is schema-less, or restore the full `-Fc` dump which includes schema. Then
  re-check row counts match the Step 1 record and report them to me.
- Confirm the app's SSM parameters still exist under `/<appName>-stg/...`
  (`aws ssm get-parameters-by-path --path /<appName>-stg --region eu-central-1
  --profile labs-power --query 'Parameters[].Name'`). They should — they're
  VPC-independent. If any are missing, this app never had them; note it, don't invent
  values.

### Step 6 — Verify the whole point of the migration: internal reachability

- Force a fresh ECS deployment if needed so tasks land in the new VPC, then **exec into a
  running staging task** and prove internal DNS + routing now work:
  ```
  # from inside the task (via ECS exec):
  getent hosts product-feed-service.ingress.int.k8s.muc.domeus.com
  curl -sv https://product-feed-service.ingress.int.k8s.muc.domeus.com:8080/ 2>&1 | head
  ```
  A resolvable host + a TCP/TLS connection (even a 401/403) proves TGW reachability. A
  DNS failure or timeout means the migration didn't take — stop and show me.
- Smoke-test the app over its public URL (`https://stg-<appName>.labs.mapp.com`): it
  loads, login works, and any data you restored is present.

### Step 7 — Old-VPC cleanup (propose only, never auto-run)

The `cdk deploy` already replaced this app's own RDS/ALB/cluster (the old ones are gone
as part of the stack update). Do **not** delete the old VPC `mapp-labs-vpc-OLD` or its
peering (`pcx-...`) — it may be shared. If you find **app-specific** leftovers that are
now orphaned (e.g. an old manual security group, an old parameter), produce a
**reviewable list of exact scoped commands** for me to run and let me decide. Never
auto-delete.

### If this app uses UPC (product-feed-service)

Reaching the internal network is necessary but not sufficient for UPC. Confirm the app
also has the UPC env wiring — see the **UPC retrofit**
(`<TEMPLATE_PATH>/docs/retrofit/2026-06-19-upc-feeds-catalog-items.md`): the
`UPC_API_BASE_URL` SSM parameter **and** the `ecs.Secret.fromSsmParameter` line for it in
`stack.ts`'s task-definition `secrets:` block. A value in SSM alone is invisible to the
container without that `stack.ts` wire. If either is missing, point me at that retrofit —
it's a separate change from this network migration.

### Record state

Before handback, write/update **`.retrofit-state.json` at this app's repo root** (create
it if absent), following `<TEMPLATE_PATH>/docs/retrofit/RETROFIT-STATE.md`. Upsert this
retrofit under `retrofits["2026-03-25-shared-vpc-migration"]` with `status`
(applied / partial / skipped / not-applicable), `templateVersion` + `templateRef` (the
version and exact git ref you worked against), an ISO-8601 UTC `at`, `by`, `notes`, and
any `deviations` (e.g. "production not provisioned; staging only"). Refresh
`template.lastRetrofitAgainstVersion` / `lastRetrofitAgainstRef` / `lastRetrofitAt`;
don't remove other entries.

### Hand back

Give me a **plain-language handback**:
1. The old VPC and the new VPC the app now runs in.
2. Confirmation the database was backed up, restored, and row counts match.
3. Proof internal reachability now works (the `getent`/`curl` result from Step 6).
4. Whether production was migrated or deliberately skipped.
5. Any old-VPC cleanup you're proposing (scoped commands, for me to run).
6. Every deviation from this runbook and why.
7. If anything got complicated and you didn't have an answer, remind me I can ask in
   **#topic-mapp-labs** / **#topic-ai-support**.

## PROMPT END
