ALTER TABLE "synthetic_product"
  ADD COLUMN "archived_at" TIMESTAMP(3),
  ADD COLUMN "archived_by_mapp_team_id" INTEGER;

CREATE INDEX "synthetic_product_catalog_id_archived_at_idx"
  ON "synthetic_product"("catalog_id", "archived_at");
CREATE INDEX "synthetic_product_archived_by_mapp_team_id_idx"
  ON "synthetic_product"("archived_by_mapp_team_id");

ALTER TABLE "synthetic_product"
  ADD CONSTRAINT "synthetic_product_archived_by_mapp_team_id_fkey"
  FOREIGN KEY ("archived_by_mapp_team_id") REFERENCES "mapp_team"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
