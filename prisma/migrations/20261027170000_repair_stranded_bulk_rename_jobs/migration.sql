-- Repair bulk-rename jobs created before proposal tasks participated in job
-- terminal-state aggregation. Completed chunks remain completed; only jobs
-- with durable queued/running proposal work are reopened.
UPDATE "catalog_generation_job" AS job
SET
  "status" = 'RUNNING'::"CatalogJobStatus",
  "stage" = 'PRODUCTS'::"CatalogJobStage",
  "finished_at" = NULL,
  "updated_at" = NOW()
WHERE job."job_type" = 'BULK_RENAME'::"CatalogJobType"
  AND job."status" IN (
    'COMPLETED'::"CatalogJobStatus",
    'COMPLETED_WITH_ERRORS'::"CatalogJobStatus",
    'FAILED'::"CatalogJobStatus"
  )
  AND EXISTS (
    SELECT 1
    FROM "catalog_generation_task" AS task
    WHERE task."job_id" = job."id"
      AND task."task_type" = 'PROPOSE_PRODUCT_NAMES'::"CatalogTaskType"
      AND task."status" IN (
        'QUEUED'::"CatalogTaskStatus",
        'RUNNING'::"CatalogTaskStatus"
      )
  );
