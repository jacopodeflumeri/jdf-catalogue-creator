/** @jest-environment node */

/**
 * The admin developer pages (/admin/auth-debug and /admin/ldap-groups-example)
 * share one gate, config.authDebug.enabled: off -> 404 before any session
 * lookup; on -> still admin-only.
 */

const mockConfig = { authDebug: { enabled: false }, app: { name: "Test App" } };
jest.mock("@/config", () => ({
  get config() {
    return mockConfig;
  },
}));

const mockNotFound = jest.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
jest.mock("next/navigation", () => ({ notFound: () => mockNotFound() }));

const mockRequireAdmin = jest.fn();
jest.mock("@/modules/auth/server", () => ({
  requireAdmin: (...a: unknown[]) => mockRequireAdmin(...a),
}));

import AdminAuthDebugPage from "../auth-debug/page";
import AdminLdapGroupsExamplePage from "../ldap-groups-example/page";

const pages = [
  ["/admin/auth-debug", AdminAuthDebugPage],
  ["/admin/ldap-groups-example", AdminLdapGroupsExamplePage],
] as const;

beforeEach(() => {
  mockNotFound.mockClear();
  mockRequireAdmin.mockReset();
  mockRequireAdmin.mockResolvedValue({
    user: { email: "ada@mapp.com", role: "admin", mappLdapGroups: [] },
  });
});

describe.each(pages)("%s", (_path, Page) => {
  it("404s without touching the session when the flag is off", async () => {
    mockConfig.authDebug.enabled = false;
    await expect(Page()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mockNotFound).toHaveBeenCalledTimes(1);
    expect(mockRequireAdmin).not.toHaveBeenCalled();
  });

  it("renders for an admin when the flag is on", async () => {
    mockConfig.authDebug.enabled = true;
    await expect(Page()).resolves.toBeTruthy();
    expect(mockNotFound).not.toHaveBeenCalled();
    expect(mockRequireAdmin).toHaveBeenCalledWith({ redirectTo: "/auth/admin" });
  });
});
