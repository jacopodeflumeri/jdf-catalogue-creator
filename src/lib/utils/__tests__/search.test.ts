/** @jest-environment node */

import { escapeLikePattern, toContainsTerm } from "../search";

describe("escapeLikePattern", () => {
  it("escapes LIKE metacharacters, backslash first", () => {
    expect(escapeLikePattern("50%_off")).toBe("50\\%\\_off");
    expect(escapeLikePattern("a\\b")).toBe("a\\\\b");
    expect(escapeLikePattern("\\%")).toBe("\\\\\\%");
    expect(escapeLikePattern("%%")).toBe("\\%\\%");
    expect(escapeLikePattern("__")).toBe("\\_\\_");
  });

  it("leaves ordinary text alone", () => {
    expect(escapeLikePattern("plain text 123")).toBe("plain text 123");
    expect(escapeLikePattern("jane.doe@mapp.com")).toBe("jane.doe@mapp.com");
    expect(escapeLikePattern("")).toBe("");
  });
});

describe("toContainsTerm", () => {
  it("trims and escapes", () => {
    expect(toContainsTerm("  50% ")).toBe("50\\%");
  });

  it("is undefined for a missing or blank term", () => {
    expect(toContainsTerm(undefined)).toBeUndefined();
    expect(toContainsTerm(null)).toBeUndefined();
    expect(toContainsTerm("   ")).toBeUndefined();
  });
});
