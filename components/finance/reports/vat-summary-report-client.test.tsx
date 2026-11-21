import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VatSummaryReportClient } from "./vat-summary-report-client";

const mocks = vi.hoisted(() => ({ getVatSummary: vi.fn(), user: { restaurant_id: 7, role: "custom", permissions: ["finance.reports.tax.view", "finance.coa.view"] } }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: (select: any) => select({ user: mocks.user }) }));
vi.mock("@/hooks/use-restaurant", () => ({ useRestaurant: (select: any) => select({ restaurant: { restaurant_enabled: true, hotel_enabled: false } }) }));
vi.mock("@/lib/api/finance-reporting-api", () => ({ financeReportingApi: { getVatSummary: mocks.getVatSummary } }));
vi.mock("@/components/finance/reports/account-ledger-panel", () => ({ AccountLedgerPanel: ({ headId }: any) => headId ? <div>Account entries {headId}</div> : null }));

const report = { period: {}, output_vat: "500.00", input_vat: "138.05", net_vat_payable: "361.95", rows: [{ account_id: 3, account_code: "VAT-INPUT", account_name: "Input VAT", amount: "138.05" }], unclassified_purchase_count: 1, legacy_inventory_vat_count: 0 };
afterEach(() => { cleanup(); vi.clearAllMocks(); });
beforeEach(() => { mocks.user.permissions = ["finance.reports.tax.view", "finance.coa.view"]; });

describe("current Finance VAT Summary", () => {
  it("shows posted VAT, historical review counts, and opens current account entries", async () => {
    mocks.getVatSummary.mockResolvedValue(report);
    render(<VatSummaryReportClient />);
    expect(await screen.findByText(/361.95/)).toBeInTheDocument();
    expect(screen.getByText("VAT on sales")).toBeInTheDocument();
    expect(screen.getByText("Purchase VAT claimed")).toBeInTheDocument();
    expect(screen.getByText("Historical purchases need review")).toBeInTheDocument();
    expect(mocks.getVatSummary).toHaveBeenCalledWith(expect.objectContaining({ business_line: undefined }));
    fireEvent.click(screen.getByRole("button", { name: "View entries for Input VAT" }));
    expect(screen.getByText("Account entries 3")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Accounting/ })).not.toBeInTheDocument();
  });
  it("shows credit balances and rejects invalid periods without another API call", async () => {
    mocks.getVatSummary.mockResolvedValue({ ...report, net_vat_payable: "-138.05", rows: [] });
    render(<VatSummaryReportClient />);
    expect(await screen.findByText("VAT credit balance")).toBeInTheDocument();
    expect(screen.getByText("No VAT entries in this period")).toBeInTheDocument();
    const calls = mocks.getVatSummary.mock.calls.length;
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2099-01-01" } });
    expect(screen.getByText("Check the date range")).toBeInTheDocument();
    expect(mocks.getVatSummary).toHaveBeenCalledTimes(calls);
  });
  it("shows failures with retry instead of silently displaying zero VAT", async () => {
    mocks.getVatSummary.mockRejectedValueOnce(new Error("Offline")).mockResolvedValue(report);
    render(<VatSummaryReportClient />);
    expect(await screen.findByText("VAT summary unavailable")).toBeInTheDocument();
    expect(screen.queryByText("Net VAT payable")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.getByText("Net VAT payable")).toBeInTheDocument());
  });
  it("does not fetch VAT for users without tax report access", () => {
    mocks.user.permissions = [];
    render(<VatSummaryReportClient />);
    expect(screen.getByText("VAT report access required")).toBeInTheDocument();
    expect(mocks.getVatSummary).not.toHaveBeenCalled();
  });
});
