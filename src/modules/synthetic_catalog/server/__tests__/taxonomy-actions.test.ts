import { CATALOG_PROFILES } from "../../config/profiles";

const mockRequireAdmin = jest.fn();
const mockWriteAuditLog = jest.fn();
const mockUpdate = jest.fn();
const mockFindUniqueOrThrow = jest.fn();
const mockQueryRaw = jest.fn();

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
      syntheticCatalog: { findUniqueOrThrow: mockFindUniqueOrThrow, update: mockUpdate },
    }),
  },
}));

import { addCatalogTaxonomyAction } from "../admin-actions";

describe("catalog taxonomy mutation action", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAdmin.mockResolvedValue({ user: { adminId: "1" } });
    mockFindUniqueOrThrow.mockResolvedValue({ id: 1, slug: "premium-apparel", name: "Premium", config: CATALOG_PROFILES[0].config });
    mockUpdate.mockResolvedValue({});
    mockWriteAuditLog.mockResolvedValue(undefined);
  });

  it("requires editor access, updates atomically, and records a taxonomy audit event", async () => {
    const result = await addCatalogTaxonomyAction({ type: "DEPARTMENT", catalogId: 1, label: "Kids", code: "K", generationWeight: 0.2 });
    expect(result).toEqual({ ok: true });
    expect(mockRequireAdmin).toHaveBeenCalledWith({ requireEditorAccess: true });
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 1 } }));
    expect(mockWriteAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: "taxonomy_added",
      entityType: "synthetic_catalog",
      entityId: 1,
      data: { catalogId: 1, taxonomyType: "DEPARTMENT" },
    }));
  });

  it("rejects viewers before any taxonomy write", async () => {
    mockRequireAdmin.mockRejectedValue(new Error("Editor access required"));
    await expect(addCatalogTaxonomyAction({ type: "CATEGORY", catalogId: 1, category: "Test", subcategory: "Initial" })).rejects.toThrow("Editor access required");
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockWriteAuditLog).not.toHaveBeenCalled();
  });
});
