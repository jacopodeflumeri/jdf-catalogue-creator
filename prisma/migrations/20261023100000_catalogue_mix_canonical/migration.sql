-- Fold catalog-wide taxonomy into the canonical Catalogue Mix. Taxonomy-only
-- combinations remain visible as unassigned rows with zero generation quota.
WITH source_rows AS (
  SELECT
    catalog.id AS catalog_id,
    mix.ordinality,
    mix.value AS row_value,
    false AS is_taxonomy_only
  FROM synthetic_catalog AS catalog
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(catalog.config_json->'assortmentPlan', '[]'::jsonb))
    WITH ORDINALITY AS mix(value, ordinality)

  UNION ALL

  SELECT
    catalog.id AS catalog_id,
    1000000 + row_number() OVER (PARTITION BY catalog.id ORDER BY lower(category.key), lower(subcategory.value #>> '{}')) AS ordinality,
    jsonb_build_object(
      'departmentKey', NULL,
      'category', category.key,
      'subcategory', subcategory.value #>> '{}',
      'productCount', 0,
      'outfitSlot', NULL
    ) AS row_value,
    true AS is_taxonomy_only
  FROM synthetic_catalog AS catalog
  CROSS JOIN LATERAL jsonb_each(COALESCE(catalog.config_json->'subcategories', '{}'::jsonb)) AS category(key, value)
  CROSS JOIN LATERAL jsonb_array_elements(category.value) AS subcategory(value)
  WHERE NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(catalog.config_json->'assortmentPlan', '[]'::jsonb)) AS existing(value)
    WHERE lower(existing.value->>'category') = lower(category.key)
      AND lower(existing.value->>'subcategory') = lower(subcategory.value #>> '{}')
  )
), normalized AS (
  SELECT
    rows.catalog_id,
    rows.ordinality,
    rows.row_value || jsonb_build_object(
      'id', COALESCE(NULLIF(rows.row_value->>'id', ''), 'mix-' || substr(md5(rows.catalog_id::text || ':' || rows.ordinality::text || ':' || COALESCE(rows.row_value->>'departmentKey', '') || ':' || lower(rows.row_value->>'category') || ':' || lower(rows.row_value->>'subcategory')), 1, 20)),
      'departmentKey', CASE WHEN rows.is_taxonomy_only THEN NULL ELSE rows.row_value->'departmentKey' END,
      'productCount', CASE
        WHEN rows.is_taxonomy_only THEN to_jsonb(0)
        ELSE COALESCE(rows.row_value->'productCount', to_jsonb(0))
      END,
      'outfitSlot', CASE WHEN rows.is_taxonomy_only THEN NULL ELSE COALESCE(rows.row_value->'outfitSlot', 'null'::jsonb) END
    ) AS row_value
  FROM source_rows AS rows
), canonical AS (
  SELECT catalog_id, jsonb_agg(row_value ORDER BY ordinality) AS assortment_plan
  FROM normalized
  GROUP BY catalog_id
)
UPDATE synthetic_catalog AS catalog
SET config_json = (catalog.config_json - 'categories' - 'subcategories') || jsonb_build_object(
  'assortmentPlan', COALESCE(canonical.assortment_plan, '[]'::jsonb)
)
FROM canonical
WHERE catalog.id = canonical.catalog_id;

-- Configurations with an empty taxonomy still lose the old duplicated keys.
UPDATE synthetic_catalog
SET config_json = (config_json - 'categories' - 'subcategories') || jsonb_build_object(
  'assortmentPlan', COALESCE(config_json->'assortmentPlan', '[]'::jsonb)
)
WHERE config_json ? 'categories' OR config_json ? 'subcategories';
