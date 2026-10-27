import { ADMIN_NAVIGATION_ITEMS, createNavigationItems } from "../navigation-items";

describe("admin catalog navigation", () => {
  it("preserves fixed links and inserts deterministic database catalogues", () => {
    const items = createNavigationItems("admin", undefined, [{ slug: "z-custom", name: "Z Custom" }, { slug: "a-custom", name: "A Custom" }]);
    expect(items.map(({ name }) => name)).toEqual(["Dashboard", "A Custom", "Z Custom", "LiteLLM Usage"]);
    expect(items[2]).toEqual(expect.objectContaining({ name: "Z Custom", href: "/admin/catalogs/z-custom" }));
    expect(ADMIN_NAVIGATION_ITEMS.map(({ href }) => href)).toEqual(["/admin", "/admin/llm-usage"]);
  });
});
