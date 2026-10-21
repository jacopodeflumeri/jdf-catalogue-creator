/** @jest-environment jsdom */

/**
 * Sign-in honours `?callbackUrl=` (set by NextAuth's middleware when a
 * signed-out visitor opens a protected page), so a bookmark survives an
 * expired session — but only within the area the chosen login lands in.
 */

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const mockSignIn = jest.fn();
jest.mock("next-auth/react", () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
  useSession: () => ({ data: null, status: "unauthenticated" }),
}));

let mockQuery = "";
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(mockQuery),
}));
jest.mock("@/components/shared/layout/AppBranding", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/lib/utils/logger", () => ({
  __esModule: true,
  default: { error: jest.fn(), debug: jest.fn(), log: jest.fn(), warn: jest.fn() },
}));

import AdminSignInClient from "../admin/AdminSignInClient";
import DevLoginClient from "../dev/DevLoginClient";

const origin = window.location.origin;

function renderAdminSignIn(devAuthEnabled = false) {
  return render(
    <AdminSignInClient
      appName="My App"
      internalProvider="keycloak"
      keycloakIdpHint="entra"
      keycloakCompanyIdpHint="mapp-cloud"
      devAuthEnabled={devAuthEnabled}
    />,
  );
}

beforeEach(() => {
  mockSignIn.mockReset();
  mockQuery = "";
  window.history.replaceState({}, "", "/");
});

describe("AdminSignInClient", () => {
  it("lands a Company Login on the requested customer page", async () => {
    mockQuery = `callbackUrl=${encodeURIComponent(`${origin}/account/settings?tab=team`)}`;
    renderAdminSignIn();
    fireEvent.click(screen.getByText("Company Login"));
    await waitFor(() => expect(mockSignIn).toHaveBeenCalled());
    expect(mockSignIn.mock.calls[0][1]).toEqual({ callbackUrl: "/account/settings?tab=team" });
  });

  it("keeps each login in its own area", async () => {
    mockQuery = `callbackUrl=${encodeURIComponent(`${origin}/account/settings`)}`;
    renderAdminSignIn();
    fireEvent.click(screen.getByText("Mapp Entra ID"));
    await waitFor(() => expect(mockSignIn).toHaveBeenCalled());
    expect(mockSignIn.mock.calls[0][1]).toEqual({ callbackUrl: "/admin" });
  });

  it("refuses a foreign callbackUrl", async () => {
    mockQuery = `callbackUrl=${encodeURIComponent("https://evil.example/admin/x")}`;
    renderAdminSignIn();
    fireEvent.click(screen.getByText("Mapp Entra ID"));
    await waitFor(() => expect(mockSignIn).toHaveBeenCalled());
    expect(mockSignIn.mock.calls[0][1]).toEqual({ callbackUrl: "/admin" });
  });

  it("forwards callbackUrl onto the dev-login link", () => {
    const requested = `${origin}/admin/settings`;
    mockQuery = `callbackUrl=${encodeURIComponent(requested)}`;
    renderAdminSignIn(true);
    expect(
      screen.getByText("Developer login (local only)").closest("a")?.getAttribute("href"),
    ).toBe(`/auth/dev?callbackUrl=${encodeURIComponent(requested)}`);
  });

  it("hides the dev-login link unless dev auth is enabled", () => {
    renderAdminSignIn(false);
    expect(screen.queryByText("Developer login (local only)")).toBeNull();
  });
});

describe("DevLoginClient", () => {
  it("lands on the requested page in the role's area", async () => {
    window.history.replaceState(
      {},
      "",
      `/auth/dev?callbackUrl=${encodeURIComponent(`${origin}/account/settings`)}`,
    );
    render(<DevLoginClient />);
    fireEvent.click(screen.getByText("Sign in (dev)"));
    await waitFor(() => expect(mockSignIn).toHaveBeenCalled());
    expect(mockSignIn.mock.calls[0][0]).toBe("dev-login");
    expect(mockSignIn.mock.calls[0][1]).toMatchObject({
      role: "customer",
      callbackUrl: "/account/settings",
    });
  });

  it("falls back to the area root without a callbackUrl", async () => {
    render(<DevLoginClient />);
    fireEvent.click(screen.getByText("admin"));
    fireEvent.click(screen.getByText("Sign in (dev)"));
    await waitFor(() => expect(mockSignIn).toHaveBeenCalled());
    expect(mockSignIn.mock.calls[0][1]).toMatchObject({ role: "admin", callbackUrl: "/admin" });
  });
});
