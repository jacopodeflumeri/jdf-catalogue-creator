import {
  isNavItemActive,
  isActive,
  isParentActive,
  navHrefPath,
} from "../navigation-filters";
import type { NavigationItem } from "../../types";

describe("navHrefPath", () => {
  it("drops the query, hash and trailing slash", () => {
    expect(navHrefPath("/admin/settings?tab=team")).toBe("/admin/settings");
    expect(navHrefPath("/admin/settings#audit")).toBe("/admin/settings");
    expect(navHrefPath("/admin/settings/")).toBe("/admin/settings");
    expect(navHrefPath("/")).toBe("/");
  });
});

describe("isNavItemActive", () => {
  it("matches the page itself and pages below it", () => {
    expect(isNavItemActive("/admin/users", "/admin/users")).toBe(true);
    expect(isNavItemActive("/admin/users", "/admin/users/42")).toBe(true);
    expect(isNavItemActive("/admin/users", "/admin/users/42/edit")).toBe(true);
  });

  it("matches on whole path segments only", () => {
    expect(isNavItemActive("/admin/user", "/admin/users")).toBe(false);
    expect(isNavItemActive("/account/set", "/account/settings")).toBe(false);
  });

  it("ignores the query and hash on the href", () => {
    expect(isNavItemActive("/admin/settings?tab=team", "/admin/settings")).toBe(true);
    expect(isNavItemActive("/admin/settings#audit", "/admin/settings/x")).toBe(true);
    expect(isNavItemActive("/admin/user?x=1", "/admin/users")).toBe(false);
  });

  it("matches area roots exactly", () => {
    expect(isNavItemActive("/admin", "/admin")).toBe(true);
    expect(isNavItemActive("/admin", "/admin/")).toBe(true);
    expect(isNavItemActive("/admin", "/admin/settings")).toBe(false);
    expect(isNavItemActive("/account", "/account")).toBe(true);
    expect(isNavItemActive("/account", "/account/settings")).toBe(false);
    expect(isNavItemActive("/account?view=all", "/account")).toBe(true);
    expect(isNavItemActive("/", "/admin")).toBe(false);
  });

  it("is false without an href or pathname", () => {
    expect(isNavItemActive(undefined, "/admin")).toBe(false);
    expect(isNavItemActive("", "/admin")).toBe(false);
    expect(isNavItemActive("#", "/admin")).toBe(false);
    expect(isNavItemActive("/admin/users", null)).toBe(false);
  });
});

describe("isActive / isParentActive", () => {
  it("isActive applies the same rule", () => {
    expect(isActive("/admin/user", "/admin/users")).toBe(false);
    expect(isActive("/admin/users?page=2", "/admin/users")).toBe(true);
  });

  it("isParentActive is true when any child matches", () => {
    const item: NavigationItem = {
      name: "Section",
      children: [
        { name: "A", href: "/admin/section/a?sort=name" },
        { name: "B", href: "/admin/section/b" },
      ],
    };
    expect(isParentActive(item, "/admin/section/a")).toBe(true);
    expect(isParentActive(item, "/admin/section/b/1")).toBe(true);
    expect(isParentActive(item, "/admin/section/bb")).toBe(false);
    expect(isParentActive({ name: "Leaf", href: "/x" }, "/x")).toBe(false);
  });
});
