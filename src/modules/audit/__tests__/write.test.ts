/** @jest-environment node */

/**
 * The audit writer's contract: it records what it is given, and it never
 * throws — a failed audit write must not fail the change it describes.
 */

const mockCreate = jest.fn();

jest.mock("@/lib/prisma/client", () => ({
  prisma: { auditLog: { create: (...args: unknown[]) => mockCreate(...args) } },
}));

jest.mock("@/lib/utils/logger", () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), log: jest.fn() },
}));

import logger from "@/lib/utils/logger";
import { sessionAuditActor } from "../actor";
import {
  AUDIT_ENTITY_TYPES,
  getAuditEntityTypeDef,
  isAuditEntityType,
} from "../entity-types";
import { writeAuditLog, writeAuditLogTx } from "../write";

const base = {
  mappUserId: 7,
  actorEmail: "admin@mapp.com",
  action: "access_updated",
  entityType: "mapp_team" as const,
  entityId: 42,
  message: "jane@mapp.com: level set to editor",
  data: { accessLevel: "editor" },
};

describe("writeAuditLog", () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockCreate.mockResolvedValue({});
    (logger.error as jest.Mock).mockClear();
  });

  it("stores the row, defaulting outcome to success", async () => {
    await writeAuditLog(base);

    expect(mockCreate).toHaveBeenCalledWith({
      data: { ...base, outcome: "success" },
    });
  });

  it("stores nulls for an unattributed, entity-less row", async () => {
    await writeAuditLog({ action: "exported", entityType: "mapp_team" });

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        mappUserId: null,
        actorEmail: null,
        entityId: null,
        data: undefined,
      }),
    });
  });

  it("keeps the row, without the link, when the acting member no longer exists", async () => {
    mockCreate
      .mockRejectedValueOnce(Object.assign(new Error("fk"), { code: "P2003" }))
      .mockResolvedValueOnce({});

    await writeAuditLog(base);

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockCreate.mock.calls[1][0].data).toEqual(
      expect.objectContaining({
        mappUserId: null,
        actorEmail: "admin@mapp.com",
      }),
    );
  });

  it("never throws, and logs, when the write fails", async () => {
    mockCreate.mockRejectedValue(new Error("db down"));

    await expect(writeAuditLog(base)).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalled();
  });
});

describe("writeAuditLogTx", () => {
  it("writes on the transaction client and lets errors through", async () => {
    const tx = { auditLog: { create: jest.fn().mockResolvedValue({}) } };
    await writeAuditLogTx(tx as never, base);
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: { ...base, outcome: "success" },
    });

    tx.auditLog.create.mockRejectedValue(new Error("db down"));
    await expect(writeAuditLogTx(tx as never, base)).rejects.toThrow("db down");
  });
});

describe("sessionAuditActor", () => {
  it("returns the MappTeam id and email", () => {
    expect(
      sessionAuditActor({
        user: { adminId: "12", email: "a@mapp.com" },
      } as never),
    ).toEqual({ mappUserId: 12, actorEmail: "a@mapp.com" });
  });

  it("still names a SuperAdmin who has no MappTeam row", () => {
    expect(
      sessionAuditActor({ user: { email: "root@mapp.com" } } as never),
    ).toEqual({ mappUserId: undefined, actorEmail: "root@mapp.com" });
  });

  it("copes with no session", () => {
    expect(sessionAuditActor(null)).toEqual({
      mappUserId: undefined,
      actorEmail: undefined,
    });
  });
});

describe("audit entity types", () => {
  it("has unique snake_case keys", () => {
    const keys = AUDIT_ENTITY_TYPES.map((def) => def.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(key).toMatch(/^[a-z][a-z0-9_]*$/);
  });

  it("recognises listed keys only", () => {
    expect(isAuditEntityType("mapp_team")).toBe(true);
    expect(isAuditEntityType("not_a_type")).toBe(false);
    expect(isAuditEntityType(undefined)).toBe(false);
    expect(getAuditEntityTypeDef("mapp_team")?.label).toBe("Mapp Team");
    expect(getAuditEntityTypeDef("not_a_type")).toBeUndefined();
  });
});
