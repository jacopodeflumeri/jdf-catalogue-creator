#!/bin/bash
set -e

# Run database migrations via ECS Exec
# Usage: ./run-migration.sh [staging|production]

ENV="${1:-staging}"
AWS_PROFILE="${AWS_PROFILE:-labs-power}"
AWS_REGION="eu-central-1"
source "$(dirname "$0")/_config.sh"

CLUSTER_NAME="${APP_NAME}-${SHORT_ENV}"
SERVICE_NAME="${APP_NAME}-${SHORT_ENV}"

echo "=========================================="
echo "Running Database Migrations"
echo "=========================================="
echo "Environment: ${ENV}"
echo "Cluster:     ${CLUSTER_NAME}"
echo "=========================================="
echo ""

# Get a running task ARN
echo "Finding running task..."
TASK_ARN=$(aws ecs list-tasks \
    --cluster ${CLUSTER_NAME} \
    --service-name ${SERVICE_NAME} \
    --desired-status RUNNING \
    --region ${AWS_REGION} \
    --profile ${AWS_PROFILE} \
    --query 'taskArns[0]' \
    --output text)

if [ "$TASK_ARN" = "None" ] || [ -z "$TASK_ARN" ]; then
    echo "Error: No running tasks found in ${CLUSTER_NAME}/${SERVICE_NAME}"
    exit 1
fi

echo "Task ARN: ${TASK_ARN}"
echo ""

# Run migration command via ECS Exec
echo "Running prisma migrate deploy..."
aws ecs execute-command \
    --cluster ${CLUSTER_NAME} \
    --task ${TASK_ARN} \
    --container App \
    --interactive \
    --command "sh -c 'export DATABASE_URL=\"postgresql://\${DB_USER}:\${DB_PASSWORD}@\${DB_HOST}:\${DB_PORT}/\${DB_NAME}\" && npx prisma migrate deploy'" \
    --region ${AWS_REGION} \
    --profile ${AWS_PROFILE}

echo ""
echo "=========================================="
echo "Migrations complete!"
echo "=========================================="
