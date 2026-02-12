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

function formatCurrency(amount: number) {
  return `Rs. ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const PAYMENT_ICONS: Record<string, any> = {
  cash: Banknote,
  card: CreditCard,
  digital: Smartphone,
  credit: Wallet,
};

export default function ReceiptPage() {
  const params = useParams();
  const orderId = Number(params.id);
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const me = useAuth((s) => s.me);

  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [printed, setPrinted] = useState(false);
  
  const { context, allKotsServed } = useOrderFull(orderId);
  const autoPrintDone = useRef(false);

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

  // Fetch receipt data
  const fetchReceipt = useCallback(async () => {
    if (!orderId) return;
    try {
      const res = await apiClient.get(ReceiptApis.getReceiptData(orderId));
      if (res.data.status === "success") {
        setReceipt(res.data.data);
      }
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || "Failed to load receipt");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchReceipt();
  }, [fetchReceipt]);

  // Auto-print on mount if configured
  useEffect(() => {
    if (receipt?.should_auto_print && !autoPrintDone.current && !printed) {
      autoPrintDone.current = true;
      const timer = setTimeout(() => {
        window.print();
        setPrinted(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [receipt?.should_auto_print, printed]);

  const handlePrint = () => {
    window.print();
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
      router.push("/orders/active");
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
        <Button variant="outline" onClick={fetchReceipt}>
          <RefreshCw className="h-4 w-4 mr-2" /> Retry
        </Button>
      </div>
    );
  }

  if (!receipt) return null;

  const { order, restaurant } = receipt;
  const orderLabel = order.table_name
    ? `${order.table_name} • #${order.restaurant_order_id || order.id}`
    : `Order #${order.restaurant_order_id || order.id}`;

  return (
    <>
      {/* Print-only styles */}
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #receipt-printable, #receipt-printable * { visibility: visible; }
          #receipt-printable { 
            position: absolute; 
            left: 0; 
            top: 0; 
            width: 100%;
            max-width: 80mm;
            margin: 0 auto;
            padding: 8px;
            font-size: 12px;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="flex flex-col gap-6 max-w-3xl mx-auto pb-8">
        {/* ── Header (no-print) ── */}
        <div className="flex items-center justify-between no-print">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-xl hover:bg-muted/50">
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
          <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl no-print">
            <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <div>
              <p className="font-bold text-emerald-700 dark:text-emerald-300">Payment Complete</p>
              <p className="text-sm text-emerald-600/80 dark:text-emerald-400/80">
                This order has been fully paid. Total: {formatCurrency(receipt.total_paid)}
              </p>
            </div>
          </div>
        )}

        {/* ── Receipt Card (printable) ── */}
        <Card className="border-border/40 bg-white dark:bg-[#1a1a1a] overflow-hidden" id="receipt-printable">
          <CardContent className="p-6 space-y-6">
            {/* Restaurant Header */}
            <div className="text-center space-y-2">
              <h2 className="text-xl font-black tracking-tight">{restaurant.name}</h2>
              <p className="text-sm text-muted-foreground">{restaurant.address}</p>
              <p className="text-sm text-muted-foreground">{restaurant.phone}</p>
              {restaurant.pan_number && (
                <p className="text-xs text-muted-foreground">PAN: {restaurant.pan_number}</p>
              )}
            </div>

            <Separator />

            {/* Order Info */}
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground text-xs">Order</span>
                <p className="font-bold">#{order.restaurant_order_id || order.id}</p>
              </div>
              <div className="text-right">
                <span className="text-muted-foreground text-xs">Date</span>
                <p className="font-bold">{new Date(order.created_at).toLocaleDateString()}</p>
              </div>
              {order.table_name && (
                <div>
                  <span className="text-muted-foreground text-xs">Table</span>
                  <p className="font-bold">{order.table_name}</p>
                </div>
              )}
              <div className={order.table_name ? "text-right" : ""}>
                <span className="text-muted-foreground text-xs">Time</span>
                <p className="font-bold">
                  {new Date(order.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              {order.customer_name && (
                <div className="col-span-2">
                  <span className="text-muted-foreground text-xs">Customer</span>
                  <p className="font-bold">{order.customer_name}</p>
                </div>
              )}
            </div>

            <Separator />

            {/* Items */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-muted-foreground pb-2">
                <span className="flex-1">Item</span>
                <span className="w-12 text-center">Qty</span>
                <span className="w-24 text-right">Amount</span>
              </div>
              {order.items.map((item: OrderItem) => (
                <div key={item.id} className="flex items-start justify-between py-1.5">
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="text-sm font-medium">{item.name_snapshot}</p>
                    {item.modifiers && item.modifiers.length > 0 && (
                      <p className="text-[10px] text-muted-foreground">
                        {item.modifiers.map(m => m.modifier_name_snapshot).join(", ")}
                      </p>
                    )}
                    {item.notes && (
                      <p className="text-[10px] text-muted-foreground italic">{item.notes}</p>
                    )}
                  </div>
                  <span className="w-12 text-center text-sm tabular-nums">{item.qty}</span>
                  <span className="w-24 text-right text-sm font-medium tabular-nums">
                    {formatCurrency(item.line_total)}
                  </span>
                </div>
              ))}
            </div>

            <Separator />

            {/* Totals */}
            <div className="space-y-2">
              {receipt.subtotal_pre_tax !== null && receipt.subtotal_pre_tax !== undefined && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal (Pre-Tax)</span>
                  <span className="tabular-nums">{formatCurrency(receipt.subtotal_pre_tax)}</span>
                </div>
              )}

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">{formatCurrency(order.subtotal)}</span>
              </div>

              {order.tax_total > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="tabular-nums">{formatCurrency(order.tax_total)}</span>
                </div>
              )}

              {order.service_charge > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Service Charge</span>
                  <span className="tabular-nums">{formatCurrency(order.service_charge)}</span>
                </div>
              )}

              {((order.discount_total || 0) + (order.manual_discount_amount || 0)) > 0 && (
                <div className="flex justify-between text-sm text-emerald-600">
                  <span>Discount</span>
                  <span className="tabular-nums">
                    -{formatCurrency((order.discount_total || 0) + (order.manual_discount_amount || 0))}
                  </span>
                </div>
              )}

              <Separator />

              <div className="flex justify-between text-lg font-black">
                <span>Grand Total</span>
                <span className="tabular-nums">{formatCurrency(order.grand_total)}</span>
              </div>
            </div>

            {/* Payments */}
            {order.payments && order.payments.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">Payments</span>
                  {order.payments.map((p: OrderPayment) => {
                    const Icon = PAYMENT_ICONS[p.method] || CreditCard;
                    return (
                      <div key={p.id} className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm capitalize font-medium">{p.method}</span>
                          {p.reference && (
                            <span className="text-[10px] text-muted-foreground">(Ref: {p.reference})</span>
                          )}
                        </div>
                        <span className="text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(p.amount)}
                        </span>
                      </div>
                    );
                  })}

                  <div className="flex justify-between text-sm font-bold pt-1">
                    <span>Total Paid</span>
                    <span className="tabular-nums text-emerald-600 dark:text-emerald-400">{formatCurrency(receipt.total_paid)}</span>
                  </div>

                  {receipt.balance_due > 0 && (
                    <div className="flex justify-between text-sm font-bold text-destructive">
                      <span>Balance Due</span>
                      <span className="tabular-nums">{formatCurrency(receipt.balance_due)}</span>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Footer */}
            <Separator />
            <div className="text-center space-y-1">
              <p className="text-xs text-muted-foreground">Thank you for dining with us!</p>
              <p className="text-[10px] text-muted-foreground">Powered by Yummy</p>
            </div>
          </CardContent>
        </Card>

        {/* Bottom Actions (no-print) */}
        <div className="flex flex-col sm:flex-row items-center gap-3 no-print">
          {receipt.is_fully_paid && allKotsServed && order.status !== 'completed' && (
            <Button 
              className="w-full h-12 text-base font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20 shadow-lg gap-2"
              onClick={handleComplete}
              disabled={completing}
            >
              {completing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              Complete Order
            </Button>
          )}
          <Button
            className="flex-1 w-full sm:w-auto h-12 text-base font-bold gap-2 rounded-xl shadow-lg"
            onClick={() => router.push("/orders/active")}
          >
            <CheckCircle className="h-4 w-4" /> Back to Orders
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
