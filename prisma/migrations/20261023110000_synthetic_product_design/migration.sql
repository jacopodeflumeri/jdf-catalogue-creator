-- Store deterministic design attributes on the canonical parent product.
-- Existing rows receive neutral defaults without changing generated assets.
ALTER TABLE "synthetic_product"
  ADD COLUMN "pattern_code" TEXT,
  ADD COLUMN "embellishment_codes" JSONB NOT NULL DEFAULT '[]'::jsonb;
