import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/api-client", () => ({ default: mocks }));
import { GlobalKotPrinter } from "./global-kot-printer";
import { printKotEvent } from "@/lib/kot-print-event";

const slip = { id: 27, action: "ITEM_CANCEL", created_at: "2026-10-26T02:44:00Z", printed_at: null,
  items: [{ name: "Sprite", qty: 1 }] };
const ticket = { kot_id: 45079, station: "bar" };

function dispatchTicket() {
  window.dispatchEvent(new CustomEvent("yummy:kot-print", { detail: ticket }));
}

describe("saved KOT print events", () => {
  beforeEach(() => {
    delete (window as any).electronAPI;
    localStorage.clear();
    mocks.get.mockReset().mockImplementation((url: string) => {
      if (url.endsWith("/print-events")) return Promise.resolve({ data: { data: [slip] } });
      if (url.endsWith("/print-payload")) return Promise.resolve({ data: { data: {
        payload_base64: "AAE=", printer_config: { address: "127.0.0.1", connection_config: { port: 9100 } },
      } } });
      throw new Error(`Unexpected GET ${url}`);
    });
    mocks.post.mockReset().mockImplementation((url: string) => Promise.resolve({ data: { data:
      url.endsWith("/claim") ? { claimed: true, claim_token: "lease" } : true,
    } }));
  });
  afterEach(() => { cleanup(); delete (window as any).electronAPI; });

  it("leaves the slip pending in a regular browser", async () => {
    render(<GlobalKotPrinter />);
    await act(async () => dispatchTicket());
    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it("prints the exact cancellation before recording it as sent", async () => {
    const printNetworkRaw = vi.fn().mockResolvedValue({ success: true });
    (window as any).electronAPI = { printNetworkRaw };
    render(<GlobalKotPrinter />);
    await act(async () => dispatchTicket());
    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith("/kots/print-events/27/sent", { claim_token: "lease" }));
    expect(mocks.get).toHaveBeenCalledWith("/kots/45079/print-payload", { params: { print_event_id: 27 } });
    expect(printNetworkRaw).toHaveBeenCalledWith({ host: "127.0.0.1", port: 9100, payloadBase64: "AAE=" });
    const claim = mocks.post.mock.invocationCallOrder[0];
    const send = printNetworkRaw.mock.invocationCallOrder[0];
    const confirm = mocks.post.mock.invocationCallOrder[1];
    expect(claim).toBeLessThan(send);
    expect(send).toBeLessThan(confirm);
  });

  it("releases the pending slip when Electron reports a failed send", async () => {
    const printNetworkRaw = vi.fn().mockResolvedValue({ success: false, message: "offline" });
    (window as any).electronAPI = { printNetworkRaw };
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<GlobalKotPrinter />);
    await act(async () => dispatchTicket());
    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith("/kots/print-events/27/release", { claim_token: "lease" }));
    expect(mocks.post).not.toHaveBeenCalledWith("/kots/print-events/27/sent", expect.anything());
    error.mockRestore();
  });

  it("does not print a slip claimed by another terminal", async () => {
    const printNetworkRaw = vi.fn();
    (window as any).electronAPI = { printNetworkRaw };
    mocks.post.mockResolvedValue({ data: { data: { claimed: false } } });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<GlobalKotPrinter />);
    await act(async () => dispatchTicket());
    expect(printNetworkRaw).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it("reprints a previously sent cancellation as a copy without claiming it", async () => {
    const printNetworkRaw = vi.fn().mockResolvedValue({ success: true });
    (window as any).electronAPI = { printNetworkRaw };
    await printKotEvent(45079, { ...slip, printed_at: "2026-10-26T02:45:00Z" });
    expect(mocks.get).toHaveBeenCalledWith("/kots/45079/print-payload", { params: { print_event_id: 27 } });
    expect(printNetworkRaw).toHaveBeenCalledTimes(1);
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it("does not release a lease after bytes were sent but confirmation failed", async () => {
    (window as any).electronAPI = { printNetworkRaw: vi.fn().mockResolvedValue({ success: true }) };
    mocks.post.mockImplementation((url: string) => {
      if (url.endsWith("/claim")) return Promise.resolve({ data: { data: { claimed: true, claim_token: "lease" } } });
      return Promise.reject(new Error("network unavailable"));
    });
    await expect(printKotEvent(45079, slip)).rejects.toThrow("Check the printer before retrying");
    expect(mocks.post).not.toHaveBeenCalledWith("/kots/print-events/27/release", expect.anything());
  });
});
