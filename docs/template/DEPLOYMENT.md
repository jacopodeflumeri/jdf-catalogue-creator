# AWS Deployment Guide

This document describes how to deploy your application to the Mapp Labs AWS account using ECS Fargate and RDS PostgreSQL.

> **Before you begin:** Run `./scripts/setup.sh` to configure your app name. This updates all configuration files automatically. The app identity is stored in `app.config.json`.

## Architecture Overview

```
                                    ┌─────────────────────────────────────────┐
                                    │              AWS (eu-central-1)         │
                                    │                                         │
   User ──► stg-{appName}.labs.mapp.com ┼──► Route53 ──► ACM (SSL)               │
        or {appName}.labs.mapp.com      │                    │                    │
                                    │                    ▼                    │
                                    │         ┌─────────────────┐            │
                                    │         │       ALB       │            │
                                    │         └────────┬────────┘            │
                                    │                  │                      │
                                    │         ┌────────▼────────┐            │
                                    │         │   ECS Fargate   │            │
                                    │         │  (Next.js App)  │            │
                                    │         └────────┬────────┘            │
                                    │                  │                      │
                                    │    ┌─────────────┼─────────────┐       │
                                    │    ▼             ▼             ▼       │
                                    │ ┌─────┐    ┌─────────┐    ┌───────┐   │
                                    │ │ RDS │    │   S3    │    │  SSM  │   │
                                    │ │(PG) │    │ Bucket  │    │Params │   │
                                    │ └─────┘    └─────────┘    └───────┘   │
                                    └─────────────────────────────────────────┘
```

## Environments

| Environment | Domain | Database |
|-------------|--------|----------|
| Staging | https://stg-{appName}.labs.mapp.com | RDS PostgreSQL 17.7 (t3.micro, 20 GiB gp3) |
| Production | https://{appName}.labs.mapp.com | RDS PostgreSQL 17.7 (t3.small, 20 GiB gp3) |

## Prerequisites

### AWS Credentials

All staging and production Makefile commands (`staging-deploy`, `prod-infra-diff`, etc.) require valid AWS credentials for the `labs-power` profile. SSO sessions last **12 hours**, so you'll need to refresh credentials at least once per workday.

#### First-Time SSO Setup

1. Go to **https://d-9067a48540.awsapps.com/start/** to get Mapp Labs AWS access. If you don't have access, put in a helpdesk ticket.

2. Configure the `labs-power` SSO profile in `~/.aws/config`. The `sso_region` needs to be `us-east-1` (that's where the SSO is located) even though the labs infrastructure is located `eu-central-1`:

   ```ini
   [profile labs-power]
   sso_start_url = https://d-9067a48540.awsapps.com/start/
   sso_region = us-east-1
   sso_account_id = 936190502406
   sso_role_name = PowerUserAccess
   region = eu-central-1
   ```

3. Verify your setup:

   ```bash
   aws sts get-caller-identity --profile labs-power
   ```

#### Refreshing Credentials

SSO sessions expire after 12 hours. Use the included refresh script to re-authenticate and update `~/.aws/credentials` automatically:

```bash
./scripts/refresh-labs-aws-creds.sh
```

This script:
- Opens the AWS SSO login flow in your browser
- Exports the fresh temporary credentials
- Updates the `[labs-power]` section in `~/.aws/credentials`
- Creates a `.bak` backup of the credentials file

**Prerequisites:** AWS CLI v2, python3, and the `labs-power` SSO profile configured in `~/.aws/config` (see above).

If credentials are expired, any `make staging-*` or `make prod-*` command will fail with an authentication error. Run the refresh script and retry.

### Required Software

```bash
# Node.js 22+ required (matches .nvmrc and the Dockerfile)
node --version

# Docker must be installed and running
docker --version

# AWS CLI v2
aws --version

# Session Manager Plugin (for ECS Exec - migrations, seeding)
# macOS:
brew install session-manager-plugin

# jq (Keycloak URI registration, the last deploy step)
brew install jq        # apt-get install jq on Linux
```

Deploying from Windows works through Git Bash; see [WINDOWS.md](WINDOWS.md) for
the extra tools (`make`, Python 3, `docker-credential-ecr-login`) and pitfalls.

### CDK Dependencies

The CDK infrastructure is pinned to version 2.160.0 for compatibility with the existing bootstrap stack. Dependencies are installed automatically when you run infrastructure commands.

### Shared dependency: `labs-shared-observability`

The EventBridge → CloudWatch Logs rule in `infra/lib/stack.ts` (which writes ECS task state changes to `/ecs/{appName}-{env}/task-state-changes`) depends on a CloudWatch Logs resource policy provisioned by the **`labs-shared-observability`** stack in the `mapp-agentic-infra` repo.

We rely on that shared policy instead of letting each project stack create its own because CloudWatch Logs resource policies are capped at **10 per region per account** — a hard AWS limit that `eu-central-1` has already hit when every project provisioned its own.

The shared stack deploys once per AWS account + region and installs a single policy named `labs-eventbridge-to-ecs-logs` that covers:

- `arn:aws:logs:<region>:<account>:log-group:/ecs/*/task-state-changes:*`
- `arn:aws:logs:<region>:<account>:log-group:/aws/events/*:*`

**Before your first deploy**, verify the shared policy is present in your target account + region:

```bash
aws logs describe-resource-policies \
  --profile labs-power --region eu-central-1 \
  --query 'resourcePolicies[?policyName==`labs-eventbridge-to-ecs-logs`].policyName' \
  --output text
```

If the command prints `labs-eventbridge-to-ecs-logs`, you're good. If it prints nothing, contact **DevOps / CTO** to get `labs-shared-observability` deployed in that account + region before proceeding.

#### Emergency escape hatch

If you must deploy before the shared policy is in place, set `enableTaskStateLogging: false` for the affected environment in `infra/lib/config/environments.ts`. This disables the EventBridge rule and its log group entirely — you lose the task-state diagnostic stream, but CloudFormation will succeed. Flip it back to `true` and redeploy once the shared policy is available.

There is no CDK (CloudFormation) cross-stack dependency between project stacks and `labs-shared-observability`. The link is enforced by convention and this documentation, so project stacks remain independently deployable.

## Customizing for Your Project

Run the setup script to configure the template for your project:

```bash
./scripts/setup.sh
```

This prompts for your app name, display name, database name, team, and ownership details, then updates all configuration files automatically. The app identity is stored in `app.config.json` at the project root.

### Create Your ECR Repository

Before the first deployment, create an ECR repository for your project. ECR is
**shared across both environments** (one repo per app), so it's tagged with
`Project` and `Product` only — not `Environment`. `make staging-first-deploy`
creates and tags this for you automatically; the manual command is:

```bash
aws ecr create-repository \
  --repository-name {appName} \
  --region eu-central-1 \
  --profile labs-power \
  --tags Key=Project,Value={appName} Key=Product,Value={product} Key=ManagedBy,Value=manual-bootstrap
```

### Create Your S3 Bucket (if needed)

If your app uses S3 storage, create buckets. `aws s3 mb` can't set tags, so apply
them in a second step. S3 buckets are **per-environment**, so they carry
`Environment` in addition to `Project` and `Product`:

```bash
# Staging
aws s3 mb s3://mapp-labs-{appName}-staging --region eu-central-1 --profile labs-power
aws s3api put-bucket-tagging --bucket mapp-labs-{appName}-staging --profile labs-power \
  --tagging 'TagSet=[{Key=Project,Value={appName}},{Key=Environment,Value=staging},{Key=Product,Value={product}},{Key=AppOwner,Value={appOwner}}]'

# Production
aws s3 mb s3://mapp-labs-{appName}-prod --region eu-central-1 --profile labs-power
aws s3api put-bucket-tagging --bucket mapp-labs-{appName}-prod --profile labs-power \
  --tagging 'TagSet=[{Key=Project,Value={appName}},{Key=Environment,Value=production},{Key=Product,Value={product}},{Key=AppOwner,Value={appOwner}}]'
```

> These tag **keys** (`Project`, `Environment`, `Product`, …) only show up in
> AWS billing reports after they're activated as Cost Allocation Tags in the
> payer account. See [COST_ALLOCATION.md](COST_ALLOCATION.md).

### ECR Lifecycle Policy

The one shared repo needs a lifecycle policy so old images are expired safely.
`make staging-first-deploy` applies it automatically; to set or refresh it on an
existing repo:

```bash
make ecr-lifecycle-show   # preview the policy + the repo's current one (no changes)
make ecr-lifecycle-set    # apply it (idempotent — re-running changes nothing)
```

The policy has **three** rules and the split matters:

| Rule | Selection | Keeps / expires |
|---|---|---|
| 10 | tagged `production-*` | keep last **10** (configurable) |
| 20 | tagged `staging-*` | keep last **25** (configurable) |
| 30 | **untagged** | expire after **14 days** by age (`sinceImagePushed`) |

Production and staging are **separate** rules, so staging build churn can never
expire the production image (the failure that took `ftl` prod down on 2026-07-10).
Rule 30 must be **age-based**, not count-based: buildx pushes untagged child
manifests/attestations, and an untagged-by-count rule can delete a child a tagged
manifest list still references — breaking the image. Tune the counts per project via
`app.config.json` (`ecrKeepProduction` / `ecrKeepStaging` / `ecrUntaggedDays`) or the
`ECR_KEEP_PRODUCTION` / `ECR_KEEP_STAGING` / `ECR_UNTAGGED_DAYS` env vars.

## Docker Image

The Dockerfile uses a multi-stage build optimized for Next.js standalone output:

1. **deps**: Installs both production and development dependencies
2. **builder**: Builds the Next.js application with standalone output
3. **runner**: Minimal production image with only necessary files

### Important Notes

- The image is built for `linux/amd64` (ECS Fargate)
- Environment variables are validated at runtime, not build time
- The `docker-entrypoint.sh` script constructs `DATABASE_URL` from individual components (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, etc.)
- Build-time dummy environment variables are used to satisfy Next.js build requirements

### Local Docker disk use

Every build leaves several GB of build cache and an image on the deploying
machine. After each push, `build-and-push.sh` prunes the build cache down to
`DOCKER_BUILD_CACHE_MAX` (default `10GB`, keeping the newest so builds stay fast)
and untags this app's local images — only references in this app's ECR repo;
every pushed version stays in ECR, and other projects' images are never touched.
The cleanup never fails a deploy.

```bash
DOCKER_CLEANUP=false make staging-deploy          # skip the cleanup
DOCKER_BUILD_CACHE_MAX=20GB make staging-deploy   # keep more cache
```

### Image Tags & Deploy Models

Each `build-and-push.sh` run pushes three tags for one image:

| Tag | Example | Purpose |
|---|---|---|
| `${env}-${version}` | `production-1.0.26` | **Immutable** — pinned by the opt-in immutable model |
| `${env}-latest` | `production-latest` | Floating — the tag the **default** model tracks |
| commit SHA | `a1b2c3d` | Traceability |

The real fix for the 2026-07-10 `ftl` outage (a floating tag expired out of ECR,
so **every new task launch** failed with `CannotPullContainerError`) is the **ECR
lifecycle policy** above — it is mandatory and needs no elevated IAM. Which tag the
task def pulls is a separate, **opt-in** hardening choice controlled by one key:

**`immutableDeploy` in `app.config.json`** is the single source of truth — the CDK
stack (`infra/lib/stack.ts`) and `deploy-app.sh` (via `_config.sh`) both read it, so
they never disagree. Default is `false`.

**Default — `immutableDeploy: false` (no `iam:PassRole`):**
- The task def references the floating `${env}-latest` tag.
- `make <env>-deploy` (→ `deploy-app.sh`) runs
  `aws ecs update-service --force-new-deployment`, which re-pulls that tag.
- This is the **only** model the standard labs deploy identity can use: the
  `labs-power` profile assumes `AWSReservedSSO_PowerUserAccess`, and AWS-managed
  PowerUserAccess **denies all `iam:*`**. The default path never calls
  `register-task-definition`, so it needs no `iam:PassRole`.

**Opt-in — `immutableDeploy: true` (requires `iam:PassRole`):**
- The task def pins the immutable `${env}-${version}` tag (`version` from
  `package.json`; build, stack, and `deploy-app.sh` derive it identically).
- `deploy-app.sh` registers a **new task-definition revision** per deploy (image
  swapped, everything else preserved). This gives deterministic images and
  tag-pinned rollbacks:
  ```bash
  # Roll back to a previous version (registers that immutable tag as a new revision)
  ./scripts/deploy/deploy-app.sh production production-1.0.25
  ```
  Bump the version (`make version-patch|minor|major`) to create a new rollback
  point; redeploying the *same* version overwrites its `${env}-${version}` tag.
- **IAM prerequisite:** `register-task-definition` requires `iam:PassRole` on the
  task role and execution role embedded in the task def. PowerUserAccess/`labs-power`
  does **not** have this — so enabling `immutableDeploy` fails every deploy with
  `AccessDeniedException ... iam:PassRole` unless your deployer (e.g. a dedicated CI
  role) holds the permission. **If you deploy with `labs-power`, leave this off.**

  To enable it, an admin attaches this scoped policy to the deployer's permission
  set (substitute `<ACCOUNT_ID>` and `<appName>`). The `iam:PassedToService`
  condition bounds it to ECS task roles — but note it still lets that principal pass
  **any** matching `<appName>-*` role to an ECS task:
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

## Local Development Setup

Before deploying to AWS, get your local environment running:

### Prerequisites

- Node.js 22+ and npm 10+
- PostgreSQL running locally on port 5432

### Steps

1. **Run the initial setup command:**

   ```bash
   make dev-initial-setup
   ```

   On the first run, this creates `.env` from `.env.example` and asks you to edit it with your database credentials. The defaults in `.env.example` point to `localhost:5432` with user `postgres`, password `localdev`, and database `{dbName}`.

2. **Create the local database** (if it doesn't exist):

   ```bash
   createdb {dbName}
   ```

3. **Re-run the setup** (after editing `.env`):

   ```bash
   make dev-initial-setup
   ```

   This installs dependencies, runs database migrations, and seeds the database.

4. **Start developing:**

   ```bash
   make dev-server
   ```

   The customer portal is at http://localhost:3000 and the admin dashboard at http://localhost:3000/admin.

## First-Time AWS Setup

### Automated First Deploy (Recommended)

The `first-deploy.sh` script handles the entire bootstrap sequence in the correct order:

```bash
make staging-first-deploy
```

This runs all 6 steps automatically:
1. Creates ECR repository (if it doesn't exist)
2. Sets up SSM parameters (prompts for secrets)
3. Builds and pushes Docker image to ECR
4. Deploys infrastructure via CDK
5. Runs database migrations
6. Seeds the database

**Why the order matters:** The CDK stack creates an ECS service that immediately tries to pull a Docker image. If the ECR repo is empty, the ECS deployment circuit breaker triggers and the entire CloudFormation stack rolls back — destroying all infrastructure that was just created. The image **must** exist before infrastructure deploy.

For production, use `make prod-first-deploy` (includes confirmation prompt).

### Manual First Deploy (Step by Step)

If you prefer to run each step manually:

#### 1. Bootstrap CDK (One Time Only)

If CDK has never been bootstrapped in the Mapp Labs account (it likely already has been):

```bash
make infra-bootstrap
```

#### 2. Create ECR Repository

```bash
aws ecr create-repository --repository-name {appName} --region eu-central-1 --profile labs-power \
  --tags Key=Project,Value={appName} Key=Product,Value={product} Key=ManagedBy,Value=manual-bootstrap
```

#### 3. Set Up SSM Parameters

```bash
make staging-ssm-setup
```

For new apps, **Keycloak is the default login backend** (`KEYCLOAK_ENABLED=true`). The script will:

- Prompt you for **`NEXTAUTH_SECRET`** (generate with: `openssl rand -base64 32`) and **`SUPER_ADMINS`** (comma-separated admin emails).
- Auto-copy the shared Keycloak parameters from `/labs/labs-portal/*` SSM (issuer, realm, client-id, client-secret, idp-hint, company-idp-hint, tls-insecure). You don't need to know or type these.
- Write `"unused"` placeholders for `AZURE_AD_*` and `KEYCLOAK_CA_PEM` (the ECS task definition references them; the app code ignores them when KC is on).

For full details — including how to disable one of the two login buttons or how to opt out of Keycloak entirely — see [KEYCLOAK.md](KEYCLOAK.md).

If `KEYCLOAK_ENABLED=false` (legacy direct-Entra), the script will additionally prompt for:

- `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID` — see `docs/template/ENTRA-SETUP.md`.

#### 4. Build and Push Docker Image (BEFORE infrastructure!)

```bash
./scripts/deploy/build-and-push.sh staging
```

**Important:** This must happen before `staging-infra-deploy`. See "Why the order matters" above.

#### 5. Deploy Infrastructure

```bash
make staging-infra-deploy
```

This creates:
- ECS Cluster and Fargate Service
- RDS PostgreSQL 17.7 database (credentials auto-generated in Secrets Manager)
- Application Load Balancer with HTTPS
- Route53 DNS record
- ACM SSL certificate (auto-validated via DNS)
- Security groups and IAM roles
- CloudWatch Log Groups (application logs + task state changes)
- EventBridge rule for ECS task state change monitoring
- Icinga HTTP health check monitoring (if `ICINGA_API_USER`/`ICINGA_API_PASS` are set)

**Login needs nothing extra here.** With Keycloak enabled (the default), the app's redirect URI is registered on the shared `labs-portal` Keycloak client by `make staging-deploy` / `make staging-first-deploy` — see `docs/template/KEYCLOAK.md`. There is no Entra step: Keycloak brokers to Entra itself.

**Legacy direct-Entra apps only (`KEYCLOAK_ENABLED=false`):** this target also registers `https://stg-{appName}.labs.mapp.com/api/auth/callback/azure-ad` on the shared Mapp Labs Entra app via Microsoft Graph API, which needs the `/mapp-labs-shared/ENTRA_MGMT_*` SSM parameters (`make shared-ssm-setup`, once per AWS account). The step is **skipped when Keycloak is enabled**. See `docs/template/ENTRA-SETUP.md`, and `docs/retrofit/KEYCLOAK-MIGRATION.md` for moving such an app to Keycloak.

#### 6. Run Database Migrations

Once the ECS task is running:

```bash
make staging-db-migrate
```

#### 7. Seed the Database

```bash
make staging-db-seed
```

**Note:** Seeding requires an interactive terminal session. If you encounter "Cannot perform start session: EOF" errors, ensure you're running in a proper terminal (not a non-interactive script).

### Production First Deploy

Follow the same sequence as staging, using production targets:

```bash
# Automated:
make prod-first-deploy

# Or manual:
make prod-ssm-setup
./scripts/deploy/build-and-push.sh production
make prod-infra-deploy
make prod-db-migrate
make prod-db-seed
```

## Deploying Updates

For subsequent deployments after initial setup there are **two deploy paths per
environment**. Pick by asking one question: *can the currently-running image
survive this migration?*

### Default — rolling deploy, no downtime

```bash
# build, push, roll the ECS service, migrate, register Keycloak URIs
make staging-deploy
make prod-deploy

# Or step by step:
./scripts/deploy/build-and-push.sh staging
./scripts/deploy/deploy-app.sh staging
./scripts/deploy/run-migration.sh staging
```

The service stays up throughout. Because the migration runs *after* the new
tasks are live, an outgoing task can briefly serve requests against the new
schema. That is an accepted trade for not taking the app offline on every
release, and it is fine for **additive** migrations — new tables, new columns,
new indexes, new enum values.

### Opt-in — maintenance deploy, takes downtime

```bash
# gate the ALBs, drain to zero, migrate with nothing serving, restore
make staging-deploy-maintenance
make prod-deploy-maintenance
```

Use this only when the migration is **not backwards-compatible**, i.e. the
outgoing image would break against the new schema:

- an in-place table or column rename
- dropping (or narrowing) a column the running version still selects
- a backfill that must not race with live writes
- a large batch of migrations going out at once — a long-lived branch, or a
  merge that accumulated several — where the odds that one of them is breaking
  are high and the migration window is long

If you are unsure, run the default deploy against **staging** first and see
whether anything breaks. Switching to this path is a deliberate decision to
accept downtime, not a precaution to take by default.

What it does, in order: gate every application load balancer with a fixed
`503`, disable the app's own scheduled EventBridge rules, scale the service to
zero and wait for **every** task in the family to stop, build and push the
release image, verify the published ECR tags all resolve to one manifest
digest, start exactly one new-image task behind the gates, run
`prisma migrate deploy` in it via ECS Exec, then restore capacity, the
deployment configuration, the schedules and the listeners.

It asks for an explicit confirmation. For a non-interactive release job set
`CONFIRM_MAINTENANCE_DOWNTIME=yes`, and only after the window is agreed.

**It fails closed.** If any step after the drain fails, the service
deliberately stays at desired count 0 and the ALB gates stay up. A failed
maintenance deploy is an outage to fix forward, not an automatic rollback —
restarting the old revision against a migrated schema is how a failed release
becomes data damage. The ECS circuit-breaker rollback is disabled for the
window for the same reason and restored at the end.

Because a failed attempt leaves desired count at zero, a retry has to
acknowledge that explicitly:

```bash
MAINTENANCE_RESTORE_DESIRED_COUNT=1 make staging-deploy-maintenance
```

Optional environment variables:

| Variable | Purpose |
|---|---|
| `CONFIRM_MAINTENANCE_DOWNTIME=yes` | Skip the interactive confirmation (non-interactive release jobs). |
| `MAINTENANCE_POST_MIGRATE_COMMAND` | Shell command run in the gated task right after the migration — a cache/index/graph rebuild that must not run against the old schema. |
| `MAINTENANCE_SCHEDULE_RULES` | Space-separated EventBridge rule names to quiesce, overriding auto-discovery. Needed if the app's schedules are named off-prefix or live in EventBridge Scheduler (`aws scheduler`) rather than EventBridge Rules. |
| `MAINTENANCE_RESTORE_DESIRED_COUNT=1` | Acknowledge a retry after a failed attempt left the service drained. |

Requires the AWS Session Manager plugin (`brew install --cask
session-manager-plugin`) — the migration runs through ECS Exec.

Schedule discovery looks for EventBridge rules named `<app>-<env>-*` that carry
a `ScheduleExpression`. The template's own `<app>-<env>-ecs-task-state-change`
rule is event-pattern based and is deliberately left enabled: it records task
state changes to CloudWatch Logs, which is exactly what you want during a
maintenance window.

### Write migrations so neither path can half-apply

The maintenance path controls *who is running* during a migration. It cannot
save a migration that fails halfway through. Prisma records a failed migration
in `_prisma_migrations` and refuses every later one until it is resolved, so a
non-idempotent migration turns one bad release into a blocked pipeline:

```sql
-- Not re-runnable: a retry dies on "relation ... already exists"
CREATE UNIQUE INDEX foo_slug_key ON foo (slug);

-- Re-runnable
CREATE UNIQUE INDEX IF NOT EXISTS foo_slug_key ON foo (slug);
```

Use `IF NOT EXISTS` / `IF EXISTS` for every DDL statement, and make backfill
`UPDATE`s idempotent (guard on the post-state, not the pre-state). This matters
most for multi-step migrations against large tables — the slow `UPDATE` passes
are exactly where a timeout lands, and production has more rows than staging, so
a migration that survived staging is *more* likely to fail there, not less.

If one does fail half-applied: verify by hand that the end state is actually
correct (every step ran, not just some), then mark it applied so later
migrations can proceed:

```bash
npx prisma migrate resolve --applied <migration_name>
```

Do that only after checking the data — `resolve` changes bookkeeping, not the
database.

## Versioning

The project uses `npm version` for semantic versioning. Each version bump updates `package.json`, creates a git commit with the version number as the message, and tags it (e.g., `v1.2.4`).

```bash
# Show current version
make version-show

# Bump version (pick one)
make version-patch   # 1.0.0 -> 1.0.1
make version-minor   # 1.0.0 -> 1.1.0
make version-major   # 1.0.0 -> 2.0.0
```

Version before deploying. A typical release flow:

```bash
make version-patch       # bump, commit, tag
git push && git push --tags
make staging-deploy      # deploy to staging
```

The version is baked into Docker images at build time via `NEXT_PUBLIC_APP_VERSION` and served from the `/api/health` endpoint:

```json
{
  "status": "healthy",
  "version": "1.2.0",
  "commit": "abc1234",
  "environment": "staging",
  "timestamp": "2026-02-09T12:00:00.000Z"
}
```

### Verify the deployed version

```bash
curl -s https://stg-{appName}.labs.mapp.com/api/health | jq .
```

## Makefile Commands Reference

All remote commands use `<env>-<action>` naming (e.g., `staging-deploy`, `prod-infra-diff`).

### Staging

| Command | Description |
|---------|-------------|
| `make staging-first-deploy` | First-time bootstrap (ECR, SSM, build, infra, migrate, seed) |
| `make staging-deploy` | Rolling deploy (build + push + deploy + migrate); no downtime |
| `make staging-deploy-maintenance` | Maintenance deploy (gate + drain + migrate + restore); **takes downtime** |
| `make staging-infra-deploy` | Deploy/update staging infrastructure |
| `make staging-infra-destroy` | Tear down staging infrastructure |
| `make staging-infra-diff` | Preview staging infrastructure changes |
| `make staging-db-reset` | Reset staging database (destructive) |
| `make staging-db-migrate` | Run database migrations on staging |
| `make staging-db-seed` | Seed staging database |
| `make staging-ssm-setup` | Configure SSM parameters for staging |
| `make staging-ssm-list` | List all staging SSM parameters |
| `make staging-logs` | Tail ECS logs for staging |
| `make staging-ecs-status` | Show ECS service status for staging |
| `make staging-monitoring-add` | Register staging health check in Icinga |
| `make staging-monitoring-remove` | Remove staging health check from Icinga |

### Production

| Command | Description |
|---------|-------------|
| `make prod-first-deploy` | First-time bootstrap (ECR, SSM, build, infra, migrate, seed) |
| `make prod-deploy` | Rolling deploy (build + push + deploy + migrate); no downtime |
| `make prod-deploy-maintenance` | Maintenance deploy (gate + drain + migrate + restore); **takes downtime** |
| `make prod-infra-deploy` | Deploy/update production infrastructure |
| `make prod-infra-diff` | Preview production infrastructure changes |
| `make prod-db-migrate` | Run database migrations on production |
| `make prod-db-seed` | Seed production database |
| `make prod-ssm-setup` | Configure SSM parameters for production |
| `make prod-ssm-list` | List all production SSM parameters |
| `make prod-logs` | Tail ECS logs for production |
| `make prod-ecs-status` | Show ECS service status for production |
| `make prod-monitoring-add` | Register production health check in Icinga |
| `make prod-monitoring-remove` | Remove production health check from Icinga |

### Local Development

All local development commands use the `dev-` prefix:

| Command | Description |
|---------|-------------|
| `make dev-initial-setup` | First-time setup (install, migrate, seed) |
| `make dev-install` | Install dependencies |
| `make dev-server` | Start development server |
| `make dev-build` | Build production bundle |
| `make dev-start` | Start production server locally |
| `make dev-test` | Run all tests (creates test DB, migrates, unit + DB tests) |
| `make dev-test-unit` | Unit tests only (no database required) |
| `make dev-test-db` | Database-backed tests only (sequential) |
| `make dev-lint` | Run ESLint |
| `make dev-type-check` | Run TypeScript type checking |
| `make dev-check-all` | Run all checks (type-check + lint) |
| `make dev-db-reset` | Reset database and load all seeds |
| `make dev-db-migrate` | Run database migrations |
| `make dev-db-seed` | Run seed script |
| `make dev-db-studio` | Open Prisma Studio |
| `make dev-db-generate` | Generate Prisma client |
| `make dev-docker-build` | Build Docker image locally |
| `make dev-docker-run` | Run application in Docker locally |
| `make dev-clean` | Remove build artifacts and dependencies |

### Versioning

| Command | Description |
|---------|-------------|
| `make version-show` | Show current version |
| `make version-patch` | Bump patch version (1.0.0 -> 1.0.1) |
| `make version-minor` | Bump minor version (1.0.0 -> 1.1.0) |
| `make version-major` | Bump major version (1.0.0 -> 2.0.0) |

### Infrastructure

| Command | Description |
|---------|-------------|
| `make infra-bootstrap` | Bootstrap CDK (one-time setup) |

## Infrastructure Details

### VPC Architecture

Each environment uses a dedicated MappLabs VPC with Transit Gateway connectivity to internal Mapp services (UPC, Client Catalog, etc.):

| Resource | Staging | Production |
|----------|---------|------------|
| VPC | `vpc-093d8085c3684d09a` (MappLabs-Staging, 10.224.0.0/16) | `vpc-0b8d0ded5bc6f647e` (MappLabs-Production, 10.225.0.0/16) |
| Subnets | 3 public + 3 private (eu-central-1a/b/c) | 3 public + 3 private (eu-central-1a/b/c) |
| Transit Gateway | `tgw-0fb20738477b486dd` (shared) | `tgw-0fb20738477b486dd` (shared) |

The Transit Gateway routes internal Mapp traffic (172.24.0.0/16, 172.25.x, 192.168.120.0/21, 10.128.192.0/20) without going through the public internet.

**Network access for direct database connections:**
- ECS tasks connect within the same VPC
- Mapp VPN/Office IPs (`195.140.184.24/32`, `91.192.40.14/32`, `91.192.40.15/32`) are added as CIDR-based security group rules

**Important:** The VPCs and Transit Gateway are shared Mapp Labs account resources managed by DevOps. Never modify or delete them.

### Shared AWS Resources (Already Exist)

These are Mapp Labs account resources shared by all projects:

- **Route53 Hosted Zone**: `labs.mapp.com` (Z03706141H2K96TGWE8I9)
- **Transit Gateway**: `tgw-0fb20738477b486dd` (connects to internal Mapp services)
- **AWS Account**: 936190502406, Region: eu-central-1

### Resources Created Per Environment

| Resource | Staging | Production |
|----------|---------|------------|
| ECS Cluster | {appName}-stg | {appName}-prod |
| ECS Service (Fargate) | 1024 CPU, 2048 MB | 1024 CPU, 2048 MB |
| RDS PostgreSQL 17.7 | db.t3.micro, 20 GiB gp3 | db.t3.small, 20 GiB gp3 |
| ALB (public) | {appName}-stg | {appName}-prod |
| ALB (internal, optional) | {appName}-stg-int (off by default) | {appName}-prod-int (off by default) |
| ACM Certificate | stg-{appName}.labs.mapp.com | {appName}.labs.mapp.com |
| CloudWatch Log Group (app) | /ecs/{appName}-stg | /ecs/{appName}-prod |
| CloudWatch Log Group (task state) | /ecs/{appName}-stg/task-state-changes | /ecs/{appName}-prod/task-state-changes |
| EventBridge Rule | {appName}-stg-ecs-task-state-change | {appName}-prod-ecs-task-state-change |

### Internal ALB — when do I need it?

Each environment can optionally provision a second, **non-internet-facing** ALB (`{appName}-{env}-int`) reachable only from RFC 1918 private ranges via the Transit Gateway. It's controlled by `enableInternalAlb` in `infra/lib/config/environments.ts` and **defaults to `false`**.

**Enable it (`enableInternalAlb: true`) only if** your app needs to receive traffic from *other Mapp services* over the internal network — for example:

- A shared API consumed by other labs apps server-to-server
- A webhook receiver called by internal Mapp infrastructure that shouldn't traverse the public internet

**Leave it `false`** for the common case: standalone customer or admin portals where all inbound traffic is end users hitting the public ALB.

**Why the default matters:** the regional ALB quota in `eu-central-1` is **50 by default**. Every enabled internal ALB consumes one slot against that quota in addition to the public ALB. Across many labs projects this adds up fast — `eu-central-1` would exhaust the default quota at ~25 projects with internal ALBs enabled in both environments.

If you're not sure whether you need it, you don't. Flip it on later when a concrete internal consumer appears; the change is a single CDK deploy.

### Estimated Monthly Costs

**Staging (~$50-60/month):**
- RDS db.t3.micro: ~$12-15/month
- ECS Fargate (1024 CPU, 2048 MB): ~$30-35/month
- ALB: ~$5/month
- NAT Gateway: Shared (existing)
- S3/ECR/CloudWatch: Minimal

**Production (~$50-80/month):**
- RDS db.t3.small: ~$25-30/month
- ECS Fargate (1024 CPU, 2048 MB): ~$15-25/month
- ALB: ~$10-15/month
- Data transfer: Variable

## Database Management

### Connection Details

Database credentials are stored in AWS Secrets Manager under `{appName}-stg/db-credentials` (or `{appName}-prod/db-credentials`).

To connect directly (requires VPN or office network):

```bash
# Get the database endpoint
aws rds describe-db-instances --profile labs-power --region eu-central-1 \
  --query 'DBInstances[?contains(DBInstanceIdentifier, `{appName}-stg`)].Endpoint.Address' \
  --output text

# Get credentials from Secrets Manager
aws secretsmanager get-secret-value --secret-id {appName}-stg/db-credentials \
  --profile labs-power --region eu-central-1 \
  --query 'SecretString' --output text | jq .
```

### Running Migrations

Migrations are run via ECS Exec:

```bash
make staging-db-migrate
```

This requires the AWS Session Manager plugin to be installed.

For a migration the running image cannot survive — a rename, a drop, a backfill
that must not race with live writes — do **not** run this against a serving
service. Use `make <env>-deploy-maintenance`, which drains the service first;
see [Deploying Updates](#deploying-updates), including the notes on writing
migrations idempotently so a failure cannot half-apply.

### Storage type — gp3, not gp2

Both environments use **gp3** storage (`storageType: rds.StorageType.GP3` in
`infra/lib/stack.ts`). This is deliberate: CDK's default is gp2, and gp2 sizes
IOPS from the volume — 3 IOPS/GiB with a 100 IOPS floor — so the template's
20 GiB volume gets a **baseline of 100 IOPS**, reaching 3,000 only by spending a
burst credit balance. A migration, a seed, or a slow scan can drain that balance
and drop the database to 100 IOPS with no error and no metric anyone is watching.
gp3 gives a flat **3,000 IOPS / 125 MiB/s** with no credit balance, at the same
per-GiB price on RDS.

Do **not** add `iops` or `storageThroughput`. Below 400 GiB, gp3 on RDS
PostgreSQL has no provisionable range above the baseline, and passing either
value makes RDS reject the modification. They only become meaningful if
`dbAllocatedStorage` ever crosses 400 GiB — at which point the baseline rises to
12,000 IOPS / 500 MiB/s on its own.

### Database Backups

- **Staging**: No automated backups (can rebuild from seeds)
- **Production**: Daily automated snapshots, 7-day retention

### Cross-environment config sync (optional)

If your app has admin-editable config that you want to refresh between
environments (typically pulling prod into staging for realistic testing),
the optional **Data Sync** capability handles this via the shared
`mapp-labs-data-sync` S3 bucket. See
[capabilities/DATA_SYNC.md](capabilities/DATA_SYNC.md) for the full
picture. It's purpose-built for config dumps — not a general-purpose S3
capability.

## Health Checks

The application uses **ALB target group health checks only** (no ECS container health checks).

- **Health endpoint**: `/api/health`
- **Check interval**: 30 seconds
- **Healthy threshold**: 2 consecutive successful checks
- **Unhealthy threshold**: 5 consecutive failed checks

## Monitoring & Logging

### CloudWatch Log Groups

Each environment has two CloudWatch log groups with 90-day retention:

| Log Group | Contents |
|-----------|----------|
| `/ecs/{appName}-{env}` | Application stdout/stderr (Next.js server output, where env is `stg` or `prod`) |
| `/ecs/{appName}-{env}/task-state-changes` | ECS task lifecycle events (start, stop, crash) |

Tail all logs for an environment:

```bash
make staging-logs    # tails both log groups
make prod-logs       # tails both log groups
```

### Icinga Health Checks

Each deployed environment gets an HTTP health check registered in Icinga that monitors the `/api/health` endpoint. See [MONITORING.md](./MONITORING.md) for full details.

- Notification channel: `slack-service-mapp-aws-labs`
- View services: https://mon11.muc.domeus.com/icingaweb2/ (guest/guest)
- Services require Icinga2 Admin activation after creation

### EventBridge Rule (ECS Task State Changes)

An EventBridge rule captures every `ECS Task State Change` event for the cluster and writes it to the task-state-changes log group. This provides a persistent record of:

- **`stoppedReason`** -- why the task stopped (e.g., "Essential container in task exited")
- **`stopCode`** -- categorized stop code (e.g., `EssentialContainerExited`, `UserInitiated`)
- **`containers[].exitCode`** -- process exit codes per container
- **`containers[].reason`** -- per-container stop reasons

This is critical for diagnosing crashes where the application dies before writing any log output (e.g., OOM kills, segfaults, or failures during container startup before the app starts).

EventBridge needs permission to write into the log group. That permission lives in the account-wide `labs-eventbridge-to-ecs-logs` resource policy deployed by the `labs-shared-observability` stack (see [Shared dependency: `labs-shared-observability`](#shared-dependency-labs-shared-observability) for setup). If the rule is firing but no events are landing in the log group, the most likely cause is that the shared policy is missing from the target account + region. You can also disable the rule and log group entirely by setting `enableTaskStateLogging: false` in `infra/lib/config/environments.ts`.

To query recent task state events:

```bash
aws logs filter-log-events \
  --log-group-name /ecs/{appName}-stg/task-state-changes \
  --start-time $(date -v-1d +%s000) \
  --profile labs-power --region eu-central-1 \
  --query 'events[*].message' --output text | jq -r '.' | jq '.detail | {lastStatus, stoppedReason, stopCode, containers: [.containers[] | {name, exitCode, reason}]}'
```

## Troubleshooting

### ECS Service Won't Start

1. **Check service events:**
   ```bash
   make staging-ecs-status
   ```

2. **Check CloudWatch logs:**
   ```bash
   make staging-logs
   ```

3. **Check task state changes (for crashes with no app logs):**
   ```bash
   aws logs filter-log-events \
     --log-group-name /ecs/{appName}-stg/task-state-changes \
     --start-time $(date -v-1H +%s000) \
     --profile labs-power --region eu-central-1
   ```

4. **Common issues:**
   - No Docker image in ECR: Run `./scripts/deploy/build-and-push.sh staging`
   - Missing SSM parameters: Run `make staging-ssm-list` to verify all exist
   - Health check failing: Check `/api/health` endpoint in logs

### Lint Errors No Longer Fail the Docker Build

The project's ESLint config treats unused variables as errors. **Next.js 16 removed the
build-time ESLint integration**, so `next build` no longer runs ESLint at all — a lint
error that would once have failed the Docker build now sails through it and lands in a
deployed image.

Lint is therefore only enforced where you run it explicitly:

```bash
# Run before deploying — this is now the only thing that catches lint errors
make dev-check-all   # runs type-check + lint
make dev-build       # full local build (type errors only; no longer lints)
```

The `dev-check-all` target runs both `dev-type-check` and `dev-lint`. Treat it as a
required pre-deploy step rather than a convenience: prior to Next 16 the Docker build was
a backstop for it, and that backstop is gone.

### Circuit Breaker Triggered

If ECS deployment fails with circuit breaker:

1. Check logs for application errors: `make staging-logs`
2. Verify the Docker image was pushed: `aws ecr describe-images --repository-name {appName} --profile labs-power --region eu-central-1`
3. Check task definition has correct environment variables

### Environment Validation Errors

The application validates environment variables at startup. If you see "Environment validation failed" in logs:

1. Check all required SSM parameters exist: `make staging-ssm-list`
2. Verify `NEXTAUTH_SECRET` is at least 32 characters
3. Check the login parameters: the `KEYCLOAK_*` values when `KEYCLOAK_ENABLED=true` (the default — `AZURE_AD_*` are `"unused"` placeholders then, which is correct), or the `AZURE_AD_*` values for a legacy direct-Entra app

### ECS Exec / Migration / Seed Issues

If `make staging-db-migrate` or `make staging-db-seed` fails:

1. **"Cannot perform start session: EOF"**: Run in an interactive terminal, not a script
2. **Session Manager plugin not found**: Install the AWS Session Manager plugin:
   ```bash
   # macOS
   brew install session-manager-plugin
   ```
3. **No running tasks**: Ensure ECS service has at least 1 running task
4. **Permission denied**: Verify your AWS profile has ECS Exec permissions

### SSL Certificate Pending

ACM certificates require DNS validation. The CDK automatically creates validation records in Route53. If stuck:

1. Check Route53 for CNAME validation records
2. Allow up to 30 minutes for DNS propagation
3. Verify the hosted zone ID is correct in `infra/lib/config/environments.ts`

### Database Connection Issues

1. Verify ECS security group can reach RDS security group
2. Check DATABASE_URL is correctly constructed from Secrets Manager
3. Verify RDS instance is in `available` state
4. Search CloudWatch for `[db]`. Pool errors are logged, not fatal: a dropped
   connection (RDS restart, failover) appears as
   `[db] idle pool client dropped (<code>): <message>` (or
   `[db] transaction connection error ...` for a connection held by an
   interactive transaction), and the next query reconnects. Only the error code
   and message are logged, never the connection string or credentials. The
   hooks live in `src/lib/prisma/pg-pool-errors.ts`.

**Pool settings** come from env (`DB_MAX_CONNECTIONS`, default 10;
`DB_CONNECTION_TIMEOUT`, default 10000 ms; `DB_IDLE_TIMEOUT`, default 30000 ms)
and are passed to `PrismaPg` in `src/lib/prisma/client.ts`. `connection_limit`
and `pool_timeout` in `DATABASE_URL` are no-ops with Prisma 7's driver adapter.
One-off scripts that build their own adapter (`prisma/seed.ts`, the data-sync
scripts) don't get the logging hooks; they are short-lived, and a dropped
connection only fails that run.

## Rolling Back

To rollback to a previous Docker image:

```bash
# List recent images
aws ecr describe-images --repository-name {appName} \
  --query 'imageDetails | sort_by(@, &imagePushedAt) | [-5:].[imageTags[0], imagePushedAt]' \
  --profile labs-power --region eu-central-1 --output table

# Deploy specific version
IMAGE_TAG=abc123 ./scripts/deploy/build-and-push.sh staging
./scripts/deploy/deploy-app.sh staging
```

## Security

1. **Secrets**: Stored in SSM Parameter Store (SecureString) and Secrets Manager
2. **Network**: RDS in public subnets but not publicly accessible, secured via security groups. Accessible only from ECS tasks and Mapp VPN/Office CIDRs
3. **IAM**: Least-privilege roles for ECS tasks
4. **HTTPS**: All traffic encrypted via ALB with ACM certificates
5. **Database**: Encrypted at rest, SSL connections enforced
6. **Transit Gateway**: Internal Mapp service traffic stays on private network
