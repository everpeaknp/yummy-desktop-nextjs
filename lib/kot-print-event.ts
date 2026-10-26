import apiClient from "@/lib/api-client";
import { getElectronPrintBridge } from "@/lib/receipt-network-print";

export interface KotPrintEvent {
  id: number;
  action: string;
  created_at: string;
  printed_at: string | null;
  items: { name: string; qty: number }[];
}

export async function getKotPrintEvents(kotId: number): Promise<KotPrintEvent[]> {
  const response = await apiClient.get(`/kots/${kotId}/print-events`);
  return response.data?.data || [];
}

/** Send the saved slip. A pending event is leased until Electron confirms the send. */
export async function printKotEvent(kotId: number, event: KotPrintEvent): Promise<void> {
  const bridge = getElectronPrintBridge();
  if (!bridge?.printNetworkRaw) {
    throw new Error("Saved KOT slips require a network printer in the Yummy desktop app.");
  }

  const response = await apiClient.get(`/kots/${kotId}/print-payload`, {
    params: { print_event_id: event.id },
  });
  const { payload_base64: payloadBase64, printer_config: printer } = response.data?.data || {};
  const host = String(printer?.connection_config?.ip_address || printer?.address || "").trim();
  const port = Number(printer?.connection_config?.port || 9100);
  const isNetworkPrinter = String(printer?.printer_type || "").toLowerCase() === "network" ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
  if (!payloadBase64 || !isNetworkPrinter || !host || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("No valid network printer or saved KOT payload is available for this station.");
  }

  let claimToken: string | null = null;
  if (!event.printed_at) {
    const claim = await apiClient.post(`/kots/print-events/${event.id}/claim`);
    if (!claim.data?.data?.claimed || !claim.data?.data?.claim_token) {
      throw new Error("This slip is being printed elsewhere, or an earlier slip must be printed first.");
    }
    claimToken = claim.data.data.claim_token;
  }

  try {
    const result = await bridge.printNetworkRaw({ host, port, payloadBase64 });
    if (!result?.success) {
      throw new Error(result?.message || result?.error || "Printer did not accept the slip.");
    }
  } catch (error) {
    if (claimToken) {
      try {
        await apiClient.post(`/kots/print-events/${event.id}/release`, {
          claim_token: claimToken,
        });
      } catch (releaseError) {
        console.error("Could not release KOT print claim", releaseError);
      }
    }
    throw error;
  }
  if (claimToken) {
    try {
      const sent = await apiClient.post(`/kots/print-events/${event.id}/sent`, {
        claim_token: claimToken,
      });
      if (sent.data?.data !== true) throw new Error("Print claim expired.");
    } catch {
      // The bytes were sent; releasing here could print the same slip twice.
      throw new Error("Slip was sent, but the server could not confirm it. Check the printer before retrying.");
    }
  }
}
