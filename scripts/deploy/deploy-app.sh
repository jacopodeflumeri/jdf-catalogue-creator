#!/bin/bash
set -e

# Deploy the application to ECS.
#
# TWO deploy models, selected by the `immutableDeploy` key in app.config.json —
# a SINGLE source of truth this script (via _config.sh) and the CDK stack
# (infra/lib/stack.ts) both read, so they never disagree about which image tag
# the task def references.
#
#   immutableDeploy=false  (DEFAULT)
#     The task def tracks the FLOATING `${ENV}-latest` tag; a deploy is
#     `aws ecs update-service --force-new-deployment`, which re-pulls that tag.
#     This path needs NO elevated IAM: it never calls register-task-definition
#     (which requires `iam:PassRole` on the task/execution roles), so the
#     standard labs deploy identity — the `labs-power` profile →
#     AWSReservedSSO_PowerUserAccess SSO role, which denies all `iam:*` — works.
#     This is the safe default for every fork.
#
#   immutableDeploy=true  (OPT-IN)
#     The task def pins the IMMUTABLE `${ENV}-${APP_VERSION}` tag; a deploy
#     registers a NEW task-def revision (describe current task def → swap only
#     the image → strip read-only fields → register-task-definition →
#     update-service --task-definition). This gives deterministic images and
#     real rollbacks (`deploy-app.sh <env> <older-tag>`), but
#     register-task-definition requires `iam:PassRole` on the app's ECS task and
#     execution roles — which PowerUserAccess/`labs-power` does NOT hold. Only
#     enable this if your deployer (e.g. a dedicated CI role) has that
#     permission. See docs/template/DEPLOYMENT.md and the 2026-07-11 MIGRATION.md entry.
#
# `build-and-push.sh` pushes BOTH `${ENV}-${version}` and `${ENV}-latest`, so
# both models work with no build change.
#
# Usage: ./deploy-app.sh [staging|production] [image-tag]
#   image-tag is only meaningful in the immutable model (rollback / pin), where
#   it defaults to `${ENV}-${APP_VERSION}` from package.json — e.g.
#   `./deploy-app.sh production production-1.0.25`. In the default floating model
#   the task def tracks `${ENV}-latest`, which is what force-new-deployment
#   re-pulls, so a positional tag does not apply.

ENV="${1:-staging}"
AWS_PROFILE="${AWS_PROFILE:-labs-power}"
AWS_REGION="eu-central-1"
ACCOUNT_ID="936190502406"
source "$(dirname "$0")/_config.sh"

# Immutable, env-scoped image tag — the single source of truth is package.json's
# version, exactly as build-and-push.sh and the CDK stack derive it.
APP_VERSION="$(node -p "require(process.argv[1]).version" "$(to_node_path "${PROJECT_ROOT}/package.json")")"

# Resolve the image tag this deploy targets, per the active deploy model.
if [ "${IMMUTABLE_DEPLOY}" = "true" ]; then
    IMAGE_TAG="${2:-${ENV}-${APP_VERSION}}"
else
    IMAGE_TAG="${ENV}-latest"
    if [ -n "${2:-}" ]; then
        echo "Note: immutableDeploy is off — ignoring image tag '${2}'."
        echo "      A force-new-deployment re-pulls the task def's ${ENV}-latest tag."
        echo "      To deploy/roll back a specific tag, set \"immutableDeploy\": true"
        echo "      in app.config.json (requires iam:PassRole — see docs/template/DEPLOYMENT.md)."
        echo ""
    fi
fi

ECR_URI="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO}"
IMAGE_URI="${ECR_URI}:${IMAGE_TAG}"

CLUSTER_NAME="${APP_NAME}-${SHORT_ENV}"
SERVICE_NAME="${APP_NAME}-${SHORT_ENV}"

if [ "${IMMUTABLE_DEPLOY}" = "true" ]; then
    DEPLOY_MODEL="immutable task-def revision (requires iam:PassRole)"
else
    DEPLOY_MODEL="floating tag + force-new-deployment (no iam:PassRole)"
fi

echo "=========================================="
echo "Deploying Application to ECS"
echo "=========================================="
echo "Environment:  ${ENV}"
echo "Deploy model: ${DEPLOY_MODEL}"
echo "Image:        ${IMAGE_URI}"
echo "Cluster:      ${CLUSTER_NAME}"
echo "Service:      ${SERVICE_NAME}"
echo "=========================================="
echo ""

# ---------------------------------------------------------------------------
# Confirm the target image actually exists in ECR before we touch the service.
# This is a pure read (`ecr:DescribeImages`) — no elevated IAM. A missing tag
# would let the next task launch fail with CannotPullContainerError — the exact
# class of outage this change exists to prevent.
# ---------------------------------------------------------------------------
echo "Verifying image ${IMAGE_TAG} exists in ECR..."
if ! aws ecr describe-images \
    --repository-name "${ECR_REPO}" \
    --image-ids "imageTag=${IMAGE_TAG}" \
    --region "${AWS_REGION}" \
    --profile "${AWS_PROFILE}" > /dev/null 2>&1; then
    echo "Error: image tag '${IMAGE_TAG}' not found in ECR repo '${ECR_REPO}'."
    echo "       Run build-and-push.sh first, or pass an existing tag as arg 2."
    exit 1
fi

if [ "${IMMUTABLE_DEPLOY}" != "true" ]; then
    # -----------------------------------------------------------------------
    # DEFAULT model: floating tag + force-new-deployment. The task def already
    # references `${ENV}-latest` (rendered by `cdk deploy`); forcing a new
    # deployment makes ECS re-pull that tag. No describe / register-task-
    # definition, so NO iam:PassRole is required — this is why it works with the
    # labs-power / PowerUserAccess deploy identity.
    # -----------------------------------------------------------------------
    echo ""
    echo "Forcing new deployment (re-pull ${ENV}-latest)..."
    aws ecs update-service \
        --cluster "${CLUSTER_NAME}" \
        --service "${SERVICE_NAME}" \
        --force-new-deployment \
        --region "${AWS_REGION}" \
        --profile "${AWS_PROFILE}" \
        --output text \
        --query 'service.deployments[0].status'
else
    # -----------------------------------------------------------------------
    # OPT-IN model: register a new immutable task-def revision.
    #
    # Read the task definition the service is currently running and rewrite only
    # the App and CatalogWorker images. They share one release image, but ECS
    # does not guarantee container array order. Strip the read-only fields that
    # register-task-definition rejects. That command requires iam:PassRole on
    # the task/execution roles embedded in the task def — enable immutableDeploy
    # only with a deployer that has it.
    # -----------------------------------------------------------------------
    echo ""
    echo "Reading current task definition from service..."
    CURRENT_TASKDEF_ARN=$(aws ecs describe-services \
        --cluster "${CLUSTER_NAME}" \
        --services "${SERVICE_NAME}" \
        --region "${AWS_REGION}" \
        --profile "${AWS_PROFILE}" \
        --query 'services[0].taskDefinition' \
        --output text)

    if [ "${CURRENT_TASKDEF_ARN}" = "None" ] || [ -z "${CURRENT_TASKDEF_ARN}" ]; then
        echo "Error: could not resolve current task definition for ${SERVICE_NAME}."
        echo "       Has the infrastructure been deployed yet? (make ${SHORT_ENV}-first-deploy)"
        exit 1
    fi
    echo "Current: ${CURRENT_TASKDEF_ARN}"

    NEW_TASKDEF_JSON=$(aws ecs describe-task-definition \
        --task-definition "${CURRENT_TASKDEF_ARN}" \
        --region "${AWS_REGION}" \
        --profile "${AWS_PROFILE}" \
        --query 'taskDefinition' \
        --output json | jq \
            --arg IMAGE "${IMAGE_URI}" \
            '.containerDefinitions |= map(
               if (.name == "App" or .name == "CatalogWorker")
               then .image = $IMAGE
               else .
               end
             )
             | del(.taskDefinitionArn, .revision, .status, .requiresAttributes,
                   .compatibilities, .registeredAt, .registeredBy)')

    echo ""
    echo "Registering new task definition revision (image -> ${IMAGE_TAG})..."
    NEW_TASKDEF_ARN=$(aws ecs register-task-definition \
        --region "${AWS_REGION}" \
        --profile "${AWS_PROFILE}" \
        --cli-input-json "${NEW_TASKDEF_JSON}" \
        --query 'taskDefinition.taskDefinitionArn' \
        --output text)
    echo "Registered: ${NEW_TASKDEF_ARN}"

    # Point the service at the new revision. No --force-new-deployment: the
    # task-def change is itself the trigger, and ECS diffs the revision.
    echo ""
    echo "Updating service to new revision..."
    aws ecs update-service \
        --cluster "${CLUSTER_NAME}" \
        --service "${SERVICE_NAME}" \
        --task-definition "${NEW_TASKDEF_ARN}" \
        --region "${AWS_REGION}" \
        --profile "${AWS_PROFILE}" \
        --output text \
        --query 'service.deployments[0].status'
fi

echo ""
echo "Waiting for deployment to stabilize..."
aws ecs wait services-stable \
    --cluster "${CLUSTER_NAME}" \
    --services "${SERVICE_NAME}" \
    --region "${AWS_REGION}" \
    --profile "${AWS_PROFILE}"

echo ""
echo "=========================================="
echo "Deployment complete!"
if [ "${IMMUTABLE_DEPLOY}" = "true" ]; then
    echo "Rollback: ./deploy-app.sh ${ENV} <previous-tag>  (e.g. ${ENV}-<older-version>)"
else
    echo "Rollback: rebuild/push the desired image so ${ENV}-latest points at it,"
    echo "          then re-run this deploy — or enable immutableDeploy for"
    echo "          tag-pinned rollbacks (needs iam:PassRole; see docs/template/DEPLOYMENT.md)."
fi
echo "=========================================="

# Show deployment status
echo ""
echo "Current deployment status:"
aws ecs describe-services \
    --cluster "${CLUSTER_NAME}" \
    --services "${SERVICE_NAME}" \
    --region "${AWS_REGION}" \
    --profile "${AWS_PROFILE}" \
    --query 'services[0].{Status:status,Running:runningCount,Desired:desiredCount,TaskDef:taskDefinition,Deployments:deployments[*].{Status:status,Running:runningCount,Desired:desiredCount}}' \
    --output table
