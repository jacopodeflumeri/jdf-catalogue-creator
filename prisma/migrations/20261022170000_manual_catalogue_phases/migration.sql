ALTER TYPE "CatalogJobType" ADD VALUE IF NOT EXISTS 'CATALOG_INFO';
ALTER TYPE "CatalogJobType" ADD VALUE IF NOT EXISTS 'CORE_IMAGES';
ALTER TYPE "CatalogJobType" ADD VALUE IF NOT EXISTS 'COMPLETE_LOOK';

ALTER TABLE "catalog_generation_job"
  ADD COLUMN "source_job_id" INTEGER;

ALTER TABLE "catalog_generation_job"
  ADD CONSTRAINT "catalog_generation_job_source_job_id_fkey"
  FOREIGN KEY ("source_job_id") REFERENCES "catalog_generation_job"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "catalog_generation_job_source_job_id_idx"
  ON "catalog_generation_job"("source_job_id");
