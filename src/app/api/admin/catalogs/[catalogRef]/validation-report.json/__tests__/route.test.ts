/** @jest-environment node */

const mockSession = jest.fn();
const mockReport = jest.fn();

jest.mock("@/modules/auth/server", () => ({ getAdminSession: () => mockSession() }));
jest.mock("@/modules/synthetic_catalog/server/catalog-export", () => ({
  createCatalogValidationReport: (...args: unknown[]) => mockReport(...args),
}));

import { GET } from "../route";

describe("catalog validation report route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession.mockResolvedValue({ user: { role: "admin" } });
    mockReport.mockResolvedValue({
      schemaVersion: 1,
      generatedAt: "2026-10-21T10:00:00.000Z",
      catalog: { id: 4, slug: "premium-apparel", name: "Premium Apparel" },
      checks: { hasProducts: true },
      summary: { readyForImport: true },
    });
  });

  it("requires an authenticated internal admin", async () => {
    mockSession.mockResolvedValue(null);
    const response = await GET(new Request("https://app.test/report"), {
      params: Promise.resolve({ catalogRef: "premium-apparel" }),
    });
    expect(response.status).toBe(401);
    expect(mockReport).not.toHaveBeenCalled();
  });

  it("downloads the complete no-store JSON report", async () => {
    const response = await GET(new Request("https://app.test/report"), {
      params: Promise.resolve({ catalogRef: "premium-apparel" }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="premium-apparel-validation-report.json"',
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual(expect.objectContaining({ schemaVersion: 1 }));
  });

  it("returns not found for an unknown catalog", async () => {
    mockReport.mockResolvedValue(null);
    const response = await GET(new Request("https://app.test/report"), {
      params: Promise.resolve({ catalogRef: "missing" }),
    });
    expect(response.status).toBe(404);
  });
});
