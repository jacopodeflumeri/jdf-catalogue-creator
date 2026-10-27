ALTER TYPE "CatalogJobType" ADD VALUE IF NOT EXISTS 'BULK_RENAME';
ALTER TYPE "CatalogTaskType" ADD VALUE IF NOT EXISTS 'PROPOSE_PRODUCT_NAMES';

CREATE TABLE IF NOT EXISTS "synthetic_rename_batch" (
  "id" SERIAL NOT NULL,
  "catalog_id" INTEGER NOT NULL,
  "job_id" INTEGER NOT NULL,
  "created_by_mapp_team_id" INTEGER,
  "instruction_snapshot" JSONB NOT NULL,
  "scope_snapshot" JSONB NOT NULL,
  "model" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'GENERATING',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "applied_at" TIMESTAMP(3),
  "applied_by_mapp_team_id" INTEGER,
  CONSTRAINT "synthetic_rename_batch_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "synthetic_rename_batch_job_id_key" ON "synthetic_rename_batch"("job_id");
CREATE INDEX IF NOT EXISTS "synthetic_rename_batch_catalog_id_created_at_idx" ON "synthetic_rename_batch"("catalog_id", "created_at");
DO $$ BEGIN
  ALTER TABLE "synthetic_rename_batch" ADD CONSTRAINT "synthetic_rename_batch_catalog_id_fkey" FOREIGN KEY ("catalog_id") REFERENCES "synthetic_catalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "synthetic_rename_batch" ADD CONSTRAINT "synthetic_rename_batch_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "catalog_generation_job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "synthetic_rename_batch" ADD CONSTRAINT "synthetic_rename_batch_created_by_mapp_team_id_fkey" FOREIGN KEY ("created_by_mapp_team_id") REFERENCES "mapp_team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "synthetic_rename_item" (
  "id" SERIAL NOT NULL,
  "batch_id" INTEGER NOT NULL,
  "product_id" INTEGER NOT NULL,
  "external_id" TEXT NOT NULL,
  "original_name" TEXT NOT NULL,
  "proposed_name" TEXT,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "error_message" TEXT,
  "applied_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "synthetic_rename_item_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "synthetic_rename_item_batch_id_product_id_key" ON "synthetic_rename_item"("batch_id", "product_id");
CREATE INDEX IF NOT EXISTS "synthetic_rename_item_batch_id_status_idx" ON "synthetic_rename_item"("batch_id", "status");
DO $$ BEGIN
  ALTER TABLE "synthetic_rename_item" ADD CONSTRAINT "synthetic_rename_item_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "synthetic_rename_batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "synthetic_rename_item" ADD CONSTRAINT "synthetic_rename_item_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "synthetic_product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
