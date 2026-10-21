#!/bin/sh
set -e

# Construct DATABASE_URL from individual components if not already set
if [ -z "$DATABASE_URL" ] && [ -n "$DB_HOST" ] && [ -n "$DB_USER" ] && [ -n "$DB_PASSWORD" ]; then
    DB_PORT="${DB_PORT:-5432}"
    DB_NAME="${DB_NAME:-myapp}"

    # Construct the URL without sslmode — SSL is configured by the PrismaPg
    # adapter via the DB_SSL env var (see src/lib/prisma/client.ts). Adding
    # sslmode=require here causes "self-signed certificate in certificate chain"
    # errors because the pg driver's URL-level SSL conflicts with the adapter's
    # ssl: { rejectUnauthorized: false } needed for RDS certificates.
    export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

    echo "DATABASE_URL constructed from components"
fi

# Force bind address to 0.0.0.0 for Next.js standalone server.
# ECS Fargate injects HOSTNAME with the container's runtime hostname,
# which overrides the Dockerfile ENV and causes Next.js to fail with
# "getaddrinfo ENOTFOUND <ecs-hostname>".
export HOSTNAME="0.0.0.0"

# Internal CA trust: build a single NODE_EXTRA_CA_CERTS bundle (which ADDS to, not
# replaces, the default Mozilla roots — see src/modules/auth/config/nextauth.ts)
# from two sources:
#   1. The Mapp internal root CA vendored in the image (ca.internal.mapp.tools).
#      This one root signs every internal Mapp HTTPS service we call
#      (company-management-service, product-feed-service, internal Keycloak, ...),
#      so it is trusted unconditionally and needs no per-service config.
#   2. KEYCLOAK_CA_PEM — optional runtime chain for an internal Keycloak whose cert
#      is NOT under the internal root. A lone-space placeholder (written by
#      setup-ssm-params.sh) is treated as empty. It is APPENDED, never overwriting
#      the vendored root.
VENDORED_INTERNAL_CA=/usr/local/share/ca-certificates/ca.internal.mapp.tools.crt
CA_BUNDLE=/tmp/internal-ca-bundle.pem
: > "$CA_BUNDLE"
ca_loaded=""
if [ -f "$VENDORED_INTERNAL_CA" ]; then
    cat "$VENDORED_INTERNAL_CA" >> "$CA_BUNDLE"
    ca_loaded="ca.internal.mapp.tools"
fi
if [ -n "${KEYCLOAK_CA_PEM:-}" ] && [ "$KEYCLOAK_CA_PEM" != " " ]; then
    printf '%s\n' "$KEYCLOAK_CA_PEM" >> "$CA_BUNDLE"
    ca_loaded="${ca_loaded:+$ca_loaded, }KEYCLOAK_CA_PEM"
fi
if [ -s "$CA_BUNDLE" ]; then
    export NODE_EXTRA_CA_CERTS="$CA_BUNDLE"
    echo "Loaded internal CA(s) into NODE_EXTRA_CA_CERTS: $ca_loaded"
else
    rm -f "$CA_BUNDLE"
fi

# Execute the main command
exec "$@"
