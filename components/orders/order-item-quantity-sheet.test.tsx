import { expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { OrderItemQuantitySheet } from "./order-item-quantity-sheet";

const item = {
  id: 142,
  name_snapshot: "Classic Lemonade",
  category_name_snapshot: "Drinks",
  unit_price: 210,
  qty: 1,
  is_nc: false,
} as any;

it("saves the updated quantity through the existing order-line callback", async () => {
  const onSave = vi.fn().mockResolvedValue(true);
  const onClose = vi.fn();
  render(
    <OrderItemQuantitySheet
      item={item}
      canMarkNc={true}
      isUpdating={false}
      onClose={onClose}
      onSave={onSave}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
  fireEvent.click(screen.getByRole("button", { name: "Update & Send" }));

  await waitFor(() => expect(onSave).toHaveBeenCalledWith({ qty: 2 }));
  await waitFor(() => expect(onClose).toHaveBeenCalled());
});

it("includes the changed NC state in the same order-line update", async () => {
  const onSave = vi.fn().mockResolvedValue(true);
  const onClose = vi.fn();
  render(
    <OrderItemQuantitySheet
      item={item}
      canMarkNc={true}
      isUpdating={false}
      onClose={onClose}
      onSave={onSave}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: /Non-chargeable/ }));
  fireEvent.click(screen.getByRole("button", { name: "Update & Send" }));

  await waitFor(() => expect(onSave).toHaveBeenCalledWith({ qty: 1, is_nc: true }));
});
