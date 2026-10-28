import { selectOption } from "@/test/select-option";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BillManagementActions } from "./bill-management-actions";
import apiClient from "@/lib/api-client";
import type { Order } from "@/types/order";
vi.mock("@/lib/api-client", () => ({ default: { get: vi.fn(), post: vi.fn() } }));
afterEach(cleanup);
beforeEach(() => vi.resetAllMocks());
const order = { id: 2, restaurant_id: 52, table_id: 9, channel: "table", status: "pending" } as Order;
const session = { anchor_order_id: 1, split_group_id: "group", orders: [
  { order_id: 1, total_paid: 0, status: "pending", customer_name: "Niraj" },
  { order_id: 2, total_paid: 0, status: "pending", customer_name: "Everacy" },
] };
it("exposes all four actions from a child bill and cancels via the anchor with confirmation", async () => {
  const changed = vi.fn().mockResolvedValue(undefined);
  render(<BillManagementActions order={order} session={session} canManage onCreateSplit={vi.fn()} onChanged={changed} />);
  expect(screen.getByRole("button", { name: "Merge bills" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Transfer items" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Cancel split" }));
  expect(apiClient.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Confirm cancel split" }));
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith("/orders/1/guest-bills/cancel-split"));
  await waitFor(() => expect(changed).toHaveBeenCalledWith(1));
});
it("disables reorganization after payment and respects staff permissions", () => {
  const { rerender } = render(<BillManagementActions order={order} session={{ ...session, orders: [session.orders[0], { ...session.orders[1], total_paid: 5 }] }} canManage onCreateSplit={vi.fn()} onChanged={vi.fn()} />);
  expect(screen.getByRole("button", { name: "Merge bills" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Cancel split" })).toBeDisabled();
  rerender(<BillManagementActions order={order} session={session} canManage={false} onCreateSplit={vi.fn()} onChanged={vi.fn()} />);
  expect(screen.getByRole("button", { name: "Create split" })).toBeDisabled();
});
it("supports a compact icon toolbar for quick checkout", () => {
  render(<BillManagementActions order={order} session={session} canManage compact onCreateSplit={vi.fn()} onChanged={vi.fn()} />);
  for (const label of ["Create split", "Transfer items", "Merge bills", "Cancel split"]) {
    expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
  }
  expect(screen.queryByText(/Move or combine accepted items/)).not.toBeInTheDocument();
});
it("transfers selected quantities through the scoped API without changing customers", async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: { data: { items: [{ id: 8, name_snapshot: "Coke", qty: 2 }] } } });
  render(<BillManagementActions order={order} session={session} canManage onCreateSplit={vi.fn()} onChanged={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Transfer items" }));
  await selectOption("Source bill", "Everacy · Bill #2");
  await selectOption("Destination bill", "Niraj · Bill #1");
  fireEvent.change(await screen.findByRole("spinbutton", { name: /Coke/ }), { target: { value: "1" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirm transfer" }));
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith("/orders/1/guest-bills/transfer-item", {
    from_order_id: 2, to_order_id: 1, lines: [{ order_item_id: 8, qty: 1 }],
  }));
});
