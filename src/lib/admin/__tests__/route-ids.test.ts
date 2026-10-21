import { parseRouteId } from "../route-ids";

describe("parseRouteId", () => {
  it("parses clean non-negative integers", () => {
    expect(parseRouteId("5046")).toBe(5046);
    expect(parseRouteId("29150")).toBe(29150);
    expect(parseRouteId("0")).toBe(0);
  });

  it("trims surrounding whitespace", () => {
    expect(parseRouteId("  42 ")).toBe(42);
  });

  it("rejects non-integer / junk segments", () => {
    expect(parseRouteId("")).toBeNull();
    expect(parseRouteId("   ")).toBeNull();
    expect(parseRouteId("abc")).toBeNull();
    expect(parseRouteId("12abc")).toBeNull();
    expect(parseRouteId("1.5")).toBeNull();
    expect(parseRouteId("-5")).toBeNull();
  });

  it("rejects nullish input", () => {
    expect(parseRouteId(undefined)).toBeNull();
    expect(parseRouteId(null)).toBeNull();
  });

  it("rejects integers beyond the safe range", () => {
    expect(parseRouteId("9".repeat(40))).toBeNull();
  });
});
