import { fireEvent, render, screen } from "@testing-library/react";
import CatalogBrandLogo from "../CatalogBrandLogo";

jest.mock("next/image", () => ({ __esModule: true, default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} alt={props.alt ?? ""} /> }));

describe("CatalogBrandLogo", () => {
  it("renders the mapped logo with meaningful alt text", () => {
    render(<CatalogBrandLogo slug="premium-apparel" brandName="Aureline" />);
    expect(screen.getByRole("img", { name: "Aureline logo" })).toHaveAttribute("src", "/img/aureline.png");
  });
  it("uses textual identity for unknown or failed images", () => {
    const { rerender } = render(<CatalogBrandLogo slug="unknown" brandName="Brand identity" />);
    expect(screen.getByText("Brand identity")).toBeInTheDocument();
    rerender(<CatalogBrandLogo slug="activewear" brandName="Kinetic Form" />);
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByText("Kinetic Form")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
