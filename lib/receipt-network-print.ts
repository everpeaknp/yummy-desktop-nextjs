import apiClient from "@/lib/api-client";
import { PrinterApis } from "@/lib/api/endpoints";
import type { ReceiptData } from "@/types/order";

export interface ReceiptNetworkTarget {
  host: string;
  port: number;
  printerName: string;
}

export interface ElectronPrintBridge {
  isDesktopShell?: boolean;
  printNetworkRaw?: (options: {
    host: string;
    port: number;
    payloadBase64?: string;
    payload?: string;
    timeoutMs?: number;
  }) => Promise<{ success?: boolean; message?: string; error?: string }>;
}

export function getElectronPrintBridge(): ElectronPrintBridge | null {
  if (typeof window === "undefined") return null;
  return (
    (window as Window & { electronAPI?: ElectronPrintBridge }).electronAPI ??
    null
  );
}

export function isElectronDesktop(): boolean {
  return getElectronPrintBridge()?.isDesktopShell === true;
}

function printerHost(printer: any): string {
  return String(
    printer?.connection_config?.ip_address || printer?.address || "",
  ).trim();
}

function isNetworkPrinter(printer: any, host: string): boolean {
  const type = String(
    printer?.printer_type || printer?.type || "",
  ).toLowerCase();
  return type.includes("network") || /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

function targetFromPrinter(printer: any): ReceiptNetworkTarget | null {
  if (!printer) return null;
  const host = printerHost(printer);
  if (!host || !isNetworkPrinter(printer, host)) return null;
  return {
    host,
    port: Number(printer?.connection_config?.port || printer?.port || 9100),
    printerName:
      String(
        printer?.display_name || printer?.name || "Receipt printer",
      ).trim() || "Receipt printer",
  };
}

function assignedReceiptPrinter(
  printers: any[],
  restaurant: ReceiptData["restaurant"],
): any | null {
  const stations = (restaurant as any)?.kot_station_config?.stations;
  const receiptStation = Array.isArray(stations)
    ? stations.find(
        (station: any) =>
          String(station?.name || "")
            .trim()
            .toLowerCase() === "receipt",
      )
    : null;
  if (receiptStation?.printer_id) {
    const assigned = printers.find(
      (printer) =>
        printer?.id === receiptStation.printer_id && printer?.enabled !== false,
    );
    if (assigned) return assigned;
  }
  return (
    printers.find(
      (printer) => printer?.enabled !== false && printer?.is_default,
    ) ||
    printers.find((printer) => printer?.enabled !== false) ||
    null
  );
}

export async function resolveReceiptNetworkTarget(
  receipt: ReceiptData,
): Promise<ReceiptNetworkTarget | null> {
  const direct = targetFromPrinter(receipt.printer_config);
  if (direct) return direct;

  const restaurantId = receipt.restaurant?.id;
  if (!restaurantId) return null;
  const response = await apiClient.get(PrinterApis.list(restaurantId));
  const printers = Array.isArray(response?.data?.data)
    ? response.data.data
    : [];
  return targetFromPrinter(
    assignedReceiptPrinter(printers, receipt.restaurant),
  );
}

export async function printRawToReceiptPrinter(
  receipt: ReceiptData,
  options: {
    payloadBase64?: string;
    payload?: string;
    timeoutMs?: number;
  },
): Promise<ReceiptNetworkTarget> {
  const bridge = getElectronPrintBridge();
  if (!bridge?.printNetworkRaw) {
    throw new Error("Network printing is available in the Yummy desktop app.");
  }
  const target = await resolveReceiptNetworkTarget(receipt);
  if (!target) {
    throw new Error(
      "No network receipt printer is configured. Configure one in Settings > Printers.",
    );
  }
  const result = await bridge.printNetworkRaw({
    host: target.host,
    port: target.port,
    payloadBase64: options.payloadBase64,
    payload: options.payload,
    timeoutMs: options.timeoutMs ?? 2000,
  });
  if (!result?.success) {
    throw new Error(
      result?.message || result?.error || "Network receipt printing failed.",
    );
  }
  return target;
}
