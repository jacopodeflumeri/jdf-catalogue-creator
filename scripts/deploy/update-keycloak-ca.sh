#!/bin/bash
set -euo pipefail

# Fetch the presented TLS chain for the configured Keycloak issuer host
# and store the non-leaf CA/intermediate bundle in SSM as KEYCLOAK_CA_PEM.

ENV="${1:-staging}"
AWS_PROFILE="${AWS_PROFILE:-labs-power}"
AWS_REGION="eu-central-1"
source "$(dirname "$0")/_config.sh"
PREFIX="${APP_NAME}-${SHORT_ENV}"

echo "=========================================="
echo "Keycloak CA Bundle Update"
echo "=========================================="
echo "Environment: ${ENV}"
echo "Prefix:      /${PREFIX}/"
echo "=========================================="
echo ""

ISSUER=$(aws ssm get-parameter \
    --name "/${PREFIX}/KEYCLOAK_ISSUER" \
    --with-decryption \
    --region "${AWS_REGION}" \
    --profile "${AWS_PROFILE}" \
    --query 'Parameter.Value' \
    --output text)

if [ -z "${ISSUER}" ] || [ "${ISSUER}" = "None" ]; then
    echo "Error: /${PREFIX}/KEYCLOAK_ISSUER is not set"
    exit 1
fi

HOST=$(run_python -c 'import sys; from urllib.parse import urlparse; print(urlparse(sys.argv[1]).hostname or "")' "${ISSUER}")

if [ -z "${HOST}" ]; then
    echo "Error: could not determine host from KEYCLOAK_ISSUER=${ISSUER}"
    exit 1
fi

echo "Issuer: ${ISSUER}"
echo "Host:   ${HOST}"
echo ""
echo "Fetching presented TLS chain..."

WORK_DIR=$(mktemp -d)
CHAIN_FILE="${WORK_DIR}/chain.pem"

openssl s_client -showcerts -connect "${HOST}:443" </dev/null 2>/dev/null \
    | sed -n '/BEGIN CERTIFICATE/,/END CERTIFICATE/p' > "${CHAIN_FILE}"

if [ ! -s "${CHAIN_FILE}" ]; then
    echo "Error: no certificates were returned by ${HOST}:443"
    rm -rf "${WORK_DIR}"
    exit 1
fi

awk '
    /BEGIN CERTIFICATE/ { in_cert=1; cert=cert $0 ORS; next }
    /END CERTIFICATE/   { cert=cert $0 ORS; print cert; cert=""; in_cert=0; next }
    in_cert             { cert=cert $0 ORS }
' "${CHAIN_FILE}" \
| awk -v dir="${WORK_DIR}" '
    BEGIN { n=0 }
    {
        print > (dir "/cert-" n ".pem")
        if ($0 ~ /END CERTIFICATE/) { close(dir "/cert-" n ".pem"); n++ }
    }
    END { print n > (dir "/count") }
'

CERT_COUNT=$(cat "${WORK_DIR}/count")

if [ "${CERT_COUNT}" -eq 0 ]; then
    echo "Error: failed to split the presented certificate chain"
    rm -rf "${WORK_DIR}"
    exit 1
fi

BUNDLE_FILE="${WORK_DIR}/keycloak-ca.pem"

append_issuer_chain() {
    local cert_file=$1
    local current_file="${cert_file}"
    local depth=0

    while [ "${depth}" -lt 5 ]; do
        local subject issuer aia_url issuer_file
        subject=$(openssl x509 -noout -subject -in "${current_file}" | sed 's/^subject=//')
        issuer=$(openssl x509 -noout -issuer -in "${current_file}" | sed 's/^issuer=//')

        if [ "${subject}" = "${issuer}" ]; then
            break
        fi

        aia_url=$(openssl x509 -in "${current_file}" -noout -text \
            | sed -n '/Authority Information Access/,+6p' \
            | sed -n 's/.*CA Issuers - URI:\(.*\)$/\1/p' \
            | head -n 1)

        if [ -z "${aia_url}" ]; then
            break
        fi

        issuer_file="${WORK_DIR}/issuer-${depth}.pem"
        curl -fsSL "${aia_url}" > "${issuer_file}"
        cat "${issuer_file}" >> "${BUNDLE_FILE}"
        current_file="${issuer_file}"
        depth=$((depth + 1))
    done
}

if [ "${CERT_COUNT}" -gt 1 ]; then
    i=1
    while [ "${i}" -lt "${CERT_COUNT}" ]; do
        cat "${WORK_DIR}/cert-${i}.pem" >> "${BUNDLE_FILE}"
        i=$((i + 1))
    done
    echo "Using ${CERT_COUNT}-certificate chain; storing non-leaf certificates only."
    append_issuer_chain "${WORK_DIR}/cert-1.pem"
else
    cat "${WORK_DIR}/cert-0.pem" > "${BUNDLE_FILE}"
    echo "Only one certificate was presented; storing it as the CA bundle."
    append_issuer_chain "${WORK_DIR}/cert-0.pem"
fi

echo ""
echo "Certificates selected for KEYCLOAK_CA_PEM:"
i=0
while [ "${i}" -lt "${CERT_COUNT}" ]; do
    cert_file="${WORK_DIR}/cert-${i}.pem"
    if [ "${CERT_COUNT}" -gt 1 ] && [ "${i}" -eq 0 ]; then
        i=$((i + 1))
        continue
    fi
    openssl x509 -noout -subject -issuer -dates -in "${cert_file}"
    echo ""
    i=$((i + 1))
done

aws ssm put-parameter \
    --name "/${PREFIX}/KEYCLOAK_CA_PEM" \
    --value "$(cat "${BUNDLE_FILE}")" \
    --type "SecureString" \
    --overwrite \
    --region "${AWS_REGION}" \
    --profile "${AWS_PROFILE}" \
    --description "PEM-encoded CA/intermediate bundle trusted for Keycloak TLS"

rm -rf "${WORK_DIR}"

echo ""
echo "Stored /${PREFIX}/KEYCLOAK_CA_PEM successfully."
