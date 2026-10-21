/** @jest-environment node */

/**
 * Ending a "View as customer" preview. The regression this pins: in production
 * `request.url` is the container's internal address (0.0.0.0:3000), so the
 * redirect must be relative — never built from the request URL. Also: only the
 * admin's own live preview is audited, only their own cookie chooses where
 * they land, and it works with the capability off (stale cookies still clear).
 */

process.env.NEXTAUTH_SECRET = "end-route-test-secret";

const mockConfig = { customerPreview: { enabled: true, services: [] as string[] } };
jest.mock("@/config", () => ({
  get config() {
    return mockConfig;
  },
}));
const mockSession = jest.fn();
jest.mock("next-auth", () => ({ getServerSession: () => mockSession() }));
jest.mock("@/modules/auth/config/nextauth", () => ({ authOptions: {} }));
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

import { NextRequest } from "next/server";
import { GET } from "../route";
import { createCustomerPreviewToken } from "@/modules/customer_preview/lib/token";
import { CUSTOMER_PREVIEW_COOKIE } from "@/modules/customer_preview/lib/constants";

function request(path: string, cookie?: string): NextRequest {
  // The internal address the app sees behind the load balancer.
  const req = new NextRequest(`https://0.0.0.0:3000${path}`);
  if (cookie) req.cookies.set(CUSTOMER_PREVIEW_COOKIE, cookie);
  return req;
}

function token(claims: Partial<{ adminEmail: string; exp: number; returnTo: string }> = {}) {
  return createCustomerPreviewToken(
    { adminEmail: "ada@mapp.com", subject: 42, exp: Date.now() + 60_000, ...claims },
    "end-route-test-secret",
  );
}

const admin = { user: { role: "admin", email: "ada@mapp.com", adminId: "7" } };
const END = "/admin/customer-preview/end";

beforeEach(() => {
  jest.clearAllMocks();
  mockConfig.customerPreview.enabled = true;
  mockSession.mockResolvedValue(admin);
});

describe("GET /admin/customer-preview/end", () => {
  it("redirects with a relative Location, never the internal host", async () => {
    const res = await GET(request(END));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("/admin/company-users?preview=exited");
  });

  it("returns to where this admin started the preview", async () => {
    const res = await GET(request(END, token({ returnTo: "/admin/companies/42?tab=a" })));
    expect(res.headers.get("location")).toBe("/admin/companies/42?tab=a&preview=exited");
  });

  it("re-sanitises returnTo even from a signed token", async () => {
    const res = await GET(request(END, token({ returnTo: "https://evil.example/admin" })));
    expect(res.headers.get("location")).toBe("/admin/company-users?preview=exited");
  });

  it.each([
    ["ended", "ended"],
    ["unavailable", "unavailable"],
    ["bogus", "exited"],
  ])("reports reason=%p as %p", async (reason, status) => {
    const res = await GET(request(`${END}?reason=${reason}`));
    expect(res.headers.get("location")).toBe(`/admin/company-users?preview=${status}`);
  });

  it("clears the cookie and audits a preview that was this admin's", async () => {
    const res = await GET(request(END, token()));
    expect(res.headers.get("set-cookie")).toContain(`${CUSTOMER_PREVIEW_COOKIE}=;`);
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "customer_preview_end",
        entityType: "company",
        entityId: 42,
        mappUserId: 7,
      }),
    );
  });

  it("clears but does not audit someone else's or a forged cookie", async () => {
    const other = token({ adminEmail: "someone@mapp.com", returnTo: "/admin/elsewhere" });
    for (const cookie of [other, "forged.value"]) {
      const res = await GET(request(END, cookie));
      expect(res.headers.get("set-cookie")).toContain(`${CUSTOMER_PREVIEW_COOKIE}=;`);
      // Someone else's cookie does not choose where this admin lands.
      expect(res.headers.get("location")).toBe("/admin/company-users?preview=exited");
    }
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it("clears an expired cookie without auditing it, but still returns to its page", async () => {
    const res = await GET(
      request(`${END}?reason=ended`, token({ exp: Date.now() - 1, returnTo: "/admin/x" })),
    );
    expect(res.headers.get("location")).toBe("/admin/x?preview=ended");
    expect(res.headers.get("set-cookie")).toContain(`${CUSTOMER_PREVIEW_COOKIE}=;`);
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it("still clears a stale cookie when the capability is off", async () => {
    mockConfig.customerPreview.enabled = false;
    const res = await GET(request(END, token()));
    expect(res.status).toBe(307);
    expect(res.headers.get("set-cookie")).toContain(`${CUSTOMER_PREVIEW_COOKIE}=;`);
  });

  it("does not audit for a session that is not an admin", async () => {
    mockSession.mockResolvedValue({ user: { role: "customer", email: "ada@mapp.com" } });
    await GET(request(END, token()));
    expect(mockAudit).not.toHaveBeenCalled();
  });
});
