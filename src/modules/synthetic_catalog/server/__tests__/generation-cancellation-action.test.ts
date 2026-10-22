const mockRequireAdmin = jest.fn();
const mockWriteAuditLog = jest.fn();
const mockCancelGenerationJob = jest.fn();
const mockFindCatalog = jest.fn();

jest.mock("@/modules/auth/server", () => ({ requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args) }));
jest.mock("@/modules/audit", () => ({
  sessionAuditActor: () => ({ actorEmail: "editor@example.test" }),
  writeAuditLog: (...args: unknown[]) => mockWriteAuditLog(...args),
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/lib/prisma/client", () => ({
  prisma: { syntheticCatalog: { findUniqueOrThrow: (...args: unknown[]) => mockFindCatalog(...args) } },
}));
jest.mock("../generation-jobs", () => ({
  createGenerationJob: jest.fn(),
  resumeGenerationJob: jest.fn(),
  cancelGenerationJob: (...args: unknown[]) => mockCancelGenerationJob(...args),
}));

import { cancelCatalogGenerationJobAction } from "../admin-actions";

describe("catalog generation cancellation action", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAdmin.mockResolvedValue({ user: { adminId: "4" } });
    mockCancelGenerationJob.mockResolvedValue({ job: { id: 7, catalogId: 2 }, previousStatus: "RUNNING" });
    mockFindCatalog.mockResolvedValue({ id: 2, slug: "premium-apparel", name: "Premium" });
    mockWriteAuditLog.mockResolvedValue(undefined);
  });

  it("requires editor access and audits the previous status", async () => {
    await expect(cancelCatalogGenerationJobAction(7)).resolves.toEqual({ ok: true, jobId: 7 });
    expect(mockRequireAdmin).toHaveBeenCalledWith({ requireEditorAccess: true });
    expect(mockWriteAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: "generation_cancelled",
      entityType: "catalog_generation_job",
      entityId: 7,
      message: expect.not.stringContaining("generated"),
      data: { catalogId: 2, previousStatus: "RUNNING" },
    }));
  });

  it("rejects viewers before cancelling or auditing", async () => {
    mockRequireAdmin.mockRejectedValue(new Error("Editor access required"));
    await expect(cancelCatalogGenerationJobAction(7)).rejects.toThrow("Editor access required");
    expect(mockCancelGenerationJob).not.toHaveBeenCalled();
    expect(mockWriteAuditLog).not.toHaveBeenCalled();
  });

  it("does not audit terminal jobs when cancellation is rejected", async () => {
    mockCancelGenerationJob.mockRejectedValue(new Error("Cannot stop a generation job in COMPLETED state"));
    await expect(cancelCatalogGenerationJobAction(7)).resolves.toMatchObject({ ok: false });
    expect(mockWriteAuditLog).not.toHaveBeenCalled();
  });
});
