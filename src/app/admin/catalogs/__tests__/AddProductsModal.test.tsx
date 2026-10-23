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
  maxProductsPerJob: 100,
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
});
