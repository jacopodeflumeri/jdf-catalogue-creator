# syntax=docker/dockerfile:1

# Multi-stage Dockerfile for Next.js application
# Optimized for production with minimal image size

# =============================================================================
# Stage 1: Full Dependencies
# =============================================================================
FROM node:22.23.4-bookworm-slim AS deps
WORKDIR /app
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV NPM_CONFIG_FUND=false
ENV NPM_CONFIG_AUDIT=false

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates wget && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./

# Install full dependency set for build, straight from the committed lockfile.
# `npm ci` (not `npm install`) so the image gets exactly the tree that was
# tested — it fails loudly if package.json and package-lock.json disagree
# instead of silently re-resolving.
RUN npm ci --ignore-scripts

# =============================================================================
# Stage 2: Production Dependencies
# =============================================================================
FROM deps AS prod-deps

# Prune dev dependencies from the already-installed tree
RUN npm prune --omit=dev

# =============================================================================
# Stage 3: Builder
# =============================================================================
FROM node:22.23.4-bookworm-slim AS builder
WORKDIR /app

# Build arguments for version info (passed from build-and-push.sh)
ARG APP_VERSION=dev
ARG BUILD_COMMIT=local
ARG APP_ENVIRONMENT=development

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the application
# Dummy env vars for build-time validation (real values injected at runtime)
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
ENV NEXTAUTH_SECRET="build-time-dummy-secret-not-used-in-production"
ENV NEXTAUTH_URL="https://build.example.com"
ENV AZURE_AD_CLIENT_ID="dummy-client-id"
ENV AZURE_AD_CLIENT_SECRET="dummy-client-secret"
ENV AZURE_AD_TENANT_ID="dummy-tenant-id"
ENV KEYCLOAK_ENABLED="false"
ENV KEYCLOAK_ISSUER="https://build.example.com/realms/labs"
ENV KEYCLOAK_REALM="labs"
ENV KEYCLOAK_CLIENT_ID="dummy-keycloak-client-id"
ENV KEYCLOAK_CLIENT_SECRET="dummy-keycloak-client-secret"
ENV S3_REGION="eu-central-1"
ENV S3_BUCKET_NAME="dummy-bucket"
# Version info baked into the build (NEXT_PUBLIC_ vars are inlined at build time)
ENV NEXT_PUBLIC_APP_VERSION=${APP_VERSION}
ENV NEXT_PUBLIC_BUILD_COMMIT=${BUILD_COMMIT}
ENV NEXT_PUBLIC_ENVIRONMENT=${APP_ENVIRONMENT}
RUN npx next build

# =============================================================================
# Stage 4: Production Runner
# =============================================================================
FROM node:22.23.4-bookworm-slim AS runner
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# ca-certificates + openssl let us trust the Mapp internal root CA (system store)
# and support the openssl-based Keycloak CA refresh script.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid 1001 nextjs

# Trust the Mapp internal root CA (ca.internal.mapp.tools). This single root signs
# every internal Mapp service we call over HTTPS (company-management-service,
# product-feed-service, internal Keycloak, ...). It is a public, non-secret root —
# vendored here rather than carried per-service in SSM. Installed into the system
# trust store for non-Node tooling; the entrypoint also feeds it to NODE_EXTRA_CA_CERTS.
# Source of truth: mapp-digital/devops-kube-ansible roles/ca_certs/files/ca.internal.mapp.tools.crt
COPY certs/ca.internal.mapp.tools.crt /usr/local/share/ca-certificates/ca.internal.mapp.tools.crt
RUN update-ca-certificates

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

# Copy Next.js build output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy production dependencies first (base layer)
COPY --from=prod-deps /app/node_modules ./node_modules

# Copy generated Prisma client (output lives in src/generated/prisma/)
COPY --from=builder /app/src/generated ./src/generated

# Copy Prisma config, schema, and migrations for runtime migrations/seeding
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# Copy source files needed for seeding (tsx runs TypeScript directly)
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Copy entrypoint script
COPY --chown=nextjs:nodejs scripts/docker-entrypoint.sh /app/docker-entrypoint.sh
# Strip CRLF defensively (a Windows checkout without the .gitattributes eol=lf
# rule makes the container exit 255 with an empty log) and set the executable
# bit (Windows checkouts don't carry it).
RUN sed -i 's/\r$//' /app/docker-entrypoint.sh && chmod +x /app/docker-entrypoint.sh

# Set correct permissions
USER nextjs

# Expose port
EXPOSE 3000

# Start the application
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]
