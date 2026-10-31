import { beforeEach, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TableBillSwitcher } from "./table-bill-switcher";

const mocks = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/api-client", () => ({ default: { get: mocks.get, patch: mocks.patch, post: mocks.post } }));
vi.mock("@/hooks/use-restaurant", () => ({
  useRestaurant: (selector: (state: any) => unknown) => selector({ restaurant: { currency: "NPR" } }),
}));

const currentOrder = {
  id: 72,
  restaurant_id: 9,
  restaurant_order_id: 72,
  status: "pending",
  channel: "table",
  table_id: 4,
  table_ids: [4],
  customer_name: null,
  grand_total: 1,
};

beforeEach(() => {
  mocks.patch.mockReset();
  mocks.post.mockReset();
  mocks.get.mockReset().mockResolvedValue({ data: { status: "success", data: { orders: [currentOrder, { ...currentOrder, id: 73, restaurant_order_id: 73, customer_name: "Asha", grand_total: 12 }] } } });
});

it("shows table bills as compact selectable guest or customer chips", async () => {
  render(<TableBillSwitcher order={currentOrder as any} />);

  const selectedBill = await screen.findByRole("link", { name: /Walk-in guest.*NPR 1\.00/ });
  expect(selectedBill).toHaveAttribute("aria-current", "page");
  expect(selectedBill).toHaveClass("rounded-full");
  expect(selectedBill).not.toHaveTextContent("#72");
  expect(await screen.findByRole("link", { name: /Asha.*NPR 12\.00/ })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Table bills" })).not.toBeInTheDocument();
});

it("opens the existing approval review in a dialog from a bill with pending additions", async () => {
  const request = {
    ...currentOrder,
    id: 73,
    restaurant_order_id: 73,
    status: "requested",
    approval_target_order_id: 72,
    customer_name: "Asha",
    items: [{ id: 4, name_snapshot: "Coke", qty: 1 }],
  };
  mocks.get.mockResolvedValue({ data: { status: "success", data: { orders: [currentOrder, request] } } });
  render(<TableBillSwitcher order={currentOrder as any} canApproveRequests canRejectRequests />);

  fireEvent.click(await screen.findByRole("link", { name: /1 awaiting approval/ }));

  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Review order request" })).toBeInTheDocument();
  expect(screen.getByText("Coke")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Accept request" })).toBeInTheDocument();
});

it("keeps the bill chips visible while it refreshes after an approval", async () => {
  const request = {
    ...currentOrder,
    id: 73,
    restaurant_order_id: 73,
    status: "requested",
    approval_target_order_id: 72,
    customer_name: "Asha",
    items: [{ id: 4, name_snapshot: "Coke", qty: 1 }],
  };
  let finishRefresh!: (value: any) => void;
  mocks.get
    .mockResolvedValueOnce({ data: { status: "success", data: { orders: [currentOrder, request] } } })
    .mockResolvedValueOnce({ data: { data: request } })
    .mockImplementationOnce(() => new Promise(resolve => { finishRefresh = resolve; }));
  mocks.patch.mockResolvedValue({ data: { status: "success" } });
  render(<TableBillSwitcher order={currentOrder as any} canApproveRequests canRejectRequests />);

  fireEvent.click(await screen.findByRole("link", { name: /1 awaiting approval/ }));
  fireEvent.click(await screen.findByRole("button", { name: "Accept request" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm acceptance" }));

  await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(3));
  expect(screen.queryByText("Loading table bills…")).not.toBeInTheDocument();
  expect(document.querySelector('a[aria-current="page"]')).toHaveTextContent(/Walk-in guest.*NPR 1\.00/);
  expect(mocks.get).toHaveBeenCalledTimes(3);
  await act(async () => {
    finishRefresh({ data: { status: "success", data: { orders: [currentOrder, { ...request, status: "pending" }] } } });
  });
});
