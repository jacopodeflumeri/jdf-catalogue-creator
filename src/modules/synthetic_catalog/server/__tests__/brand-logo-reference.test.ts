import { loadCatalogLogoReference } from "../image-assets";

jest.mock("@/lib/prisma/client", () => ({ prisma: {} }));

describe("catalogue logo image references", () => {
  it.each(["premium-apparel", "fast-fashion", "luxury-fashion", "activewear"])("loads the mapped PNG for %s", async (slug) => {
    const reference = await loadCatalogLogoReference(slug);
    expect(reference.mimeType).toBe("image/png");
    expect(reference.assetId).toBeUndefined();
    expect(reference.data.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(reference.description).toContain("catalogue");
  });

  it("rejects an unknown slug rather than choosing another catalogue logo", async () => {
    await expect(loadCatalogLogoReference("../../other")).rejects.toThrow("No approved catalogue logo");
  });
});
