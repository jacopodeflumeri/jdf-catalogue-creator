"use client";

import Chart from "@/components/ui/Chart";
import EmptyState from "@/components/ui/EmptyState";

type DailyPoint = {
  day: string;
  model: string;
  estimatedCostUsd: number;
};

type ModelPoint = {
  model: string;
  estimatedCostUsd: number;
};

const SERIES_COLORS = ["#8d77f7", "#56d8c3", "#4d8bc9", "#d8a24a", "#e05566"];

export default function UsageCharts({
  daily,
  byModel,
}: {
  daily: DailyPoint[];
  byModel: ModelPoint[];
}) {
  if (daily.length === 0) {
    return (
      <EmptyState
        icon="chart"
        title="No usage in this period"
        description="Run a catalog generation or broaden the filters to see spend trends."
      />
    );
  }

  const models = Array.from(new Set(daily.map((point) => point.model)));
  const days = Array.from(new Set(daily.map((point) => point.day))).sort();
  const dailyLookup = new Map(
    daily.map((point) => [`${point.day}\u0000${point.model}`, point.estimatedCostUsd]),
  );
  const lineData = days.map((day) => ({
    label: day.slice(5),
    ...Object.fromEntries(
      models.map((model) => [model, dailyLookup.get(`${day}\u0000${model}`) ?? 0]),
    ),
  }));

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div className="xl:col-span-2 min-w-0">
        <Chart
          type="line"
          data={lineData}
          series={models.map((model, index) => ({
            key: model,
            name: model,
            color: SERIES_COLORS[index % SERIES_COLORS.length],
          }))}
          height={320}
          noPadding
        />
      </div>
      <div className="min-w-0">
        <Chart
          type="pie"
          data={byModel.map((row, index) => ({
            label: row.model,
            value: row.estimatedCostUsd,
            color: SERIES_COLORS[index % SERIES_COLORS.length],
          }))}
          currencySymbol="$"
          height={320}
          noPadding
        />
      </div>
    </div>
  );
}
