"use client";

import Link from "next/link";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import CatalogStatusBadge from "./catalogs/CatalogStatusBadge";
import ActivityTrendChart from "./ActivityTrendChart";
import DashboardRangeSelector from "./DashboardRangeSelector";
import type { CatalogueDashboardView, DashboardStage } from "@/modules/synthetic_catalog/admin/dashboard-types";

const STAGE_LABELS: Record<DashboardStage, string> = {
  CATALOG_INFO: "Catalogue information",
  CORE_IMAGES: "Core images",
  COMPLETE_LOOK: "Complete the Look",
};

const STAGE_UNITS: Record<DashboardStage, string> = {
  CATALOG_INFO: "products",
  CORE_IMAGES: "images",
  COMPLETE_LOOK: "looks",
};

const JOB_LABELS: Record<string, string> = {
  INITIAL: "Initial generation",
  ADD_PRODUCTS: "Add products",
  RETRY: "Retry",
  REGENERATE_IMAGE: "Regenerate image",
  CATALOG_INFO: "Catalogue information",
  CORE_IMAGES: "Core images",
  COMPLETE_LOOK: "Complete the Look",
  BULK_RENAME: "Bulk rename",
};

function count(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function percent(value: number, total: number): string {
  return total === 0 ? "—" : `${((value / total) * 100).toFixed(0)}%`;
}

export function formatDashboardDuration(milliseconds: number | null): string {
  if (milliseconds == null || !Number.isFinite(milliseconds) || milliseconds < 0) return "—";
  const seconds = Math.floor(milliseconds / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m${seconds % 60 ? ` ${seconds % 60}s` : ""}`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}h${remainder ? ` ${remainder}m` : ""}`;
}

function dateTime(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC", timeZoneName: "short",
  }).format(new Date(value));
}

function rangeLabel(dashboard: CatalogueDashboardView): string {
  if (!dashboard.range.from) return `All time through ${dateTime(dashboard.range.to.toISOString())}`;
  return `${dateTime(dashboard.range.from.toISOString())} – ${dateTime(dashboard.range.to.toISOString())}`;
}

function Kpi({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <Card className="h-full">
      <p className="text-sm font-medium text-[#1a1a1a]/55">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-[#1a1a1a]">{value}</p>
      {detail && <p className="mt-2 text-xs text-[#1a1a1a]/50">{detail}</p>}
    </Card>
  );
}

function Coverage({ ready, total }: { ready: number; total: number }) {
  return <span className="whitespace-nowrap">{count(ready)} / {count(total)} <span className="text-[#1a1a1a]/55">({percent(ready, total)})</span></span>;
}

function activityIsEmpty(dashboard: CatalogueDashboardView): boolean {
  const { activity } = dashboard;
  return activity.productsCreated === 0 && activity.imagesCompleted === 0 && activity.completedJobs === 0 &&
    activity.jobsFailedOrCancelled === 0 && dashboard.recentJobs.length === 0;
}

export default function CatalogDashboard({ dashboard }: { dashboard: CatalogueDashboardView }) {
  const hasCatalogues = dashboard.inventory.catalogues > 0;
  const emptyActivity = activityIsEmpty(dashboard);
  const failedPercent = dashboard.activity.successRate == null ? "No terminal jobs" : `${(dashboard.activity.successRate * 100).toFixed(1)}% of terminal jobs`;
  const activityRange = rangeLabel(dashboard);

  return (
    <div className="px-8 py-6 space-y-8">
      <PageHeader title="Dashboard" description="Operational summary of the generated catalogue estate." />

      <section aria-labelledby="current-estate-heading" className="space-y-4">
        <h2 id="current-estate-heading" className="text-xl font-semibold text-[#1a1a1a]">Current catalogue estate</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Kpi label="Active catalogues" value={count(dashboard.inventory.catalogues)} />
          <Kpi label="Active products" value={count(dashboard.inventory.products)} detail={dashboard.inventory.archivedProducts ? `${count(dashboard.inventory.archivedProducts)} archived products` : undefined} />
          <Kpi label="Colour styles" value={count(dashboard.inventory.styles)} />
          <Kpi label="Size/inventory variants" value={count(dashboard.inventory.variants)} />
          <Kpi label="Ready generated images" value={count(dashboard.inventory.readyImages)} detail="All ready image roles for active products" />
          <Kpi label="Ready Complete the Look recommendations" value={count(dashboard.inventory.readyLooks)} />
        </div>
      </section>

      <section aria-labelledby="activity-heading" className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 id="activity-heading" className="text-xl font-semibold text-[#1a1a1a]">Generation activity</h2>
            <p className="mt-1 text-sm text-[#1a1a1a]/55">Resolved range: {activityRange}</p>
          </div>
          <DashboardRangeSelector initialRange={dashboard.range.range} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Kpi label="Products created" value={count(dashboard.activity.productsCreated)} />
          <Kpi label="Images completed" value={count(dashboard.activity.imagesCompleted)} />
          <Kpi label="Jobs completed" value={count(dashboard.activity.jobsCompleted)} />
          <Kpi label="Jobs failed or cancelled" value={count(dashboard.activity.jobsFailedOrCancelled)} />
          <Kpi label="Job success rate" value={dashboard.activity.successRate == null ? "—" : `${(dashboard.activity.successRate * 100).toFixed(1)}%`} detail={failedPercent} />
          <Kpi label="Cumulative processing time" value={formatDashboardDuration(dashboard.activity.cumulativeProcessingMs)} detail={dashboard.activity.validDurationJobs ? `Across ${count(dashboard.activity.validDurationJobs)} completed jobs with valid timing` : "No completed jobs with valid timing"} />
        </div>
        {emptyActivity && <p className="rounded-xl border border-white/70 bg-white/25 px-5 py-4 text-sm text-[#1a1a1a]/60">No generation activity in this period.</p>}
      </section>

      <Card title="Stage performance" description="Processing duration uses persisted job start and finish timestamps. Other job types are excluded from manual stage metrics." noPaddingContent>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="ds-table-head"><tr>
              {["Workflow stage", "Completed jobs", "Produced units", "Average duration", "Median duration", "Average throughput", "Failed or cancelled", "Success rate"].map((heading) => <th key={heading} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1a1a1a]/55">{heading}</th>)}
            </tr></thead>
            <tbody>{dashboard.stages.map((stage) => (
              <tr key={stage.stage} className="ds-table-row">
                <td className="px-5 py-4 text-sm font-medium">{STAGE_LABELS[stage.stage]}</td>
                <td className="px-5 py-4 text-sm">{count(stage.completedJobs)}</td>
                <td className="px-5 py-4 text-sm">{count(stage.producedUnits)} {STAGE_UNITS[stage.stage]}</td>
                <td className="px-5 py-4 text-sm">{stage.averageDurationMs == null ? "—" : formatDashboardDuration(stage.averageDurationMs)}</td>
                <td className="px-5 py-4 text-sm">{stage.medianDurationMs == null ? "—" : formatDashboardDuration(stage.medianDurationMs)}</td>
                <td className="px-5 py-4 text-sm">{stage.averageThroughputPerMinute == null ? "—" : `${stage.averageThroughputPerMinute.toFixed(2)} ${STAGE_UNITS[stage.stage]}/min`}</td>
                <td className="px-5 py-4 text-sm">{count(stage.failedJobs)}</td>
                <td className="px-5 py-4 text-sm">{stage.successRate == null ? "—" : `${(stage.successRate * 100).toFixed(1)}%`}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Card>

      <Card title="Catalogue readiness" description="Coverage counts show ready items over the eligible active catalogue total. Failed required images remain visible." noPaddingContent>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <thead className="ds-table-head"><tr>
              {["Catalogue", "Products", "Styles", "Core image coverage", "Complete the Look coverage", "Failed images", "Latest generation", "Last completed generation"].map((heading) => <th key={heading} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1a1a1a]/55">{heading}</th>)}
            </tr></thead>
            <tbody>
              {dashboard.catalogues.map((catalogue) => (
                <tr key={catalogue.id} className="ds-table-row">
                  <td className="px-5 py-4 text-sm font-medium"><Link href={`/admin/catalogs/${encodeURIComponent(catalogue.slug)}`} className="rounded-sm text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">{catalogue.name}</Link><span className="mt-1 block text-xs font-normal text-[#1a1a1a]/50">{catalogue.brandName}</span></td>
                  <td className="px-5 py-4 text-sm">{count(catalogue.productCount)}</td>
                  <td className="px-5 py-4 text-sm">{count(catalogue.styleCount)}</td>
                  <td className="px-5 py-4 text-sm"><Coverage ready={catalogue.readyCoreStyles} total={catalogue.styleCount} /></td>
                  <td className="px-5 py-4 text-sm"><Coverage ready={catalogue.readyLooks} total={catalogue.eligibleLookStyles} /></td>
                  <td className="px-5 py-4 text-sm">{count(catalogue.failedImages)}</td>
                  <td className="px-5 py-4 text-sm">{catalogue.latestJobStatus ? <CatalogStatusBadge status={catalogue.latestJobStatus} /> : <Badge variant="gray">No jobs</Badge>}</td>
                  <td className="px-5 py-4 text-sm whitespace-nowrap">{dateTime(catalogue.lastCompletedAt)}</td>
                </tr>
              ))}
              {!hasCatalogues && <tr><td colSpan={8} className="px-5 py-10 text-center text-sm text-[#1a1a1a]/55">No active catalogues are available.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Recent generation jobs" description="The latest ten jobs created in the selected period across active catalogues." noPaddingContent>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="ds-table-head"><tr>
              {["Catalogue", "Workflow stage / job type", "Scope", "Status", "Created / start time (UTC)", "Processing duration", "Progress summary"].map((heading) => <th key={heading} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1a1a1a]/55">{heading}</th>)}
            </tr></thead>
            <tbody>
              {dashboard.recentJobs.map((job) => {
                const elapsed = job.status === "RUNNING" && job.startedAt
                  ? dashboard.range.to.getTime() - new Date(job.startedAt).getTime()
                  : null;
                const scope = job.scopeValue ? `${job.scopeType}: ${job.scopeValue}` : job.scopeType;
                const progress = job.totalTasks
                  ? `${count(job.completedTasks)} / ${count(job.totalTasks)} tasks · ${count(job.failedTasks)} failed`
                  : `${count(job.completedProducts)} products · ${count(job.completedImages)} images · ${count(job.failedImages)} failed images`;
                return (
                  <tr key={job.id} className="ds-table-row">
                    <td className="px-5 py-4 text-sm font-medium"><Link href={`/admin/catalogs/${encodeURIComponent(job.catalogSlug)}`} className="rounded-sm text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">{job.catalogName}</Link></td>
                    <td className="px-5 py-4 text-sm">{JOB_LABELS[job.jobType] ?? job.jobType}</td>
                    <td className="px-5 py-4 text-sm">{scope}</td>
                    <td className="px-5 py-4 text-sm"><CatalogStatusBadge status={job.status} /></td>
                    <td className="px-5 py-4 text-sm whitespace-nowrap">{dateTime(job.createdAt)}{job.startedAt && <span className="mt-1 block text-xs text-[#1a1a1a]/50">Started {dateTime(job.startedAt)}</span>}</td>
                    <td className="px-5 py-4 text-sm whitespace-nowrap">{elapsed != null ? `Running · elapsed ${formatDashboardDuration(elapsed)}` : formatDashboardDuration(job.processingDurationMs)}</td>
                    <td className="px-5 py-4 text-sm">{progress}</td>
                  </tr>
                );
              })}
              {dashboard.recentJobs.length === 0 && <tr><td colSpan={7} className="px-5 py-10 text-center text-sm text-[#1a1a1a]/55">{emptyActivity ? "No generation activity in this period." : "No recent jobs in this period."}</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Activity trend" description="Daily for 7 or 30 days, weekly for 90 days, and monthly for all time.">
        <ActivityTrendChart data={dashboard.trend} range={dashboard.range.range} />
      </Card>
    </div>
  );
}
