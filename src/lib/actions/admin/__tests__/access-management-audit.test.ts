/** @jest-environment node */

/**
 * Every Mapp Team access change must leave an audit row naming who did it.
 */

jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

jest.mock("@/lib/utils/logger", () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), log: jest.fn() },
}));

const mockRequireAdmin = jest.fn();
jest.mock("@/modules/auth/server", () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

const mockUpdateAccess = jest.fn();
jest.mock("@/lib/prisma/services", () => ({
  prismaService: {
    mappTeam: {
      updateTeamMemberAccess: (...args: unknown[]) => mockUpdateAccess(...args),
    },
  },
}));

const mockWriteAuditLog = jest.fn();
jest.mock("@/modules/audit", () => ({
  writeAuditLog: (...args: unknown[]) => mockWriteAuditLog(...args),
  sessionAuditActor: (session: {
    user: { adminId: string; email: string };
  }) => ({
    mappUserId: Number(session.user.adminId),
    actorEmail: session.user.email,
  }),
}));

import {
  bulkUpdateEmployeeAccess,
  grantEmployeeAccess,
  revokeEmployeeAccess,
  updateEmployeeAccess,
} from "../access-management-actions";

const member = (id: number) => ({ id, email: `member${id}@mapp.com` });

describe("Mapp Team access changes are audited", () => {
  beforeEach(() => {
    mockRequireAdmin.mockReset();
    mockUpdateAccess.mockReset();
    mockWriteAuditLog.mockReset();
    mockRequireAdmin.mockResolvedValue({
      user: { adminId: "1", email: "admin@mapp.com" },
    });
    mockUpdateAccess.mockImplementation(async (id: string) =>
      member(Number(id)),
    );
  });

  it("update", async () => {
    const result = await updateEmployeeAccess({
      employeeId: "5",
      accessLevel: "editor",
    });

    expect(result.success).toBe(true);
    expect(mockWriteAuditLog).toHaveBeenCalledWith({
      mappUserId: 1,
      actorEmail: "admin@mapp.com",
      action: "access_updated",
      entityType: "mapp_team",
      entityId: 5,
      message: "member5@mapp.com: level set to editor",
      data: {
        accessStatus: undefined,
        accessLevel: "editor",
        notes: undefined,
      },
    });
  });

  it("bulk update writes one row per member actually changed", async () => {
    mockUpdateAccess.mockImplementation(async (id: string) => {
      if (id === "6") throw new Error("nope");
      return member(Number(id));
    });

    await bulkUpdateEmployeeAccess({
      employeeIds: ["5", "6", "7"],
      accessStatus: "suspended",
    });

    expect(mockWriteAuditLog.mock.calls.map(([row]) => row.entityId)).toEqual([
      5, 7,
    ]);
  });

  it("revoke and grant", async () => {
    await revokeEmployeeAccess({
      employeeId: "5",
      revocationType: "suspended",
    });
    await grantEmployeeAccess({ employeeId: "5", accessLevel: "admin" });

    expect(
      mockWriteAuditLog.mock.calls.map(([row]) => [row.action, row.message]),
    ).toEqual([
      ["access_revoked", "member5@mapp.com: status set to suspended"],
      [
        "access_granted",
        "member5@mapp.com: level set to admin, status set to active",
      ],
    ]);
  });

  it("writes nothing when the change is refused", async () => {
    const result = await updateEmployeeAccess({
      employeeId: "1",
      accessStatus: "suspended",
    });

    expect(result.success).toBe(false);
    expect(mockWriteAuditLog).not.toHaveBeenCalled();
  });
});
