/** @jest-environment jsdom */

import React from "react";
import { act, render } from "@testing-library/react";

let mockSession: unknown = null;
jest.mock("next-auth/react", () => ({
  useSession: () => ({ data: mockSession, status: mockSession ? "authenticated" : "unauthenticated" }),
}));
jest.mock("next/navigation", () => ({
  usePathname: () => "/account/settings",
}));
jest.mock("@/modules/auth/client", () => ({
  isCompanyCustomer: (s: { user?: { role?: string; authSource?: string } } | null) =>
    s?.user?.role === "customer" && s?.user?.authSource === "keycloak",
}));

const mockLogPageVisit = jest.fn();
jest.mock("@/lib/actions/admin/activity-actions", () => ({
  logPageVisit: (...args: unknown[]) => mockLogPageVisit(...args),
}));

import { PageActivityLogger } from "../PageActivityLogger";

async function renderAndWait() {
  render(<PageActivityLogger />);
  await act(async () => {
    jest.advanceTimersByTime(1500);
  });
  // Let the dynamic import inside the timer callback settle.
  await act(async () => {
    jest.useRealTimers();
    await new Promise((r) => setTimeout(r, 0));
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  mockLogPageVisit.mockReset();
});

afterEach(() => {
  jest.useRealTimers();
});

it("logs page visits for legacy customers", async () => {
  mockSession = { user: { role: "customer", authSource: "magic-link", accountId: "7" } };
  await renderAndWait();
  expect(mockLogPageVisit).toHaveBeenCalledWith("/account/settings");
});

it("sends nothing for Company-Login customers", async () => {
  mockSession = { user: { role: "customer", authSource: "keycloak", accountId: "5" } };
  await renderAndWait();
  expect(mockLogPageVisit).not.toHaveBeenCalled();
});

it("sends nothing for admins", async () => {
  mockSession = { user: { role: "admin" } };
  await renderAndWait();
  expect(mockLogPageVisit).not.toHaveBeenCalled();
});
