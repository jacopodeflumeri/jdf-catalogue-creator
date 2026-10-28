/** @jest-environment node */

const mockSession = jest.fn();
const mockExport = jest.fn();
const mockAudit = jest.fn();

jest.mock("@/modules/auth/server", () => ({ getAdminSession: () => mockSession() }));
jest.mock("@/modules/synthetic_catalog/server/catalog-export", () => ({ createCompleteLookCsvExport: (...args: unknown[]) => mockExport(...args) }));
jest.mock("@/modules/audit", () => ({
  writeAuditLog: (...args: unknown[]) => mockAudit(...args),
  sessionAuditActor: () => ({ mappUserId: 7, actorEmail: "ada@mapp.com" }),
}));

import { GET } from "../route";

describe("Complete the Look CSV route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession.mockResolvedValue({ user: { role: "admin", access: "viewer", adminId: "7" } });
    mockExport.mockResolvedValue({ catalog: { id: 4, slug: "premium-apparel", name: "Premium Apparel" }, rowCount: 0, csv: "main_style_id,related_style_id_1,related_style_id_2,related_style_id_3\r\n" });
  });

  it("allows the existing authenticated viewer export access and returns a header-only download", async () => {
    const response = await GET(new Request("https://app.test/api/admin/catalogs/premium-apparel/complete-look.csv"), {
      params: Promise.resolve({ catalogRef: "premium-apparel" }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="premium-apparel-complete-the-look.csv"');
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.text()).toContain("main_style_id,related_style_id_1");
    expect(mockAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "exported_csv", entityId: 4 }));
  });

  it("requires authentication", async () => {
    mockSession.mockResolvedValue(null);
    const response = await GET(new Request("https://app.test/api/admin/catalogs/premium-apparel/complete-look.csv"), {
      params: Promise.resolve({ catalogRef: "premium-apparel" }),
    });
    expect(response.status).toBe(401);
    expect(mockExport).not.toHaveBeenCalled();
  });
});
