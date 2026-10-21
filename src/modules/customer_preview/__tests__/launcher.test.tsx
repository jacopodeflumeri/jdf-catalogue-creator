/** @jest-environment jsdom */

/**
 * The launch point: hidden (not disabled) when not allowed; one workspace →
 * a plain button for the whole company; two or more → a chooser between the
 * whole company and one workspace; workspaces loaded on demand when the page
 * doesn't have them. It always passes the current page as returnTo.
 */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const mockStart = jest.fn(async () => undefined);
const mockOptions = jest.fn();
jest.mock("../server/actions", () => ({
  startCustomerPreviewAction: (...a: unknown[]) => mockStart(...(a as [])),
  getCustomerPreviewOptionsAction: (...a: unknown[]) => mockOptions(...a),
}));

import CustomerPreviewLauncher from "../components/CustomerPreviewLauncher";

const TWO = [
  { id: 1, name: "North" },
  { id: 2, name: "South" },
];

beforeEach(() => {
  jest.clearAllMocks();
  window.history.replaceState({}, "", "/admin/company-users?q=acme");
});

it("renders nothing when not allowed", () => {
  const { container } = render(
    <CustomerPreviewLauncher allowed={false} companyId={5} workspaces={TWO} />,
  );
  expect(container).toBeEmptyDOMElement();
});

it("one workspace: a plain button previews the whole company", async () => {
  render(<CustomerPreviewLauncher allowed companyId={5} workspaces={[TWO[0]]} />);
  fireEvent.click(screen.getByRole("button", { name: /view as customer/i }));
  await waitFor(() => expect(mockStart).toHaveBeenCalled());
  expect(mockStart).toHaveBeenCalledWith({
    companyId: 5,
    returnTo: "/admin/company-users?q=acme",
  });
});

it("two or more: a chooser between the whole company and one workspace", async () => {
  render(<CustomerPreviewLauncher allowed companyId={5} companyName="Acme" workspaces={TWO} />);
  fireEvent.click(screen.getByRole("button", { name: /view as customer/i }));
  expect(await screen.findByText("Whole company")).toBeInTheDocument();
  expect(mockStart).not.toHaveBeenCalled();

  fireEvent.click(screen.getByText("South only"));
  await waitFor(() => expect(mockStart).toHaveBeenCalled());
  expect(mockStart).toHaveBeenCalledWith({
    companyId: 5,
    workspaceIds: [2],
    returnTo: "/admin/company-users?q=acme",
  });
});

it("loads the workspaces on click when the page doesn't have them", async () => {
  mockOptions.mockResolvedValue({ ok: true, companyName: "Acme", workspaces: TWO });
  render(<CustomerPreviewLauncher allowed companyId={5} />);
  fireEvent.click(screen.getByRole("button", { name: /view as customer/i }));
  expect(await screen.findByText("North only")).toBeInTheDocument();
  expect(mockOptions).toHaveBeenCalledWith(5);
});

it("starts anyway when the options can't be loaded, so the server shows why", async () => {
  mockOptions.mockResolvedValue({ ok: false });
  render(<CustomerPreviewLauncher allowed companyId={5} />);
  fireEvent.click(screen.getByRole("button", { name: /view as customer/i }));
  await waitFor(() => expect(mockStart).toHaveBeenCalled());
});
