#!/bin/bash
set -e

# =============================================================================
# Shared SSM Parameter Setup (one-time, account-wide)
#
# Stores the Microsoft Graph API credentials used by every Mapp Labs app to
# self-register its redirect URIs on the shared Entra app registration.
#
# These values are shared across ALL Labs apps in the labs-power AWS account.
# Only run this once per AWS account (not per project).
#
# Usage: ./setup-shared-ssm-params.sh
# =============================================================================

AWS_PROFILE="${AWS_PROFILE:-labs-power}"
AWS_REGION="${AWS_REGION:-eu-central-1}"
SHARED_SSM_PATH="/mapp-labs-shared"

echo "=========================================="
echo "Shared SSM Parameter Setup"
echo "=========================================="
echo "Path:    ${SHARED_SSM_PATH}/"
echo "Region:  ${AWS_REGION}"
echo "Profile: ${AWS_PROFILE}"
echo "=========================================="
echo ""
echo "This configures Graph API credentials for automated Entra redirect"
echo "URI management. Run ONCE per AWS account — values are shared across"
echo "every Labs app."
echo ""
echo "Get the four values from IT (they own the shared Entra app registration)."
echo ""

put_parameter() {
    local name=$1
    local description=$2
    local secure=$3

    local full_name="${SHARED_SSM_PATH}/${name}"

    existing=$(aws ssm get-parameter --name "$full_name" --region "$AWS_REGION" --profile "$AWS_PROFILE" 2>/dev/null || echo "")

    if [ -n "$existing" ]; then
        echo "Parameter ${full_name} already exists. Overwrite? [y/N]"
        read -r overwrite
        if [ "$overwrite" != "y" ] && [ "$overwrite" != "Y" ]; then
            echo "Skipping."
            return
        fi
    fi

    echo ""
    echo "${description}"
    echo -n "Enter value for ${name}: "
    if [ "$secure" = "secure" ]; then
        read -r -s value
        echo ""
    else
        read -r value
    fi

    if [ -z "$value" ]; then
        echo "Skipping ${name} (no value provided)"
        return
    fi

    aws ssm put-parameter \
        --name "$full_name" \
        --value "$value" \
        --type "SecureString" \
        --overwrite \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" \
        --description "$description" \
        > /dev/null

    echo "Set ${full_name}"
}

put_parameter "ENTRA_MGMT_TENANT_ID"     "Entra tenant ID (Directory ID)" "plain"
put_parameter "ENTRA_MGMT_OBJECT_ID"     "Object ID of the shared Mapp Labs Entra app registration" "plain"
put_parameter "ENTRA_MGMT_CLIENT_ID"     "Client ID of the service principal with Graph API permission on the shared app" "plain"
put_parameter "ENTRA_MGMT_CLIENT_SECRET" "Client secret for the Graph API service principal" "secure"

echo ""
echo "=========================================="
echo "Shared SSM setup complete."
echo "=========================================="
echo ""
echo "Verify:"
echo "  aws ssm get-parameters-by-path --path ${SHARED_SSM_PATH}/ --region ${AWS_REGION} --profile ${AWS_PROFILE}"
echo ""
echo "Test (lists every redirect URI on the shared Entra app):"
echo "  make entra-redirects-list"
