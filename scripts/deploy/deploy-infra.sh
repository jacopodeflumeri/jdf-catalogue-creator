#!/bin/bash
set -e

# Deploy CDK infrastructure
# Usage: ./deploy-infra.sh [staging|production] [--diff]

ENV="${1:-staging}"
DIFF_ONLY="${2:-}"
AWS_PROFILE="${AWS_PROFILE:-labs-power}"
AWS_REGION="eu-central-1"

# Source shared config — sets DYLD_LIBRARY_PATH for macOS+homebrew+python3.14
# expat ABI mismatch (AWS CLI workaround), and pre-resolves AWS SSO credentials
# into env vars (so CDK's bundled Node SDK can read them — the v2 SDK can't
# parse the `sso_session` profile block format).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_config.sh"

echo "=========================================="
echo "CDK Infrastructure Deployment"
echo "=========================================="
echo "Environment: ${ENV}"
echo "Profile:     ${AWS_PROFILE}"
echo "Region:      ${AWS_REGION}"
echo "=========================================="
echo ""

# Navigate to infra directory
cd "$(dirname "$0")/../../infra"

# Use the same modern Node runtime we already rely on for app and Docker builds.
if [ -s "$HOME/.nvm/nvm.sh" ]; then
    # shellcheck disable=SC1090
    source "$HOME/.nvm/nvm.sh"
    # Any installed 22.x will do; an exact pin made this script exit (set -e)
    # on machines with nvm but without that one patch release.
    nvm use 22 >/dev/null 2>&1 || true
fi
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
if [ "$NODE_MAJOR" -lt 22 ]; then
    echo "ERROR: Node 22+ is required (found $(node -v)). Install it, e.g. 'nvm install 22'." >&2
    exit 1
fi

# Ensure dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "Installing CDK dependencies..."
    npm install
fi

# Set AWS credentials for CDK
export AWS_PROFILE=${AWS_PROFILE}
export AWS_REGION=${AWS_REGION}

if [ "$DIFF_ONLY" = "--diff" ]; then
    echo "Showing infrastructure diff..."
    npx cdk diff -c env=${ENV}
else
    echo "Deploying infrastructure..."
    npx cdk deploy -c env=${ENV} --require-approval never --method=direct

    echo ""
    echo "=========================================="
    echo "Infrastructure deployment complete!"
    echo "=========================================="
fi
