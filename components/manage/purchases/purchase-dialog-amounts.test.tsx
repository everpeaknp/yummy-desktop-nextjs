import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PurchaseDialog } from "./purchase-dialog";

const api = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }));
vi.mock("@/lib/api-client", () => ({ default: api }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: (select: any) => select({ user: { restaurant_id: 7, role: "staff", permissions: ["inventory.stock.manage"] } }) }));
vi.mock("@/lib/api/finance-reporting-api", () => ({ financeReportingApi: { listHeads: async () => [] } }));
vi.mock("@/components/finance/cash-bank-account-select", () => ({ CashBankAccountSelect: () => null }));
afterEach(cleanup);

it("sends calculated gross and VAT through the existing purchase API", async () => {
  api.get.mockResolvedValue({ data: { status: "success", data: { suppliers: [{ id: 1, name: "Supplier" }] } } });
  api.patch.mockResolvedValue({ data: { status: "success" } });
  render(<PurchaseDialog open onOpenChange={vi.fn()} businessLine="restaurant" onSuccess={vi.fn()} purchase={{ id: 21, purchase_name: "Chair", supplier_id: 1, total_cost: "1000.00", vat_amount: "0.00", status: "draft", payment_status: "pending", purchased_date: "2026-11-19" }} />);
  await waitFor(() => expect(screen.getByLabelText("Supplier*")).toHaveTextContent("Supplier"));
  fireEvent.change(screen.getByLabelText("Total including VAT *"), { target: { value: "1200" } });
  fireEvent.click(screen.getByRole("button", { name: "Rate %" }));
  fireEvent.change(screen.getByLabelText("VAT rate %"), { target: { value: "13" } });
  fireEvent.submit(screen.getByRole("button", { name: "Save for review" }).closest("form")!);
  await waitFor(() => expect(api.patch).toHaveBeenCalledWith("/general-purchases/21", expect.objectContaining({ total_cost: 1200, vat_amount: 138.05, status: "draft", claim_input_vat: false })));
});
