#!/bin/bash
# Shared config loader for deploy scripts
# Reads app identity from app.config.json, allows env var overrides

# macOS workaround: AWS CLI v2 (homebrew) crashes with
# `Symbol not found: _XML_SetAllocTrackerActivationThreshold` when python@3.14
# is installed, unless DYLD_LIBRARY_PATH points to the homebrew expat lib.
# macOS SIP strips DYLD_LIBRARY_PATH when /bin/bash re-execs scripts, so
# prefixing `make` with the env var doesn't propagate down — we have to set
# it inside each script's process. Done here so every deploy script that
# sources _config.sh inherits it automatically.
if [[ "$(uname)" == "Darwin" ]] && [[ -d /opt/homebrew/opt/expat/lib ]]; then
    export DYLD_LIBRARY_PATH="${DYLD_LIBRARY_PATH:+$DYLD_LIBRARY_PATH:}/opt/homebrew/opt/expat/lib"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Git Bash on Windows yields /c/Users/... paths, which a Windows node cannot
# open. cygpath -m converts to C:/Users/... (forward slashes -- backslashes
# would turn into escape sequences inside a JS string). Without cygpath
# (macOS/Linux) the path is returned unchanged. Pass the result to node as an
# argument (process.argv[1]); never interpolate a path into the JS source.
# Deploy scripts that source this file use it too.
to_node_path() {
    if command -v cygpath &>/dev/null; then cygpath -m "$1"; else echo "$1"; fi
}

# Append a command to the EXIT trap instead of replacing it, so cleanups from
# different parts of a script (or a caller) all run. bash 3.2-safe.
#   add_exit_trap 'rm -rf "${MY_TMP_DIR}"'
add_exit_trap() {
    local new_cmd="$1" existing=""
    # `trap -p EXIT` prints `trap -- '<cmd>' EXIT`, quoted for re-use as input.
    eval "set -- $(trap -p EXIT)"
    if [ $# -ge 3 ]; then existing="$3"; fi
    # shellcheck disable=SC2064 # expand now: we are composing the trap text
    trap -- "${existing:+${existing}; }${new_cmd}" EXIT
}

if [ -f "${PROJECT_ROOT}/app.config.json" ]; then
    APP_CONFIG_NODE_PATH="$(to_node_path "${PROJECT_ROOT}/app.config.json")"
    APP_NAME="${APP_NAME:-$(node -p "require(process.argv[1]).appName" "${APP_CONFIG_NODE_PATH}")}"
    ECR_REPO="${ECR_REPO:-${APP_NAME}}"
    # Cost-allocation tag values (mirror the CDK stack tags in infra/bin/infra.ts)
    APP_PRODUCT="${APP_PRODUCT:-$(node -p "require(process.argv[1]).product || 'internal'" "${APP_CONFIG_NODE_PATH}")}"
    APP_TEAM="${APP_TEAM:-$(node -p "require(process.argv[1]).team || ''" "${APP_CONFIG_NODE_PATH}")}"
    # Per-person billing key. Falls back to createdBy exactly as infra/bin/infra.ts
    # does, so out-of-band resources agree with the CDK-created ones.
    APP_OWNER="${APP_OWNER:-$(node -p "const c = require(process.argv[1]); c.appOwner || c.createdBy || ''" "${APP_CONFIG_NODE_PATH}")}"
    # Deploy model toggle — the SINGLE source of truth shared with the CDK stack
    # (infra/lib/stack.ts reads the same key). Absent/false → default floating
    # `${env}-latest` tag + `update-service --force-new-deployment` (no
    # iam:PassRole, works with labs-power/PowerUserAccess). True → immutable
    # `${env}-${version}` tag + register-task-definition revision flow, which
    # requires iam:PassRole on the task/execution roles. See the 2026-07-11
    # MIGRATION.md entry and docs/template/DEPLOYMENT.md.
    IMMUTABLE_DEPLOY="${IMMUTABLE_DEPLOY:-$(node -p "require(process.argv[1]).immutableDeploy === true" "${APP_CONFIG_NODE_PATH}" 2>/dev/null || echo false)}"
fi
APP_NAME="${APP_NAME:-myapp}"
ECR_REPO="${ECR_REPO:-myapp}"
APP_PRODUCT="${APP_PRODUCT:-internal}"
APP_TEAM="${APP_TEAM:-}"
APP_OWNER="${APP_OWNER:-}"
IMMUTABLE_DEPLOY="${IMMUTABLE_DEPLOY:-false}"

# Short environment name for AWS resource naming (prod/stg).
# Accepts both long ("production", "staging") and short ("prod", "stg") forms
# so deploy scripts can be called with either convention.
case "${ENV:-}" in
    production|prod)
        SHORT_ENV="prod"
        ;;
    *)
        SHORT_ENV="stg"
        ;;
esac

# Git Bash on Windows: the AWS CLI v2 installer adds itself to the Windows
# PATH, but a Git Bash window opened before the install doesn't see it. Fall
# back to the installer's default location. No effect on macOS/Linux.
case "$(uname -s)" in
    MINGW*|MSYS*)
        if ! command -v aws &>/dev/null && [ -x "/c/Program Files/Amazon/AWSCLIV2/aws.exe" ]; then
            export PATH="${PATH}:/c/Program Files/Amazon/AWSCLIV2"
        fi
        ;;
esac

# Python for the deploy scripts' small JSON/URL helpers. macOS/Linux: python3,
# exactly as before. Git Bash on Windows: python.org installs `python` (not
# `python3`), and `python3` is often the Microsoft Store stub that just prints
# an install hint -- so pick the first candidate that actually runs Python 3.
# Windows Python also writes CRLF to stdout, which would leave a stray "\r" in
# every $(...) capture ("RUNNING\r" != "RUNNING"), so run_python strips it there.
#   value="$(run_python -c 'print(42)')"
PYTHON_BIN="python3"
case "$(uname -s)" in
    MINGW*|MSYS*)
        for _py in python3 python; do
            if command -v "${_py}" &>/dev/null \
                && "${_py}" -c 'import sys; sys.exit(0 if sys.version_info[0] == 3 else 1)' &>/dev/null; then
                PYTHON_BIN="${_py}"
                break
            fi
        done
        unset _py
        run_python() {
            "${PYTHON_BIN}" "$@" | tr -d '\r'
            return "${PIPESTATUS[0]}"
        }
        ;;
    *)
        run_python() { "${PYTHON_BIN}" "$@"; }
        ;;
esac

# macOS + AWS SSO + Node SDK gotcha: when the labs-power profile uses the new
# sso_session block format, CDK's bundled Node SDK can't resolve credentials
# from the AWS CLI's SSO cache. Pre-resolve credentials into env vars so any
# AWS SDK (Node, Go, Python) reads them transparently. Idempotent: if env vars
# are already set, leave them alone.
if [ -z "${AWS_ACCESS_KEY_ID:-}" ] && command -v aws &>/dev/null; then
    CREDS=$(aws configure export-credentials --profile "${AWS_PROFILE:-labs-power}" --format env 2>/dev/null || true)
    if [ -n "${CREDS}" ]; then
        eval "${CREDS}"
    fi
fi

# Git Bash on Windows rewrites any argument passed to a native Windows program
# (aws, node, curl, docker) that starts with "/" into a Windows path:
# /labs/x -> C:/Program Files/Git/labs/x. That breaks SSM parameter names
# ("Parameter name must be a fully qualified name", or a false "not found"),
# CloudWatch log group names, and container-side paths sent through ECS Exec.
# Exclude exactly those prefixes; real file paths (mktemp, /tmp/...) are still
# converted, which curl and other Windows tools need. No effect on macOS/Linux.
#   /${APP_NAME}-  this app's SSM namespace (/{app}-stg/*, /{app}-prod/*)
#   /labs          shared SSM (/labs/*, /labs-stg/*, /labs-prod/*)
#   /mapp-labs     shared SSM (/mapp-labs/*, /mapp-labs-stg/*, /mapp-labs-shared/*)
#   /ecs/          CloudWatch log groups (/ecs/{app}-{env}...)
#   /aws/          AWS-managed log groups / names (/aws/...)
#   /app/          paths inside the container (ECS Exec: /app/docker-entrypoint.sh)
# When you add an aws/curl/node call whose argument starts with a NEW "/"
# prefix that is not a local file path, add that prefix here (and to the
# matching export in the Makefile).
case "$(uname -s)" in
    MINGW*|MSYS*)
        _MSYS_EXCL="/${APP_NAME}-;/labs;/mapp-labs;/ecs/;/aws/;/app/"
        # Idempotent: scripts that call other scripts source this file again.
        case "${MSYS2_ARG_CONV_EXCL:-}" in
            "${_MSYS_EXCL}"|"${_MSYS_EXCL};"*) ;;
            *) export MSYS2_ARG_CONV_EXCL="${_MSYS_EXCL}${MSYS2_ARG_CONV_EXCL:+;${MSYS2_ARG_CONV_EXCL}}" ;;
        esac
        unset _MSYS_EXCL
        ;;
esac
