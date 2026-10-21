#!/bin/bash
set -e

# =============================================================================
# Icinga Monitoring Service Management
# Registers or removes HTTP health check services in Icinga Director
# Usage: ./icinga-monitoring.sh <add|remove> <staging|production>
# =============================================================================

ACTION="${1}"
ENV="${2}"

# Validate arguments
if [ -z "$ACTION" ] || [ -z "$ENV" ]; then
    echo "Usage: $0 <add|remove> <staging|production>"
    echo ""
    echo "Actions:"
    echo "  add    - Register HTTP health check in Icinga Director"
    echo "  remove - Remove HTTP health check from Icinga Director"
    exit 1
fi

if [ "$ACTION" != "add" ] && [ "$ACTION" != "remove" ]; then
    echo "Error: Action must be 'add' or 'remove' (got: ${ACTION})"
    exit 1
fi

if [ "$ENV" != "staging" ] && [ "$ENV" != "production" ]; then
    echo "Error: Environment must be 'staging' or 'production' (got: ${ENV})"
    exit 1
fi

# Load shared config (APP_NAME, PROJECT_ROOT)
source "$(dirname "$0")/_config.sh"

# Read managedBy from app.config.json
MANAGED_BY=$(node -p "require(process.argv[1]).managedBy || 'unknown'" "$(to_node_path "${PROJECT_ROOT}/app.config.json")")

# Icinga Director API credentials (limited-capability API account for service registration)
ICINGA_API_USER="ApiMappAwsLab"
ICINGA_API_PASS="PW"
ICINGA_API_AUTH="${ICINGA_API_USER}:${ICINGA_API_PASS}"
ICINGA_BASE_URL="https://mon11.muc.domeus.com/icingaweb2/director"

# Determine domain name based on environment
if [ "$ENV" = "production" ]; then
    R53_URL="${APP_NAME}.labs.mapp.com"
else
    R53_URL="stg-${APP_NAME}.labs.mapp.com"
fi

# Build the Icinga object name
OBJECT_NAME="http_${R53_URL}"

# Service configuration
NOTES="HTTP health check for ${APP_NAME} on ${R53_URL} in Mapp Labs managed by ${MANAGED_BY}"
HTTP_SSL="true"
HTTP_ADDRESS="${R53_URL}"
HTTP_PORT="443"
HTTP_URI="https://${R53_URL}:443/api/health"
HTTP_VHOST="${R53_URL}"
HTTP_EXPECT="200"
NOTIFICATION="slack-service-mapp-aws-labs"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "=========================================="
echo "  Icinga Monitoring Service Management"
echo "=========================================="
echo "  Action:      ${ACTION}"
echo "  Environment: ${ENV}"
echo "  App:         ${APP_NAME}"
echo "  Domain:      ${R53_URL}"
echo "  Object Name: ${OBJECT_NAME}"
echo "=========================================="
echo ""

# Check if service already exists in Icinga Director
check_service_exists() {
    local http_code
    http_code=$(curl -s -o /dev/null -w "%{http_code}" \
        -u "${ICINGA_API_AUTH}" \
        "${ICINGA_BASE_URL}/service?name=${OBJECT_NAME}" \
        -H 'Accept: application/json')
    [ "$http_code" = "200" ]
}

# Build POST data for creating the service
post_data() {
cat <<EOF
{
  "assign_filter": "host.name=%22monsat11.muc.domeus.com%22",
  "check_command": "check_http",
  "imports": ["IST VM"],
  "object_name": "${OBJECT_NAME}",
  "object_type": "apply",
  "notes": "${NOTES}",
  "vars": {
    "http_ssl": "${HTTP_SSL}",
    "http_address": "${HTTP_ADDRESS}",
    "http_port": "${HTTP_PORT}",
    "http_uri": "${HTTP_URI}",
    "http_vhost": "${HTTP_VHOST}",
    "http_expect": "${HTTP_EXPECT}",
    "notification": ["${NOTIFICATION}"]
  }
}
EOF
}

if [ "$ACTION" = "add" ]; then
    # --- ADD SERVICE ---
    if check_service_exists; then
        echo -e "${YELLOW}Service '${OBJECT_NAME}' already exists in Icinga. Skipping creation.${NC}"
        echo ""
        echo "View service: https://mon11.muc.domeus.com/icingaweb2/monitoring/service/show?host=monsat11.muc.domeus.com&service=${OBJECT_NAME}"
        exit 0
    fi

    echo "Creating Icinga service '${OBJECT_NAME}'..."
    echo ""

    RESPONSE=$(curl -s -w "\n%{http_code}" \
        -u "${ICINGA_API_AUTH}" \
        -X POST \
        -H 'Accept: application/json' \
        -H 'Content-Type: application/json' \
        -d "$(post_data)" \
        "${ICINGA_BASE_URL}/service")

    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    if [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}Service created successfully!${NC}"
        echo ""
        echo "IMPORTANT: The service must be verified and activated by an Icinga2 Admin."
        echo "           It will not start monitoring until an admin deploys the configuration."
        echo ""
        echo "View service: https://mon11.muc.domeus.com/icingaweb2/monitoring/service/show?host=monsat11.muc.domeus.com&service=${OBJECT_NAME}"
        echo "Login:        guest / guest (read-only)"
    else
        echo -e "${RED}Failed to create service. HTTP ${HTTP_CODE}${NC}"
        echo "Response: ${BODY}"
        exit 1
    fi

elif [ "$ACTION" = "remove" ]; then
    # --- REMOVE SERVICE ---
    if ! check_service_exists; then
        echo -e "${YELLOW}Service '${OBJECT_NAME}' does not exist in Icinga. Nothing to remove.${NC}"
        exit 0
    fi

    echo "Removing Icinga service '${OBJECT_NAME}'..."
    echo ""

    RESPONSE=$(curl -s -w "\n%{http_code}" \
        -u "${ICINGA_API_AUTH}" \
        -X DELETE \
        -H 'Accept: application/json' \
        "${ICINGA_BASE_URL}/service?name=${OBJECT_NAME}")

    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "204" ]; then
        echo -e "${GREEN}Service removed successfully!${NC}"
    else
        echo -e "${RED}Failed to remove service. HTTP ${HTTP_CODE}${NC}"
        echo "Response: ${BODY}"
        exit 1
    fi
fi

echo ""
echo "=========================================="
echo "  Icinga monitoring ${ACTION} complete!"
echo "=========================================="
