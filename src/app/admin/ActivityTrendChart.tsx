"use client";

import Chart from "@/components/ui/Chart";
import type { DashboardActivityBucket, DashboardRange } from "@/modules/synthetic_catalog/admin/dashboard-types";

function bucketLabel(value: string, range: DashboardRange): string {
  const date = new Date(value);
  if (range === "all") return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", timeZone: "UTC" }).format(date);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", timeZone: "UTC" }).format(date);
}

export default function ActivityTrendChart({ data, range }: { data: DashboardActivityBucket[]; range: DashboardRange }) {
  const chartData = data.map((point) => ({
    label: bucketLabel(point.start, range), products: point.products, images: point.images, jobs: point.jobs,
  }));
  const summary = data.length === 0
    ? "No generation activity in this period."
    : `${data.reduce((sum, point) => sum + point.products, 0)} products created, ${data.reduce((sum, point) => sum + point.images, 0)} images completed, and ${data.reduce((sum, point) => sum + point.jobs, 0)} jobs completed.`;

  if (data.length === 0) return <p className="px-6 py-8 text-center text-sm text-[#1a1a1a]/55">No generation activity in this period.</p>;

  return (
    <div aria-label={`Activity trend: ${summary}`}>
      <p className="mb-2 text-sm text-[#1a1a1a]/55">Products created · Images completed · Jobs completed</p>
      <Chart type="line" data={chartData} series={[
        { key: "products", name: "Products created", color: "#8d77f7" },
        { key: "images", name: "Images completed", color: "#56bfae" },
        { key: "jobs", name: "Jobs completed", color: "#4d8bc9" },
      ]} height={300} noPadding />
      <p className="sr-only">{summary}</p>
    </div>
  );
}
