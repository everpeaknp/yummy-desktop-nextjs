import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KotTicketItems } from "./kot-ticket-items";

const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("@/lib/api-client", () => ({ default: { post } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
afterEach(() => { cleanup(); post.mockReset(); });

const ticket = {
  id: 12, status: "PENDING", items: [{ id: 34, item_name: "Milk tea", qty_change: 1, qty_ready: 0, qty_served: 0, item_status: "PENDING" }],
};

describe("KOT item controls", () => {
  it("hides mutations when the user cannot operate tickets", () => {
    render(<KotTicketItems ticket={ticket} canOperate={false} onUpdated={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Accept" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reject item" })).toBeNull();
  });

  it("accepts an item and passes the server ticket back to its page", async () => {
    const updated = { ...ticket, status: "PREPARING", items: [{ ...ticket.items[0], item_status: "PREPARING" }] };
    const onUpdated = vi.fn();
    post.mockResolvedValue({ data: { status: "success", data: updated } });
    render(<KotTicketItems ticket={ticket} canOperate onUpdated={onUpdated} />);
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(updated));
    expect(post).toHaveBeenCalledWith("/kots/12/items/34/accept");
  });
});
