import { beforeEach, expect, it, vi } from "vitest";
import { forwardRef } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import OrderDetailPage from "./[id]/page";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  back: vi.fn(),
  fetchContext: vi.fn(),
  fetchContextQuiet: vi.fn(),
  replaceContextLocal: vi.fn(),
  patch: vi.fn(),
  order: null as any,
  fullyPaid: false,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, back: mocks.back }),
  useParams: () => ({ id: "51" }),
}));
vi.mock("next/link", () => ({
  default: forwardRef<HTMLAnchorElement, any>(({ href, children, ...props }, ref) => (
    <a ref={ref} href={href} {...props}>{children}</a>
  )),
}));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: (selector: (state: any) => unknown) => selector({
    user: { id: 1, restaurant_id: 52, permissions: ["billing.payment.process"] },
    me: vi.fn(),
  }),
}));
vi.mock("@/hooks/use-order-full", () => ({
  useOrderFull: () => ({
    context: {
      order: mocks.order,
      tables: [],
      kots: [],
      payments: [],
      pending_item_requests: [],
    },
    loading: false,
    error: null,
    fetchContext: mocks.fetchContext,
    fetchContextQuiet: mocks.fetchContextQuiet,
    replaceContextLocal: mocks.replaceContextLocal,
    updateKotLocal: vi.fn(),
    isFullyPaid: mocks.fullyPaid,
    allKotsServed: true,
  }),
}));
vi.mock("@/hooks/use-pos-billing-permissions", () => ({
  usePosBillingPermissions: () => ({
    canVoidOrder: true,
    canTransferOrder: true,
    canMarkNc: true,
    canEditOrder: true,
    canViewBilling: true,
    canProcessPayment: true,
    canViewReceipt: true,
    canSplitPayment: true,
  }),
}));
vi.mock("@/hooks/use-mobile-app-bar-title", () => ({ useMobileAppBarTitle: vi.fn() }));
vi.mock("@/components/layout/mobile-app-bar-title", () => ({ useMobileAppBarTitle: vi.fn() }));
vi.mock("@/components/orders/table-bill-switcher", () => ({
  TableBillSwitcher: () => <div data-testid="table-bill-switcher">Table bill switcher</div>,
}));
vi.mock("@/components/orders/order-checkout-workspace", () => ({
  OrderCheckoutWorkspace: ({ presentation, onEditOrderItem, billRefreshToken }: any) => (
    <aside data-testid="quick-checkout" data-presentation={presentation} data-bill-refresh-token={billRefreshToken}>
      <button onClick={() => onEditOrderItem?.(142)}>Edit bill item</button>
      <p>Quick checkout summary</p>
    </aside>
  ),
}));
vi.mock("@/components/orders/pending-item-requests", () => ({ PendingItemRequests: () => null }));
vi.mock("@/components/finance/transaction-detail/sales-document-detail-sheet", () => ({ SalesDocumentDetailSheet: () => null }));
vi.mock("@/lib/api-client", () => ({
  default: { get: vi.fn(), patch: mocks.patch, post: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/role-permissions", () => ({ hasPermission: () => true }));

const orderFor = (channel = "table", status = "pending") => ({
  id: 51,
  restaurant_id: 52,
  restaurant_order_id: 51,
  status,
  channel,
  table_id: 8,
  table_name: "g3",
  table_ids: [8],
  items: [{
    id: 142,
    menu_item_id: 20,
    name_snapshot: "Classic Lemonade",
    category_name_snapshot: "Drinks",
    unit_price: 210,
    qty: 1,
    line_total: 210,
    is_nc: false,
    notes: null,
    modifiers: [],
  }],
  subtotal: 210,
  grand_total: 210,
  service_charge: 0,
  discount_total: 0,
  manual_discount_amount: 0,
  created_at: "2026-10-18T10:00:00Z",
  number_of_guests: 1,
  version: 1,
});

beforeEach(() => {
  mocks.order = orderFor();
  mocks.fullyPaid = false;
  mocks.push.mockReset();
  mocks.back.mockReset();
  mocks.fetchContext.mockReset().mockResolvedValue(undefined);
  mocks.fetchContextQuiet.mockReset().mockResolvedValue(true);
  mocks.replaceContextLocal.mockReset();
  mocks.patch.mockReset().mockImplementation(async (url: string, patch: any) => {
    const itemId = Number(url.split("/").pop());
    const updatedOrder = {
      ...mocks.order,
      version: Number(mocks.order.version || 0) + 1,
      items: mocks.order.items.map((item: any) => item.id === itemId ? {
        ...item,
        ...patch,
        line_total: patch.is_nc ?? item.is_nc
          ? 0
          : (Number(item.unit_price) + (item.modifiers || []).reduce((sum: number, modifier: any) => sum + Number(modifier.price_adjustment_snapshot || 0), 0)) * Number(patch.qty ?? item.qty),
      } : item),
    };
    return { data: { status: "success", data: { order: updatedOrder, tables: [], kots: [], payments: [], pending_item_requests: [] } } };
  });
});

it("keeps quick checkout beside order details without navigating or changing the order column width", async () => {
  render(<OrderDetailPage />);
  expect(screen.getByTestId("quick-checkout")).toHaveAttribute("data-presentation", "quick");
  const orderColumn = screen.getByRole("navigation", { name: "Order detail sections" }).parentElement;
  const orderColumnClass = orderColumn?.className;
  fireEvent.pointerDown(screen.getByRole("button", { name: "More order actions" }), { button: 0 });
  const checkout = await screen.findByRole("menuitem", { name: "Checkout" });
  expect(screen.queryByRole("button", { name: "Checkout" })).not.toBeInTheDocument();

  fireEvent.click(checkout);

  expect(mocks.push).toHaveBeenCalledWith("/orders/51/checkout");
  expect(screen.getByTestId("quick-checkout")).toHaveAttribute("data-presentation", "quick");
  expect(screen.getAllByTestId("table-bill-switcher")).toHaveLength(1);
  expect(screen.getByRole("navigation", { name: "Order detail sections" })).toBeInTheDocument();
  expect(screen.getByText("Accepted items")).toBeInTheDocument();
  expect(screen.getByText("Quick checkout summary")).toBeInTheDocument();
  expect(screen.getByText("Bill summary")).toBeInTheDocument();
  expect(orderColumn?.className).toBe(orderColumnClass);
  expect(screen.getByRole("navigation", { name: "Order detail sections" }).nextElementSibling).toHaveClass("mt-5");
});

it("changes only the checkout bill refresh token when accepted item totals change", () => {
  const { rerender } = render(<OrderDetailPage />);
  const checkout = screen.getByTestId("quick-checkout");
  const initialRevision = checkout.getAttribute("data-bill-refresh-token");

  mocks.order = { ...mocks.order, version: mocks.order.version + 1 };
  rerender(<OrderDetailPage />);
  expect(screen.getByTestId("quick-checkout").getAttribute("data-bill-refresh-token")).toBe(initialRevision);

  mocks.order = {
    ...mocks.order,
    items: [
      ...mocks.order.items,
      { ...mocks.order.items[0], id: 143, qty: 1, line_total: 1 },
    ],
    subtotal: 211,
    grand_total: 211,
  };
  rerender(<OrderDetailPage />);

  expect(screen.getByTestId("quick-checkout").getAttribute("data-bill-refresh-token")).not.toBe(initialRevision);
});

it("shows accepted items in a price table and lets staff mark a line NC", async () => {
  render(<OrderDetailPage />);

  for (const heading of ["ITEM", "QTY", "PRICE", "TOTAL", "ACTIONS"]) {
    expect(screen.getByRole("columnheader", { name: heading })).toBeInTheDocument();
  }
  expect(screen.getByRole("row", { name: /Classic Lemonade/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Mark NC for Classic Lemonade" }));

  await waitFor(() => expect(mocks.patch).toHaveBeenCalledWith(
    "/orders/51/lines/142",
    expect.objectContaining({ qty: 1, is_nc: true, expected_version: 1 }),
  ));
  expect(mocks.fetchContext).not.toHaveBeenCalled();
  expect(mocks.replaceContextLocal).toHaveBeenCalledWith(expect.objectContaining({
    order: expect.objectContaining({
      items: expect.arrayContaining([expect.objectContaining({ id: 142, is_nc: true })]),
    }),
  }));
});

it("lets staff remove NC directly from an accepted item", async () => {
  mocks.order = orderFor();
  mocks.order.items[0].is_nc = true;
  mocks.order.items[0].line_total = 0;
  render(<OrderDetailPage />);

  fireEvent.click(screen.getByRole("button", { name: "Remove NC from Classic Lemonade" }));

  await waitFor(() => expect(mocks.patch).toHaveBeenCalledWith(
    "/orders/51/lines/142",
    expect.objectContaining({ qty: 1, is_nc: false, expected_version: 1 }),
  ));
});

it("keeps the real checkout mounted without a placeholder or open step", () => {
  render(<OrderDetailPage />);
  expect(screen.getByTestId("quick-checkout")).toBeInTheDocument();
  expect(screen.queryByText("Checkout opens here")).not.toBeInTheDocument();
  expect(screen.getByRole("navigation", { name: "Order detail sections" })).toBeInTheDocument();
});

it("opens the shared quantity sheet from quick checkout and updates the bill without reloading the order page", async () => {
  render(<OrderDetailPage />);
  const initialBillRefreshToken = screen.getByTestId("quick-checkout").getAttribute("data-bill-refresh-token");
  fireEvent.click(await screen.findByRole("button", { name: "Edit bill item" }));
  expect(await screen.findByRole("spinbutton", { name: "Quantity" })).toHaveValue(1);

  fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
  fireEvent.click(screen.getByRole("button", { name: "Update & Send" }));

  await waitFor(() => expect(mocks.patch).toHaveBeenCalledWith(
    "/orders/51/lines/142",
    expect.objectContaining({ qty: 2, expected_version: 1 }),
  ));
  expect(mocks.fetchContext).not.toHaveBeenCalled();
  expect(mocks.replaceContextLocal).toHaveBeenCalled();
  await waitFor(() => expect(screen.getByTestId("quick-checkout").getAttribute("data-bill-refresh-token")).not.toBe(initialBillRefreshToken));
});

it("keeps room-service delivery action available when quick checkout opens", async () => {
  mocks.order = orderFor("room_service");
  render(<OrderDetailPage />);
  fireEvent.pointerDown(screen.getByRole("button", { name: "More order actions" }), { button: 0 });
  fireEvent.click(await screen.findByRole("menuitem", { name: "Mark delivered" }));

  expect(await screen.findByTestId("quick-checkout")).toBeInTheDocument();
  fireEvent.pointerDown(screen.getByRole("button", { name: "More order actions" }), { button: 0 });
  expect(await screen.findByRole("menuitem", { name: "Mark delivered" })).toBeInTheDocument();
});

it("keeps the Payments action available in quick checkout for a fully paid bill", async () => {
  mocks.order = orderFor("table", "canceled");
  mocks.fullyPaid = true;
  render(<OrderDetailPage />);
  fireEvent.pointerDown(screen.getByRole("button", { name: "More order actions" }), { button: 0 });
  fireEvent.click(await screen.findByRole("menuitem", { name: "Payments" }));

  expect(await screen.findByTestId("quick-checkout")).toBeInTheDocument();
});
