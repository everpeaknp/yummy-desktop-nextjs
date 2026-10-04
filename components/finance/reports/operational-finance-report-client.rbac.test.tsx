import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({permissions: [] as string[], get: vi.fn(), me: vi.fn()}));
vi.mock("@/hooks/use-auth", () => ({useAuth: (select: any) => select({user: {id:505, role:"waiter", restaurant_id:52, permissions:state.permissions}, me:state.me})}));
vi.mock("next/navigation", () => ({useRouter: () => ({push:vi.fn()}), usePathname: () => "/finance/payments"}));
vi.mock("@/lib/api-client", () => ({default: {get:state.get}}));
vi.mock("@/components/finance/transaction-detail/sales-document-detail-sheet", () => ({SalesDocumentDetailSheet: () => null}));
vi.mock("@/components/finance/transaction-detail/transaction-detail-sheet", () => ({TransactionDetailSheet: () => null}));
import { OperationalFinanceReportClient } from "./operational-finance-report-client";
afterEach(cleanup);
beforeEach(() => {state.get.mockReset(); state.get.mockResolvedValue({data:{data:null}});});
const modes = [
 ["sales-book", "finance.reports.sales.view"],
 ["invoices", "finance.reports.invoices.view"],
 ["payments", "finance.reports.payments.view"],
 ["refunds", "finance.reports.payments.view"],
 ["vat-sales", "finance.reports.tax.view"],
] as const;
describe("granular report authorization", () => {
 it.each(modes)("loads %s with its own grant only", async (mode, permission) => {
  state.permissions=[permission]; render(<OperationalFinanceReportClient mode={mode} />);
  await waitFor(() => expect(state.get).toHaveBeenCalled());
  expect(screen.queryByText("Your user does not have finance report access.")).not.toBeInTheDocument();
 });
 it.each(modes)("does not load %s using income permission alone", (mode) => {
  state.permissions=["finance.income.view"]; render(<OperationalFinanceReportClient mode={mode} />);
  expect(state.get).not.toHaveBeenCalled();
  expect(screen.getByText("Your user does not have finance report access.")).toBeInTheDocument();
 });
 it("requires reports.export separately from read-only payments access", async () => {
  state.permissions=["finance.reports.payments.view"];
  state.get.mockResolvedValue({data:{data:{rows:[{payment_id:1,order_id:2,invoice_number:"INV-2",paid_at:"2026-10-04T10:00:00Z",business_date:"2026-10-04",payment_method:"cash",amount:100}],total:1,limit:50,offset:0,totals:{paid_amount:100}}}});
  render(<OperationalFinanceReportClient mode="payments" />);
  const exportButton=await screen.findByRole("button",{name:"Export"});
  await waitFor(() => expect(exportButton).toBeDisabled());
 });
 it("enables report export when reports.export is granted", async () => {
  state.permissions=["finance.reports.payments.view","reports.export"];
  state.get.mockResolvedValue({data:{data:{rows:[{payment_id:1,order_id:2,invoice_number:"INV-2",paid_at:"2026-10-04T10:00:00Z",business_date:"2026-10-04",payment_method:"cash",amount:100}],total:1,limit:50,offset:0,totals:{paid_amount:100}}}});
  render(<OperationalFinanceReportClient mode="payments" />);
  const exportButton=await screen.findByRole("button",{name:"Export"});
  await waitFor(() => expect(exportButton).toBeEnabled());
 });
});
