#!/bin/bash
set -euo pipefail

# Register this app's hostname on the shared labs-portal Keycloak client.
#
# Reads the deployed ECS task's NEXTAUTH_URL env var to discover the exact URL
# the app is configured to be at (no assumption about a specific naming
# convention). Then adds the three URIs the app needs on the labs-portal
# client: redirect, post-logout, web-origin. Idempotent.
#
# Uses a Keycloak service account (client_credentials grant) whose secret is
# stored in SSM at <SHARED_PREFIX>/kc-registrar/* (where SHARED_PREFIX is
# /labs for staging or /labs-<env> for production and beyond). The app
# container never sees these credentials — this script runs on the deployer's
# machine after the ECS rollout, so the blast radius is the deployer's IAM
# permissions.
#
# Dependencies: jq, curl, aws-cli.
#
# Usage:
#   ./register-keycloak-uris.sh [staging|production]
#
# Env var overrides (mostly for testing):
#   APP_HOST           - bypass ECS lookup, use this hostname directly
#                        (no scheme, no path; e.g. stg-myapp.labs.mapp.com)
#   KC_REGISTRAR_BASE  - override base URL (default from SSM)
#   AWS_PROFILE        - default 'labs-power'

ENV="${1:-staging}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_config.sh"

AWS_REGION="${AWS_REGION:-eu-central-1}"
AWS_PROFILE="${AWS_PROFILE:-labs-power}"

if ! command -v jq >/dev/null 2>&1; then
    echo "ERROR: 'jq' is required but not installed." >&2
    echo "       Install: brew install jq (macOS), apt-get install jq (Linux)," >&2
    echo "       or winget install jqlang.jq (Windows; then open a new Git Bash)" >&2
    exit 1
fi

# Shared SSM namespace: staging stays at /labs/* (env-less, original layout);
# prod and any future envs use /labs-<env>/* for per-env isolation. Matches the
# same convention as setup-ssm-params.sh.
if [ "${SHORT_ENV}" = "stg" ]; then
    SSM_PREFIX="/labs/kc-registrar"
else
    SSM_PREFIX="/labs-${SHORT_ENV}/kc-registrar"
fi
LABS_REALM="labs"
LABS_CLIENT_ID="labs-portal"
REGISTRAR_REALM="labs"  # the service-account client lives in the labs realm

echo "=========================================="
echo "Keycloak labs-portal URI registration"
echo "=========================================="
echo "Environment: ${ENV}"
echo "App:         ${APP_NAME}"
echo "=========================================="

# Helper: curl with explicit HTTP status check. Writes body to stdout on
# success, error info to stderr and returns non-zero on failure. Prevents
# silent failures where curl prints a traceback-friendly empty body to a
# downstream parser.
# Args: METHOD URL [extra curl args...]
#
# Windows (Git Bash): curl uses Schannel, which does not trust Mapp's internal
# root CA (it signs the production Keycloak admin host) and cannot check that
# CA's revocation status, so every call failed with HTTP 000. Give curl the
# public bundle plus the vendored internal root, and make the revocation check
# best-effort. macOS/Linux are unchanged (CURL_TLS_ARGS stays empty).
CURL_TLS_ARGS=()
if [[ "$(uname -s)" == MINGW* || "$(uname -s)" == MSYS* ]]; then
    for public_bundle in /mingw64/etc/ssl/certs/ca-bundle.crt /usr/ssl/certs/ca-bundle.crt; do
        if [ -f "${public_bundle}" ]; then
            KC_CA_BUNDLE=$(mktemp -t kc-ca.XXXXXX)
            add_exit_trap 'rm -f "${KC_CA_BUNDLE}"'
            cat "${public_bundle}" "${PROJECT_ROOT}/certs/ca.internal.mapp.tools.crt" > "${KC_CA_BUNDLE}"
            CURL_TLS_ARGS=(--cacert "${KC_CA_BUNDLE}" --ssl-revoke-best-effort)
            break
        fi
    done
fi

http_call() {
    local method=$1; shift
    local url=$1; shift
    local body_file
    body_file=$(mktemp -t kc-uri-reg.XXXXXX)
    local status
    # ${arr[@]+"${arr[@]}"}: an empty array is "unbound" to bash 3.2 (macOS
    # /bin/bash) under `set -u`; this form expands to nothing instead.
    status=$(curl -sS ${CURL_TLS_ARGS[@]+"${CURL_TLS_ARGS[@]}"} -o "${body_file}" -w '%{http_code}' \
        -X "${method}" "${url}" "$@" 2>&1) || status="000"
    if [[ ! "${status}" =~ ^2[0-9][0-9]$ ]]; then
        echo "ERROR: ${method} ${url}" >&2
        echo "       HTTP status: ${status}" >&2
        echo "       Response body (first 1KB):" >&2
        head -c 1024 "${body_file}" | sed 's/^/         /' >&2 || true
        rm -f "${body_file}"
        return 1
    fi
    cat "${body_file}"
    rm -f "${body_file}"
}

# 1. Determine app hostname (from ECS task def env, unless overridden)
if [ -z "${APP_HOST:-}" ]; then
    CLUSTER="${APP_NAME}-${SHORT_ENV}"
    SERVICE="${APP_NAME}-${SHORT_ENV}"
    echo "Discovering NEXTAUTH_URL from ECS service ${SERVICE}..."
    TASK_DEF=$(aws ecs describe-services \
        --cluster "${CLUSTER}" --services "${SERVICE}" \
        --region "${AWS_REGION}" --profile "${AWS_PROFILE}" \
        --query 'services[0].taskDefinition' --output text)
    NEXTAUTH_URL=$(aws ecs describe-task-definition \
        --task-definition "${TASK_DEF}" \
        --region "${AWS_REGION}" --profile "${AWS_PROFILE}" \
        --query 'taskDefinition.containerDefinitions[?name==`App`] | [0].environment[?name==`NEXTAUTH_URL`] | [0].value' \
        --output text)
    if [ -z "${NEXTAUTH_URL}" ] || [ "${NEXTAUTH_URL}" = "None" ]; then
        echo "ERROR: NEXTAUTH_URL is not set on the running task definition." >&2
        echo "       Cannot determine the app hostname. Either the CDK stack did" >&2
        echo "       not deploy this env var, or the service is misnamed." >&2
        echo "       You can override by setting APP_HOST manually." >&2
        exit 1
    fi
    # Parse hostname using bash parameter expansion (no python:expat dep)
    APP_HOST="${NEXTAUTH_URL#*://}"
    APP_HOST="${APP_HOST%%/*}"
    if [ -z "${APP_HOST}" ] || [ "${APP_HOST}" = "${NEXTAUTH_URL}" ]; then
        echo "ERROR: could not parse hostname from NEXTAUTH_URL='${NEXTAUTH_URL}'" >&2
        exit 1
    fi
    echo "  NEXTAUTH_URL: ${NEXTAUTH_URL}"
fi
echo "  Hostname:     ${APP_HOST}"

# 2. Read KC registrar creds from SSM
echo "Reading KC registrar credentials from SSM (${SSM_PREFIX}/*)..."
REGISTRAR_CLIENT_ID=$(aws ssm get-parameter \
    --name "${SSM_PREFIX}/client-id" --with-decryption \
    --region "${AWS_REGION}" --profile "${AWS_PROFILE}" \
    --query Parameter.Value --output text)
REGISTRAR_CLIENT_SECRET=$(aws ssm get-parameter \
    --name "${SSM_PREFIX}/client-secret" --with-decryption \
    --region "${AWS_REGION}" --profile "${AWS_PROFILE}" \
    --query Parameter.Value --output text)
KC_BASE="${KC_REGISTRAR_BASE:-$(aws ssm get-parameter \
    --name "${SSM_PREFIX}/base-url" --with-decryption \
    --region "${AWS_REGION}" --profile "${AWS_PROFILE}" \
    --query Parameter.Value --output text)}"

# 3. Token via client_credentials
echo "Requesting service-account token from ${KC_BASE}/realms/${REGISTRAR_REALM}..."
TOKEN_RESPONSE=$(http_call POST \
    "${KC_BASE}/realms/${REGISTRAR_REALM}/protocol/openid-connect/token" \
    -d "grant_type=client_credentials" \
    -d "client_id=${REGISTRAR_CLIENT_ID}" \
    -d "client_secret=${REGISTRAR_CLIENT_SECRET}")
TOKEN=$(echo "${TOKEN_RESPONSE}" | jq -r '.access_token // empty')
if [ -z "${TOKEN}" ]; then
    echo "ERROR: token endpoint returned a response without access_token" >&2
    echo "       Response: ${TOKEN_RESPONSE}" >&2
    exit 1
fi

# 4. Idempotent register-with-retry (handles concurrent deploys / transient blips)
register_once() {
    local clients_json client client_uuid r p w
    local has_r has_w has_p
    local -a changed=()

    clients_json=$(http_call GET \
        "${KC_BASE}/admin/realms/${LABS_REALM}/clients?clientId=${LABS_CLIENT_ID}" \
        -H "Authorization: Bearer ${TOKEN}") || return 1

    if [ "$(echo "${clients_json}" | jq 'length')" -eq 0 ]; then
        echo "ERROR: client '${LABS_CLIENT_ID}' not found in realm '${LABS_REALM}'" >&2
        echo "       Verify the labs-portal client exists in prod KC, and that the" >&2
        echo "       kc-registrar service account has view-clients role." >&2
        return 1
    fi

    client=$(echo "${clients_json}" | jq '.[0]')
    client_uuid=$(echo "${client}" | jq -r '.id // empty')
    if [ -z "${client_uuid}" ]; then
        echo "ERROR: labs-portal client returned without an id" >&2
        return 1
    fi

    r="https://${APP_HOST}/api/auth/callback/keycloak"
    p="https://${APP_HOST}/auth/signout*"
    w="https://${APP_HOST}"

    has_r=$(echo "${client}" | jq --arg r "$r" '.redirectUris // [] | any(. == $r)')
    has_w=$(echo "${client}" | jq --arg w "$w" '.webOrigins // [] | any(. == $w)')
    has_p=$(echo "${client}" | jq --arg p "$p" \
        '(.attributes["post.logout.redirect.uris"] // "") | split("##") | any(. == $p)')

    [ "${has_r}" = "false" ] && changed+=("redirect:${r}")
    [ "${has_w}" = "false" ] && changed+=("web-origin:${w}")
    [ "${has_p}" = "false" ] && changed+=("post-logout:${p}")

    if [ ${#changed[@]} -eq 0 ]; then
        echo "  (no changes — all entries already present for ${APP_HOST})"
        return 0
    fi

    local entry
    for entry in "${changed[@]}"; do
        echo "  + ${entry%%:*}: ${entry#*:}"
    done

    local updated
    updated=$(echo "${client}" | jq \
        --arg r "$r" --arg p "$p" --arg w "$w" \
        --argjson has_r "$has_r" --argjson has_w "$has_w" --argjson has_p "$has_p" '
        .redirectUris = ((.redirectUris // []) + (if $has_r then [] else [$r] end)) |
        .webOrigins = ((.webOrigins // []) + (if $has_w then [] else [$w] end)) |
        .attributes = (.attributes // {}) |
        .attributes["post.logout.redirect.uris"] = (
            ((.attributes["post.logout.redirect.uris"] // "") | split("##") | map(select(. != ""))) +
            (if $has_p then [] else [$p] end)
            | join("##")
        )
    ')

    echo "PUTting updated labs-portal representation..."
    http_call PUT \
        "${KC_BASE}/admin/realms/${LABS_REALM}/clients/${client_uuid}" \
        -H "Authorization: Bearer ${TOKEN}" \
        -H "Content-Type: application/json" \
        --data "${updated}" >/dev/null
}

for attempt in 1 2 3; do
    if register_once; then
        echo "=========================================="
        echo "Registered URIs for ${APP_HOST}"
        echo "=========================================="
        exit 0
    fi
    echo "Attempt ${attempt} failed; retrying in $((attempt * 2))s..." >&2
    sleep $((attempt * 2))
done
echo "ERROR: failed to register URIs after 3 attempts" >&2
exit 1
