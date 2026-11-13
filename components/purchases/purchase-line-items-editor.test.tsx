import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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

function Editor() {
  const [lines, setLines] = useState<PurchaseLineDraft[]>([
    newPurchaseLineDraft(),
  ]);
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
  it("converts totals both ways and reveals rounding differences", () => {
    render(<Editor />);
    fireEvent.change(field("Quantity *"), { target: { value: "2" } });
    fireEvent.change(field("Tax rate %"), { target: { value: "13" } });
    fireEvent.change(field("Total incl. tax (NPR)"), {
      target: { value: "226" },
    });
    expect(field("Unit cost *")).toHaveValue(100);

    fireEvent.change(field("Tax rate %"), { target: { value: "" } });
    fireEvent.change(field("Quantity *"), { target: { value: "3" } });
    fireEvent.change(field("Total incl. tax (NPR)"), {
      target: { value: "100" },
    });
    expect(field("Unit cost *")).toHaveValue(33.33);
    expect(
      screen.getByText(/Recorded total will be.*99\.99/),
    ).toBeInTheDocument();

    fireEvent.change(field("Unit cost *"), { target: { value: "25" } });
    expect(field("Total incl. tax (NPR)")).toHaveValue(75);
  });
});
