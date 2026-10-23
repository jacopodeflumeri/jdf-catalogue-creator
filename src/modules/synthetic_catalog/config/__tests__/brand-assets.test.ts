import { getCatalogBrandLogoPath } from "../brand-assets";

describe("catalogue brand logo assets", () => {
  it.each([
    ["premium-apparel", "/img/aureline.png"],
    ["fast-fashion", "/img/loopline.png"],
    ["luxury-fashion", "/img/maison-veyra.png"],
    ["activewear", "/img/kinetiq-form.png"],
  ])("maps %s to its static asset", (slug, path) => expect(getCatalogBrandLogoPath(slug)).toBe(path));
  it("returns null for an unknown slug", () => expect(getCatalogBrandLogoPath("edited-brand")).toBeNull());
});
