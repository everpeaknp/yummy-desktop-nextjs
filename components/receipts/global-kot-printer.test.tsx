import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/api-client", () => ({ default: mocks }));
vi.mock("@/hooks/use-restaurant", () => ({ useRestaurant: { getState: () => ({ restaurant: { id: 52 } }) } }));
import { GlobalKotPrinter } from "./global-kot-printer";

const ticket = {
  id: 45079, restaurant_id: 52, station: "bar", order: { id: 10 },
  items: [{ id: 1, item_name: "Test drink", quantity: 1 }],
  printer_config: { name: "Test printer", address: "127.0.0.1", printer_type: "network" },
};
function dispatchTicket() {
  window.dispatchEvent(new CustomEvent("yummy:kot-print", { detail: ticket }));
}

describe("KOT claim requires a usable local print bridge", () => {
  beforeEach(() => {
    delete (window as any).electronAPI;
    mocks.get.mockReset().mockResolvedValue({ data: { data: { kot_template: [] } } });
    mocks.post.mockReset().mockResolvedValue({ data: { data: true } });
  });
  afterEach(() => { cleanup(); delete (window as any).electronAPI; });

  it("does not claim a KOT in a regular browser", async () => {
    render(<GlobalKotPrinter />);
    await act(async () => dispatchTicket());
    expect(mocks.post).not.toHaveBeenCalled();
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it("does not claim a KOT with an incomplete Electron bridge", async () => {
    (window as any).electronAPI = {};
    render(<GlobalKotPrinter />);
    await act(async () => dispatchTicket());
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it("claims before printing when a network print bridge is available", async () => {
    const printNetworkRaw = vi.fn().mockResolvedValue({ success: true });
    (window as any).electronAPI = { printNetworkRaw };
    render(<GlobalKotPrinter />);
    await act(async () => dispatchTicket());
    await waitFor(() => expect(printNetworkRaw).toHaveBeenCalledTimes(1));
    expect(mocks.post).toHaveBeenCalledWith("/kots/45079/mark-auto-printed");
    expect(mocks.post.mock.invocationCallOrder[0]).toBeLessThan(printNetworkRaw.mock.invocationCallOrder[0]);
  });

  it("does not claim a non-network printer without a silent print bridge", async () => {
    (window as any).electronAPI = { printNetworkRaw: vi.fn() };
    render(<GlobalKotPrinter />);
    await act(async () => window.dispatchEvent(new CustomEvent("yummy:kot-print", {
      detail: { ...ticket, printer_config: { name: "USB printer", address: "USB", printer_type: "usb" } },
    })));
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it("does not print when another terminal already claimed the KOT", async () => {
    const printNetworkRaw = vi.fn();
    (window as any).electronAPI = { printNetworkRaw };
    mocks.post.mockResolvedValue({ data: { data: false } });
    render(<GlobalKotPrinter />);
    await act(async () => dispatchTicket());
    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(printNetworkRaw).not.toHaveBeenCalled();
  });
});
