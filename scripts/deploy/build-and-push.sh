#!/bin/bash
set -e

# Build and push Docker image to ECR
# Usage: ./build-and-push.sh [staging|production] [image-tag]

ENV="${1:-staging}"
COMMIT_SHA="$(git rev-parse --short HEAD)"
IMAGE_TAG="${2:-${COMMIT_SHA}}"
AWS_PROFILE="${AWS_PROFILE:-labs-power}"
AWS_REGION="eu-central-1"
ACCOUNT_ID="936190502406"
source "$(dirname "$0")/_config.sh"
ECR_URI="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO}"

# Extract version from package.json
APP_VERSION=$(node -p "require(process.argv[1]).version" "$(to_node_path "${PROJECT_ROOT}/package.json")")

echo "=========================================="
echo "Building and Pushing Docker Image"
echo "=========================================="
echo "Environment: ${ENV}"
echo "Version:     ${APP_VERSION}"
echo "Commit:      ${COMMIT_SHA}"
echo "Image Tag:   ${IMAGE_TAG}"
echo "ECR Repo:    ${ECR_REPO}"
echo "ECR URI:     ${ECR_URI}"
echo "=========================================="
echo ""

# Navigate to project root
cd "$(dirname "$0")/../.."

# Authenticate with ECR
echo "Authenticating with ECR..."
ECR_REGISTRY="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
if [[ "$(uname -s)" == MINGW* || "$(uname -s)" == MSYS* ]] && command -v docker-credential-ecr-login &>/dev/null; then
    # Windows: `docker login` stores the token in Windows Credential Manager,
    # which holds at most 2,560 bytes. ECR tokens from an SSO session are often
    # longer, and the login fails with "The stub received bad data." Instead,
    # use a throwaway Docker config for this run that hands ECR to Amazon's
    # credential helper (shipped with Docker Desktop and Rancher Desktop): it
    # fetches a token from the AWS profile on demand and stores nothing.
    # Everything else in the user's config (credsStore for Docker Hub,
    # currentContext, ...) is kept; only saved `auths` are dropped.
    USER_DOCKER_CONFIG="${DOCKER_CONFIG:-${HOME}/.docker}"
    DOCKER_CONFIG_TMP="$(mktemp -d)"
    add_exit_trap 'rm -rf "${DOCKER_CONFIG_TMP}"'
    # Contexts (e.g. a Docker/Rancher Desktop context) live next to config.json.
    if [ -d "${USER_DOCKER_CONFIG}/contexts" ]; then
        cp -R "${USER_DOCKER_CONFIG}/contexts" "${DOCKER_CONFIG_TMP}/contexts"
    fi
    node -e '
        const fs = require("fs");
        const [src, dest, registry, pluginsDir] = process.argv.slice(1);
        const config = fs.existsSync(src) ? JSON.parse(fs.readFileSync(src, "utf8")) : {};
        delete config.auths;
        config.credHelpers = { ...(config.credHelpers || {}), [registry]: "ecr-login" };
        // Keep finding CLI plugins (buildx) installed in the user config dir.
        config.cliPluginsExtraDirs = [...(config.cliPluginsExtraDirs || []), pluginsDir];
        fs.writeFileSync(dest, JSON.stringify(config, null, 2));
    ' "$(to_node_path "${USER_DOCKER_CONFIG}/config.json")" \
      "$(to_node_path "${DOCKER_CONFIG_TMP}/config.json")" \
      "${ECR_REGISTRY}" \
      "$(to_node_path "${USER_DOCKER_CONFIG}/cli-plugins")"
    DOCKER_CONFIG="$(cygpath -w "${DOCKER_CONFIG_TMP}")"
    export DOCKER_CONFIG AWS_PROFILE AWS_REGION
    echo "  Using docker-credential-ecr-login (Windows Credential Manager can't hold ECR tokens)"
else
    if [[ "$(uname -s)" == MINGW* || "$(uname -s)" == MSYS* ]]; then
        echo "  Note: docker-credential-ecr-login not found on PATH. If the login below fails"
        echo "  with \"The stub received bad data\", install it (it ships with Docker Desktop /"
        echo "  Rancher Desktop; or download the windows-amd64 binary from"
        echo "  https://github.com/awslabs/amazon-ecr-credential-helper/releases and put it on PATH)."
    fi
    aws ecr get-login-password --region "${AWS_REGION}" --profile "${AWS_PROFILE}" | \
        docker login --username AWS --password-stdin "${ECR_REGISTRY}"
fi

echo ""
echo "Building and pushing Docker image..."
docker buildx build \
    --platform linux/amd64 \
    --build-arg APP_VERSION=${APP_VERSION} \
    --build-arg BUILD_COMMIT=${COMMIT_SHA} \
    --build-arg APP_ENVIRONMENT=${ENV} \
    -t ${ECR_URI}:${IMAGE_TAG} \
    -t ${ECR_URI}:${ENV}-${APP_VERSION} \
    -t ${ECR_URI}:${ENV}-latest \
    --push \
    .

echo ""
echo "=========================================="
echo "Image pushed successfully!"
echo "Tags pushed:"
echo "  - ${ECR_URI}:${IMAGE_TAG} (commit)"
echo "  - ${ECR_URI}:${ENV}-${APP_VERSION} (env-version — IMMUTABLE, what the ECS task def pulls)"
echo "  - ${ECR_URI}:${ENV}-latest (env-floating — convenience/health-check only)"
echo "Note: no shared :latest tag — staging and production are isolated."
echo "Note: the ECS task definition references ${ENV}-${APP_VERSION}, NOT ${ENV}-latest."
echo "      Bump the version (make version-patch) to create a new rollback point."
echo "=========================================="

# Keep Docker's disk use on the deploying machine bounded. Every build leaves
# several GB of build cache and an image behind; after a day of deploys they
# can fill a laptop's drive (Docker then fails with "read-only file system").
# Keep at most DOCKER_BUILD_CACHE_MAX of build cache (the newest, so builds
# stay fast) and untag this app's local images (every pushed version stays in
# ECR). Only references in this app's ECR repo (${ECR_URI}) are removed --
# other projects' images are never touched. Never fails the deploy.
# Opt out with DOCKER_CLEANUP=false.
if [ "${DOCKER_CLEANUP:-true}" != "false" ]; then
    DOCKER_BUILD_CACHE_MAX="${DOCKER_BUILD_CACHE_MAX:-10GB}"
    echo ""
    echo "Cleaning up local Docker build files (keeps up to ${DOCKER_BUILD_CACHE_MAX} of build cache)..."
    # --max-used-space is Docker 28+; --keep-storage is the older spelling.
    docker builder prune -f --max-used-space "${DOCKER_BUILD_CACHE_MAX}" >/dev/null 2>&1 \
        || docker builder prune -f --keep-storage "${DOCKER_BUILD_CACHE_MAX}" >/dev/null 2>&1 \
        || echo "  (skipped: could not prune the Docker build cache)"
    APP_IMAGE_REFS="$(docker images "${ECR_URI}" --format '{{.Repository}}:{{.Tag}}' 2>/dev/null \
        | grep -v ':<none>$' | sort -u || true)"
    if [ -n "${APP_IMAGE_REFS}" ]; then
        # No -f: untag by reference, so an image also tagged elsewhere survives.
        # shellcheck disable=SC2086 # one image reference per word
        docker rmi ${APP_IMAGE_REFS} >/dev/null 2>&1 \
            || echo "  (skipped: could not remove some local images of ${ECR_URI})"
    fi
    echo "Local Docker clean-up done."
fi
