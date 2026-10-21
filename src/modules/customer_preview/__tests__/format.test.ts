/** @jest-environment node */
import {
  formatPreviewEndTime,
  isCustomerPreviewStatus,
  sanitizePreviewReturnTo,
  withPreviewStatus,
} from "../lib/format";
import { allowsCustomerArea } from "../lib/constants";

describe("formatPreviewEndTime", () => {
  const iso = "2026-10-15T12:30:00.000Z";

  it("formats HH:MM in an explicit zone", () => {
    expect(formatPreviewEndTime(iso, "UTC")).toBe("12:30");
    expect(formatPreviewEndTime(iso, "Europe/Berlin")).toBe("14:30");
    expect(formatPreviewEndTime(iso, "Asia/Tokyo")).toBe("21:30");
  });

  it("returns null for a bad timestamp rather than 'Invalid Date'", () => {
    expect(formatPreviewEndTime("not a date", "UTC")).toBeNull();
  });
});

describe("sanitizePreviewReturnTo", () => {
  it.each([
    ["/admin/company-users?q=acme", "/admin/company-users?q=acme"],
    ["/admin/companies/12?preview=exited&tab=x", "/admin/companies/12?tab=x"],
    ["/admin", "/admin"],
  ])("keeps the admin path %p", (raw, expected) => {
    expect(sanitizePreviewReturnTo(raw)).toBe(expected);
  });

  it.each([
    undefined,
    "",
    "https://evil.example/admin",
    "//evil.example/admin",
    "/account",
    "/\\evil.example",
    "javascript:alert(1)",
    "/admin/../account",
  ])("falls back to the company-users page for %p", (raw) => {
    expect(sanitizePreviewReturnTo(raw)).toBe("/admin/company-users");
  });
});

describe("withPreviewStatus", () => {
  it("sets (and replaces) the preview param", () => {
    expect(withPreviewStatus("/admin/company-users", "exited")).toBe(
      "/admin/company-users?preview=exited",
    );
    expect(withPreviewStatus("/admin/x?q=a&preview=ended", "exited")).toBe(
      "/admin/x?q=a&preview=exited",
    );
  });

  it("never leaves the admin area", () => {
    expect(withPreviewStatus("https://evil.example/", "ended")).toBe(
      "/admin/company-users?preview=ended",
    );
  });

  it("only knows the documented statuses", () => {
    expect(isCustomerPreviewStatus("exited")).toBe(true);
    expect(isCustomerPreviewStatus("<script>")).toBe(false);
    expect(isCustomerPreviewStatus(["exited"])).toBe(false);
  });
});

describe("allowsCustomerArea (the proxy gate)", () => {
  const base = { isApi: false, previewEnabled: true, hasPreviewCookie: false };

  it("lets customers in, and keeps everyone else out by default", () => {
    expect(allowsCustomerArea({ ...base, role: "customer" })).toBe(true);
    expect(allowsCustomerArea({ ...base, role: "admin" })).toBe(false);
    expect(allowsCustomerArea({ ...base })).toBe(false);
  });

  it("keeps the legacy admin-with-accountId view working", () => {
    expect(allowsCustomerArea({ ...base, role: "admin", accountId: "3" })).toBe(true);
  });

  it("lets an admin with a preview cookie into PAGES while the capability is on", () => {
    expect(allowsCustomerArea({ ...base, role: "admin", hasPreviewCookie: true })).toBe(true);
    expect(
      allowsCustomerArea({ ...base, role: "admin", hasPreviewCookie: true, isApi: true }),
    ).toBe(false);
    expect(
      allowsCustomerArea({ ...base, role: "admin", hasPreviewCookie: true, previewEnabled: false }),
    ).toBe(false);
  });

  it("never lets a non-admin in on a preview cookie", () => {
    expect(allowsCustomerArea({ ...base, hasPreviewCookie: true })).toBe(false);
  });
});
