"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import apiClient from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";
import { useOrderFull } from "@/hooks/use-order-full";
import { OrderApis, CustomerApis } from "@/lib/api/endpoints";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Loader2,
  CreditCard,
  Banknote,
  Smartphone,
  Wallet,
  Receipt,
  Printer,
  Tag,
  Percent,
  X,
  AlertCircle,
  RefreshCw,
  CheckCircle,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types matching backend schema ──────────────────
interface BillItemModifier {
  id: number;
  modifier_id: number | null;
  modifier_name_snapshot: string;
  price_adjustment_snapshot: number;
}

interface BillItem {
  id: number;
  menu_item_id: number | null;
  name_snapshot: string;
  category_name_snapshot: string | null;
  category_type_snapshot: string | null;
  unit_price: number;
  qty: number;
  line_total: number;
  notes: string | null;
  modifiers: BillItemModifier[];
  created_at: string;
}

interface BillPayment {
  id: number;
  method: string;
  amount: number;
  reference: string | null;
  status: string;
  created_at: string | null;
}

interface OrderBill {
  order_id: number;
  items: BillItem[];
  payments: BillPayment[];
  subtotal: number;
  tax_total: number;
  service_charge: number;
  discount_total: number;
  manual_discount_amount: number;
  grand_total: number;
  total_paid: number;
  balance_due: number;
  is_fully_paid: boolean;
  subtotal_pre_tax: number | null;
  tax_breakdown_note: string | null;
}

interface OrderMeta {
  id: number;
  restaurant_order_id?: number;
  table_name?: string;
  table_id?: number;
  table_category_name?: string;
  channel: string;
  status: string;
  customer_name?: string;
  customer_phone?: string;
  customer_id?: number;
  number_of_guests?: number;
  notes?: string;
  created_at: string;
}

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash", icon: Banknote, color: "text-emerald-600" },
  { value: "card", label: "Card", icon: CreditCard, color: "text-blue-600" },
  { value: "digital", label: "Digital/QR", icon: Smartphone, color: "text-purple-600" },
  { value: "credit", label: "Credit", icon: Wallet, color: "text-orange-600" },
];

function formatCurrency(amount: number, currency = "Rs.") {
  return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Main Checkout Page ─────────────────────────────
export default function CheckoutPage() {
  const params = useParams();
  const orderId = Number(params.id);
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const { restaurant } = useRestaurant();
  const curr = restaurant?.currency || "Rs.";

  const { context, loading: orderLoading, fetchContext, isFullyPaid, allKotsServed } = useOrderFull(orderId);
  const [bill, setBill] = useState<OrderBill | null>(null);
  const [orderMeta, setOrderMeta] = useState<OrderMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Payment dialog
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [payMethod, setPayMethod] = useState("cash");
  const [payAmount, setPayAmount] = useState("");
  const [payReference, setPayReference] = useState("");
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  // Customer selection for Credit
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");

  // Discount dialog
  const [discountOpen, setDiscountOpen] = useState(false);
  const [discountType, setDiscountType] = useState<"code" | "manual">("code");
  const [discountCode, setDiscountCode] = useState("");
  const [manualDiscountAmount, setManualDiscountAmount] = useState("");
  const [discountSubmitting, setDiscountSubmitting] = useState(false);
  const [discountError, setDiscountError] = useState<string | null>(null);

  // ── Fetch Bill ────────────────────────────────────
  const fetchBill = useCallback(async () => {
    if (!orderId) return;
    try {
      const [billRes, orderRes] = await Promise.all([
        apiClient.get(OrderApis.getOrderBill(orderId)),
        apiClient.get(OrderApis.getOrder(orderId)),
      ]);
      if (billRes.data.status === "success") {
        setBill(billRes.data.data);
      }
      if (orderRes.data.status === "success") {
        setOrderMeta(orderRes.data.data);
      }
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || "Failed to load bill");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchBill();
  }, [fetchBill]);

  // ── Fetch Customers ───────────────────────────────
  const fetchCustomers = useCallback(async () => {
    if (!user?.restaurant_id) return;
    try {
      const { data } = await apiClient.get(CustomerApis.listCustomers(user.restaurant_id));
      if (data.status === "success") {
        setCustomers(data.data.customers || []);
      }
    } catch (err) {
      console.error("Failed to load customers:", err);
    }
  }, [user?.restaurant_id]);

  useEffect(() => {
    if (user?.restaurant_id) {
      fetchCustomers();
    }
  }, [fetchCustomers, user?.restaurant_id]);

  // ── Auto-navigate on full payment ─────────────────
  useEffect(() => {
    if (bill?.is_fully_paid) {
      // Navigate to receipt page after a short delay
      const timer = setTimeout(() => {
        router.push(`/orders/${orderId}/receipt`);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [bill?.is_fully_paid, orderId, router]);

  // ── Complete Order ──
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

  // ── Add Payment ──────────────────────────────────
  const handleAddPayment = async () => {
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) {
      setPayError("Enter a valid amount");
      return;
    }

    if (payMethod === "credit") {
        if (!orderMeta?.customer_id && !selectedCustomerId) {
            setPayError("Select a customer for credit payment");
            return;
        }
    }

    setPaySubmitting(true);
    setPayError(null);
    try {
      // If paying with credit and assigning a new customer to this order
      if (payMethod === "credit" && selectedCustomerId && String(orderMeta?.customer_id) !== selectedCustomerId) {
        await apiClient.patch(OrderApis.updateOrder(orderId), {
            customer_id: parseInt(selectedCustomerId, 10)
        });
      }

      const res = await apiClient.post(OrderApis.addPayment(orderId), {
        payment: {
          method: payMethod,
          amount: Math.min(amount, bill?.balance_due || amount),
          reference: payReference.trim() || null,
          status: "success",
        },
      });
      setPaymentOpen(false);
      setPayAmount("");
      setPayReference("");
      setPayMethod("cash");
      await fetchBill();
      
      // Check if payment completed the order
      if (res.data?.data?.payment_complete) {
        // Bill will update and auto-navigate effect will trigger
      }
    } catch (err: any) {
      setPayError(err?.response?.data?.detail || "Failed to add payment");
    } finally {
      setPaySubmitting(false);
    }
  };

  // ── Apply Discount ────────────────────────────────
  const handleApplyDiscount = async () => {
    setDiscountSubmitting(true);
    setDiscountError(null);
    try {
      if (discountType === "code") {
        if (!discountCode.trim()) {
          setDiscountError("Enter a discount code");
          setDiscountSubmitting(false);
          return;
        }
        await apiClient.patch(OrderApis.updateOrder(orderId), {
          discount_code: discountCode.trim(),
        });
      } else {
        const amt = parseFloat(manualDiscountAmount);
        if (!amt || amt <= 0) {
          setDiscountError("Enter a valid amount");
          setDiscountSubmitting(false);
          return;
        }
        await apiClient.patch(OrderApis.updateOrder(orderId), {
          manual_discount_amount: amt,
        });
      }
      setDiscountOpen(false);
      setDiscountCode("");
      setManualDiscountAmount("");
      await fetchBill();
    } catch (err: any) {
      setDiscountError(err?.response?.data?.detail || "Failed to apply discount");
    } finally {
      setDiscountSubmitting(false);
    }
  };

  // ── Remove Discount ───────────────────────────────
  const handleRemoveDiscount = async () => {
    try {
      await apiClient.patch(OrderApis.updateOrder(orderId), {
        discount_code: "",
      });
      await fetchBill();
    } catch (err: any) {
      console.error("Failed to remove discount:", err);
    }
  };

  // ── Print Receipt ─────────────────────────────────
  const handlePrintReceipt = () => {
    window.print();
  };

  // ── Loading / Error States ────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !bill) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-destructive font-medium">{error}</p>
        <Button variant="outline" onClick={fetchBill}>
          <RefreshCw className="h-4 w-4 mr-2" /> Retry
        </Button>
      </div>
    );
  }

  if (!bill) return null;

  const hasDiscount = bill.discount_total > 0 || bill.manual_discount_amount > 0;
  const orderLabel = orderMeta?.table_name
    ? `${orderMeta.table_name} • Order #${orderMeta.restaurant_order_id || orderId}`
    : `Order #${orderMeta?.restaurant_order_id || orderId}`;

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-8">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-xl">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Bill & Payment</h1>
            <p className="text-sm text-muted-foreground">{orderLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchBill} className="gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          {bill.is_fully_paid && (
            <Button variant="outline" size="sm" onClick={handlePrintReceipt} className="gap-2">
              <Printer className="h-3.5 w-3.5" /> Print
            </Button>
          )}
        </div>
      </div>

      {/* ── Fully Paid Banner ── */}
      {bill.is_fully_paid && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl">
          <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <div>
            <p className="font-semibold text-emerald-700 dark:text-emerald-300">Bill Fully Paid</p>
            <p className="text-sm text-emerald-600/80 dark:text-emerald-400/80">
              {orderMeta?.table_name ? `${orderMeta.table_name} has been freed.` : "Order completed successfully."}
            </p>
          </div>
        </div>
      )}

      {/* ── Main Content: 2-column on desktop ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left: Bill Items ── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Order info card */}
          {orderMeta && (
            <Card className="border-border/40">
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                  {orderMeta.table_category_name && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <span className="font-medium text-foreground">{orderMeta.table_category_name}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    Channel: <span className="font-medium text-foreground capitalize">{orderMeta.channel.replace("_", " ")}</span>
                  </div>
                  {orderMeta.customer_name && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      Customer: <span className="font-medium text-foreground">{orderMeta.customer_name}</span>
                    </div>
                  )}
                  {orderMeta.number_of_guests && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      Guests: <span className="font-medium text-foreground">{orderMeta.number_of_guests}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    Created: <span className="font-medium text-foreground">{new Date(orderMeta.created_at).toLocaleString()}</span>
                  </div>
                </div>
                {orderMeta.notes && (
                  <p className="mt-2 text-sm text-muted-foreground italic">Notes: {orderMeta.notes}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Items table */}
          <Card className="border-border/40">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Item</th>
                      <th className="text-center p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground w-20">Qty</th>
                      <th className="text-right p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground w-28">Price</th>
                      <th className="text-right p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground w-32">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bill.items.map((item) => (
                      <tr key={item.id} className="border-b border-border/30 hover:bg-muted/10 transition-colors">
                        <td className="p-4">
                          <p className="font-medium text-sm">{item.name_snapshot}</p>
                          {item.category_name_snapshot && (
                            <p className="text-xs text-muted-foreground">{item.category_name_snapshot}</p>
                          )}
                          {item.modifiers.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {item.modifiers.map((m) => (
                                <Badge key={m.id} variant="secondary" className="text-[10px] font-normal">
                                  {m.modifier_name_snapshot}
                                  {m.price_adjustment_snapshot !== 0 && (
                                    <span className="ml-1">+{formatCurrency(m.price_adjustment_snapshot, curr)}</span>
                                  )}
                                </Badge>
                              ))}
                            </div>
                          )}
                          {item.notes && (
                            <p className="text-xs text-muted-foreground mt-1 italic">{item.notes}</p>
                          )}
                        </td>
                        <td className="p-4 text-center font-medium tabular-nums">{item.qty}</td>
                        <td className="p-4 text-right text-sm tabular-nums text-muted-foreground">
                          {formatCurrency(item.unit_price, curr)}
                        </td>
                        <td className="p-4 text-right font-semibold tabular-nums">
                          {formatCurrency(item.line_total, curr)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Right: Summary & Actions ── */}
        <div className="space-y-4">
          {/* Bill Summary */}
          <Card className="border-border/40">
            <CardContent className="p-5 space-y-3">
              <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground mb-4">Summary</h3>

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">{formatCurrency(bill.subtotal, curr)}</span>
              </div>

              {bill.tax_total > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Tax
                    {bill.tax_breakdown_note && (
                      <span className="text-xs ml-1">({bill.tax_breakdown_note})</span>
                    )}
                  </span>
                  <span className="tabular-nums">{formatCurrency(bill.tax_total, curr)}</span>
                </div>
              )}

              {bill.service_charge > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Service Charge</span>
                  <span className="tabular-nums">{formatCurrency(bill.service_charge, curr)}</span>
                </div>
              )}

              {hasDiscount && (
                <div className="flex justify-between text-sm items-center">
                  <div className="flex items-center gap-1.5">
                    <Percent className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-emerald-600 font-medium">Discount</span>
                    {!bill.is_fully_paid && (
                      <button onClick={handleRemoveDiscount} className="text-destructive hover:text-destructive/80 ml-1">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <span className="tabular-nums text-emerald-600 font-medium">
                    -{formatCurrency(bill.discount_total + bill.manual_discount_amount, curr)}
                  </span>
                </div>
              )}

              <Separator />

              <div className="flex justify-between font-bold text-lg">
                <span>Grand Total</span>
                <span className="tabular-nums">{formatCurrency(bill.grand_total, curr)}</span>
              </div>

              <Separator />

              {bill.total_paid > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Paid</span>
                  <span className="tabular-nums text-emerald-600 font-medium">{formatCurrency(bill.total_paid, curr)}</span>
                </div>
              )}

              <div className="flex justify-between font-bold text-base">
                <span className={bill.balance_due > 0 ? "text-destructive" : "text-emerald-600"}>
                  {bill.balance_due > 0 ? "Balance Due" : "Settled"}
                </span>
                <span className={cn("tabular-nums", bill.balance_due > 0 ? "text-destructive" : "text-emerald-600")}>
                  {formatCurrency(bill.balance_due, curr)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Payments List */}
          {bill.payments.length > 0 && (
            <Card className="border-border/40">
              <CardContent className="p-5 space-y-3">
                <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground mb-2">Payments</h3>
                {bill.payments.map((p) => {
                  const method = PAYMENT_METHODS.find((m) => m.value === p.method);
                  const Icon = method?.icon || Banknote;
                  return (
                    <div key={p.id} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
                      <div className="flex items-center gap-3">
                        <div className={cn("p-2 rounded-lg bg-muted/50", method?.color)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium capitalize">{p.method}</p>
                          {p.reference && (
                            <p className="text-xs text-muted-foreground">Ref: {p.reference}</p>
                          )}
                          {p.created_at && (
                            <p className="text-xs text-muted-foreground">
                              {new Date(p.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="font-semibold tabular-nums">{formatCurrency(p.amount, curr)}</span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          {!bill.is_fully_paid && (
            <div className="space-y-3">
              <Button
                className="w-full h-12 text-base font-semibold shadow-lg gap-2"
                onClick={() => {
                  setPayAmount(bill.balance_due.toFixed(2));
                  setPaymentOpen(true);
                }}
              >
                <CreditCard className="h-4 w-4" />
                Take Payment ({formatCurrency(bill.balance_due, curr)})
              </Button>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => setDiscountOpen(true)}
                >
                  <Tag className="h-4 w-4" />
                  {hasDiscount ? "Change Discount" : "Add Discount"}
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => router.push(`/orders/${orderId}/edit`)}
                >
                  <Receipt className="h-4 w-4" />
                  Edit Order
                </Button>
              </div>
            </div>
          )}

          {bill.is_fully_paid && (
            <div className="space-y-3">
              {allKotsServed && orderMeta?.status !== 'completed' && (
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
                variant="outline"
                className="w-full h-12 text-base font-semibold gap-2"
                onClick={() => router.push("/orders/active")}
              >
                <CheckCircle className="h-4 w-4" />
                Back to Orders
              </Button>
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={handlePrintReceipt}
              >
                <Printer className="h-4 w-4" />
                Print Receipt
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ── Payment Dialog ── */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Payment</DialogTitle>
            <DialogDescription>
              Balance due: <span className="font-bold text-foreground">{formatCurrency(bill.balance_due, curr)}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {payError && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium">{payError}</div>
            )}

            {/* Payment Method */}
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setPayMethod(m.value)}
                    className={cn(
                      "flex items-center gap-2 p-3 rounded-xl border-2 transition-all text-sm font-medium",
                      payMethod === m.value
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border/50 hover:border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <m.icon className="h-4 w-4" />
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Customer Selection for Credit Method */}
            {payMethod === "credit" && !orderMeta?.customer_id && (
              <div className="space-y-2">
                <Label>Select Customer</Label>
                <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a customer to assign credit tracking" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c: any) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.full_name || c.name || "Guest"} ({c.phone || "No phone"}) - Balance: {formatCurrency(c.credit || 0, curr)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {payMethod === "credit" && orderMeta?.customer_id && (
               <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg text-sm flex items-center gap-2 border border-blue-100 dark:border-blue-900">
                  <User className="h-4 w-4" />
                  Charging to order's customer: <span className="font-bold">{orderMeta.customer_name || "Guest"}</span>
               </div>
            )}

            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="pay-amount">Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">{curr}</span>
                <Input
                  id="pay-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="pl-12 text-lg font-semibold tabular-nums"
                  autoFocus
                />
              </div>
              {(() => {
                const entered = parseFloat(payAmount) || 0;
                const change = entered > bill.balance_due ? entered - bill.balance_due : 0;
                if (change > 0) {
                  return (
                    <div className="flex justify-between text-sm px-1">
                      <span className="text-muted-foreground">Change to return</span>
                      <span className="font-bold text-orange-600">{formatCurrency(change, curr)}</span>
                    </div>
                  );
                }
                return null;
              })()}
            </div>

            {/* Reference */}
            <div className="space-y-2">
              <Label htmlFor="pay-ref">Reference (optional)</Label>
              <Input
                id="pay-ref"
                placeholder="Transaction ID, receipt number..."
                value={payReference}
                onChange={(e) => setPayReference(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentOpen(false)}>Cancel</Button>
            <Button onClick={handleAddPayment} disabled={paySubmitting} className="gap-2">
              {paySubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              {paySubmitting ? "Processing..." : "Add Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Discount Dialog ── */}
      <Dialog open={discountOpen} onOpenChange={setDiscountOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{hasDiscount ? "Change Discount" : "Apply Discount"}</DialogTitle>
            <DialogDescription>
              Apply a promo code or manual discount to this order.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {discountError && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium">{discountError}</div>
            )}

            {/* Discount Type Toggle */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDiscountType("code")}
                className={cn(
                  "flex-1 p-3 rounded-xl border-2 text-sm font-medium transition-all",
                  discountType === "code"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border/50 text-muted-foreground hover:border-border"
                )}
              >
                <Tag className="h-4 w-4 inline mr-2" />
                Promo Code
              </button>
              <button
                type="button"
                onClick={() => setDiscountType("manual")}
                className={cn(
                  "flex-1 p-3 rounded-xl border-2 text-sm font-medium transition-all",
                  discountType === "manual"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border/50 text-muted-foreground hover:border-border"
                )}
              >
                <Percent className="h-4 w-4 inline mr-2" />
                Manual Amount
              </button>
            </div>

            {discountType === "code" ? (
              <div className="space-y-2">
                <Label htmlFor="discount-code">Discount Code</Label>
                <Input
                  id="discount-code"
                  placeholder="Enter promo code"
                  value={discountCode}
                  onChange={(e) => setDiscountCode(e.target.value)}
                  className="uppercase"
                  autoFocus
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="manual-discount">Discount Amount</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">{curr}</span>
                  <Input
                    id="manual-discount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={manualDiscountAmount}
                    onChange={(e) => setManualDiscountAmount(e.target.value)}
                    className="pl-12"
                    autoFocus
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscountOpen(false)}>Cancel</Button>
            <Button onClick={handleApplyDiscount} disabled={discountSubmitting} className="gap-2">
              {discountSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Tag className="h-4 w-4" />}
              {discountSubmitting ? "Applying..." : "Apply Discount"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
