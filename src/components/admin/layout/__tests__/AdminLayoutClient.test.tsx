/** @jest-environment jsdom */

import React from "react";
import { render, screen } from "@testing-library/react";

// SSR/first client render always reports status "loading". The shell must still
// render route {children} (chrome reflects session state, children never gated).
jest.mock("next-auth/react", () => ({
  useSession: () => ({ data: null, status: "loading" }),
}));
jest.mock("@/modules/auth/client", () => ({ isAdminAccessSession: () => false }));
jest.mock("@/modules/navigation", () => ({
  Sidebar: () => null,
  createNavigationItems: () => [],
  ADMIN_NAVIGATION_ADMIN_ITEMS: [],
  ADMIN_UTILITY_NAVIGATION_ITEMS: [],
}));
jest.mock("@/modules/auth/components/AdminErrorBoundary", () => ({
  __esModule: true,
  default: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));
jest.mock("@/modules/auth/components/AdminErrorProvider", () => ({
  AdminErrorProvider: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));
jest.mock("@/components/providers/UserProfileProvider", () => ({
  UserProfileProvider: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

import AdminLayoutClient from "../AdminLayoutClient";

it("renders route children even while the client session is loading", () => {
  render(
    <AdminLayoutClient userProfile={null}>
      <div>child-content</div>
    </AdminLayoutClient>,
  );
  expect(screen.queryByText("child-content")).not.toBeNull();
});
