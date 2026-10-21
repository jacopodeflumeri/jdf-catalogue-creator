#!/bin/bash
set -e

# Rolling deployment: build, push, deploy, migrate.
#
# This is the DEFAULT deploy path and it never takes the app down: ECS rolls the
# tasks over and the migration runs afterwards. An outgoing task can therefore
# briefly serve requests against the new schema — an accepted trade for not
# taking the app offline on every release, and fine for additive migrations
# (new tables, new columns, new indexes).
#
# Use the maintenance path instead when the migration is NOT backwards-
# compatible — an in-place rename, or dropping a column the outgoing image still
# selects. It gates the load balancers, drains the service to zero, and migrates
# with nothing serving:
#
#   make staging-deploy-maintenance / make prod-deploy-maintenance
#   ./scripts/deploy/maintenance-deploy.sh production
#
# Usage: ./full-deploy.sh [staging|production]

ENV="${1:-staging}"
SCRIPT_DIR="$(dirname "$0")"
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD)}"
source "$(dirname "$0")/_config.sh"

echo "=========================================="
echo "Full Deployment Pipeline"
echo "=========================================="
echo "Environment: ${ENV}"
echo "App:         ${APP_NAME}"
echo "Image Tag:   ${IMAGE_TAG}"
echo "=========================================="
echo ""

# Step 1: Build and push Docker image
echo "Step 1/4: Building and pushing Docker image..."
${SCRIPT_DIR}/build-and-push.sh ${ENV} ${IMAGE_TAG}

# Step 2: Deploy to ECS
# No image tag passed: let deploy-app.sh pick the tag per the active deploy model
# (app.config.json `immutableDeploy`). In the default floating model it re-pulls
# `${ENV}-latest`; in the opt-in immutable model it defaults to the env-version
# tag build-and-push.sh just pushed. Forwarding ${IMAGE_TAG} (the commit SHA)
# here would be wrong in both: force-new-deployment ignores it, and the immutable
# path would pin a non-`${ENV}-`prefixed tag that escapes the ECR lifecycle rules.
echo ""
echo "Step 2/4: Deploying to ECS..."
${SCRIPT_DIR}/deploy-app.sh ${ENV}

# Step 3: Run migrations
echo ""
echo "Step 3/4: Running database migrations..."
${SCRIPT_DIR}/run-migration.sh ${ENV}

# Step 4: Register this app's URIs on the INT KC labs-portal client.
# Non-fatal: if Keycloak is unreachable or the SSM creds aren't set up yet,
# the app deploys fine but the auth callbacks won't be whitelisted until
# someone runs the script manually.
echo ""
echo "Step 4/4: Registering Keycloak labs-portal URIs..."
if ! ${SCRIPT_DIR}/register-keycloak-uris.sh ${ENV}; then
    echo ""
    echo "WARNING: Keycloak URI registration failed. The app is deployed but"
    echo "         logins will fail with 'Invalid redirect URI' until URIs are"
    echo "         registered. Either re-run scripts/deploy/register-keycloak-uris.sh"
    echo "         or add the URIs manually in the INT KC admin console."
fi

echo ""
echo "=========================================="
echo "Full deployment complete!"
echo "=========================================="
echo ""

# Get the app URL
if [ "$ENV" = "production" ]; then
    echo "Application URL: https://${APP_NAME}.labs.mapp.com"
else
    echo "Application URL: https://stg-${APP_NAME}.labs.mapp.com"
fi
