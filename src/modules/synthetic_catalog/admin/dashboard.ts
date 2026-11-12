import type { DashboardRange, ResolvedDashboardRange } from "./dashboard-types";

export const DASHBOARD_RANGES: readonly DashboardRange[] = ["7d", "30d", "90d", "all"];

export function parseDashboardRange(value: string | null | undefined): DashboardRange {
  return DASHBOARD_RANGES.includes(value as DashboardRange) ? value as DashboardRange : "30d";
}

export function resolveDashboardRange(value: string | null | undefined, now = new Date()): ResolvedDashboardRange {
  const range = parseDashboardRange(value);
  const to = new Date(now);
  if (range === "all") return { range, from: null, to, label: "All time" };
  const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - days);
  return { range, from, to, label: `${from.toISOString().slice(0, 10)} – ${to.toISOString().slice(0, 10)}` };
}

export function validProcessingDuration(startedAt: Date | null, finishedAt: Date | null): number | null {
  if (!startedAt || !finishedAt) return null;
  const duration = finishedAt.getTime() - startedAt.getTime();
  return Number.isFinite(duration) && duration >= 0 ? duration : null;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

export function safeSuccessRate(successful: number, failedOrCancelled: number): number | null {
  const terminal = successful + failedOrCancelled;
  return terminal === 0 ? null : successful / terminal;
}
