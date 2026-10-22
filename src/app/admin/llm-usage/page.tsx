import type { Metadata } from "next";
import Link from "next/link";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import NoticeBox from "@/components/ui/NoticeBox";
import PageHeader from "@/components/ui/PageHeader";
import { pageTitle } from "@/lib/utils/metadata";
import { requireAdmin } from "@/modules/auth/server";
import { getLLMUsageDashboard } from "@/modules/llm/lib/usage-analytics";
import {
  LLM_USAGE_OPERATIONS,
  parseLLMUsageFilters,
  type LLMUsageFilterInput,
} from "@/modules/llm/lib/usage-filters";
import { listModelPricing } from "@/modules/llm/lib/pricing";
import UsageCharts from "./UsageCharts";

export const metadata: Metadata = {
  title: pageTitle("LiteLLM Usage"),
  description: "Monitor estimated LLM usage and cost by model and feature",
};

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function formatUsd(value: number | null, minimumFractionDigits = 4): string {
  if (value == null) return "Unpriced";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value < 1 ? minimumFractionDigits : 2,
    maximumFractionDigits: value < 1 ? 6 : 2,
  }).format(value);
}

function formatCount(value: number | null): string {
  return value == null ? "—" : new Intl.NumberFormat("en-US").format(value);
}

function humanize(value: string): string {
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <Card className="h-full">
      <p className="text-sm font-medium text-[#1a1a1a]/55">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-[#1a1a1a]">{value}</p>
      <p className="mt-2 text-xs text-[#1a1a1a]/45">{detail}</p>
    </Card>
  );
}

const selectClass =
  "ds-input w-full px-4 py-3 text-sm focus-visible:outline-none disabled:bg-white/35";

export default async function LLMUsagePage({ searchParams }: PageProps) {
  await requireAdmin({});

  const raw = await searchParams;
  const input: LLMUsageFilterInput = {
    range: first(raw.range),
    from: first(raw.from),
    to: first(raw.to),
    model: first(raw.model),
    feature: first(raw.feature),
    operation: first(raw.operation),
  };
  const filters = parseLLMUsageFilters(input);
  const dashboard = await getLLMUsageDashboard(filters);
  const pricing = listModelPricing();
  const total = dashboard.summary.estimatedCostUsd;

  return (
    <div className="px-8 py-6 space-y-8">
      <PageHeader
        title="LiteLLM Usage"
        description="Estimated application spend by time, model, feature, and operation."
      />

      <NoticeBox variant="info" title="Estimated cost, not an invoice">
        LiteLLM remains the source of truth for billing and budget enforcement. This view starts
        collecting after its database migration and uses snapshotted public model prices.
      </NoticeBox>

      <Card title="Filters" description={`Currently showing ${filters.label.toLowerCase()}.`}>
        <form method="get" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4 items-end">
          <label className="space-y-2">
            <span className="block text-sm font-semibold text-[#1a1a1a]">Timeframe</span>
            <select name="range" defaultValue={filters.range} className={selectClass}>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="custom">Custom dates</option>
              <option value="all">All time</option>
            </select>
          </label>
          <label className="space-y-2">
            <span className="block text-sm font-semibold text-[#1a1a1a]">From</span>
            <input name="from" type="date" defaultValue={filters.fromInput} className={selectClass} />
          </label>
          <label className="space-y-2">
            <span className="block text-sm font-semibold text-[#1a1a1a]">To</span>
            <input name="to" type="date" defaultValue={filters.toInput} className={selectClass} />
          </label>
          <label className="space-y-2">
            <span className="block text-sm font-semibold text-[#1a1a1a]">Model</span>
            <select name="model" defaultValue={filters.model ?? "all"} className={selectClass}>
              <option value="all">All models</option>
              {dashboard.options.models.map((model) => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="block text-sm font-semibold text-[#1a1a1a]">Feature</span>
            <select name="feature" defaultValue={filters.feature ?? "all"} className={selectClass}>
              <option value="all">All features</option>
              {dashboard.options.features.map((feature) => (
                <option key={feature} value={feature}>{humanize(feature)}</option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="block text-sm font-semibold text-[#1a1a1a]">Operation</span>
            <select
              name="operation"
              defaultValue={filters.operation ?? "all"}
              className={selectClass}
            >
              <option value="all">All operations</option>
              {LLM_USAGE_OPERATIONS.map((operation) => (
                <option key={operation} value={operation}>{humanize(operation)}</option>
              ))}
            </select>
          </label>
          <div className="md:col-span-2 xl:col-span-6 flex justify-end gap-3">
            <Link href="/admin/llm-usage" className="ghost-button px-5 py-3 text-sm font-semibold rounded-xl">
              Reset
            </Link>
            <Button type="submit" size="sm">Apply filters</Button>
          </div>
        </form>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <SummaryCard label="Estimated spend" value={formatUsd(total)} detail={filters.label} />
        <SummaryCard
          label="Requests"
          value={formatCount(dashboard.summary.requestCount)}
          detail={`${formatUsd(dashboard.summary.averageCostUsd)} average`}
        />
        <SummaryCard
          label="Input tokens"
          value={formatCount(dashboard.summary.inputTokens)}
          detail={`${formatCount(dashboard.summary.cachedInputTokens)} cached`}
        />
        <SummaryCard
          label="Output tokens"
          value={formatCount(dashboard.summary.outputTokens)}
          detail="Text and image output"
        />
        <SummaryCard
          label="Unpriced requests"
          value={formatCount(dashboard.summary.unpricedRequests)}
          detail="Unknown model or missing usage"
        />
      </div>

      <Card title="Spend trend" description="Daily estimated USD spend, split by model.">
        <UsageCharts daily={dashboard.daily} byModel={dashboard.byModel} />
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card title="By model" description="Cost share and token volume for the selected period." noPaddingContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="ds-table-head">
                <tr>
                  {['Model', 'Requests', 'Input', 'Output', 'Spend', 'Share'].map((heading) => (
                    <th key={heading} className="px-5 py-3 text-left text-xs font-semibold text-[#1a1a1a]/55 uppercase tracking-wider">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dashboard.byModel.map((row) => (
                  <tr key={row.model} className="ds-table-row">
                    <td className="px-5 py-4 text-sm font-medium text-[#1a1a1a]">{row.model}</td>
                    <td className="px-5 py-4 text-sm">{formatCount(row.requests)}</td>
                    <td className="px-5 py-4 text-sm">{formatCount(row.inputTokens)}</td>
                    <td className="px-5 py-4 text-sm">{formatCount(row.outputTokens)}</td>
                    <td className="px-5 py-4 text-sm font-semibold">{formatUsd(row.estimatedCostUsd)}</td>
                    <td className="px-5 py-4 text-sm">{total > 0 ? `${((row.estimatedCostUsd / total) * 100).toFixed(1)}%` : '0%'}</td>
                  </tr>
                ))}
                {dashboard.byModel.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-[#1a1a1a]/55">No usage in this period.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="By feature" description="Which application workflows drive spend." noPaddingContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="ds-table-head">
                <tr>
                  {['Feature', 'Requests', 'Spend', 'Share'].map((heading) => (
                    <th key={heading} className="px-5 py-3 text-left text-xs font-semibold text-[#1a1a1a]/55 uppercase tracking-wider">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dashboard.byFeature.map((row) => (
                  <tr key={row.feature} className="ds-table-row">
                    <td className="px-5 py-4 text-sm font-medium text-[#1a1a1a]">{humanize(row.feature)}</td>
                    <td className="px-5 py-4 text-sm">{formatCount(row.requests)}</td>
                    <td className="px-5 py-4 text-sm font-semibold">{formatUsd(row.estimatedCostUsd)}</td>
                    <td className="px-5 py-4 text-sm">{total > 0 ? `${((row.estimatedCostUsd / total) * 100).toFixed(1)}%` : '0%'}</td>
                  </tr>
                ))}
                {dashboard.byFeature.length === 0 && (
                  <tr><td colSpan={4} className="px-5 py-10 text-center text-sm text-[#1a1a1a]/55">No usage in this period.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card title="Operations" description="Spend split between text generation, image generation, and image edits.">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {dashboard.byOperation.map((row) => (
            <div key={row.operation} className="glass-surface rounded-xl p-4">
              <p className="text-sm font-medium text-[#1a1a1a]/55">{humanize(row.operation)}</p>
              <p className="mt-2 text-2xl font-bold text-[#1a1a1a]">{formatUsd(row.estimatedCostUsd)}</p>
              <p className="mt-1 text-xs text-[#1a1a1a]/45">{formatCount(row.requests)} requests</p>
            </div>
          ))}
          {dashboard.byOperation.length === 0 && (
            <p className="text-sm text-[#1a1a1a]/55">No operation data in this period.</p>
          )}
        </div>
      </Card>

      <Card title="Recent calls" description="The latest 30 successful responses matching the filters." noPaddingContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="ds-table-head">
              <tr>
                {['Time (UTC)', 'Feature', 'Model', 'Operation', 'Tokens in / out', 'Cost', 'Basis'].map((heading) => (
                  <th key={heading} className="px-5 py-3 text-left text-xs font-semibold text-[#1a1a1a]/55 uppercase tracking-wider">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dashboard.recent.map((row) => (
                <tr key={row.id} className="ds-table-row">
                  <td className="px-5 py-4 text-sm whitespace-nowrap">{row.createdAt.replace('T', ' ').slice(0, 19)}</td>
                  <td className="px-5 py-4 text-sm">{humanize(row.feature)}</td>
                  <td className="px-5 py-4 text-sm font-medium">{row.model}</td>
                  <td className="px-5 py-4 text-sm">{humanize(row.operation)}</td>
                  <td className="px-5 py-4 text-sm whitespace-nowrap">{formatCount(row.inputTokens)} / {formatCount(row.outputTokens)}</td>
                  <td className="px-5 py-4 text-sm font-semibold">{formatUsd(row.estimatedCostUsd)}</td>
                  <td className="px-5 py-4 text-sm">
                    <Badge variant={row.costBasis === 'TOKEN_USAGE' ? 'success' : row.costBasis === 'CATALOG_ESTIMATE' ? 'warning' : 'gray'} size="xs">
                      {humanize(row.costBasis)}
                    </Badge>
                  </td>
                </tr>
              ))}
              {dashboard.recent.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-sm text-[#1a1a1a]/55">No calls match these filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Price reference" description="USD rates used for new local usage records; every record keeps its own snapshot.">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {pricing.map((item) => (
            <div key={item.model} className="glass-surface rounded-xl p-5 space-y-3">
              <div>
                <p className="font-semibold text-[#1a1a1a]">{item.model}</p>
                <p className="text-xs text-[#1a1a1a]/45">Effective {item.effectiveDate}</p>
              </div>
              <dl className="space-y-1 text-sm text-[#1a1a1a]/70">
                <div className="flex justify-between gap-4"><dt>Text input / 1M</dt><dd>{formatUsd(item.tokenRatesPerMillion.textInput, 2)}</dd></div>
                {item.tokenRatesPerMillion.textOutput != null && <div className="flex justify-between gap-4"><dt>Text output / 1M</dt><dd>{formatUsd(item.tokenRatesPerMillion.textOutput, 2)}</dd></div>}
                {item.tokenRatesPerMillion.imageInput != null && <div className="flex justify-between gap-4"><dt>Image input / 1M</dt><dd>{formatUsd(item.tokenRatesPerMillion.imageInput, 2)}</dd></div>}
                {item.tokenRatesPerMillion.imageOutput != null && <div className="flex justify-between gap-4"><dt>Image output / 1M</dt><dd>{formatUsd(item.tokenRatesPerMillion.imageOutput, 2)}</dd></div>}
              </dl>
              {item.note && <p className="text-xs text-[#1a1a1a]/50 leading-relaxed">{item.note}</p>}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
