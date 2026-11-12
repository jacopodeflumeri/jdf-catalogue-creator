import { median, parseDashboardRange, resolveDashboardRange, safeSuccessRate, validProcessingDuration } from "../dashboard";

describe("catalogue Dashboard definitions", () => {
  it("uses 30 days by default and safely falls back for unknown range values", () => {
    expect(parseDashboardRange(undefined)).toBe("30d");
    expect(parseDashboardRange("quarter")).toBe("30d");
  });

  it.each([["7d", 7], ["30d", 30], ["90d", 90]] as const)("resolves %s to an exact rolling %i-day range", (range, days) => {
    const now = new Date("2026-11-12T12:30:00.000Z");
    const resolved = resolveDashboardRange(range, now);
    expect(resolved.from?.getTime()).toBe(now.getTime() - days * 24 * 60 * 60 * 1000);
    expect(resolved.to).toEqual(now);
  });

  it("represents All time without a fabricated start date", () => {
    const resolved = resolveDashboardRange("all", new Date("2026-11-12T12:30:00.000Z"));
    expect(resolved.from).toBeNull();
    expect(resolved.to.toISOString()).toBe("2026-11-12T12:30:00.000Z");
    expect(resolved.label).toBe("All time");
  });

  it("accepts only valid ordered persisted processing timestamps", () => {
    expect(validProcessingDuration(new Date(100), new Date(900))).toBe(800);
    expect(validProcessingDuration(null, new Date(900))).toBeNull();
    expect(validProcessingDuration(new Date(900), new Date(100))).toBeNull();
  });

  it("calculates medians and leaves empty durations unavailable", () => {
    expect(median([])).toBeNull();
    expect(median([10, 30, 20])).toBe(20);
    expect(median([10, 30, 20, 40])).toBe(25);
  });

  it("does not divide by zero for periods with no terminal jobs", () => {
    expect(safeSuccessRate(0, 0)).toBeNull();
    expect(safeSuccessRate(3, 1)).toBe(0.75);
  });
});
