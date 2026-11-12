import { ADMIN_NAVIGATION_ITEMS, ADMIN_UTILITY_NAVIGATION_ITEMS, createNavigationItems } from "../navigation-items";

describe("admin navigation", () => {
  it("keeps only Dashboard and Catalogues in the primary navigation", () => {
    expect(createNavigationItems("admin").map(({ name, href }) => [name, href])).toEqual([
      ["Dashboard", "/admin"],
      ["Catalogues", "/admin/catalogs"],
    ]);
  });

  it("places LiteLLM Usage and Settings once in the lower utility navigation", () => {
    expect(ADMIN_UTILITY_NAVIGATION_ITEMS.map(({ name, href }) => [name, href])).toEqual([
      ["LiteLLM Usage", "/admin/llm-usage"],
      ["Settings", "/admin/settings"],
    ]);
    expect(ADMIN_NAVIGATION_ITEMS.some(({ href }) => href === "/admin/llm-usage" || href === "/admin/settings")).toBe(false);
  });
});
