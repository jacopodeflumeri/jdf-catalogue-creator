/** @jest-environment node */

import { parseLLMUsageFilters } from "../usage-filters";

const NOW = new Date("2026-10-22T14:00:00.000Z");

describe("LiteLLM usage filters", () => {
  it("defaults to the last 30 UTC calendar days", () => {
    const result = parseLLMUsageFilters({}, NOW);
    expect(result.range).toBe("30d");
    expect(result.from?.toISOString()).toBe("2026-09-23T00:00:00.000Z");
    expect(result.toExclusive?.toISOString()).toBe("2026-10-23T00:00:00.000Z");
  });

  it("accepts an inclusive custom date range", () => {
    const result = parseLLMUsageFilters(
      { range: "custom", from: "2026-10-01", to: "2026-10-15" },
      NOW,
    );
    expect(result.range).toBe("custom");
    expect(result.from?.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(result.toExclusive?.toISOString()).toBe("2026-10-16T00:00:00.000Z");
  });

  it("falls back safely when a custom range is invalid", () => {
    const result = parseLLMUsageFilters(
      { range: "custom", from: "2026-10-20", to: "2026-10-01" },
      NOW,
    );
    expect(result.range).toBe("30d");
  });

  it("normalizes all filters and rejects unknown operations", () => {
    const result = parseLLMUsageFilters({
      range: "all",
      model: " openai/gpt-5.4-mini ",
      feature: "synthetic-catalog-product-generation",
      operation: "not-real",
    });
    expect(result).toMatchObject({
      range: "all",
      model: "openai/gpt-5.4-mini",
      feature: "synthetic-catalog-product-generation",
      operation: undefined,
    });
  });
});
