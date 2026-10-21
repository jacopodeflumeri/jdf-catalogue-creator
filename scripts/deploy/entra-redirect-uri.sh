#!/bin/bash
set -e

# =============================================================================
# Entra (Azure AD) Redirect URI Management
# Adds, removes, or lists redirect URIs on the shared Mapp Labs Entra app
# registration via Microsoft Graph API.
#
# Usage:
#   ./entra-redirect-uri.sh add <staging|production>
#   ./entra-redirect-uri.sh remove <staging|production>
#   ./entra-redirect-uri.sh list
#
# LEGACY PATH. This is only needed when the app logs in to Entra DIRECTLY
# (KEYCLOAK_ENABLED=false). With Keycloak on — the default — Keycloak brokers to
# Entra using its own redirect URI and the app's `/api/auth/callback/azure-ad`
# is never used, so registering it just adds a dead entry to a shared list.
#
# `make {env}-infra-deploy` therefore calls `add` with ENTRA_SKIP_IF_KEYCLOAK=true,
# which skips the registration when this app's KEYCLOAK_ENABLED SSM parameter is
# "true". Running the script by hand (`make {env}-entra-add|remove`) is never
# skipped — `remove` in particular must stay available to clean up an entry a
# Keycloak app registered before this guard existed.
#
# All Labs apps share ONE Entra app registration. Its redirect URI list holds
# entries for every deployed Labs app. The Graph API replaces the entire list
# on each PATCH, so this script follows a read-modify-write pattern.
# =============================================================================

ACTION="${1}"
ENV="${2}"

if [ -z "$ACTION" ]; then
    echo "Usage: $0 <add|remove|list> [staging|production]"
    exit 1
fi

if [ "$ACTION" != "add" ] && [ "$ACTION" != "remove" ] && [ "$ACTION" != "list" ]; then
    echo "Error: Action must be 'add', 'remove', or 'list' (got: ${ACTION})"
    exit 1
fi

if [ "$ACTION" != "list" ]; then
    if [ "$ENV" != "staging" ] && [ "$ENV" != "production" ]; then
        echo "Error: Environment must be 'staging' or 'production' (got: ${ENV})"
        exit 1
    fi
fi

# Load shared config (APP_NAME, PROJECT_ROOT)
source "$(dirname "$0")/_config.sh"

AWS_PROFILE="${AWS_PROFILE:-labs-power}"
AWS_REGION="${AWS_REGION:-eu-central-1}"

# Skip registration for Keycloak apps when asked to (see header). If the
# parameter is missing or unreadable we fall through and behave as before.
if [ "$ACTION" = "add" ] && [ "${ENTRA_SKIP_IF_KEYCLOAK:-false}" = "true" ]; then
    KC_ENABLED=$(aws ssm get-parameter \
        --name "/${APP_NAME}-${SHORT_ENV}/KEYCLOAK_ENABLED" \
        --with-decryption \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" \
        --query 'Parameter.Value' \
        --output text 2>/dev/null || true)
    if [ "$KC_ENABLED" = "true" ]; then
        echo "Keycloak is enabled for ${APP_NAME} (${ENV}) — skipping Entra redirect URI registration."
        echo "(Only direct-Entra login needs it. To register anyway: make ${ENV/production/prod}-entra-add)"
        exit 0
    fi
fi

# Shared SSM path — Graph API management credentials used by every Labs app
SHARED_SSM_PATH="/mapp-labs-shared"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

fetch_ssm() {
    local name="$1"
    local value
    if ! value=$(aws ssm get-parameter \
        --name "$name" \
        --with-decryption \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" \
        --query 'Parameter.Value' \
        --output text 2>&1); then
        echo -e "${RED}Failed to read SSM parameter: ${name}${NC}" >&2
        echo "$value" >&2
        echo "" >&2
        echo "Run 'make shared-ssm-setup' to configure shared Entra management credentials." >&2
        exit 1
    fi
    printf '%s' "$value"
}

TENANT_ID=$(fetch_ssm "${SHARED_SSM_PATH}/ENTRA_MGMT_TENANT_ID")
CLIENT_ID=$(fetch_ssm "${SHARED_SSM_PATH}/ENTRA_MGMT_CLIENT_ID")
CLIENT_SECRET=$(fetch_ssm "${SHARED_SSM_PATH}/ENTRA_MGMT_CLIENT_SECRET")
OBJECT_ID=$(fetch_ssm "${SHARED_SSM_PATH}/ENTRA_MGMT_OBJECT_ID")

# Build the redirect URI for this app + env (only if an env was provided)
if [ -n "$ENV" ]; then
    if [ "$ENV" = "production" ]; then
        DOMAIN="${APP_NAME}.labs.mapp.com"
    else
        DOMAIN="stg-${APP_NAME}.labs.mapp.com"
    fi
    REDIRECT_URI="https://${DOMAIN}/api/auth/callback/azure-ad"
fi

echo "=========================================="
echo "  Entra Redirect URI Management"
echo "=========================================="
echo "  Action:       ${ACTION}"
if [ -n "$ENV" ]; then
    echo "  Environment:  ${ENV}"
    echo "  App:          ${APP_NAME}"
    echo "  Redirect URI: ${REDIRECT_URI}"
fi
echo "  Object ID:    ${OBJECT_ID}"
echo "=========================================="
echo ""

# --- Acquire access token ---
TOKEN_RESPONSE=$(curl -sS -X POST \
    "https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token" \
    --data-urlencode "client_id=${CLIENT_ID}" \
    --data-urlencode "client_secret=${CLIENT_SECRET}" \
    --data-urlencode "scope=https://graph.microsoft.com/.default" \
    --data-urlencode "grant_type=client_credentials")

TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.access_token // empty')
if [ -z "$TOKEN" ]; then
    echo -e "${RED}Failed to acquire Graph API access token.${NC}"
    echo "Response: $TOKEN_RESPONSE"
    exit 1
fi

# --- Fetch existing redirect URIs ---
EXISTING_RESPONSE=$(curl -sS -H "Authorization: Bearer $TOKEN" \
    "https://graph.microsoft.com/v1.0/applications/${OBJECT_ID}?\$select=web")

EXISTING=$(echo "$EXISTING_RESPONSE" | jq -c '.web.redirectUris // empty')
if [ -z "$EXISTING" ]; then
    echo -e "${RED}Failed to read existing redirect URIs.${NC}"
    echo "Response: $EXISTING_RESPONSE"
    exit 1
fi

if [ "$ACTION" = "list" ]; then
    echo "Registered redirect URIs:"
    echo "$EXISTING" | jq -r '.[]' | sort
    exit 0
fi

ALREADY_PRESENT=$(echo "$EXISTING" | jq --arg u "$REDIRECT_URI" 'any(.[]; . == $u)')

if [ "$ACTION" = "add" ] && [ "$ALREADY_PRESENT" = "true" ]; then
    echo -e "${YELLOW}Redirect URI already registered. Nothing to do.${NC}"
    exit 0
fi

if [ "$ACTION" = "remove" ] && [ "$ALREADY_PRESENT" = "false" ]; then
    echo -e "${YELLOW}Redirect URI not present. Nothing to remove.${NC}"
    exit 0
fi

case "$ACTION" in
    add)
        UPDATED=$(echo "$EXISTING" | jq -c --arg u "$REDIRECT_URI" '. + [$u]')
        ;;
    remove)
        UPDATED=$(echo "$EXISTING" | jq -c --arg u "$REDIRECT_URI" '[.[] | select(. != $u)]')
        ;;
esac

# --- PATCH the application with the updated list ---
PAYLOAD=$(jq -n --argjson uris "$UPDATED" '{web: {redirectUris: $uris}}')

HTTP_CODE=$(curl -sS -o /tmp/entra-patch-response.json -w "%{http_code}" \
    -X PATCH \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    "https://graph.microsoft.com/v1.0/applications/${OBJECT_ID}" \
    -d "$PAYLOAD")

if [ "$HTTP_CODE" = "204" ] || [ "$HTTP_CODE" = "200" ]; then
    if [ "$ACTION" = "add" ]; then
        echo -e "${GREEN}Redirect URI added successfully.${NC}"
    else
        echo -e "${GREEN}Redirect URI removed successfully.${NC}"
    fi
    rm -f /tmp/entra-patch-response.json
else
    echo -e "${RED}Graph API PATCH failed. HTTP ${HTTP_CODE}${NC}"
    cat /tmp/entra-patch-response.json 2>/dev/null || true
    rm -f /tmp/entra-patch-response.json
    exit 1
fi
