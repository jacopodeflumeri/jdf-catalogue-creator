import { CATALOG_PROFILES } from "../../config/profiles";
import { parseCatalogProfileConfig } from "../../config/profiles";

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

import { addCatalogTaxonomyAction, saveCatalogDesignMixAction, saveCatalogMixAction } from "../admin-actions";

describe("catalog taxonomy mutation action", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAdmin.mockResolvedValue({ user: { adminId: "1" } });
    mockFindUniqueOrThrow.mockResolvedValue({ id: 1, slug: "premium-apparel", name: "Premium", config: CATALOG_PROFILES[0].config });
    mockUpdate.mockResolvedValue({});
    mockWriteAuditLog.mockResolvedValue(undefined);
  });

  it("requires editor access, updates atomically, and records a taxonomy audit event", async () => {
    const result = await addCatalogTaxonomyAction({ type: "DEPARTMENT", catalogId: 1, label: "Kids", code: "K" });
    expect(result).toEqual({ ok: true });
    expect(mockRequireAdmin).toHaveBeenCalledWith({ requireEditorAccess: true });
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 1 } }));
    const saved = mockUpdate.mock.calls[0]![0] as { data: { config: Record<string, unknown> & { departments: unknown[] } } };
    expect(saved.data.config.departments).toContainEqual({ key: "KIDS", label: "Kids", code: "K" });
    expect(saved.data.config).not.toHaveProperty("departmentWeights");
    expect(JSON.stringify(saved.data.config)).not.toContain("generationWeight");
    expect(mockWriteAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: "taxonomy_added",
      entityType: "synthetic_catalog",
      entityId: 1,
      data: { catalogId: 1, taxonomyType: "DEPARTMENT" },
    }));
  });

  it("rejects viewers before any department write", async () => {
    mockRequireAdmin.mockRejectedValue(new Error("Editor access required"));
    await expect(addCatalogTaxonomyAction({ type: "DEPARTMENT", catalogId: 1, label: "Kids", code: "K" })).rejects.toThrow("Editor access required");
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockWriteAuditLog).not.toHaveBeenCalled();
  });

  it("persists a weight-free config when updating legacy catalogue JSON", async () => {
    const legacyConfig = JSON.parse(JSON.stringify(CATALOG_PROFILES[0].config)) as Record<string, unknown>;
    legacyConfig.departments = [
      { key: "WOMEN", label: "Women", code: "W", generationWeight: 0.55 },
      { key: "MEN", label: "Men", code: "M", generationWeight: 0.45 },
    ];
    legacyConfig.departmentWeights = { women: 0.55, men: 0.45 };
    mockFindUniqueOrThrow.mockResolvedValueOnce({ id: 1, slug: "premium-apparel", name: "Premium", config: legacyConfig });

    const result = await addCatalogTaxonomyAction({ type: "DEPARTMENT", catalogId: 1, label: "Kids", code: "K" });

    expect(result).toEqual({ ok: true });
    const saved = mockUpdate.mock.calls[0]![0] as { data: { config: Record<string, unknown> } };
    expect(saved.data.config).not.toHaveProperty("departmentWeights");
    expect(JSON.stringify(saved.data.config)).not.toContain("generationWeight");
  });

  it("saves the canonical mix without a second taxonomy structure and records an audit event", async () => {
    const row = { id: "new-row", departmentKey: "WOMEN", category: "new apparel", subcategory: "longline tops", productCount: 1_500, outfitSlot: "TOP" };
    const result = await saveCatalogMixAction({ catalogId: 1, rows: [...parseCatalogProfileConfig(CATALOG_PROFILES[0].config).assortmentPlan, row] });
    expect(result).toEqual({ ok: true });
    expect(mockRequireAdmin).toHaveBeenCalledWith({ requireEditorAccess: true });
    const saved = mockUpdate.mock.calls[0]![0] as { data: { config: Record<string, unknown> & { assortmentPlan: unknown[] } } };
    expect(saved.data.config).not.toHaveProperty("categories");
    expect(saved.data.config).not.toHaveProperty("subcategories");
    expect(saved.data.config.assortmentPlan).toContainEqual(row);
    expect(mockWriteAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "catalog_mix_updated", entityType: "synthetic_catalog" }));
  });

  it("rejects duplicate mix tuples and viewers cannot mutate them", async () => {
    const row = parseCatalogProfileConfig(CATALOG_PROFILES[0].config).assortmentPlan[0]!;
    const duplicate = await saveCatalogMixAction({ catalogId: 1, rows: [row, { ...row, id: "duplicate-row", category: row.category.toUpperCase(), productCount: 2 }] });
    expect(duplicate).toMatchObject({ ok: false });
    expect(mockUpdate).not.toHaveBeenCalled();

    mockRequireAdmin.mockRejectedValue(new Error("Editor access required"));
    await expect(saveCatalogMixAction({ catalogId: 1, rows: [row] })).rejects.toThrow("Editor access required");
    expect(mockWriteAuditLog).not.toHaveBeenCalled();
  });

  it("saves validated Design Mix settings with editor authorization and an audit event", async () => {
    const config = parseCatalogProfileConfig(CATALOG_PROFILES[0].config);
    const row = config.assortmentPlan.find((item) => item.departmentKey != null)!;
    const designMix = { ...config.designMix, patternPercentage: 40, embellishmentPercentage: 10, rules: [{ catalogMixRowId: row.id, allowedPatternCodes: ["FLORAL"], allowedEmbellishmentCodes: [] }] };
    const result = await saveCatalogDesignMixAction({ catalogId: 1, designMix });
    expect(result).toEqual({ ok: true });
    expect(mockRequireAdmin).toHaveBeenCalledWith({ requireEditorAccess: true });
    const saved = mockUpdate.mock.calls[0]![0] as { data: { config: { designMix: typeof designMix } } };
    expect(saved.data.config.designMix.patternPercentage).toBe(40);
    expect(saved.data.config.designMix.rules).toEqual(designMix.rules);
    expect(mockWriteAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "catalog_design_mix_updated", entityType: "synthetic_catalog" }));
  });

  it("rejects viewers and invalid Design Mix vocabulary references", async () => {
    const config = parseCatalogProfileConfig(CATALOG_PROFILES[0].config);
    const invalid = await saveCatalogDesignMixAction({ catalogId: 1, designMix: { ...config.designMix, rules: [{ catalogMixRowId: "deleted-row", allowedPatternCodes: [], allowedEmbellishmentCodes: [] }] } });
    expect(invalid).toMatchObject({ ok: false });
    expect(mockUpdate).not.toHaveBeenCalled();
    mockRequireAdmin.mockRejectedValue(new Error("Editor access required"));
    await expect(saveCatalogDesignMixAction({ catalogId: 1, designMix: config.designMix })).rejects.toThrow("Editor access required");
    expect(mockWriteAuditLog).not.toHaveBeenCalled();
  });
});
