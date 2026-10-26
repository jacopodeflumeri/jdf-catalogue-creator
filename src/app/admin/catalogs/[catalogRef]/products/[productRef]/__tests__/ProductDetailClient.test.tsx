import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import type NextImage from "next/image";
import type { CatalogProductDetailView } from "@/modules/synthetic_catalog/admin/types";
import ProductDetailClient from "../ProductDetailClient";

const mockImageProps = jest.fn<void, [ComponentProps<typeof NextImage>]>();

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: ComponentProps<typeof NextImage>) => {
    mockImageProps(props);
    return <span role="img" aria-label={String(props.alt)} />;
  },
}));

jest.mock("@/modules/synthetic_catalog/server/admin-actions", () => ({
  getCatalogProductDetailAction: jest.fn(),
  regenerateCatalogImageAction: jest.fn(),
}));

const detail: CatalogProductDetailView = {
  catalog: {
    id: 1,
    slug: "premium-apparel",
    name: "Premium Apparel",
    segment: "premium",
    brandName: "Aureline",
  },
  product: {
    id: 174,
    archivedAt: null,
    externalId: "PRE-W-000174",
    name: "Aureline Oat Coat",
    description: "A premium coat.",
    departmentKey: "WOMEN",
    department: "Women",
    category: "coats",
    subcategory: "wool coats",
    material: "wool",
    season: "Core",
    patternCode: null,
    embellishmentCodes: [],
    basePrice: "250",
    salePrice: null,
    currency: "EUR",
    status: "READY",
    styles: [{
      id: 174,
      externalId: "PRE-W-000174-OAT",
      colorName: "Oat",
      colorCode: "OAT",
      colorHex: "#D8CDBA",
      status: "READY",
      variants: [],
      images: [],
      completeLook: {
        id: 1,
        status: "READY",
        reason: null,
        imageAssetId: 501,
        imagePublicId: "a16a218b-950e-4171-b28d-e1121465dc73",
        companions: [],
      },
    }],
  },
};

describe("ProductDetailClient Complete the Look image", () => {
  it("loads the stable redirect route in the browser without the failing Next optimizer", () => {
    render(<ProductDetailClient initialDetail={detail} canEdit={false} from={null} />);

    const image = screen.getByRole("img", { name: "Complete the Look for Oat" });
    expect(image).toBeInTheDocument();
    const props = mockImageProps.mock.calls
      .map(([call]) => call)
      .find((call) => call.alt === "Complete the Look for Oat");
    expect(props).toMatchObject({
      src: "/api/catalog-assets/a16a218b-950e-4171-b28d-e1121465dc73",
      unoptimized: true,
    });
  });
});
