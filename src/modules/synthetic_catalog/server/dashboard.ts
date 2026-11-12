import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma/client";
import { parseDashboardRange, resolveDashboardRange, safeSuccessRate } from "../admin/dashboard";
import type {
  CatalogueDashboardView,
  DashboardActivityBucket,
  DashboardRange,
  DashboardRecentJob,
  DashboardStage,
} from "../admin/dashboard-types";

type InventoryRow = {
  id: number; slug: string; name: string; brandName: string;
  products: bigint; styles: bigint; variants: bigint; readyImages: bigint;
  archivedProducts: bigint; readyCoreStyles: bigint; readyLooks: bigint;
  eligibleLookStyles: bigint; failedImages: bigint; latestJobStatus: string | null;
  lastCompletedAt: Date | null;
};
type StageRow = {
  jobType: string; completedJobs: bigint; successfulJobs: bigint; failedJobs: bigint; terminalJobs: bigint;
  producedUnits: bigint; averageDurationMs: number | null; medianDurationMs: number | null;
  durationTotalMs: number | null;
};
type ActivityRow = {
  productsCreated: bigint; imagesCompleted: bigint; jobsCompleted: bigint; jobsSuccessful: bigint;
  jobsFailedOrCancelled: bigint; terminalJobs: bigint; cumulativeProcessingMs: number | null;
  validDurationJobs: bigint;
};
type RecentJobRow = {
  id: number; publicId: string; catalogSlug: string; catalogName: string; jobType: string;
  status: string; scopeType: string; scopeValue: string | null; createdAt: Date;
  startedAt: Date | null; finishedAt: Date | null; completedProducts: number;
  failedProducts: number; completedImages: number; failedImages: number;
  totalTasks: bigint; completedTasks: bigint; failedTasks: bigint; runningTasks: bigint; queuedTasks: bigint;
};
type TrendRow = { bucket: Date; products: bigint; images: bigint; jobs: bigint };

const SUCCESS_STATUSES = Prisma.sql`('COMPLETED'::"CatalogJobStatus", 'COMPLETED_WITH_ERRORS'::"CatalogJobStatus")`;

function asNumber(value: bigint | number | null | undefined): number {
  return Number(value ?? 0);
}

function toRecentJob(row: RecentJobRow): DashboardRecentJob {
  const duration = row.startedAt && row.finishedAt
    ? row.finishedAt.getTime() - row.startedAt.getTime()
    : null;
  return {
    id: row.id, publicId: row.publicId, catalogSlug: row.catalogSlug, catalogName: row.catalogName,
    jobType: row.jobType, status: row.status, scopeType: row.scopeType, scopeValue: row.scopeValue,
    createdAt: row.createdAt.toISOString(), startedAt: row.startedAt?.toISOString() ?? null,
    finishedAt: row.finishedAt?.toISOString() ?? null,
    processingDurationMs: duration != null && duration >= 0 ? duration : null,
    completedProducts: row.completedProducts, failedProducts: row.failedProducts,
    completedImages: row.completedImages, failedImages: row.failedImages,
    totalTasks: asNumber(row.totalTasks), completedTasks: asNumber(row.completedTasks),
    failedTasks: asNumber(row.failedTasks), runningTasks: asNumber(row.runningTasks),
    queuedTasks: asNumber(row.queuedTasks),
  };
}

export async function getCatalogueDashboard(inputRange?: string | null, now = new Date()): Promise<CatalogueDashboardView> {
  const rangeKey: DashboardRange = parseDashboardRange(inputRange);
  const range = resolveDashboardRange(rangeKey, now);
  const inventoryQuery = prisma.$queryRaw<InventoryRow[]>(Prisma.sql`
    SELECT c.id, c.slug, c.name, c.brand_name AS "brandName",
      COUNT(DISTINCT p.id) FILTER (WHERE p.archived_at IS NULL) AS products,
      COUNT(DISTINCT s.id) FILTER (WHERE p.archived_at IS NULL) AS styles,
      COUNT(DISTINCT v.id) FILTER (WHERE p.archived_at IS NULL) AS variants,
      COUNT(DISTINCT i.id) FILTER (WHERE p.archived_at IS NULL AND i.status = 'READY') AS "readyImages",
      COUNT(DISTINCT p.id) FILTER (WHERE p.archived_at IS NOT NULL) AS "archivedProducts",
      COUNT(DISTINCT s.id) FILTER (WHERE p.archived_at IS NULL AND front.status = 'READY' AND back.status = 'READY') AS "readyCoreStyles",
      COUNT(DISTINCT s.id) FILTER (WHERE p.archived_at IS NULL AND p.status = 'READY' AND s.status = 'READY' AND l.status = 'READY'
        AND li.status = 'READY' AND li.public_id IS NOT NULL AND li.storage_key IS NOT NULL
        AND EXISTS (SELECT 1 FROM synthetic_complete_look_item item WHERE item.complete_look_id = l.id)
        AND NOT EXISTS (
          SELECT 1 FROM synthetic_complete_look_item item
          JOIN synthetic_style companion_style ON companion_style.id = item.companion_style_id
          JOIN synthetic_product companion_product ON companion_product.id = companion_style.product_id
          WHERE item.complete_look_id = l.id AND (companion_product.archived_at IS NOT NULL
            OR companion_product.status <> 'READY' OR companion_style.status <> 'READY'
            OR companion_product.id = p.id)
        )
        AND NOT EXISTS (
          SELECT 1 FROM synthetic_complete_look_item item
          JOIN synthetic_style companion_style ON companion_style.id = item.companion_style_id
          GROUP BY item.complete_look_id
          HAVING item.complete_look_id = l.id AND COUNT(*) <> COUNT(DISTINCT companion_style.product_id)
        )) AS "readyLooks",
      COUNT(DISTINCT s.id) FILTER (WHERE p.archived_at IS NULL AND p.status = 'READY' AND s.status = 'READY') AS "eligibleLookStyles",
      COUNT(DISTINCT i.id) FILTER (WHERE p.archived_at IS NULL AND i.status = 'FAILED' AND i.role IN ('FRONT', 'BACK')) AS "failedImages",
      (SELECT j.status::text FROM catalog_generation_job j WHERE j.catalog_id = c.id ORDER BY j.created_at DESC, j.id DESC LIMIT 1) AS "latestJobStatus",
      (SELECT j.finished_at FROM catalog_generation_job j WHERE j.catalog_id = c.id
        AND j.status IN ${SUCCESS_STATUSES} AND j.finished_at IS NOT NULL ORDER BY j.finished_at DESC, j.id DESC LIMIT 1) AS "lastCompletedAt"
    FROM synthetic_catalog c
    LEFT JOIN synthetic_product p ON p.catalog_id = c.id
    LEFT JOIN synthetic_style s ON s.product_id = p.id
    LEFT JOIN synthetic_variant v ON v.style_id = s.id
    LEFT JOIN synthetic_image_asset i ON i.style_id = s.id
    LEFT JOIN synthetic_image_asset front ON front.style_id = s.id AND front.role = 'FRONT'
    LEFT JOIN synthetic_image_asset back ON back.style_id = s.id AND back.role = 'BACK'
    LEFT JOIN synthetic_complete_look l ON l.anchor_style_id = s.id
    LEFT JOIN synthetic_image_asset li ON li.id = l.image_asset_id
    WHERE c.active = true
    GROUP BY c.id ORDER BY c.name, c.slug
  `);
  const activityQuery = prisma.$queryRaw<ActivityRow[]>(Prisma.sql`
    SELECT
      (SELECT COUNT(*) FROM synthetic_product p JOIN synthetic_catalog c ON c.id = p.catalog_id
        WHERE c.active = true AND p.archived_at IS NULL AND p.created_at >= ${range.from ?? new Date(0)} AND p.created_at < ${range.to}) AS "productsCreated",
      (SELECT COUNT(*) FROM synthetic_image_asset i JOIN synthetic_style s ON s.id = i.style_id
        JOIN synthetic_product p ON p.id = s.product_id JOIN synthetic_catalog c ON c.id = p.catalog_id
        WHERE c.active = true AND p.archived_at IS NULL AND i.status = 'READY' AND i.generated_at IS NOT NULL
          AND i.generated_at >= ${range.from ?? new Date(0)} AND i.generated_at < ${range.to}) AS "imagesCompleted",
      COUNT(*) FILTER (WHERE j.status IN ${SUCCESS_STATUSES}) AS "jobsCompleted",
      COUNT(*) FILTER (WHERE j.status = 'COMPLETED'::"CatalogJobStatus") AS "jobsSuccessful",
      COUNT(*) FILTER (WHERE j.status IN ('FAILED'::"CatalogJobStatus", 'CANCELLED'::"CatalogJobStatus")) AS "jobsFailedOrCancelled",
      COUNT(*) FILTER (WHERE j.status IN ${SUCCESS_STATUSES} OR j.status IN ('FAILED'::"CatalogJobStatus", 'CANCELLED'::"CatalogJobStatus")) AS "terminalJobs",
      COALESCE(SUM(EXTRACT(EPOCH FROM (j.finished_at - j.started_at)) * 1000) FILTER (
        WHERE j.status IN ${SUCCESS_STATUSES} AND j.started_at IS NOT NULL AND j.finished_at >= j.started_at
      ), 0) AS "cumulativeProcessingMs",
      COUNT(*) FILTER (WHERE j.status IN ${SUCCESS_STATUSES} AND j.started_at IS NOT NULL AND j.finished_at >= j.started_at) AS "validDurationJobs"
    FROM catalog_generation_job j JOIN synthetic_catalog c ON c.id = j.catalog_id
    WHERE c.active = true AND j.finished_at >= ${range.from ?? new Date(0)} AND j.finished_at < ${range.to}
  `);
  const stagesQuery = prisma.$queryRaw<StageRow[]>(Prisma.sql`
    WITH stage_jobs AS (
      SELECT j.job_type, j.status, j.started_at, j.finished_at,
        CASE j.job_type::text
          WHEN 'CATALOG_INFO' THEN CASE WHEN j.status IN ${SUCCESS_STATUSES}
            THEN (SELECT COUNT(*) FROM synthetic_product p WHERE p.generation_job_id = j.id AND p.archived_at IS NULL) ELSE 0 END
          WHEN 'CORE_IMAGES' THEN CASE WHEN j.status IN ${SUCCESS_STATUSES} THEN (SELECT COUNT(DISTINCT t.image_asset_id) FROM catalog_generation_task t
            JOIN synthetic_image_asset i ON i.id = t.image_asset_id JOIN synthetic_style s ON s.id = i.style_id
            JOIN synthetic_product p ON p.id = s.product_id
            WHERE t.job_id = j.id AND t.task_type = 'GENERATE_IMAGE' AND t.status = 'COMPLETED'
              AND i.role IN ('FRONT', 'BACK') AND i.status = 'READY' AND p.archived_at IS NULL) ELSE 0 END
          WHEN 'COMPLETE_LOOK' THEN CASE WHEN j.status IN ${SUCCESS_STATUSES} THEN (SELECT COUNT(DISTINCT l.id) FROM catalog_generation_task t
            JOIN synthetic_image_asset i ON i.id = t.image_asset_id JOIN synthetic_complete_look l ON l.image_asset_id = i.id
            JOIN synthetic_style s ON s.id = l.anchor_style_id JOIN synthetic_product p ON p.id = s.product_id
            WHERE t.job_id = j.id AND t.task_type = 'GENERATE_IMAGE' AND t.status = 'COMPLETED'
              AND l.status = 'READY' AND i.status = 'READY' AND i.public_id IS NOT NULL AND i.storage_key IS NOT NULL
              AND p.archived_at IS NULL AND p.status = 'READY' AND s.status = 'READY'
              AND EXISTS (SELECT 1 FROM synthetic_complete_look_item item WHERE item.complete_look_id = l.id)
              AND NOT EXISTS (
                SELECT 1 FROM synthetic_complete_look_item item
                JOIN synthetic_style companion_style ON companion_style.id = item.companion_style_id
                JOIN synthetic_product companion_product ON companion_product.id = companion_style.product_id
                WHERE item.complete_look_id = l.id AND (companion_product.archived_at IS NOT NULL
                  OR companion_product.status <> 'READY' OR companion_style.status <> 'READY' OR companion_product.id = p.id)
              )
              AND NOT EXISTS (
                SELECT 1 FROM synthetic_complete_look_item item
                JOIN synthetic_style companion_style ON companion_style.id = item.companion_style_id
                GROUP BY item.complete_look_id
                HAVING item.complete_look_id = l.id AND COUNT(*) <> COUNT(DISTINCT companion_style.product_id)
              )) ELSE 0 END
          ELSE 0
        END::bigint AS produced_units
      FROM catalog_generation_job j JOIN synthetic_catalog c ON c.id = j.catalog_id
      WHERE c.active = true AND j.finished_at >= ${range.from ?? new Date(0)} AND j.finished_at < ${range.to}
        AND j.job_type IN ('CATALOG_INFO'::"CatalogJobType", 'CORE_IMAGES'::"CatalogJobType", 'COMPLETE_LOOK'::"CatalogJobType")
    )
    SELECT job_type::text AS "jobType",
      COUNT(*) FILTER (WHERE status IN ${SUCCESS_STATUSES}) AS "completedJobs",
      COUNT(*) FILTER (WHERE status = 'COMPLETED'::"CatalogJobStatus") AS "successfulJobs",
      COUNT(*) FILTER (WHERE status IN ('FAILED'::"CatalogJobStatus", 'CANCELLED'::"CatalogJobStatus")) AS "failedJobs",
      COUNT(*) FILTER (WHERE status IN ${SUCCESS_STATUSES} OR status IN ('FAILED'::"CatalogJobStatus", 'CANCELLED'::"CatalogJobStatus")) AS "terminalJobs",
      COALESCE(SUM(produced_units), 0)::bigint AS "producedUnits",
      AVG(EXTRACT(EPOCH FROM (finished_at - started_at)) * 1000) FILTER (
        WHERE status IN ${SUCCESS_STATUSES} AND started_at IS NOT NULL AND finished_at >= started_at
      ) AS "averageDurationMs",
      percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (finished_at - started_at)) * 1000) FILTER (
        WHERE status IN ${SUCCESS_STATUSES} AND started_at IS NOT NULL AND finished_at >= started_at
      ) AS "medianDurationMs",
      SUM(EXTRACT(EPOCH FROM (finished_at - started_at)) * 1000) FILTER (
        WHERE status IN ${SUCCESS_STATUSES} AND started_at IS NOT NULL AND finished_at >= started_at
      ) AS "durationTotalMs"
    FROM stage_jobs
    GROUP BY job_type
  `);
  const recentQuery = prisma.$queryRaw<RecentJobRow[]>(Prisma.sql`
    SELECT j.id, j.public_id AS "publicId", c.slug AS "catalogSlug", c.name AS "catalogName",
      j.job_type::text AS "jobType", j.status::text AS status, j.scope_type AS "scopeType", j.scope_value AS "scopeValue",
      j.created_at AS "createdAt", j.started_at AS "startedAt", j.finished_at AS "finishedAt",
      j.completed_products AS "completedProducts", j.failed_products AS "failedProducts",
      j.completed_images AS "completedImages", j.failed_images AS "failedImages",
      COALESCE(t.total, 0) AS "totalTasks", COALESCE(t.completed, 0) AS "completedTasks",
      COALESCE(t.failed, 0) AS "failedTasks", COALESCE(t.running, 0) AS "runningTasks", COALESCE(t.queued, 0) AS "queuedTasks"
    FROM catalog_generation_job j JOIN synthetic_catalog c ON c.id = j.catalog_id
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'COMPLETED') AS completed,
        COUNT(*) FILTER (WHERE status = 'FAILED') AS failed, COUNT(*) FILTER (WHERE status = 'RUNNING') AS running,
        COUNT(*) FILTER (WHERE status = 'QUEUED') AS queued
      FROM catalog_generation_task t WHERE t.job_id = j.id
    ) t ON true
    WHERE c.active = true AND j.created_at >= ${range.from ?? new Date(0)} AND j.created_at < ${range.to}
    ORDER BY j.created_at DESC, j.id DESC LIMIT 10
  `);
  const bucket = rangeKey === "all" ? "month" : rangeKey === "90d" ? "week" : "day";
  const bucketRaw = Prisma.raw(`'${bucket}'`);
  const trendQuery = prisma.$queryRaw<TrendRow[]>(Prisma.sql`
    WITH activity AS (
      SELECT date_trunc(${bucketRaw}, p.created_at) AS bucket, COUNT(*) AS products, 0::bigint AS images, 0::bigint AS jobs
      FROM synthetic_product p JOIN synthetic_catalog c ON c.id = p.catalog_id
      WHERE c.active = true AND p.archived_at IS NULL AND p.created_at >= ${range.from ?? new Date(0)} AND p.created_at < ${range.to}
      GROUP BY 1
      UNION ALL
      SELECT date_trunc(${bucketRaw}, i.generated_at) AS bucket, 0, COUNT(*), 0
      FROM synthetic_image_asset i JOIN synthetic_style s ON s.id = i.style_id JOIN synthetic_product p ON p.id = s.product_id
        JOIN synthetic_catalog c ON c.id = p.catalog_id
      WHERE c.active = true AND p.archived_at IS NULL AND i.status = 'READY' AND i.generated_at >= ${range.from ?? new Date(0)} AND i.generated_at < ${range.to}
      GROUP BY 1
      UNION ALL
      SELECT date_trunc(${bucketRaw}, j.finished_at) AS bucket, 0, 0,
        COUNT(*) FILTER (WHERE j.status IN ${SUCCESS_STATUSES})
      FROM catalog_generation_job j JOIN synthetic_catalog c ON c.id = j.catalog_id
      WHERE c.active = true AND j.finished_at >= ${range.from ?? new Date(0)} AND j.finished_at < ${range.to}
      GROUP BY 1
    ) SELECT bucket, SUM(products) AS products, SUM(images) AS images, SUM(jobs) AS jobs
      FROM activity GROUP BY bucket ORDER BY bucket
  `);

  const [catalogRows, activityRows, stageRows, recentRows, trendRows] = await Promise.all([
    inventoryQuery, activityQuery, stagesQuery, recentQuery, trendQuery,
  ]);
  const activity = activityRows[0];
  const completed = asNumber(activity?.jobsCompleted);
  const successful = asNumber(activity?.jobsSuccessful);
  const failed = asNumber(activity?.jobsFailedOrCancelled);
  const terminal = asNumber(activity?.terminalJobs);
  const stages: DashboardStage[] = ["CATALOG_INFO", "CORE_IMAGES", "COMPLETE_LOOK"];
  const stageByType = new Map(stageRows.map((row) => [row.jobType, row]));
  const performance = stages.map((stage) => {
    const row = stageByType.get(stage);
    const successCount = asNumber(row?.successfulJobs);
    const failedCount = asNumber(row?.failedJobs);
    const terminalCount = asNumber(row?.terminalJobs);
    return {
      stage, completedJobs: successCount, producedUnits: asNumber(row?.producedUnits),
      averageDurationMs: row?.averageDurationMs == null ? null : Number(row.averageDurationMs),
      medianDurationMs: row?.medianDurationMs == null ? null : Number(row.medianDurationMs),
      averageThroughputPerMinute: row?.durationTotalMs != null && Number(row.durationTotalMs) > 0
        ? asNumber(row?.producedUnits) / (Number(row.durationTotalMs) / 60_000) : null,
      failedJobs: failedCount,
      successRate: safeSuccessRate(successCount, terminalCount),
    };
  });

  return {
    range,
    inventory: catalogRows.reduce((result, row) => ({
      catalogues: result.catalogues + 1, products: result.products + asNumber(row.products),
      styles: result.styles + asNumber(row.styles), variants: result.variants + asNumber(row.variants),
      readyImages: result.readyImages + asNumber(row.readyImages), readyLooks: result.readyLooks + asNumber(row.readyLooks),
      archivedProducts: result.archivedProducts + asNumber(row.archivedProducts),
    }), { catalogues: 0, products: 0, styles: 0, variants: 0, readyImages: 0, readyLooks: 0, archivedProducts: 0 }),
    activity: {
      productsCreated: asNumber(activity?.productsCreated), imagesCompleted: asNumber(activity?.imagesCompleted),
      jobsCompleted: completed, jobsFailedOrCancelled: failed, jobsSuccessful: successful, successRate: safeSuccessRate(successful, terminal),
      cumulativeProcessingMs: Number(activity?.cumulativeProcessingMs ?? 0), completedJobs: completed,
      validDurationJobs: asNumber(activity?.validDurationJobs),
    },
    stages: performance,
    catalogues: catalogRows.map((row) => ({
      id: row.id, slug: row.slug, name: row.name, brandName: row.brandName,
      productCount: asNumber(row.products), styleCount: asNumber(row.styles), readyCoreStyles: asNumber(row.readyCoreStyles),
      readyLooks: asNumber(row.readyLooks), eligibleLookStyles: asNumber(row.eligibleLookStyles),
      failedImages: asNumber(row.failedImages), latestJobStatus: row.latestJobStatus,
      lastCompletedAt: row.lastCompletedAt?.toISOString() ?? null,
    })),
    recentJobs: recentRows.map(toRecentJob),
    trend: trendRows.map((row): DashboardActivityBucket => ({
      start: row.bucket.toISOString(), products: asNumber(row.products), images: asNumber(row.images), jobs: asNumber(row.jobs),
    })),
  };
}
