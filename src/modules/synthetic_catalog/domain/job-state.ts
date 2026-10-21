import type { CatalogJobStatus } from "@/generated/prisma/client";

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
