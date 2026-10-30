import { render, screen } from "@testing-library/react";
import CatalogOverviewClient from "../CatalogOverviewClient";
import PageHeader from "@/components/ui/PageHeader";
import CatalogBrandLogo from "../CatalogBrandLogo";

jest.mock("next/image", () => ({ __esModule: true, default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} alt={props.alt ?? ""} /> }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("../AddProductsModal", () => () => null);
jest.mock("../DownloadCsvButton", () => () => null);
jest.mock("@/modules/synthetic_catalog/server/admin-actions", () => ({ createSyntheticCatalogAction: jest.fn() }));

describe("catalogue logo placements", () => {
  it("renders the mapped campaign banner while retaining the catalogue and brand names", () => {
    render(<CatalogOverviewClient canEdit={false} initialCatalogs={[{
      id: 1, slug: "premium-apparel", name: "Premium Apparel", brandName: "Aureline", segment: "premium",
      productCount: 0, styleCount: 0, variantCount: 0, readyImageCount: 0, failedImageCount: 10,
      estimatedSizesPerProduct: 5, departments: [], categories: [], categorySizeCounts: {}, assortmentPlan: [],
      designMix: { patternPercentage: 0, embellishmentPercentage: 0, allowCombined: false, maxCombinedPercentage: 0, patterns: [], embellishments: [], rules: [] },
      largeJobThreshold: 25, latestJob: null,
    }]} />);
    expect(screen.getByRole("img", { name: "Aureline catalogue campaign" })).toHaveAttribute("src", expect.stringContaining("aureline-hero.png"));
    expect(screen.getByRole("img", { name: "Aureline logo" })).toBeInTheDocument();
    expect(screen.getByText("Premium Apparel")).toBeInTheDocument();
    expect(screen.getByText(/Aureline · premium/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Premium Apparel catalogue" })).toHaveAttribute("href", "/admin/catalogs/premium-apparel");
    expect(screen.queryByText(/image\(s\) need attention/)).not.toBeInTheDocument();
    expect(screen.queryByText(/generation jobs|Last generation/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Open catalog|Add products|Download UPC CSV/ })).not.toBeInTheDocument();
  });

  it("renders the catalogue logo as a leading visual without replacing the header text", () => {
    render(<PageHeader title="Premium Apparel" description="Aureline · PRE · premium" leadingVisual={<CatalogBrandLogo slug="premium-apparel" brandName="Aureline" size="header" />} />);
    expect(screen.getByRole("heading", { name: "Premium Apparel" })).toBeInTheDocument();
    expect(screen.getByText("Aureline · PRE · premium")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Aureline logo" })).toBeInTheDocument();
  });
});
