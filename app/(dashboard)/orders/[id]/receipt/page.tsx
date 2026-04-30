"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import apiClient from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { ReceiptApis, OrderApis } from "@/lib/api/endpoints";
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
  
  const { context, allKotsServed } = useOrderFull(orderId);
  const autoPrintDone = useRef(false);
  const receiptRef = useRef<HTMLDivElement>(null);

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

  // Auto-print on mount if configured
  useEffect(() => {
    if (receipt?.should_auto_print && template && !autoPrintDone.current && !printed) {
      autoPrintDone.current = true;
      const timer = setTimeout(() => {
        window.print();
        setPrinted(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [receipt?.should_auto_print, template, printed]);

  const handlePrint = async () => {
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
      if (returnTo) {
        router.push(returnTo);
      } else if (receipt?.order?.channel === "room_service") {
        router.push("/rooms/checkin");
      } else {
        router.push("/orders/active");
      }
    } catch (err: any) {
      console.error("Failed to complete order:", err);
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
          {receipt.is_fully_paid && (allKotsServed || receipt?.order?.channel === "room_service") && order.status !== 'completed' && (
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
