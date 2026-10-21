/** @jest-environment node */
import {
  createCustomerPreviewToken,
  readCustomerPreviewToken,
  verifyCustomerPreviewToken,
} from "../lib/token";

const SECRET = "test-secret";
const NOW = 1_800_000_000_000;
const claims = { adminEmail: "Admin@Mapp.com", subject: 42, exp: NOW + 60_000 };

describe("customer preview token", () => {
  it("round-trips, lower-casing the admin email", () => {
    const token = createCustomerPreviewToken(claims, SECRET);
    expect(verifyCustomerPreviewToken(token, SECRET, NOW)).toEqual({
      v: 1,
      adminEmail: "admin@mapp.com",
      subject: 42,
      exp: NOW + 60_000,
    });
  });

  it("rejects an expired token", () => {
    const token = createCustomerPreviewToken(claims, SECRET);
    expect(verifyCustomerPreviewToken(token, SECRET, NOW + 60_000)).toBeNull();
  });

  it("still READS an expired token's claims for housekeeping, never a forged one", () => {
    const token = createCustomerPreviewToken({ ...claims, exp: NOW - 1 }, SECRET);
    expect(readCustomerPreviewToken(token, SECRET)?.subject).toBe(42);
    expect(readCustomerPreviewToken(token, "other-secret")).toBeNull();
  });

  it("rejects a token signed with another secret", () => {
    const token = createCustomerPreviewToken(claims, "other-secret");
    expect(verifyCustomerPreviewToken(token, SECRET, NOW)).toBeNull();
  });

  it("rejects a tampered payload", () => {
    const token = createCustomerPreviewToken(claims, SECRET);
    const [, sig] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({ v: 1, adminEmail: "admin@mapp.com", subject: 7, exp: NOW + 60_000 }),
    ).toString("base64url");
    expect(verifyCustomerPreviewToken(`${forged}.${sig}`, SECRET, NOW)).toBeNull();
  });

  it.each([null, undefined, "", "abc", "a.b.c", "x.y", 42])("rejects junk %p", (junk) => {
    expect(verifyCustomerPreviewToken(junk as never, SECRET, NOW)).toBeNull();
  });

  it("rejects everything without a secret, and refuses to sign without one", () => {
    const token = createCustomerPreviewToken(claims, SECRET);
    expect(verifyCustomerPreviewToken(token, "", NOW)).toBeNull();
    expect(() => createCustomerPreviewToken(claims, "")).toThrow();
  });

  it("carries an optional workspace list — the narrowed grant", () => {
    const token = createCustomerPreviewToken({ ...claims, workspaceIds: [29150] }, SECRET);
    expect(verifyCustomerPreviewToken(token, SECRET, NOW)?.workspaceIds).toEqual([29150]);
  });

  it.each([[[]], [[0]], [[1.5]], [["29150"]], [Array.from({ length: 51 }, (_, i) => i + 1)]])(
    "rejects a workspace list of %p",
    (workspaceIds) => {
      const token = createCustomerPreviewToken(
        { ...claims, workspaceIds: workspaceIds as number[] },
        SECRET,
      );
      expect(verifyCustomerPreviewToken(token, SECRET, NOW)).toBeNull();
    },
  );

  it("carries returnTo, and rejects one that is not a short string", () => {
    const ok = createCustomerPreviewToken({ ...claims, returnTo: "/admin/company-users?q=a" }, SECRET);
    expect(verifyCustomerPreviewToken(ok, SECRET, NOW)?.returnTo).toBe("/admin/company-users?q=a");
    const long = createCustomerPreviewToken({ ...claims, returnTo: `/admin/${"x".repeat(600)}` }, SECRET);
    expect(verifyCustomerPreviewToken(long, SECRET, NOW)).toBeNull();
  });

  it.each([0, -1, 1.5, "42"])("rejects a well-signed token with subject %p", (subject) => {
    const token = createCustomerPreviewToken({ ...claims, subject: subject as number }, SECRET);
    expect(verifyCustomerPreviewToken(token, SECRET, NOW)).toBeNull();
  });
});
