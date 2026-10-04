import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KOTTicketCard } from "./kot-ticket-card";
afterEach(cleanup);
const props = {kot: {id: 1, status: "PENDING", station: "Bar", items: []}, elapsed: "1m", delayed: false, isUpdating: false, onOpenDetails: vi.fn()};
describe("ticket action visibility", () => {
  it("does not offer reject or advance without authorized callbacks", () => {
    render(<KOTTicketCard {...props} />);
    expect(screen.queryByRole("button", {name: "Reject"})).toBeNull();
    expect(screen.queryByRole("button", {name: "Start Cooking"})).toBeNull();
    expect(screen.getByRole("button", {name: "Open KOT 1 details"})).toBeTruthy();
  });
  it("offers authorized operational actions", () => {
    render(<KOTTicketCard {...props} onReject={vi.fn()} primaryAction={{label: "Start Cooking", onClick: vi.fn()}} />);
    expect(screen.getByRole("button", {name: "Reject"})).toBeTruthy();
    expect(screen.getByRole("button", {name: "Start Cooking"})).toBeTruthy();
  });
});
