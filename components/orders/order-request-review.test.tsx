import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import apiClient from "@/lib/api-client";
import { OrderRequestReview } from "./order-request-review";

vi.mock("@/lib/api-client", () => ({ default: { get: vi.fn(), patch: vi.fn(), post: vi.fn() } }));
const order = { id: 58, table_name: "g", customer_name: "Everacy", grand_total: 10, items: [{ id: 1, name_snapshot: "Coke", qty: 1 }] };
beforeEach(() => { vi.clearAllMocks(); vi.mocked(apiClient.get).mockResolvedValue({ data: { data: { status: "requested" } } }); });
afterEach(cleanup);

it("requires confirmation and accepts a food request through the existing approval API", async () => {
  const refreshed = vi.fn().mockResolvedValue(undefined);
  render(<OrderRequestReview order={order} canApprove canReject onResolved={refreshed} />);
  expect(screen.getByText("Awaiting approval")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Accept request" }));
  expect(apiClient.patch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Confirm acceptance" }));
  await waitFor(() => expect(apiClient.patch).toHaveBeenCalledWith("/orders/58/status", { status: "pending" }));
  await waitFor(() => expect(refreshed).toHaveBeenCalledTimes(1));
});
it("rejects only the selected request", async () => {
  render(<OrderRequestReview order={order} canApprove canReject onResolved={vi.fn().mockResolvedValue(undefined)} />);
  fireEvent.click(screen.getByRole("button", { name: "Reject" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm rejection" }));
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith("/orders/58/cancel", { reason: "Customer food request rejected by staff" }));
  expect(apiClient.patch).not.toHaveBeenCalled();
});
it("does not mutate a request already handled by another client", async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: { data: { status: "pending" } } });
  render(<OrderRequestReview order={order} canApprove canReject onResolved={vi.fn().mockResolvedValue(undefined)} />);
  fireEvent.click(screen.getByRole("button", { name: "Accept request" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm acceptance" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("already changed");
  expect(apiClient.patch).not.toHaveBeenCalled();
});
it("respects separate edit and void permissions", () => {
  render(<OrderRequestReview order={order} canApprove={false} canReject={false} onResolved={vi.fn()} />);
  expect(screen.queryByRole("button", { name: "Accept request" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
});
it("keeps a failed decision recoverable without claiming it succeeded", async () => {
  vi.mocked(apiClient.patch).mockRejectedValue({ response: { data: { detail: "Request changed; refresh first." } } });
  render(<OrderRequestReview order={order} canApprove canReject onResolved={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Accept request" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm acceptance" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Request changed; refresh first.");
  expect(screen.queryByText("Request handled.")).not.toBeInTheDocument();
});
