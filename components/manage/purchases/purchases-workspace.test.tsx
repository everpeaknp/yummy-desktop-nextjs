import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PurchasesWorkspace } from "./purchases-workspace";

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/api-client", () => ({ default: api }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: (select: any) => select({ user: { restaurant_id: 7, role: "owner", permissions: ["inventory.stock.manage", "inventory.purchase_returns.create"] } }) }));
vi.mock("@/hooks/use-restaurant", () => ({ useRestaurant: (select: any) => select({ restaurant: { restaurant_enabled: true, hotel_enabled: true } }) }));
vi.mock("next/navigation", () => ({ usePathname: () => "/finance/purchases/returns" }));
vi.mock("@/components/purchases/record-purchase-dialog", () => ({ RecordPurchaseDialog: () => null }));
vi.mock("@/components/manage/purchases/purchase-dialog", () => ({ PurchaseDialog: () => null }));
vi.mock("@/components/manage/purchases/fixed-assets-dialog", () => ({ FixedAssetsDialog: () => null }));
vi.mock("@/components/finance/cash-bank-account-select", () => ({ CashBankAccountSelect: () => null }));
vi.mock("@/components/finance/transaction-detail/transaction-detail-sheet", () => ({ TransactionDetailSheet: ({ open, footer }: any) => open ? <div>{footer}</div> : null }));

describe("purchase returns workspace", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });
  it("shows both return sources, filters them, and starts a return from its original purchase", async () => {
    api.get.mockImplementation(async (url: string) => ({ data: { status: "success", data: url.startsWith("/purchase-returns") ? { purchase_returns: [
      { id: 31, supplier_name: "Stock supplier", return_date: "2026-11-19", total_cost: 400, status: "posted", settlement_type: "supplier_credit" },
    ] } : { purchases: [
      { id: 20, purchase_name: "Returned fridge", total_cost: 2000, status: "returned", purchased_date: "2026-11-18" },
      { id: 21, purchase_name: "Received chair", total_cost: 1000, status: "received", purchased_date: "2026-11-18", payment_status: "pending" },
    ] } } }));
    api.post.mockResolvedValue({ data: { status: "success" } });
    render(<PurchasesWorkspace financeMode returnedOnly />);
    expect(await screen.findByRole("link", { name: /Stock supplier/ })).toHaveAttribute("href", "/inventory/purchases/returns?return_id=31");
    expect(await screen.findAllByText("Returned fridge")).not.toHaveLength(0);
    expect(screen.queryByText("Paid purchases")).not.toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith(expect.stringContaining("status=returned"));
    expect(screen.queryByText("Received chair")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Stock$/ }));
    expect(screen.queryByText("Returned fridge")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Record return" }));
    let dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("link", { name: "Stock items" })).toHaveAttribute("href", "/inventory/purchases/returns?record=1");
    fireEvent.click(within(dialog).getByRole("button", { name: "Costs & equipment" }));
    fireEvent.click(await within(dialog).findByRole("button", { name: /Received chair/ }));
    dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Reason"), { target: { value: "Wrong chair" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm return" }));
    await screen.findByRole("button", { name: "Record return" });
    expect(api.post).toHaveBeenCalledWith("/general-purchases/21/return", expect.objectContaining({ return_amount: 1000, reason: "Wrong chair" }));
  });

  it("keeps stock loading failures distinct from an empty costs return history", async () => {
    api.get.mockImplementation(async (url: string) => {
      if (url.startsWith("/purchase-returns")) throw new Error("Unavailable");
      return { data: { status: "success", data: { purchases: [] } } };
    });
    render(<PurchasesWorkspace financeMode returnedOnly />);
    expect(await screen.findByText("Could not load stock returns.")).toBeInTheDocument();
    expect(await screen.findByText("No costs or equipment returns")).toBeInTheDocument();
    expect(screen.queryByText("Paid purchases")).not.toBeInTheDocument();
    expect(screen.queryByText("No costs or equipment purchases")).not.toBeInTheDocument();
  });
});
