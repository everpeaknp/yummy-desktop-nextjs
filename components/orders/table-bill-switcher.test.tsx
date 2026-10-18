import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TableBillSwitcher } from "./table-bill-switcher";
import apiClient from "@/lib/api-client";
import type { Order } from "@/types/order";
import type { AnchorHTMLAttributes } from "react";

vi.mock("next/link", () => ({ default: ({ scroll, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { scroll?: boolean }) => <a {...props} data-client-navigation="true" data-scroll={String(scroll)} /> }));

vi.mock("@/lib/api-client", () => ({ default: { get: vi.fn() } }));
vi.mock("@/hooks/use-restaurant", () => ({ useRestaurant: (selector: (s: any) => unknown) => selector({ restaurant: { currency: "NPR" } }) }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const bill = (id: number, status = "pending", target?: number) => ({
  id, status, restaurant_id: 52, table_id: 9, channel: "table",
  grand_total: id === 60 ? 550 : 1, customer_name: id === 60 ? "Niraj" : "Everacy",
  approval_target_order_id: target,
} as Order);
const respond = (orders: Order[]) => ({ data: { status: "success", data: { orders } } });

it("switches between customer bills but does not expose linked additions as bills", async () => {
  vi.mocked(apiClient.get).mockResolvedValue(respond([bill(59), bill(60), bill(61, "requested", 60), bill(62, "requested")]));
  render(<TableBillSwitcher order={bill(60)} checkout />);
  expect(await screen.findByRole("link", { name: /Niraj · Order #60/ })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("link", { name: /Everacy · Order #59/ })).toHaveAttribute("href", "/orders/59/checkout");
  expect(screen.getByRole("link", { name: /Everacy · Order #59/ })).toHaveAttribute("data-client-navigation", "true");
  expect(screen.getByRole("link", { name: /Everacy · Order #59/ })).toHaveAttribute("data-scroll", "false");
  expect(screen.getByRole("link", { name: /Order #62/ })).toHaveAttribute("href", "/orders/62");
  expect(screen.queryByRole("link", { name: /Order #61/ })).not.toBeInTheDocument();
  expect(screen.getByText(/550.*1 awaiting approval/)).toBeInTheDocument();
  expect(apiClient.get).toHaveBeenCalledWith("/orders/active", { params: { restaurant_id: 52, table_id: 9, limit: 5000 } });
});

it("keeps review navigation in details and supports retrying failed loads", async () => {
  vi.mocked(apiClient.get).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(respond([bill(59), bill(60)]));
  render(<TableBillSwitcher order={bill(60)} />);
  fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
  expect(await screen.findByRole("link", { name: /Order #59/ })).toHaveAttribute("href", "/orders/59");
});

it("does not load table bills for completed or non-table orders", () => {
  const { rerender } = render(<TableBillSwitcher order={bill(60, "completed")} />);
  rerender(<TableBillSwitcher order={{ ...bill(60), channel: "pickup" }} />);
  expect(apiClient.get).not.toHaveBeenCalled();
});
it("finishes loading when there are no active bills", async () => {
  vi.mocked(apiClient.get).mockResolvedValue(respond([]));
  render(<TableBillSwitcher order={bill(60)} />);
  expect(await screen.findByText(/No active bills found/)).toBeInTheDocument();
  expect(screen.queryByText("Loading table bills…")).not.toBeInTheDocument();
});
