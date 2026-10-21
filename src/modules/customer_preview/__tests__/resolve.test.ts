/** @jest-environment node */

/**
 * The "View as customer" overlay: the synthesized customer session and every
 * check on the preview cookie. next/headers and the subject seam are mocked;
 * the token is real (signed with the secret the module reads).
 */

process.env.NEXTAUTH_SECRET = "preview-test-secret";

const mockConfig = { customerPreview: { enabled: true, services: ["APP_SERVICE"] } };
jest.mock("@/config", () => ({
  get config() {
    return mockConfig;
  },
}));

const mockCookieGet = jest.fn();
const mockCookies = jest.fn(async () => ({ get: mockCookieGet }));
jest.mock("next/headers", () => ({ cookies: () => mockCookies() }));

const mockSubject = jest.fn();
jest.mock("../config/subject", () => ({
  resolvePreviewSubject: (...a: unknown[]) => mockSubject(...a),
}));

jest.mock("@/lib/utils/logger", () => ({
  __esModule: true,
  default: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(), log: jest.fn() },
}));

import type { Session } from "next-auth";
import {
  buildCustomerPreviewSession,
  canPreviewAsCustomer,
  canStartCustomerPreview,
  resolveCustomerPreview,
} from "../server/resolve";
import { clearPreviewSubjectCache } from "../server/subject-cache";
import { createCustomerPreviewToken } from "../lib/token";

function adminSession(overrides: Record<string, unknown> = {}): Session {
  return {
    expires: "2099-01-01T00:00:00.000Z",
    user: {
      id: "7",
      name: "Ada Admin",
      email: "Ada@Mapp.com",
      role: "admin",
      access: "admin",
      accessStatus: "active",
      adminId: "7",
      isSuperAdmin: false,
      ...overrides,
    },
  } as unknown as Session;
}

function token(
  claims: Partial<{ adminEmail: string; subject: number; exp: number; workspaceIds: number[] }> = {},
) {
  return createCustomerPreviewToken(
    { adminEmail: "ada@mapp.com", subject: 5046, exp: Date.now() + 60_000, ...claims },
    "preview-test-secret",
  );
}

const SUBJECT = {
  companyId: 5046,
  accountId: 42,
  name: "Acme Retail",
  workspaces: [
    { id: 29150, name: "Acme North" },
    { id: 29152, name: "Acme South" },
  ],
  services: ["APP_SERVICE"],
};

beforeEach(() => {
  jest.clearAllMocks();
  clearPreviewSubjectCache();
  mockConfig.customerPreview.enabled = true;
  mockSubject.mockResolvedValue(SUBJECT);
});

describe("canPreviewAsCustomer", () => {
  it("allows admin access level and SuperAdmins only", () => {
    expect(canPreviewAsCustomer(adminSession())).toBe(true);
    expect(canPreviewAsCustomer(adminSession({ access: "viewer", isSuperAdmin: true }))).toBe(true);
    expect(canPreviewAsCustomer(adminSession({ access: "editor" }))).toBe(false);
    expect(canPreviewAsCustomer(adminSession({ access: "viewer" }))).toBe(false);
    expect(canPreviewAsCustomer(adminSession({ role: "customer" }))).toBe(false);
    expect(canPreviewAsCustomer(null)).toBe(false);
  });

  it("refuses a suspended or denied admin", () => {
    expect(canPreviewAsCustomer(adminSession({ accessStatus: "suspended" }))).toBe(false);
    expect(canPreviewAsCustomer(adminSession({ accessStatus: "denied" }))).toBe(false);
  });

  it("canStartCustomerPreview is false whenever the capability is off", () => {
    expect(canStartCustomerPreview(adminSession())).toBe(true);
    mockConfig.customerPreview.enabled = false;
    expect(canStartCustomerPreview(adminSession())).toBe(false);
  });
});

describe("buildCustomerPreviewSession", () => {
  const session = buildCustomerPreviewSession(adminSession({ roles: ["x"], mappLdapGroups: ["g"] }), {
    subject: SUBJECT,
    granted: SUBJECT.workspaces,
    expiresAt: new Date("2026-10-15T12:30:00.000Z"),
    narrowed: false,
  });

  it("is a Company-Login customer session for the company", () => {
    expect(session.user.role).toBe("customer");
    expect(session.user.authSource).toBe("keycloak");
    expect(session.user.identityProvider).toBe("mapp-cloud");
    expect(session.user.companyId).toBe("5046");
    expect(session.user.accountId).toBe("42");
    expect(session.user.accountName).toBe("Acme Retail");
    expect(session.user.workspaces).toEqual([
      { workspaceId: "29150", services: ["APP_SERVICE"] },
      { workspaceId: "29152", services: ["APP_SERVICE"] },
    ]);
  });

  it("carries no admin powers and nothing of the admin's profile", () => {
    expect(session.user.access).toBeUndefined();
    expect(session.user.accessStatus).toBeUndefined();
    expect(session.user.adminId).toBeUndefined();
    expect(session.user.isSuperAdmin).toBe(false);
    expect(session.user.mappLdapGroups).toBeUndefined();
    expect(session.user.roles).toEqual([]);
    // No userId: nothing may resolve (or write) a CompanyUser row for it.
    expect(session.user.userId).toBeUndefined();
  });

  it("is marked as a preview, bound to the admin", () => {
    expect(session.user.customerPreview).toEqual({
      adminEmail: "ada@mapp.com",
      adminMappUserId: 7,
      companyId: 5046,
      companyName: "Acme Retail",
      expiresAt: "2026-10-15T12:30:00.000Z",
    });
  });

  it("uses a workspace's own service codes when the seam sets them", () => {
    const s = buildCustomerPreviewSession(adminSession(), {
      subject: SUBJECT,
      granted: [{ id: 1, name: "One", services: ["OTHER"] }],
      expiresAt: new Date(),
      narrowed: true,
    });
    expect(s.user.workspaces).toEqual([{ workspaceId: "1", services: ["OTHER"] }]);
    expect(s.user.customerPreview?.workspaceNames).toEqual(["One"]);
  });

  it("leaves accountId unset when the company maps to no local Account", () => {
    const s = buildCustomerPreviewSession(adminSession(), {
      subject: { ...SUBJECT, accountId: null },
      granted: [],
      expiresAt: new Date(),
      narrowed: false,
    });
    expect(s.user.accountId).toBeUndefined();
  });
});

describe("resolveCustomerPreview", () => {
  it("is inert when the capability is off: the cookie is not even read", async () => {
    mockConfig.customerPreview.enabled = false;
    mockCookieGet.mockReturnValue({ value: token() });
    await expect(resolveCustomerPreview(adminSession())).resolves.toEqual({ kind: "none" });
    expect(mockCookies).not.toHaveBeenCalled();
    expect(mockSubject).not.toHaveBeenCalled();
  });

  it("does nothing without a cookie, and never touches the seam", async () => {
    mockCookieGet.mockReturnValue(undefined);
    await expect(resolveCustomerPreview(adminSession())).resolves.toEqual({ kind: "none" });
    expect(mockSubject).not.toHaveBeenCalled();
  });

  it("ignores customers and anonymous sessions entirely (no cookie read)", async () => {
    mockCookieGet.mockReturnValue({ value: token() });
    await expect(resolveCustomerPreview(adminSession({ role: "customer" }))).resolves.toEqual({
      kind: "none",
    });
    await expect(resolveCustomerPreview(null)).resolves.toEqual({ kind: "none" });
    expect(mockCookies).not.toHaveBeenCalled();
  });

  it("turns a valid cookie into the company's customer session", async () => {
    mockCookieGet.mockReturnValue({ value: token() });
    const result = await resolveCustomerPreview(adminSession());
    if (result.kind !== "active") throw new Error(result.kind);
    expect(mockSubject).toHaveBeenCalledWith(5046);
    expect(result.session.user.companyId).toBe("5046");
    expect(result.session.user.workspaces?.map((w) => w.workspaceId)).toEqual(["29150", "29152"]);
    // The whole company is not "narrowed": the banner names no workspaces.
    expect(result.session.user.customerPreview?.workspaceNames).toBeUndefined();
  });

  it("narrows to the chosen workspaces and names them for the banner", async () => {
    mockCookieGet.mockReturnValue({ value: token({ workspaceIds: [29152] }) });
    const result = await resolveCustomerPreview(adminSession());
    if (result.kind !== "active") throw new Error(result.kind);
    expect(result.session.user.workspaces?.map((w) => w.workspaceId)).toEqual(["29152"]);
    expect(result.session.user.customerPreview?.workspaceNames).toEqual(["Acme South"]);
  });

  it("never widens: a chosen workspace the company no longer has grants nothing", async () => {
    // e.g. removed since the preview started, or another company's id.
    mockCookieGet.mockReturnValue({ value: token({ workspaceIds: [99999] }) });
    const result = await resolveCustomerPreview(adminSession());
    if (result.kind !== "active") throw new Error(result.kind);
    expect(result.session.user.workspaces).toEqual([]);
  });

  it("rejects another admin's cookie", async () => {
    mockCookieGet.mockReturnValue({ value: token({ adminEmail: "someone@mapp.com" }) });
    await expect(resolveCustomerPreview(adminSession())).resolves.toMatchObject({
      kind: "invalid",
      reason: "other-admin",
      status: "ended",
    });
    expect(mockSubject).not.toHaveBeenCalled();
  });

  it("rejects an expired cookie", async () => {
    mockCookieGet.mockReturnValue({ value: token({ exp: Date.now() - 1 }) });
    await expect(resolveCustomerPreview(adminSession())).resolves.toMatchObject({
      kind: "invalid",
      reason: "invalid-or-expired",
    });
  });

  it("rejects a forged cookie", async () => {
    mockCookieGet.mockReturnValue({ value: "eyJ2IjoxfQ.bm90LWEtc2ln" });
    await expect(resolveCustomerPreview(adminSession())).resolves.toMatchObject({
      kind: "invalid",
    });
  });

  it("stops honouring the cookie once the admin loses admin access", async () => {
    mockCookieGet.mockReturnValue({ value: token() });
    for (const s of [adminSession({ access: "editor" }), adminSession({ accessStatus: "suspended" })]) {
      await expect(resolveCustomerPreview(s)).resolves.toMatchObject({
        kind: "invalid",
        reason: "no-admin-access",
      });
    }
  });

  it("honours the caller's admin gate (IP allow-list, superadmin-only mode)", async () => {
    mockCookieGet.mockReturnValue({ value: token() });
    const adminGate = jest.fn(async () => false);
    await expect(resolveCustomerPreview(adminSession(), { adminGate })).resolves.toMatchObject({
      kind: "invalid",
      reason: "no-admin-access",
    });
    expect(adminGate).toHaveBeenCalled();
  });

  it("ends the preview as 'unavailable' when the company is gone", async () => {
    mockCookieGet.mockReturnValue({ value: token() });
    mockSubject.mockResolvedValue(null);
    await expect(resolveCustomerPreview(adminSession())).resolves.toEqual({
      kind: "invalid",
      reason: "missing-subject",
      status: "unavailable",
    });
  });

  it("ends the preview as 'unavailable' when the seam throws", async () => {
    mockCookieGet.mockReturnValue({ value: token() });
    mockSubject.mockRejectedValue(new Error("catalog down"));
    await expect(resolveCustomerPreview(adminSession())).resolves.toMatchObject({
      kind: "invalid",
      reason: "subject-error",
      status: "unavailable",
    });
  });

  it("re-uses the subject across requests for a short while", async () => {
    mockCookieGet.mockReturnValue({ value: token() });
    await resolveCustomerPreview(adminSession());
    await resolveCustomerPreview(adminSession());
    expect(mockSubject).toHaveBeenCalledTimes(1);
  });
});

describe("the synthesized session satisfies the app's eligibility policy", () => {
  // The configured service codes (CUSTOMER_PREVIEW_SERVICES) are what a
  // services-based policy reads, exactly as from a real login.
  const requiresService = (s: Session) =>
    (s.user.workspaces ?? []).some((w) => w.services.includes("APP_SERVICE"));

  it("passes with the configured codes, and fails without them", async () => {
    mockCookieGet.mockReturnValue({ value: token() });
    const ok = await resolveCustomerPreview(adminSession());
    if (ok.kind !== "active") throw new Error(ok.kind);
    expect(requiresService(ok.session)).toBe(true);

    clearPreviewSubjectCache();
    mockSubject.mockResolvedValue({ ...SUBJECT, services: [] });
    const without = await resolveCustomerPreview(adminSession());
    if (without.kind !== "active") throw new Error(without.kind);
    expect(requiresService(without.session)).toBe(false);
  });
});
