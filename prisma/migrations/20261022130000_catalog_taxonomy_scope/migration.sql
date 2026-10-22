ALTER TABLE "synthetic_product"
  ALTER COLUMN "department" TYPE TEXT USING "department"::TEXT;

ALTER TABLE "catalog_generation_job"
  ADD COLUMN "scope_type" TEXT NOT NULL DEFAULT 'LEGACY',
  ADD COLUMN "scope_value" TEXT,
  ADD COLUMN "color_variant_count" INTEGER NOT NULL DEFAULT 1;