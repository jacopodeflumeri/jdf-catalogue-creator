.PHONY: help dev-initial-setup dev-check-prerequisites dev-install dev-deps-audit dev-deps-update dev-server dev-build dev-start dev-test dev-test-unit dev-test-db dev-test-db-ensure dev-test-db-setup dev-test-db-reset dev-lint dev-type-check dev-check-all dev-db-reset dev-db-reset-quick dev-db-seed dev-db-migrate dev-db-studio dev-db-generate dev-docker-build dev-docker-run dev-clean staging-first-deploy staging-deploy staging-deploy-maintenance prod-first-deploy prod-deploy prod-deploy-maintenance infra-bootstrap staging-infra-deploy prod-infra-deploy staging-infra-destroy ecr-destroy ecr-lifecycle-set ecr-lifecycle-show staging-infra-diff prod-infra-diff staging-ssm-setup prod-ssm-setup staging-ssm-list prod-ssm-list shared-ssm-setup staging-logs prod-logs staging-ecs-status prod-ecs-status staging-db-reset staging-db-migrate prod-db-migrate staging-db-seed prod-db-seed staging-monitoring-add staging-monitoring-remove prod-monitoring-add prod-monitoring-remove staging-entra-add staging-entra-remove prod-entra-add prod-entra-remove staging-keycloak-ca-update prod-keycloak-ca-update entra-redirects-list staging-dump-config-to-s3 prod-dump-config-to-s3 staging-restore-config-from-s3 staging-restore-config-from-s3-dry-run prod-restore-config-from-s3 prod-restore-config-from-s3-dry-run data-sync-list-dumps dev-pull-config-dump version-patch version-minor version-major version-show

# =============================================================================
# Configuration (run scripts/setup.sh to configure)
# =============================================================================
APP_NAME := $(shell node -p "require('./app.config.json').appName")
ECR_REPO := $(APP_NAME)
AWS_PROFILE ?= labs-power
AWS_REGION = eu-central-1

# Git Bash on Windows rewrites "/"-leading arguments to native programs into
# Windows paths (/ecs/x -> C:/Program Files/Git/ecs/x), breaking the SSM paths
# and log group names the recipes below pass to aws. Keep this list identical
# to the one in scripts/deploy/_config.sh (see the comment there).
UNAME_S := $(shell uname -s 2>/dev/null)
MSYS_ARG_EXCL := /$(APP_NAME)-;/labs;/mapp-labs;/ecs/;/aws/;/app/
ifneq (,$(filter MINGW% MSYS%,$(UNAME_S)))
ifeq (,$(findstring $(MSYS_ARG_EXCL),$(MSYS2_ARG_CONV_EXCL)))
export MSYS2_ARG_CONV_EXCL := $(MSYS_ARG_EXCL)$(if $(MSYS2_ARG_CONV_EXCL),;$(MSYS2_ARG_CONV_EXCL))
endif
endif

# Default target
help:
	@echo "Available commands:"
	@echo ""
	@echo "All commands follow the pattern: make <env>-<action>"
	@echo "Environments: dev, staging, prod"
	@echo ""
	@echo "Getting Started:"
	@echo "  make dev-check-prerequisites - Check required tools are installed"
	@echo "  make dev-initial-setup      - First-time setup (install, migrate, seed)"
	@echo ""
	@echo "Development:"
	@echo "  make dev-install          - Install dependencies"
	@echo "  make dev-server           - Start development server"
	@echo "  make dev-build            - Build production bundle"
	@echo "  make dev-start            - Start production server locally"
	@echo ""
	@echo "Development Database:"
	@echo "  make dev-db-reset         - Reset database and load all seeds"
	@echo "  make dev-db-reset-quick   - Reset database without seeding"
	@echo "  make dev-db-seed          - Run seed script (prisma/seed.ts)"
	@echo "  make dev-db-migrate       - Run database migrations"
	@echo "  make dev-db-studio        - Open Prisma Studio"
	@echo "  make dev-db-generate      - Generate Prisma client"
	@echo ""
	@echo "Development Testing:"
	@echo "  make dev-test             - Run all tests (creates test DB, migrates, unit + DB tests)"
	@echo "  make dev-test-unit        - Run unit tests only (no database required)"
	@echo "  make dev-test-db          - Run database-backed tests only (sequential)"
	@echo "  make dev-test-db-ensure   - Create test DB if needed and run migrations"
	@echo "  make dev-test-db-setup    - Alias for dev-test-db-ensure"
	@echo "  make dev-test-db-reset    - Reset test database schema (destructive)"
	@echo ""
	@echo "Development Code Quality:"
	@echo "  make dev-lint             - Run ESLint"
	@echo "  make dev-type-check       - Run TypeScript type checking"
	@echo "  make dev-check-all        - Run all checks (type-check + lint)"
	@echo ""
	@echo "Development Docker:"
	@echo "  make dev-docker-build     - Build Docker image locally"
	@echo "  make dev-docker-run       - Run application in Docker locally"
	@echo ""
	@echo "Development Dependencies:"
	@echo "  make dev-deps-audit       - Audit app + infra dependencies for advisories"
	@echo "  make dev-deps-update      - Refresh both lockfiles (run the checks after)"
	@echo ""
	@echo "Development Cleanup:"
	@echo "  make dev-clean            - Remove build artifacts and dependencies"
	@echo ""
	@echo "Staging:"
	@echo "  make staging-first-deploy  - First-time bootstrap (ECR, SSM, build, infra, migrate, seed)"
	@echo "  make staging-deploy        - Rolling deploy to staging (build, push, deploy, migrate)"
	@echo "  make staging-deploy-maintenance - Maintenance deploy (drains service to zero; for breaking migrations)"
	@echo "  make staging-db-reset      - Reset staging database (destructive)"
	@echo "  make staging-db-migrate    - Run migrations on staging"
	@echo "  make staging-db-seed       - Seed staging database"
	@echo "  make staging-infra-deploy  - Deploy staging infrastructure"
	@echo "  make staging-infra-destroy - Tear down staging infrastructure"
	@echo "  make staging-infra-diff    - Preview staging infrastructure changes"
	@echo "  make staging-ssm-setup     - Configure SSM parameters for staging"
	@echo "  make staging-ssm-list      - List all staging SSM parameters"
	@echo "  make staging-keycloak-ca-update - Fetch and store Keycloak CA bundle for staging"
	@echo "  make staging-entra-add     - (Legacy, KEYCLOAK_ENABLED=false only) Register staging redirect URI with Entra"
	@echo "  make staging-entra-remove  - (Legacy) Remove staging redirect URI from Entra"
	@echo "  make staging-logs          - Tail ECS logs for staging"
	@echo "  make staging-ecs-status    - Show ECS service status for staging"
	@echo ""
	@echo "Production:"
	@echo "  make prod-first-deploy  - First-time bootstrap (ECR, SSM, build, infra, migrate, seed)"
	@echo "  make prod-deploy        - Rolling deploy to production (build, push, deploy, migrate)"
	@echo "  make prod-deploy-maintenance - Maintenance deploy (drains service to zero; for breaking migrations)"
	@echo "  make prod-db-migrate    - Run migrations on production"
	@echo "  make prod-db-seed       - Seed production database"
	@echo "  make prod-infra-deploy  - Deploy production infrastructure"
	@echo "  make prod-infra-diff    - Preview production infrastructure changes"
	@echo "  make prod-ssm-setup     - Configure SSM parameters for production"
	@echo "  make prod-ssm-list      - List all production SSM parameters"
	@echo "  make prod-keycloak-ca-update - Fetch and store Keycloak CA bundle for production"
	@echo "  make prod-entra-add     - (Legacy, KEYCLOAK_ENABLED=false only) Register production redirect URI with Entra"
	@echo "  make prod-entra-remove  - (Legacy) Remove production redirect URI from Entra"
	@echo "  make prod-logs          - Tail ECS logs for production"
	@echo "  make prod-ecs-status    - Show ECS service status for production"
	@echo ""
	@echo "Entra (Azure AD) direct login - LEGACY, not needed when Keycloak is enabled (the default):"
	@echo "  make shared-ssm-setup     - One-time: store Graph API credentials in shared SSM"
	@echo "  make entra-redirects-list - List every redirect URI on the shared Entra app"
	@echo ""
	@echo "Data Sync (optional capability - see docs/template/capabilities/DATA_SYNC.md):"
	@echo "  make staging-dump-config-to-s3            - Snapshot staging config to S3"
	@echo "  make prod-dump-config-to-s3               - Snapshot production config to S3"
	@echo "  make staging-restore-config-from-s3       - Wipe staging config + restore from latest prod dump"
	@echo "  make staging-restore-config-from-s3-dry-run - Preview the restore (no DB writes)"
	@echo "  make prod-restore-config-from-s3          - Wipe prod config + restore from latest staging dump"
	@echo "  make prod-restore-config-from-s3-dry-run  - Preview the restore (no DB writes)"
	@echo "  make data-sync-list-dumps                 - List config dumps in S3 for this app"
	@echo "  make dev-pull-config-dump                 - Download latest prod dump to tmp/ on your laptop"
	@echo ""
	@echo "Versioning:"
	@echo "  make version-show     - Show current version"
	@echo "  make version-patch    - Bump patch version (1.0.0 -> 1.0.1)"
	@echo "  make version-minor    - Bump minor version (1.0.0 -> 1.1.0)"
	@echo "  make version-major    - Bump major version (1.0.0 -> 2.0.0)"
	@echo ""
	@echo "Monitoring:"
	@echo "  make staging-monitoring-add     - Register staging health check in Icinga"
	@echo "  make staging-monitoring-remove  - Remove staging health check from Icinga"
	@echo "  make prod-monitoring-add        - Register production health check in Icinga"
	@echo "  make prod-monitoring-remove     - Remove production health check from Icinga"
	@echo ""
	@echo "Infrastructure:"
	@echo "  make infra-bootstrap    - Bootstrap CDK (one-time setup)"
	@echo "  make ecr-lifecycle-set  - Apply/refresh the ECR lifecycle policy (idempotent)"
	@echo "  make ecr-lifecycle-show - Preview the ECR lifecycle policy (no changes)"
	@echo "  make ecr-destroy        - Delete shared ECR repo (after BOTH envs destroyed)"

# ============================================================================
# Getting Started
# ============================================================================

dev-check-prerequisites:
	@echo "Checking prerequisites..."
	@echo ""
	@PASS=true; \
	check_cmd() { \
		if command -v "$$1" >/dev/null 2>&1; then \
			printf "  ✓ %s\n" "$$1"; \
		elif [ "$$2" = "required" ]; then \
			printf "  ✗ %s (REQUIRED — %s)\n" "$$1" "$$3"; \
			PASS=false; \
		else \
			printf "  ! %s (optional — %s)\n" "$$1" "$$3"; \
		fi; \
	}; \
	check_cmd node required "https://nodejs.org/ (v22+)"; \
	if command -v node >/dev/null 2>&1; then \
		NODE_MAJOR=$$(node -p "process.versions.node.split('.')[0]"); \
		if [ "$$NODE_MAJOR" -lt 22 ]; then \
			printf "  ✗ node %s is too old (REQUIRED — v22+, see .nvmrc)\n" "$$(node -v)"; \
			PASS=false; \
		fi; \
	fi; \
	check_cmd npm required "included with node"; \
	check_cmd git required "https://git-scm.com/"; \
	check_cmd psql required "brew install postgresql or apt install postgresql-client"; \
	check_cmd createdb required "included with PostgreSQL client"; \
	check_cmd docker optional "https://docs.docker.com/get-docker/"; \
	check_cmd aws optional "https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"; \
	check_cmd session-manager-plugin optional "required for ECS Exec"; \
	check_cmd jq optional "required for deploy (Keycloak URI registration) — brew install jq / apt-get install jq / winget install jqlang.jq"; \
	check_cmd openssl optional "required for generating secrets"; \
	echo ""; \
	if [ "$$PASS" = "false" ]; then \
		echo "Some required tools are missing. Install them and try again."; \
		exit 1; \
	fi; \
	echo "All required tools are installed."

dev-initial-setup:
	@if node -p "require('./app.config.json').appName === 'myapp'" 2>/dev/null | grep -q 'true'; then \
		echo ""; \
		echo "*** Project has not been configured yet. ***"; \
		echo "Run: ./scripts/setup.sh"; \
		echo ""; \
		exit 1; \
	fi
	@if [ ! -f .env ]; then \
		echo ""; \
		echo "No .env file found. Creating from .env.example..."; \
		cp .env.example .env; \
		echo "Created .env from .env.example."; \
		echo ""; \
		echo "*** IMPORTANT: Edit .env with your database and auth credentials, then re-run: ***"; \
		echo ""; \
		echo "    make dev-initial-setup"; \
		echo ""; \
		exit 1; \
	fi
	@# Configure git hooks to prevent accidental pushes to template repo
	@git config core.hooksPath .githooks 2>/dev/null || true
	@echo ""
	@echo "=== Step 1/3: Installing dependencies ==="
	@$(MAKE) dev-install
	@echo ""
	@echo "=== Step 2/3: Running database migrations ==="
	@$(MAKE) dev-db-migrate
	@echo ""
	@echo "=== Step 3/3: Seeding database ==="
	@$(MAKE) dev-db-seed
	@echo ""
	@echo "============================================"
	@echo "  Dev environment setup complete!"
	@echo "  Run 'make dev-server' to start developing."
	@echo "============================================"

# ============================================================================
# Development
# ============================================================================

dev-install:
	npm install

# Lockfiles are committed, so the dependency tree only moves when someone moves
# it on purpose. These two targets are that "on purpose" — run them on a
# schedule (monthly is a reasonable default) rather than letting installs drift.
dev-deps-audit:
	@echo "==> Application dependencies"
	@npm audit || true
	@echo ""
	@echo "==> Infrastructure dependencies"
	@cd infra && npm audit || true
	@echo ""
	@echo "Note: aws-cdk-lib vendors its own brace-expansion, so that advisory"
	@echo "cannot be resolved without bumping the pinned CDK version."

dev-deps-update:
	npm update
	cd infra && npm update
	@echo ""
	@echo "Lockfiles refreshed. Now verify before committing them:"
	@echo "  make dev-check-all && make dev-test && make dev-docker-build"

dev-server:
	npm run dev

dev-build:
	npm run build

dev-start:
	npm run start

# ============================================================================
# Development Testing
# ============================================================================

TEST_DB_HOST     ?= localhost
TEST_DB_PORT     ?= 5432
TEST_DB_USER     ?= postgres
TEST_DB_PASSWORD ?= localdev
TEST_DB_NAME     ?= $(APP_NAME)_test
TEST_DB_URL      = postgresql://$(TEST_DB_USER):$(TEST_DB_PASSWORD)@$(TEST_DB_HOST):$(TEST_DB_PORT)/$(TEST_DB_NAME)

dev-test: dev-test-db-ensure dev-test-unit dev-test-db
	@echo ""
	@echo "All tests passed!"

dev-test-unit:
	@echo "Running unit tests..."
	@DB_SSL=false npx jest --testPathIgnorePatterns="\\.db\\.test\\."

dev-test-db:
	@echo "Running database-backed tests (sequential)..."
	@DATABASE_URL_TEST="$(TEST_DB_URL)" DATABASE_URL="$(TEST_DB_URL)" DB_SSL=false \
		npx jest --testPathPatterns="\\.db\\.test\\." --runInBand

dev-test-db-ensure:
	@echo "Ensuring test database exists..."
	@PGPASSWORD=$(TEST_DB_PASSWORD) psql -h $(TEST_DB_HOST) -p $(TEST_DB_PORT) -U $(TEST_DB_USER) -tc \
		"SELECT 1 FROM pg_database WHERE datname = '$(TEST_DB_NAME)'" | grep -q 1 \
		|| PGPASSWORD=$(TEST_DB_PASSWORD) createdb -h $(TEST_DB_HOST) -p $(TEST_DB_PORT) -U $(TEST_DB_USER) $(TEST_DB_NAME)
	@echo "Running migrations on test database..."
	@DATABASE_URL="$(TEST_DB_URL)" DB_SSL=false npx prisma migrate deploy 2>&1 | tail -3

dev-test-db-setup: dev-test-db-ensure

dev-test-db-reset:
	@echo "WARNING: This will drop ALL data in the test database!"
	@echo "Press Ctrl+C to cancel, or wait 3 seconds to continue..."
	@sleep 3
	@DATABASE_URL="$(TEST_DB_URL)" DB_SSL=false npx prisma db push --force-reset

# ============================================================================
# Development Code Quality
# ============================================================================

dev-lint:
	npm run lint

dev-type-check:
	npm run type-check

dev-check-all:
	npm run check-all

# ============================================================================
# Development Database
# ============================================================================

dev-db-reset:
	@echo "WARNING: This will drop ALL data in the database!"
	@echo "Press Ctrl+C to cancel, or wait 3 seconds to continue..."
	@sleep 3
	@echo ""
	@echo "Resetting database..."
	@bash -c ' \
		set -e; \
		echo "Step 1: Dropping and recreating schema..."; \
		npx prisma db push --force-reset 2>&1 || true; \
		echo ""; \
		echo "Step 2: Running migrations..."; \
		npx prisma migrate deploy 2>&1 || true; \
		echo ""; \
		echo "Step 3: Generating Prisma client..."; \
		npx prisma generate 2>&1 || true; \
		echo ""; \
		echo "Step 4: Seeding database..."; \
		npx prisma db seed 2>&1 || true; \
		echo ""; \
		echo "Database reset complete!"; \
	'

dev-db-reset-quick:
	@echo "Quick reset (dropping schema without seed)..."
	@bash -c ' \
		set -e; \
		npx prisma db push --force-reset 2>&1 || true; \
		npx prisma migrate deploy 2>&1 || true; \
		npx prisma generate 2>&1 || true; \
		echo "Database reset complete (no seed data)"; \
	'

dev-db-seed:
	@echo "Seeding database..."
	@npx prisma db seed
	@echo "Database seeding complete!"

dev-db-migrate:
	@echo "Running database migrations..."
	npx prisma migrate deploy
	@echo "Migrations complete!"

dev-db-studio:
	npx prisma studio

dev-db-generate:
	npx prisma generate

# ============================================================================
# Development Docker
# ============================================================================

dev-docker-build:
	@echo "Building Docker image..."
	docker build --platform linux/amd64 -t $(APP_NAME):local .
	@echo "Docker image built: $(APP_NAME):local"

dev-docker-run:
	@echo "Running Docker container locally..."
	@echo "Note: You need to provide environment variables via .env file or -e flags"
	docker run --rm -p 3000:3000 --env-file .env $(APP_NAME):local

# ============================================================================
# Development Cleanup
# ============================================================================

dev-clean:
	rm -rf node_modules
	rm -rf .next
	rm -rf dist
	rm -rf coverage
	rm -rf src/generated
	rm -rf infra/node_modules
	rm -rf infra/dist
	@echo "Cleaned build artifacts and dependencies"

# ============================================================================
# Staging
# ============================================================================

staging-first-deploy:
	@echo "Running first-time staging bootstrap..."
	APP_NAME=$(APP_NAME) ECR_REPO=$(ECR_REPO) AWS_PROFILE=$(AWS_PROFILE) ./scripts/deploy/first-deploy.sh staging

staging-deploy:
	@echo "Deploying to staging..."
	APP_NAME=$(APP_NAME) ECR_REPO=$(ECR_REPO) AWS_PROFILE=$(AWS_PROFILE) ./scripts/deploy/full-deploy.sh staging

# Opt-in path for a migration the outgoing image cannot survive (rename/drop).
# Takes real downtime — see docs/template/DEPLOYMENT.md.
staging-deploy-maintenance:
	@echo "Maintenance deploy to staging (service drains to zero)..."
	APP_NAME=$(APP_NAME) ECR_REPO=$(ECR_REPO) AWS_PROFILE=$(AWS_PROFILE) ./scripts/deploy/maintenance-deploy.sh staging

staging-db-reset:
	@echo "WARNING: This will drop ALL data in the staging database!"
	@echo "Press Ctrl+C to cancel, or wait 5 seconds to continue..."
	@sleep 5
	@echo ""
	@echo "Resetting staging database..."
	@CLUSTER_NAME=$(APP_NAME)-stg; \
	SERVICE_NAME=$(APP_NAME)-stg; \
	TASK_ARN=$$(aws ecs list-tasks \
		--cluster $$CLUSTER_NAME \
		--service-name $$SERVICE_NAME \
		--desired-status RUNNING \
		--region $(AWS_REGION) \
		--profile $(AWS_PROFILE) \
		--query 'taskArns[0]' \
		--output text); \
	if [ "$$TASK_ARN" = "None" ] || [ -z "$$TASK_ARN" ]; then \
		echo "Error: No running tasks found"; \
		exit 1; \
	fi; \
	echo "Task: $$TASK_ARN"; \
	echo ""; \
	echo "Step 1: Dropping and recreating schema..."; \
	aws ecs execute-command \
		--cluster $$CLUSTER_NAME \
		--task $$TASK_ARN \
		--container App \
		--interactive \
		--command "sh -c 'export DATABASE_URL=\"postgresql://\$${DB_USER}:\$${DB_PASSWORD}@\$${DB_HOST}:\$${DB_PORT}/\$${DB_NAME}\" && npx prisma migrate reset --force'" \
		--region $(AWS_REGION) \
		--profile $(AWS_PROFILE); \
	echo ""; \
	echo "Staging database reset complete!"

staging-db-migrate:
	@echo "Running migrations on staging..."
	APP_NAME=$(APP_NAME) AWS_PROFILE=$(AWS_PROFILE) ./scripts/deploy/run-migration.sh staging

staging-db-seed:
	@echo "Seeding staging database..."
	APP_NAME=$(APP_NAME) AWS_PROFILE=$(AWS_PROFILE) ./scripts/deploy/run-seed.sh staging

staging-infra-deploy:
	@echo "Deploying staging infrastructure..."
	AWS_PROFILE=$(AWS_PROFILE) ./scripts/deploy/deploy-infra.sh staging
	@echo ""
	@echo "Registering Entra redirect URI (legacy direct-Entra login only; skipped when Keycloak is enabled)..."
	@ENTRA_SKIP_IF_KEYCLOAK=true AWS_PROFILE=$(AWS_PROFILE) ./scripts/deploy/entra-redirect-uri.sh add staging || echo "WARNING: Entra redirect URI registration failed (non-fatal). Run 'make staging-entra-add' manually."
	@echo ""
	@echo "Registering Icinga monitoring..."
	@./scripts/deploy/icinga-monitoring.sh add staging || echo "WARNING: Icinga registration failed (non-fatal). Run 'make staging-monitoring-add' manually."

staging-infra-destroy:
	@echo "Destroying staging infrastructure..."
	@echo "WARNING: This will destroy ALL staging resources!"
	@echo "Press Ctrl+C to cancel, or wait 5 seconds to continue..."
	@sleep 5
	@echo ""
	@echo "=== Step 1/5: Removing Entra redirect URI ==="
	@AWS_PROFILE=$(AWS_PROFILE) ./scripts/deploy/entra-redirect-uri.sh remove staging || echo "WARNING: Entra redirect URI removal failed (non-fatal). Run 'make staging-entra-remove' manually."
	@echo ""
	@echo "=== Step 2/5: Removing Icinga monitoring ==="
	@./scripts/deploy/icinga-monitoring.sh remove staging || echo "WARNING: Icinga removal failed (non-fatal). Remove manually from Icinga."
	@echo ""
	@echo "=== Step 3/5: Destroying CDK stack ==="
	cd infra && AWS_PROFILE=$(AWS_PROFILE) npx cdk destroy -c env=staging --force
	@echo ""
	@echo "=== Step 4/5: Deleting SSM parameters ==="
	@SSM_PATH="/$(APP_NAME)-stg/"; \
	PARAMS=$$(aws ssm get-parameters-by-path \
		--path "$$SSM_PATH" \
		--region $(AWS_REGION) \
		--profile $(AWS_PROFILE) \
		--query 'Parameters[*].Name' \
		--output text 2>/dev/null); \
	if [ -z "$$PARAMS" ]; then \
		echo "No SSM parameters found under $$SSM_PATH"; \
	else \
		for PARAM in $$PARAMS; do \
			echo "Deleting SSM parameter: $$PARAM"; \
			aws ssm delete-parameter \
				--name "$$PARAM" \
				--region $(AWS_REGION) \
				--profile $(AWS_PROFILE); \
		done; \
		echo "All SSM parameters deleted."; \
	fi
	@echo ""
	@echo "=== Step 5/5: Cleaning up orphaned ACM validation CNAME records ==="
	@DOMAIN="stg-$(APP_NAME).labs.mapp.com"; \
	ZONE_ID="Z03706141H2K96TGWE8I9"; \
	echo "Looking for ACM validation CNAMEs matching _*.$$DOMAIN ..."; \
	RECORDS=$$(aws route53 list-resource-record-sets \
		--hosted-zone-id "$$ZONE_ID" \
		--profile $(AWS_PROFILE) \
		--query "ResourceRecordSets[?Type=='CNAME' && starts_with(Name, '_') && contains(Name, '$$DOMAIN')]" \
		--output json 2>/dev/null); \
	if [ "$$RECORDS" = "[]" ] || [ -z "$$RECORDS" ]; then \
		echo "No orphaned ACM validation CNAME records found."; \
	else \
		echo "$$RECORDS" | python3 -c " \
import sys, json; \
records = json.load(sys.stdin); \
changes = [{'Action': 'DELETE', 'ResourceRecordSet': r} for r in records]; \
batch = {'Changes': changes}; \
print(json.dumps(batch))" > /tmp/r53-cleanup-batch.json; \
		echo "Deleting $$(echo "$$RECORDS" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))") CNAME record(s)..."; \
		aws route53 change-resource-record-sets \
			--hosted-zone-id "$$ZONE_ID" \
			--change-batch file:///tmp/r53-cleanup-batch.json \
			--profile $(AWS_PROFILE); \
		rm -f /tmp/r53-cleanup-batch.json; \
		echo "ACM validation CNAME records deleted."; \
	fi
	@echo ""
	@echo "============================================"
	@echo "  Staging infrastructure destroyed."
	@echo "  ECR repo '$(APP_NAME)' is shared and was NOT deleted."
	@echo "  Run 'make ecr-destroy' to remove it (after both envs are destroyed)."
	@echo "============================================"

staging-infra-diff:
	@echo "Showing staging infrastructure diff..."
	AWS_PROFILE=$(AWS_PROFILE) ./scripts/deploy/deploy-infra.sh staging --diff

staging-ssm-setup:
	@echo "Setting up SSM parameters for staging..."
	APP_NAME=$(APP_NAME) AWS_PROFILE=$(AWS_PROFILE) ./scripts/deploy/setup-ssm-params.sh staging

staging-ssm-list:
	@echo "Listing staging SSM parameters..."
	aws ssm get-parameters-by-path --path /$(APP_NAME)-stg/ --region $(AWS_REGION) --profile $(AWS_PROFILE) --query 'Parameters[*].{Name:Name,Type:Type}' --output table

staging-keycloak-ca-update:
	@echo "Fetching and storing staging Keycloak CA bundle..."
	APP_NAME=$(APP_NAME) AWS_PROFILE=$(AWS_PROFILE) ./scripts/deploy/update-keycloak-ca.sh staging

staging-logs:
	@echo "Tailing staging logs (app + task state changes)..."
	@aws logs tail /ecs/$(APP_NAME)-stg --follow --profile $(AWS_PROFILE) --region $(AWS_REGION) & \
	aws logs tail /ecs/$(APP_NAME)-stg/task-state-changes --follow --profile $(AWS_PROFILE) --region $(AWS_REGION) & \
	wait

staging-ecs-status:
	@echo "Staging ECS status:"
	aws ecs describe-services --cluster $(APP_NAME)-stg --services $(APP_NAME)-stg --profile $(AWS_PROFILE) --region $(AWS_REGION) \
		--query 'services[0].{Status:status,Running:runningCount,Desired:desiredCount,Pending:pendingCount}' --output table

# ============================================================================
# Production
# ============================================================================

prod-first-deploy:
	@echo "Running first-time production bootstrap..."
	APP_NAME=$(APP_NAME) ECR_REPO=$(ECR_REPO) AWS_PROFILE=$(AWS_PROFILE) ./scripts/deploy/first-deploy.sh production

prod-deploy:
	@echo "Deploying to production..."
	@echo "WARNING: You are about to deploy to PRODUCTION!"
	@echo "Press Ctrl+C to cancel, or wait 5 seconds to continue..."
	@sleep 5
	APP_NAME=$(APP_NAME) ECR_REPO=$(ECR_REPO) AWS_PROFILE=$(AWS_PROFILE) ./scripts/deploy/full-deploy.sh production

# Opt-in path for a migration the outgoing image cannot survive (rename/drop).
# Takes real downtime — see docs/template/DEPLOYMENT.md.
prod-deploy-maintenance:
	@echo "Maintenance deploy to production (service drains to zero)..."
	@echo "WARNING: This takes PRODUCTION OFFLINE for the length of the migration!"
	@echo "Press Ctrl+C to cancel, or wait 5 seconds to continue..."
	@sleep 5
	APP_NAME=$(APP_NAME) ECR_REPO=$(ECR_REPO) AWS_PROFILE=$(AWS_PROFILE) ./scripts/deploy/maintenance-deploy.sh production

prod-db-migrate:
	@echo "Running migrations on production..."
	@echo "WARNING: You are about to run migrations on PRODUCTION!"
	@echo "Press Ctrl+C to cancel, or wait 5 seconds to continue..."
	@sleep 5
	APP_NAME=$(APP_NAME) AWS_PROFILE=$(AWS_PROFILE) ./scripts/deploy/run-migration.sh production

prod-db-seed:
	@echo "Seeding production database..."
	@echo "WARNING: You are about to seed PRODUCTION database!"
	@echo "Press Ctrl+C to cancel, or wait 5 seconds to continue..."
	@sleep 5
	APP_NAME=$(APP_NAME) AWS_PROFILE=$(AWS_PROFILE) ./scripts/deploy/run-seed.sh production

prod-keycloak-ca-update:
	@echo "Fetching and storing production Keycloak CA bundle..."
	@echo "WARNING: You are about to update the PRODUCTION Keycloak CA bundle!"
	@echo "Press Ctrl+C to cancel, or wait 5 seconds to continue..."
	@sleep 5
	APP_NAME=$(APP_NAME) AWS_PROFILE=$(AWS_PROFILE) ./scripts/deploy/update-keycloak-ca.sh production

prod-infra-deploy:
	@echo "Deploying production infrastructure..."
	@echo "WARNING: You are about to deploy PRODUCTION infrastructure!"
	@echo "Press Ctrl+C to cancel, or wait 5 seconds to continue..."
	@sleep 5
	AWS_PROFILE=$(AWS_PROFILE) ./scripts/deploy/deploy-infra.sh production
	@echo ""
	@echo "Registering Entra redirect URI (legacy direct-Entra login only; skipped when Keycloak is enabled)..."
	@ENTRA_SKIP_IF_KEYCLOAK=true AWS_PROFILE=$(AWS_PROFILE) ./scripts/deploy/entra-redirect-uri.sh add production || echo "WARNING: Entra redirect URI registration failed (non-fatal). Run 'make prod-entra-add' manually."
	@echo ""
	@echo "Registering Icinga monitoring..."
	@./scripts/deploy/icinga-monitoring.sh add production || echo "WARNING: Icinga registration failed (non-fatal). Run 'make prod-monitoring-add' manually."

prod-infra-diff:
	@echo "Showing production infrastructure diff..."
	AWS_PROFILE=$(AWS_PROFILE) ./scripts/deploy/deploy-infra.sh production --diff

prod-ssm-setup:
	@echo "Setting up SSM parameters for production..."
	APP_NAME=$(APP_NAME) AWS_PROFILE=$(AWS_PROFILE) ./scripts/deploy/setup-ssm-params.sh production

prod-ssm-list:
	@echo "Listing production SSM parameters..."
	aws ssm get-parameters-by-path --path /$(APP_NAME)-prod/ --region $(AWS_REGION) --profile $(AWS_PROFILE) --query 'Parameters[*].{Name:Name,Type:Type}' --output table

prod-logs:
	@echo "Tailing production logs (app + task state changes)..."
	@aws logs tail /ecs/$(APP_NAME)-prod --follow --profile $(AWS_PROFILE) --region $(AWS_REGION) & \
	aws logs tail /ecs/$(APP_NAME)-prod/task-state-changes --follow --profile $(AWS_PROFILE) --region $(AWS_REGION) & \
	wait

prod-ecs-status:
	@echo "Production ECS status:"
	aws ecs describe-services --cluster $(APP_NAME)-prod --services $(APP_NAME)-prod --profile $(AWS_PROFILE) --region $(AWS_REGION) \
		--query 'services[0].{Status:status,Running:runningCount,Desired:desiredCount,Pending:pendingCount}' --output table

# ============================================================================
# Infrastructure (Shared)
# ============================================================================

infra-bootstrap:
	@echo "Bootstrapping CDK..."
	cd infra && npm install && AWS_PROFILE=$(AWS_PROFILE) npx cdk bootstrap aws://936190502406/$(AWS_REGION)

ecr-lifecycle-set:
	@echo "Applying ECR lifecycle policy to '$(ECR_REPO)' (idempotent)..."
	APP_NAME=$(APP_NAME) ECR_REPO=$(ECR_REPO) AWS_PROFILE=$(AWS_PROFILE) ./scripts/deploy/set-ecr-lifecycle.sh

ecr-lifecycle-show:
	@echo "Previewing ECR lifecycle policy for '$(ECR_REPO)' (no changes made)..."
	APP_NAME=$(APP_NAME) ECR_REPO=$(ECR_REPO) AWS_PROFILE=$(AWS_PROFILE) ./scripts/deploy/set-ecr-lifecycle.sh --dry-run

ecr-destroy:
	@echo "WARNING: This will delete the ECR repository '$(ECR_REPO)' and ALL images in it!"
	@echo "Only do this after BOTH staging and production environments are destroyed."
	@echo "Press Ctrl+C to cancel, or wait 10 seconds to continue..."
	@sleep 10
	aws ecr delete-repository \
		--repository-name $(ECR_REPO) \
		--force \
		--region $(AWS_REGION) \
		--profile $(AWS_PROFILE)
	@echo "ECR repository '$(ECR_REPO)' deleted."

# ============================================================================
# Monitoring
# ============================================================================

staging-monitoring-add:
	@echo "Registering staging health check in Icinga..."
	./scripts/deploy/icinga-monitoring.sh add staging

staging-monitoring-remove:
	@echo "Removing staging health check from Icinga..."
	./scripts/deploy/icinga-monitoring.sh remove staging

prod-monitoring-add:
	@echo "Registering production health check in Icinga..."
	@echo "Press Ctrl+C to cancel, or wait 3 seconds to continue..."
	@sleep 3
	./scripts/deploy/icinga-monitoring.sh add production

prod-monitoring-remove:
	@echo "Removing production health check from Icinga..."
	@echo "Press Ctrl+C to cancel, or wait 3 seconds to continue..."
	@sleep 3
	./scripts/deploy/icinga-monitoring.sh remove production

# ============================================================================
# Entra (Azure AD) Redirect URI Management
# Redirect URIs are registered/removed automatically during infra-deploy and
# infra-destroy. Use these targets for manual recovery or inspection.
# ============================================================================

shared-ssm-setup:
	@echo "Setting up shared SSM parameters (Entra Graph API credentials)..."
	AWS_PROFILE=$(AWS_PROFILE) ./scripts/deploy/setup-shared-ssm-params.sh

entra-redirects-list:
	@AWS_PROFILE=$(AWS_PROFILE) ./scripts/deploy/entra-redirect-uri.sh list

staging-entra-add:
	@AWS_PROFILE=$(AWS_PROFILE) ./scripts/deploy/entra-redirect-uri.sh add staging

staging-entra-remove:
	@AWS_PROFILE=$(AWS_PROFILE) ./scripts/deploy/entra-redirect-uri.sh remove staging

prod-entra-add:
	@echo "Registering production Entra redirect URI..."
	@echo "Press Ctrl+C to cancel, or wait 3 seconds to continue..."
	@sleep 3
	@AWS_PROFILE=$(AWS_PROFILE) ./scripts/deploy/entra-redirect-uri.sh add production

prod-entra-remove:
	@echo "Removing production Entra redirect URI..."
	@echo "Press Ctrl+C to cancel, or wait 3 seconds to continue..."
	@sleep 3
	@AWS_PROFILE=$(AWS_PROFILE) ./scripts/deploy/entra-redirect-uri.sh remove production

# ============================================================================
# Data Sync (optional capability)
#
# Reads/writes the shared `mapp-labs-data-sync` S3 bucket. See
# docs/template/capabilities/DATA_SYNC.md for the full picture.
#
# REQUIRES:
#   - DataSyncIntegration construct instantiated in the CDK stack
#   - scripts/data-sync/{_shared,dump-config-to-s3,restore-config-from-s3}.ts
#     copied from their .example versions and the TODO blocks filled in
#   - scripts/deploy/run-{dump,restore}-config-from-s3.sh copied from
#     their .example versions (chmod +x)
#
# If your project doesn't use this capability, delete this entire block.
# ============================================================================

DATA_SYNC_BUCKET ?= mapp-labs-data-sync

staging-dump-config-to-s3:
	APP_NAME=$(APP_NAME) AWS_PROFILE=$(AWS_PROFILE) ./scripts/deploy/run-dump-config-to-s3.sh staging

prod-dump-config-to-s3:
	@echo "WARNING: You are about to read from PRODUCTION DB."
	@echo "Press Ctrl+C to cancel, or wait 5 seconds to continue..."
	@sleep 5
	APP_NAME=$(APP_NAME) AWS_PROFILE=$(AWS_PROFILE) ./scripts/deploy/run-dump-config-to-s3.sh production

staging-restore-config-from-s3-dry-run:
	APP_NAME=$(APP_NAME) AWS_PROFILE=$(AWS_PROFILE) ./scripts/deploy/run-restore-config-from-s3.sh staging --dry-run

staging-restore-config-from-s3:
	@echo "WARNING: This will WIPE the staging config tables and restore from"
	@echo "         the latest production dump in $(DATA_SYNC_BUCKET)."
	@echo "Press Ctrl+C to cancel, or wait 5 seconds to continue..."
	@sleep 5
	APP_NAME=$(APP_NAME) AWS_PROFILE=$(AWS_PROFILE) ./scripts/deploy/run-restore-config-from-s3.sh staging

prod-restore-config-from-s3-dry-run:
	APP_NAME=$(APP_NAME) AWS_PROFILE=$(AWS_PROFILE) ./scripts/deploy/run-restore-config-from-s3.sh production --source=staging --dry-run

prod-restore-config-from-s3:
	@echo "WARNING: This will WIPE the PRODUCTION config tables and restore from"
	@echo "         the latest staging dump in $(DATA_SYNC_BUCKET)."
	@echo "         This is rarely the right thing to do — usually you want it the other way."
	@echo "Press Ctrl+C to cancel, or wait 10 seconds to continue..."
	@sleep 10
	APP_NAME=$(APP_NAME) AWS_PROFILE=$(AWS_PROFILE) ./scripts/deploy/run-restore-config-from-s3.sh production --source=staging

# Lists config dumps across both source envs for this app.
data-sync-list-dumps:
	@echo "Dumps in s3://$(DATA_SYNC_BUCKET)/config/ for app=$(APP_NAME):"
	@aws s3 ls s3://$(DATA_SYNC_BUCKET)/config/prod/$(APP_NAME)/ --profile $(AWS_PROFILE) --region $(AWS_REGION) --recursive --human-readable 2>/dev/null | sort || echo "  (no prod dumps)"
	@aws s3 ls s3://$(DATA_SYNC_BUCKET)/config/staging/$(APP_NAME)/ --profile $(AWS_PROFILE) --region $(AWS_REGION) --recursive --human-readable 2>/dev/null | sort || echo "  (no staging dumps)"

# Downloads the latest prod config dump to tmp/ on your laptop.
dev-pull-config-dump:
	@mkdir -p tmp
	@LATEST=$$(aws s3api list-objects-v2 --bucket $(DATA_SYNC_BUCKET) \
		--prefix config/prod/$(APP_NAME)/ --profile $(AWS_PROFILE) --region $(AWS_REGION) \
		--query 'sort_by(Contents,&Key)[-1].Key' --output text); \
	if [ "$$LATEST" = "None" ] || [ -z "$$LATEST" ]; then \
		echo "No dumps found under s3://$(DATA_SYNC_BUCKET)/config/prod/$(APP_NAME)/"; \
		exit 1; \
	fi; \
	echo "Latest: $$LATEST"; \
	BASENAME=$$(basename "$$LATEST"); \
	aws s3 cp "s3://$(DATA_SYNC_BUCKET)/$$LATEST" "tmp/$$BASENAME" --profile $(AWS_PROFILE) --region $(AWS_REGION); \
	echo "Downloaded to tmp/$$BASENAME"

# ============================================================================
# Versioning
# ============================================================================

version-show:
	@echo "Current version: $$(node -p "require('./package.json').version")"

version-patch:
	npm version patch

version-minor:
	npm version minor

version-major:
	npm version major
