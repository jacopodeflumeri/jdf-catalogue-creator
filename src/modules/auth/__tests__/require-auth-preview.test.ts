/** @jest-environment node */

/**
 * requireCustomer and the "View as customer" overlay (customer_preview):
 * - an active preview returns the synthesized customer session;
 * - an unusable cookie ends the preview via the end route (not sign-in);
 * - the CENTRAL read-only guard refuses a server-action request during a
 *   preview unless the caller declared `readOnly`;
 * - the overlay is handed requireAdmin's own security checks.
 */

const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({
  __esModule: true,
  default: jest.fn(),
  getServerSession: (...a: unknown[]) => mockGetServerSession(...a),
}));
jest.mock("../config/nextauth", () => ({ authOptions: {} }));
jest.mock("@/config", () => ({
  config: { auth: { superAdmins: [] }, app: { isDevelopment: false } },
}));
jest.mock("@/lib/utils/logger", () => ({
  __esModule: true,
  default: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(), log: jest.fn() },
}));
const mockRedirect = jest.fn();
jest.mock("next/navigation", () => ({
  redirect: (to: string) => {
    mockRedirect(to);
    throw new Error(`REDIRECT ${to}`);
  },
}));
const mockHeaders = new Map<string, string>();
jest.mock("next/headers", () => ({
  headers: jest.fn(async () => ({
    get: (k: string) => mockHeaders.get(k) ?? null,
    has: (k: string) => mockHeaders.has(k),
  })),
}));
const mockIPAllowed = jest.fn(() => true);
jest.mock("@/lib/utils/security-restrictions", () => ({
  isSuperAdminOnlyMode: jest.fn(() => false),
  isIPAllowed: () => mockIPAllowed(),
}));
const mockResolvePreview = jest.fn();
jest.mock("@/modules/customer_preview/server/resolve", () => ({
  resolveCustomerPreview: (...a: unknown[]) => mockResolvePreview(...a),
}));

import { requireCustomer } from "../server/require-auth";
import { CustomerPreviewReadOnlyError } from "@/modules/customer_preview/lib/guard";

const admin = {
  user: { id: "7", role: "admin", email: "ada@mapp.com", access: "admin", adminId: "7" },
  expires: "2099-01-01T00:00:00.000Z",
};
const previewSession = {
  user: {
    id: "7",
    role: "customer",
    authSource: "keycloak",
    companyId: "5046",
    customerPreview: { adminEmail: "ada@mapp.com", companyId: 5046 },
  },
  expires: "2099-01-01T00:00:00.000Z",
};

beforeEach(() => {
  jest.clearAllMocks();
  mockHeaders.clear();
  mockIPAllowed.mockReturnValue(true);
  mockGetServerSession.mockResolvedValue(admin);
  mockResolvePreview.mockResolvedValue({ kind: "none" });
});

describe("requireCustomer with the customer-preview overlay", () => {
  it("returns the synthesized customer session while a preview is active", async () => {
    mockResolvePreview.mockResolvedValue({ kind: "active", session: previewSession });
    await expect(requireCustomer()).resolves.toBe(previewSession);
  });

  it("without a preview, an admin is still not a customer (sign-in redirect)", async () => {
    await expect(requireCustomer()).rejects.toThrow("REDIRECT /auth/signin");
  });

  it.each(["ended", "unavailable"])(
    "ends an unusable preview through the end route (status %p)",
    async (status) => {
      mockResolvePreview.mockResolvedValue({ kind: "invalid", reason: "x", status });
      await expect(requireCustomer()).rejects.toThrow(
        `REDIRECT /admin/customer-preview/end?reason=${status}`,
      );
    },
  );

  it("refuses a server-action request during a preview (central read-only guard)", async () => {
    mockResolvePreview.mockResolvedValue({ kind: "active", session: previewSession });
    mockHeaders.set("next-action", "abc123");
    await expect(requireCustomer()).rejects.toBeInstanceOf(CustomerPreviewReadOnlyError);
  });

  it("lets a server action that declared itself read-only through", async () => {
    mockResolvePreview.mockResolvedValue({ kind: "active", session: previewSession });
    mockHeaders.set("next-action", "abc123");
    await expect(requireCustomer({ readOnly: true })).resolves.toBe(previewSession);
  });

  it("leaves real customers' server actions alone", async () => {
    const customer = {
      user: { id: "c", role: "customer", authSource: "keycloak", companyId: "1" },
      expires: "2099-01-01T00:00:00.000Z",
    };
    mockGetServerSession.mockResolvedValue(customer);
    mockHeaders.set("next-action", "abc123");
    await expect(requireCustomer()).resolves.toBe(customer);
  });

  it("hands the overlay requireAdmin's security checks (e.g. IP allow-list)", async () => {
    await expect(requireCustomer()).rejects.toThrow("REDIRECT");
    const { adminGate } = mockResolvePreview.mock.calls[0][1];
    await expect(adminGate(admin)).resolves.toBe(true);
    mockIPAllowed.mockReturnValue(false);
    await expect(adminGate(admin)).resolves.toBe(false);
    await expect(adminGate({ ...admin, user: { ...admin.user, accessStatus: "suspended" } }))
      .resolves.toBe(false);
  });
});
