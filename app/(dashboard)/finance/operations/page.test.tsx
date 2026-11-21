import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import apiClient from "@/lib/api-client";
import FinanceOperationsPage from "./page";

vi.mock("@/lib/api-client", () => ({ default: { get: vi.fn() } }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: (select: (state: unknown) => unknown) => select({ user: { restaurant_id: 114, currency: "NPR" } }) }));
vi.mock("@/hooks/use-restaurant", () => ({ useRestaurant: (select: (state: unknown) => unknown) => select({ restaurant: { id: 114, restaurant_enabled: true, currency: "NPR" } }) }));
vi.mock("@/lib/role-permissions", () => ({ hasPermission: () => true }));
vi.mock("@/components/patterns/page/app-page", () => ({ AppPage: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("@/components/patterns/page/page-header", () => ({ PageHeader: () => <h1>Cash & Banks</h1> }));
vi.mock("@/components/finance/payment-instruments-panel", () => ({ PaymentInstrumentsPanel: () => null }));
vi.mock("@/components/finance/cash-drawer-config-panel", () => ({ CashDrawerConfigPanel: () => null }));

describe("cash account visibility", () => {
  it.each(["controls_off", "open"])("keeps Main Cash and funded drawers visible with status %s", async (status) => {
    const accounts = [
      { account_type: "cash", id: 101, name: "Main Cash", bank_type: "cash", current_balance: 8000, balance_source: "ledger", reporting_head_id: 101 },
      { account_type: "till", id: 1, name: "Front Drawer", bank_type: "till", current_balance: 1700, balance_source: "ledger", status, can_transfer_in: status === "open" },
      { account_type: "till", id: 2, name: "Bar Drawer", bank_type: "till", current_balance: 300, balance_source: "ledger", status: "archived", can_transfer_in: false, can_transfer_out: false },
      { account_type: "bank", id: 5, name: "Bank", bank_type: "bank", current_balance: 500 },
    ];
    vi.mocked(apiClient.get).mockImplementation(async (url) => ({ data: { data: String(url).startsWith("/cash-and-banks?") ? accounts : [] } }));
    render(<FinanceOperationsPage />);
    await screen.findByText("Main Cash");
    expect(screen.getByText("Front Drawer")).toBeInTheDocument();
    expect(screen.getByText("Bar Drawer")).toBeInTheDocument();
    expect(screen.getByText("Recorded cash").nextElementSibling).toHaveTextContent("10,000.00");
    expect(screen.getByRole("link", { name: "View entries for Main Cash" })).toHaveAttribute("href", "/finance/reports/account-ledger?head_id=101");
    expect(apiClient.get).toHaveBeenCalledWith("/cash-and-banks?restaurant_id=114&business_line=restaurant&include_all_cash=true");
  });
});
