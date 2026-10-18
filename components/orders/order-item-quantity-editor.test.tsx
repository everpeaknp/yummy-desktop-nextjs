import { expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { OrderItemQuantityEditor } from "./order-item-quantity-editor";

const item = {
  id: 142,
  name_snapshot: "Classic Lemonade",
  category_name_snapshot: "Drinks",
  unit_price: 210,
  qty: 1,
  is_nc: false,
} as any;

it("renders inline without a dialog and saves quantity changes", async () => {
  const onSave = vi.fn().mockResolvedValue(true);
  const onClose = vi.fn();
  render(<OrderItemQuantityEditor item={item} canMarkNc onClose={onClose} isUpdating={false} onSave={onSave} />);

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

  await waitFor(() => expect(onSave).toHaveBeenCalledWith({ qty: 2 }));
  expect(onClose).toHaveBeenCalled();
});

it("saves NC and quantity together from the inline editor", async () => {
  const onSave = vi.fn().mockResolvedValue(true);
  render(<OrderItemQuantityEditor item={item} canMarkNc onClose={() => {}} isUpdating={false} onSave={onSave} />);

  fireEvent.click(screen.getByRole("button", { name: /Mark non-chargeable/ }));
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

  await waitFor(() => expect(onSave).toHaveBeenCalledWith({ qty: 1, is_nc: true }));
});
