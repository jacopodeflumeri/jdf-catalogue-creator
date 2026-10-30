import { getCatalogBrandHeroPath, getCatalogBrandLogoPath } from "../brand-assets";

describe("catalogue brand logo assets", () => {
  it.each([
    ["premium-apparel", "/img/aureline.png"],
    ["fast-fashion", "/img/loopline.png"],
    ["luxury-fashion", "/img/maison-veyra.png"],
    ["activewear", "/img/kinetiq-form.png"],
  ])("maps %s to its static asset", (slug, path) => expect(getCatalogBrandLogoPath(slug)).toBe(path));
  it("returns null for an unknown slug", () => expect(getCatalogBrandLogoPath("edited-brand")).toBeNull());

  it.each([
    ["premium-apparel", "/img/aureline-hero.png"],
    ["fast-fashion", "/img/loopline-hero.png"],
    ["luxury-fashion", "/img/maison-veyra-hero.png"],
    ["activewear", "/img/kineticForm-hero.png"],
  ])("maps %s to its campaign hero", (slug, path) => expect(getCatalogBrandHeroPath(slug)).toBe(path));
  it("does not invent a campaign hero for an unknown slug", () => expect(getCatalogBrandHeroPath("edited-brand")).toBeNull());
});
