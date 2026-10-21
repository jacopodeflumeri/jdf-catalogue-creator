#!/usr/bin/env bash
set -euo pipefail

# macOS workaround: see scripts/deploy/_config.sh for full explanation.
if [[ "$(uname)" == "Darwin" ]] && [[ -d /opt/homebrew/opt/expat/lib ]]; then
    export DYLD_LIBRARY_PATH="${DYLD_LIBRARY_PATH:+$DYLD_LIBRARY_PATH:}/opt/homebrew/opt/expat/lib"
fi

PROFILE="labs-power"
CREDENTIALS_FILE="$HOME/.aws/credentials"

# Git Bash on Windows: python.org installs `python`, and `python3` is often the
# Microsoft Store stub, so use the first that really runs Python 3. Windows
# Python also needs a C:/... path (cygpath -m) and prints CRLF, hence the
# `tr -d '\r'` on captures below. macOS/Linux: python3 and paths as before.
PYTHON_BIN="python3"
for _py in python3 python; do
    if command -v "$_py" &>/dev/null && "$_py" -c 'import sys; sys.exit(0 if sys.version_info[0] == 3 else 1)' &>/dev/null; then
        PYTHON_BIN="$_py"
        break
    fi
done
if command -v cygpath &>/dev/null; then
    CREDENTIALS_FILE_NATIVE="$(cygpath -m "$CREDENTIALS_FILE")"
else
    CREDENTIALS_FILE_NATIVE="$CREDENTIALS_FILE"
fi

echo "Logging in via AWS SSO..."
aws sso login --profile "$PROFILE"

echo "Fetching fresh credentials..."
CREDS_JSON=$(aws configure export-credentials --profile "$PROFILE" --format process)

export AWS_ACCESS_KEY_ID=$(echo "$CREDS_JSON" | "$PYTHON_BIN" -c "import sys,json; print(json.load(sys.stdin)['AccessKeyId'])" | tr -d '\r')
export AWS_SECRET_ACCESS_KEY=$(echo "$CREDS_JSON" | "$PYTHON_BIN" -c "import sys,json; print(json.load(sys.stdin)['SecretAccessKey'])" | tr -d '\r')
export AWS_SESSION_TOKEN=$(echo "$CREDS_JSON" | "$PYTHON_BIN" -c "import sys,json; print(json.load(sys.stdin)['SessionToken'])" | tr -d '\r')
export PROFILE CREDENTIALS_FILE_NATIVE

if [[ -z "$AWS_ACCESS_KEY_ID" || -z "$AWS_SECRET_ACCESS_KEY" || -z "$AWS_SESSION_TOKEN" ]]; then
  echo "Failed to retrieve credentials."
  exit 1
fi

echo "Updating [$PROFILE] in $CREDENTIALS_FILE..."

"$PYTHON_BIN" << 'PYEOF'
import re, os, shutil

creds_file = os.path.expanduser(os.environ["CREDENTIALS_FILE_NATIVE"])
profile = os.environ["PROFILE"]
key_id = os.environ["AWS_ACCESS_KEY_ID"]
secret = os.environ["AWS_SECRET_ACCESS_KEY"]
token = os.environ["AWS_SESSION_TOKEN"]

new_block = (
    f"[{profile}]\n"
    f"aws_access_key_id = {key_id}\n"
    f"aws_secret_access_key = {secret}\n"
    f"aws_session_token = {token}\n"
)

if os.path.exists(creds_file):
    with open(creds_file, 'r') as f:
        content = f.read()
else:
    content = ""

# Match the profile section up to the next profile header or EOF
pattern = re.compile(
    rf'^\[{re.escape(profile)}\]\s*\n(?:(?!\[).+\n?)*',
    re.MULTILINE
)

if pattern.search(content):
    new_content = pattern.sub(new_block, content)
else:
    if content and not content.endswith("\n"):
        content += "\n"
    new_content = content + "\n" + new_block

# Backup and write
if os.path.exists(creds_file):
    shutil.copy2(creds_file, creds_file + ".bak")

with open(creds_file, 'w') as f:
    f.write(new_content)

PYEOF

echo "Done! [$PROFILE] credentials refreshed."
echo "   Backup saved to ${CREDENTIALS_FILE}.bak"
