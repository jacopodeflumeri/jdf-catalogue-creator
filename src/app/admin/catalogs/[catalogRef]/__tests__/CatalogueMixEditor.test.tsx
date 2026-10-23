import { fireEvent, render, screen, within } from "@testing-library/react";
import type { CatalogDetailView } from "@/modules/synthetic_catalog/admin/types";

const mockConfirm = jest.fn();
const mockSave = jest.fn();
jest.mock("@/components/providers/ConfirmProvider", () => ({ useConfirm: () => ({ confirm: (...args: unknown[]) => mockConfirm(...args) }) }));
jest.mock("@/modules/synthetic_catalog/server/admin-actions", () => ({ saveCatalogMixAction: (...args: unknown[]) => mockSave(...args) }));

import CatalogueMixEditor from "../CatalogueMixEditor";

const detail = {
  catalog: {
    id: 1,
    departments: [{ key: "WOMEN", label: "Women", code: "W", generationWeight: 1 }],
    assortmentPlan: [
      { departmentKey: "WOMEN", category: "coats", subcategory: "wool coats", productCount: 2, outfitSlot: "OUTERWEAR" },
      { departmentKey: "WOMEN", category: "shirts", subcategory: "poplin shirts", productCount: 3, outfitSlot: "TOP" },
    ],
  },
} as unknown as CatalogDetailView;

describe("CatalogueMixEditor row identity", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConfirm.mockResolvedValue(true);
    mockSave.mockResolvedValue({ ok: true });
  });

  it("keeps focus and the complete value while typing in category and subcategory fields", () => {
    render(<CatalogueMixEditor detail={detail} canEdit onSaved={jest.fn()} />);
    const categories = screen.getAllByRole("textbox");
    const firstCategory = categories[0]!;
    firstCategory.focus();
    for (const value of ["coats x", "coats xy", "coats xyz"]) {
      fireEvent.change(firstCategory, { target: { value } });
      expect(document.activeElement).toBe(firstCategory);
    }
    expect(firstCategory).toHaveValue("coats xyz");

    const subcategories = screen.getAllByRole("textbox");
    const firstSubcategory = subcategories[1]!;
    firstSubcategory.focus();
    for (const value of ["wool coats x", "wool coats xy", "wool coats xyz"]) {
      fireEvent.change(firstSubcategory, { target: { value } });
      expect(document.activeElement).toBe(firstSubcategory);
    }
    expect(firstSubcategory).toHaveValue("wool coats xyz");
    expect(screen.getAllByRole("textbox")[2]).toHaveValue("shirts");
    expect(screen.getAllByRole("textbox")[3]).toHaveValue("poplin shirts");
  });

  it("keeps neighboring row state when a row is added or removed", async () => {
    render(<CatalogueMixEditor detail={detail} canEdit onSaved={jest.fn()} />);
    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0]!, { target: { value: "edited coats" } });
    fireEvent.change(inputs[2]!, { target: { value: "edited shirts" } });
    fireEvent.click(screen.getByRole("button", { name: /add row/i }));
    expect(screen.getAllByRole("textbox")[0]).toHaveValue("edited coats");
    expect(screen.getAllByRole("textbox")[2]).toHaveValue("edited shirts");

    const firstRow = screen.getByText("edited coats").closest("tr")!;
    fireEvent.click(within(firstRow).getByRole("button", { name: /remove/i }));
    expect(await screen.findByText("edited shirts")).toBeInTheDocument();
    expect(screen.getAllByRole("textbox")[0]).toHaveValue("edited shirts");
    expect(screen.getAllByRole("textbox")[1]).toHaveValue("poplin shirts");
  });
});
