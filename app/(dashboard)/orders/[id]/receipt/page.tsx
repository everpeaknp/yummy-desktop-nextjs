"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import apiClient from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { ReceiptApis, OrderApis, PrinterApis } from "@/lib/api/endpoints";
import { useOrderFull } from "@/hooks/use-order-full";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
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
} from "lucide-react";
import type { ReceiptData, OrderItem, OrderPayment } from "@/types/order";
import { ThermalReceipt } from "@/components/receipts/thermal-receipt";
import { RestaurantApis } from "@/lib/api/endpoints";

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
    { type: 'global_settings', id: 'metadata', global_font_type: 'A', global_font_size: 12, line_spacing: 1.2, paper_size: '80mm', column_capacity: 42 },
    { id: '1', type: 'header', is_visible: true, show_on_bill: true, show_on_receipt: true },
    { id: '2', type: 'bill_info', is_visible: true, show_on_bill: true, show_on_receipt: true },
    { id: '3', type: 'customer', is_visible: true, show_on_bill: true, show_on_receipt: true },
    { id: '4', type: 'items', is_visible: true, show_on_bill: true, show_on_receipt: true },
    { id: '5', type: 'totals', is_visible: true, show_on_bill: true, show_on_receipt: true },
    { id: '6', type: 'payments', is_visible: true, show_on_bill: false, show_on_receipt: true },
    { id: '7', type: 'footer', is_visible: true, show_on_bill: true, show_on_receipt: true },
  ];
}

function buildReceiptRawPayload(receipt: ReceiptData, template: any[], orderId: number): string {
  const order = receipt?.order as any;
  const restaurant = receipt?.restaurant as any;
  const blocks = (template || [])
    .filter((b: any) => b?.type !== "global_settings")
    .map((b: any) => ({ ...b, cfg: b?.config ? { ...b, ...b.config } : b }))
    .filter((b: any) => (b?.is_visible ?? b?.isVisible ?? true) && (b?.show_on_receipt ?? b?.showOnReceipt ?? true));

  const lines: string[] = [];

  const header = blocks.find((b: any) => b.type === "header")?.cfg || {};
  lines.push(String(header.title || restaurant?.name || "YUMMY RECEIPT"));
  if (header.show_address !== false && restaurant?.address) lines.push(String(restaurant.address));
  if (header.show_phone !== false && restaurant?.phone) lines.push(`${header.phone_label || "Contact"}: ${restaurant.phone}`);

  lines.push("---------------------------");
  lines.push(`Order: #${order?.restaurant_order_id || order?.id || orderId}`);
  lines.push(`Table: ${order?.table_name || "-"}`);
  lines.push(`Date: ${new Date(order?.created_at || Date.now()).toLocaleString()}`);
  lines.push("---------------------------");

  const itemsCfg = blocks.find((b: any) => b.type === "items")?.cfg || {};
  const showRate = itemsCfg.show_rate !== false;
  const orderItems = Array.isArray(order?.items) ? order.items : [];
  orderItems.forEach((item: any, idx: number) => {
    const name = item?.name_snapshot || item?.item_name || "Item";
    const qty = Number(item?.qty ?? 1);
    const rate = Number(item?.unit_price ?? 0);
    const amount = Number(item?.line_total ?? rate * qty);
    if (showRate) {
      lines.push(`${idx + 1}. ${name} x${qty} @${rate.toFixed(2)} = ${amount.toFixed(2)}`);
    } else {
      lines.push(`${idx + 1}. ${name} x${qty}`);
    }
  });

  lines.push("---------------------------");
  const totalsCfg = blocks.find((b: any) => b.type === "totals")?.cfg || {};
  const subtotal = Number(order?.subtotal ?? 0);
  const tax = Number(order?.tax_total ?? 0);
  const total = Number(order?.grand_total ?? 0);
  const serviceCharge = Number(order?.service_charge ?? 0);
  const computedDiscount = Math.max(0, Number((subtotal + tax + serviceCharge - total).toFixed(2)));
  const loyaltyPointsRedeemed =
    Number(order?.loyalty_points_redeemed ?? order?.redeemed_points ?? order?.points_redeemed ?? 0) || 0;
  const discountReason =
    order?.discount_reason ||
    order?.manual_discount_reason ||
    order?.discount_note ||
    order?.discount_code ||
    (loyaltyPointsRedeemed > 0 ? `Loyalty Points - ${order?.customer_name || "Customer"} (${loyaltyPointsRedeemed} pts)` : null) ||
    (Number(order?.manual_discount_amount || 0) > 0 ? "Manual discount" : null) ||
    null;
  lines.push(`${totalsCfg.subtotal_label || "Subtotal"}: Rs.${subtotal.toFixed(2)}`);
  if (totalsCfg.show_tax !== false) {
    lines.push(`${totalsCfg.tax_label || "Tax"}: Rs.${tax.toFixed(2)}`);
  }
  if (totalsCfg.show_discount !== false && computedDiscount > 0) {
    lines.push(`${totalsCfg.discount_label || "Discount"}: -Rs.${computedDiscount.toFixed(2)}`);
    if (discountReason) {
      lines.push(`${totalsCfg.discount_reason_label || "Reason"}: ${String(discountReason)}`);
    }
  }
  lines.push(`${totalsCfg.total_label || "Grand Total"}: Rs.${total.toFixed(2)}`);

  const paymentsCfg = blocks.find((b: any) => b.type === "payments")?.cfg || {};
  const payments = Array.isArray(order?.payments) ? order.payments : [];
  if (payments.length) {
    lines.push("---------------------------");
    lines.push(`Paid: Rs.${Number(receipt?.total_paid ?? 0).toFixed(2)}`);
    if (Number(receipt?.balance_due ?? 0) > 0) {
      lines.push(`Balance Due: Rs.${Number(receipt?.balance_due ?? 0).toFixed(2)}`);
    }
    payments.forEach((p: any) => {
      lines.push(`${String(p?.method || paymentsCfg.method_label || "payment").toUpperCase()}: Rs.${Number(p?.amount || 0).toFixed(2)}`);
    });
  }

  const footer = blocks.find((b: any) => b.type === "footer")?.cfg || {};
  lines.push("---------------------------");
  lines.push(String(footer.message || "THANK YOU"));
  lines.push("\n\n\n");

  return lines.join("\n");
}

function resolveReceiptAssignedPrinter(printers: any[], restaurantLike: any): any | null {
  const stations = restaurantLike?.kot_station_config?.stations;
  const receiptStation = Array.isArray(stations)
    ? stations.find((s: any) => String(s?.name || "").trim().toLowerCase() === "receipt")
    : null;
  const receiptPrinterId = receiptStation?.printer_id;

  if (receiptPrinterId) {
    const mapped = (printers || []).find((p: any) => p?.id === receiptPrinterId && p?.enabled);
    if (mapped) return mapped;
  }

  return (printers || []).find((p: any) => p?.enabled && p?.is_default) || (printers || []).find((p: any) => p?.enabled) || null;
}

export default function ReceiptPage() {
  const params = useParams() as { id?: string | string[] } | null;
  const rawId = Array.isArray(params?.id) ? params?.id[0] : params?.id;
  const orderId = Number(rawId || 0);
  const router = useRouter();
  
  // Extract returnTo from URL if present
  const [returnTo, setReturnTo] = useState<string | null>(null);
  
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      setReturnTo(urlParams.get("returnTo"));
    }
  }, []);

  const user = useAuth((s) => s.user);
  const me = useAuth((s) => s.me);

  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [template, setTemplate] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [printed, setPrinted] = useState(false);
  
  useOrderFull(orderId);
  const autoPrintDone = useRef(false);
  const autoPrintedOrderRef = useRef<number | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  // Reset print guard when navigating to a different receipt id.
  useEffect(() => {
    autoPrintDone.current = false;
    autoPrintedOrderRef.current = null;
    setPrinted(false);
  }, [orderId]);

  // Auth guard
  useEffect(() => {
    const checkAuth = async () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      if (!user && token) await me();
      const updatedToken = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      if (!user && !updatedToken) router.push("/");
    };
    const timer = setTimeout(checkAuth, 500);
    return () => clearTimeout(timer);
  }, [user, me, router]);

  // Fetch receipt data, then fetch template using the receipt's restaurant_id
  const fetchData = useCallback(async () => {
    if (!orderId) return;
    try {
      const receiptRes = await apiClient.get(ReceiptApis.getReceiptData(orderId));
      if (receiptRes.data.status === "success") {
        const receiptData: ReceiptData = receiptRes.data.data;
        setReceipt(receiptData);

        // Use restaurant_id from the receipt response (avoids user?.restaurant_id being 0)
        const restaurantId = receiptData.restaurant?.id || user?.restaurant_id;
        if (restaurantId) {
          try {
            const templateRes = await apiClient.get(RestaurantApis.getTemplates(restaurantId));
            if (templateRes.data.status === "success" && templateRes.data.data?.receipt_template?.length > 0) {
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
      setError(err?.response?.data?.detail || err?.message || "Failed to load receipt");
    } finally {
      setLoading(false);
    }
  }, [orderId, user?.restaurant_id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const tryElectronNetworkReceiptPrint = useCallback(async (): Promise<boolean> => {
    try {
      // @ts-ignore
      if (typeof window === "undefined" || !window.electronAPI?.printNetworkRaw) {
        return false;
      }
      const restaurantId = receipt?.restaurant?.id || user?.restaurant_id;
      if (!restaurantId) return false;

      const res = await apiClient.get(PrinterApis.list(restaurantId));
      const printers = res?.data?.data || [];
      const printer = resolveReceiptAssignedPrinter(printers, receipt?.restaurant);
      if (!printer) return false;

      const host = String(printer?.connection_config?.ip_address || printer?.address || "").trim();
      const port = Number(printer?.connection_config?.port || 9100);
      const type = String(printer?.printer_type || "").toLowerCase();
      const isNetwork = type.includes("network") || /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
      if (!isNetwork || !host) return false;

      const payload = buildReceiptRawPayload(receipt, template || [], orderId);

      // @ts-ignore
      const printRes = await window.electronAPI.printNetworkRaw({
        host,
        port,
        payload,
      });
      if (!printRes?.success) {
        console.warn("[ReceiptPage] Network raw print failed:", printRes?.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn("[ReceiptPage] Network raw print error:", err);
      return false;
    }
  }, [receipt, user?.restaurant_id, orderId]);

  // Auto-print once on open (default behavior for POS receipt page).
  // If backend sends should_auto_print explicitly false, we still auto-print
  // to preserve expected cashier workflow on web.
  useEffect(() => {
    if (!receipt || !template) return;
    if (autoPrintedOrderRef.current === orderId) return;
    autoPrintedOrderRef.current = orderId;
    autoPrintDone.current = true;

    const timer = setTimeout(() => {
      (async () => {
        const ok = await tryElectronNetworkReceiptPrint();
        if (!ok) {
          window.print();
        }
        setPrinted(true);
      })();
    }, 400);
    return () => clearTimeout(timer);
  }, [receipt, template, orderId, tryElectronNetworkReceiptPrint]);

  const handlePrint = async () => {
    const sentToNetwork = await tryElectronNetworkReceiptPrint();
    if (sentToNetwork) {
      setPrinted(true);
      return;
    }

    // In browser/web mode, prefer native print dialog directly.
    // Blob/PDF preview tabs can be blocked/closed by browser policies.
    // @ts-ignore
    const isElectron = typeof window !== "undefined" && !!window.electronAPI;
    if (!isElectron) {
      window.print();
      setPrinted(true);
      return;
    }

    if (!receiptRef.current) return;

    const globalBlock = template?.find((b: any) => b.type === 'global_settings');
    const paperSizeStr = globalBlock?.config?.paper_size || globalBlock?.paper_size || '80mm';
    const paperWidthMm = paperSizeStr === '58mm' ? 58 : 80;

    try {
      // Dynamic import to avoid SSR issues
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      // Capture the receipt element as a canvas image
      const canvas = await html2canvas(receiptRef.current, {
        scale: 3, // High resolution for thermal printer quality
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const imgWidthPx = canvas.width;
      const imgHeightPx = canvas.height;

      // Calculate page height proportionally to match 80mm width
      const pageHeightMm = (imgHeightPx / imgWidthPx) * paperWidthMm;

      // Create a PDF with exact thermal dimensions
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [paperWidthMm, pageHeightMm],
      });

      pdf.addImage(imgData, 'PNG', 0, 0, paperWidthMm, pageHeightMm);

      // Open as blob URL for printing — the PDF viewer respects exact page dims
      const pdfBlob = pdf.output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);
      const pdfWindow = window.open(blobUrl, '_blank');
      if (pdfWindow) {
        pdfWindow.addEventListener('load', () => {
          pdfWindow.print();
        });
      }
    } catch (err) {
      console.error('PDF print failed, falling back to window.print()', err);
      window.print();
    }
    setPrinted(true);
  };

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
        setTimeout(() => { btn.textContent = "Share"; }, 2000);
      }
    }
  };

  const handleComplete = async () => {
    setCompleting(true);
    try {
      await apiClient.patch(OrderApis.updateOrderStatus(orderId), { status: "completed" });
      toast.success("Order completed successfully!");
      if (returnTo) {
        router.push(returnTo);
      } else if (receipt?.order?.channel === "room_service") {
        router.push("/rooms/checkin");
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

  // ── Loading ──
  if (loading) {
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

  if (!receipt || !template) return null;

  const { order } = receipt;
  const orderLabel = order.table_name
    ? `${order.table_name} • #${order.restaurant_order_id || order.id}`
    : `Order #${order.restaurant_order_id || order.id}`;

  const globalBlock = template.find(b => b.type === 'global_settings');
  const paperSize = globalBlock?.paper_size || '80mm';

  return (
    <>
      {/* Print-only styles */}
      <style jsx global>{`
        @media print {
          @page {
            margin: 0;
            size: auto;
          }
          html, body {
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
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => {
              if (returnTo) router.push(returnTo);
              else if (receipt?.order?.channel === "room_service") router.push("/rooms/checkin");
              else router.back();
            }} className="rounded-xl hover:bg-muted/50">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-black tracking-tight">Receipt</h1>
              <p className="text-sm text-muted-foreground">{orderLabel}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {receipt.is_fully_paid && order.status !== 'completed' && (
              <Button
                size="sm"
                onClick={handleComplete}
                disabled={completing}
                className="gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700"
              >
                {completing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                Complete Order
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleShare} className="gap-2 rounded-xl" id="share-btn">
              <Share2 className="h-3.5 w-3.5" /> Share
            </Button>
            <Button size="sm" onClick={handlePrint} className="gap-2 rounded-xl shadow-lg">
              <Printer className="h-3.5 w-3.5" /> Print
            </Button>
          </div>
        </div>

        {/* ── Fully Paid Banner ── */}
        {receipt.is_fully_paid && (
          <div className="mx-4 flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl no-print">
            <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <div>
              <p className="font-bold text-emerald-700 dark:text-emerald-300">Payment Complete</p>
              <p className="text-sm text-emerald-600/80 dark:text-emerald-400/80">
                This order has been fully paid. Total: Rs. {receipt.total_paid.toLocaleString()}
              </p>
            </div>
          </div>
        )}

        {/* ── Receipt Rendering (Thermal Slip) ── */}
        <div className="flex-1 flex items-start justify-center p-4 bg-muted/30 overflow-y-auto">
             <div ref={receiptRef} id="receipt-printable-wrapper" className="shadow-2xl border border-border/40 bg-white">
                <ThermalReceipt data={receipt} template={template} />
             </div>
        </div>

        {/* Bottom Actions (no-print) */}
        <div className="flex flex-col sm:flex-row items-center gap-3 no-print px-4 pb-4">
          {receipt.is_fully_paid && order.status !== 'completed' && (
            <Button 
              className="w-full h-12 text-base font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20 shadow-lg gap-2"
              onClick={handleComplete}
              disabled={completing}
            >
              {completing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              Complete {receipt?.order?.channel === "room_service" ? "Checkout" : "Order"}
            </Button>
          )}
          <Button
            className="flex-1 w-full sm:w-auto h-12 text-base font-bold gap-2 rounded-xl shadow-lg"
            onClick={() => {
              if (returnTo) router.push(returnTo);
              else if (receipt?.order?.channel === "room_service") router.push("/rooms/checkin");
              else router.push("/orders/active");
            }}
          >
            <CheckCircle className="h-4 w-4" /> {receipt?.order?.channel === "room_service" ? "Back to Rooms" : "Back to Orders"}
          </Button>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              className="flex-1 h-12 gap-2 rounded-xl font-bold"
              onClick={handlePrint}
            >
              <Printer className="h-4 w-4" /> Print Again
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
    </>
  );
}
