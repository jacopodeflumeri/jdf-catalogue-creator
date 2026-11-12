/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react";
import type { CatalogueDashboardView } from "@/modules/synthetic_catalog/admin/dashboard-types";

jest.mock("next/navigation", () => ({
  usePathname: () => "/admin",
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock("../ActivityTrendChart", () => ({ __esModule: true, default: function ActivityTrendChartMock() { return <div>Trend chart</div>; } }));

import CatalogDashboard, { formatDashboardDuration } from "../CatalogDashboard";

const emptyDashboard: CatalogueDashboardView = {
  range: { range: "30d", from: new Date("2026-10-13T12:00:00.000Z"), to: new Date("2026-11-12T12:00:00.000Z"), label: "period" },
  inventory: { catalogues: 1, products: 0, styles: 0, variants: 0, readyImages: 0, readyLooks: 0, archivedProducts: 0 },
  activity: { productsCreated: 0, imagesCompleted: 0, jobsCompleted: 0, jobsFailedOrCancelled: 0, jobsSuccessful: 0, successRate: null, cumulativeProcessingMs: 0, completedJobs: 0, validDurationJobs: 0 },
  stages: ["CATALOG_INFO", "CORE_IMAGES", "COMPLETE_LOOK"].map((stage) => ({
    stage: stage as "CATALOG_INFO" | "CORE_IMAGES" | "COMPLETE_LOOK", completedJobs: 0, producedUnits: 0,
    averageDurationMs: null, medianDurationMs: null, averageThroughputPerMinute: null, failedJobs: 0, successRate: null,
  })),
  catalogues: [{ id: 12, slug: "premium-apparel", name: "Premium Apparel", brandName: "Aureline", productCount: 0,
    styleCount: 0, readyCoreStyles: 0, readyLooks: 0, eligibleLookStyles: 0, failedImages: 0,
    latestJobStatus: null, lastCompletedAt: null }],
  recentJobs: [], trend: [],
};

describe("catalogue Dashboard interface", () => {
  it("shows exact timeframe, an explicit empty-period message, and catalogue workspace links", () => {
    render(<CatalogDashboard dashboard={emptyDashboard} />);
    expect(screen.getByText(/Resolved range:/)).toHaveTextContent(/13 .* 2026, 12:00 UTC/);
    expect(screen.getAllByText("No generation activity in this period.").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Premium Apparel" })).toHaveAttribute("href", "/admin/catalogs/premium-apparel");
  });

  it("labels cumulative and average processing time accurately", () => {
    expect(formatDashboardDuration(1_500)).toBe("1s");
    expect(formatDashboardDuration(65_000)).toBe("1m 5s");
    expect(formatDashboardDuration(3_600_000)).toBe("1h");
    render(<CatalogDashboard dashboard={{ ...emptyDashboard, activity: { ...emptyDashboard.activity, cumulativeProcessingMs: 65_000, validDurationJobs: 2 } }} />);
    expect(screen.getByText("Cumulative processing time")).toBeInTheDocument();
    expect(screen.getByText("Across 2 completed jobs with valid timing")).toBeInTheDocument();
    expect(screen.queryByText(/time saved|human work saved|elapsed wall-clock time/i)).not.toBeInTheDocument();
  });
});
