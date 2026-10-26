import { fireEvent, render, screen } from "@testing-library/react";
import AddProductsModal from "../AddProductsModal";

jest.mock("@/modules/synthetic_catalog/server/admin-actions", () => ({
  createCatalogGenerationJobAction: jest.fn(),
}));

const catalog = {
  id: 1,
  slug: "premium-apparel",
  nextProductSequence: 1,
  name: "Premium Apparel",
  estimatedSizesPerProduct: 5,
  categorySizeCounts: { coats: 5, shirts: 5 },
  departments: [
    { key: "WOMEN", label: "Women" },
    { key: "MEN", label: "Men" },
  ],
  categories: ["coats", "shirts"],
  assortmentPlan: [
    { id: "women-coats", departmentKey: "WOMEN", category: "coats", subcategory: "wool coats", productCount: 4, outfitSlot: "OUTERWEAR" },
    { id: "men-shirts", departmentKey: "MEN", category: "shirts", subcategory: "formal shirts", productCount: 6, outfitSlot: "TOP" },
  ],
  designMix: {
    patternPercentage: 0,
    embellishmentPercentage: 0,
    allowCombined: false,
    maxCombinedPercentage: 0,
    patterns: [],
    embellishments: [],
    rules: [],
  },
  largeJobThreshold: 25,
};

describe("AddProductsModal scope selection", () => {
  it("selects the first eligible department and enables Continue", async () => {
    render(<AddProductsModal catalog={catalog} onClose={jest.fn()} onCreated={jest.fn()} />);

    fireEvent.click(await screen.findByRole("button", { name: "Choose department" }));

    expect(screen.getByRole("combobox", { name: "Department" })).toHaveValue("WOMEN");
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  it("selects the first eligible category and enables Continue", async () => {
    render(<AddProductsModal catalog={catalog} onClose={jest.fn()} onCreated={jest.fn()} />);

    fireEvent.click(await screen.findByRole("button", { name: "Choose category" }));

    expect(screen.getByRole("combobox", { name: "Category" })).toHaveValue("coats");
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  it("has no product maximum and still requires confirmation at the warning threshold", async () => {
    render(<AddProductsModal catalog={catalog} onClose={jest.fn()} onCreated={jest.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Choose department" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    const countInput = screen.getByRole("spinbutton", { name: "Number of products" });
    expect(countInput).not.toHaveAttribute("max");
    expect(screen.queryByText(/maximum .* products per job/i)).not.toBeInTheDocument();
    fireEvent.change(countInput, { target: { value: "25" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    const confirmation = await screen.findByRole("checkbox", { name: /I confirm/ });
    const generate = screen.getByRole("button", { name: "Generate catalogue information" });
    expect(generate).toBeDisabled();
    fireEvent.click(confirmation);
    expect(generate).toBeEnabled();
  });
});
