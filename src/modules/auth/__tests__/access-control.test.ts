/** @jest-environment node */

/**
 * Tests for access control utilities
 *
 * Verifies:
 * 1. hasAccessLevel() hierarchy: viewer < editor < admin
 * 2. Permission checker functions for each level
 * 3. getAccessLevelLabel() returns correct labels
 * 4. canManageTeam() — only admin/superAdmin
 * 5. Validation and route access control
 */

// Mock logger to silence output
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

import {
  hasAccessLevel,
  getAccessLevelLabel,
  canViewAccounts,
  canEditAccounts,
  canManageUsers,
  canViewAnalytics,
  canManageTeam,
  isValidAccessLevel,
  isValidAccessStatus,
  hasValidAccess,
  canAccessRoute,
  type AccessLevel,
} from "../utils/access-control";

// ============================================================================
// hasAccessLevel() hierarchy tests
// ============================================================================

describe("hasAccessLevel", () => {
  it("viewer has viewer access", () => {
    expect(hasAccessLevel("viewer", "viewer")).toBe(true);
  });

  it("viewer does NOT have editor access", () => {
    expect(hasAccessLevel("viewer", "editor")).toBe(false);
  });

  it("viewer does NOT have admin access", () => {
    expect(hasAccessLevel("viewer", "admin")).toBe(false);
  });

  it("editor has viewer access", () => {
    expect(hasAccessLevel("editor", "viewer")).toBe(true);
  });

  it("editor has editor access", () => {
    expect(hasAccessLevel("editor", "editor")).toBe(true);
  });

  it("editor does NOT have admin access", () => {
    expect(hasAccessLevel("editor", "admin")).toBe(false);
  });

  it("admin has viewer access", () => {
    expect(hasAccessLevel("admin", "viewer")).toBe(true);
  });

  it("admin has editor access", () => {
    expect(hasAccessLevel("admin", "editor")).toBe(true);
  });

  it("admin has admin access", () => {
    expect(hasAccessLevel("admin", "admin")).toBe(true);
  });

  it("returns false for invalid user level", () => {
    expect(hasAccessLevel("unknown" as AccessLevel, "viewer")).toBe(false);
  });

  it("returns false for invalid required level", () => {
    expect(hasAccessLevel("viewer", "unknown" as AccessLevel)).toBe(false);
  });
});

// ============================================================================
// getAccessLevelLabel() tests
// ============================================================================

describe("getAccessLevelLabel", () => {
  it('returns "Viewer" for viewer', () => {
    expect(getAccessLevelLabel("viewer")).toBe("Viewer");
  });

  it('returns "Editor" for editor', () => {
    expect(getAccessLevelLabel("editor")).toBe("Editor");
  });

  it('returns "Admin" for admin', () => {
    expect(getAccessLevelLabel("admin")).toBe("Admin");
  });

  it("returns the raw value for unknown levels", () => {
    expect(getAccessLevelLabel("unknown")).toBe("unknown");
  });
});

// ============================================================================
// Permission checker functions
// ============================================================================

describe("permission checkers", () => {
  describe("canViewAccounts", () => {
    it("all levels can view accounts", () => {
      expect(canViewAccounts("viewer")).toBe(true);
      expect(canViewAccounts("editor")).toBe(true);
      expect(canViewAccounts("admin")).toBe(true);
    });
  });

  describe("canEditAccounts", () => {
    it("viewer cannot edit accounts", () => {
      expect(canEditAccounts("viewer")).toBe(false);
    });

    it("editor can edit accounts", () => {
      expect(canEditAccounts("editor")).toBe(true);
    });

    it("admin can edit accounts", () => {
      expect(canEditAccounts("admin")).toBe(true);
    });

    it("superAdmin can always edit accounts", () => {
      expect(canEditAccounts("viewer", true)).toBe(true);
    });
  });

  describe("canManageUsers", () => {
    it("viewer cannot manage users", () => {
      expect(canManageUsers("viewer")).toBe(false);
    });

    it("editor can manage users", () => {
      expect(canManageUsers("editor")).toBe(true);
    });

    it("admin can manage users", () => {
      expect(canManageUsers("admin")).toBe(true);
    });
  });

  describe("canViewAnalytics", () => {
    it("all levels can view analytics", () => {
      expect(canViewAnalytics("viewer")).toBe(true);
      expect(canViewAnalytics("editor")).toBe(true);
      expect(canViewAnalytics("admin")).toBe(true);
    });
  });

  describe("canManageTeam", () => {
    it("viewer cannot manage team", () => {
      expect(canManageTeam("viewer")).toBe(false);
    });

    it("editor cannot manage team", () => {
      expect(canManageTeam("editor")).toBe(false);
    });

    it("admin can manage team", () => {
      expect(canManageTeam("admin")).toBe(true);
    });

    it("superAdmin can manage team", () => {
      expect(canManageTeam("viewer", true)).toBe(true);
    });
  });
});

// ============================================================================
// Validation functions
// ============================================================================

describe("validation", () => {
  describe("isValidAccessLevel", () => {
    it("accepts valid levels", () => {
      expect(isValidAccessLevel("viewer")).toBe(true);
      expect(isValidAccessLevel("editor")).toBe(true);
      expect(isValidAccessLevel("admin")).toBe(true);
    });

    it("rejects invalid levels", () => {
      expect(isValidAccessLevel("unknown")).toBe(false);
      expect(isValidAccessLevel("")).toBe(false);
      expect(isValidAccessLevel("superadmin")).toBe(false);
    });
  });

  describe("isValidAccessStatus", () => {
    it("accepts valid statuses", () => {
      expect(isValidAccessStatus("active")).toBe(true);
      expect(isValidAccessStatus("suspended")).toBe(true);
      expect(isValidAccessStatus("denied")).toBe(true);
    });

    it("rejects invalid statuses (pending was removed)", () => {
      // The pending/approval access model was removed (first user -> admin,
      // everyone after -> active/viewer), so "pending" is no longer valid.
      expect(isValidAccessStatus("pending")).toBe(false);
      expect(isValidAccessStatus("unknown")).toBe(false);
      expect(isValidAccessStatus("")).toBe(false);
    });
  });

  describe("hasValidAccess", () => {
    it("superAdmin always has access", () => {
      expect(hasValidAccess("suspended", "viewer", true)).toBe(true);
    });

    it("active viewer has access", () => {
      expect(hasValidAccess("active", "viewer")).toBe(true);
    });

    it("pending user does not have access", () => {
      expect(hasValidAccess("pending", "viewer")).toBe(false);
    });

    it("invalid access level does not have access", () => {
      expect(hasValidAccess("active", "unknown")).toBe(false);
    });
  });
});

// ============================================================================
// Route access control
// ============================================================================

describe("canAccessRoute", () => {
  it("superAdmin can access any route", () => {
    expect(canAccessRoute("viewer", "/admin/mapp-team", true)).toBe(true);
  });

  it("viewer can access /admin", () => {
    expect(canAccessRoute("viewer", "/admin")).toBe(true);
  });

  it("viewer cannot access /admin/mapp-team", () => {
    expect(canAccessRoute("viewer", "/admin/mapp-team")).toBe(false);
  });

  it("admin can access /admin/mapp-team", () => {
    expect(canAccessRoute("admin", "/admin/mapp-team")).toBe(true);
  });

  it("viewer can access /admin/settings", () => {
    expect(canAccessRoute("viewer", "/admin/settings")).toBe(true);
  });

  it("viewer can access /admin/audit-log", () => {
    expect(canAccessRoute("viewer", "/admin/audit-log")).toBe(true);
  });

  it("unknown routes default to viewer access", () => {
    expect(canAccessRoute("viewer", "/admin/some-unknown-route")).toBe(true);
  });
});
