"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  FileText,
  Loader2,
  Printer,
  ReceiptText,
  Share2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { FiscalReceipt } from "@/components/receipts/fiscal-receipt";
import { ThermalReceipt } from "@/components/receipts/thermal-receipt";
import { salesReturnDetail } from "@/components/finance/transaction-detail/sales-return-detail";
import { TransactionDetailSheet } from "@/components/finance/transaction-detail/transaction-detail-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { useFiscalPrint } from "@/hooks/use-fiscal-print";
import { useFiscalProfile } from "@/hooks/use-fiscal-profile";
import { useOrderFiscalDocument } from "@/hooks/use-order-fiscal-document";
import apiClient from "@/lib/api-client";
import { OrderApis, ReceiptApis, RestaurantApis } from "@/lib/api/endpoints";
import { financeSalesApi } from "@/lib/api/finance-sales-api";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import type {
  FinanceSalesDocument,
  FinanceSalesDocumentSettlement,
} from "@/types/finance-sales";
import type { OrderEvent, ReceiptData } from "@/types/order";

const DEFAULT_RECEIPT_TEMPLATE = [
  {
    type: "global_settings",
    id: "metadata",
    global_font_type: "A",
    global_font_size: 11,
    line_spacing: 1.4,
    paper_size: "80mm",
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

type Props = {
  document?: FinanceSalesDocument | null;
  orderId?: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const money = formatCurrency;

function readableDate(value: string | null | undefined, includeTime = false) {
  if (!value) return "Not recorded";
  return includeTime ? formatDateTime(value) : formatDate(value);
}

function words(value: string | null | undefined) {
  return (value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function saleStatusLabel(value: string) {
  const labels: Record<string, string> = {
    customer_credit: "Customer credit",
    paid: "Paid",
    partially_paid: "Partially paid",
    partially_returned: "Partially returned",
    pending: "Pending",
    returned: "Returned",
    unpaid: "Unpaid",
  };
  return labels[value.trim().toLowerCase()] || "Recorded";
}

function settlementTone(status: string) {
  if (status === "paid")
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300";
  if (status === "returned")
    return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-300";
  if (status === "partially_returned")
    return "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/70 dark:bg-orange-950/40 dark:text-orange-300";
  if (status === "partially_paid")
    return "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/70 dark:bg-orange-950/40 dark:text-orange-300";
  return "border-border bg-muted text-muted-foreground";
}

export function SalesDocumentDetailSheet({
  document,
  orderId,
  open,
  onOpenChange,
}: Props) {
  const restaurantId = useAuth((state) => state.user?.restaurant_id);
  const [resolvedDocument, setResolvedDocument] =
    useState<FinanceSalesDocument | null>(document ?? null);
  const [settlement, setSettlement] =
    useState<FinanceSalesDocumentSettlement | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [returns, setReturns] = useState<FinanceSalesDocument[]>([]);
  const [selectedReturn, setSelectedReturn] =
    useState<FinanceSalesDocument | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [template, setTemplate] = useState<any[]>(DEFAULT_RECEIPT_TEMPLATE);
  const [loadingDocument, setLoadingDocument] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (document) {
      setResolvedDocument(document);
      return;
    }
    if (!orderId || !restaurantId) {
      setResolvedDocument(null);
      return;
    }

    let active = true;
    setLoadingDocument(true);
    setError(null);
    void financeSalesApi
      .getByOrder(Number(restaurantId), orderId)
      .then((response) => {
        if (active) setResolvedDocument(response);
      })
      .catch((requestError: any) => {
        if (active) {
          setError(
            requestError?.response?.data?.detail ||
              requestError?.message ||
              "This completed sale could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (active) setLoadingDocument(false);
      });

    return () => {
      active = false;
    };
  }, [document, open, orderId, restaurantId]);

  const sourceOrderId = useMemo(() => {
    if (orderId) return orderId;
    if (
      resolvedDocument?.source_type === "pos_order" &&
      resolvedDocument.source_id
    ) {
      return Number(resolvedDocument.source_id);
    }
    return 0;
  }, [orderId, resolvedDocument]);

  useEffect(() => {
    if (!open || !resolvedDocument) return;
    let active = true;
    setLoadingDetail(true);
    setError(null);
    setSettlement(null);
    setReceipt(null);
    setEvents([]);
    setReturns([]);

    const receiptRequest = sourceOrderId
      ? apiClient.get(ReceiptApis.getReceiptData(sourceOrderId))
      : Promise.resolve(null);
    const eventsRequest = sourceOrderId
      ? apiClient.get(OrderApis.getOrderEvents(sourceOrderId, "group"))
      : Promise.resolve(null);
    const returnsRequest = financeSalesApi.list(
      resolvedDocument.restaurant_id,
      {
        kind: "credit_note",
        customer_id: resolvedDocument.customer_id || undefined,
        limit: 250,
      },
    );

    void Promise.allSettled([
      financeSalesApi.getSettlement(
        resolvedDocument.restaurant_id,
        resolvedDocument.id,
      ),
      receiptRequest,
      eventsRequest,
      returnsRequest,
    ]).then(
      async ([
        settlementResult,
        receiptResult,
        eventsResult,
        returnsResult,
      ]) => {
        if (!active) return;

        if (settlementResult.status === "fulfilled") {
          setSettlement(settlementResult.value);
        } else {
          setSettlement(null);
          setError("Settlement details are temporarily unavailable.");
        }

        if (
          receiptResult.status === "fulfilled" &&
          receiptResult.value?.data?.status === "success"
        ) {
          const receiptData = receiptResult.value.data.data as ReceiptData;
          setReceipt(receiptData);
          const templateRestaurantId =
            receiptData.restaurant?.id || resolvedDocument.restaurant_id;
          try {
            const templateResponse = await apiClient.get(
              RestaurantApis.getTemplates(templateRestaurantId),
            );
            const savedTemplate = templateResponse.data?.data?.receipt_template;
            if (
              active &&
              Array.isArray(savedTemplate) &&
              savedTemplate.length > 0
            ) {
              setTemplate(savedTemplate);
            }
          } catch {
            if (active) setTemplate(DEFAULT_RECEIPT_TEMPLATE);
          }
        } else {
          setReceipt(null);
        }

        if (
          eventsResult.status === "fulfilled" &&
          eventsResult.value?.data?.status === "success"
        ) {
          setEvents((eventsResult.value.data.data as OrderEvent[]) || []);
        } else {
          setEvents([]);
        }

        if (returnsResult.status === "fulfilled") {
          setReturns(
            returnsResult.value.documents.filter(
              (item) => item.original_document_id === resolvedDocument.id,
            ),
          );
        } else {
          setReturns([]);
        }

        if (active) setLoadingDetail(false);
      },
    );

    return () => {
      active = false;
    };
  }, [open, resolvedDocument, sourceOrderId]);

  const {
    isActiveVatEbilling,
    loading: fiscalProfileLoading,
    error: fiscalProfileError,
    refresh: refreshFiscalProfile,
  } = useFiscalProfile(open && Boolean(sourceOrderId));
  const {
    document: fiscalDocument,
    loading: fiscalDocumentLoading,
    error: fiscalDocumentError,
    refresh: refreshFiscalDocument,
  } = useOrderFiscalDocument({
    orderId: sourceOrderId,
    enabled: open && Boolean(receipt) && isActiveVatEbilling,
  });
  const {
    print: printFiscalDocument,
    printing: fiscalPrinting,
    error: fiscalPrintError,
    lastAuthorization,
  } = useFiscalPrint(fiscalDocument);

  const printReceipt = useCallback(async () => {
    if (!receipt) return;
    if (fiscalProfileError) {
      toast.error(fiscalProfileError);
      return;
    }
    if (!isActiveVatEbilling) {
      window.print();
      return;
    }
    if (!fiscalDocument) {
      toast.error(
        fiscalDocumentError || "The fiscal tax invoice is not ready.",
      );
      return;
    }
    try {
      await printFiscalDocument({
        authorizationInput: { device_identifier: "web-sale-detail" },
        dispatch: async () => {
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          );
          window.print();
        },
      });
      toast.success("Fiscal print result recorded.");
    } catch (printError) {
      toast.error(
        printError instanceof Error
          ? printError.message
          : "Fiscal printing failed.",
      );
    }
  }, [
    fiscalDocument,
    fiscalDocumentError,
    fiscalProfileError,
    isActiveVatEbilling,
    printFiscalDocument,
    receipt,
  ]);

  const shareSale = useCallback(async () => {
    if (!resolvedDocument) return;
    const text = `${resolvedDocument.document_number} · ${money(resolvedDocument.grand_total)}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Sale ${resolvedDocument.document_number}`,
          text,
        });
      } else {
        await navigator.clipboard.writeText(text);
        toast.success("Sale details copied.");
      }
    } catch (shareError) {
      if ((shareError as Error)?.name !== "AbortError")
        toast.error("Could not share this sale.");
    }
  }, [resolvedDocument]);

  const refresh = useCallback(() => {
    if (document) setResolvedDocument({ ...document });
    else if (orderId && restaurantId) {
      setLoadingDocument(true);
      void financeSalesApi
        .getByOrder(Number(restaurantId), orderId)
        .then(setResolvedDocument)
        .finally(() => setLoadingDocument(false));
    }
    void refreshFiscalProfile();
    if (isActiveVatEbilling) void refreshFiscalDocument();
  }, [
    document,
    isActiveVatEbilling,
    orderId,
    refreshFiscalDocument,
    refreshFiscalProfile,
    restaurantId,
  ]);

  const status =
    settlement?.settlement_status ||
    resolvedDocument?.settlement_status ||
    "unpaid";
  const totalReturned = returns.reduce(
    (sum, item) => sum + Math.abs(Number(item.grand_total)),
    0,
  );
  const returned = Number(settlement?.amount_returned ?? totalReturned);
  const balanceDue = Number(
    settlement?.balance_due ?? resolvedDocument?.grand_total ?? 0,
  );
  const loading = loadingDocument || (loadingDetail && !settlement);

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setSelectedReturn(null);
            setShowReceipt(false);
          }
          onOpenChange(nextOpen);
        }}
      >
        <style jsx global>{`
          @media print {
            body * {
              visibility: hidden !important;
            }
            .thermal-receipt,
            .thermal-receipt * {
              visibility: visible !important;
            }
            .thermal-receipt {
              position: absolute !important;
              left: 50% !important;
              top: 0 !important;
              transform: translateX(-50%) !important;
              box-shadow: none !important;
              border: 0 !important;
            }
          }
        `}</style>
        <SheetContent className="flex h-dvh w-full flex-col gap-0 overflow-hidden p-0 sm:h-auto sm:max-w-3xl lg:max-w-[860px] print:w-full print:max-w-none print:border-0 print:shadow-none">
          <SheetHeader className="sticky top-0 z-10 shrink-0 border-b border-border bg-background px-4 py-4 pr-12 text-left sm:px-6 sm:py-5 print:hidden">
            <div className="hidden">
              <div className="flex h-14 items-center border-b px-4 pr-12">
                <SheetTitle className="text-lg font-semibold">
                  Sale details
                </SheetTitle>
              </div>
              <div className="space-y-4 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <SheetTitle className="text-xl font-semibold tracking-tight">
                    {resolvedDocument
                      ? `Sale ${resolvedDocument.document_number}`
                      : "Sale details"}
                  </SheetTitle>
                  {resolvedDocument ? (
                    <Badge variant="outline" className={settlementTone(status)}>
                      {saleStatusLabel(status)}
                    </Badge>
                  ) : null}
                </div>
                <SheetDescription className="space-y-0.5 text-sm">
                  <span className="block font-medium text-foreground">
                    {resolvedDocument?.customer_name ||
                      receipt?.order?.customer_name ||
                      "Walk-in customer"}
                  </span>
                  <span className="block">
                    {resolvedDocument
                      ? readableDate(resolvedDocument.created_at, true)
                      : ""}
                  </span>
                </SheetDescription>
                <div>
                  <p className="text-3xl font-semibold tracking-tight tabular-nums text-foreground">
                    {resolvedDocument
                      ? money(resolvedDocument.grand_total)
                      : "—"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Sale total
                  </p>
                </div>
                {receipt?.order?.table_name ||
                resolvedDocument?.daily_order_number ||
                resolvedDocument?.fiscal_document_number ? (
                  <p className="text-xs text-muted-foreground">
                    {[
                      receipt?.order?.table_name,
                      resolvedDocument?.daily_order_number
                        ? `Order #${resolvedDocument.daily_order_number}`
                        : null,
                      resolvedDocument?.fiscal_document_number
                        ? `Invoice #${resolvedDocument.fiscal_document_number}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">
                  Sale
                </p>
                <SheetTitle className="mt-1 break-words text-xl font-semibold leading-tight tracking-tight sm:text-2xl">
                  {resolvedDocument
                    ? `Sale ${resolvedDocument.document_number}`
                    : "Sale details"}
                </SheetTitle>
                <SheetDescription className="mt-2 max-w-xl text-sm leading-5">
                  {resolvedDocument?.customer_name ||
                    receipt?.order?.customer_name ||
                    "Walk-in customer"}
                  {resolvedDocument?.daily_order_number
                    ? `· Daily order #${resolvedDocument.daily_order_number}`
                    : null}
                  {resolvedDocument?.fiscal_document_number
                    ? `· Fiscal invoice #${resolvedDocument.fiscal_document_number}`
                    : null}
                  {resolvedDocument
                    ? `· ${readableDate(resolvedDocument.created_at, true)}`
                    : null}
                </SheetDescription>
              </div>

              <div className="flex shrink-0 flex-wrap items-start gap-2">
                <div className="border-t border-border pt-3 sm:min-w-40 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0 sm:text-right">
                  <p className="text-[11px] font-medium text-muted-foreground">
                    Sale total
                  </p>
                  <p className="mt-1 whitespace-nowrap text-2xl font-semibold tracking-tight tabular-nums text-foreground">
                    {resolvedDocument
                      ? money(resolvedDocument.grand_total)
                      : "—"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => void printReceipt()}
                  disabled={
                    !receipt ||
                    fiscalProfileLoading ||
                    fiscalPrinting ||
                    (isActiveVatEbilling && !fiscalDocument)
                  }
                >
                  {fiscalPrinting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Printer className="mr-2 h-4 w-4" />
                  )}
                  Print receipt
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void shareSale()}
                  disabled={!resolvedDocument}
                  aria-label="Share sale"
                >
                  <Share2 className="mr-1.5 h-4 w-4" />
                  Share
                </Button>
              </div>
            </div>
            {resolvedDocument ? (
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {readableDate(resolvedDocument.created_at, true)}
                </span>
                {resolvedDocument.daily_order_number ? (
                  <span>
                    Daily order #{resolvedDocument.daily_order_number}
                  </span>
                ) : null}
                {resolvedDocument.fiscal_document_number ? (
                  <span>
                    Fiscal invoice #{resolvedDocument.fiscal_document_number}
                  </span>
                ) : null}
                <Badge variant="outline" className={settlementTone(status)}>
                  {saleStatusLabel(status)}
                </Badge>
              </div>
            ) : null}
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto bg-background">
            {loading ? (
              <div className="flex min-h-[420px] items-center justify-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                Loading the complete sale record…
              </div>
            ) : error && !resolvedDocument ? (
              <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 px-6 text-center">
                <AlertCircle className="h-8 w-8 text-rose-500" />
                <p className="font-medium text-foreground">{error}</p>
                <Button variant="outline" onClick={refresh}>
                  Try again
                </Button>
              </div>
            ) : resolvedDocument ? (
              <div className="min-h-full">
                <section className="hidden border-b bg-muted/60 p-5 lg:border-b-0 lg:border-r lg:p-7 print:border-0 print:bg-white print:p-0">
                  <div className="mb-4 flex items-center justify-between print:hidden">
                    <div>
                      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <ReceiptText className="h-4 w-4 text-primary" />
                        {isActiveVatEbilling ? "Tax invoice" : "Bill"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {isActiveVatEbilling
                          ? "The legal fiscal invoice for this sale."
                          : "The printable bill for this sale."}
                      </p>
                    </div>
                    {resolvedDocument.fiscal_document_number && (
                      <Badge variant="outline">
                        Fiscal invoice #
                        {resolvedDocument.fiscal_document_number}
                      </Badge>
                    )}
                  </div>

                  {fiscalProfileLoading ||
                  (isActiveVatEbilling && fiscalDocumentLoading) ? (
                    <div className="flex h-72 items-center justify-center rounded-xl border bg-card text-sm text-muted-foreground">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                      Preparing receipt…
                    </div>
                  ) : fiscalProfileError || fiscalDocumentError ? (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
                      <p className="font-medium">Receipt unavailable</p>
                      <p className="mt-1">
                        {fiscalProfileError || fiscalDocumentError}
                      </p>
                      <Button
                        className="mt-4"
                        size="sm"
                        variant="outline"
                        onClick={refresh}
                      >
                        Retry
                      </Button>
                    </div>
                  ) : isActiveVatEbilling && fiscalDocument ? (
                    <div className="flex justify-center overflow-hidden rounded-xl border bg-white shadow-sm">
                      <FiscalReceipt
                        document={lastAuthorization?.document ?? fiscalDocument}
                        copyNumber={lastAuthorization?.copy_number}
                        designation={lastAuthorization?.designation}
                      />
                    </div>
                  ) : receipt ? (
                    <div
                      id="receipt-content"
                      className="flex justify-center overflow-hidden rounded-xl border bg-white shadow-sm"
                    >
                      <ThermalReceipt data={receipt} template={template} />
                    </div>
                  ) : (
                    <InvoiceSummary document={resolvedDocument} />
                  )}

                  {(fiscalPrintError || error) && (
                    <p className="mt-3 text-xs text-rose-600 print:hidden">
                      {fiscalPrintError || error}
                    </p>
                  )}
                </section>

                <section className="print:hidden">
                  <DetailSection title="Fiscal invoice">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {resolvedDocument.fiscal_document_number
                            ? `Invoice #${resolvedDocument.fiscal_document_number}`
                            : "Invoice not issued"}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {isActiveVatEbilling
                            ? fiscalDocument
                              ? "Fiscal document ready for viewing and print."
                              : fiscalDocumentError ||
                                "Fiscal document is being prepared."
                            : "Printable sale receipt."}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowReceipt(true)}
                          disabled={!receipt && !fiscalDocument}
                        >
                          View receipt
                        </Button>
                      </div>
                    </div>
                  </DetailSection>
                  <DetailSection title="Order overview">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Fact
                        icon={<UserRound className="h-4 w-4" />}
                        label="Customer"
                        value={
                          resolvedDocument.customer_name ||
                          receipt?.order?.customer_name ||
                          "Walk-in customer"
                        }
                      />
                      <Fact
                        icon={<CalendarDays className="h-4 w-4" />}
                        label="Business date"
                        value={readableDate(resolvedDocument.business_date)}
                      />
                      <Fact
                        label="Order type"
                        value={
                          receipt?.order?.channel
                            ? words(receipt.order.channel)
                            : resolvedDocument.source_type === "pos_order"
                              ? "POS order"
                              : "Manual sale"
                        }
                      />
                      <Fact
                        label="Table / service"
                        value={receipt?.order?.table_name || "Not applicable"}
                      />
                    </div>
                  </DetailSection>

                  <DetailSection title="Items sold">
                    <p className="mb-3 text-xs leading-5 text-muted-foreground">
                      Items and quantities recorded on this sale.
                    </p>
                    {resolvedDocument.lines.length ? (
                      <>
                        <div className="divide-y divide-border border-y border-border sm:hidden">
                          {resolvedDocument.lines.map((line) => (
                            <div key={line.id} className="space-y-1.5 py-3">
                              <div className="flex items-start justify-between gap-4">
                                <p className="min-w-0 text-sm font-medium text-foreground">
                                  {line.item_name}
                                </p>
                                <p className="shrink-0 text-sm font-medium tabular-nums text-foreground">
                                  {money(line.line_total)}
                                </p>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {line.quantity} × {money(line.unit_price)}
                              </p>
                            </div>
                          ))}
                        </div>
                        <div className="hidden overflow-x-auto border-y border-border sm:block">
                          <table className="w-full min-w-[560px] text-sm">
                            <thead className="border-b border-border bg-muted/50 text-left text-[11px] font-medium text-muted-foreground">
                              <tr>
                                <th className="px-3 py-2.5">Item</th>
                                <th className="px-3 py-2.5 text-right">
                                  Quantity
                                </th>
                                <th className="px-3 py-2.5 text-right">
                                  Unit price
                                </th>
                                <th className="px-3 py-2.5 text-right">
                                  Amount
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {resolvedDocument.lines.map((line) => (
                                <tr key={line.id}>
                                  <td className="px-3 py-3 font-medium text-foreground">
                                    {line.item_name}
                                  </td>
                                  <td className="px-3 py-3 text-right tabular-nums">
                                    {line.quantity}
                                  </td>
                                  <td className="px-3 py-3 text-right tabular-nums">
                                    {money(line.unit_price)}
                                  </td>
                                  <td className="px-3 py-3 text-right font-medium tabular-nums">
                                    {money(line.line_total)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    ) : (
                      <EmptyLine text="No item detail was returned for this sale." />
                    )}
                  </DetailSection>

                  <DetailSection title="Settlement">
                    <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
                      <Metric
                        label="Sale total"
                        value={money(resolvedDocument.grand_total)}
                      />
                      <Metric
                        label="Collected"
                        value={money(settlement?.amount_received)}
                        tone="positive"
                      />
                      <Metric
                        label="Returned"
                        value={money(returned)}
                        tone={returned > 0 ? "warning" : "default"}
                      />
                      <Metric
                        label="Balance due"
                        value={money(balanceDue)}
                        tone={balanceDue > 0 ? "warning" : "default"}
                      />
                    </div>

                    <div className="mt-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        Original payments
                      </p>
                      {settlement?.payments.length ? (
                        <div className="divide-y divide-border border-y border-border">
                          {settlement.payments.map((payment, index) => (
                            <div
                              key={`${payment.received_at}-${index}`}
                              className="flex items-center justify-between gap-4 py-3"
                            >
                              <div>
                                <p className="text-sm font-medium text-foreground">
                                  {words(payment.payment_method || "Payment")}
                                </p>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  {readableDate(payment.received_at, true)}
                                </p>
                              </div>
                              <p className="text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                                {money(payment.amount)}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <EmptyLine
                          text={
                            Number(settlement?.amount_received ?? 0) > 0
                              ? "The original payment was recorded without an itemized payment entry."
                              : "No payment was received for this sale."
                          }
                        />
                      )}
                    </div>
                  </DetailSection>

                  {returns.length > 0 && (
                    <DetailSection title="Returns & refunds">
                      <div className="divide-y divide-border border-y border-border">
                        {returns.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setSelectedReturn(item)}
                            className="flex w-full items-center justify-between gap-4 py-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                            aria-label={`Open sales return ${item.document_number}`}
                          >
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {item.document_number}
                              </p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {item.settlement_status === "refunded"
                                  ? "Refund issued"
                                  : "Credit note"}
                                {item.reason ? ` · ${item.reason}` : ""} ·{" "}
                                {readableDate(item.created_at, true)}
                              </p>
                            </div>
                            <p className="text-sm font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                              − {money(Math.abs(Number(item.grand_total)))}
                            </p>
                          </button>
                        ))}
                      </div>
                      <p className="mt-3 text-right text-xs font-medium text-muted-foreground">
                        Total returned: {money(totalReturned)}
                      </p>
                    </DetailSection>
                  )}

                  <DetailSection title="Activity">
                    {events.length ? (
                      <div className="space-y-0">
                        {events.map((event, index) => (
                          <div
                            key={event.id}
                            className="relative grid grid-cols-[28px_minmax(0,1fr)] gap-3 pb-5 last:pb-0"
                          >
                            {index < events.length - 1 && (
                              <span className="absolute left-[13px] top-7 h-[calc(100%-16px)] w-px bg-border" />
                            )}
                            <span className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-primary">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </span>
                            <div className="pt-0.5">
                              <p className="text-sm font-medium text-foreground">
                                {event.title || words(event.event)}
                              </p>
                              {event.result && (
                                <p className="mt-0.5 text-sm text-muted-foreground">
                                  {event.result}
                                </p>
                              )}
                              <p className="mt-1 text-xs text-muted-foreground">
                                {[
                                  event.triggered_by?.name,
                                  readableDate(event.triggered_at, true),
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyLine text="No order activity is available for this sale." />
                    )}
                  </DetailSection>
                </section>
              </div>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
      <Sheet open={showReceipt} onOpenChange={setShowReceipt}>
        <SheetContent className="flex h-dvh w-full flex-col gap-0 overflow-hidden p-0 sm:h-[90vh] sm:max-w-2xl">
          <SheetHeader className="shrink-0 border-b bg-background px-4 py-4 pr-12 text-left sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <SheetTitle className="text-lg">Receipt</SheetTitle>
                <SheetDescription className="mt-0.5 truncate text-xs">
                  {resolvedDocument?.fiscal_document_number
                    ? `Tax invoice #${resolvedDocument.fiscal_document_number}`
                    : resolvedDocument?.document_number || "Sale receipt"}
                </SheetDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mr-7 shrink-0"
                onClick={() => void printReceipt()}
                disabled={
                  !receipt ||
                  fiscalProfileLoading ||
                  fiscalPrinting ||
                  (isActiveVatEbilling && !fiscalDocument)
                }
              >
                <Printer className="mr-1.5 h-3.5 w-3.5" />
                Print
              </Button>
            </div>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto bg-muted p-4 sm:p-6">
            <div className="mx-auto w-full max-w-md overflow-hidden rounded-lg border bg-card">
              {isActiveVatEbilling && fiscalDocument ? (
                <FiscalReceipt
                  document={lastAuthorization?.document ?? fiscalDocument}
                  copyNumber={lastAuthorization?.copy_number}
                  designation={lastAuthorization?.designation}
                />
              ) : receipt ? (
                <ThermalReceipt data={receipt} template={template} />
              ) : resolvedDocument ? (
                <InvoiceSummary document={resolvedDocument} />
              ) : null}
            </div>
          </div>
        </SheetContent>
      </Sheet>
      <TransactionDetailSheet
        open={selectedReturn != null}
        onOpenChange={(nextOpen) => !nextOpen && setSelectedReturn(null)}
        detail={
          selectedReturn
            ? salesReturnDetail(selectedReturn, resolvedDocument ?? undefined)
            : null
        }
      />
    </>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-border px-4 py-4 last:border-b-0 sm:px-6 sm:py-5">
      <h3 className="mb-3 text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

function Fact({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 border-l border-border pl-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-medium text-foreground">
        {value}
      </p>
    </div>
  );
}

function Metric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "positive" | "warning";
}) {
  return (
    <div className="border-l border-border pl-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p
        className={`mt-1 text-sm font-semibold tabular-nums ${tone === "positive" ? "text-emerald-700 dark:text-emerald-400" : tone === "warning" ? "text-orange-700 dark:text-orange-400" : "text-foreground"}`}
      >
        {value}
      </p>
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground">{text}</p>;
}

function InvoiceSummary({ document }: { document: FinanceSalesDocument }) {
  return (
    <article className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="border-b px-5 py-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <FileText className="h-4 w-4 text-primary" />
          {document.document_number}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {readableDate(document.business_date)} ·{" "}
          {document.customer_name || "Walk-in customer"}
        </p>
      </div>
      <div className="divide-y">
        {document.lines.map((line) => (
          <div
            key={line.id}
            className="grid grid-cols-[minmax(0,1fr)_48px_92px] gap-3 px-5 py-3 text-sm"
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">
                {line.item_name}
              </p>
              <p className="text-xs text-muted-foreground">
                {money(line.unit_price)} each
              </p>
            </div>
            <p className="text-right tabular-nums text-muted-foreground">
              ×{Number(line.quantity)}
            </p>
            <p className="text-right font-medium tabular-nums text-foreground">
              {money(line.line_total)}
            </p>
          </div>
        ))}
      </div>
      <div className="space-y-2 border-t bg-muted/50 px-5 py-4 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>Subtotal</span>
          <span>{money(document.subtotal)}</span>
        </div>
        {Number(document.discount_total) > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <span>Discount</span>
            <span>− {money(document.discount_total)}</span>
          </div>
        )}
        <div className="flex justify-between text-muted-foreground">
          <span>Tax</span>
          <span>{money(document.tax_total)}</span>
        </div>
        <div className="flex justify-between border-t pt-2 font-semibold text-foreground">
          <span>Total</span>
          <span>{money(document.grand_total)}</span>
        </div>
      </div>
    </article>
  );
}
