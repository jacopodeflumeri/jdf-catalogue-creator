export type DashboardRange = "7d" | "30d" | "90d" | "all";
export type DashboardStage = "CATALOG_INFO" | "CORE_IMAGES" | "COMPLETE_LOOK";

export interface ResolvedDashboardRange {
  range: DashboardRange;
  from: Date | null;
  to: Date;
  label: string;
}

export interface DashboardInventory {
  catalogues: number;
  products: number;
  styles: number;
  variants: number;
  readyImages: number;
  readyLooks: number;
  archivedProducts: number;
}

export interface DashboardActivity {
  productsCreated: number;
  imagesCompleted: number;
  jobsCompleted: number;
  jobsFailedOrCancelled: number;
  successRate: number | null;
  cumulativeProcessingMs: number;
  completedJobs: number;
  validDurationJobs: number;
}

export interface DashboardStagePerformance {
  stage: DashboardStage;
  completedJobs: number;
  producedUnits: number;
  averageDurationMs: number | null;
  medianDurationMs: number | null;
  averageThroughputPerMinute: number | null;
  failedJobs: number;
  successRate: number | null;
}

export interface DashboardCatalogueReadiness {
  id: number;
  slug: string;
  name: string;
  brandName: string;
  productCount: number;
  styleCount: number;
  readyCoreStyles: number;
  readyLooks: number;
  eligibleLookStyles: number;
  failedImages: number;
  latestJobStatus: string | null;
  lastCompletedAt: string | null;
}

export interface DashboardRecentJob {
  id: number;
  publicId: string;
  catalogSlug: string;
  catalogName: string;
  jobType: string;
  status: string;
  scopeType: string;
  scopeValue: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  processingDurationMs: number | null;
  completedProducts: number;
  failedProducts: number;
  completedImages: number;
  failedImages: number;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  runningTasks: number;
  queuedTasks: number;
}

export interface DashboardActivityBucket {
  start: string;
  products: number;
  images: number;
  jobs: number;
}

export interface CatalogueDashboardView {
  range: ResolvedDashboardRange;
  inventory: DashboardInventory;
  activity: DashboardActivity;
  stages: DashboardStagePerformance[];
  catalogues: DashboardCatalogueReadiness[];
  recentJobs: DashboardRecentJob[];
  trend: DashboardActivityBucket[];
}
