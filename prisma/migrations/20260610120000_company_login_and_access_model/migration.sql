-- Keycloak Company Login + access-model backport.
--
-- Adds the CompanyUser table (durable Mapp Cloud customer identities for
-- usage/spend attribution), removes the pending/approval access model (new
-- default is active; first user -> admin in app code), and adds the per-request
-- auth lookup functional index.

-- CreateTable
CREATE TABLE "company_user" (
    "id" SERIAL NOT NULL,
    "mapp_user_id" TEXT NOT NULL,
    "company_id" INTEGER NOT NULL,
    "tenant_id" TEXT,
    "login_name" TEXT,
    "email" TEXT,
    "name" TEXT,
    "account_id" INTEGER,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_user_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_user_mapp_user_id_company_id_key" ON "company_user"("mapp_user_id", "company_id");

-- CreateIndex
CREATE INDEX "company_user_company_id_last_login_at_idx" ON "company_user"("company_id", "last_login_at");

-- CreateIndex
CREATE INDEX "company_user_account_id_idx" ON "company_user"("account_id");

-- AddForeignKey
ALTER TABLE "company_user" ADD CONSTRAINT "company_user_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Access model: drop the pending/approval workflow. New default is 'active'
-- (first Mapp user -> admin, everyone after -> viewer, enforced in app code).
-- Migrate any existing 'pending' rows to 'active'. 'suspended'/'denied' remain.
ALTER TABLE "mapp_team" ALTER COLUMN "access_status" SET DEFAULT 'active';
UPDATE "mapp_team" SET "access_status" = 'active' WHERE "access_status" = 'pending';

-- Per-request auth lookup. require-auth / the JWT callback look members up by
-- email; this functional index lets `lower(email) = lower($1)` use an index
-- instead of an ILIKE sequential scan.
--
-- ⚠️ DRIFT CAVEAT: Prisma's schema language can't express a functional index,
-- so this index is NOT represented in schema.prisma. `prisma migrate dev` /
-- `prisma db pull` therefore can't see it and a future `migrate dev` may try to
-- "fix drift" by DROPPING it. Keep this migration, and do NOT accept a generated
-- migration that drops "mapp_team_email_lower_idx". (Re-add it here if it ever
-- gets dropped.)
CREATE INDEX "mapp_team_email_lower_idx" ON "mapp_team" (lower("email"));
