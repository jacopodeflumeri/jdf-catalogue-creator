CREATE INDEX "catalog_generation_job_finished_at_status_idx"
ON "catalog_generation_job"("finished_at", "status");
