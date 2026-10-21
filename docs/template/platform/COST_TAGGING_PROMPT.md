# Agent prompt — tag an AWS system for Mapp Labs cost reporting

**Who this is for:** anyone running something in the Mapp Labs AWS account
(`936190502406`) that was **not** built from `labs-app-template` — a hand-rolled
CDK/Terraform stack, a console-clicked EC2 box, a Helm chart, a one-off script.

If your app *was* built from the template, don't use this. Use
[`docs/retrofit/2026-08-01-cost-tag-hygiene.md`](../../retrofit/2026-08-01-cost-tag-hygiene.md)
instead — it edits your config so the tags survive your next deploy.

**Why you're being asked:** AWS spend is attributed to an app and a person using
resource tags. Anything untagged lands in an "unattributed" bucket that nobody
owns — and today that bucket is a large fraction of the account. Tagging your
system takes about fifteen minutes and makes your spend visible and defensible
instead of everyone else's problem.

---

## How to use this

1. Open **the repo (or just a terminal) for the system you own** in your coding agent.
2. Make sure you have AWS credentials for the Labs account.
3. Paste everything between **PROMPT START** and **PROMPT END**.
4. Answer the agent's questions about who owns the thing.

You do not need a checkout of `labs-app-template` for this.

---

## PROMPT START

You are applying **cost-allocation tags** to AWS resources in the Mapp Labs shared
account so that this system's spend can be attributed in the monthly cost report.
This system was **not** built from `labs-app-template`, so there is no standard
config file to edit — you will discover the resources and tag them where they live.

### Ground rules — read before touching anything

1. **Tagging is additive and safe, with exactly one exception.** Adding a tag to a
   resource never changes its behaviour. The exception is ECS services: fixing tag
   propagation requires a new deployment, which restarts tasks. Call that out and
   get my explicit approval before doing it — see step 4.
2. **Never tag shared infrastructure.** The VPC, subnets, Transit Gateway, Route 53
   hosted zone (`labs.mapp.com`), Route 53 Resolver endpoints, and shared buckets
   like `mapp-labs-data-sync` are used by *many* Labs apps. Putting one app's
   `Project` tag on them actively corrupts everyone else's numbers. If you are not
   certain a resource belongs solely to this system, ask me — do not guess.
3. **Do not touch resources belonging to other systems.** You are in a shared
   account with ~40 other apps. Scope every action to resources you have positively
   identified as this system's.
4. **Read before you write.** Show me the full list of resources you intend to tag,
   with the tags you intend to apply, and wait for my approval before applying any
   of them.
5. **Ask, don't invent.** If you cannot determine the owner or product line, ask me.
   A wrong tag is worse than a missing one, because it silently bills the wrong
   person.

### Step 1 — establish identity

Ask me these, and do not proceed until you have answers. Propose a sensible default
for each based on what you find in the repo (git history, README, existing tags),
but let me confirm.

| Tag | Meaning | Format |
|-----|---------|--------|
| `Project` | The app/system name. **The** per-app billing line item. Must be unique in the account and stable forever. | lowercase-kebab-case, e.g. `spamtrap-dashboard` |
| `AppOwner` | The person who owns this budget **today**. This drives the per-person report. | `firstname.lastname`, lowercase, **no** `@mapp.com` |
| `CreatedBy` | Who originally built it. May equal `AppOwner`. Historical; never changes. | `firstname.lastname` |
| `Environment` | Which environment this resource serves. Omit on resources shared across environments (e.g. a single ECR repo). | exactly `staging` or `production` |
| `Product` | Mapp product **line** this rolls up to — NOT the app name. | exactly one of `fashion`, `engage`, `intelligence`, `internal` |
| `Team` | Org grouping. **Free text — no approved list.** Use whatever I tell you. | anything, e.g. `deliverability`, `Customer Success` |
| `ManagedBy` | Free text: who to contact operationally. | |

**Every resource needs BOTH `Project` and `AppOwner`.** This is the whole point.
`Project` alone gives a per-app total with no human attached; `AppOwner` alone gives
a person with no breakdown of what they're spending it on. The report produces an
app view, a person view, and an app × person grid — the grid only works if both keys
are on the same resource. Do not tag one and skip the other.

**Format matters more than it looks.** The report groups on exact string values.
`Jane.Doe`, `jane.doe@mapp.com`, and `janed` are three
different people as far as billing is concerned — this has already happened. Use
lowercase `firstname.lastname` with no domain, always.

`AppOwner` must be a **human**. Do not put a team name, `labs`, `Mapp Labs`, or a
product name in it — that spend gets reported as unattributed.

> **Use `AppOwner`, not `Owner`.** Many resources in this account already carry an
> AWS-set `Owner: AWSCloudFormation` tag (CloudFormation stamps it on ECS clusters),
> and a handful carry `Owner: <someone>@mapp.com` from an earlier ad-hoc convention.
> That key is polluted and we can't clean it. If you find an existing `Owner` tag,
> **leave it alone** and add `AppOwner` alongside it.

### Step 2 — discover this system's resources

Find every AWS resource this system owns. Do not assume the list is short. Use the
Resource Groups Tagging API to sweep broadly, then narrow by name:

```bash
export AWS_PROFILE=<my profile>   # ask me; usually labs-power
export AWS_REGION=eu-central-1

# Everything in the region, with its current tags. Start here.
aws resourcegroupstaggingapi get-resources \
  --query 'ResourceTagMappingList[].{arn:ResourceARN,tags:Tags}' --output json \
  > /tmp/all-resources.json

# Which of those have no Project tag at all?
aws resourcegroupstaggingapi get-resources \
  --query 'ResourceTagMappingList[?!not_null(Tags[?Key==`Project`].Value | [0])].ResourceARN' \
  --output text | tr '\t' '\n'
```

Then check each resource type this system might use. Adapt the name filter:

```bash
NAME=<system name fragment>

aws ecs list-clusters
aws ecs list-services --cluster <cluster>
aws ec2 describe-instances \
  --query 'Reservations[].Instances[].{id:InstanceId,name:Tags[?Key==`Name`].Value|[0],proj:Tags[?Key==`Project`].Value|[0]}'
aws ec2 describe-volumes  --query 'Volumes[].{id:VolumeId,proj:Tags[?Key==`Project`].Value|[0]}'
aws ec2 describe-addresses --query 'Addresses[].{ip:PublicIp,proj:Tags[?Key==`Project`].Value|[0]}'
aws elbv2 describe-load-balancers --query 'LoadBalancers[].LoadBalancerArn'
aws rds describe-db-instances --query 'DBInstances[].DBInstanceArn'
aws s3api list-buckets --query 'Buckets[].Name'
aws ecr describe-repositories --query 'repositories[].repositoryArn'
aws logs describe-log-groups --query 'logGroups[].logGroupName'
aws secretsmanager list-secrets --query 'SecretList[].ARN'
aws sqs list-queues
aws elasticache describe-cache-clusters --query 'CacheClusters[].ARN'
aws kafka list-clusters-v2 --query 'ClusterInfoList[].ClusterArn'    # MSK is expensive
aws lambda list-functions --query 'Functions[].FunctionArn'
aws kms list-keys --query 'Keys[].KeyArn'
aws sns list-topics --query 'Topics[].TopicArn'
aws autoscaling describe-auto-scaling-groups \
  --query 'AutoScalingGroups[].{name:AutoScalingGroupName,tags:Tags[].Key}'
```

**EBS volumes and Elastic IPs are the two most commonly missed.** A tagged EC2
instance with an untagged 500 GB volume still leaks most of its storage cost, and
idle Elastic IPs bill whether or not anything uses them.

**Don't stop at the obvious services.** A real multi-service stack in this account
carries spend across RDS, ELB, MSK, ElastiCache, KMS, Lambda, SNS, Service Discovery,
and EC2 simultaneously — MSK and ElastiCache in particular are large and easy to
forget because nobody thinks of them as "the app".

Present the findings to me as a table — resource, type, current tags, proposed tags
— and flag anything you are unsure about. **Wait for my approval.**

### Step 3 — apply tags to everything except ECS services

Most resources take tags via the generic tagging API:

```bash
aws resourcegroupstaggingapi tag-resources \
  --resource-arn-list <arn> [<arn> ...] \
  --tags Project=<project>,AppOwner=<owner>,CreatedBy=<createdby>,\
Environment=<env>,Product=<product>,Team=<team>,ManagedBy=<managedby>
```

A few types need their own call:

```bash
# EC2 instances, volumes, ENIs, Elastic IPs
aws ec2 create-tags --resources <id> [<id> ...] \
  --tags Key=Project,Value=<project> Key=AppOwner,Value=<owner> Key=Environment,Value=<env>

# S3 buckets — NOTE: put-bucket-tagging REPLACES the whole tag set.
# Read the existing tags first and merge, or you will silently delete tags.
aws s3api get-bucket-tagging --bucket <bucket>   # read first!
aws s3api put-bucket-tagging --bucket <bucket> \
  --tagging 'TagSet=[{Key=Project,Value=<project>},{Key=AppOwner,Value=<owner>},{Key=Environment,Value=<env>}]'

# CloudWatch log groups
aws logs tag-resource --resource-arn <log-group-arn> \
  --tags Project=<project>,AppOwner=<owner>,Environment=<env>
```

Omit `Environment` on resources shared across environments (a single ECR repo
serving both staging and production, for instance).

### Step 4 — fix ECS tag propagation (the one that actually matters)

**This is usually the single biggest win, and it is the step people skip.**

Fargate vCPU and GB-hours are billed against the **running task**, not the service.
If a service does not propagate its tags to tasks, its compute — normally the
largest line item in the whole app — is billed completely untagged. Tagging the
service resource does *not* fix this — and across the account this single
misconfiguration is the largest source of untraceable spend there is.

Check every service belonging to this system:

```bash
aws ecs describe-services --cluster <cluster> --services <service> \
  --query 'services[0].[serviceName,propagateTags,enableECSManagedTags]' --output text
```

You want `SERVICE` and `True`. Anything else — `NONE`, `TASK_DEFINITION`, `False` —
is broken for billing.

To fix it:

- **If the service is managed by IaC (CDK/Terraform/CloudFormation), change the
  source, not the live service.** A direct `update-service` will be reverted on the
  next deploy and the problem comes straight back.
  - CDK: `enableECSManagedTags: true, propagateTags: ecs.PropagatedTagSource.SERVICE`
    on the `FargateService` / `ApplicationLoadBalancedFargateService`.
  - Terraform: `enable_ecs_managed_tags = true`, `propagate_tags = "SERVICE"` on
    `aws_ecs_service`.
  - Set this on **every** service, including sidecars, workers, and anything added
    later. Each one bills its own compute.
- **If it is genuinely unmanaged**, update it live:

  ```bash
  aws ecs update-service --cluster <cluster> --service <service> \
    --propagate-tags SERVICE --enable-ecs-managed-tags --force-new-deployment
  ```

> **Stop and get my approval before running this.** `--force-new-deployment`
> restarts the service's tasks. It is a normal rolling deployment, but it is a real
> deployment — do not run it against production without asking me first, and tell me
> if the service has no load balancer or health check to roll safely against.

**Tags only apply to tasks started after the change.** Existing tasks keep running
untagged until they are replaced, so the fix shows up in billing gradually, not
instantly.

### Step 4b — Auto Scaling Groups: the same trap, different service

If this system has an ASG (a self-managed ClickHouse/Kafka/runner fleet, an ECS-on-EC2
capacity provider), it has **exactly the same problem as ECS tasks**: tags on the ASG
do not reach the instances it launches unless each tag is marked
`PropagateAtLaunch`. Instances launched without it bill their EC2 hours and their EBS
volumes untagged.

```bash
# Does each tag propagate to launched instances?
aws autoscaling describe-auto-scaling-groups --auto-scaling-group-names <asg> \
  --query 'AutoScalingGroups[0].Tags[].{k:Key,v:Value,prop:PropagateAtLaunch}'

# Fix (IaC first — see below):
aws autoscaling create-or-update-tags --tags \
  ResourceId=<asg>,ResourceType=auto-scaling-group,Key=Project,Value=<project>,PropagateAtLaunch=true \
  ResourceId=<asg>,ResourceType=auto-scaling-group,Key=AppOwner,Value=<owner>,PropagateAtLaunch=true
```

As with ECS, **fix it in the IaC source** if the ASG is managed (CDK
`autoScalingGroup.node`/`Tags.of(asg)`, Terraform `tag { propagate_at_launch = true }`),
and note that this only affects **instances launched after** the change. Existing
instances keep their current tags — tag those directly with `aws ec2 create-tags`,
and **don't forget their EBS volumes**, which are separate resources.

### Step 5 — verify

```bash
# Running tasks carry the tags — this is the proof that step 4 worked
aws ecs describe-tasks --cluster <cluster> \
  --tasks $(aws ecs list-tasks --cluster <cluster> --service-name <service> \
            --query 'taskArns[0]' --output text) \
  --include TAGS --query 'tasks[0].tags'

# Nothing belonging to this system is still missing a Project tag
aws resourcegroupstaggingapi get-resources \
  --query 'ResourceTagMappingList[?!not_null(Tags[?Key==`Project`].Value | [0])].ResourceARN' \
  --output text | tr '\t' '\n' | grep -i <system name fragment>
```

Then confirm it reached billing. **Cost allocation tags are not retroactive and
billing data lags ~24 hours**, so this will show nothing until tomorrow at the
earliest, and only for usage after the change:

> **`AppOwner` needs one-time activation before it reaches Cost Explorer at all.**
> A tag key only becomes groupable in billing once it's activated as a Cost
> Allocation Tag in the **payer account `787184414136`** — which cannot be done from
> `labs-power`. Until someone with billing admin does that, your `AppOwner` tags are
> applied correctly but invisible to the report, which falls back to `CreatedBy`.
> **Tag anyway, and tag now.** Activation can be repaired after the fact — AWS can
> replay activation status up to 12 months back — but only for tags that were
> already on the resources. Untagged usage is lost permanently. Just don't be
> surprised when the per-person numbers don't move yet.

```bash
aws ce get-cost-and-usage --region us-east-1 \
  --time-period Start=<yesterday>,End=<today> --granularity DAILY \
  --metrics UnblendedCost --filter '{"Tags":{"Key":"Project","Values":["<project>"]}}'
```

### Step 6 — report back to me

Tell me plainly:

1. Which resources you tagged, and with what.
2. Which ECS services you fixed, and whether that required a deployment.
3. **Anything you could not tag, and why** — this is the most useful part. Some
   costs genuinely cannot be attributed (CloudWatch metric-monitor usage has no
   taggable resource, for example). I would rather know than have you paper over it.
4. Anything you deliberately left alone because it looked shared.
5. If this system is defined in IaC, whether the tags are now in the source code —
   so they survive the next deploy — or only applied live and will drift back.

Do not claim the system is fully tagged if it isn't. A known gap is fine; a false
all-clear is not.

## PROMPT END

---

## For reference: what the tags feed

A monthly report groups spend by `Project` (the app) and `AppOwner` (the person),
spreads genuinely-shared infrastructure and tax pro rata, and flags any app whose
ECS compute is untagged so nobody reads an understated number as truth.

It is **best effort by design** — it never fails because tags are missing, it just
attributes less. Every system that runs this prompt moves a bit more of the account
out of "unattributed" and into somebody's column. You don't need access to the
report; you just need your resources tagged.
