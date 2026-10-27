import type {
  CatalogJobStage,
  CatalogJobStatus,
  CatalogTaskStatus,
  CatalogTaskType,
} from "@/generated/prisma/client";

const ALLOWED_TRANSITIONS: Record<CatalogJobStatus, readonly CatalogJobStatus[]> = {
  QUEUED: ["RUNNING", "CANCELLED"],
  RUNNING: ["QUEUED", "COMPLETED", "COMPLETED_WITH_ERRORS", "FAILED", "CANCELLED"],
  COMPLETED: [],
  COMPLETED_WITH_ERRORS: ["QUEUED"],
  FAILED: ["QUEUED"],
  CANCELLED: [],
};

export function assertJobTransition(
  current: CatalogJobStatus,
  next: CatalogJobStatus,
): void {
  if (current === next) return;
  if (!ALLOWED_TRANSITIONS[current].includes(next)) {
    throw new Error(`Invalid catalog generation job transition: ${current} -> ${next}`);
  }
}

export interface CatalogTaskStatusCount {
  taskType: CatalogTaskType;
  status: CatalogTaskStatus;
  count: number;
}

export interface CatalogJobProgressState {
  completedProducts: number;
  failedProducts: number;
  completedImages: number;
  failedImages: number;
  pendingTasks: number;
  failedTasks: number;
  nextStatus: CatalogJobStatus;
  nextStage: CatalogJobStage;
}

/**
 * Derive persisted job state from every durable task type.
 *
 * Product/image counters intentionally retain their historical meanings, while
 * terminal-state detection includes all current and future task types. This
 * prevents a job from becoming terminal while newer task kinds are still
 * queued or running.
 */
export function deriveCatalogJobProgress(
  rows: readonly CatalogTaskStatusCount[],
): CatalogJobProgressState {
  const count = (taskType: CatalogTaskType, status: CatalogTaskStatus) =>
    rows
      .filter((row) => row.taskType === taskType && row.status === status)
      .reduce((total, row) => total + row.count, 0);
  const pendingStatuses = new Set<CatalogTaskStatus>(["QUEUED", "RUNNING"]);
  const pendingTasks = rows
    .filter((row) => pendingStatuses.has(row.status))
    .reduce((total, row) => total + row.count, 0);
  const failedTasks = rows
    .filter((row) => row.status === "FAILED")
    .reduce((total, row) => total + row.count, 0);
  const pendingProductWork = rows.some(
    (row) =>
      pendingStatuses.has(row.status) &&
      row.taskType !== "GENERATE_IMAGE" &&
      row.taskType !== "VALIDATE_PRODUCT",
  );
  const pendingImageWork = rows.some(
    (row) => pendingStatuses.has(row.status) && row.taskType === "GENERATE_IMAGE",
  );
  const pendingValidationWork = rows.some(
    (row) => pendingStatuses.has(row.status) && row.taskType === "VALIDATE_PRODUCT",
  );

  return {
    completedProducts: count("GENERATE_PRODUCT", "COMPLETED"),
    failedProducts: count("GENERATE_PRODUCT", "FAILED"),
    completedImages: count("GENERATE_IMAGE", "COMPLETED"),
    failedImages: count("GENERATE_IMAGE", "FAILED"),
    pendingTasks,
    failedTasks,
    nextStatus:
      pendingTasks > 0
        ? "RUNNING"
        : failedTasks > 0
          ? "COMPLETED_WITH_ERRORS"
          : "COMPLETED",
    nextStage: pendingProductWork
      ? "PRODUCTS"
      : pendingImageWork
        ? "IMAGES"
        : pendingValidationWork
          ? "VALIDATING"
          : "COMPLETE",
  };
}
