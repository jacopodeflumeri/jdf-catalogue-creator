import { ADMIN_NAVIGATION_ITEMS } from "../navigation-items";

describe("admin catalog navigation", () => {
  it("links each catalog segment directly from the sidebar", () => {
    expect(ADMIN_NAVIGATION_ITEMS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Premium", href: "/admin/catalogs/premium-apparel" }),
        expect.objectContaining({ name: "Fast Fashion", href: "/admin/catalogs/fast-fashion" }),
        expect.objectContaining({ name: "Luxury", href: "/admin/catalogs/luxury-fashion" }),
        expect.objectContaining({ name: "Activewear", href: "/admin/catalogs/activewear" }),
      ]),
    );
  });
});
