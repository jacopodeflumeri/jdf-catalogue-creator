UPDATE "synthetic_catalog"
SET "config_json" = jsonb_set(
  "config_json",
  '{assortmentPlan}',
  '[
    {"departmentKey":"WOMEN","category":"dresses","subcategory":"midi dresses","productCount":5},
    {"departmentKey":"WOMEN","category":"coats","subcategory":"wool coats","productCount":5},
    {"departmentKey":"MEN","category":"shirts","subcategory":"poplin shirts","productCount":5},
    {"departmentKey":"MEN","category":"trousers","subcategory":"tailored trousers","productCount":5}
  ]'::jsonb,
  true
)
WHERE "slug" = 'premium-apparel'
  AND NOT ("config_json" ? 'assortmentPlan');

UPDATE "synthetic_catalog"
SET "config_json" = jsonb_set(
  "config_json",
  '{assortmentPlan}',
  '[
    {"departmentKey":"WOMEN","category":"dresses","subcategory":"mini dresses","productCount":5},
    {"departmentKey":"WOMEN","category":"denim","subcategory":"straight jeans","productCount":5},
    {"departmentKey":"MEN","category":"tops","subcategory":"t-shirts","productCount":5},
    {"departmentKey":"MEN","category":"outerwear","subcategory":"bomber jackets","productCount":5}
  ]'::jsonb,
  true
)
WHERE "slug" = 'fast-fashion'
  AND NOT ("config_json" ? 'assortmentPlan');

UPDATE "synthetic_catalog"
SET "config_json" = jsonb_set(
  "config_json",
  '{assortmentPlan}',
  '[
    {"departmentKey":"WOMEN","category":"eveningwear","subcategory":"column dresses","productCount":5},
    {"departmentKey":"WOMEN","category":"tailoring","subcategory":"single-breasted jackets","productCount":5},
    {"departmentKey":"MEN","category":"tailoring","subcategory":"tailored trousers","productCount":5},
    {"departmentKey":"MEN","category":"leather goods","subcategory":"small leather goods","productCount":5}
  ]'::jsonb,
  true
)
WHERE "slug" = 'luxury-fashion'
  AND NOT ("config_json" ? 'assortmentPlan');

UPDATE "synthetic_catalog"
SET "config_json" = jsonb_set(
  "config_json",
  '{assortmentPlan}',
  '[
    {"departmentKey":"WOMEN","category":"sports bras","subcategory":"medium-support bras","productCount":5},
    {"departmentKey":"WOMEN","category":"leggings","subcategory":"full-length leggings","productCount":5},
    {"departmentKey":"MEN","category":"training tops","subcategory":"performance t-shirts","productCount":5},
    {"departmentKey":"MEN","category":"jackets","subcategory":"running jackets","productCount":5}
  ]'::jsonb,
  true
)
WHERE "slug" = 'activewear'
  AND NOT ("config_json" ? 'assortmentPlan');
