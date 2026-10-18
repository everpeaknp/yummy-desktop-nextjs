import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import apiClient from "@/lib/api-client";
import { PendingItemRequests } from "./pending-item-requests";
vi.mock("@/lib/api-client", () => ({ default: { get: vi.fn(), patch: vi.fn(), post: vi.fn() } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it("shows additions inside the bill without exposing a second order link, and accepts the correct batch", async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: { data: { status: "requested" } } });
  render(<PendingItemRequests requests={[{ id: 57, items: [{ name_snapshot: "Momo", qty: 1 }] }, { id: 58, items: [{ name_snapshot: "Coke", qty: 2 }] }]} canApprove canReject onResolved={vi.fn().mockResolvedValue(undefined)} />);
  expect(screen.getByRole("region", { name: "New items awaiting approval" })).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "View request" })).not.toBeInTheDocument();
  expect(screen.queryByText(/Request #/)).not.toBeInTheDocument();
  fireEvent.click(screen.getAllByRole("button", { name: "Accept request" })[1]);
  fireEvent.click(screen.getByRole("button", { name: "Confirm acceptance" }));
  await waitFor(() => expect(apiClient.patch).toHaveBeenCalledWith("/orders/58/status", { status: "pending" }));
});
