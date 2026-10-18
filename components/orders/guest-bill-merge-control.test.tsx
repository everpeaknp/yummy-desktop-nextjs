import { selectOption } from "@/test/select-option";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import apiClient from "@/lib/api-client";
import { GuestBillMergeControl } from "./guest-bill-merge-control";
vi.mock("@/lib/api-client", () => ({ default: { post: vi.fn() } }));
const bills = [{ order_id: 1, split_label: "Niraj", total_paid: 0, status: "pending" }, { order_id: 2, split_label: "Everacy", total_paid: 0, status: "pending" }];
beforeEach(() => vi.clearAllMocks()); afterEach(cleanup);
it("confirms a selected child-to-parent merge using existing scoped API", async () => {
  const refreshed = vi.fn().mockResolvedValue(undefined);
  render(<GuestBillMergeControl anchorId={1} bills={bills} onMerged={refreshed} />);
  await selectOption("Move this bill", "Everacy");
  await selectOption("Into this bill", "Niraj");
  fireEvent.click(screen.getByRole("button", { name: "Merge bills" }));
  expect(apiClient.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Confirm merge" }));
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith("/orders/1/guest-bills/merge", { from_order_id: 2, to_order_id: 1 }));
  await waitFor(() => expect(refreshed).toHaveBeenCalled());
});
it("does not offer paid bills for merging", () => {
  render(<GuestBillMergeControl anchorId={1} bills={[bills[0], { ...bills[1], total_paid: 1 }]} onMerged={vi.fn()} />);
  expect(screen.queryByRole("button", { name: "Merge bills" })).not.toBeInTheDocument();
});
it("keeps destination ownership explicit and allows ordinary table bills as sources", async () => {
  const refreshed = vi.fn().mockResolvedValue(undefined);
  render(<GuestBillMergeControl anchorId={1} bills={bills.map(b => ({ ...b, customer_name: b.split_label }))} splitGroup={false} onMerged={refreshed} />);
  await selectOption("Move this bill", "Niraj · Niraj");
  await selectOption("Into this bill", "Everacy · Everacy");
  fireEvent.click(screen.getByRole("button", { name: "Merge bills" }));
  expect(screen.getByText(/Billing customer: Everacy/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Confirm merge" }));
  await waitFor(() => expect(refreshed).toHaveBeenCalledWith(2));
});
it("keeps a rejected merge visible with the backend reason", async () => {
  vi.mocked(apiClient.post).mockRejectedValue({ response: { data: { detail: "A payment checkout is still open." } } });
  render(<GuestBillMergeControl anchorId={1} bills={bills} onMerged={vi.fn()} />);
  await selectOption("Move this bill", "Everacy");
  await selectOption("Into this bill", "Niraj");
  fireEvent.click(screen.getByRole("button", { name: "Merge bills" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm merge" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("A payment checkout is still open.");
});
