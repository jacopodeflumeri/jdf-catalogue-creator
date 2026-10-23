const mockRequireAdmin = jest.fn();
const mockWriteAuditLog = jest.fn();
const mockFindUniqueOrThrow = jest.fn();
const mockUpdate = jest.fn();
const mockTaskUpdateMany = jest.fn();
const mockQueryRaw = jest.fn();
const mockStyleFindMany = jest.fn();
const mockLookFindMany = jest.fn();
const mockLookUpdateMany = jest.fn();

jest.mock("@/modules/auth/server", () => ({ requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args) }));
jest.mock("@/modules/audit", () => ({
  sessionAuditActor: () => ({ actorEmail: "editor@example.test" }),
  writeAuditLog: (...args: unknown[]) => mockWriteAuditLog(...args),
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/lib/prisma/client", () => ({
  prisma: {
    $transaction: async (operation: (tx: unknown) => unknown) => operation({
      $queryRaw: mockQueryRaw,
      syntheticProduct: { findUniqueOrThrow: mockFindUniqueOrThrow, update: mockUpdate },
      syntheticStyle: { findMany: mockStyleFindMany },
      syntheticCompleteLook: { findMany: mockLookFindMany, updateMany: mockLookUpdateMany },
      catalogGenerationTask: { updateMany: mockTaskUpdateMany },
    }),
  },
}));

import { archiveCatalogProductAction, restoreCatalogProductAction } from "../admin-actions";

describe("catalog product archive actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAdmin.mockResolvedValue({ user: { adminId: "7" } });
    mockFindUniqueOrThrow.mockResolvedValue({ id: 24, catalogId: 3, externalId: "unused", archivedAt: null, catalog: { name: "Catalog", slug: "catalog" } });
    mockUpdate.mockResolvedValue({});
    mockTaskUpdateMany.mockResolvedValue({ count: 2 });
    mockStyleFindMany.mockResolvedValue([{ id: 301 }, { id: 302 }]);
    mockLookFindMany.mockResolvedValue([{ id: 401, imageAssetId: 501 }]);
    mockLookUpdateMany.mockResolvedValue({ count: 1 });
    mockWriteAuditLog.mockResolvedValue(undefined);
  });

  it("archives atomically, cancels only queued product tasks, and audits the change", async () => {
    expect(await archiveCatalogProductAction(24)).toEqual({ ok: true });
    expect(mockRequireAdmin).toHaveBeenCalledWith({ requireEditorAccess: true });
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 24 }, data: expect.objectContaining({ archivedByMappTeamId: 7 }) }));
    expect(mockUpdate.mock.calls[0]![0].data.archivedAt).toEqual(expect.any(Date));
    expect(mockTaskUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { productId: 24, status: "QUEUED" }, data: expect.objectContaining({ status: "CANCELLED", lockedAt: null, lockedBy: null }) }));
    expect(mockStyleFindMany).toHaveBeenCalledWith({ where: { productId: 24 }, select: { id: true } });
    expect(mockLookFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { OR: [{ anchorStyleId: { in: [301, 302] } }, { items: { some: { companionStyleId: { in: [301, 302] } } } }] } }));
    expect(mockLookUpdateMany).toHaveBeenCalledWith({ where: { id: { in: [401] } }, data: { status: "STALE", errorMessage: "An anchor or companion product was archived." } });
    expect(mockTaskUpdateMany).toHaveBeenCalledWith({ where: { imageAssetId: { in: [501] }, status: "QUEUED" }, data: { status: "CANCELLED", finishedAt: expect.any(Date), lockedAt: null, lockedBy: null } });
    expect(mockWriteAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "catalog_product_archived", entityType: "synthetic_product", entityId: 24 }));
  });

  it("restores without requeueing cancelled tasks and records the restoration", async () => {
    mockFindUniqueOrThrow.mockResolvedValue({ id: 24, catalogId: 3, archivedAt: new Date(), catalog: { name: "Catalog", slug: "catalog" } });
    expect(await restoreCatalogProductAction(24)).toEqual({ ok: true });
    expect(mockUpdate).toHaveBeenCalledWith({ where: { id: 24 }, data: { archivedAt: null, archivedByMappTeamId: null } });
    expect(mockTaskUpdateMany).not.toHaveBeenCalled();
    expect(mockWriteAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "catalog_product_restored", entityType: "synthetic_product" }));
  });

  it("treats repeat archive requests as idempotent", async () => {
    mockFindUniqueOrThrow.mockResolvedValue({ id: 24, catalogId: 3, externalId: "unused", archivedAt: new Date(), catalog: { name: "Catalog", slug: "catalog" } });
    expect(await archiveCatalogProductAction(24)).toEqual({ ok: true });
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockTaskUpdateMany).not.toHaveBeenCalled();
    expect(mockWriteAuditLog).not.toHaveBeenCalled();
  });

  it("rejects viewers before the transaction", async () => {
    mockRequireAdmin.mockRejectedValue(new Error("Editor access required"));
    await expect(archiveCatalogProductAction(24)).rejects.toThrow("Editor access required");
    expect(mockQueryRaw).not.toHaveBeenCalled();
    expect(mockWriteAuditLog).not.toHaveBeenCalled();
  });
});
