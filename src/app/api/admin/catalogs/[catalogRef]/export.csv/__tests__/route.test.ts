/** @jest-environment node */

const mockSession = jest.fn();
const mockExport = jest.fn();
const mockAudit = jest.fn();

jest.mock("@/config", () => ({ config: { app: { url: "https://catalogs.example.test" } } }));
jest.mock("@/modules/auth/server", () => ({ getAdminSession: () => mockSession() }));
jest.mock("@/modules/synthetic_catalog/server/catalog-export", () => ({
  createCatalogCsvExport: (...args: unknown[]) => mockExport(...args),
}));
jest.mock("@/modules/audit", () => ({
  writeAuditLog: (...args: unknown[]) => mockAudit(...args),
  sessionAuditActor: () => ({ mappUserId: 7, actorEmail: "ada@mapp.com" }),
}));

import { GET } from "../route";

const summary = {
  readyForImport: true,
  totalProducts: 1,
  productsExported: 1,
  stylesExported: 1,
  variantsExported: 2,
  imagesReferenced: 3,
  incompleteProductsExcluded: 0,
  issues: [],
};

describe("catalog CSV export route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession.mockResolvedValue({ user: { role: "admin", adminId: "7", email: "ada@mapp.com" } });
    mockExport.mockResolvedValue({
      catalog: { id: 4, slug: "premium-apparel", name: "Premium Apparel" },
      csv: "product_id\r\nPRE-W-000001\r\n",
      summary,
    });
  });

  it("requires an authenticated internal admin", async () => {
    mockSession.mockResolvedValue(null);
    const response = await GET(new Request("https://app.test/api/admin/catalogs/premium/export.csv"), {
      params: Promise.resolve({ catalogRef: "premium" }),
    });
    expect(response.status).toBe(401);
    expect(mockExport).not.toHaveBeenCalled();
  });

  it("downloads UTF-8 CSV and audits the successful export", async () => {
    const response = await GET(new Request("https://app.test/api/admin/catalogs/premium-apparel/export.csv"), {
      params: Promise.resolve({ catalogRef: "premium-apparel" }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="premium-apparel.csv"');
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.text()).toContain("PRE-W-000001");
    expect(mockExport).toHaveBeenCalledWith("premium-apparel", "https://catalogs.example.test");
    expect(mockAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "exported_csv",
      entityType: "synthetic_catalog",
      entityId: 4,
    }));
  });

  it("refuses an empty export and returns its validation summary", async () => {
    mockExport.mockResolvedValue({
      catalog: { id: 4, slug: "premium-apparel", name: "Premium Apparel" },
      csv: "product_id\r\n",
      summary: { ...summary, readyForImport: false, productsExported: 0, variantsExported: 0, incompleteProductsExcluded: 1 },
    });
    const response = await GET(new Request("https://app.test/api/admin/catalogs/premium-apparel/export.csv"), {
      params: Promise.resolve({ catalogRef: "premium-apparel" }),
    });
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual(expect.objectContaining({ error: "Catalog has no exportable variants" }));
    expect(mockAudit).not.toHaveBeenCalled();
  });
});
