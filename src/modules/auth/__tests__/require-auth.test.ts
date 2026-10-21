/** @jest-environment node */

/**
 * Tests for requireAdmin() access level enforcement
 *
 * Verifies:
 * 1. requireEditorAccess blocks viewers, allows editor/admin/superAdmin
 * 2. requireAdminAccess blocks viewer/editor, allows admin/superAdmin
 * 3. Plain requireAdmin() allows all active admin levels
 */

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

jest.mock("@/config", () => ({
  config: {
    auth: {
      secret: "test-secret",
      sessionMaxAge: 86400,
      superAdmins: ["superadmin@mapp.com"],
      restrictions: {
        granularAccessControl: true,
      },
    },
    app: { isDevelopment: false },
    azure: { clientId: "test", clientSecret: "test", tenantId: "test" },
  },
}));

jest.mock("@/lib/utils/logger", () => ({
  __esModule: true,
  default: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    log: jest.fn(),
  },
}));

// Mock next-auth getServerSession
const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({
  __esModule: true,
  default: jest.fn(),
  getServerSession: (...args: any[]) => mockGetServerSession(...args),
}));

// Mock next/navigation redirect
const mockRedirect = jest.fn();
jest.mock("next/navigation", () => ({
  redirect: (...args: any[]) => {
    mockRedirect(...args);
    throw new Error("REDIRECT");
  },
}));

// Mock next/headers
jest.mock("next/headers", () => ({
  headers: jest.fn().mockResolvedValue({
    get: jest.fn().mockReturnValue(null),
  }),
}));

// Mock security restrictions
jest.mock("@/lib/utils/security-restrictions", () => ({
  isSuperAdminOnlyMode: jest.fn().mockReturnValue(false),
  isIPAllowed: jest.fn().mockReturnValue(true),
}));

// Mock auth server to avoid circular dependencies
jest.mock("@/modules/auth/server", () => ({
  getRawTeamMemberByEmailAction: jest.fn().mockResolvedValue({
    success: true,
    data: {
      id: 1,
      accessStatus: "active",
      accessLevel: "viewer",
      isSuperAdmin: false,
      lastLoginAt: null,
    },
  }),
  updateTeamMemberForAuthAction: jest.fn(),
}));

// Mock auth config
jest.mock("../config/nextauth", () => ({
  authOptions: {},
}));

import { requireAdmin } from "../server/require-auth";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createSession(access: string, isSuperAdmin = false) {
  return {
    user: {
      role: "admin" as const,
      email: isSuperAdmin ? "superadmin@mapp.com" : "user@mapp.com",
      name: "Test User",
      access,
      isSuperAdmin,
      adminId: "1",
    },
    expires: new Date(Date.now() + 86400000).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("requireAdmin", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("plain requireAdmin() — allows all active admins", () => {
    it("allows viewer", async () => {
      mockGetServerSession.mockResolvedValue(createSession("viewer"));
      const session = await requireAdmin();
      expect(session.user.access).toBe("viewer");
    });

    it("allows editor", async () => {
      mockGetServerSession.mockResolvedValue(createSession("editor"));
      const session = await requireAdmin();
      expect(session.user.access).toBe("editor");
    });

    it("allows admin", async () => {
      mockGetServerSession.mockResolvedValue(createSession("admin"));
      const session = await requireAdmin();
      expect(session.user.access).toBe("admin");
    });
  });

  describe("requireEditorAccess — blocks viewers", () => {
    it("blocks viewer", async () => {
      mockGetServerSession.mockResolvedValue(createSession("viewer"));
      await expect(
        requireAdmin({ requireEditorAccess: true }),
      ).rejects.toThrow("REDIRECT");
      expect(mockRedirect).toHaveBeenCalledWith("/admin");
    });

    it("allows editor", async () => {
      mockGetServerSession.mockResolvedValue(createSession("editor"));
      const session = await requireAdmin({ requireEditorAccess: true });
      expect(session.user.access).toBe("editor");
    });

    it("allows admin", async () => {
      mockGetServerSession.mockResolvedValue(createSession("admin"));
      const session = await requireAdmin({ requireEditorAccess: true });
      expect(session.user.access).toBe("admin");
    });

    it("allows superAdmin with viewer level", async () => {
      mockGetServerSession.mockResolvedValue(createSession("viewer", true));
      const session = await requireAdmin({ requireEditorAccess: true });
      expect(session.user.isSuperAdmin).toBe(true);
    });
  });

  describe("requireAdminAccess — blocks viewer and editor", () => {
    it("blocks viewer", async () => {
      mockGetServerSession.mockResolvedValue(createSession("viewer"));
      await expect(
        requireAdmin({ requireAdminAccess: true }),
      ).rejects.toThrow("REDIRECT");
      expect(mockRedirect).toHaveBeenCalledWith("/admin");
    });

    it("blocks editor", async () => {
      mockGetServerSession.mockResolvedValue(createSession("editor"));
      await expect(
        requireAdmin({ requireAdminAccess: true }),
      ).rejects.toThrow("REDIRECT");
      expect(mockRedirect).toHaveBeenCalledWith("/admin");
    });

    it("allows admin", async () => {
      mockGetServerSession.mockResolvedValue(createSession("admin"));
      const session = await requireAdmin({ requireAdminAccess: true });
      expect(session.user.access).toBe("admin");
    });

    it("allows superAdmin with viewer level", async () => {
      mockGetServerSession.mockResolvedValue(createSession("viewer", true));
      const session = await requireAdmin({ requireAdminAccess: true });
      expect(session.user.isSuperAdmin).toBe(true);
    });
  });

  describe("unauthenticated users", () => {
    it("redirects when no session", async () => {
      mockGetServerSession.mockResolvedValue(null);
      await expect(requireAdmin()).rejects.toThrow("REDIRECT");
    });

    it("redirects when role is not admin", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { role: "customer", email: "c@test.com" },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });
      await expect(requireAdmin()).rejects.toThrow("REDIRECT");
    });
  });
});
