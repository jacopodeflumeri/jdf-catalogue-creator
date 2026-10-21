# Mapp Labs App Template

A production-ready template for building customer portals and admin dashboards. Built with Next.js 16, React 19, TypeScript, Prisma 7, and Tailwind CSS v4.

Deployed to AWS using ECS Fargate, RDS PostgreSQL, and ALB with HTTPS.

## Getting Started

See **[GETTING_STARTED.md](GETTING_STARTED.md)** for the full guide, including capability selection and an AI agent orientation prompt.

## Quick Start

**Prerequisites:** Node.js 22+ (see `.nvmrc`), npm, git, PostgreSQL client (`psql`, `createdb` — see [docs/template/LOCAL-POSTGRES.md](docs/template/LOCAL-POSTGRES.md)). On Windows, use Git Bash with `make` installed — see [docs/template/WINDOWS.md](docs/template/WINDOWS.md). Run `make dev-check-prerequisites` to verify.

**1. Create your GitHub repo:**

Go to [https://github.com/organizations/mapp-labs/repositories/new](https://github.com/organizations/mapp-labs/repositories/new) and create `labs-{your-app-name}`. Keep it private and **do not** initialize with a README or .gitignore.

**2. Clone the template:**

```bash
git clone git@github.com:mapp-digital/labs-app-template.git labs-{your-app-name}
cd labs-{your-app-name}
```

**3. Configure your project** (run once — sets app name, reinitializes git, sets remote):

```bash
./scripts/setup.sh
```

This prompts for your app name, display name, database name, team, and ownership, then:
- Updates all configuration files automatically (stored in `app.config.json`)
- Reinitializes git with a clean history (removes template commit history)
- Sets your new git remote (paste the SSH URL from step 1)

**4. Create your local database and run first-time setup:**

```bash
createdb my-project          # use the database name you chose in setup
make dev-initial-setup       # installs deps, migrates, seeds
```

On the first run it will create `.env` from `.env.example` and ask you to fill in your database and auth credentials before re-running.

**5. Start developing:**

```bash
make dev-server
```

Open http://localhost:3000 for the customer portal and http://localhost:3000/admin for the admin dashboard.

**6. Push to your new repo:**

```bash
git push -u origin main
```

## Makefile Commands

All commands follow the pattern `make <env>-<action>`. Run `make help` to see the full list.

### Development

| Command | Description |
|---------|-------------|
| `make dev-initial-setup` | First-time setup (install, migrate, seed) |
| `make dev-install` | Install dependencies |
| `make dev-server` | Start development server |
| `make dev-build` | Build production bundle |
| `make dev-start` | Start production server locally |

### Development Database

| Command | Description |
|---------|-------------|
| `make dev-db-reset` | Reset database and load all seeds |
| `make dev-db-reset-quick` | Reset database without seeding |
| `make dev-db-seed` | Run seed script |
| `make dev-db-migrate` | Run database migrations |
| `make dev-db-studio` | Open Prisma Studio |
| `make dev-db-generate` | Generate Prisma client |

### Testing

| Command | Description |
|---------|-------------|
| `make dev-test` | Run all tests (creates test DB, migrates, unit + DB tests) |
| `make dev-test-unit` | Unit tests only (no database required) |
| `make dev-test-db` | Database-backed tests only (sequential) |
| `make dev-test-db-ensure` | Create test DB if needed and run migrations |

### Code Quality

| Command | Description |
|---------|-------------|
| `make dev-lint` | Run ESLint |
| `make dev-type-check` | Run TypeScript type checking |
| `make dev-check-all` | Run all checks (type-check + lint) |

### Staging & Production

| Command | Description |
|---------|-------------|
| `make staging-deploy` | Rolling deploy to staging (build, push, deploy, migrate) |
| `make prod-deploy` | Rolling deploy to production (with confirmation) |
| `make <env>-deploy-maintenance` | Maintenance deploy for breaking migrations — drains the service, **takes downtime** ([docs](docs/template/DEPLOYMENT.md#deploying-updates)) |
| `make staging-infra-deploy` | Deploy staging infrastructure |
| `make staging-db-migrate` | Run migrations on staging |
| `make staging-ssm-setup` | Configure SSM parameters for staging |

See `make help` for the complete list of staging and production commands.

### Versioning

```bash
make version-patch   # Bug fixes: 1.0.0 -> 1.0.1
make version-minor   # New features: 1.0.0 -> 1.1.0
make version-major   # Breaking changes: 1.0.0 -> 2.0.0
```

Bump the version before deploying. This updates `package.json`, creates a git commit, and tags it.

## Tech Stack

- **Framework:** Next.js 16 (App Router) with React 19
- **Language:** TypeScript 5+ (strict mode)
- **Database:** Prisma 7 ORM with PostgreSQL (`@prisma/adapter-pg` driver adapter)
- **Authentication:** NextAuth v4 behind Keycloak (Mapp Entra ID + Company Login)
- **Styling:** Tailwind CSS v4
- **File Storage:** AWS S3
- **Email:** Mapp Engage REST client (`src/modules/mapp_engage`)
- **Testing:** Jest + React Testing Library
- **Infrastructure:** AWS CDK (ECS Fargate, RDS, ALB, Route53, SSM)

## Features

### Authentication & Security
- Keycloak login with two entry points: **Mapp Entra ID** for Mapp employees (admins) and **Company Login** for Mapp Cloud customers
- Local dev-login bypass (`/auth/dev`) for working without AWS or Keycloak
- Optional, off by default: Magic Link customer login, and legacy direct Microsoft Entra login for apps not yet on Keycloak
- Role-based access control (customer, viewer, editor, admin, super admin)
- IP whitelisting for admin access
- Secure JWT session management

### Customer Portal
- Account dashboard (team overview for account users; a company landing page for Company Login customers)
- Get-started onboarding for customers who aren't eligible yet
- Account settings

### Admin Dashboard
- Settings hub (`/admin/settings`) for admin pages
- Mapp team access management (viewer / editor / admin)
- Company Users views (company-capable apps)
- Admin audit log (`/admin/audit-log`) — who changed what, and when
- S3 image and file storage

## Project Structure

```
├── prisma/                # Schema, migrations, seed script
├── prisma.config.ts       # Prisma CLI config (datasource URL, seed command)
├── src/
│   ├── app/              # Next.js App Router pages
│   │   ├── account/      # Customer portal routes
│   │   ├── admin/        # Admin dashboard routes
│   │   ├── api/          # API routes (including /api/health)
│   │   └── auth/         # Authentication pages
│   ├── components/       # React components (ui/, admin/, customer/, shared/)
│   ├── lib/             # Business logic (actions/, prisma/, utils/)
│   ├── modules/         # Feature modules (auth/, client_catalog/, upc/, public_api/, ...)
│   └── types/           # TypeScript type definitions
├── infra/               # AWS CDK infrastructure
│   ├── bin/infra.ts     # CDK app entry point
│   ├── lib/stack.ts     # Main CDK stack
│   └── lib/config/      # Environment configs (staging/production)
├── scripts/
│   ├── deploy/          # Deployment scripts
│   └── docker-entrypoint.sh  # Container entrypoint
└── docs/
    ├── README.md        # Index of this app's own docs (write feature docs here)
    ├── template/        # Reference shipped by the template (auth, deploy, capabilities, design system)
    └── retrofit/        # Prompts for catching up with newer template versions
```

## Database

### Prisma 7 Configuration

- Provider: `prisma-client` with `@prisma/adapter-pg` driver adapter
- Generated client output: `src/generated/prisma/` (gitignored, auto-generated on `npm install` via `postinstall`)
- Config file: `prisma.config.ts` at project root
- Schema: `prisma/schema.prisma`
- Migrations: `prisma/migrations/` (tracked in git)
- Seed: `prisma/seed.ts` (runs via `npx tsx prisma/seed.ts`)

### Schema Changes

```bash
# Edit prisma/schema.prisma, then:
npx prisma migrate dev --name your_migration_name
npx prisma generate   # Regenerate client
```

## Testing

Database tests use `*.db.test.ts` naming and run against a separate test database. The `make dev-test` target handles everything automatically.

```bash
make dev-test          # Full suite
make dev-test-unit     # Unit tests only
make dev-test-db       # DB tests only
```

See `src/lib/prisma/services/__tests__/user.db.test.ts` for an example database test.

## Customization

See **[docs/template/CUSTOMIZATION.md](docs/template/CUSTOMIZATION.md)** for guides on:

- Adding navigation sections and sidebar items
- Extending the role model and access control
- Handling static pages with client-side context

## Deployment

See **[docs/template/DEPLOYMENT.md](docs/template/DEPLOYMENT.md)** for the full guide. Forks created before 2026-05-04 should also review **[MIGRATION.md](MIGRATION.md)** for per-environment image tag migration steps.

Login (Keycloak: Mapp Entra ID + Company Login) is covered in
**[docs/template/KEYCLOAK.md](docs/template/KEYCLOAK.md)**. Older apps still on
direct Entra login migrate with the Keycloak prompts in
**[docs/retrofit/](docs/retrofit/README.md)**.

The deployment guide covers:

- AWS architecture (ECS Fargate, RDS, ALB, Route53)
- First-time infrastructure setup
- SSM parameter configuration
- Build, push, and deploy workflow
- Database migrations and seeding on remote environments
- Monitoring, logging, and troubleshooting
- Cost estimates

### Quick Deploy

```bash
# 1. Bump version
make version-patch

# 2. Deploy to staging
make staging-deploy

# 3. Deploy to production (with confirmation)
make prod-deploy
```

### First-Time AWS Setup

```bash
# Automated (recommended) — handles correct ordering automatically:
make staging-first-deploy

# Or manual step-by-step:
make staging-ssm-setup                        # Configure secrets
./scripts/deploy/build-and-push.sh staging    # Build & push image (BEFORE infra!)
make staging-infra-deploy                     # Deploy infrastructure
make staging-db-migrate                       # Run migrations
make staging-db-seed                          # Seed database
```

## AWS Credentials

All `staging-*` and `prod-*` commands require valid AWS credentials for the `labs-power` profile. See [docs/template/DEPLOYMENT.md](docs/template/DEPLOYMENT.md) for SSO setup instructions.

Refresh expired credentials:

```bash
./scripts/refresh-labs-aws-creds.sh
```
