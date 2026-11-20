import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PurchaseAmountFields } from "./purchase-amount-fields";

afterEach(cleanup);
it("switches inclusive, exclusive, exact and no VAT without stale totals", () => {
  const onChange = vi.fn();
  render(<PurchaseAmountFields onChange={onChange} />);
  fireEvent.change(screen.getByLabelText("Total including VAT *"), { target: { value: "1200" } });
  fireEvent.click(screen.getByRole("button", { name: "Rate %" }));
  expect(onChange.mock.lastCall?.[0]).toEqual(null);
  fireEvent.change(screen.getByLabelText("VAT rate %"), { target: { value: "13" } });
  expect(onChange.mock.lastCall?.[0]).toEqual({ net: "1061.95", vat: "138.05", total: "1200.00" });
  fireEvent.click(screen.getByRole("button", { name: "Before VAT" }));
  expect(onChange.mock.lastCall?.[0]).toEqual({ net: "1200.00", vat: "156.00", total: "1356.00" });
  fireEvent.click(screen.getByRole("button", { name: "Exact VAT" }));
  fireEvent.change(screen.getByLabelText("VAT amount from bill"), { target: { value: "150.01" } });
  expect(onChange.mock.lastCall?.[0]).toEqual({ net: "1200.00", vat: "150.01", total: "1350.01" });
  fireEvent.click(screen.getByRole("button", { name: "No VAT" }));
  expect(onChange.mock.lastCall?.[0]).toEqual({ net: "1200.00", vat: "0.00", total: "1200.00" });
  fireEvent.change(screen.getByLabelText("Amount before VAT *"), { target: { value: "" } });
  expect(onChange.mock.lastCall?.[0]).toEqual(null);
});

it("preserves the original exact VAT when editing and supports unit pricing", () => {
  const onChange = vi.fn();
  render(<PurchaseAmountFields initialTotal="1200.00" initialVat="138.04" onChange={onChange} />);
  expect(screen.getByLabelText("VAT amount from bill")).toHaveValue(138.04);
  fireEvent.change(screen.getByLabelText("VAT amount from bill"), { target: { value: "138.05" } });
  expect(onChange.mock.lastCall?.[0]).toEqual({ net: "1061.95", vat: "138.05", total: "1200.00" });
  fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "2" } });
  fireEvent.change(screen.getByLabelText("Unit price including VAT"), { target: { value: "600" } });
  expect(onChange.mock.lastCall?.[0]).toEqual({ net: "1061.95", vat: "138.05", total: "1200.00" });
});
