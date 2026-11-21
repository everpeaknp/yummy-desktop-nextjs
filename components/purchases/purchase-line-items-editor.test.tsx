import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PurchaseLineItemsEditor,
  newPurchaseLineDraft,
  type PurchaseLineDraft,
} from "./purchase-line-items-editor";

vi.mock("@/components/inventory/inventory-item-select", () => ({
  InventoryItemSelect: () => <div />,
}));
vi.mock("@/components/stations/station-picker", () => ({
  StationPicker: () => <div />,
}));

afterEach(cleanup);
let currentLines: PurchaseLineDraft[];
function Editor() {
  const [lines, setLines] = useState<PurchaseLineDraft[]>([
    newPurchaseLineDraft(),
  ]);
  currentLines = lines;
  return (
    <PurchaseLineItemsEditor
      restaurantId={7}
      lines={lines}
      onChange={setLines}
    />
  );
}

function field(label: string): HTMLInputElement {
  return screen.getByRole("spinbutton", { name: label }) as HTMLInputElement;
}

describe("purchase line amount", () => {
  it("preserves an inclusive bill exactly, and sends exact VAT with a four-decimal unit cost", () => {
    render(<Editor />);
    fireEvent.change(field("Quantity *"), { target: { value: "3" } });
    fireEvent.change(field("Total including VAT *"), { target: { value: "1200" } });
    fireEvent.click(screen.getByRole("button", { name: "Rate %" }));
    fireEvent.change(field("VAT rate %"), { target: { value: "13" } });
    expect(currentLines[0]).toMatchObject({ unitCost: "353.9833", subtotalAmount: "1061.95", taxAmount: "138.05", totalAmount: "1200.00", taxRate: "13" });
    fireEvent.change(field("Quantity *"), { target: { value: "2" } });
    expect(currentLines[0]).toMatchObject({ unitCost: "530.9750", totalAmount: "1200.00" });
    fireEvent.click(screen.getByRole("button", { name: "Exact VAT" }));
    fireEvent.change(field("VAT amount from bill"), { target: { value: "138.04" } });
    expect(currentLines[0]).toMatchObject({ subtotalAmount: "1061.96", taxAmount: "138.04", totalAmount: "1200.00", taxRate: "" });
    fireEvent.change(field("VAT amount from bill"), { target: { value: "1201" } });
    expect(currentLines[0].unitCost).toBe("");
  });
  it("uses stock quantity for the price helper and assigns each line a unique input", () => {
    render(<Editor />);
    fireEvent.change(field("Quantity *"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Unit price including VAT"), { target: { value: "600" } });
    expect(currentLines[0].totalAmount).toBe("1200.00");
    fireEvent.change(field("Quantity *"), { target: { value: "3" } });
    expect(currentLines[0].totalAmount).toBe("1800.00");
    fireEvent.click(screen.getByRole("button", { name: "Add line" }));
    const totals = screen.getAllByLabelText("Total including VAT *");
    expect(totals).toHaveLength(2);
    expect(totals[0].id).not.toBe(totals[1].id);
  });
});
