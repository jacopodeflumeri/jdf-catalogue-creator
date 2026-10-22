/** @jest-environment node */

jest.mock("server-only", () => ({}));

import { prisma } from "@/lib/prisma/client";
import {
  disconnectPrisma,
  requireTestDatabase,
  truncateAllTables,
} from "@test/utils/db";
import { getLLMUsageDashboard } from "../usage-analytics";
import { parseLLMUsageFilters } from "../usage-filters";

describe("LiteLLM usage analytics", () => {
  beforeAll(() => requireTestDatabase());
  beforeEach(() => truncateAllTables());
  afterAll(() => disconnectPrisma());

  it("aggregates spend by model, feature, operation, and UTC day", async () => {
    await prisma.llmUsage.createMany({
      data: [
        {
          feature: "synthetic-catalog-product-generation",
          model: "openai/gpt-5.4-mini",
          operation: "CHAT_COMPLETION",
          inputTokens: 1_000,
          outputTokens: 200,
          estimatedCostUsd: "0.00165000",
          costBasis: "TOKEN_USAGE",
          createdAt: new Date("2026-10-20T10:00:00.000Z"),
        },
        {
          feature: "synthetic-catalog-image-front",
          model: "openai/gpt-image-2",
          operation: "IMAGE_GENERATION",
          estimatedCostUsd: "0.04100000",
          costBasis: "CATALOG_ESTIMATE",
          createdAt: new Date("2026-10-21T10:00:00.000Z"),
        },
        {
          feature: "experimental",
          model: "openai/unlisted",
          operation: "CHAT_COMPLETION",
          estimatedCostUsd: null,
          costBasis: "UNPRICED",
          createdAt: new Date("2026-10-21T11:00:00.000Z"),
        },
      ],
    });

    const filters = parseLLMUsageFilters(
      { range: "custom", from: "2026-10-20", to: "2026-10-21" },
      new Date("2026-10-22T00:00:00.000Z"),
    );
    const result = await getLLMUsageDashboard(filters);

    expect(result.summary).toMatchObject({
      requestCount: 3,
      estimatedCostUsd: 0.04265,
      inputTokens: 1_000,
      outputTokens: 200,
      unpricedRequests: 1,
    });
    expect(result.byModel.map((row) => row.model)).toEqual([
      "openai/gpt-image-2",
      "openai/gpt-5.4-mini",
      "openai/unlisted",
    ]);
    expect(result.daily).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ day: "2026-10-20", model: "openai/gpt-5.4-mini" }),
        expect.objectContaining({ day: "2026-10-21", model: "openai/gpt-image-2" }),
      ]),
    );
  });
});
