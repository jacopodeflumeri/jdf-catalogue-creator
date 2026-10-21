#!/bin/bash
set -e

# Setup SSM Parameters for deployment
# Usage: ./setup-ssm-params.sh [staging|production]

ENV="${1:-staging}"
AWS_PROFILE="${AWS_PROFILE:-labs-power}"
AWS_REGION="eu-central-1"
source "$(dirname "$0")/_config.sh"
PREFIX="${APP_NAME}-${SHORT_ENV}"

# Shared SSM namespace for cross-app Labs values (labs-portal client creds,
# kc-registrar service-account creds). Staging stays at /labs/* for back-compat
# with the original (env-less) layout. Production and any future envs use
# /labs-<env>/* to keep credentials isolated between environments.
if [ "${SHORT_ENV}" = "stg" ]; then
    SHARED_PREFIX="/labs"
else
    SHARED_PREFIX="/labs-${SHORT_ENV}"
fi

echo "=========================================="
echo "SSM Parameter Setup"
echo "=========================================="
echo "Environment: ${ENV}"
echo "Prefix:      /${PREFIX}/"
echo "=========================================="
echo ""

put_parameter() {
    local name=$1
    local description=$2
    local default_value=$3

    # Check if parameter already exists
    existing=$(aws ssm get-parameter --name "/${PREFIX}/${name}" --region ${AWS_REGION} --profile ${AWS_PROFILE} 2>/dev/null || echo "")

    if [ -n "$existing" ]; then
        echo "Parameter /${PREFIX}/${name} already exists. Skip? [Y/n]"
        read -r skip
        if [ "$skip" != "n" ] && [ "$skip" != "N" ]; then
            echo "Skipping..."
            return
        fi
    fi

    echo ""
    echo "${description}"
    if [ -n "$default_value" ]; then
        echo "Default: ${default_value}"
    fi
    echo -n "Enter value for ${name}: "
    read -r value

    if [ -z "$value" ] && [ -n "$default_value" ]; then
        value="$default_value"
    fi

    if [ -z "$value" ]; then
        echo "Skipping ${name} (no value provided)"
        return
    fi

    aws ssm put-parameter \
        --name "/${PREFIX}/${name}" \
        --value "${value}" \
        --type "SecureString" \
        --overwrite \
        --region ${AWS_REGION} \
        --profile ${AWS_PROFILE} \
        --description "${description}" \
        > /dev/null

    echo "Set /${PREFIX}/${name}"
}

echo "This script will help you set up the required SSM parameters."
echo "Press Enter to use default values where available, or enter a new value."
echo ""

# Required parameters (always needed regardless of which login backend)
put_parameter "NEXTAUTH_SECRET" "NextAuth.js secret (32+ characters). Generate with: openssl rand -base64 32"
put_parameter "SUPER_ADMINS" "Comma-separated list of super admin email addresses"

echo ""
echo "Keycloak parameters (shared across all Labs apps via ${SHARED_PREFIX}/labs-portal/*)."
echo "These are auto-copied from the shared SSM namespace, no need to type them."
echo "If the shared params are missing, ask the labs-platform team or see docs/template/KEYCLOAK.md."

copy_from_shared() {
    local shared_name=$1
    local app_name=$2
    local description=$3

    # Skip if app param already exists (idempotent re-runs)
    existing=$(aws ssm get-parameter --name "/${PREFIX}/${app_name}" --region ${AWS_REGION} --profile ${AWS_PROFILE} 2>/dev/null || echo "")
    if [ -n "$existing" ]; then
        echo "  /${PREFIX}/${app_name} already exists, leaving alone"
        return
    fi

    value=$(aws ssm get-parameter --name "${SHARED_PREFIX}/labs-portal/${shared_name}" --with-decryption --query 'Parameter.Value' --output text --region ${AWS_REGION} --profile ${AWS_PROFILE} 2>/dev/null || echo "")
    if [ -z "$value" ]; then
        echo "  SHARED PARAM MISSING: ${SHARED_PREFIX}/labs-portal/${shared_name} — ask labs-platform team to populate (see docs/template/KEYCLOAK.md)"
        return
    fi

    aws ssm put-parameter \
        --name "/${PREFIX}/${app_name}" \
        --value "${value}" \
        --type "SecureString" \
        --overwrite \
        --region ${AWS_REGION} \
        --profile ${AWS_PROFILE} \
        --description "${description}" \
        > /dev/null
    echo "  copied ${SHARED_PREFIX}/labs-portal/${shared_name} → /${PREFIX}/${app_name}"
}

put_parameter "KEYCLOAK_ENABLED" "Set to 'true' to enable Keycloak-based login (Recommended for new apps)" "true"
copy_from_shared "issuer"            "KEYCLOAK_ISSUER"            "Shared: Keycloak realm issuer URL (realm is embedded in the issuer path)"
copy_from_shared "client-id"         "KEYCLOAK_CLIENT_ID"         "Shared: Keycloak OIDC client id"
copy_from_shared "client-secret"     "KEYCLOAK_CLIENT_SECRET"     "Shared: Keycloak OIDC client secret"
copy_from_shared "idp-hint"          "KEYCLOAK_IDP_HINT"          "Shared: Keycloak internal IdP hint"
copy_from_shared "company-idp-hint"  "KEYCLOAK_COMPANY_IDP_HINT"  "Shared: Keycloak company-context IdP hint"
copy_from_shared "tls-insecure"      "KEYCLOAK_TLS_INSECURE"      "Shared: temporary KC TLS bypass (until INT KC TLS is fixed)"

# -----------------------------------------------------------------------------
# Legacy: direct Azure AD login (only prompted when Keycloak is OFF)
# Keycloak already brokers to Entra ID via the "Mapp Entra ID" button, so new
# apps almost never need direct Azure config. We only ask for it when the user
# explicitly disabled Keycloak above.
# -----------------------------------------------------------------------------
KC_VAL=$(aws ssm get-parameter --name "/${PREFIX}/KEYCLOAK_ENABLED" --with-decryption --query 'Parameter.Value' --output text --region ${AWS_REGION} --profile ${AWS_PROFILE} 2>/dev/null || echo "true")

# Helper: write an empty SecureString placeholder if the param doesn't already
# exist. The CDK stack references these SSM params unconditionally as ECS
# Secrets, so they must exist even when unused (otherwise the task fails to
# start with "ResourceInitializationError: unable to pull secrets").
put_placeholder() {
    local name=$1
    local description=$2
    existing=$(aws ssm get-parameter --name "/${PREFIX}/${name}" --region ${AWS_REGION} --profile ${AWS_PROFILE} 2>/dev/null || echo "")
    if [ -n "$existing" ]; then
        echo "  /${PREFIX}/${name} already exists, leaving alone"
        return
    fi
    aws ssm put-parameter \
        --name "/${PREFIX}/${name}" \
        --value "unused" \
        --type "SecureString" \
        --overwrite \
        --region ${AWS_REGION} \
        --profile ${AWS_PROFILE} \
        --description "${description}" \
        > /dev/null
    echo "  /${PREFIX}/${name} placeholder set (unused at runtime)"
}

if [ "$KC_VAL" != "true" ]; then
    echo ""
    echo "Keycloak is disabled — collecting legacy Azure AD parameters."
    echo "Register your own Entra app via ITHELPDESK first. See docs/template/ENTRA-SETUP.md."
    put_parameter "AZURE_AD_CLIENT_ID" "Microsoft Entra (Azure AD) Application Client ID"
    put_parameter "AZURE_AD_CLIENT_SECRET" "Microsoft Entra (Azure AD) Application Client Secret"
    put_parameter "AZURE_AD_TENANT_ID" "Microsoft Entra (Azure AD) Tenant ID"
else
    echo ""
    echo "Keycloak enabled — writing 'unused' placeholders for AZURE_AD_* so the ECS"
    echo "task definition (which references them unconditionally) can launch."
    put_placeholder "AZURE_AD_CLIENT_ID" "Unused placeholder (Keycloak path handles Entra brokering)"
    put_placeholder "AZURE_AD_CLIENT_SECRET" "Unused placeholder (Keycloak path handles Entra brokering)"
    put_placeholder "AZURE_AD_TENANT_ID" "Unused placeholder (Keycloak path handles Entra brokering)"
fi

# KEYCLOAK_CA_PEM is referenced as a Secret by the ECS task definition; write
# an 'unused' placeholder if not set. The app needs the real CA only when KC
# TLS is properly configured (i.e., NOT in the current INT bypass state where
# KEYCLOAK_TLS_INSECURE=true). Use `make ${ENV}-keycloak-ca-update` to populate
# a real PEM bundle after INT KC's TLS gets fixed.
put_placeholder "KEYCLOAK_CA_PEM" "Unused placeholder (use make ${ENV}-keycloak-ca-update to set real PEM)"

# NOTE: the Mapp internal root CA (ca.internal.mapp.tools) used by internal HTTPS
# services (company-management-service, product-feed-service, ...) is vendored in
# the image and trusted at the container layer — it is intentionally NOT an SSM
# parameter (it's a public, non-secret root shared across all internal services).
# Only set KEYCLOAK_CA_PEM above for a Keycloak host NOT under that root.
# See certs/ca.internal.mapp.tools.crt + docs/template/INTERNAL-CA.md.

# -----------------------------------------------------------------------------
# Shared internal-API OAuth2 credential (Keycloak realm `s2s`)
# -----------------------------------------------------------------------------
# ONE credential authenticates the app to ALL internal Mapp services
# (company-management-service / client catalog, product-feed-service / UPC, ...).
# Integrations do not carry their own token-url/client-id/secret — only their
# per-service base URLs, which are non-secret constants wired in infra/lib/stack.ts
# from shared SSM, not stored here.
#
# NOTHING IS SEEDED FOR THIS. The credential is provisioned once PER ENVIRONMENT
# and infra/lib/stack.ts references the shared path directly, so there is no
# app-scoped copy to create, populate, or rotate.
# Earlier template versions seeded /${PREFIX}/INTERNAL_API_* here (with a
# placeholder secret that had to be hand-copied); those params are superseded —
# but do NOT delete them until this app is verifiably reading the correct
# per-environment shared values (see the 2026-08-04 MIGRATION.md entry).
#
# PER-ENVIRONMENT: internal Mapp services are deployed per environment, and the
# `s2s` client secret differs per Keycloak realm even though the client id is the
# same (`mapp-labs`). Production keeps the unsuffixed prefix; other environments
# use /mapp-labs-${SHORT_ENV}. A staging app reading the production prefix would
# silently talk to PRODUCTION internal services.
#
# The realm-`s2s` client must be authorized for whichever internal services the
# app calls; the default `mapp-labs` client reaches both client catalog and
# product feed. If an app needs a dedicated client (e.g. `mapp-labs-<app>`), ask
# the labs-platform team — do not add a second credential here.
# See src/lib/internal-api/oauth.ts + docs/template/INTERNAL-API.md.
if [ "${SHORT_ENV}" = "prod" ]; then
    SHARED_INTERNAL_API="/mapp-labs"
else
    SHARED_INTERNAL_API="/mapp-labs-${SHORT_ENV}"
fi
echo ""
echo "Internal-API credential: read from shared SSM (${SHARED_INTERNAL_API}/internal-api/*)"
echo "by the CDK stack — no app-scoped parameters needed."
if ! aws ssm get-parameter --name "${SHARED_INTERNAL_API}/internal-api/client-secret" \
        --region ${AWS_REGION} --profile ${AWS_PROFILE} >/dev/null 2>&1; then
    echo "  WARNING: ${SHARED_INTERNAL_API}/internal-api/client-secret is missing or unreadable."
    echo "  Apps calling internal Mapp services will fail to start. Ask the"
    echo "  labs-platform team to populate it (see docs/template/INTERNAL-API.md)."
else
    echo "  OK: ${SHARED_INTERNAL_API}/internal-api/client-secret is present."
fi

# LLM capability
put_parameter "LITELLM_API_KEY" "LiteLLM proxy virtual key (self-service: https://infra-tools.deproxy.muc.domeus.com/ai-keys/gptkeyreq.php)" ""
put_parameter "LITELLM_BASE_URL" "LiteLLM proxy URL" "https://llm-proxy.labs.mapp.com"

echo ""
echo "=========================================="
echo "SSM Parameter setup complete!"
echo "=========================================="
echo "If Keycloak TLS requires a custom CA bundle, run:"
echo "  make ${ENV}-keycloak-ca-update"
echo ""
echo "To list all parameters:"
echo "  aws ssm get-parameters-by-path --path /${PREFIX}/ --region ${AWS_REGION} --profile ${AWS_PROFILE}"
