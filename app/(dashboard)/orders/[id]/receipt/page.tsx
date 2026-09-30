"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import apiClient from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { ReceiptApis, OrderApis, PrinterApis } from "@/lib/api/endpoints";
import { useOrderFull } from "@/hooks/use-order-full";
import { useMobileAppBarTitle } from "@/components/layout/mobile-app-bar-title";

function ReceiptAppBarTitle({ title }: { title: string }) {
  useMobileAppBarTitle(title);
  return null;
}
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  usePosBillingPermissions,
  isOrderRefundHistorical,
} from "@/hooks/use-pos-billing-permissions";
import {
  ArrowLeft,
  Printer,
  Share2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Loader2,
  Receipt,
  CreditCard,
  Banknote,
  Smartphone,
  Wallet,
  RotateCcw,
} from "lucide-react";
import type { ReceiptData, OrderItem, OrderPayment } from "@/types/order";
import {
  ThermalReceipt,
  type ReceiptPaymentQr,
} from "@/components/receipts/thermal-receipt";
import { FiscalReceipt } from "@/components/receipts/fiscal-receipt";
import { RestaurantApis } from "@/lib/api/endpoints";
import { useFiscalProfile } from "@/hooks/use-fiscal-profile";
import { useOrderFiscalDocument } from "@/hooks/use-order-fiscal-document";
import { useFiscalPrint } from "@/hooks/use-fiscal-print";
import {
  isElectronDesktop,
  printRawToReceiptPrinter,
} from "@/lib/receipt-network-print";

function formatCurrency(amount: number) {
  return `Rs. ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const PAYMENT_ICONS: Record<string, any> = {
  cash: Banknote,
  card: CreditCard,
  digital: Smartphone,
  credit: Wallet,
};

function getDefaultTemplate(): any[] {
  return [
    {
      type: "global_settings",
      id: "metadata",
      global_font_type: "A",
      global_font_size: 11,
      line_spacing: 1.0,
      paper_size: "80mm",
      column_capacity: 48,
    },
    {
      id: "1",
      type: "header",
      is_visible: true,
      show_on_bill: true,
      show_on_receipt: true,
    },
    {
      id: "2",
      type: "bill_info",
      is_visible: true,
      show_on_bill: true,
      show_on_receipt: true,
    },
    {
      id: "3",
      type: "customer",
      is_visible: true,
      show_on_bill: true,
      show_on_receipt: true,
    },
    {
      id: "4",
      type: "items",
      is_visible: true,
      show_on_bill: true,
      show_on_receipt: true,
    },
    {
      id: "5",
      type: "totals",
      is_visible: true,
      show_on_bill: true,
      show_on_receipt: true,
    },
    {
      id: "6",
      type: "payments",
      is_visible: true,
      show_on_bill: false,
      show_on_receipt: true,
    },
    {
      id: "7",
      type: "footer",
      is_visible: true,
      show_on_bill: true,
      show_on_receipt: true,
    },
  ];
}

async function getCanonicalReceiptPayload(
  orderId: number,
  mode: "bill" | "receipt" = "receipt",
  authorizationId?: number,
  paymentQrConfigId?: string | null,
  terminalId?: number | null,
): Promise<string> {
  const authorizationQuery = authorizationId
    ? `&authorization_id=${authorizationId}`
    : "";
  const paymentQrQuery = paymentQrConfigId
    ? `&payment_qr_config_id=${encodeURIComponent(paymentQrConfigId)}`
    : "";
  const terminalQuery = terminalId ? `&terminal_id=${terminalId}` : "";
  const response = await apiClient.get(
    `/receipts/orders/${orderId}/print-payload?mode=${mode}${authorizationQuery}${paymentQrQuery}${terminalQuery}`,
  );
  const payload = response.data?.data?.payload_base64;
  if (!payload) throw new Error("Canonical receipt payload is empty.");
  return payload;
}

function resolveReceiptAssignedPrinter(
  printers: any[],
  restaurantLike: any,
): any | null {
  const stations = restaurantLike?.kot_station_config?.stations;
  const receiptStation = Array.isArray(stations)
    ? stations.find(
        (s: any) =>
          String(s?.name || "")
            .trim()
            .toLowerCase() === "receipt",
      )
    : null;
  const receiptPrinterId = receiptStation?.printer_id;

  if (receiptPrinterId) {
    const mapped = (printers || []).find(
      (p: any) => p?.id === receiptPrinterId && p?.enabled,
    );
    if (mapped) return mapped;
  }

  return (
    (printers || []).find((p: any) => p?.enabled && p?.is_default) ||
    (printers || []).find((p: any) => p?.enabled) ||
    null
  );
}

function getReceiptNetworkTarget(
  receipt: ReceiptData,
  printers?: any[],
  restaurantLike?: any,
): { host: string; port: number } | null {
  const cfg = receipt.printer_config;
  if (cfg) {
    const printer = cfg as any;
    const host = String(
      printer.connection_config?.ip_address || printer.address || "",
    ).trim();
    const port = Number(
      printer.connection_config?.port || printer.port || 9100,
    );
    const type = String(
      printer.printer_type || printer.type || "",
    ).toLowerCase();
    const isNetwork =
      type.includes("network") || /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
    if (isNetwork && host) return { host, port };
  }

  const assigned = printers?.length
    ? resolveReceiptAssignedPrinter(
        printers,
        restaurantLike ?? receipt.restaurant,
      )
    : null;
  if (!assigned) return null;

  const host = String(
    assigned?.connection_config?.ip_address || assigned?.address || "",
  ).trim();
  const port = Number(assigned?.connection_config?.port || 9100);
  const type = String(assigned?.printer_type || "").toLowerCase();
  const isNetwork =
    type.includes("network") || /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
  if (isNetwork && host) return { host, port };
  return null;
}

type FiscalPrintDestination =
  | {
      kind: "network";
      host: string;
      port: number;
      printerName: string;
    }
  | {
      kind: "silent";
      printerName: string;
    }
  | {
      kind: "browser";
      printerName: string;
    };

function waitForFiscalReceiptRender(): Promise<void> {
  if (typeof requestAnimationFrame !== "function") {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export default function ReceiptPage() {
  const params = useParams() as { id?: string | string[] } | null;
  const rawId = Array.isArray(params?.id) ? params?.id[0] : params?.id;
  const orderId = Number(rawId || 0);
  const router = useRouter();

  // Extract returnTo from URL if present
  const [returnTo, setReturnTo] = useState<string | null>(null);
  const [autoPrintRequested, setAutoPrintRequested] = useState(false);
  const [paymentQrConfigId, setPaymentQrConfigId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      setReturnTo(urlParams.get("returnTo"));
      setPaymentQrConfigId(urlParams.get("paymentQrConfigId"));
      const requested = urlParams.get("autoPrint") === "1";
      setAutoPrintRequested(requested);
      if (requested) {
        urlParams.delete("autoPrint");
        const query = urlParams.toString();
        window.history.replaceState(
          window.history.state,
          "",
          `${window.location.pathname}${query ? `?${query}` : ""}`,
        );
      }
    }
  }, []);

  const user = useAuth((s) => s.user);
  const me = useAuth((s) => s.me);
  const { canProcessRefund, canApproveHistoricalRefund, canRefundOrder } =
    usePosBillingPermissions();

  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [template, setTemplate] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [printed, setPrinted] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundReference, setRefundReference] = useState("");
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);
  const [ordinaryPrintDesignation, setOrdinaryPrintDesignation] = useState<
    string | null
  >(null);
  const [qrChooserOpen, setQrChooserOpen] = useState(false);
  const [pendingQrPrintIntent, setPendingQrPrintIntent] = useState<
    "manual" | "auto" | null
  >(null);
  const [terminalChooserOpen, setTerminalChooserOpen] = useState(false);
  const [selectedTerminalId, setSelectedTerminalId] = useState<number | null>(
    null,
  );
  const [pendingTerminalPrintIntent, setPendingTerminalPrintIntent] = useState<
    "manual" | "auto" | null
  >(null);
  useOrderFull(orderId);
  const autoPrintedOrderRef = useRef<number | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);
  const {
    isActiveVatEbilling,
    loading: fiscalProfileLoading,
    error: fiscalProfileError,
    refresh: refreshFiscalProfile,
  } = useFiscalProfile(Boolean(orderId));
  const isPreBill = Boolean(
    receipt &&
    receipt.order.status !== "completed" &&
    (isActiveVatEbilling || !receipt.is_fully_paid),
  );
  const paymentQrs = useMemo(
    () =>
      (receipt?.restaurant.payment_qrs || []).filter((qr) => qr.payload.trim()),
    [receipt?.restaurant.payment_qrs],
  );
  const receiptTerminals = useMemo(
    () => receipt?.receipt_terminals || [],
    [receipt?.receipt_terminals],
  );
  const selectedTerminal = useMemo(
    () =>
      receiptTerminals.find((terminal) => terminal.id === selectedTerminalId) ||
      null,
    [receiptTerminals, selectedTerminalId],
  );
  const paymentQr = useMemo(() => {
    if (!isPreBill) return null;
    if (paymentQrConfigId) {
      return (
        paymentQrs.find((qr) => qr.config_id === paymentQrConfigId) || null
      );
    }
    return paymentQrs.length === 1 ? paymentQrs[0] : null;
  }, [isPreBill, paymentQrConfigId, paymentQrs]);
  const {
    document: fiscalDocument,
    loading: fiscalDocumentLoading,
    error: fiscalDocumentError,
    refresh: refreshFiscalDocument,
  } = useOrderFiscalDocument({
    orderId,
    enabled: isActiveVatEbilling && Boolean(receipt) && !isPreBill,
  });
  const {
    print: printFiscalDocument,
    printing: fiscalPrinting,
    error: fiscalPrintError,
    lastAuthorization,
    clearLastAuthorization,
  } = useFiscalPrint(fiscalDocument);

  // Reset print guard when navigating to a different receipt id.
  useEffect(() => {
    autoPrintedOrderRef.current = null;
    setPrinted(false);
  }, [orderId]);

  // Auth guard
  useEffect(() => {
    const checkAuth = async () => {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("accessToken")
          : null;
      if (!user && token) await me();
      const updatedToken =
        typeof window !== "undefined"
          ? localStorage.getItem("accessToken")
          : null;
      if (!user && !updatedToken) router.push("/");
    };
    const timer = setTimeout(checkAuth, 500);
    return () => clearTimeout(timer);
  }, [user, me, router]);

  // Fetch receipt data, then fetch template using the receipt's restaurant_id
  const fetchData = useCallback(async () => {
    if (!orderId) return;
    try {
      const receiptRes = await apiClient.get(
        ReceiptApis.getReceiptData(orderId),
        { params: { _t: Date.now() } },
      );
      if (receiptRes.data.status === "success") {
        const receiptData: ReceiptData = receiptRes.data.data;
        setReceipt(receiptData);

        // Use restaurant_id from the receipt response (avoids user?.restaurant_id being 0)
        const restaurantId = receiptData.restaurant?.id || user?.restaurant_id;
        if (restaurantId) {
          try {
            const templateRes = await apiClient.get(
              RestaurantApis.getTemplates(restaurantId),
            );
            if (
              templateRes.data.status === "success" &&
              templateRes.data.data?.receipt_template?.length > 0
            ) {
              setTemplate(templateRes.data.data.receipt_template);
            } else {
              setTemplate(getDefaultTemplate());
            }
          } catch {
            setTemplate(getDefaultTemplate());
          }
        } else {
          setTemplate(getDefaultTemplate());
        }
      }
      setError(null);
    } catch (err: any) {
      setError(
        err?.response?.data?.detail || err?.message || "Failed to load receipt",
      );
    } finally {
      setLoading(false);
    }
  }, [orderId, user?.restaurant_id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openPrintDialog = useCallback(() => {
    const printWhenReady = () => window.print();
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => requestAnimationFrame(printWhenReady));
    } else {
      printWhenReady();
    }
  }, []);

  const authorizeOrdinaryPrint = useCallback(async () => {
    const mode = isPreBill ? "bill" : "receipt";
    const response = await apiClient.post(
      `/receipts/orders/${orderId}/print-authorizations`,
      {
        mode,
        device_identifier: "yummy-web-receipt-route",
        printer_name: receipt?.printer_config?.name || "Browser print dialog",
        receipt_terminal_id: selectedTerminalId,
      },
    );
    return response.data.data as {
      authorization_id: number;
      designation: string;
    };
  }, [isPreBill, orderId, receipt?.printer_config?.name, selectedTerminalId]);

  const completeOrdinaryPrint = useCallback(
    async (
      authorizationId: number,
      succeeded: boolean,
      failureReason?: string,
    ) => {
      await apiClient.post(
        `/receipts/print-authorizations/${authorizationId}/complete`,
        {
          succeeded,
          failure_reason: failureReason,
        },
      );
    },
    [],
  );

  const runAutoPrint = useCallback(async () => {
    if (!receipt || !template) return;

    const authorization = await authorizeOrdinaryPrint();
    setOrdinaryPrintDesignation(authorization.designation);

    try {
      if (isElectronDesktop()) {
        const payloadBase64 = await getCanonicalReceiptPayload(
          orderId,
          isPreBill ? "bill" : "receipt",
          authorization.authorization_id,
          paymentQr?.config_id,
          selectedTerminalId,
        );
        await printRawToReceiptPrinter(
          selectedTerminal?.printer
            ? { ...receipt, printer_config: selectedTerminal.printer }
            : receipt,
          {
            payloadBase64,
            timeoutMs: 2000,
          },
        );
      } else {
        openPrintDialog();
      }
      setPrinted(true);
      await completeOrdinaryPrint(authorization.authorization_id, true);
      await fetchData();
    } catch (printError) {
      await completeOrdinaryPrint(
        authorization.authorization_id,
        false,
        printError instanceof Error ? printError.message : "Printing failed",
      ).catch(() => undefined);
      throw printError;
    } finally {
      setOrdinaryPrintDesignation(null);
    }
  }, [
    receipt,
    template,
    orderId,
    openPrintDialog,
    isPreBill,
    authorizeOrdinaryPrint,
    completeOrdinaryPrint,
    fetchData,
    paymentQr?.config_id,
    selectedTerminal,
    selectedTerminalId,
  ]);

  const resolveFiscalPrintDestination =
    useCallback(async (): Promise<FiscalPrintDestination> => {
      if (!receipt) {
        throw new Error("Receipt data is not ready.");
      }

      const winAny = typeof window !== "undefined" ? (window as any) : null;
      const effectivePrinter =
        selectedTerminal?.printer || receipt.printer_config;
      const effectiveReceipt = { ...receipt, printer_config: effectivePrinter };
      const directNetworkTarget = getReceiptNetworkTarget(effectiveReceipt);
      const directPrinterName =
        String(effectivePrinter?.name || "").trim() ||
        "Configured receipt printer";

      if (directNetworkTarget && winAny?.electronAPI?.printNetworkRaw) {
        return {
          kind: "network",
          ...directNetworkTarget,
          printerName: directPrinterName,
        };
      }

      if (effectivePrinter?.name?.trim() && winAny?.electronAPI?.printSilent) {
        return {
          kind: "silent",
          printerName: effectivePrinter.name.trim(),
        };
      }

      const restaurantId = receipt.restaurant?.id || user?.restaurant_id;
      if (
        restaurantId &&
        (winAny?.electronAPI?.printNetworkRaw ||
          winAny?.electronAPI?.printSilent)
      ) {
        try {
          const response = await apiClient.get(PrinterApis.list(restaurantId));
          const assigned = resolveReceiptAssignedPrinter(
            response?.data?.data || [],
            receipt.restaurant,
          );
          if (assigned) {
            const printerName =
              String(assigned?.name || assigned?.display_name || "").trim() ||
              "Assigned receipt printer";
            const host = String(
              assigned?.connection_config?.ip_address ||
                assigned?.address ||
                "",
            ).trim();
            const port = Number(assigned?.connection_config?.port || 9100);
            const printerType = String(
              assigned?.printer_type || "",
            ).toLowerCase();
            const isNetwork =
              printerType.includes("network") ||
              /^\d{1,3}(\.\d{1,3}){3}$/.test(host);

            if (isNetwork && host && winAny.electronAPI.printNetworkRaw) {
              return {
                kind: "network",
                host,
                port,
                printerName,
              };
            }
            if (winAny.electronAPI.printSilent) {
              return { kind: "silent", printerName };
            }
          }
        } catch (printerError) {
          console.warn(
            "[ReceiptPage] Could not resolve the assigned fiscal printer",
            printerError,
          );
        }
      }

      if (isElectronDesktop()) {
        throw new Error(
          "No usable receipt printer was found. Configure the network receipt printer in Settings → Printers.",
        );
      }
      return {
        kind: "browser",
        printerName: "Browser print dialog",
      };
    }, [receipt, selectedTerminal, user?.restaurant_id]);

  const runFiscalPrint = useCallback(async () => {
    if (!receipt || !fiscalDocument) {
      throw new Error(
        fiscalDocumentError || "The immutable fiscal tax invoice is not ready.",
      );
    }

    const destination = await resolveFiscalPrintDestination();
    const winAny = typeof window !== "undefined" ? (window as any) : null;
    try {
      const authorization = await printFiscalDocument({
        authorizationInput: {
          device_identifier: "yummy-web-receipt-route",
          printer_name: destination.printerName,
        },
        dispatch: async (printAuthorization) => {
          if (destination.kind === "network") {
            const payloadBase64 =
              printAuthorization.render_payload?.payload_base64;
            if (!payloadBase64) {
              throw new Error(
                "The backend did not return the authorized fiscal print payload.",
              );
            }
            const result = await winAny?.electronAPI?.printNetworkRaw({
              host: destination.host,
              port: destination.port,
              payloadBase64,
              timeoutMs: 2000,
            });
            if (!result?.success) {
              throw new Error(
                result?.message || "The fiscal invoice could not be printed.",
              );
            }
            return;
          }

          await waitForFiscalReceiptRender();
          if (destination.kind === "silent") {
            const result = await winAny?.electronAPI?.printSilent({
              printerName: destination.printerName,
            });
            if (!result?.success) {
              throw new Error(
                result?.error || "The fiscal invoice could not be printed.",
              );
            }
            return;
          }

          window.print();
        },
      });

      setPrinted(true);
      await refreshFiscalDocument();
      return authorization;
    } finally {
      clearLastAuthorization();
    }
  }, [
    fiscalDocument,
    fiscalDocumentError,
    printFiscalDocument,
    clearLastAuthorization,
    receipt,
    refreshFiscalDocument,
    resolveFiscalPrintDestination,
  ]);

  // Active VAT e-billing waits for an immutable fiscal document and a
  // server-issued print authorization. Other tenants keep legacy auto-print.
  useEffect(() => {
    if (!receipt || !template) return;
    // Viewing a fiscal receipt must never reserve another legal copy number.
    // Auto-print is allowed only for an explicit, one-shot checkout request.
    if (!autoPrintRequested) return;
    if (fiscalProfileLoading || fiscalProfileError) return;
    if (autoPrintedOrderRef.current === orderId) return;
    if (receiptTerminals.length > 1 && !selectedTerminalId) {
      setPendingTerminalPrintIntent("auto");
      setTerminalChooserOpen(true);
      return;
    }
    if (receipt.should_auto_print === false && !selectedTerminal?.printer)
      return;

    if (isPreBill && paymentQrs.length > 1 && !paymentQr) {
      setPendingQrPrintIntent("auto");
      setQrChooserOpen(true);
      return;
    }

    if (isActiveVatEbilling && !isPreBill) {
      if (fiscalDocumentLoading || !fiscalDocument || fiscalDocumentError) {
        return;
      }
      autoPrintedOrderRef.current = orderId;
      void runFiscalPrint().catch((printError) => {
        toast.error(
          printError instanceof Error
            ? printError.message
            : "Fiscal printing failed.",
        );
      });
      return;
    }

    autoPrintedOrderRef.current = orderId;
    void runAutoPrint();
  }, [
    fiscalDocument,
    fiscalDocumentError,
    fiscalDocumentLoading,
    fiscalProfileError,
    fiscalProfileLoading,
    isActiveVatEbilling,
    isPreBill,
    orderId,
    receipt,
    paymentQr,
    paymentQrs.length,
    runAutoPrint,
    runFiscalPrint,
    template,
    autoPrintRequested,
    receiptTerminals.length,
    selectedTerminalId,
    selectedTerminal?.printer,
  ]);

  const handlePrint = useCallback(
    async (qrSelectionConfirmed = false) => {
      if (receiptTerminals.length > 1 && !selectedTerminalId) {
        setPendingTerminalPrintIntent("manual");
        setTerminalChooserOpen(true);
        return;
      }
      if (isPreBill && paymentQrs.length > 1 && !qrSelectionConfirmed) {
        setPendingQrPrintIntent("manual");
        setQrChooserOpen(true);
        return;
      }
      if (fiscalProfileLoading) return;
      if (fiscalProfileError) {
        toast.error(fiscalProfileError);
        return;
      }
      if (isActiveVatEbilling && !isPreBill) {
        try {
          await runFiscalPrint();
          toast.success("Fiscal print result recorded.");
        } catch (printError) {
          toast.error(
            printError instanceof Error
              ? printError.message
              : "Fiscal printing failed.",
          );
        }
        return;
      }
      try {
        autoPrintedOrderRef.current = orderId;
        await runAutoPrint();
        toast.success("Receipt sent to the configured printer.");
      } catch (printError) {
        toast.error(
          printError instanceof Error ? printError.message : "Printing failed.",
        );
      }
    },
    [
      fiscalProfileError,
      fiscalProfileLoading,
      isActiveVatEbilling,
      isPreBill,
      orderId,
      paymentQrs.length,
      runFiscalPrint,
      runAutoPrint,
      receiptTerminals.length,
      selectedTerminalId,
    ],
  );

  const selectReceiptTerminal = useCallback((terminalId: number) => {
    setSelectedTerminalId(terminalId);
    setTerminalChooserOpen(false);
  }, []);

  useEffect(() => {
    if (
      terminalChooserOpen ||
      !pendingTerminalPrintIntent ||
      !selectedTerminalId
    )
      return;
    const intent = pendingTerminalPrintIntent;
    setPendingTerminalPrintIntent(null);
    if (intent === "auto") {
      if (isPreBill && paymentQrs.length > 1 && !paymentQr) {
        setPendingQrPrintIntent("auto");
        setQrChooserOpen(true);
      } else if (isActiveVatEbilling && !isPreBill) {
        void runFiscalPrint();
      } else {
        void runAutoPrint();
      }
    } else {
      void handlePrint();
    }
  }, [
    handlePrint,
    isActiveVatEbilling,
    isPreBill,
    paymentQr,
    paymentQrs.length,
    pendingTerminalPrintIntent,
    runAutoPrint,
    runFiscalPrint,
    selectedTerminalId,
    terminalChooserOpen,
  ]);

  const selectPaymentQrForPrint = useCallback(
    (qr: ReceiptPaymentQr) => {
      const configId = qr.config_id?.trim();
      if (!configId) {
        toast.error(
          "This payment QR has no stable configuration ID. Save it again in Payment integrations before printing.",
        );
        return;
      }

      if (pendingQrPrintIntent === "auto") {
        autoPrintedOrderRef.current = orderId;
      }
      setPaymentQrConfigId(configId);
      setQrChooserOpen(false);

      const url = new URL(window.location.href);
      url.searchParams.set("paymentQrConfigId", configId);
      window.history.replaceState(window.history.state, "", url.toString());
    },
    [orderId, pendingQrPrintIntent],
  );

  useEffect(() => {
    if (qrChooserOpen || !pendingQrPrintIntent || !paymentQr) return;
    const intent = pendingQrPrintIntent;
    setPendingQrPrintIntent(null);
    if (intent === "auto") {
      void runAutoPrint();
    } else {
      void handlePrint(true);
    }
  }, [
    handlePrint,
    paymentQr,
    pendingQrPrintIntent,
    qrChooserOpen,
    runAutoPrint,
  ]);

  const handleShare = async () => {
    const url = window.location.href;
    const title = `Receipt - Order #${receipt?.order?.restaurant_order_id || orderId}`;

    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // User cancelled or error
      }
    } else {
      await navigator.clipboard.writeText(url);
      // Simple feedback
      const btn = document.getElementById("share-btn");
      if (btn) {
        btn.textContent = "Link Copied!";
        setTimeout(() => {
          btn.textContent = "Share";
        }, 2000);
      }
    }
  };

  const handleComplete = async () => {
    setCompleting(true);
    try {
      await apiClient.patch(OrderApis.updateOrderStatus(orderId), {
        status: "completed",
      });

      // Auto-complete parent order if this is a split bill and all siblings are completed
      try {
        const guestBillsRes = await apiClient.get(
          OrderApis.getGuestBills(orderId),
          { params: { _t: Date.now() } },
        );
        if (
          guestBillsRes.data.status === "success" &&
          guestBillsRes.data.data
        ) {
          const gb = guestBillsRes.data.data;
          const allCompleted = gb.orders.every((g: any) => {
            if (Number(g.order_id) === Number(orderId)) return true;
            return g.status === "completed";
          });

          if (allCompleted && gb.anchor_order_id) {
            const parentOrderRes = await apiClient.get(
              OrderApis.getOrder(gb.anchor_order_id),
            );
            if (
              parentOrderRes.data.status === "success" &&
              parentOrderRes.data.data.status !== "completed"
            ) {
              console.log("Auto-completing parent order:", gb.anchor_order_id);
              await apiClient.patch(
                OrderApis.updateOrderStatus(gb.anchor_order_id),
                { status: "completed" },
              );
            }
          }
        }
      } catch (gbErr) {
        console.warn(
          "Guest bills parent auto-complete check skipped or failed:",
          gbErr,
        );
      }

      toast.success("Order completed successfully!");
      if (returnTo) {
        router.push(returnTo);
      } else if (receipt?.order?.channel === "room_service") {
        router.push("/hotel");
      } else {
        router.push("/orders/active");
      }
    } catch (err: any) {
      console.error("Failed to complete order:", err);
      const detail =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Failed to complete order";
      toast.error(detail);
    } finally {
      setCompleting(false);
    }
  };

  const handleProcessRefund = async () => {
    const orderCreatedAt = receipt?.order?.created_at;
    if (!canRefundOrder(orderCreatedAt)) {
      if (!canProcessRefund) {
        setRefundError("You do not have permission to process refunds.");
      } else if (
        isOrderRefundHistorical(orderCreatedAt) &&
        !canApproveHistoricalRefund
      ) {
        setRefundError(
          "Historical refunds require billing.refund.approve permission.",
        );
      } else {
        setRefundError("You cannot process this refund.");
      }
      return;
    }

    const amount = parseFloat(refundAmount);
    if (!amount || amount <= 0) {
      setRefundError("Enter a valid refund amount.");
      return;
    }
    if (!refundReason.trim()) {
      setRefundError("A refund reason is required.");
      return;
    }
    if (receipt && amount > receipt.total_paid) {
      setRefundError("Refund amount cannot exceed total paid.");
      return;
    }

    setRefundSubmitting(true);
    setRefundError(null);
    try {
      await apiClient.post(OrderApis.refundOrder(orderId), {
        amount,
        reason: refundReason.trim(),
        reference: refundReference.trim() || undefined,
      });
      toast.success("Refund processed successfully.");
      setRefundOpen(false);
      setRefundAmount("");
      setRefundReason("");
      setRefundReference("");
      await fetchData();
    } catch (err: any) {
      setRefundError(
        err?.response?.data?.detail || "Failed to process refund.",
      );
    } finally {
      setRefundSubmitting(false);
    }
  };

  // ── Loading ──
  if (loading || fiscalProfileLoading) {
    return (
      <div className="flex flex-col gap-6 max-w-3xl mx-auto">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <Skeleton className="h-7 w-48" />
        </div>
        <Skeleton className="h-[600px] rounded-xl" />
      </div>
    );
  }

  // ── Error ──
  if (error && !receipt) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-destructive font-medium">{error}</p>
        <Button variant="outline" onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-2" /> Retry
        </Button>
      </div>
    );
  }

  if (fiscalProfileError) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-destructive font-medium">{fiscalProfileError}</p>
        <Button
          variant="outline"
          onClick={() =>
            void Promise.all([fetchData(), refreshFiscalProfile()])
          }
        >
          <RefreshCw className="h-4 w-4 mr-2" /> Retry
        </Button>
      </div>
    );
  }

  if (
    isActiveVatEbilling &&
    !isPreBill &&
    (fiscalDocumentLoading || !fiscalDocument)
  ) {
    if (fiscalDocumentError) {
      return (
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4 px-6 text-center">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <p className="max-w-lg text-destructive font-medium">
            {fiscalDocumentError}
          </p>
          <p className="max-w-lg text-sm text-muted-foreground">
            VAT e-billing is active, so the mutable legacy receipt cannot be
            printed as a fallback.
          </p>
          <Button
            variant="outline"
            onClick={() => void refreshFiscalDocument()}
          >
            <RefreshCw className="h-4 w-4 mr-2" /> Retry fiscal invoice
          </Button>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-6 max-w-3xl mx-auto">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <Skeleton className="h-7 w-48" />
        </div>
        <Skeleton className="h-[600px] rounded-xl" />
      </div>
    );
  }

  if (!receipt || !template) return null;

  const { order } = receipt;
  const orderLabel = order.table_name
    ? `${order.table_name} • #${order.restaurant_order_id || order.id}`
    : `Order #${order.restaurant_order_id || order.id}`;
  const mobileAppBarTitle = order.table_name
    ? /^table\b/i.test(order.table_name)
      ? order.table_name
      : `Table ${order.table_name}`
    : order.channel === "room_service"
      ? "Room delivery"
      : "Receipt";

  const orderCreatedAt = order.created_at;
  const refundIsHistorical = isOrderRefundHistorical(orderCreatedAt);
  const refundAllowed = canRefundOrder(orderCreatedAt);
  const showRefundAction =
    (receipt.total_paid || 0) > 0 &&
    (canProcessRefund || canApproveHistoricalRefund);

  const globalBlock = template.find((b) => b.type === "global_settings");
  const paperSize = globalBlock?.paper_size || "80mm";

  return (
    <>
      <ReceiptAppBarTitle title={mobileAppBarTitle} />
      {/* Print-only styles */}
      <style jsx global>{`
        @media print {
          @page {
            margin: 0;
            size: auto;
          }
          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          body * {
            visibility: hidden !important;
          }
          #receipt-printable-wrapper,
          #receipt-printable-wrapper * {
            visibility: visible !important;
          }
          #receipt-printable-wrapper {
            position: absolute !important;
            left: 50% !important;
            top: 0 !important;
            transform: translateX(-50%) !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="flex flex-col gap-6 max-w-3xl mx-auto pb-8 min-h-screen">
        {/* ── Header (no-print) ── */}
        <div className="flex items-center justify-between no-print px-4 pt-4">
          <div className="hidden items-center gap-4 md:flex">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (returnTo) router.push(returnTo);
                else if (receipt?.order?.channel === "room_service")
                  router.push("/hotel");
                else router.back();
              }}
              className="rounded-xl hover:bg-muted/50"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-black tracking-tight">Receipt</h1>
              <p className="text-sm text-muted-foreground">{orderLabel}</p>
            </div>
          </div>
        </div>

        {/* ── Fully Paid Banner ── */}
        {receipt.is_fully_paid && (
          <div className="mx-4 flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl no-print">
            <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <div>
              <p className="font-bold text-emerald-700 dark:text-emerald-300">
                Payment Complete
              </p>
              <p className="text-sm text-emerald-600/80 dark:text-emerald-400/80">
                This order has been fully paid. Total: Rs.{" "}
                {receipt.total_paid.toLocaleString()}
              </p>
            </div>
          </div>
        )}

        {/* ── Receipt Rendering (Thermal Slip) ── */}
        <div className="flex-1 flex items-start justify-center p-4 bg-muted/30 overflow-y-auto">
          <div
            ref={receiptRef}
            id={
              isActiveVatEbilling && !isPreBill
                ? undefined
                : "receipt-printable-wrapper"
            }
            className="shadow-2xl border border-border/40 bg-white"
          >
            {isActiveVatEbilling && !isPreBill && fiscalDocument ? (
              <FiscalReceipt
                document={lastAuthorization?.document ?? fiscalDocument}
                copyNumber={lastAuthorization?.copy_number}
                designation={lastAuthorization?.designation}
                preview={
                  lastAuthorization?.render_payload?.preview ??
                  fiscalDocument.render_preview
                }
              />
            ) : (
              <ThermalReceipt
                data={receipt}
                template={template}
                mode={isPreBill ? "bill" : "receipt"}
                printDesignation={ordinaryPrintDesignation}
                paymentQr={paymentQr}
              />
            )}
          </div>
        </div>
        {(fiscalPrintError || fiscalDocumentError) && (
          <p className="no-print px-4 text-sm text-destructive">
            {fiscalPrintError || fiscalDocumentError}
          </p>
        )}

        {/* Bottom Actions (no-print) */}
        <div className="flex flex-col sm:flex-row items-center gap-3 no-print px-4 pb-4">
          {showRefundAction && (
            <Button
              variant="outline"
              className="w-full sm:w-auto h-12 gap-2 rounded-xl font-bold text-rose-600 border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/20"
              disabled={!refundAllowed}
              onClick={() => {
                setRefundError(null);
                setRefundAmount(String(receipt.total_paid || ""));
                setRefundOpen(true);
              }}
            >
              <RotateCcw className="h-4 w-4" /> Process Refund
            </Button>
          )}
          {receipt.is_fully_paid && order.status !== "completed" && (
            <Button
              className="w-full h-12 text-base font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20 shadow-lg gap-2"
              onClick={handleComplete}
              disabled={completing}
            >
              {completing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              Complete Order
            </Button>
          )}
          <Button
            className="flex-1 w-full sm:w-auto h-12 text-base font-bold gap-2 rounded-xl shadow-lg"
            onClick={() => {
              if (returnTo) router.push(returnTo);
              else if (receipt?.order?.channel === "room_service")
                router.push("/hotel");
              else router.push("/orders/active");
            }}
          >
            <CheckCircle className="h-4 w-4" />{" "}
            {receipt?.order?.channel === "room_service"
              ? "Back to Hotel PMS"
              : "Back to Orders"}
          </Button>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              className="flex-1 h-12 gap-2 rounded-xl font-bold"
              onClick={() => void handlePrint()}
              disabled={fiscalPrinting}
            >
              {fiscalPrinting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Printer className="h-4 w-4" />
              )}
              {isPreBill
                ? "Print Pre-bill"
                : isActiveVatEbilling
                  ? "Print Tax Invoice"
                  : "Print Receipt"}
            </Button>
            <Button
              variant="outline"
              className="flex-1 h-12 gap-2 rounded-xl font-bold"
              onClick={handleShare}
            >
              <Share2 className="h-4 w-4" /> Share
            </Button>
          </div>
        </div>
      </div>

      <Dialog
        open={terminalChooserOpen}
        onOpenChange={(open) => {
          setTerminalChooserOpen(open);
          if (!open && !selectedTerminalId) {
            setPendingTerminalPrintIntent(null);
            setAutoPrintRequested(false);
          }
        }}
      >
        <DialogContent className="max-w-md gap-0 p-0">
          <DialogHeader className="border-b px-5 py-4 text-left">
            <DialogTitle>Select receipt terminal</DialogTitle>
            <DialogDescription>
              Choose the work location whose printer should receive this
              document.
            </DialogDescription>
          </DialogHeader>
          <div className="divide-y p-2">
            {receiptTerminals.map((terminal) => (
              <button
                key={terminal.id}
                type="button"
                onClick={() => selectReceiptTerminal(terminal.id)}
                className="flex min-h-14 w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Printer className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{terminal.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {terminal.printer?.name || "Receipt printer"}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={qrChooserOpen}
        onOpenChange={(open) => {
          setQrChooserOpen(open);
          if (!open) {
            if (pendingQrPrintIntent === "auto") {
              setAutoPrintRequested(false);
            }
            setPendingQrPrintIntent(null);
          }
        }}
      >
        <DialogContent className="max-w-md gap-0 p-0">
          <DialogHeader className="border-b px-5 py-4 text-left">
            <DialogTitle>Select payment QR</DialogTitle>
            <DialogDescription>
              Choose the QR that should appear on this pre-bill.
            </DialogDescription>
          </DialogHeader>
          <div className="divide-y px-2 py-2">
            {paymentQrs.map((qr) => {
              const selectable = Boolean(qr.config_id?.trim());
              return (
                <button
                  key={qr.config_id || `${qr.name}:${qr.payload}`}
                  type="button"
                  disabled={!selectable}
                  onClick={() => selectPaymentQrForPrint(qr)}
                  className="flex min-h-14 w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Smartphone className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      {qr.name || "Payment QR"}
                    </span>
                    {!selectable && (
                      <span className="block text-xs text-muted-foreground">
                        Save this QR again before printing
                      </span>
                    )}
                  </span>
                  {paymentQrConfigId === qr.config_id && (
                    <CheckCircle className="h-4 w-4 text-primary" />
                  )}
                </button>
              );
            })}
          </div>
          <DialogFooter className="border-t px-5 py-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (pendingQrPrintIntent === "auto") {
                  setAutoPrintRequested(false);
                }
                setPendingQrPrintIntent(null);
                setQrChooserOpen(false);
              }}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Process Refund</DialogTitle>
            <DialogDescription>
              {refundIsHistorical
                ? "This order is outside the standard refund window and requires historical refund approval."
                : "Issue a refund for today's transaction."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {refundError && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium">
                {refundError}
              </div>
            )}

            {!refundAllowed && (
              <div className="p-3 rounded-lg bg-muted text-sm">
                {!canProcessRefund
                  ? "You need billing.refund.process to issue refunds."
                  : "You need billing.refund.approve for historical refunds."}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="refund-amount">Refund Amount</Label>
              <Input
                id="refund-amount"
                type="number"
                min="0"
                step="0.01"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                disabled={!refundAllowed}
              />
              <p className="text-xs text-muted-foreground">
                Maximum refundable: {formatCurrency(receipt.total_paid || 0)}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="refund-reason">Reason</Label>
              <Input
                id="refund-reason"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Reason for refund"
                disabled={!refundAllowed}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="refund-reference">Reference (optional)</Label>
              <Input
                id="refund-reference"
                value={refundReference}
                onChange={(e) => setRefundReference(e.target.value)}
                placeholder="Receipt or transaction reference"
                disabled={!refundAllowed}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleProcessRefund}
              disabled={refundSubmitting || !refundAllowed}
              className="gap-2"
            >
              {refundSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              {refundSubmitting ? "Processing..." : "Confirm Refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
