/** @jest-environment node */

/**
 * Starting "View as customer". The workspace choice must narrow to workspaces
 * of THIS company and refuse — never silently widen, drop or coerce — anything
 * else; the capability switch must hold; the audit row must name the admin.
 */
process.env.NEXTAUTH_SECRET = "preview-action-secret";

const mockConfig = { customerPreview: { enabled: true, services: [] as string[] } };
jest.mock("@/config", () => ({
  get config() {
    return mockConfig;
  },
}));

const mockCookieSet = jest.fn();
jest.mock("next/headers", () => ({ cookies: jest.fn(async () => ({ set: mockCookieSet })) }));
jest.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`);
  },
}));
const mockRequireAdmin = jest.fn();
jest.mock("@/modules/auth/server/require-auth", () => ({
  requireAdmin: (...a: unknown[]) => mockRequireAdmin(...a),
}));
const mockSubject = jest.fn();
jest.mock("../config/subject", () => ({
  resolvePreviewSubject: (...a: unknown[]) => mockSubject(...a),
}));
const mockAudit = jest.fn();
jest.mock("@/modules/audit", () => ({
  writeAuditLog: (...a: unknown[]) => mockAudit(...a),
  sessionAuditActor: (s: { user: { adminId?: string; email?: string } }) => ({
    mappUserId: s.user.adminId ? Number(s.user.adminId) : undefined,
    actorEmail: s.user.email,
  }),
}));
jest.mock("@/lib/utils/logger", () => ({
  __esModule: true,
  default: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(), log: jest.fn() },
}));

import { getCustomerPreviewOptionsAction, startCustomerPreviewAction } from "../server/actions";
import { verifyCustomerPreviewToken } from "../lib/token";
import { clearPreviewSubjectCache } from "../server/subject-cache";
import {
  CUSTOMER_PREVIEW_COOKIE,
  CUSTOMER_PREVIEW_COOKIE_GRACE_SECONDS,
  CUSTOMER_PREVIEW_TTL_SECONDS,
} from "../lib/constants";

const tokenSet = () =>
  verifyCustomerPreviewToken(mockCookieSet.mock.calls[0][1], "preview-action-secret");

const SUBJECT = {
  companyId: 10,
  accountId: null,
  name: "Acme Retail",
  workspaces: [
    { id: 29150, name: "Acme North" },
    { id: 29152, name: "Acme South" },
  ],
  services: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  clearPreviewSubjectCache();
  mockConfig.customerPreview.enabled = true;
  mockRequireAdmin.mockResolvedValue({ user: { email: "Ada@Mapp.com", adminId: "7", role: "admin" } });
  mockSubject.mockResolvedValue(SUBJECT);
});

describe("startCustomerPreviewAction", () => {
  it("requires admin access level (or SuperAdmin)", async () => {
    await expect(startCustomerPreviewAction({ companyId: 10 })).rejects.toThrow("REDIRECT /account");
    expect(mockRequireAdmin).toHaveBeenCalledWith({ requireAdminAccess: true });
  });

  it("previews the whole company when no workspace is chosen", async () => {
    await expect(startCustomerPreviewAction({ companyId: 10 })).rejects.toThrow("REDIRECT /account");
    expect(tokenSet()).toMatchObject({ adminEmail: "ada@mapp.com", subject: 10 });
    expect(tokenSet()?.workspaceIds).toBeUndefined();
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "customer_preview_start",
        entityType: "company",
        entityId: 10,
        mappUserId: 7,
        actorEmail: "Ada@Mapp.com",
        message: "Started viewing Acme Retail as a customer",
      }),
    );
    expect(mockAudit.mock.calls[0][0].data.workspaceIds).toBe("all");
  });

  it("sets an httpOnly, SameSite=Lax cookie that outlives the token by the grace period", async () => {
    await expect(startCustomerPreviewAction({ companyId: 10 })).rejects.toThrow("REDIRECT");
    const [name, , options] = mockCookieSet.mock.calls[0];
    expect(name).toBe(CUSTOMER_PREVIEW_COOKIE);
    expect(options).toEqual({
      httpOnly: true,
      sameSite: "lax",
      secure: false, // NODE_ENV=test; true in production
      path: "/",
      maxAge: CUSTOMER_PREVIEW_TTL_SECONDS + CUSTOMER_PREVIEW_COOKIE_GRACE_SECONDS,
    });
    const exp = tokenSet()!.exp;
    expect(exp - Date.now()).toBeLessThanOrEqual(CUSTOMER_PREVIEW_TTL_SECONDS * 1000);
  });

  it("narrows to the chosen workspace of this company and names it in the audit row", async () => {
    await expect(
      startCustomerPreviewAction({ companyId: 10, workspaceIds: [29152] }),
    ).rejects.toThrow("REDIRECT /account");
    expect(tokenSet()?.workspaceIds).toEqual([29152]);
    expect(mockAudit.mock.calls[0][0].message).toContain("(Acme South only)");
  });

  it("refuses a workspace that is not this company's, setting no cookie", async () => {
    await expect(
      startCustomerPreviewAction({ companyId: 10, workspaceIds: [999] }),
    ).rejects.toThrow("REDIRECT /admin/company-users?preview=not-found");
    expect(mockCookieSet).not.toHaveBeenCalled();
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it("refuses a partial match rather than dropping the unknown id", async () => {
    await expect(
      startCustomerPreviewAction({ companyId: 10, workspaceIds: [29150, 999] }),
    ).rejects.toThrow("preview=not-found");
    expect(mockCookieSet).not.toHaveBeenCalled();
  });

  it.each([[[]], [[0]], [[-1]], [[1.5]], [["29150"]], [[" 29150 "]], [[29150, 29150]]])(
    "refuses the malformed choice %p (no coercion, no trimming)",
    async (ids) => {
      await expect(
        startCustomerPreviewAction({ companyId: 10, workspaceIds: ids as number[] }),
      ).rejects.toThrow("preview=not-found");
      expect(mockCookieSet).not.toHaveBeenCalled();
    },
  );

  it.each([0, -3, "10", 1.5])("refuses the company id %p", async (companyId) => {
    await expect(
      startCustomerPreviewAction({ companyId: companyId as number }),
    ).rejects.toThrow("preview=not-found");
    expect(mockSubject).not.toHaveBeenCalled();
    expect(mockCookieSet).not.toHaveBeenCalled();
  });

  it("refuses an unknown company", async () => {
    mockSubject.mockResolvedValue(null);
    await expect(startCustomerPreviewAction({ companyId: 10 })).rejects.toThrow(
      "preview=not-found",
    );
    expect(mockCookieSet).not.toHaveBeenCalled();
  });

  it("reports an unreachable seam as unavailable, not as an unknown company", async () => {
    mockSubject.mockRejectedValue(new Error("catalog down"));
    await expect(startCustomerPreviewAction({ companyId: 10 })).rejects.toThrow(
      "preview=unavailable",
    );
    expect(mockCookieSet).not.toHaveBeenCalled();
  });

  it("refuses when the capability is off", async () => {
    mockConfig.customerPreview.enabled = false;
    await expect(
      startCustomerPreviewAction({ companyId: 10, returnTo: "/admin/companies/10" }),
    ).rejects.toThrow("REDIRECT /admin/companies/10?preview=disabled");
    expect(mockSubject).not.toHaveBeenCalled();
    expect(mockCookieSet).not.toHaveBeenCalled();
  });

  it("carries a sanitised returnTo, and refuses to carry an off-site one", async () => {
    await expect(
      startCustomerPreviewAction({ companyId: 10, returnTo: "/admin/companies/10?preview=ended" }),
    ).rejects.toThrow("REDIRECT /account");
    expect(tokenSet()?.returnTo).toBe("/admin/companies/10");

    mockCookieSet.mockClear();
    await expect(
      startCustomerPreviewAction({ companyId: 10, returnTo: "https://evil.example/admin" }),
    ).rejects.toThrow("REDIRECT /account");
    expect(tokenSet()?.returnTo).toBe("/admin/company-users");
  });

  it("re-reads the company rather than trusting a cached copy", async () => {
    await expect(startCustomerPreviewAction({ companyId: 10 })).rejects.toThrow("REDIRECT");
    await expect(startCustomerPreviewAction({ companyId: 10 })).rejects.toThrow("REDIRECT");
    expect(mockSubject).toHaveBeenCalledTimes(2);
  });
});

describe("getCustomerPreviewOptionsAction", () => {
  it("returns the company's workspaces to choose from", async () => {
    await expect(getCustomerPreviewOptionsAction(10)).resolves.toEqual({
      ok: true,
      companyName: "Acme Retail",
      workspaces: [
        { id: 29150, name: "Acme North" },
        { id: 29152, name: "Acme South" },
      ],
    });
    expect(mockRequireAdmin).toHaveBeenCalledWith({ requireAdminAccess: true });
  });

  it("says nothing when the capability is off or the company is unknown", async () => {
    mockSubject.mockResolvedValue(null);
    await expect(getCustomerPreviewOptionsAction(10)).resolves.toEqual({ ok: false });
    mockConfig.customerPreview.enabled = false;
    await expect(getCustomerPreviewOptionsAction(10)).resolves.toEqual({ ok: false });
  });
});
