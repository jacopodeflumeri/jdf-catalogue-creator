-- Server-side login session (fixes HTTP 431 for users with large Keycloak profiles).
--
-- Moves the profile-sized claims (roles, workspaces, LDAP groups) and the
-- Keycloak id_token out of the NextAuth session cookie. The cookie now carries
-- only this row's id. Purely additive: no existing table is touched, so the
-- running image is unaffected and the default deploy path is fine.
--
-- Written idempotently (IF NOT EXISTS) so a half-applied run can be retried.

-- CreateTable
CREATE TABLE IF NOT EXISTS "auth_session" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "roles" JSONB,
    "workspaces" JSONB,
    "mapp_ldap_groups" JSONB,
    "keycloak_id_token" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "auth_session_expires_at_idx" ON "auth_session"("expires_at");
