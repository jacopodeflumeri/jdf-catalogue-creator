/** @jest-environment jsdom */

/**
 * The company-customer shell during an admin "View as customer" preview: it
 * decides from the SERVER session (the browser's is the admin's), shows the
 * banner, and swaps Sign out — which would sign the ADMIN out — for Exit.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import type { Session } from "next-auth";

jest.mock("@/components/shared/layout/AppBranding", () => ({
  __esModule: true,
  default: () => <span>app</span>,
}));
jest.mock("@/modules/customer_preview/server/actions", () => ({
  startCustomerPreviewAction: jest.fn(),
  getCustomerPreviewOptionsAction: jest.fn(),
}));

import CompanyCustomerLayout from "../CompanyCustomerLayout";

const base = {
  id: "7",
  name: "Ada Admin",
  email: "ada@mapp.com",
  role: "customer",
  authSource: "keycloak",
  companyId: "5046",
};

function session(user: Record<string, unknown>): Session {
  return { user, expires: "2099-01-01T00:00:00.000Z" } as unknown as Session;
}

it("a real customer gets Sign out and no banner", () => {
  render(
    <CompanyCustomerLayout session={session(base)}>
      <div>child</div>
    </CompanyCustomerLayout>,
  );
  expect(screen.getByRole("link", { name: "Sign out" })).toHaveAttribute("href", "/auth/signout");
  expect(screen.queryByRole("status")).toBeNull();
});

it("a preview gets the banner and Exit preview instead of Sign out", () => {
  render(
    <CompanyCustomerLayout
      session={session({
        ...base,
        customerPreview: {
          adminEmail: "ada@mapp.com",
          adminMappUserId: 7,
          companyId: 5046,
          companyName: "Acme Retail",
          expiresAt: "2099-01-01T00:00:00.000Z",
        },
      })}
    >
      <div>child</div>
    </CompanyCustomerLayout>,
  );
  expect(screen.queryByRole("link", { name: "Sign out" })).toBeNull();
  expect(screen.getByRole("link", { name: "Exit preview" })).toHaveAttribute(
    "href",
    "/admin/customer-preview/end",
  );
  expect(screen.getByRole("status")).toHaveTextContent("Viewing as Acme Retail");
  expect(screen.getByText("child")).toBeInTheDocument();
});
