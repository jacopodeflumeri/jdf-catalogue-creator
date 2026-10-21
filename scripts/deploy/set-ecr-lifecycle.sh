#!/bin/bash
set -e

# =============================================================================
# Set the ECR lifecycle policy on this app's shared repository.
#
# WHY THIS IS A SCRIPT (not CDK): forks IMPORT the ECR repo
# (`ecr.Repository.fromRepositoryName(...)`) and BOTH env stacks share the ONE
# repo, so CDK can't/shouldn't own its lifecycle policy. The repo is created by
# the CLI in first-deploy.sh; its lifecycle policy is managed the same way here.
#
# IDEMPOTENT: `put-lifecycle-policy` is a declarative full REPLACE. Re-running
# with the same inputs produces the same policy — no drift, safe to run at every
# bootstrap or on demand.
#
# The policy has THREE rules — a two-rule (prod/staging only) version is a trap:
#   * Rules 10/20 keep the last N tagged `production-*` / `staging-*` images.
#     They are SEPARATE rules on purpose, so staging build churn can never expire
#     the production image (the exact failure that took ftl prod down on
#     2026-07-10). Prefix-scoped, so the env-version tags the task def pins are
#     covered — and a rollback target survives for N versions back.
#   * Rule 30 expires UNTAGGED images by AGE (sinceImagePushed, days) — NOT by
#     count. buildx pushes untagged child manifests / attestation objects that
#     the prefix rules don't match; without this rule they accumulate forever.
#     An untagged-by-COUNT rule is dangerous: it can delete a child manifest that
#     a tagged manifest list still references and break the image. Age-based is
#     safe because a child is only orphaned once its parent tag is gone.
#
# Counts are configurable (app.config.json keys or env overrides).
#
# Usage: ./set-ecr-lifecycle.sh [--dry-run]
#   ECR_KEEP_PRODUCTION (default 10)  keep last N production-* images
#   ECR_KEEP_STAGING    (default 25)  keep last N staging-* images
#   ECR_UNTAGGED_DAYS   (default 14)  expire untagged images older than N days
# =============================================================================

DRY_RUN=""
[ "${1:-}" = "--dry-run" ] && DRY_RUN="1"

AWS_PROFILE="${AWS_PROFILE:-labs-power}"
AWS_REGION="eu-central-1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_config.sh"

# Per-project counts: env var > app.config.json > default.
CFG="${PROJECT_ROOT}/app.config.json"
cfg_num() { # cfg_num <json-key> <default>
    if [ -f "${CFG}" ]; then
        node -p "require(process.argv[1]).${1} || ${2}" "$(to_node_path "${CFG}")" 2>/dev/null || echo "${2}"
    else
        echo "${2}"
    fi
}
KEEP_PRODUCTION="${ECR_KEEP_PRODUCTION:-$(cfg_num ecrKeepProduction 10)}"
KEEP_STAGING="${ECR_KEEP_STAGING:-$(cfg_num ecrKeepStaging 25)}"
UNTAGGED_DAYS="${ECR_UNTAGGED_DAYS:-$(cfg_num ecrUntaggedDays 14)}"

echo "=========================================="
echo "ECR Lifecycle Policy"
echo "=========================================="
echo "Repository:        ${ECR_REPO}"
echo "Keep production-*: ${KEEP_PRODUCTION}"
echo "Keep staging-*:    ${KEEP_STAGING}"
echo "Expire untagged:   after ${UNTAGGED_DAYS} days"
echo "=========================================="
echo ""

POLICY=$(cat <<JSON
{
  "rules": [
    {
      "rulePriority": 10,
      "description": "Keep last ${KEEP_PRODUCTION} production images",
      "selection": {
        "tagStatus": "tagged",
        "tagPrefixList": ["production-"],
        "countType": "imageCountMoreThan",
        "countNumber": ${KEEP_PRODUCTION}
      },
      "action": { "type": "expire" }
    },
    {
      "rulePriority": 20,
      "description": "Keep last ${KEEP_STAGING} staging images",
      "selection": {
        "tagStatus": "tagged",
        "tagPrefixList": ["staging-"],
        "countType": "imageCountMoreThan",
        "countNumber": ${KEEP_STAGING}
      },
      "action": { "type": "expire" }
    },
    {
      "rulePriority": 30,
      "description": "Expire untagged manifest children after ${UNTAGGED_DAYS} days",
      "selection": {
        "tagStatus": "untagged",
        "countType": "sinceImagePushed",
        "countNumber": ${UNTAGGED_DAYS},
        "countUnit": "days"
      },
      "action": { "type": "expire" }
    }
  ]
}
JSON
)

# Validate the JSON locally before sending it.
echo "${POLICY}" | jq empty

if [ -n "${DRY_RUN}" ]; then
    echo "Dry run — policy that WOULD be applied:"
    echo "${POLICY}" | jq .
    echo ""
    echo "Current policy on ${ECR_REPO} (if any):"
    aws ecr get-lifecycle-policy \
        --repository-name "${ECR_REPO}" \
        --region "${AWS_REGION}" \
        --profile "${AWS_PROFILE}" \
        --query 'lifecyclePolicyText' --output text 2>/dev/null | jq . || echo "  (none)"
    exit 0
fi

echo "Applying lifecycle policy to '${ECR_REPO}'..."
aws ecr put-lifecycle-policy \
    --repository-name "${ECR_REPO}" \
    --lifecycle-policy-text "${POLICY}" \
    --region "${AWS_REGION}" \
    --profile "${AWS_PROFILE}" \
    --output text --query 'repositoryName' > /dev/null

echo ""
echo "=========================================="
echo "Lifecycle policy applied to ${ECR_REPO}."
echo "Rules: keep ${KEEP_PRODUCTION} production-*, ${KEEP_STAGING} staging-*,"
echo "       expire untagged after ${UNTAGGED_DAYS} days."
echo "Preview matches: aws ecr get-lifecycle-policy-preview --repository-name ${ECR_REPO} ..."
echo "=========================================="
