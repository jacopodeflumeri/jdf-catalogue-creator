-- Admin audit log: who changed what, and when (read at /admin/audit-log).
--
-- Purely additive, so the default deploy path is fine. Written idempotently so a
-- half-applied run can be retried, and so it reconciles an app that already
-- created an "audit_log" table of its own before the template shipped one: the
-- table and indexes are left alone if present and only "actor_email" is added.

-- CreateTable
CREATE TABLE IF NOT EXISTS "audit_log" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mapp_user_id" INTEGER,
    "actor_email" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" INTEGER,
    "outcome" TEXT DEFAULT 'success',
    "message" TEXT,
    "data" JSONB,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- Pre-existing table from before the template shipped this model.
ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS "actor_email" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_log_entity_type_entity_id_idx" ON "audit_log"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_log_created_at_idx" ON "audit_log"("created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_log_mapp_user_id_idx" ON "audit_log"("mapp_user_id");

-- AddForeignKey (ADD CONSTRAINT has no IF NOT EXISTS)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'audit_log_mapp_user_id_fkey'
    ) THEN
        ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_mapp_user_id_fkey"
            FOREIGN KEY ("mapp_user_id") REFERENCES "mapp_team"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
