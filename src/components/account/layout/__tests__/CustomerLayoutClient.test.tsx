/** @jest-environment jsdom */

import React from "react";
import { render, screen } from "@testing-library/react";
import type { Session } from "next-auth";

// SSR/first client render always reports status "loading". The shell must still
// render route {children} (the server session is passed in; children never gated).
jest.mock("next-auth/react", () => ({
  useSession: () => ({ data: null, status: "loading" }),
}));
jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/account",
}));
jest.mock("@/modules/navigation", () => ({
  __esModule: true,
  default: () => null,
  NavigationComponent: () => <nav>top-nav</nav>,
  Sidebar: () => null,
  createNavigationItems: () => [],
  filterSidebarItems: () => [],
}));
jest.mock("@/components/shared/layout/MobileAppHeader", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/components/shared/layout/Footer", () => ({
  __esModule: true,
  default: () => <footer>footer</footer>,
}));
jest.mock("@/modules/auth/components/AuthErrorProvider", () => ({
  AuthErrorProvider: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));
jest.mock("@/components/providers/CustomerAccountProvider", () => ({
  CustomerAccountProvider: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

import CustomerLayoutClient from "../CustomerLayoutClient";

const session = {
  user: { role: "customer", email: "c@example.com" },
  expires: "2099-01-01T00:00:00.000Z",
} as unknown as Session;

it("renders route children even while the client session is loading", () => {
  render(
    <CustomerLayoutClient customerAccount={null} session={session}>
      <div>child-content</div>
    </CustomerLayoutClient>,
  );
  expect(screen.queryByText("child-content")).not.toBeNull();
  expect(screen.queryByText("footer")).not.toBeNull();
});
