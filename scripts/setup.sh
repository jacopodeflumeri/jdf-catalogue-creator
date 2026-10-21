#!/bin/bash
set -e

# =============================================================================
# Project Setup Script
# Configures the template for your project by replacing placeholder values
# Usage: ./scripts/setup.sh
# =============================================================================

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG_FILE="${PROJECT_ROOT}/app.config.json"

# Git Bash on Windows: `pwd` yields /c/Users/..., which a Windows node cannot
# open. cygpath -m converts it to C:/Users/... (forward slashes). Without
# cygpath (macOS/Linux) the path is returned unchanged. Always hand the result
# to node as an argument (process.argv[1]); never interpolate a path into JS.
to_node_path() {
    if command -v cygpath &>/dev/null; then cygpath -m "$1"; else echo "$1"; fi
}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "=========================================="
echo "  Project Setup"
echo "=========================================="
echo ""

# -----------------------------------------------------------------------------
# Check prerequisites
# -----------------------------------------------------------------------------
echo "Checking prerequisites..."
echo ""

MISSING_REQUIRED=()
MISSING_OPTIONAL=()

# --- Required for local development ---

# Node.js (>= 22, matches .nvmrc and the Dockerfile)
if command -v node &>/dev/null; then
    NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_VERSION" -lt 22 ]; then
        MISSING_REQUIRED+=("node (v22+, found v$(node -v | sed 's/v//'))")
    else
        echo -e "  ${GREEN}✓${NC} node $(node -v)"
    fi
else
    MISSING_REQUIRED+=("node (v22+ — https://nodejs.org/)")
fi

# npm
if command -v npm &>/dev/null; then
    echo -e "  ${GREEN}✓${NC} npm $(npm -v)"
else
    MISSING_REQUIRED+=("npm (included with node)")
fi

# git
if command -v git &>/dev/null; then
    echo -e "  ${GREEN}✓${NC} git $(git --version | awk '{print $3}')"
else
    MISSING_REQUIRED+=("git (https://git-scm.com/)")
fi

# PostgreSQL client (psql / createdb) — needed for local database
if command -v psql &>/dev/null; then
    echo -e "  ${GREEN}✓${NC} psql (PostgreSQL client)"
else
    MISSING_REQUIRED+=("psql (PostgreSQL client — brew install postgresql or apt install postgresql-client)")
fi

if command -v createdb &>/dev/null; then
    echo -e "  ${GREEN}✓${NC} createdb"
else
    MISSING_REQUIRED+=("createdb (usually included with PostgreSQL client)")
fi

# --- Required for deployment ---

# Docker
if command -v docker &>/dev/null; then
    echo -e "  ${GREEN}✓${NC} docker $(docker --version | awk '{print $3}' | sed 's/,//')"
else
    MISSING_OPTIONAL+=("docker (https://docs.docker.com/get-docker/) — required for deployment")
fi

# AWS CLI v2
if command -v aws &>/dev/null; then
    AWS_VERSION=$(aws --version 2>&1 | awk '{print $1}' | cut -d/ -f2)
    AWS_MAJOR=$(echo "$AWS_VERSION" | cut -d. -f1)
    if [ "$AWS_MAJOR" -lt 2 ]; then
        MISSING_OPTIONAL+=("aws CLI v2 (found v${AWS_VERSION} — https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)")
    else
        echo -e "  ${GREEN}✓${NC} aws CLI v${AWS_VERSION}"
    fi
else
    MISSING_OPTIONAL+=("aws CLI v2 (https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) — required for deployment")
fi

# Session Manager plugin (needed for ECS Exec)
if command -v session-manager-plugin &>/dev/null; then
    echo -e "  ${GREEN}✓${NC} session-manager-plugin"
else
    MISSING_OPTIONAL+=("session-manager-plugin (https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html) — required for ECS Exec (migrations, seeding)")
fi

# jq (needed by the Keycloak redirect-URI registration step of every deploy)
if command -v jq &>/dev/null; then
    echo -e "  ${GREEN}✓${NC} jq"
else
    MISSING_OPTIONAL+=("jq (brew install jq / apt-get install jq / winget install jqlang.jq) — required for deployment (Keycloak URI registration)")
fi

# openssl (needed for generating NextAuth secrets during SSM setup)
if command -v openssl &>/dev/null; then
    echo -e "  ${GREEN}✓${NC} openssl"
else
    MISSING_OPTIONAL+=("openssl — required for generating secrets during SSM parameter setup")
fi

echo ""

# Report missing required tools
if [ ${#MISSING_REQUIRED[@]} -gt 0 ]; then
    echo -e "${RED}Missing required tools:${NC}"
    for tool in "${MISSING_REQUIRED[@]}"; do
        echo -e "  ${RED}✗${NC} ${tool}"
    done
    echo ""
    echo "Install the required tools above and re-run this script."
    exit 1
fi

# Report missing optional tools (warn but don't block)
if [ ${#MISSING_OPTIONAL[@]} -gt 0 ]; then
    echo -e "${YELLOW}Missing optional tools (needed for deployment):${NC}"
    for tool in "${MISSING_OPTIONAL[@]}"; do
        echo -e "  ${YELLOW}!${NC} ${tool}"
    done
    echo ""
    echo -e "${YELLOW}You can continue with local development, but install these before deploying.${NC}"
    echo ""
fi

echo -e "${GREEN}Prerequisite check passed.${NC}"
echo ""

# -----------------------------------------------------------------------------
# Check if already configured
# -----------------------------------------------------------------------------
if [ -f "$CONFIG_FILE" ]; then
    CURRENT_APP_NAME=$(node -p "require(process.argv[1]).appName" "$(to_node_path "$CONFIG_FILE")")
    if [ "$CURRENT_APP_NAME" != "myapp" ]; then
        echo -e "${YELLOW}This project has already been configured as '${CURRENT_APP_NAME}'.${NC}"
        echo -n "Re-run setup? This will overwrite existing configuration. [y/N]: "
        read -r CONFIRM
        if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
            echo "Setup cancelled."
            exit 0
        fi
        echo ""
    fi
fi

# -----------------------------------------------------------------------------
# Prompt: App short name
# -----------------------------------------------------------------------------
echo "App short name (used for AWS resources: ECS, ALB, ECR, S3, DNS, etc.)"
echo "  - Lowercase letters, numbers, and hyphens only"
echo "  - Must start with a letter, max 20 characters"
echo "  - Examples: ftl, customer-portal, shop-the-look"
echo ""
while true; do
    echo -n "App name: "
    read -r APP_NAME
    if [ -z "$APP_NAME" ]; then
        echo -e "${RED}App name is required.${NC}"
        continue
    fi
    if ! echo "$APP_NAME" | grep -qE '^[a-z][a-z0-9-]{0,19}$'; then
        echo -e "${RED}Invalid format. Must match: lowercase letter, then up to 19 lowercase letters/numbers/hyphens.${NC}"
        continue
    fi
    if echo "$APP_NAME" | grep -qE -- '-$'; then
        echo -e "${RED}App name cannot end with a hyphen.${NC}"
        continue
    fi
    break
done
echo ""

# -----------------------------------------------------------------------------
# Prompt: Display name
# -----------------------------------------------------------------------------
echo "Display name (shown in browser title bar and navigation)"
echo "  - Examples: Mapp Labs FTL, Mapp Labs Customer Portal"
echo ""
echo -n "Display name [Mapp Labs]: "
read -r DISPLAY_NAME
DISPLAY_NAME="${DISPLAY_NAME:-Mapp Labs}"
echo ""

# -----------------------------------------------------------------------------
# Prompt: Database name
# -----------------------------------------------------------------------------
echo "PostgreSQL database name"
echo ""
echo -n "Database name [${APP_NAME}]: "
read -r DB_NAME
DB_NAME="${DB_NAME:-$APP_NAME}"
echo ""

# -----------------------------------------------------------------------------
# Prompt: Database port
# -----------------------------------------------------------------------------
echo "PostgreSQL port (default 5432, use a different port if running via Docker etc.)"
echo ""
echo -n "Database port [5432]: "
read -r DB_PORT
DB_PORT="${DB_PORT:-5432}"
echo ""

# -----------------------------------------------------------------------------
# Prompt: Team name
# -----------------------------------------------------------------------------
echo "Team name (used for the AWS Team tag)"
echo "  Free text — whatever your team is called. There's no approved list."
echo "  - Examples: labs, product, data-science, Customer Success"
echo ""
echo -n "Team name: "
read -r TEAM_NAME
if [ -z "$TEAM_NAME" ]; then
    echo -e "${YELLOW}No team name provided. AWS tags will show empty team.${NC}"
fi
echo ""

# -----------------------------------------------------------------------------
# Prompt: Mapp product (cost-allocation dimension)
# -----------------------------------------------------------------------------
echo "Which Mapp product LINE does this app belong to?"
echo "  Sets the AWS 'Product' cost-allocation tag (a rollup) and the LiteLLM"
echo "  APP_PRODUCT env var. This is the business line, NOT your app name —"
echo "  your app is already its own billing line via the 'Project' tag."
echo "  1) fashion   2) engage   3) intelligence   4) internal   5) Other"
echo ""
echo -n "Select product [4]: "
read -r PRODUCT_INPUT
case "${PRODUCT_INPUT:-4}" in
    1) APP_PRODUCT="fashion" ;;
    2) APP_PRODUCT="engage" ;;
    3) APP_PRODUCT="intelligence" ;;
    4) APP_PRODUCT="internal" ;;
    5)
        echo -n "Enter custom product name: "
        read -r APP_PRODUCT
        APP_PRODUCT="${APP_PRODUCT:-internal}"
        ;;
    *) APP_PRODUCT="internal" ;;
esac
echo -e "  ${GREEN}Product: ${APP_PRODUCT}${NC}"
echo ""

# -----------------------------------------------------------------------------
# Auto-populate: App owner / Created by / Managed by
# -----------------------------------------------------------------------------
CURRENT_USER=$(whoami)

# Default to the git email's local part, which is usually already
# firstname.lastname — the exact shape the cost report groups on.
GIT_EMAIL=$(git config user.email 2>/dev/null || echo "")
DEFAULT_OWNER="${GIT_EMAIL%%@*}"
DEFAULT_OWNER="${DEFAULT_OWNER:-$CURRENT_USER}"

echo "App owner (used for the AWS AppOwner tag — the per-person cost report key)"
echo "  Must be a PERSON, as firstname.lastname (lowercase, no @mapp.com)."
echo "  This is who the app's AWS spend is billed to, and it can change hands later."
echo -n "App owner [${DEFAULT_OWNER}]: "
read -r APP_OWNER
APP_OWNER="${APP_OWNER:-$DEFAULT_OWNER}"
# Normalize the common mistakes rather than nagging: strip a pasted email domain,
# lowercase, and turn spaces/underscores into dots.
# NB: `[ _][ _]*` not `[ _]\+` — BSD sed on macOS treats \+ as a literal plus.
APP_OWNER=$(echo "$APP_OWNER" | tr '[:upper:]' '[:lower:]' | sed -e 's/@.*$//' -e 's/[ _][ _]*/./g')
if ! echo "$APP_OWNER" | grep -qE '^[a-z]+\.[a-z]+$'; then
    echo -e "${YELLOW}  Note: \"${APP_OWNER}\" isn't firstname.lastname. It'll still work, but"
    echo -e "  it may need a manual alias entry to be attributed correctly.${NC}"
fi
echo -e "  ${GREEN}App owner: ${APP_OWNER}${NC}"
echo ""

echo "Created by (used for AWS CreatedBy tag — historical, never changes)"
echo -n "Created by [${APP_OWNER}]: "
read -r CREATED_BY
CREATED_BY="${CREATED_BY:-$APP_OWNER}"
echo ""

echo "Managed by (used for AWS ManagedBy tag)"
echo -n "Managed by [${CURRENT_USER}]: "
read -r MANAGED_BY
MANAGED_BY="${MANAGED_BY:-$CURRENT_USER}"
echo ""

# -----------------------------------------------------------------------------
# Prompt: Super Admin email(s)
# -----------------------------------------------------------------------------
CURRENT_EMAIL=$(git config user.email 2>/dev/null || echo "")
echo "Super Admin email(s) — comma-separated list of users with full admin access"
echo "  These users bypass all access level checks in the admin panel."
echo ""
echo -n "Super Admin email(s) [${CURRENT_EMAIL}]: "
read -r SUPER_ADMINS
SUPER_ADMINS="${SUPER_ADMINS:-$CURRENT_EMAIL}"
if [ -z "$SUPER_ADMINS" ]; then
    echo -e "${YELLOW}No super admin email provided. You can set SUPER_ADMINS in .env later.${NC}"
    SUPER_ADMINS="admin@example.com"
fi
echo ""

# -----------------------------------------------------------------------------
# Auto-generate NEXTAUTH_SECRET
# -----------------------------------------------------------------------------
if command -v openssl &>/dev/null; then
    NEXTAUTH_SECRET=$(openssl rand -base64 32)
else
    NEXTAUTH_SECRET=$(head -c 32 /dev/urandom | base64)
fi

# -----------------------------------------------------------------------------
# Confirm
# -----------------------------------------------------------------------------
echo "=========================================="
echo "  Configuration Summary"
echo "=========================================="
echo ""
echo -e "  App name:      ${GREEN}${APP_NAME}${NC}"
echo -e "  Display name:  ${GREEN}${DISPLAY_NAME}${NC}"
echo -e "  Database:      ${GREEN}${DB_NAME}${NC}"
echo -e "  DB port:       ${GREEN}${DB_PORT}${NC}"
echo -e "  Team:          ${GREEN}${TEAM_NAME:-<not set>}${NC}"
echo -e "  App owner:     ${GREEN}${APP_OWNER}${NC}"
echo -e "  Created by:    ${GREEN}${CREATED_BY}${NC}"
echo -e "  Managed by:    ${GREEN}${MANAGED_BY}${NC}"
echo -e "  Super admin:   ${GREEN}${SUPER_ADMINS}${NC}"
echo ""
echo "  AWS resources will be named:"
echo -e "    ECR:       ${BLUE}${APP_NAME}${NC}"
echo -e "    Staging:   ${BLUE}${APP_NAME}-staging${NC}"
echo -e "    Prod:      ${BLUE}${APP_NAME}-production${NC}"
echo -e "    DNS:       ${BLUE}stg-${APP_NAME}.labs.mapp.com${NC} / ${BLUE}${APP_NAME}.labs.mapp.com${NC}"
echo -e "    S3:        ${BLUE}mapp-labs-${APP_NAME}-staging${NC} / ${BLUE}mapp-labs-${APP_NAME}-prod${NC}"
echo -e "    Icinga:    ${BLUE}http_stg-${APP_NAME}.labs.mapp.com${NC} / ${BLUE}http_${APP_NAME}.labs.mapp.com${NC}"
echo ""
echo -n "Proceed with setup? [Y/n]: "
read -r PROCEED
if [ "$PROCEED" = "n" ] || [ "$PROCEED" = "N" ]; then
    echo "Setup cancelled."
    exit 0
fi
echo ""

# -----------------------------------------------------------------------------
# Capabilities selection
# -----------------------------------------------------------------------------
echo "=========================================="
echo "  Capabilities"
echo "=========================================="
echo ""
echo "Optional integrations with Mapp services."
echo "You can enable these now or later. See docs/template/capabilities/ for details."
echo ""
echo "  1) Client Catalog  — Discover companies & workspaces from Mapp"
echo "  2) UPC             — Access product feeds (requires Client Catalog)"
echo "  3) FTL             — Fashion Trends Lab taxonomy & trends API"
echo "  4) Public API      — Expose your app's data via REST API with Swagger"
echo "  5) LLM             — LLM calls via LiteLLM proxy (OpenAI, Anthropic)"
echo "  6) Data Sync       — Dump/restore app config between envs via shared S3 bucket"
echo "  7) User Feedback   — In-app feedback widget -> shared Notion database"
echo "  8) SFTP            — File exchange with one external SFTP endpoint (per-app confined)"
echo "  9) View as customer — Admins preview a company's customer pages (read-only, audited)"
echo ""
echo "Enter numbers separated by spaces (e.g., '1 3'), or press Enter to skip:"
read -r CAP_INPUT

ENABLED_CAPS="[]"
CAP_NOTES=""

if [ -n "$CAP_INPUT" ]; then
    caps=()
    for num in $CAP_INPUT; do
        case $num in
            1) caps+=("client_catalog") ;;
            2) caps+=("upc") ;;
            3) caps+=("ftl") ;;
            4) caps+=("public_api") ;;
            5) caps+=("llm") ;;
            6) caps+=("data_sync") ;;
            7) caps+=("user_feedback") ;;
            8) caps+=("sftp") ;;
            9) caps+=("customer_preview") ;;
        esac
    done

    # customer_preview builds on Company Login (default-on, so not in the menu):
    # record it as enabled too, so app.config.json reflects the dependency.
    CUSTOMER_PREVIEW_SELECTED=false
    if [[ " ${caps[*]} " =~ " customer_preview " ]]; then
        CUSTOMER_PREVIEW_SELECTED=true
        if [[ ! " ${caps[*]} " =~ " company_login " ]]; then
            caps+=("company_login")
        fi
    fi

    # Auto-add client_catalog if upc is selected
    if [[ " ${caps[*]} " =~ " upc " ]] && [[ ! " ${caps[*]} " =~ " client_catalog " ]]; then
        caps+=("client_catalog")
        echo -e "  ${YELLOW}Note: Client Catalog auto-enabled (required by UPC)${NC}"
    fi

    # APP_PRODUCT was already chosen above (it's a cost-allocation dimension for
    # every app, not just LLM apps). Here we only note whether to wire up the
    # LiteLLM env vars in .env.
    LLM_ENABLED=false
    if [[ " ${caps[*]} " =~ " llm " ]]; then
        LLM_ENABLED=true
    fi

    if [ ${#caps[@]} -gt 0 ]; then
        json_array=$(printf '"%s",' "${caps[@]}")
        ENABLED_CAPS="[${json_array%,}]"

        echo ""
        echo -e "  ${GREEN}Enabled capabilities:${NC}"
        for cap in "${caps[@]}"; do
            echo -e "    - ${cap}"
        done

        CAP_NOTES=""
        for cap in "${caps[@]}"; do
            case $cap in
                client_catalog)
                    CAP_NOTES="${CAP_NOTES}\n  Client Catalog env vars needed:"
                    CAP_NOTES="${CAP_NOTES}\n    CLIENT_CATALOG_BASE_URL + shared INTERNAL_API_* OAuth credential"
                    CAP_NOTES="${CAP_NOTES}\n    Schema: prisma/schema/client_catalog.prisma.example"
                    CAP_NOTES="${CAP_NOTES}\n    Companies/workspaces admin: copy src/modules/client_catalog/scaffold/ (see its README)"
                    ;;
                upc)
                    CAP_NOTES="${CAP_NOTES}\n  UPC env vars needed:"
                    CAP_NOTES="${CAP_NOTES}\n    UPC_API_BASE_URL + shared INTERNAL_API_* OAuth credential"
                    CAP_NOTES="${CAP_NOTES}\n    Schema: prisma/schema/upc.prisma.example"
                    CAP_NOTES="${CAP_NOTES}\n    Feeds/items admin: copy src/modules/upc/scaffold/ (see its README; needs client_catalog scaffold)"
                    ;;
                ftl)
                    CAP_NOTES="${CAP_NOTES}\n  FTL env vars needed:"
                    CAP_NOTES="${CAP_NOTES}\n    FTL_API_BASE_URL, FTL_API_KEY"
                    ;;
                public_api)
                    CAP_NOTES="${CAP_NOTES}\n  Public API:"
                    CAP_NOTES="${CAP_NOTES}\n    Schema: prisma/schema/public_api.prisma.example"
                    CAP_NOTES="${CAP_NOTES}\n    npm install @asteasolutions/zod-to-openapi"
                    ;;
                llm)
                    CAP_NOTES="${CAP_NOTES}\n  LLM env vars needed:"
                    CAP_NOTES="${CAP_NOTES}\n    LITELLM_API_KEY — virtual key (self-service: https://infra-tools.deproxy.muc.domeus.com/ai-keys/gptkeyreq.php)"
                    CAP_NOTES="${CAP_NOTES}\n    LITELLM_BASE_URL=https://llm-proxy.labs.mapp.com"
                    CAP_NOTES="${CAP_NOTES}\n    APP_PRODUCT=${APP_PRODUCT:-internal}"
                    ;;
                data_sync)
                    CAP_NOTES="${CAP_NOTES}\n  Data Sync (cross-env config dumps):"
                    CAP_NOTES="${CAP_NOTES}\n    1. Wire DataSyncIntegration into infra/lib/stack.ts (see docs/template/capabilities/DATA_SYNC.md)"
                    CAP_NOTES="${CAP_NOTES}\n    2. Copy scripts/data-sync/*.example -> scripts/data-sync/*.ts and fill in CONFIG_TABLES"
                    CAP_NOTES="${CAP_NOTES}\n    3. Copy scripts/deploy/run-*-config-from-s3.sh.example and chmod +x"
                    CAP_NOTES="${CAP_NOTES}\n    No env vars needed in .env — CDK injects DATA_SYNC_BUCKET/KEY_PREFIX on the task"
                    ;;
                user_feedback)
                    CAP_NOTES="${CAP_NOTES}\n  User Feedback (in-app widget -> shared Notion DB):"
                    CAP_NOTES="${CAP_NOTES}\n    npm install @notionhq/client"
                    CAP_NOTES="${CAP_NOTES}\n    Copy src/modules/user_feedback/scaffold/ into place (see its README) + mount <FeedbackWidget /> in the root layout"
                    CAP_NOTES="${CAP_NOTES}\n    Shared SSM (same for all apps): NOTION_API_KEY, NOTION_FEEDBACK_DATABASE_ID (/labs-shared/feedback/*)"
                    CAP_NOTES="${CAP_NOTES}\n    No Prisma model, no in-app LLM. Set app.config.json createdBy (= Responsible Person). See docs/template/capabilities/USER_FEEDBACK.md"
                    ;;
                sftp)
                    CAP_NOTES="${CAP_NOTES}\n  SFTP (external file exchange):"
                    CAP_NOTES="${CAP_NOTES}\n    Per-app, per-counterparty values — ask the app owner / the team running the host. There is no shared Mapp SFTP endpoint."
                    CAP_NOTES="${CAP_NOTES}\n    .env: SFTP_HOST, SFTP_USERNAME, SFTP_PASSWORD or SFTP_PRIVATE_KEY, SFTP_ROOT_PATH"
                    CAP_NOTES="${CAP_NOTES}\n    REQUIRED host key pin: ssh-keyscan -t ed25519 \$SFTP_HOST | ssh-keygen -lf -  -> SFTP_HOST_FINGERPRINT"
                    CAP_NOTES="${CAP_NOTES}\n    Access is confined to {SFTP_ROOT_PATH}/{appName}. That is code-enforced, NOT IAM-enforced —"
                    CAP_NOTES="${CAP_NOTES}\n    ask whoever runs the host to chroot the service account to that directory. See docs/template/capabilities/SFTP.md"
                    ;;
                customer_preview)
                    CAP_NOTES="${CAP_NOTES}\n  View as customer (customer_preview):"
                    CAP_NOTES="${CAP_NOTES}\n    .env: CUSTOMER_PREVIEW_ENABLED=true (set for you), CUSTOMER_PREVIEW_SERVICES = the service codes your eligibility policy checks"
                    CAP_NOTES="${CAP_NOTES}\n    Add both to the ECS task environment in infra/lib/stack.ts for staging/production (not secrets)"
                    CAP_NOTES="${CAP_NOTES}\n    Seam: src/modules/customer_preview/config/subject.ts (client_catalog by default). Every customer mutation must call assertNotPreview()"
                    CAP_NOTES="${CAP_NOTES}\n    See docs/template/capabilities/CUSTOMER_PREVIEW.md"
                    ;;
            esac
        done
    fi
fi
echo ""

# -----------------------------------------------------------------------------
# Write app.config.json
# -----------------------------------------------------------------------------
echo "Writing app.config.json..."
cat > "$CONFIG_FILE" << EOF
{
  "appName": "${APP_NAME}",
  "displayName": "${DISPLAY_NAME}",
  "logoPath": "",
  "dbName": "${DB_NAME}",
  "product": "${APP_PRODUCT}",
  "team": "${TEAM_NAME}",
  "appOwner": "${APP_OWNER}",
  "createdBy": "${CREATED_BY}",
  "managedBy": "${MANAGED_BY}",
  "enabledCapabilities": ${ENABLED_CAPS}
}
EOF

# -----------------------------------------------------------------------------
# Perform replacements
# -----------------------------------------------------------------------------

replace_in_file() {
    local file="$1"
    local search="$2"
    local replace="$3"
    if [ -f "$file" ]; then
        SEARCH="$search" REPLACE="$replace" node -e '
const fs = require("fs");
const file = process.argv[1];
const data = fs.readFileSync(file, "utf8");
fs.writeFileSync(file, data.split(process.env.SEARCH).join(process.env.REPLACE));
' "$(to_node_path "$file")"
    fi
}

# Note: Makefile, environments.ts, and deploy scripts now read from app.config.json
# dynamically, so we only need to replace static defaults in the remaining files.

echo "Updating infra/package.json..."
replace_in_file "${PROJECT_ROOT}/infra/package.json" '"name": "myapp-infra"' "\"name\": \"${APP_NAME}-infra\""

echo "Updating scripts/docker-entrypoint.sh..."
replace_in_file "${PROJECT_ROOT}/scripts/docker-entrypoint.sh" 'DB_NAME="\${DB_NAME:-myapp}"' "DB_NAME=\"\${DB_NAME:-${DB_NAME}}\""

echo "Updating .env.example..."
replace_in_file "${PROJECT_ROOT}/.env.example" "APP_NAME=Mapp Labs" "APP_NAME=${DISPLAY_NAME}"
replace_in_file "${PROJECT_ROOT}/.env.example" "DB_NAME=myapp" "DB_NAME=${DB_NAME}"
replace_in_file "${PROJECT_ROOT}/.env.example" "DB_PORT=5432" "DB_PORT=${DB_PORT}"

echo "Updating package.json..."
replace_in_file "${PROJECT_ROOT}/package.json" '"name": "mapp-labs"' "\"name\": \"${APP_NAME}\""

echo "Updating src/config/env.ts..."
replace_in_file "${PROJECT_ROOT}/src/config/env.ts" "APP_NAME: z.string().default('Mapp Labs')" "APP_NAME: z.string().default('${DISPLAY_NAME}')"

echo "Updating src/config/index.ts..."
replace_in_file "${PROJECT_ROOT}/src/config/index.ts" "process.env.NEXT_PUBLIC_APP_NAME || \"Mapp Labs\"" "process.env.NEXT_PUBLIC_APP_NAME || \"${DISPLAY_NAME}\""

# -----------------------------------------------------------------------------
# Generate .env if it doesn't exist
# Done here (before git re-init / repo URL prompt) so that a Ctrl-C or stdin
# EOF at the repo URL prompt — which `set -e` would otherwise treat as a fatal
# error — never strands the user with an unconfigured .env.
# -----------------------------------------------------------------------------
if [ ! -f "${PROJECT_ROOT}/.env" ]; then
    echo ""
    echo "Creating .env from .env.example..."
    cp "${PROJECT_ROOT}/.env.example" "${PROJECT_ROOT}/.env"
    # Apply generated/prompted auth values
    replace_in_file "${PROJECT_ROOT}/.env" "NEXTAUTH_SECRET=SETUP_WILL_GENERATE" "NEXTAUTH_SECRET=${NEXTAUTH_SECRET}"
    replace_in_file "${PROJECT_ROOT}/.env" "SUPER_ADMINS=SETUP_WILL_PROMPT" "SUPER_ADMINS=${SUPER_ADMINS}"
    # Uncomment and set LLM env vars if LLM capability was selected
    if [ "$LLM_ENABLED" = true ]; then
        replace_in_file "${PROJECT_ROOT}/.env" "#LITELLM_API_KEY=sk-your-virtual-key-here" "LITELLM_API_KEY=sk-your-virtual-key-here"
        replace_in_file "${PROJECT_ROOT}/.env" "#LITELLM_BASE_URL=https://llm-proxy.labs.mapp.com" "LITELLM_BASE_URL=https://llm-proxy.labs.mapp.com"
    fi
    # APP_PRODUCT applies to every app (cost-allocation tag mirror), so set it
    # regardless of whether the LLM capability is enabled.
    replace_in_file "${PROJECT_ROOT}/.env" "#APP_PRODUCT=internal" "APP_PRODUCT=${APP_PRODUCT}"
    if [ "${CUSTOMER_PREVIEW_SELECTED:-false}" = true ]; then
        replace_in_file "${PROJECT_ROOT}/.env" "#CUSTOMER_PREVIEW_ENABLED=true" "CUSTOMER_PREVIEW_ENABLED=true"
    fi
    echo -e "${GREEN}Created .env with auth credentials configured.${NC}"
fi

# -----------------------------------------------------------------------------
# Git repository setup
# -----------------------------------------------------------------------------
TEMPLATE_REPO="mapp-digital/labs-app-template"
CURRENT_REMOTE=$(cd "${PROJECT_ROOT}" && git remote get-url origin 2>/dev/null || echo "")
GIT_REINITIALIZED=false

if echo "$CURRENT_REMOTE" | grep -q "$TEMPLATE_REPO"; then
    echo ""
    echo -e "${YELLOW}This project is still using the template's git repository.${NC}"
    echo "  Remote: ${CURRENT_REMOTE}"
    echo ""
    echo "Your new project needs its own git repo with a clean history."
    echo ""
    echo -n "Reinitialize git for your new project? [Y/n]: "
    read -r REINIT_GIT
    if [ "$REINIT_GIT" != "n" ] && [ "$REINIT_GIT" != "N" ]; then
        echo ""
        echo "Reinitializing git repository..."
        (cd "${PROJECT_ROOT}" && rm -rf .git && git init && git add -A && git commit -m "Initial commit from labs-app-template")
        GIT_REINITIALIZED=true
        echo -e "  ${GREEN}✓${NC} Git reinitialized with clean history"
        echo ""
    fi

    # Configure git hooks to prevent pushing back to the template
    (cd "${PROJECT_ROOT}" && git config core.hooksPath .githooks)
    echo -e "  ${GREEN}✓${NC} Git hooks configured (prevents accidental pushes to template repo)"
    echo ""

    echo "Enter the URL for your new repository (SSH or HTTPS)."
    echo "  Create your repo at: https://github.com/organizations/mapp-labs/repositories/new"
    echo ""
    echo "  - SSH:   git@github.com:mapp-labs/labs-${APP_NAME}.git"
    echo "  - HTTPS: https://github.com/mapp-labs/labs-${APP_NAME}.git"
    echo "  - Press Enter to skip (you can set it later)"
    echo ""
    echo -n "New repo URL: "
    read -r NEW_REMOTE
    if [ -n "$NEW_REMOTE" ]; then
        if [ "$GIT_REINITIALIZED" = true ]; then
            (cd "${PROJECT_ROOT}" && git remote add origin "$NEW_REMOTE")
        else
            (cd "${PROJECT_ROOT}" && git remote set-url origin "$NEW_REMOTE")
        fi
        echo -e "  ${GREEN}✓${NC} Remote origin set to: ${NEW_REMOTE}"
    else
        echo -e "  ${YELLOW}Skipped.${NC} Set the remote later with:"
        if [ "$GIT_REINITIALIZED" = true ]; then
            echo "    git remote add origin <your-repo-url>"
        else
            echo "    git remote set-url origin <your-repo-url>"
        fi
    fi
fi

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
FINAL_REMOTE=$(cd "${PROJECT_ROOT}" && git remote get-url origin 2>/dev/null || echo "<no remote set>")
DIR_NAME=$(basename "${PROJECT_ROOT}")

echo ""
echo "=========================================="
echo -e "  ${GREEN}Setup complete!${NC}"
echo "=========================================="
echo ""
echo "  App name:      ${APP_NAME}"
echo "  Display name:  ${DISPLAY_NAME}"
echo "  Database:      ${DB_NAME} (port ${DB_PORT})"
echo "  Product:       ${APP_PRODUCT}"
echo "  Team:          ${TEAM_NAME:-<not set>}"
echo "  Created by:    ${CREATED_BY}"
echo "  Managed by:    ${MANAGED_BY}"
echo "  Git remote:    ${FINAL_REMOTE}"
echo ""
echo "  Next steps:"
STEP=1
# Suggest renaming directory if it still has the template name
if [ "$DIR_NAME" = "labs-app-template" ]; then
    echo "    ${STEP}. Rename project directory:"
    echo "         cd .. && mv labs-app-template labs-${APP_NAME} && cd labs-${APP_NAME}"
    STEP=$((STEP + 1))
fi
# Suggest setting remote if not set
if [ "$FINAL_REMOTE" = "<no remote set>" ] || echo "$FINAL_REMOTE" | grep -q "$TEMPLATE_REPO"; then
    echo "    ${STEP}. Create repo at https://github.com/organizations/mapp-labs/repositories/new"
    STEP=$((STEP + 1))
    echo "    ${STEP}. Set git remote:  git remote set-url origin git@github.com:mapp-labs/labs-${APP_NAME}.git"
    STEP=$((STEP + 1))
fi
# If git was NOT reinitialized, show git diff
if [ "$GIT_REINITIALIZED" != true ]; then
    echo "    ${STEP}. Review the changes:  git diff"
    STEP=$((STEP + 1))
fi
echo "    ${STEP}. Create your local database:  createdb ${DB_NAME}"
STEP=$((STEP + 1))
echo "    ${STEP}. Run:  make dev-initial-setup"
STEP=$((STEP + 1))
# Suggest pushing initial commit if git was reinitialized and remote was set
if [ "$GIT_REINITIALIZED" = true ] && [ -n "$NEW_REMOTE" ]; then
    echo "    ${STEP}. Push initial commit:  git push -u origin main"
    STEP=$((STEP + 1))
fi
echo "    ${STEP}. Set up Icinga monitoring (optional):  see docs/template/MONITORING.md"
if [ -n "$CAP_NOTES" ]; then
    echo ""
    echo "  Capability setup:"
    echo -e "$CAP_NOTES"
fi
echo ""
