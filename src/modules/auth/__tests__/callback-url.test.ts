/** @jest-environment node */

import { resolveCallbackUrl } from "../lib/callback-url";

const ORIGIN = "https://myapp.labs.mapp.com";

describe("resolveCallbackUrl", () => {
  it("honours an absolute same-origin url in the area — what NextAuth sends", () => {
    expect(
      resolveCallbackUrl(
        `${ORIGIN}/account/products?q=dress&category=dresses#top`,
        "account",
        ORIGIN,
      ),
    ).toBe("/account/products?q=dress&category=dresses#top");
  });

  it("honours a rooted relative path in the area", () => {
    expect(resolveCallbackUrl("/account/products/123/abc", "account", ORIGIN)).toBe(
      "/account/products/123/abc",
    );
    expect(resolveCallbackUrl("/admin/accounts?x=1", "admin", ORIGIN)).toBe(
      "/admin/accounts?x=1",
    );
    expect(resolveCallbackUrl("/account", "account", ORIGIN)).toBe("/account");
  });

  it("falls back to the area root without a callback", () => {
    expect(resolveCallbackUrl(null, "account", ORIGIN)).toBe("/account");
    expect(resolveCallbackUrl(undefined, "admin", ORIGIN)).toBe("/admin");
    expect(resolveCallbackUrl("  ", "account", ORIGIN)).toBe("/account");
    // A repeated query param arrives as an array.
    expect(resolveCallbackUrl(["/account/a", "/account/b"] as never, "account", ORIGIN)).toBe(
      "/account",
    );
  });

  it("keeps each login in its own area", () => {
    // A customer sent to /admin would only bounce back to sign-in.
    expect(resolveCallbackUrl("/admin/accounts", "account", ORIGIN)).toBe("/account");
    expect(resolveCallbackUrl("/account/products", "admin", ORIGIN)).toBe("/admin");
    // A prefix is not an area.
    expect(resolveCallbackUrl("/accounting", "account", ORIGIN)).toBe("/account");
    expect(resolveCallbackUrl("/administrator", "admin", ORIGIN)).toBe("/admin");
  });

  it.each([
    "https://evil.example/account",
    "http://myapp.labs.mapp.com/account", // scheme differs → different origin
    "https://myapp.labs.mapp.com.evil.example/account",
    "//evil.example/account",
    "/\\evil.example/account",
    "\\\\evil.example/account",
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "account/products",
    "/account/../admin",
    "/account/%2e%2e/admin",
    "/auth/admin?callbackUrl=/account",
  ])("refuses %s", (raw) => {
    expect(resolveCallbackUrl(raw, "account", ORIGIN)).toBe("/account");
  });

  describe("without an origin (server side)", () => {
    it("honours a rooted relative path in the area", () => {
      expect(resolveCallbackUrl("/account/settings?tab=users#top", "account")).toBe(
        "/account/settings?tab=users#top",
      );
      expect(resolveCallbackUrl(undefined, "account")).toBe("/account");
    });

    it.each([
      // Cannot be checked against an origin, so refused even if it is ours.
      `${ORIGIN}/account/products`,
      "https://evil.example/account",
      "//evil.example/account",
      "/\\evil.example/account",
      "javascript:alert(1)",
      "/account/../admin",
      "/admin",
    ])("refuses %s", (raw) => {
      expect(resolveCallbackUrl(raw, "account")).toBe("/account");
    });
  });
});
