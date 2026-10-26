import { render, screen } from "@testing-library/react";
import CatalogOverviewClient from "../CatalogOverviewClient";
import PageHeader from "@/components/ui/PageHeader";
import CatalogBrandLogo from "../CatalogBrandLogo";

jest.mock("next/image", () => ({ __esModule: true, default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} alt={props.alt ?? ""} /> }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("../AddProductsModal", () => () => null);
jest.mock("../DownloadCsvButton", () => () => null);

describe("catalogue logo placements", () => {
  it("renders the logo in the catalogue overview card while retaining the catalogue and brand names", () => {
    render(<CatalogOverviewClient canEdit={false} initialCatalogs={[{
      id: 1, slug: "premium-apparel", name: "Premium Apparel", brandName: "Aureline", segment: "premium",
      productCount: 0, styleCount: 0, variantCount: 0, readyImageCount: 0, failedImageCount: 0,
      estimatedSizesPerProduct: 5, departments: [], categories: [], categorySizeCounts: {}, assortmentPlan: [],
      designMix: { patternPercentage: 0, embellishmentPercentage: 0, allowCombined: false, maxCombinedPercentage: 0, patterns: [], embellishments: [], rules: [] },
      largeJobThreshold: 25, latestJob: null,
    }]} />);
    expect(screen.getByRole("img", { name: "Aureline logo" })).toBeInTheDocument();
    expect(screen.getByText("Premium Apparel")).toBeInTheDocument();
    expect(screen.getByText("Aureline", { selector: "p" })).toBeInTheDocument();
  });

  it("renders the catalogue logo as a leading visual without replacing the header text", () => {
    render(<PageHeader title="Premium Apparel" description="Aureline · PRE · premium" leadingVisual={<CatalogBrandLogo slug="premium-apparel" brandName="Aureline" size="header" />} />);
    expect(screen.getByRole("heading", { name: "Premium Apparel" })).toBeInTheDocument();
    expect(screen.getByText("Aureline · PRE · premium")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Aureline logo" })).toBeInTheDocument();
  });
});
