import type { CatalogGenerationTask } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma/client";
import logger from "@/lib/utils/logger";
import { setTimeout as sleep } from "node:timers/promises";
import type { CatalogImageGenerator } from "../providers/image-generator";
import { isRetryableProductGenerationError } from "../providers/litellm-product-generator";
import type { ProductGenerator } from "../providers/product-generator";
import type { GeneratedAssetStorage } from "../storage/generated-asset-storage";
import {
  processProductGenerationTask,
  refreshGenerationJobState,
} from "./generation-jobs";
import { generateStyleImage } from "./image-assets";
import { isCatalogWorkerSchemaMissing } from "./worker-readiness";
import { assertCatalogJobActive, CatalogJobCancelledError } from "./job-cancellation";
import { REQUIRED_CORE_IMAGE_ROLES } from "../providers/image-generator";

export const DEFAULT_WORKER_POLL_MS = 2_000;
export const DEFAULT_WORKER_LEASE_MS = 30 * 60 * 1_000;
export const DEFAULT_WORKER_RETRY_DELAY_MS = 5_000;
export const DEFAULT_WORKER_RECOVERY_INTERVAL_MS = 60_000;
export const DEFAULT_WORKER_SCHEMA_RETRY_MS = 5_000;

export interface CatalogWorkerDependencies {
  productGenerator: ProductGenerator;
  imageGenerator: CatalogImageGenerator;
  storage: GeneratedAssetStorage;
}

export interface CatalogWorkerOptions {
  workerId: string;
  pollIntervalMs?: number;
  leaseMs?: number;
  retryDelayMs?: number;
  recoveryIntervalMs?: number;
  schemaRetryMs?: number;
}

function errorMessage(error: unknown): string {
  return (error instanceof Error ? error.message : "Unknown catalog worker error").slice(0, 2_000);
}

export function isRetryableCatalogWorkerError(error: unknown): boolean {
  if (isRetryableProductGenerationError(error)) return true;
  if (!error || typeof error !== "object") return false;
  const metadata = "$metadata" in error ? error.$metadata : undefined;
  const status =
    metadata && typeof metadata === "object" && "httpStatusCode" in metadata
      ? Number(metadata.httpStatusCode)
      : undefined;
  return status === 429 || (status != null && status >= 500 && status <= 599);
}

export async function claimNextCatalogTask(workerId: string): Promise<CatalogGenerationTask | null> {
  const claimed = await prisma.$queryRaw<Array<{ id: number }>>`
    WITH candidate AS (
      SELECT task.id
      FROM catalog_generation_task AS task
      JOIN catalog_generation_job AS job ON job.id = task.job_id
      WHERE task.status = 'QUEUED'::"CatalogTaskStatus"
        AND task.available_at <= NOW()
        AND task.attempts < task.max_attempts
        AND job.status IN ('QUEUED'::"CatalogJobStatus", 'RUNNING'::"CatalogJobStatus")
        AND (
          task.task_type <> 'GENERATE_IMAGE'::"CatalogTaskType"
          OR EXISTS (
            SELECT 1
            FROM synthetic_image_asset AS current_asset
            WHERE current_asset.id = task.image_asset_id
              AND (
                current_asset.role = 'FRONT'::"CatalogImageRole"
                OR EXISTS (
                  SELECT 1
                  FROM synthetic_image_asset AS front_asset
                  WHERE front_asset.style_id = current_asset.style_id
                    AND front_asset.role = 'FRONT'::"CatalogImageRole"
                    AND front_asset.status IN (
                      'READY'::"CatalogImageStatus",
                      'FAILED'::"CatalogImageStatus"
                    )
                )
              )
          )
        )
      ORDER BY task.available_at ASC, task.id ASC
      FOR UPDATE OF task SKIP LOCKED
      LIMIT 1
    )
    UPDATE catalog_generation_task AS task
    SET status = 'RUNNING'::"CatalogTaskStatus",
        attempts = task.attempts + 1,
        locked_at = NOW(),
        locked_by = ${workerId},
        started_at = COALESCE(task.started_at, NOW()),
        finished_at = NULL,
        updated_at = NOW()
    FROM candidate
    WHERE task.id = candidate.id
    RETURNING task.id
  `;
  const taskId = claimed[0]?.id;
  if (taskId == null) return null;

  const task = await prisma.catalogGenerationTask.findUniqueOrThrow({ where: { id: taskId } });
  await prisma.$executeRaw`
    UPDATE catalog_generation_job
    SET status = 'RUNNING'::"CatalogJobStatus",
        started_at = COALESCE(started_at, NOW()),
        finished_at = NULL,
        updated_at = NOW()
    WHERE id = ${task.jobId}
      AND status IN ('QUEUED'::"CatalogJobStatus", 'RUNNING'::"CatalogJobStatus")
  `;
  return task;
}

async function refreshProductImageState(styleId: number): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM synthetic_style WHERE id = ${styleId} FOR UPDATE`;
    const style = await tx.syntheticStyle.findUniqueOrThrow({
      where: { id: styleId },
      include: { images: true },
    });
    await tx.$queryRaw`SELECT id FROM synthetic_product WHERE id = ${style.productId} FOR UPDATE`;
    const pending = await tx.catalogGenerationTask.count({
      where: {
        styleId,
        taskType: "GENERATE_IMAGE",
        status: { in: ["QUEUED", "RUNNING"] },
      },
    });
    const styleStatus =
      pending > 0
        ? "GENERATING"
        : REQUIRED_CORE_IMAGE_ROLES.every((role) => style.images.some((image) => image.role === role && image.status === "READY"))
          ? "READY"
          : "FAILED";
    await tx.syntheticStyle.update({ where: { id: styleId }, data: { status: styleStatus } });

    const siblingStyles = await tx.syntheticStyle.findMany({
      where: { productId: style.productId },
      select: { status: true },
    });
    const productStatus = siblingStyles.every((item) => item.status === "READY")
      ? "READY"
      : siblingStyles.some((item) => item.status === "GENERATING" || item.status === "DRAFT")
        ? "GENERATING"
        : "FAILED";
    await tx.syntheticProduct.update({
      where: { id: style.productId },
      data: { status: productStatus },
    });
  });
}

async function completeTask(task: CatalogGenerationTask, workerId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM catalog_generation_job WHERE id = ${task.jobId} FOR UPDATE`;
    const job = await tx.catalogGenerationJob.findUniqueOrThrow({ where: { id: task.jobId }, select: { status: true } });
    await tx.catalogGenerationTask.updateMany({
      where: { id: task.id, status: "RUNNING", lockedBy: workerId },
      data: {
        status: job.status === "CANCELLED" ? "CANCELLED" : "COMPLETED",
        lockedAt: null,
        lockedBy: null,
        lastError: null,
        finishedAt: new Date(),
      },
    });
  });
}

async function settleFailedTask(
  task: CatalogGenerationTask,
  workerId: string,
  error: unknown,
  retryDelayMs: number,
): Promise<void> {
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM catalog_generation_job WHERE id = ${task.jobId} FOR UPDATE`;
    const job = await tx.catalogGenerationJob.findUniqueOrThrow({ where: { id: task.jobId }, select: { status: true } });
    const cancelled = job.status === "CANCELLED" || error instanceof CatalogJobCancelledError;
    const retry = !cancelled && isRetryableCatalogWorkerError(error) && task.attempts < task.maxAttempts;
    await tx.catalogGenerationTask.updateMany({
      where: { id: task.id, status: "RUNNING", lockedBy: workerId },
      data: cancelled
        ? { status: "CANCELLED", lockedAt: null, lockedBy: null, finishedAt: new Date(), lastError: null }
        : retry
          ? {
              status: "QUEUED",
              availableAt: new Date(Date.now() + retryDelayMs * 2 ** Math.max(0, task.attempts - 1)),
              lockedAt: null,
              lockedBy: null,
              lastError: errorMessage(error),
              finishedAt: null,
            }
          : {
              status: "FAILED",
              lockedAt: null,
              lockedBy: null,
              lastError: errorMessage(error),
              finishedAt: new Date(),
            },
    });
    return { cancelled, retry };
  });
  if (task.imageAssetId != null) {
    await prisma.syntheticImageAsset.update({
      where: { id: task.imageAssetId },
      data: {
        status: result.cancelled || result.retry ? "QUEUED" : "FAILED",
        errorMessage: result.cancelled || result.retry ? null : errorMessage(error),
      },
    });
  }
}

export class CatalogGenerationWorker {
  private readonly pollIntervalMs: number;
  private readonly leaseMs: number;
  private readonly retryDelayMs: number;
  private readonly recoveryIntervalMs: number;
  private readonly schemaRetryMs: number;

  constructor(
    private readonly dependencies: CatalogWorkerDependencies,
    private readonly options: CatalogWorkerOptions,
  ) {
    this.pollIntervalMs = options.pollIntervalMs ?? DEFAULT_WORKER_POLL_MS;
    this.leaseMs = options.leaseMs ?? DEFAULT_WORKER_LEASE_MS;
    this.retryDelayMs = options.retryDelayMs ?? DEFAULT_WORKER_RETRY_DELAY_MS;
    this.recoveryIntervalMs =
      options.recoveryIntervalMs ?? DEFAULT_WORKER_RECOVERY_INTERVAL_MS;
    this.schemaRetryMs = options.schemaRetryMs ?? DEFAULT_WORKER_SCHEMA_RETRY_MS;
  }

  async runOnce(): Promise<boolean> {
    const task = await claimNextCatalogTask(this.options.workerId);
    if (!task) return false;
    let catalogSlug: string | null = null;
    let model: string | null = null;
    let imageRole: string | null = null;

    try {
      const job = await prisma.catalogGenerationJob.findUniqueOrThrow({
        where: { id: task.jobId },
        include: { catalog: { select: { slug: true } } },
      });
      catalogSlug = job.catalog.slug;
      model = task.taskType === "GENERATE_IMAGE" ? job.imageModel : job.textModel;
      if (job.status === "CANCELLED") {
        await prisma.catalogGenerationTask.updateMany({
          where: { id: task.id, status: "RUNNING", lockedBy: this.options.workerId },
          data: { status: "CANCELLED", lockedAt: null, lockedBy: null, finishedAt: new Date() },
        });
        return true;
      }

      if (task.taskType === "GENERATE_PRODUCT") {
        await processProductGenerationTask(task.id, this.dependencies.productGenerator);
      } else if (task.taskType === "GENERATE_IMAGE") {
        if (task.styleId == null || task.imageAssetId == null) {
          throw new Error(`Image task ${task.id} is missing its style or asset`);
        }
        const asset = await prisma.syntheticImageAsset.findUniqueOrThrow({
          where: { id: task.imageAssetId },
        });
        imageRole = asset.role;
        const regeneration =
          task.payload != null &&
          typeof task.payload === "object" &&
          !Array.isArray(task.payload) &&
          "regeneration" in task.payload &&
          task.payload.regeneration === true;
        const catalogSnapshot = task.payload != null && typeof task.payload === "object" && !Array.isArray(task.payload) && "catalogSnapshot" in task.payload
          ? task.payload.catalogSnapshot as { brandName: string; segment: string; visualDirection: string }
          : undefined;
        if (asset.status !== "READY" || regeneration) {
          await assertCatalogJobActive(task.jobId);
          await generateStyleImage({
            styleId: task.styleId,
            role: asset.role,
            model: job.imageModel,
            generator: this.dependencies.imageGenerator,
            storage: this.dependencies.storage,
            regeneration,
            catalogSnapshot,
            assertActive: () => assertCatalogJobActive(task.jobId),
          });
        }
      } else {
        throw new Error(`Unsupported catalog task type ${task.taskType}`);
      }
      await completeTask(task, this.options.workerId);
    } catch (error) {
      if (!(error instanceof CatalogJobCancelledError)) logger.error("Catalog generation task failed", {
        workerId: this.options.workerId,
        jobId: task.jobId,
        taskId: task.id,
        taskType: task.taskType,
        catalog: catalogSlug,
        productId: task.productId,
        styleId: task.styleId,
        imageRole,
        model,
        attempt: task.attempts,
        failureCategory: isRetryableCatalogWorkerError(error) ? "transient" : "permanent",
        error: errorMessage(error),
      });
      await settleFailedTask(
        task,
        this.options.workerId,
        error,
        this.retryDelayMs,
      );
    } finally {
      if (task.styleId != null) await refreshProductImageState(task.styleId);
      await refreshGenerationJobState(task.jobId);
    }
    return true;
  }

  async runUntilIdle(maxTasks = Number.POSITIVE_INFINITY): Promise<number> {
    if (!(maxTasks > 0)) throw new Error("maxTasks must be positive");
    let processed = 0;
    while (processed < maxTasks && (await this.runOnce())) processed += 1;
    return processed;
  }

  async recoverStaleTasks(): Promise<number> {
    const staleBefore = new Date(Date.now() - this.leaseMs);
    const stale = await prisma.catalogGenerationTask.findMany({
      where: { status: "RUNNING", lockedAt: { lte: staleBefore } },
      include: { job: { select: { status: true } } },
    });
    const affectedJobs = new Set<number>();
    let recovered = 0;
    for (const task of stale) {
      const outcome = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM catalog_generation_job WHERE id = ${task.jobId} FOR UPDATE`;
        const job = await tx.catalogGenerationJob.findUniqueOrThrow({ where: { id: task.jobId }, select: { status: true } });
        const cancelled = job.status === "CANCELLED";
        const retry = !cancelled && task.attempts < task.maxAttempts;
        const updated = await tx.catalogGenerationTask.updateMany({
          where: { id: task.id, status: "RUNNING", lockedAt: task.lockedAt },
          data: {
            status: cancelled ? "CANCELLED" : retry ? "QUEUED" : "FAILED",
            availableAt: new Date(),
            lockedAt: null,
            lockedBy: null,
            lastError: cancelled ? null : "Worker lease expired before task completion",
            finishedAt: retry ? null : new Date(),
          },
        });
        return { count: updated.count, retry, cancelled };
      });
      recovered += outcome.count;
      if (outcome.count > 0) affectedJobs.add(task.jobId);
      if (outcome.count > 0 && task.imageAssetId != null) {
        await prisma.syntheticImageAsset.update({
          where: { id: task.imageAssetId },
          data: {
            status: outcome.retry || outcome.cancelled ? "QUEUED" : "FAILED",
            ...(!outcome.retry && !outcome.cancelled && { errorMessage: "Worker lease expired before task completion" }),
          },
        });
      }
    }
    for (const jobId of affectedJobs) await refreshGenerationJobState(jobId);
    return recovered;
  }

  async start(signal?: AbortSignal): Promise<void> {
    let reportedMissingSchema = false;
    while (!signal?.aborted) {
      try {
        await this.recoverStaleTasks();
        break;
      } catch (error) {
        if (!isCatalogWorkerSchemaMissing(error)) throw error;
        if (!reportedMissingSchema) {
          logger.error(
            "Catalog generation schema is not migrated yet; worker is waiting for prisma migrate deploy",
          );
          reportedMissingSchema = true;
        }
        try {
          await sleep(
            this.schemaRetryMs,
            undefined,
            signal ? { signal } : undefined,
          );
        } catch (error) {
          if (!(error instanceof Error) || error.name !== "AbortError") throw error;
          return;
        }
      }
    }
    if (signal?.aborted) return;

    let nextRecoveryAt = Date.now() + this.recoveryIntervalMs;
    while (!signal?.aborted) {
      if (Date.now() >= nextRecoveryAt) {
        await this.recoverStaleTasks();
        nextRecoveryAt = Date.now() + this.recoveryIntervalMs;
      }
      const worked = await this.runOnce();
      if (!worked) {
        try {
          await sleep(this.pollIntervalMs, undefined, signal ? { signal } : undefined);
        } catch (error) {
          if (!(error instanceof Error) || error.name !== "AbortError") throw error;
        }
      }
    }
  }
}
