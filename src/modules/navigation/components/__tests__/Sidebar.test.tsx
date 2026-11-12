/** @jest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import { ADMIN_NAVIGATION_ITEMS, ADMIN_UTILITY_NAVIGATION_ITEMS } from "../../config/navigation-items";

jest.mock("next/navigation", () => ({ usePathname: () => "/admin" }));
jest.mock("@/components/ui/Icon", () => ({ __esModule: true, default: () => <span aria-hidden="true">icon</span> }));
jest.mock("@/components/shared/user/UserProfileCard", () => ({ __esModule: true, default: () => null }));
jest.mock("../AdminImpersonationBanner", () => ({ __esModule: true, default: () => null }));
jest.mock("../EnvironmentLabsPill", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/shared/layout/AppBranding", () => ({ __esModule: true, default: () => <span>Catalogue Creator</span> }));

import Sidebar from "../Sidebar";

describe("admin sidebar accessibility", () => {
  it("keeps accessible names on collapsed icon links and retains their tooltips", () => {
    render(<Sidebar variant="desktop" navigationItems={ADMIN_NAVIGATION_ITEMS} utilityNavigationItems={ADMIN_UTILITY_NAVIGATION_ITEMS} userType="admin" dashboardRoute="/admin" />);
    fireEvent.click(screen.getByTitle("Collapse sidebar"));
    for (const label of ["Dashboard", "Catalogues", "LiteLLM Usage", "Settings"]) {
      expect(screen.getByRole("link", { name: label })).toHaveAttribute("title", label);
    }
  });

  it("shows named primary and lower utility links in the mobile drawer", () => {
    render(<Sidebar variant="mobile" isOpen navigationItems={ADMIN_NAVIGATION_ITEMS} utilityNavigationItems={ADMIN_UTILITY_NAVIGATION_ITEMS} userType="admin" dashboardRoute="/admin" />);
    for (const label of ["Dashboard", "Catalogues", "LiteLLM Usage", "Settings"]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
  });
});
