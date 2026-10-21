import { withPreservedSearchParams } from "../preserve-search-params";

describe("withPreservedSearchParams", () => {
  it("returns the bare path without a query", () => {
    expect(withPreservedSearchParams("/auth/admin", {})).toBe("/auth/admin");
    expect(withPreservedSearchParams("/auth/admin", { a: undefined })).toBe("/auth/admin");
  });

  it("forwards values, encoded", () => {
    expect(
      withPreservedSearchParams("/auth/admin", {
        callbackUrl: "http://localhost:3000/account/x?q=a b&y=1",
        error: "AuthRequired",
      }),
    ).toBe(
      "/auth/admin?callbackUrl=http%3A%2F%2Flocalhost%3A3000%2Faccount%2Fx%3Fq%3Da+b%26y%3D1&error=AuthRequired",
    );
  });

  it("keeps repeated keys in order", () => {
    expect(withPreservedSearchParams("/x", { tag: ["a", "b"], one: "1" })).toBe(
      "/x?tag=a&tag=b&one=1",
    );
  });
});
