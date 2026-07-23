import apiClient from "@/lib/api-client";
import { PrinterApis } from "@/lib/api/endpoints";
import type { DayCloseOrderSnapshotRow } from "@/lib/day-close-snapshot-view";

type DayClosePrinter = {
  name?: string;
  address?: string;
  printer_type?: string;
  connection_config?: {
    ip_address?: string;
    port?: number | string;
  } | null;
  enabled?: boolean;
  is_default?: boolean;
};

type ElectronPrintBridge = {
  printNetworkRaw?: (options: {
    host: string;
    port: number;
    payload: string;
    timeoutMs?: number;
  }) => Promise<{ success?: boolean; message?: string }>;
};

export type DayOrdersPrintResult = {
  mode: "network" | "dialog";
  printerName?: string;
};

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatAmount(value: number | undefined): string {
  if (value == null || !Number.isFinite(value)) return "Not recorded";
  return `Rs. ${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDayCloseOrderTime(
  order: DayCloseOrderSnapshotRow,
  timezone?: string,
): string {
  const value = order.completedAt ?? order.createdAt;
  if (!value) return "Not recorded";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not recorded";

  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
    }).format(parsed);
  } catch {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }).format(parsed);
  }
}

export function formatDayCloseOrderPayments(
  order: DayCloseOrderSnapshotRow,
): string {
  if (order.paymentBreakdown.length > 0) {
    return order.paymentBreakdown
      .map((payment) => {
        const instrument = payment.instrument
          ? ` (${payment.instrument})`
          : "";
        return `${titleCase(payment.method)}${instrument}: ${formatAmount(payment.amount)}`;
      })
      .join(" + ");
  }

  if (order.paymentMethods.length > 0) {
    return order.paymentMethods.map(titleCase).join(" + ");
  }

  return "Not recorded";
}

export function buildDayOrdersThermalText(options: {
  orders: DayCloseOrderSnapshotRow[];
  timezone?: string;
}): string {
  const lines = ["DAY ORDERS", "--------------------------------"];

  options.orders.forEach((order, index) => {
    lines.push(
      `Order ID: #${order.restaurantOrderId ?? order.orderId}`,
      `Table: ${order.tableName || "Takeaway/Delivery"}`,
      `Total Payment: ${formatAmount(order.totalPayment ?? order.grandTotal)}`,
      `Payment: ${formatDayCloseOrderPayments(order)}`,
      `Time: ${formatDayCloseOrderTime(order, options.timezone)}`,
    );
    if (index < options.orders.length - 1) {
      lines.push("--------------------------------");
    }
  });

  return `${lines.join("\n")}\n`;
}

export function buildDayOrdersEscPosPayload(options: {
  orders: DayCloseOrderSnapshotRow[];
  timezone?: string;
}): string {
  return [
    "\x1B@",
    "\x1Ba\x01",
    buildDayOrdersThermalText(options),
    "\n\n",
    "\x1DV\x00",
  ].join("");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function buildDayOrdersPrintHtml(options: {
  orders: DayCloseOrderSnapshotRow[];
  timezone?: string;
}): string {
  const text = escapeHtml(buildDayOrdersThermalText(options));
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Day Orders</title>
    <style>
      @page { size: 80mm auto; margin: 4mm; }
      * { box-sizing: border-box; }
      body { width: 72mm; margin: 0; color: #000; background: #fff; font: 12px/1.35 "Courier New", monospace; }
      pre { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
    </style>
  </head>
  <body><pre>${text}</pre></body>
</html>`;
}

function getElectronBridge(): ElectronPrintBridge | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { electronAPI?: ElectronPrintBridge }).electronAPI;
}

async function resolveDefaultNetworkPrinter(
  restaurantId?: number,
): Promise<DayClosePrinter | null> {
  if (!restaurantId) return null;

  try {
    const response = await apiClient.get(PrinterApis.list(restaurantId));
    const printers = Array.isArray(response?.data?.data)
      ? (response.data.data as DayClosePrinter[])
      : [];
    const defaultPrinter = printers.find(
      (printer) => printer.enabled !== false && printer.is_default,
    );
    if (!defaultPrinter) return null;

    const host = String(
      defaultPrinter.connection_config?.ip_address
        ?? defaultPrinter.address
        ?? "",
    ).trim();
    const type = String(defaultPrinter.printer_type ?? "").toLowerCase();
    const isNetwork =
      type.includes("network")
      || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);
    return isNetwork && host ? defaultPrinter : null;
  } catch {
    return null;
  }
}

function openThermalPrintDialog(options: {
  orders: DayCloseOrderSnapshotRow[];
  timezone?: string;
}): void {
  const popup = window.open("", "_blank", "width=420,height=720");
  if (!popup) {
    throw new Error("The print window was blocked. Allow popups and try again.");
  }

  popup.document.open();
  popup.document.write(buildDayOrdersPrintHtml(options));
  popup.document.close();
  popup.focus();
  popup.onafterprint = () => popup.close();

  const startPrint = () => {
    popup.setTimeout(() => popup.print(), 50);
  };
  if (popup.document.readyState === "complete") {
    startPrint();
  } else {
    popup.addEventListener("load", startPrint, { once: true });
  }
}

export async function printDayOrdersThermally(options: {
  orders: DayCloseOrderSnapshotRow[];
  restaurantId?: number;
  timezone?: string;
}): Promise<DayOrdersPrintResult> {
  if (options.orders.length === 0) {
    throw new Error("There are no day orders to print.");
  }

  const bridge = getElectronBridge();
  if (bridge?.printNetworkRaw) {
    const printer = await resolveDefaultNetworkPrinter(options.restaurantId);
    if (printer) {
      const host = String(
        printer.connection_config?.ip_address ?? printer.address ?? "",
      ).trim();
      const port = Number(printer.connection_config?.port ?? 9100);
      const result = await bridge.printNetworkRaw({
        host,
        port: Number.isFinite(port) ? port : 9100,
        payload: buildDayOrdersEscPosPayload(options),
        timeoutMs: 2500,
      });
      if (result?.success === false) {
        throw new Error(result.message || "The thermal printer rejected the report.");
      }
      return { mode: "network", printerName: printer.name };
    }
  }

  openThermalPrintDialog(options);
  return { mode: "dialog" };
}
