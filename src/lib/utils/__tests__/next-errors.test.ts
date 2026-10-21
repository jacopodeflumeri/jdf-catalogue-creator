import { isNextControlFlowError } from "../next-errors";

describe("isNextControlFlowError", () => {
  it("detects notFound() / redirect() / HTTP-fallback signals by digest", () => {
    expect(isNextControlFlowError({ digest: "NEXT_NOT_FOUND" })).toBe(true);
    expect(
      isNextControlFlowError({ digest: "NEXT_REDIRECT;replace;/login;307;" }),
    ).toBe(true);
    expect(
      isNextControlFlowError({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" }),
    ).toBe(true);
  });

  it("does not flag real errors", () => {
    expect(isNextControlFlowError(new Error("boom"))).toBe(false);
    expect(isNextControlFlowError({ digest: "some-other-digest" })).toBe(false);
    expect(isNextControlFlowError({ digest: 123 })).toBe(false);
  });

  it("handles nullish / non-object input", () => {
    expect(isNextControlFlowError(null)).toBe(false);
    expect(isNextControlFlowError(undefined)).toBe(false);
    expect(isNextControlFlowError("NEXT_NOT_FOUND")).toBe(false);
  });
});
