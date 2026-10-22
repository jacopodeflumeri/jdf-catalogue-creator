ALTER TYPE "CatalogImageRole" ADD VALUE IF NOT EXISTS 'COMPLETE_LOOK';

CREATE TYPE "SyntheticCompleteLookStatus" AS ENUM ('PLANNED', 'QUEUED', 'GENERATING', 'READY', 'FAILED', 'SKIPPED', 'STALE');

ALTER TABLE "synthetic_style" ADD COLUMN "color_hex" TEXT;

CREATE TABLE "synthetic_complete_look" (
  "id" SERIAL NOT NULL,
  "anchor_style_id" INTEGER NOT NULL,
  "image_asset_id" INTEGER,
  "status" "SyntheticCompleteLookStatus" NOT NULL DEFAULT 'PLANNED',
  "selection_reason" TEXT,
  "scoring_snapshot" JSONB,
  "error_message" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "synthetic_complete_look_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "synthetic_complete_look_item" (
  "id" SERIAL NOT NULL,
  "complete_look_id" INTEGER NOT NULL,
  "companion_style_id" INTEGER NOT NULL,
  "outfit_slot" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL,
  "score_snapshot" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "synthetic_complete_look_item_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "synthetic_complete_look_anchor_style_id_key" ON "synthetic_complete_look"("anchor_style_id");
CREATE UNIQUE INDEX "synthetic_complete_look_image_asset_id_key" ON "synthetic_complete_look"("image_asset_id");
CREATE INDEX "synthetic_complete_look_status_idx" ON "synthetic_complete_look"("status");
CREATE UNIQUE INDEX "synthetic_complete_look_item_complete_look_id_companion_style_id_key" ON "synthetic_complete_look_item"("complete_look_id", "companion_style_id");
CREATE UNIQUE INDEX "synthetic_complete_look_item_complete_look_id_sort_order_key" ON "synthetic_complete_look_item"("complete_look_id", "sort_order");
CREATE INDEX "synthetic_complete_look_item_companion_style_id_idx" ON "synthetic_complete_look_item"("companion_style_id");

ALTER TABLE "synthetic_complete_look" ADD CONSTRAINT "synthetic_complete_look_anchor_style_id_fkey" FOREIGN KEY ("anchor_style_id") REFERENCES "synthetic_style"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "synthetic_complete_look" ADD CONSTRAINT "synthetic_complete_look_image_asset_id_fkey" FOREIGN KEY ("image_asset_id") REFERENCES "synthetic_image_asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "synthetic_complete_look_item" ADD CONSTRAINT "synthetic_complete_look_item_complete_look_id_fkey" FOREIGN KEY ("complete_look_id") REFERENCES "synthetic_complete_look"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "synthetic_complete_look_item" ADD CONSTRAINT "synthetic_complete_look_item_companion_style_id_fkey" FOREIGN KEY ("companion_style_id") REFERENCES "synthetic_style"("id") ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE "synthetic_style" style
SET "color_hex" = COALESCE((
  SELECT color->>'hex'
  FROM jsonb_array_elements(catalog.config_json->'colors') color
  WHERE color->>'code' = style.color_code
  LIMIT 1
), '#808080')
FROM "synthetic_product" product
JOIN "synthetic_catalog" catalog ON catalog.id = product.catalog_id
WHERE product.id = style.product_id;

-- Existing mix rows get a one-time, explicit legacy slot assignment. Unknown
-- historical custom rows are conservatively assigned ACCESSORY; editors can
-- choose a more accurate slot in Settings. New custom rows require a selection.
UPDATE "synthetic_catalog" catalog
SET "config_json" = jsonb_set(
  catalog.config_json,
  '{assortmentPlan}',
  COALESCE((
    SELECT jsonb_agg(row || jsonb_build_object('outfitSlot', CASE
      WHEN lower(row->>'category') IN ('dresses', 'eveningwear') THEN 'ONE_PIECE'
      WHEN lower(row->>'category') IN ('shirts', 'knitwear', 'tops', 'training tops', 'sports bras') THEN 'TOP'
      WHEN lower(row->>'category') IN ('trousers', 'denim', 'leggings', 'shorts') THEN 'BOTTOM'
      WHEN lower(row->>'category') IN ('coats', 'jackets', 'outerwear') THEN 'OUTERWEAR'
      WHEN lower(row->>'category') IN ('leather goods', 'bags', 'handbags') THEN 'BAG'
      ELSE 'ACCESSORY' END))
    FROM jsonb_array_elements(catalog.config_json->'assortmentPlan') row
  ), '[]'::jsonb), false)
WHERE catalog.config_json ? 'assortmentPlan';
