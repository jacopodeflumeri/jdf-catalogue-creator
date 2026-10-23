-- Add the new optional pattern to already configured catalogues without
-- changing their percentages, other vocabulary, rules, or embellishments.
UPDATE "synthetic_catalog"
SET "config_json" = jsonb_set(
  "config_json",
  '{designMix,patterns}',
  ("config_json" #> '{designMix,patterns}') || '[{"code":"BRAND_LOGO_REPEAT","label":"Brand logo repeat"}]'::jsonb
)
WHERE jsonb_typeof("config_json" #> '{designMix,patterns}') = 'array'
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements("config_json" #> '{designMix,patterns}') AS items(value)
    WHERE value->>'code' = 'BRAND_LOGO_REPEAT'
  );
