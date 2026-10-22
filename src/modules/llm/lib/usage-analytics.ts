import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma/client";
import type { LLMUsageFilters } from "./usage-filters";

type DailyUsageRow = {
  day: string;
  model: string;
  calls: bigint;
  estimated_cost_usd: Prisma.Decimal | null;
};

function decimalNumber(value: Prisma.Decimal | null | undefined): number {
  return value == null ? 0 : Number(value);
}

function nullableNumber(value: number | null | undefined): number {
  return value ?? 0;
}

export async function getLLMUsageDashboard(filters: LLMUsageFilters) {
  const where: Prisma.LlmUsageWhereInput = {
    ...(filters.from || filters.toExclusive
      ? {
          createdAt: {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.toExclusive ? { lt: filters.toExclusive } : {}),
          },
        }
      : {}),
    ...(filters.model ? { model: filters.model } : {}),
    ...(filters.feature ? { feature: filters.feature } : {}),
    ...(filters.operation ? { operation: filters.operation } : {}),
  };

  const [summary, byModel, byFeature, byOperation, recent, modelOptions, featureOptions, daily] =
    await Promise.all([
      prisma.llmUsage.aggregate({
        where,
        _count: { _all: true },
        _sum: {
          estimatedCostUsd: true,
          inputTokens: true,
          cachedInputTokens: true,
          outputTokens: true,
        },
      }),
      prisma.llmUsage.groupBy({
        by: ["model"],
        where,
        _count: { _all: true },
        _sum: {
          estimatedCostUsd: true,
          inputTokens: true,
          outputTokens: true,
        },
        orderBy: { _sum: { estimatedCostUsd: "desc" } },
      }),
      prisma.llmUsage.groupBy({
        by: ["feature"],
        where,
        _count: { _all: true },
        _sum: { estimatedCostUsd: true },
        orderBy: { _sum: { estimatedCostUsd: "desc" } },
      }),
      prisma.llmUsage.groupBy({
        by: ["operation"],
        where,
        _count: { _all: true },
        _sum: { estimatedCostUsd: true },
        orderBy: { _sum: { estimatedCostUsd: "desc" } },
      }),
      prisma.llmUsage.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 30,
        select: {
          id: true,
          createdAt: true,
          feature: true,
          model: true,
          operation: true,
          inputTokens: true,
          outputTokens: true,
          estimatedCostUsd: true,
          costBasis: true,
        },
      }),
      prisma.llmUsage.findMany({
        distinct: ["model"],
        orderBy: { model: "asc" },
        select: { model: true },
      }),
      prisma.llmUsage.findMany({
        distinct: ["feature"],
        orderBy: { feature: "asc" },
        select: { feature: true },
      }),
      prisma.$queryRaw<DailyUsageRow[]>`
        SELECT
          TO_CHAR(DATE_TRUNC('day', "created_at"), 'YYYY-MM-DD') AS "day",
          "model",
          COUNT(*) AS "calls",
          SUM("estimated_cost_usd") AS "estimated_cost_usd"
        FROM "llm_usage"
        WHERE (${filters.from ?? null}::timestamp IS NULL OR "created_at" >= ${filters.from ?? null})
          AND (${filters.toExclusive ?? null}::timestamp IS NULL OR "created_at" < ${filters.toExclusive ?? null})
          AND (${filters.model ?? null}::text IS NULL OR "model" = ${filters.model ?? null})
          AND (${filters.feature ?? null}::text IS NULL OR "feature" = ${filters.feature ?? null})
          AND (${filters.operation ?? null}::text IS NULL OR "operation"::text = ${filters.operation ?? null})
        GROUP BY 1, 2
        ORDER BY 1 ASC, 2 ASC
      `,
    ]);

  const unpricedRequests = await prisma.llmUsage.count({
    where: { ...where, estimatedCostUsd: null },
  });

  const totalCostUsd = decimalNumber(summary._sum.estimatedCostUsd);
  const requestCount = summary._count._all;

  return {
    summary: {
      requestCount,
      estimatedCostUsd: totalCostUsd,
      averageCostUsd: requestCount > 0 ? totalCostUsd / requestCount : 0,
      inputTokens: nullableNumber(summary._sum.inputTokens),
      cachedInputTokens: nullableNumber(summary._sum.cachedInputTokens),
      outputTokens: nullableNumber(summary._sum.outputTokens),
      unpricedRequests,
    },
    byModel: byModel
      .map((row) => ({
        model: row.model,
        requests: row._count._all,
        estimatedCostUsd: decimalNumber(row._sum.estimatedCostUsd),
        inputTokens: nullableNumber(row._sum.inputTokens),
        outputTokens: nullableNumber(row._sum.outputTokens),
      }))
      .sort((a, b) => b.estimatedCostUsd - a.estimatedCostUsd || a.model.localeCompare(b.model)),
    byFeature: byFeature
      .map((row) => ({
        feature: row.feature,
        requests: row._count._all,
        estimatedCostUsd: decimalNumber(row._sum.estimatedCostUsd),
      }))
      .sort(
        (a, b) =>
          b.estimatedCostUsd - a.estimatedCostUsd || a.feature.localeCompare(b.feature),
      ),
    byOperation: byOperation
      .map((row) => ({
        operation: row.operation,
        requests: row._count._all,
        estimatedCostUsd: decimalNumber(row._sum.estimatedCostUsd),
      }))
      .sort(
        (a, b) =>
          b.estimatedCostUsd - a.estimatedCostUsd || a.operation.localeCompare(b.operation),
      ),
    daily: daily.map((row) => ({
      day: row.day,
      model: row.model,
      requests: Number(row.calls),
      estimatedCostUsd: decimalNumber(row.estimated_cost_usd),
    })),
    recent: recent.map((row) => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      feature: row.feature,
      model: row.model,
      operation: row.operation,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      estimatedCostUsd:
        row.estimatedCostUsd == null ? null : Number(row.estimatedCostUsd),
      costBasis: row.costBasis,
    })),
    options: {
      models: modelOptions.map((row) => row.model),
      features: featureOptions.map((row) => row.feature),
    },
  };
}
