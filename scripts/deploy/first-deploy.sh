#!/bin/bash
set -e

# =============================================================================
# First-Time Deployment Bootstrap
# Handles the complete initial deployment sequence for a new environment.
#
# This script runs the steps in the correct order to avoid the ECS circuit
# breaker issue (the ECS service tries to pull a Docker image immediately —
# if the ECR repo is empty, the entire CloudFormation stack rolls back).
#
# Order: ECR repo → SSM params → build+push image → infra deploy → migrate → seed
#
# Usage: ./first-deploy.sh [staging|production]
# =============================================================================

ENV="${1:-staging}"
AWS_PROFILE="${AWS_PROFILE:-labs-power}"
AWS_REGION="eu-central-1"
ACCOUNT_ID="936190502406"
SCRIPT_DIR="$(dirname "$0")"
source "${SCRIPT_DIR}/_config.sh"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PREFIX="${APP_NAME}-${SHORT_ENV}"

echo ""
echo "=========================================="
echo "  First-Time Deployment Bootstrap"
echo "=========================================="
echo ""
echo -e "  App:          ${BLUE}${APP_NAME}${NC}"
echo -e "  Environment:  ${BLUE}${ENV}${NC}"
echo -e "  Profile:      ${BLUE}${AWS_PROFILE}${NC}"
echo -e "  Region:       ${BLUE}${AWS_REGION}${NC}"
echo ""

# Production confirmation
if [ "$ENV" = "production" ]; then
    echo -e "${YELLOW}You are about to deploy to PRODUCTION.${NC}"
    echo -n "Continue? [y/N]: "
    read -r CONFIRM
    if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
        echo "Aborted."
        exit 0
    fi
    echo ""
fi

# Verify AWS credentials
echo "Verifying AWS credentials..."
if ! aws sts get-caller-identity --profile ${AWS_PROFILE} --region ${AWS_REGION} > /dev/null 2>&1; then
    echo -e "${RED}AWS credentials are not valid. Run:${NC}"
    echo "  ./scripts/refresh-labs-aws-creds.sh"
    exit 1
fi
echo -e "  ${GREEN}✓${NC} AWS credentials valid"
echo ""

# =========================================================================
# Step 1: Ensure ECR repository exists
# =========================================================================
echo "Step 1/7: Checking ECR repository..."
if aws ecr describe-repositories --repository-names "${APP_NAME}" --region ${AWS_REGION} --profile ${AWS_PROFILE} > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} ECR repository '${APP_NAME}' already exists"
else
    echo "  Creating ECR repository '${APP_NAME}'..."
    # Cost-allocation tags. ECR is one shared repo per app across both
    # environments, so it carries Project + Product (no Environment). Tag keys
    # must be activated in the Billing console — see docs/template/COST_ALLOCATION.md.
    # An ARRAY, not a space-joined string: tag values legitimately contain
    # spaces (real Team values include "Mapp Labs" and "Customer Success"), and
    # an unquoted string expansion would word-split "Mapp Labs" into a bogus
    # `Labs` argument and a truncated Team tag.
    ECR_TAGS=(
        "Key=Project,Value=${APP_NAME}"
        "Key=Product,Value=${APP_PRODUCT}"
        "Key=ManagedBy,Value=manual-bootstrap"
    )
    if [ -n "${APP_TEAM}" ]; then
        ECR_TAGS+=("Key=Team,Value=${APP_TEAM}")
    fi
    if [ -n "${APP_OWNER}" ]; then
        ECR_TAGS+=("Key=AppOwner,Value=${APP_OWNER}")
    fi
    aws ecr create-repository \
        --repository-name "${APP_NAME}" \
        --region ${AWS_REGION} \
        --profile ${AWS_PROFILE} \
        --tags "${ECR_TAGS[@]}" \
        --output text > /dev/null
    echo -e "  ${GREEN}✓${NC} ECR repository created (tagged Project=${APP_NAME}, Product=${APP_PRODUCT}, AppOwner=${APP_OWNER:-<unset>})"
fi

# Apply the ECR lifecycle policy (idempotent: put-lifecycle-policy is a full
# replace). Three prefix-/age-scoped rules keep production and staging expiry
# independent and clean up untagged buildx manifest children — see the script
# header and the 2026-07-10 MIGRATION.md entry. Runs on every bootstrap; safe to
# re-run. Non-fatal so a first deploy still proceeds if the caller lacks
# ecr:PutLifecyclePolicy.
if ! ${SCRIPT_DIR}/set-ecr-lifecycle.sh; then
    echo -e "  ${YELLOW}WARNING:${NC} could not set the ECR lifecycle policy."
    echo "           The app still deploys, but old images won't be expired."
    echo "           Re-run later: make ecr-lifecycle-set"
fi
echo ""

# =========================================================================
# Step 2: Set up SSM parameters
# =========================================================================
echo "Step 2/7: Setting up SSM parameters..."
echo "  Checking for existing parameters..."

EXISTING_PARAMS=$(aws ssm get-parameters-by-path \
    --path "/${PREFIX}/" \
    --region ${AWS_REGION} \
    --profile ${AWS_PROFILE} \
    --query 'Parameters[*].Name' \
    --output text 2>/dev/null || echo "")

if [ -n "$EXISTING_PARAMS" ]; then
    echo -e "  ${GREEN}✓${NC} SSM parameters already configured"
    echo "  Found: $(echo "$EXISTING_PARAMS" | tr '\t' ', ')"
    echo ""
    echo -n "  Re-run SSM setup? [y/N]: "
    read -r RERUN_SSM
    if [ "$RERUN_SSM" = "y" ] || [ "$RERUN_SSM" = "Y" ]; then
        ${SCRIPT_DIR}/setup-ssm-params.sh ${ENV}
    fi
else
    ${SCRIPT_DIR}/setup-ssm-params.sh ${ENV}
fi
echo ""

# =========================================================================
# Step 3: Build and push Docker image
# =========================================================================
echo "Step 3/7: Building and pushing Docker image..."
echo "  (The image must exist in ECR before infrastructure deploy,"
echo "   otherwise the ECS service will fail to start and the"
echo "   CloudFormation stack will roll back.)"
echo ""
${SCRIPT_DIR}/build-and-push.sh ${ENV}
echo ""

# =========================================================================
# Step 4: Deploy infrastructure
# =========================================================================
echo "Step 4/7: Deploying infrastructure (CDK)..."
echo "  This creates: ECS cluster, RDS database, ALB, Route53 DNS,"
echo "  ACM certificate, security groups, IAM roles, CloudWatch logs."
echo ""
${SCRIPT_DIR}/deploy-infra.sh ${ENV}
echo ""

# =========================================================================
# Step 5: Run database migrations
# =========================================================================
echo "Step 5/7: Running database migrations..."
echo "  Waiting for ECS service to stabilize before running migrations..."
echo ""

# Wait for the service to be stable
aws ecs wait services-stable \
    --cluster "${PREFIX}" \
    --services "${PREFIX}" \
    --region ${AWS_REGION} \
    --profile ${AWS_PROFILE} 2>/dev/null || true

${SCRIPT_DIR}/run-migration.sh ${ENV}
echo ""

# =========================================================================
# Step 6: Seed the database
# =========================================================================
echo "Step 6/7: Seeding the database..."
echo ""
${SCRIPT_DIR}/run-seed.sh ${ENV}
echo ""

# =========================================================================
# Step 7: Register this app's URIs on the INT KC labs-portal client.
# Non-fatal: if Keycloak is unreachable or the registrar creds aren't set
# up yet, the app deploys fine but auth callbacks won't be whitelisted
# until someone runs the script manually.
# =========================================================================
echo "Step 7/7: Registering Keycloak labs-portal URIs..."
if ! ${SCRIPT_DIR}/register-keycloak-uris.sh ${ENV}; then
    echo ""
    echo -e "${YELLOW}WARNING:${NC} Keycloak URI registration failed. The app is deployed but"
    echo "         logins will fail with 'Invalid redirect URI' until URIs are"
    echo "         registered. Either re-run scripts/deploy/register-keycloak-uris.sh"
    echo "         or add the URIs manually in the INT KC admin console."
fi
echo ""

# =========================================================================
# Summary
# =========================================================================
if [ "$ENV" = "production" ]; then
    APP_URL="https://${APP_NAME}.labs.mapp.com"
else
    APP_URL="https://stg-${APP_NAME}.labs.mapp.com"
fi

echo "=========================================="
echo -e "  ${GREEN}First-time deployment complete!${NC}"
echo "=========================================="
echo ""
echo -e "  Application URL:  ${BLUE}${APP_URL}${NC}"
echo -e "  ECS Cluster:      ${PREFIX}"
echo -e "  ECS Service:      ${PREFIX}"
echo ""
MAKE_PREFIX="staging"
if [ "$ENV" = "production" ]; then
    MAKE_PREFIX="prod"
fi

echo "  Next steps:"
echo "    1. Verify the app is running: curl -s ${APP_URL}/api/health | jq ."
echo "    2. Register Icinga monitoring: make ${MAKE_PREFIX}-monitoring-add"
echo "    3. For subsequent deploys, use: make ${MAKE_PREFIX}-deploy"
echo ""
