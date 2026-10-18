import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { OrderCard } from "./order-card";
import type { Order } from "@/types/order";

vi.mock("@/hooks/use-restaurant", () => ({ useRestaurant: (selector: (state: any) => unknown) => selector({ restaurant: { currency: "NPR" } }) }));
afterEach(cleanup);
const timestamp = new Date().toISOString();
const order: Order = {
  id: 56, restaurant_id: 52, restaurant_order_id: 56,
  channel: "table", status: "pending", table_name: "g", customer_name: "Everacy",
  subtotal: 100, tax_total: 0, service_charge: 0, discount_total: 0,
  manual_discount_amount: 0, grand_total: 100,
  created_at: timestamp, updated_at: timestamp, payments: [],
  items: [{ id: 1, menu_item_id: 1, name_snapshot: "Coke", unit_price: 100,
    line_total: 100, qty: 1, modifiers: [], created_at: timestamp }],
};

it("shows only a compact addition badge without approval buttons or pending amounts", () => {
  render(<OrderCard order={order} pendingAdditionCount={1} />);
  expect(screen.getByRole("status")).toHaveTextContent("1 addition awaiting approval");
  expect(screen.queryByRole("button", { name: /accept|reject/i })).not.toBeInTheDocument();
  expect(screen.queryByText("Pending amount")).not.toBeInTheDocument();
  expect(screen.getByText(/100/)).toBeInTheDocument();
});
it("pluralizes multiple additions and hides the badge when none remain", () => {
  const { rerender } = render(<OrderCard order={order} pendingAdditionCount={2} />);
  expect(screen.getByRole("status")).toHaveTextContent("2 additions awaiting approval");
  rerender(<OrderCard order={order} pendingAdditionCount={0} />);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
it("uses the standard card for first requests without implying kitchen or payment approval", () => {
  render(<OrderCard order={{ ...order, status: "requested" }} />);
  expect(screen.getByText("Awaiting approval")).toBeInTheDocument();
  expect(screen.getByText("Review request · Not sent to kitchen")).toBeInTheDocument();
  expect(screen.queryByText("Unpaid")).not.toBeInTheDocument();
  expect(screen.queryByText(/ready$/)).not.toBeInTheDocument();
  expect(screen.getByRole("article")).toHaveClass("sm:h-[340px]");
});
