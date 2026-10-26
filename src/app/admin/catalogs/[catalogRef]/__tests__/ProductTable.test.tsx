import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ProductTable from "../ProductTable";
import type { CatalogProductView } from "@/modules/synthetic_catalog/admin/types";
import { archiveCatalogProductAction, restoreCatalogProductAction } from "@/modules/synthetic_catalog/server/admin-actions";

const mockPush = jest.fn();
const mockConfirm = jest.fn();

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush, refresh: jest.fn() }) }));
jest.mock("@/components/providers/ConfirmProvider", () => ({ useConfirm: () => ({ confirm: mockConfirm }) }));
jest.mock("@/modules/synthetic_catalog/server/admin-actions", () => ({
  archiveCatalogProductAction: jest.fn(),
  restoreCatalogProductAction: jest.fn(),
}));

const baseProduct = {
  id: 1, archivedAt: null, externalId: "P-1", name: "Cotton shirt", description: "", departmentKey: "WOMEN", department: "Women", category: "tops", subcategory: "shirts", material: "cotton", season: "summer", patternCode: null, embellishmentCodes: [], basePrice: "10", salePrice: null, currency: "EUR", status: "READY", styles: [],
} as CatalogProductView;

describe("catalogue product row actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConfirm.mockResolvedValue(true);
    (archiveCatalogProductAction as jest.Mock).mockResolvedValue({ ok: true });
    (restoreCatalogProductAction as jest.Mock).mockResolvedValue({ ok: true });
  });

  it("archives and restores from the action button without navigating the row", async () => {
    const onArchiveChanged = jest.fn().mockResolvedValue(undefined);
    const props = { catalogSlug: "catalog", initialSearch: "", products: [baseProduct], canEdit: true, onAddProducts: jest.fn(), onArchiveChanged };
    const { rerender } = render(<ProductTable {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    await waitFor(() => expect(archiveCatalogProductAction).toHaveBeenCalledWith(1));
    expect(mockPush).not.toHaveBeenCalled();

    fireEvent.change(screen.getAllByRole("combobox")[4]!, { target: { value: "ARCHIVED" } });
    rerender(<ProductTable {...props} products={[{ ...baseProduct, archivedAt: "2026-01-01T00:00:00.000Z" }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    await waitFor(() => expect(restoreCatalogProductAction).toHaveBeenCalledWith(1));
    expect(mockPush).not.toHaveBeenCalled();
  });
});
