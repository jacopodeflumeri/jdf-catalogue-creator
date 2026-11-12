/** @jest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";

const mockPush = jest.fn();
let currentSearch = new URLSearchParams();
jest.mock("next/navigation", () => ({
  usePathname: () => "/admin",
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => currentSearch,
}));

import DashboardRangeSelector from "../DashboardRangeSelector";

describe("Dashboard timeframe selector", () => {
  beforeEach(() => {
    mockPush.mockClear();
    currentSearch = new URLSearchParams();
  });

  it("renders the default 30-day period and omits it from the URL", () => {
    render(<DashboardRangeSelector initialRange="30d" />);
    fireEvent.click(screen.getByRole("button", { name: "30 days" }));
    expect(mockPush).toHaveBeenCalledWith("/admin");
  });

  it("writes bookmarkable selected ranges to the URL", () => {
    render(<DashboardRangeSelector initialRange="30d" />);
    fireEvent.click(screen.getByRole("button", { name: "7 days" }));
    expect(mockPush).toHaveBeenCalledWith("/admin?range=7d");
  });

  it("restores a bookmarked selection and safely normalizes unknown values", () => {
    currentSearch = new URLSearchParams("range=90d");
    const { rerender } = render(<DashboardRangeSelector initialRange="30d" />);
    expect(screen.getByRole("button", { name: "90 days" }).className).toContain("prism-button");
    currentSearch = new URLSearchParams("range=unknown");
    rerender(<DashboardRangeSelector initialRange="30d" />);
    expect(screen.getByRole("button", { name: "30 days" }).className).toContain("prism-button");
  });
});
