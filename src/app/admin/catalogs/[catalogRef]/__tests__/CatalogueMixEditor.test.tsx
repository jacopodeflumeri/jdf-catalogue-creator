import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { CatalogDetailView } from "@/modules/synthetic_catalog/admin/types";

const mockConfirm = jest.fn();
const mockSave = jest.fn();
const mockSaveDesign = jest.fn();
jest.mock("@/components/providers/ConfirmProvider", () => ({ useConfirm: () => ({ confirm: (...args: unknown[]) => mockConfirm(...args) }) }));
jest.mock("@/modules/synthetic_catalog/server/admin-actions", () => ({ saveCatalogMixAction: (...args: unknown[]) => mockSave(...args), saveCatalogDesignMixAction: (...args: unknown[]) => mockSaveDesign(...args) }));

import CatalogueMixEditor from "../CatalogueMixEditor";
import DesignMixEditor from "../DesignMixEditor";

const detail = {
  catalog: {
    id: 1,
    departments: [{ key: "WOMEN", label: "Women", code: "W", generationWeight: 1 }],
    assortmentPlan: [
      { id: "mix-coats", departmentKey: "WOMEN", category: "coats", subcategory: "wool coats", productCount: 2, outfitSlot: "OUTERWEAR" },
      { id: "mix-shirts", departmentKey: "WOMEN", category: "shirts", subcategory: "poplin shirts", productCount: 3, outfitSlot: "TOP" },
    ],
  },
} as unknown as CatalogDetailView;

describe("CatalogueMixEditor row identity", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConfirm.mockResolvedValue(true);
    mockSave.mockResolvedValue({ ok: true });
    mockSaveDesign.mockResolvedValue({ ok: true });
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

    // Category text is rendered in an input, so assert its value and locate its row from the input.
    const firstRow = screen.getByDisplayValue("edited coats").closest("tr")!;
    fireEvent.click(within(firstRow).getByRole("button", { name: /remove/i }));
    await waitFor(() => {
      expect(screen.getAllByRole("textbox")[0]).toHaveValue("edited shirts");
      expect(screen.getAllByRole("textbox")[1]).toHaveValue("poplin shirts");
    });
  });

  it("supports unassigned zero-quota rows, department and outfit-slot selection, and saving", async () => {
    render(<CatalogueMixEditor detail={detail} canEdit onSaved={jest.fn().mockResolvedValue(undefined)} />);
    fireEvent.click(screen.getByRole("button", { name: /add row/i }));
    const textboxes = screen.getAllByRole("textbox");
    const selects = screen.getAllByRole("combobox");
    const counts = screen.getAllByRole("spinbutton");
    expect(counts[2]).toHaveValue(0);
    expect(counts[2]).toBeDisabled();
    expect(selects[5]).toHaveValue("");
    expect(selects[5]).toBeDisabled();

    fireEvent.change(textboxes[4]!, { target: { value: "bags" } });
    fireEvent.change(textboxes[5]!, { target: { value: "tote bags" } });
    fireEvent.change(selects[4]!, { target: { value: "WOMEN" } });
    fireEvent.change(screen.getAllByRole("spinbutton")[2]!, { target: { value: "1" } });
    fireEvent.change(screen.getAllByRole("combobox")[5]!, { target: { value: "BAG" } });
    fireEvent.click(screen.getByRole("button", { name: /save catalogue mix/i }));

    await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(1));
    const savedRows = mockSave.mock.calls[0]![0].rows;
    expect(savedRows[2]).toMatchObject({ departmentKey: "WOMEN", category: "bags", subcategory: "tote bags", productCount: 1, outfitSlot: "BAG" });
    expect(savedRows[2].id).toBeTruthy();
  });

  it("keeps viewer controls read-only", () => {
    render(<CatalogueMixEditor detail={detail} canEdit={false} onSaved={jest.fn()} />);
    expect(screen.queryByRole("button", { name: /add row/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /save catalogue mix/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole("textbox").every((input) => (input as HTMLInputElement).disabled)).toBe(true);
    expect(screen.getAllByRole("combobox").every((input) => (input as HTMLSelectElement).disabled)).toBe(true);
  });

  it("keeps Design Mix compatibility rules keyed to canonical Catalogue Mix row IDs", async () => {
    const detailWithDesignMix = { ...detail, catalog: { ...detail.catalog, designMix: {
      patternPercentage: 25, embellishmentPercentage: 0, allowCombined: false, maxCombinedPercentage: 0,
      patterns: [{ code: "STRIPED", label: "Striped" }, { code: "BRAND_LOGO_REPEAT", label: "Brand logo repeat" }],
      embellishments: [], rules: [],
    } } } as unknown as CatalogDetailView;
    render(<DesignMixEditor detail={detailWithDesignMix} canEdit onSaved={jest.fn().mockResolvedValue(undefined)} />);
    const firstRule = screen.getAllByLabelText("Allowed pattern codes", { selector: "input" })[0]!;
    fireEvent.change(firstRule, { target: { value: "STRIPED, BRAND_LOGO_REPEAT" } });
    fireEvent.click(screen.getByRole("button", { name: /save design mix/i }));
    await waitFor(() => expect(mockSaveDesign).toHaveBeenCalledTimes(1));
    expect(mockSaveDesign.mock.calls[0]![0].designMix.rules).toContainEqual({ catalogMixRowId: "mix-coats", allowedPatternCodes: ["STRIPED", "BRAND_LOGO_REPEAT"], allowedEmbellishmentCodes: [] });
  });
});
