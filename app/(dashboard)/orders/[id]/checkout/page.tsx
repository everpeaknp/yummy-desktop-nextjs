"use client";

import Link from "next/link";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import apiClient from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";
import { useOrderFull } from "@/hooks/use-order-full";
import { OrderApis, CustomerApis, PaymentApis, DrawerSessionApis, AccountingApis } from "@/lib/api/endpoints";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  ChevronDown,
  Search,
  QrCode,
  Award,
  Trash2,
  Users,
  Pencil,
  Plus,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePosBillingPermissions } from "@/hooks/use-pos-billing-permissions";
import { REFUND_PAYMENT_METHOD_OPTIONS } from "@/lib/payment-method-options";
import type { DrawerSession } from "@/types/day-close";
import type { PaymentInstrument } from "@/types/accounting";

function findFirstStringByKey(input: unknown, keyHints: string[]): string | null {
  if (!input) return null;
  const hints = keyHints.map((h) => h.toLowerCase());
  const queue: unknown[] = [input];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object") continue;
    if (Array.isArray(current)) {
      for (const item of current) queue.push(item);
      continue;
    }
    for (const [rawKey, rawValue] of Object.entries(current as Record<string, unknown>)) {
      const key = rawKey.toLowerCase();
      if (hints.some((h) => key.includes(h)) && typeof rawValue === "string" && rawValue.trim()) {
        return rawValue.trim();
      }
      if (rawValue && typeof rawValue === "object") queue.push(rawValue);
    }
  }
  return null;
}

function resolveQrDisplay(rawQr: string | null, payloadText: string | null, prn: string): string | null {
  const qrCandidate = rawQr?.trim();
  if (qrCandidate) {
    if (qrCandidate.startsWith("data:") || qrCandidate.startsWith("http")) return qrCandidate;
    if (/^[A-Za-z0-9+/=]+$/.test(qrCandidate) && qrCandidate.length > 120) {
      return `data:image/png;base64,${qrCandidate}`;
    }
    // If backend returns QR payload text in qr field, render a generated QR image.
    return `https://api.qrserver.com/v1/create-qr-code/?size=420x420&data=${encodeURIComponent(qrCandidate)}`;
  }
  const text = payloadText?.trim() || prn;
  if (!text) return null;
  return `https://api.qrserver.com/v1/create-qr-code/?size=420x420&data=${encodeURIComponent(text)}`;
}

function extractApiErrorMessage(err: any, fallback: string): string {
  const data = err?.response?.data;
  return (
    data?.detail ||
    data?.message ||
    data?.error ||
    err?.message ||
    fallback
  );
}

type BaseResponse<T> = {
  status?: string;
  data?: T;
  message?: string;
};

type CheckoutQrInstrument = {
  name: string;
  payload: string;
  instrumentType: string;
  isSelectable: boolean;
};

type CheckoutCardInstrument = {
  name: string;
  identifier?: string | null;
  instrumentType: string;
  isSelectable: boolean;
};

const PAYMENT_READY_DRAWER_STATUSES = new Set(["opened", "closing_count_required", "reopened"]);

function isPaymentReadyDrawer(session: DrawerSession) {
  return PAYMENT_READY_DRAWER_STATUSES.has(String(session.status || "").toLowerCase());
}

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
  is_nc?: boolean;
  modifiers: BillItemModifier[];
  created_at: string;
}

interface BillPayment {
  id: number;
  method: string;
  amount: number;
  reference: string | null;
  instrument_type?: string | null;
  instrument_name?: string | null;
  instrument_meta?: Record<string, any> | null;
  instrument?: {
    type: string;
    name: string;
    meta?: Record<string, any> | null;
  } | null;
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
  { value: "fonepay", label: "Fonepay", icon: QrCode, color: "text-fuchsia-600" },
  { value: "digital", label: "Digital/QR", icon: Smartphone, color: "text-purple-600" },
  { value: "credit", label: "Credit", icon: Wallet, color: "text-orange-600" },
];

const REFUND_PAYMENT_METHODS = REFUND_PAYMENT_METHOD_OPTIONS.map((method) => {
  const fullMethod = PAYMENT_METHODS.find((option) => option.value === method.value);
  return {
    ...method,
    icon: fullMethod?.icon || Banknote,
    color: fullMethod?.color || "text-emerald-600",
  };
});

function formatCurrency(amount: number, currency = "Rs.") {
  return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getItemEffectiveUnitPrice(item: BillItem) {
  const modifierTotal = Array.isArray(item.modifiers)
    ? item.modifiers.reduce((sum, modifier) => sum + Number(modifier.price_adjustment_snapshot || 0), 0)
    : 0;
  return Number(item.unit_price || 0) + modifierTotal;
}

function getItemEffectiveLineTotal(item: BillItem) {
  if (item.is_nc) return 0;
  return getItemEffectiveUnitPrice(item) * Number(item.qty || 0);
}

function formatCustomerLabel(c: any, currency: string) {
  const name = c?.full_name || c?.name || "Guest";
  const phone = c?.phone || "No phone";
  const bal = typeof c?.credit === "number" ? ` - Balance: ${formatCurrency(c.credit || 0, currency)}` : "";
  return `${name} (${phone})${bal}`;
}

function readPaymentInstrument(payment: BillPayment | null | undefined) {
  if (!payment) return null;
  const nested = payment.instrument;
  if (nested && typeof nested.type === "string" && typeof nested.name === "string") {
    return {
      type: nested.type,
      name: nested.name,
      meta: nested.meta || null,
    };
  }
  if (payment.instrument_type && payment.instrument_name) {
    return {
      type: payment.instrument_type,
      name: payment.instrument_name,
      meta: payment.instrument_meta || null,
    };
  }
  return null;
}

type CustomerOption = {
  id: number;
  full_name?: string | null;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  credit?: number | null;
};

function normalizeCustomerPhone(value?: string | null) {
  return String(value || "").replace(/\D/g, "");
}

function CustomerSearchSelect({
  label,
  placeholder,
  customers,
  value,
  currency,
  onValueChange,
  onQuickAdd,
  helperText,
}: {
  label: string;
  placeholder: string;
  customers: CustomerOption[];
  value: string;
  currency: string;
  onValueChange: (value: string) => void;
  onQuickAdd: () => void;
  helperText?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = customers.find((c) => String(c.id) === value);
  const selectedLabel = selected ? formatCustomerLabel(selected, currency) : placeholder;

  const filteredCustomers = customers.filter((customer) => {
    const haystack = [
      customer.full_name,
      customer.name,
      customer.phone,
      String(customer.id),
      typeof customer.credit === "number" ? String(customer.credit) : "",
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label>{label}</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 px-2 text-[11px] font-bold"
          onClick={onQuickAdd}
        >
          + Quick Add
        </Button>
      </div>

      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery("");
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between gap-3 h-11 pr-3 font-normal"
          >
            <span className="min-w-0 flex-1 truncate text-left">
              {selectedLabel}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(92vw,680px)] p-0" align="start">
          <div className="border-b border-border/40 p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search customers..."
                autoFocus
                className="pl-9"
              />
            </div>
          </div>
          <ScrollArea className="max-h-72">
            <div className="p-1">
              {filteredCustomers.length === 0 ? (
                <div className="px-3 py-6 text-sm text-muted-foreground">No customers found.</div>
              ) : (
                filteredCustomers.map((customer) => {
                  const customerLabel = formatCustomerLabel(customer, currency);
                  const isSelected = String(customer.id) === value;
                  return (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => {
                        onValueChange(String(customer.id));
                        setOpen(false);
                        setQuery("");
                      }}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                        isSelected
                          ? "bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300"
                          : "hover:bg-muted/70 text-foreground"
                      )}
                    >
                      <span className="block min-w-0 flex-1 truncate" title={customerLabel}>
                        {customerLabel}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {helperText && (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      )}
    </div>
  );
}

// ── Main Checkout Page ─────────────────────────────
export default function CheckoutPage() {
  const params = useParams() as { id?: string | string[] } | null;
  const router = useRouter();
  
  // Extract returnTo from URL if present
  const [returnTo, setReturnTo] = useState<string | null>(null);
  
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      setReturnTo(urlParams.get("returnTo"));
    }
  }, []);

  const rawId = Array.isArray(params?.id) ? params?.id[0] : params?.id;
  const orderId = Number(rawId || 0);
  const user = useAuth((s) => s.user);
  const restaurant = useRestaurant((s) => s.restaurant);
  const curr = restaurant?.currency || "Rs.";
  const {
    canApplyDiscount,
    canProcessPayment,
    canEditPayment,
    canDeletePayment,
    canProcessRefund,
    canVoidItem,
    canMarkNc,
  } = usePosBillingPermissions();

  const { context, loading: orderLoading, fetchContext, isFullyPaid, allKotsServed } = useOrderFull(orderId);
  const [bill, setBill] = useState<OrderBill | null>(null);
  const [orderMeta, setOrderMeta] = useState<OrderMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [itemOverrides, setItemOverrides] = useState<Record<number, Partial<BillItem>>>({});

  // Payment dialog
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [payMethod, setPayMethod] = useState("cash");
  const [payAmount, setPayAmount] = useState("");
  const [payReference, setPayReference] = useState("");
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [fonepayDialogOpen, setFonepayDialogOpen] = useState(false);
  const [fonepayPrn, setFonepayPrn] = useState<string | null>(null);
  const [fonepayQr, setFonepayQr] = useState<string | null>(null);
  const [fonepayPayloadText, setFonepayPayloadText] = useState<string | null>(null);
  const [fonepayStatus, setFonepayStatus] = useState<string>("pending");
  const [fonepayLoading, setFonepayLoading] = useState(false);
  const [fonepayVerifying, setFonepayVerifying] = useState(false);
  const [selectedStaticQrIndex, setSelectedStaticQrIndex] = useState(0);
  const [selectedCardIndex, setSelectedCardIndex] = useState(0);
  const drawerBusinessLine = "restaurant";
  const [drawerSessions, setDrawerSessions] = useState<DrawerSession[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [editPaymentOpen, setEditPaymentOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<BillPayment | null>(null);
  const [editPayMethod, setEditPayMethod] = useState("cash");
  const [editPayReference, setEditPayReference] = useState("");
  const [editPaySubmitting, setEditPaySubmitting] = useState(false);
  const [editPayError, setEditPayError] = useState<string | null>(null);
  const [editSelectedStaticQrIndex, setEditSelectedStaticQrIndex] = useState(0);
  const [editSelectedCardIndex, setEditSelectedCardIndex] = useState(0);
  const [activePaymentInstruments, setActivePaymentInstruments] = useState<PaymentInstrument[]>([]);
  const [removingPaymentId, setRemovingPaymentId] = useState<number | null>(null);
  const [shouldAutoRedirectAfterPayment, setShouldAutoRedirectAfterPayment] = useState(false);
  const [editingItem, setEditingItem] = useState<BillItem | null>(null);
  const [editItemNotes, setEditItemNotes] = useState("");
  const [itemUpdating, setItemUpdating] = useState(false);


  // Multi-Payment state
  const [isMultiPayment, setIsMultiPayment] = useState(false);
  const [multiPayments, setMultiPayments] = useState<Array<{
    method: string;
    amount: string;
    reference: string;
    selectedStaticQrIndex: number;
    selectedCardIndex: number;
  }>>([
    { method: "cash", amount: "", reference: "", selectedStaticQrIndex: 0, selectedCardIndex: 0 }
  ]);

  // Guest Split Bill state
  const [guestBills, setGuestBills] = useState<any>(null);
  const [splitBillOpen, setSplitBillOpen] = useState(false);
  const [splitParts, setSplitParts] = useState<Array<{
    label: string;
    items: Record<number, number>; // order_item_id -> qty
  }>>([
    { label: "Guest 1", items: {} }
  ]);
  const [splitSubmitting, setSplitSubmitting] = useState(false);
  const [splitError, setSplitError] = useState<string | null>(null);
  const [payAllOpen, setPayAllOpen] = useState(false);
  const [payAllMethod, setPayAllMethod] = useState("cash");
  const [payAllReference, setPayAllReference] = useState("");
  const [payAllSubmitting, setPayAllSubmitting] = useState(false);

  const splitSourceItems = context?.order?.items?.length
    ? context.order.items
    : (bill?.items || []);
  const hasSuccessfulPayments = Number(bill?.total_paid || 0) > 0;
  const orderEditLocked = ["completed", "canceled"].includes(
    String(orderMeta?.status || context?.order?.status || "").toLowerCase(),
  );

  const buildSplitInitialItems = () => {
    const initialItems: Record<number, number> = {};
    splitSourceItems.forEach((item: any) => {
      initialItems[item.id] = 0;
    });
    return initialItems;
  };

  // Refund dialog
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundMethod, setRefundMethod] = useState("cash");
  const [refundReason, setRefundReason] = useState("");
  const [refundReference, setRefundReference] = useState("");
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);

  // Customer selection for Credit
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddSubmitting, setQuickAddSubmitting] = useState(false);
  const [quickAddError, setQuickAddError] = useState<string | null>(null);
  const [quickAddForm, setQuickAddForm] = useState({
    name: "",
    phone: "",
    email: "",
  });

  // Discount dialog
  const [discountOpen, setDiscountOpen] = useState(false);
  const [discountType, setDiscountType] = useState<"code" | "manual">("code");
  const [discountCode, setDiscountCode] = useState("");
  const [manualDiscountAmount, setManualDiscountAmount] = useState("");
  const [manualDiscountPercent, setManualDiscountPercent] = useState("");
  const [discountSubmitting, setDiscountSubmitting] = useState(false);

  const hasNcItems = Boolean(
    (context?.order?.items || bill?.items || []).some((item: any) => Boolean(item?.is_nc))
  );
  const selectedCheckoutCustomerId = selectedCustomerId ? parseInt(selectedCustomerId, 10) : undefined;
  const pendingCheckoutCustomerId =
    selectedCheckoutCustomerId ?? orderMeta?.customer_id;
  const ncNeedsCustomer = hasNcItems && !pendingCheckoutCustomerId;
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [loyaltyOpen, setLoyaltyOpen] = useState(false);
  const [loyaltyPoints, setLoyaltyPoints] = useState("");
  const [loyaltySubmitting, setLoyaltySubmitting] = useState(false);
  const [loyaltyError, setLoyaltyError] = useState<string | null>(null);
  const legacyPaymentQrs = useMemo<Array<{ name: string; payload: string }>>(
    () => Array.isArray((restaurant as any)?.payment_qrs)
      ? (restaurant as any).payment_qrs
          .filter((q: any) => q && typeof q.payload === "string" && q.payload.trim())
          .map((q: any) => ({ name: String(q.name || "QR"), payload: String(q.payload) }))
      : [],
    [restaurant],
  );
  const legacyPaymentCards = useMemo<Array<{ name: string; identifier?: string | null }>>(
    () => Array.isArray((restaurant as any)?.payment_cards)
      ? (restaurant as any).payment_cards
          .filter((c: any) => c && typeof c.name === "string" && c.name.trim())
          .map((c: any) => ({ name: String(c.name), identifier: c.identifier ? String(c.identifier) : null }))
      : [],
    [restaurant],
  );
  const activeCardInstruments = useMemo(
    () => activePaymentInstruments.filter((instrument) => (
      instrument.is_active &&
      String(instrument.payment_method || "").toLowerCase() === "card"
    )),
    [activePaymentInstruments],
  );
  const activeStaticQrInstruments = useMemo(
    () => activePaymentInstruments.filter((instrument) => (
      instrument.is_active &&
      String(instrument.payment_method || "").toLowerCase() === "digital"
    )),
    [activePaymentInstruments],
  );
  const staticPaymentQrs = useMemo<CheckoutQrInstrument[]>(() => {
    const activeByName = new Map(
      activeStaticQrInstruments.map((instrument) => [instrument.name, instrument]),
    );

    const mergedLegacy = legacyPaymentQrs.map((qr) => {
      const active = activeByName.get(qr.name);
      if (active) {
        return {
          name: qr.name,
          payload: qr.payload,
          instrumentType: active.instrument_type || "static_qr",
          isSelectable: true,
        };
      }
      return {
        name: qr.name,
        payload: qr.payload,
        instrumentType: "static_qr",
        isSelectable: activeStaticQrInstruments.length === 0,
      };
    });

    const activeOnly = activeStaticQrInstruments
      .filter((instrument) => !legacyPaymentQrs.some((qr) => qr.name === instrument.name))
      .map((instrument) => {
        const metadataPayload = typeof instrument.metadata_json?.payload === "string"
          ? instrument.metadata_json.payload
          : "";
        if (!metadataPayload.trim()) return null;
        return {
          name: instrument.name,
          payload: metadataPayload,
          instrumentType: instrument.instrument_type || "static_qr",
          isSelectable: true,
        };
      })
      .filter((instrument): instrument is CheckoutQrInstrument => Boolean(instrument));

    return [...mergedLegacy, ...activeOnly];
  }, [activeStaticQrInstruments, legacyPaymentQrs]);
  const staticPaymentCards = useMemo<CheckoutCardInstrument[]>(() => {
    const activeByName = new Map(
      activeCardInstruments.map((instrument) => [instrument.name, instrument]),
    );

    const mergedLegacy = legacyPaymentCards.map((card) => {
      const active = activeByName.get(card.name);
      if (active) {
        return {
          name: card.name,
          identifier: card.identifier || null,
          instrumentType: active.instrument_type || "card",
          isSelectable: true,
        };
      }
      return {
        name: card.name,
        identifier: card.identifier || null,
        instrumentType: "card",
        isSelectable: activeCardInstruments.length === 0,
      };
    });

    const activeOnly = activeCardInstruments
      .filter((instrument) => !legacyPaymentCards.some((card) => card.name === instrument.name))
      .map((instrument) => ({
        name: instrument.name,
        identifier: null,
        instrumentType: instrument.instrument_type || "card",
        isSelectable: true,
      }));

    return [...mergedLegacy, ...activeOnly];
  }, [activeCardInstruments, legacyPaymentCards]);
  const cardConfigHelpText = activeCardInstruments.length > 0
    ? "No active card instrument available for checkout. Align Finance / Accounting / Setup with this restaurant's card settings."
    : "No card account configured. Add one in Manage / Settings / Payments & POS.";
  const qrConfigHelpText = activeStaticQrInstruments.length > 0
    ? "No active static QR instrument with payload is available for checkout. Align Finance / Accounting / Setup with Manage / Settings / Payments & POS."
    : "No static QR configured. Add one in Manage / Settings / Payments & POS.";
  const hasUnsyncedLegacyCards = staticPaymentCards.some((card) => !card.isSelectable);
  const hasUnsyncedLegacyQrs = staticPaymentQrs.some((qr) => !qr.isSelectable);
  const currentCashierDrawerSessions = drawerSessions.filter(
    (session) => Number(session.cashier_id) === Number(user?.id) && isPaymentReadyDrawer(session)
  );
  const currentCashierDrawer =
    currentCashierDrawerSessions.length === 1 ? currentCashierDrawerSessions[0] : null;
  const hasCurrentCashierDrawer = Boolean(currentCashierDrawer);
  const hasCashDrawerConflict = currentCashierDrawerSessions.length > 1;
  const cashMethodSelected = !isMultiPayment
    ? payMethod === "cash"
    : multiPayments.some((row) => row.method === "cash");

  const loadCashDrawerState = useCallback(async (options?: { silent?: boolean }) => {
    if (!restaurant?.id) {
      return { ready: false, message: "Restaurant profile is not loaded." };
    }
    if (!user?.id) {
      return { ready: false, message: "Login session is not loaded." };
    }

    if (!options?.silent) setDrawerLoading(true);
    setDrawerError(null);
    try {
      const activeRes = await apiClient.get<BaseResponse<DrawerSession[]>>(
        DrawerSessionApis.active({ restaurantId: restaurant.id, businessLine: drawerBusinessLine }),
      );
      const sessions = activeRes.data?.data ?? [];
      setDrawerSessions(sessions);

      const cashierSessions = sessions.filter(
        (session) => Number(session.cashier_id) === Number(user.id) && isPaymentReadyDrawer(session)
      );
      if (cashierSessions.length === 1) {
        return { ready: true, message: "" };
      }
      if (cashierSessions.length > 1) {
        return {
          ready: false,
          message: "Multiple active cash drawers are assigned to you. Close or reassign one before taking cash.",
        };
      }
      return { ready: false, message: "Open your cash drawer from Cash Drawers before taking a cash payment." };
    } catch (err: any) {
      const message = extractApiErrorMessage(err, "Failed to load cash drawer status.");
      setDrawerError(message);
      return { ready: false, message };
    } finally {
      if (!options?.silent) setDrawerLoading(false);
    }
  }, [restaurant?.id, user?.id]);
  const ensureCashDrawerReady = useCallback(async () => {
    const result = await loadCashDrawerState({ silent: true });
    if (!result.ready) {
      setPayError(result.message);
      toast.error(result.message);
      return false;
    }
    return true;
  }, [loadCashDrawerState]);

  const loadActivePaymentInstruments = useCallback(async () => {
    if (!restaurant?.id) {
      setActivePaymentInstruments([]);
      return;
    }
    try {
      const response = await apiClient.get<BaseResponse<PaymentInstrument[]>>(
        AccountingApis.paymentInstruments({
          restaurantId: restaurant.id,
          businessLine: "restaurant",
          activeOnly: true,
        }),
      );
      setActivePaymentInstruments(response.data?.data ?? []);
    } catch (err) {
      console.error("Failed to load active payment instruments for checkout", err);
      setActivePaymentInstruments([]);
    }
  }, [restaurant?.id]);

  const fetchGuestBills = useCallback(async () => {
    if (!orderId) return;
    try {
      const res = await apiClient.get(OrderApis.getGuestBills(orderId), { params: { _t: Date.now() } });
      if (res.data.status === "success") {
        setGuestBills(res.data.data);
      } else {
        setGuestBills(null);
      }
    } catch (err) {
      console.warn("Failed to fetch guest bills, probably not split:", err);
      setGuestBills(null);
    }
  }, [orderId]);

  // ── Fetch Bill ────────────────────────────────────
  const fetchBill = useCallback(async () => {
    if (!orderId) return;
    try {
      const [billRes, orderRes] = await Promise.all([
        apiClient.get(OrderApis.getOrderBill(orderId), { params: { _t: Date.now() } }),
        apiClient.get(OrderApis.getOrder(orderId), { params: { _t: Date.now() } }),
      ]);
      if (billRes.data.status === "success") {
        setBill(billRes.data.data);
      }
      if (orderRes.data.status === "success") {
        setOrderMeta(orderRes.data.data);
      }
      setError(null);
      await fetchGuestBills();
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || "Failed to load bill");
    } finally {
      setLoading(false);
    }
  }, [orderId, fetchGuestBills]);

  const handleOpenItemEdit = (item: BillItem) => {
    setEditingItem(item);
    setEditItemNotes(item.notes || "");
  };

  const handleCloseItemEdit = () => {
    setEditingItem(null);
    setEditItemNotes("");
  };

  const attachSelectedCustomerToOrderIfNeeded = useCallback(async () => {
    if (!selectedCustomerId) return orderMeta?.customer_id || undefined;
    const customerId = parseInt(selectedCustomerId, 10);
    if (Number(orderMeta?.customer_id) === customerId) return customerId;
    await apiClient.patch(OrderApis.updateOrder(orderId), {
      customer_id: customerId,
    });
    setOrderMeta((prev) => (prev ? { ...prev, customer_id: customerId } : prev));
    return customerId;
  }, [orderId, orderMeta?.customer_id, selectedCustomerId]);

  const handleApplyItemUpdate = useCallback(async (
    targetItemId: number,
    patch: { qty?: number; notes?: string | null; is_nc?: boolean },
    options?: { successMessage?: string }
  ) => {
    if (!context?.order?.items?.length) return;

    setItemUpdating(true);
    try {
      const payload = {
        items: context.order.items.map((item: any) => {
          const isTarget = Number(item.id) === Number(targetItemId);
          const displayItem = {
            ...item,
            ...(itemOverrides[item.id] || {})
          };
          return {
            menu_item_id: item.menu_item_id,
            name_snapshot: item.name_snapshot,
            category_name_snapshot: item.category_name_snapshot,
            category_type_snapshot: item.category_type_snapshot,
            revenue_category: item.revenue_category,
            unit_price: item.unit_price,
            qty: isTarget ? (patch.qty ?? displayItem.qty) : displayItem.qty,
            notes: isTarget ? (patch.notes !== undefined ? patch.notes : (displayItem.notes || null)) : (displayItem.notes || null),
            is_nc: isTarget ? (patch.is_nc ?? Boolean(displayItem.is_nc)) : Boolean(displayItem.is_nc),
            modifiers: Array.isArray(item.modifiers)
              ? item.modifiers.map((modifier: any) => ({
                  modifier_id: modifier.modifier_id,
                  modifier_name_snapshot: modifier.modifier_name_snapshot,
                  price_adjustment_snapshot: modifier.price_adjustment_snapshot,
                }))
              : [],
          };
        }),
      };

      await apiClient.post(OrderApis.updateOrderItems(orderId), payload);
      if (options?.successMessage) toast.success(options.successMessage);
      await Promise.all([fetchContext(), fetchBill()]);
      setItemOverrides({});
    } catch (err: any) {
      console.error("Failed to update item from checkout:", err);
      toast.error(extractApiErrorMessage(err, "Failed to update item"));
      // Revert optimistic update on error
      setItemOverrides(prev => {
        const next = { ...prev };
        delete next[targetItemId];
        return next;
      });
    } finally {
      setItemUpdating(false);
    }
  }, [context?.order?.items, orderId, itemOverrides, fetchBill, fetchContext]);

  const handleSaveItemEdit = async () => {
    if (!editingItem) return;
    await handleApplyItemUpdate(
      Number(editingItem.id),
      { notes: editItemNotes || null },
      { successMessage: "Note updated" }
    );
    setEditingItem(null);
  };

  useEffect(() => {
    fetchBill();
  }, [fetchBill]);

  useEffect(() => {
    void loadActivePaymentInstruments();
  }, [loadActivePaymentInstruments]);

  useEffect(() => {
    if ((paymentOpen && cashMethodSelected) || (payAllOpen && payAllMethod === "cash")) {
      void loadCashDrawerState({ silent: true });
    }
  }, [cashMethodSelected, loadCashDrawerState, payAllMethod, payAllOpen, paymentOpen]);

  // ── Fetch Customers ───────────────────────────────
  const fetchCustomers = useCallback(async (): Promise<CustomerOption[] | null> => {
    if (!user?.restaurant_id) return null;
    try {
      const pageSize = 500;
      let skip = 0;
      const loadedCustomers: CustomerOption[] = [];
      const seenCustomerIds = new Set<number>();

      while (true) {
        const { data } = await apiClient.get(CustomerApis.listCustomers(user.restaurant_id), {
          params: { skip, limit: pageSize },
        });

        if (data.status !== "success") {
          break;
        }

        const pageCustomers = (data.data.customers || []) as CustomerOption[];
        let addedCount = 0;
        for (const customer of pageCustomers) {
          const customerId = Number(customer?.id || 0);
          if (!customerId || seenCustomerIds.has(customerId)) continue;
          seenCustomerIds.add(customerId);
          loadedCustomers.push(customer);
          addedCount += 1;
        }

        if (pageCustomers.length < pageSize || addedCount === 0) {
          break;
        }
        skip += pageSize;
      }

      setCustomers(loadedCustomers);
      return loadedCustomers;
    } catch (err: any) {
      // Fallback for roles that can checkout but don't have `customers.view`.
      // Build a selectable customer list from order history (requires `pos.view`).
      if (err?.response?.status === 403) {
        try {
          const pageSize = 1000;
          let skip = 0;
          const orders: any[] = [];
          while (true) {
            const { data: ordersData } = await apiClient.get(OrderApis.listOrders, {
              params: {
                restaurant_id: user.restaurant_id,
                limit: pageSize,
                skip,
              },
            });
            const pageOrders = ordersData?.data?.orders || [];
            orders.push(...pageOrders);
            if (pageOrders.length < pageSize) break;
            skip += pageSize;
          }

          const seen = new Set<number>();
          const derivedCustomers = orders
            .filter((o: any) => o?.customer_id)
            .map((o: any) => ({
              id: Number(o.customer_id),
              full_name: o.customer_name || "Guest",
              name: o.customer_name || "Guest",
              phone: o.customer_phone || "",
              email: null,
              credit: undefined,
            }))
            .filter((c: any) => {
              if (!c.id || seen.has(c.id)) return false;
              seen.add(c.id);
              return true;
          });
          setCustomers(derivedCustomers);
          return derivedCustomers;
        } catch (fallbackErr) {
          console.error("Failed to load fallback customers from orders:", fallbackErr);
        }
      }
      console.error("Failed to load customers:", err);
      return null;
    }
  }, [user?.restaurant_id]);

  useEffect(() => {
    if (user?.restaurant_id) {
      fetchCustomers();
    }
  }, [fetchCustomers, user?.restaurant_id]);

  // ── Auto-navigate on full payment ─────────────────
  useEffect(() => {
    if (bill?.is_fully_paid && shouldAutoRedirectAfterPayment) {
      const timer = setTimeout(() => {
        setShouldAutoRedirectAfterPayment(false);
        if (returnTo) {
          router.push(`/orders/${orderId}/receipt?returnTo=${encodeURIComponent(returnTo)}`);
        } else {
          router.push(`/orders/${orderId}/receipt`);
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [bill?.is_fully_paid, orderId, router, returnTo, shouldAutoRedirectAfterPayment]);

  // Auto-complete parent order if all child guest bills are completed
  useEffect(() => {
    const isParentOrder = guestBills && String(guestBills.anchor_order_id) === String(orderId);
    if (
      isParentOrder &&
      guestBills.split_group_id &&
      guestBills.orders.length > 0 &&
      guestBills.orders.every((g: any) => g.status === 'completed') &&
      orderMeta &&
      orderMeta.status !== 'completed' &&
      !completing
    ) {
      handleComplete();
    }
  }, [guestBills, orderId, orderMeta, completing]);


  const handleQtyChange = useCallback(async (item: BillItem, delta: number) => {
    // Read current qty from overrides or original item
    const currentQty = itemOverrides[item.id]?.qty ?? item.qty;
    const nextQty = Math.max(0, currentQty + delta);
    if (nextQty === currentQty) return;
    if (nextQty <= 0 && !canVoidItem) {
      toast.error("You do not have permission to void order items.");
      return;
    }
    // Optimistically update
    setItemOverrides(prev => ({
      ...prev,
      [item.id]: { ...(prev[item.id] || {}), qty: nextQty }
    }));
    await handleApplyItemUpdate(
      Number(item.id),
      { qty: nextQty },
      { successMessage: "Quantity updated" }
    );
  }, [canVoidItem, handleApplyItemUpdate, itemOverrides]);

  const handleNcToggle = useCallback(async (item: BillItem) => {
    if (!canMarkNc) {
      toast.error("You do not have permission to mark items as NC.");
      return;
    }
    // Read current value from overrides or original item
    const currentNc = itemOverrides[item.id]?.is_nc ?? item.is_nc;
    const nextNc = !Boolean(currentNc);
    // Optimistically update
    setItemOverrides(prev => ({
      ...prev,
      [item.id]: { ...(prev[item.id] || {}), is_nc: nextNc }
    }));
    await handleApplyItemUpdate(
      Number(item.id),
      { is_nc: nextNc },
      { successMessage: "NC status updated" }
    );
  }, [canMarkNc, handleApplyItemUpdate, itemOverrides]);
  // ── Complete Order ──
  const handleComplete = async () => {
    setCompleting(true);
    try {
      if (hasNcItems) {
        const customerId = await attachSelectedCustomerToOrderIfNeeded();
        if (!customerId) {
          toast.error("Select a customer before completing an order with NC items.");
          return;
        }
      }
      await apiClient.patch(OrderApis.updateOrderStatus(orderId), { status: "completed" });
      await fetchCustomers();
      if (returnTo) {
        router.push(returnTo);
      } else if (orderMeta?.channel === "room_service") {
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

  const handleQuickAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.restaurant_id) return;

    setQuickAddSubmitting(true);
    setQuickAddError(null);
    try {
      const phone = quickAddForm.phone.trim();
      const email = quickAddForm.email.trim();
      const payload = {
        name: quickAddForm.name.trim(),
        phone,
        email: email || undefined,
        restaurant_id: user.restaurant_id,
        is_active: true,
      };
      const res = await apiClient.post(CustomerApis.createCustomer, payload);
      if (res.data?.status !== "success") {
        throw new Error(res.data?.message || "Failed to create customer");
      }

      const created = res.data?.data;
      await fetchCustomers();
      if (created?.id) setSelectedCustomerId(String(created.id));

      setQuickAddForm({ name: "", phone: "", email: "" });
      setQuickAddOpen(false);
    } catch (err: any) {
      const backendDetail = err?.response?.data?.detail || err?.response?.data?.message || err?.message || "Failed to add customer";
      const duplicateCustomer = typeof backendDetail === "string" && /already exists/i.test(backendDetail);
      if (duplicateCustomer) {
        const refreshedCustomers = await fetchCustomers();
        const phoneDigits = normalizeCustomerPhone(quickAddForm.phone);
        const emailLower = quickAddForm.email.trim().toLowerCase();
        const existing = (refreshedCustomers || customers).find((customer) => {
          const candidatePhone = normalizeCustomerPhone(customer.phone);
          const candidateEmail = String(customer.email || "").trim().toLowerCase();
          return (
            (phoneDigits && candidatePhone && candidatePhone === phoneDigits) ||
            (emailLower && candidateEmail && candidateEmail === emailLower)
          );
        });
        if (existing?.id) {
          setSelectedCustomerId(String(existing.id));
          setQuickAddForm({ name: "", phone: "", email: "" });
          setQuickAddOpen(false);
          toast.info("Customer already exists, selected them instead.");
          return;
        }
      }
      setQuickAddError(backendDetail);
    } finally {
      setQuickAddSubmitting(false);
    }
  };

  const handleStartFonepay = useCallback(async () => {
    if (!canProcessPayment) {
      setPayError("You do not have permission to process payments.");
      return;
    }
    if (!bill) return;
    const amount = parseFloat(payAmount || String(displayBalanceDue || 0));
    if (!amount || amount <= 0) {
      setPayError("Enter a valid amount");
      return;
    }

    const initPayload = {
      order_id: orderId,
      amount: Math.min(amount, bill?.balance_due || amount),
      reference: payReference.trim() || undefined,
      restaurant_id: user?.restaurant_id,
      customer_id: orderMeta?.customer_id || undefined,
    };
    const initRes = await apiClient.post(PaymentApis.fonepayQr, initPayload);
    const payload = initRes?.data?.data || initRes?.data || {};
    const prn = String(
      findFirstStringByKey(payload, ["prn", "merchant_txn", "merchanttxn", "transaction_id"]) || ""
    );
    const qrRaw = findFirstStringByKey(payload, ["qr_image", "qrurl", "qr_url", "qr", "base64"]);
    const rawText = findFirstStringByKey(payload, ["qr_payload", "payload", "qr_string", "deeplink", "content"]);
    const qrUrl = resolveQrDisplay(qrRaw, rawText, prn);

    if (!prn) {
      throw new Error("Fonepay response missing PRN");
    }

    setFonepayPrn(prn);
    setFonepayQr(qrUrl);
    setFonepayPayloadText(typeof rawText === "string" ? rawText : null);
    setFonepayStatus("pending");
    setPaymentOpen(false);
    setFonepayDialogOpen(true);
    toast.success("Fonepay QR generated. Ask customer to complete payment.");
  }, [bill, canProcessPayment, orderId, orderMeta?.customer_id, payAmount, payReference, user?.restaurant_id]);

  const buildPaymentInstrument = useCallback(
    (
      method: string,
      qrIndex: number,
      cardIndex: number,
    ): { type: string; name: string; meta?: Record<string, any> } | null => {
      if (method === "digital") {
        const selected = staticPaymentQrs[qrIndex];
        if (!selected || !selected.isSelectable) return null;
        return {
          type: selected.instrumentType || "static_qr",
          name: selected.name,
          meta: {
            payload: selected.payload,
            index: qrIndex,
          },
        };
      }
      if (method === "card") {
        const selected = staticPaymentCards[cardIndex];
        if (!selected || !selected.isSelectable) return null;
        return {
          type: selected.instrumentType || "card",
          name: selected.name,
          meta: {
            identifier: selected.identifier || null,
            index: cardIndex,
          },
        };
      }
      return null;
    },
    [staticPaymentCards, staticPaymentQrs],
  );

  const openEditPaymentDialog = useCallback(
    (payment: BillPayment) => {
      if (!canEditPayment) {
        toast.error("You do not have permission to edit payments.");
        return;
      }
      const instrument = readPaymentInstrument(payment);
      let nextQrIndex = 0;
      let nextCardIndex = 0;
      if (instrument?.name) {
        const qrIndex = staticPaymentQrs.findIndex((q) => q.name === instrument.name);
        const cardIndex = staticPaymentCards.findIndex((c) => c.name === instrument.name);
        if (qrIndex >= 0) nextQrIndex = qrIndex;
        if (cardIndex >= 0) nextCardIndex = cardIndex;
      }
      setEditingPayment(payment);
      setEditPayMethod(payment.method || "cash");
      setEditPayReference(payment.reference || "");
      setEditSelectedStaticQrIndex(nextQrIndex);
      setEditSelectedCardIndex(nextCardIndex);
      setEditPayError(null);
      setEditPaymentOpen(true);
    },
    [canEditPayment, staticPaymentCards, staticPaymentQrs],
  );

  const handleUpdatePayment = useCallback(async () => {
    if (!editingPayment) return;
    if (!canEditPayment) {
      setEditPayError("You do not have permission to edit payments.");
      return;
    }

    if (editPayMethod === "cash" && String(editingPayment.method || "").toLowerCase() !== "cash") {
      setEditPayError("To change a non-cash payment to cash, remove it and add a new cash payment while your drawer is open.");
      return;
    }

    if (editPayMethod === "digital" && staticPaymentQrs.length === 0) {
      setEditPayError(qrConfigHelpText);
      return;
    }
    if (editPayMethod === "card" && staticPaymentCards.length === 0) {
      setEditPayError(cardConfigHelpText);
      return;
    }
    if (editPayMethod === "digital" && !staticPaymentQrs[editSelectedStaticQrIndex]?.isSelectable) {
      setEditPayError("This QR is saved in settings but not synced as an active accounting instrument yet.");
      return;
    }
    if (editPayMethod === "card" && !staticPaymentCards[editSelectedCardIndex]?.isSelectable) {
      setEditPayError("This card is saved in settings but not synced as an active accounting instrument yet.");
      return;
    }

    setEditPaySubmitting(true);
    setEditPayError(null);
    try {
      const instrument = buildPaymentInstrument(editPayMethod, editSelectedStaticQrIndex, editSelectedCardIndex);
      await apiClient.patch(OrderApis.updatePayment(orderId, editingPayment.id), {
        payment: {
          method: editPayMethod,
          reference: editPayReference.trim() || null,
          instrument,
        },
      });
      setEditPaymentOpen(false);
      setEditingPayment(null);
      await Promise.all([fetchBill(), fetchCustomers()]);
      toast.success("Payment updated");
    } catch (err: any) {
      setEditPayError(err?.response?.data?.detail || "Failed to update payment");
    } finally {
      setEditPaySubmitting(false);
    }
  }, [
    buildPaymentInstrument,
    editPayMethod,
    editPayReference,
    editSelectedCardIndex,
    editSelectedStaticQrIndex,
    editingPayment,
    fetchBill,
    fetchCustomers,
    orderId,
    staticPaymentCards.length,
    staticPaymentQrs.length,
    cardConfigHelpText,
    qrConfigHelpText,
    canEditPayment,
  ]);

  const handleRemovePayment = useCallback(async (payment: BillPayment) => {
    if (!canDeletePayment) {
      toast.error("You do not have permission to remove payments.");
      return;
    }
    if (removingPaymentId !== null) return;

    const amount = Number(payment.amount || 0);
    if (amount < 0) {
      toast.error("Refund payments cannot be removed.");
      return;
    }

    const shouldRemove = window.confirm(
      `Remove this payment?\n\nMethod: ${String(payment.method || "").toUpperCase()}\nAmount: ${formatCurrency(Math.abs(amount), curr)}`
    );
    if (!shouldRemove) return;

    setRemovingPaymentId(payment.id);
    try {
      await apiClient.delete(OrderApis.removePayment(orderId, payment.id));
      await Promise.all([fetchBill(), fetchContext(), fetchCustomers()]);
      setShouldAutoRedirectAfterPayment(false);
      toast.success("Payment removed");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to remove payment");
    } finally {
      setRemovingPaymentId(null);
    }
  }, [
    canDeletePayment,
    curr,
    fetchBill,
    fetchContext,
    fetchCustomers,
    orderId,
    removingPaymentId,
  ]);

  // ── Add Payment ──────────────────────────────────
  const handleAddPayment = async () => {
    if (!canProcessPayment) {
      setPayError("You do not have permission to process payments.");
      return;
    }

    if (isMultiPayment) {
      const parsedRows = multiPayments.map(p => ({
        ...p,
        amountNum: parseFloat(p.amount) || 0
      }));

      const totalAllocated = parsedRows.reduce((sum, r) => sum + r.amountNum, 0);
      if (parsedRows.some(r => r.amountNum <= 0)) {
        setPayError("All payment amounts must be greater than zero");
        return;
      }

      const tolerance = 0.01;
      if (Math.abs(totalAllocated - (bill?.balance_due || 0)) > tolerance) {
        setPayError(`Total payment amount (${totalAllocated.toFixed(2)}) must equal the balance due (${(bill?.balance_due || 0).toFixed(2)})`);
        return;
      }

      for (const row of parsedRows) {
        if (row.method === "credit" && !orderMeta?.customer_id && !selectedCustomerId) {
          setPayError("Select a customer for credit payment");
          return;
        }
        if (row.method === "digital" && staticPaymentQrs.length === 0) {
          setPayError(qrConfigHelpText);
          return;
        }
        if (row.method === "card" && staticPaymentCards.length === 0) {
          setPayError(cardConfigHelpText);
          return;
        }
        if (row.method === "digital" && !staticPaymentQrs[row.selectedStaticQrIndex]?.isSelectable) {
          setPayError("One selected QR is saved in settings but not synced as an active accounting instrument yet.");
          return;
        }
        if (row.method === "card" && !staticPaymentCards[row.selectedCardIndex]?.isSelectable) {
          setPayError("One selected card is saved in settings but not synced as an active accounting instrument yet.");
          return;
        }
      }

      if (parsedRows.some((row) => row.method === "cash") && !(await ensureCashDrawerReady())) {
        return;
      }

      setPaySubmitting(true);
      setPayError(null);
      try {
        if (selectedCustomerId && String(orderMeta?.customer_id || "") !== selectedCustomerId) {
          await apiClient.patch(OrderApis.updateOrder(orderId), {
            customer_id: parseInt(selectedCustomerId, 10),
          });
          setOrderMeta((prev) => (
            prev ? { ...prev, customer_id: parseInt(selectedCustomerId, 10) } : prev
          ));
        }

        for (let i = 0; i < parsedRows.length; i++) {
          const row = parsedRows[i];
          const instrument = buildPaymentInstrument(row.method, row.selectedStaticQrIndex, row.selectedCardIndex);
          
          await apiClient.post(OrderApis.addPayment(orderId), {
            payment: {
              method: row.method,
              amount: row.amountNum,
              reference: row.reference.trim() || null,
              instrument,
              status: "success",
            },
          });
        }

        setPaymentOpen(false);
        setMultiPayments([{ method: "cash", amount: "", reference: "", selectedStaticQrIndex: 0, selectedCardIndex: 0 }]);
        setIsMultiPayment(false);
        await Promise.all([fetchBill(), fetchCustomers()]);
        toast.success("Multiple payments processed successfully");
        setShouldAutoRedirectAfterPayment(true);
      } catch (err: any) {
        // Backend sometimes throws 500/400 but payment succeeds. Verify:
        try {
          const checkBill = await apiClient.get(OrderApis.getOrderBill(orderId));
          if (checkBill.data?.data?.total_paid > (bill?.total_paid || 0)) {
            setPaymentOpen(false);
            setMultiPayments([{ method: "cash", amount: "", reference: "", selectedStaticQrIndex: 0, selectedCardIndex: 0 }]);
            setIsMultiPayment(false);
            await Promise.all([fetchBill(), fetchCustomers()]);
            toast.success("Multiple payments processed successfully");
            if (checkBill.data.data.payment_complete) setShouldAutoRedirectAfterPayment(true);
            return;
          }
        } catch (e) {}
        setPayError(err?.response?.data?.detail || "Failed to process multiple payments");
      } finally {
        setPaySubmitting(false);
      }
      return;
    }

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

    if (payMethod === "digital" && staticPaymentQrs.length === 0) {
      setPayError(qrConfigHelpText);
      return;
    }

    if (payMethod === "card" && staticPaymentCards.length === 0) {
      setPayError(cardConfigHelpText);
      return;
    }
    if (payMethod === "digital" && !staticPaymentQrs[selectedStaticQrIndex]?.isSelectable) {
      setPayError("This QR is saved in settings but not synced as an active accounting instrument yet.");
      return;
    }
    if (payMethod === "card" && !staticPaymentCards[selectedCardIndex]?.isSelectable) {
      setPayError("This card is saved in settings but not synced as an active accounting instrument yet.");
      return;
    }

    if (payMethod === "cash" && !(await ensureCashDrawerReady())) {
      return;
    }

    setPaySubmitting(true);
    setPayError(null);
    try {
      if (selectedCustomerId && String(orderMeta?.customer_id || "") !== selectedCustomerId) {
        await apiClient.patch(OrderApis.updateOrder(orderId), {
          customer_id: parseInt(selectedCustomerId, 10),
        });
        setOrderMeta((prev) => (
          prev
            ? { ...prev, customer_id: parseInt(selectedCustomerId, 10) }
            : prev
        ));
      }

      if (payMethod === "fonepay") {
        await handleStartFonepay();
        return;
      }

      const instrument = buildPaymentInstrument(payMethod, selectedStaticQrIndex, selectedCardIndex);

      const res = await apiClient.post(OrderApis.addPayment(orderId), {
        payment: {
          method: payMethod,
          amount: Math.min(amount, bill?.balance_due || amount),
          reference: payReference.trim() || null,
          instrument,
          status: "success",
        },
      });
      setPaymentOpen(false);
      setPayAmount("");
      setPayReference("");
      setPayMethod("cash");
      await Promise.all([fetchBill(), fetchCustomers()]);
      
      if (res.data?.data?.payment_complete) {
        setShouldAutoRedirectAfterPayment(true);
      }
    } catch (err: any) {
      // Backend sometimes throws 500/400 but payment succeeds. Verify:
      try {
        const checkBill = await apiClient.get(OrderApis.getOrderBill(orderId));
        if (checkBill.data?.data?.total_paid > (bill?.total_paid || 0)) {
          setPaymentOpen(false);
          setPayAmount("");
          setPayReference("");
          setPayMethod("cash");
          await Promise.all([fetchBill(), fetchCustomers()]);
          if (checkBill.data.data.payment_complete) setShouldAutoRedirectAfterPayment(true);
          return;
        }
      } catch (e) {}
      setPayError(err?.response?.data?.detail || "Failed to add payment");
    } finally {
      setPaySubmitting(false);
    }
  };

  // Guest split bill handlers
  const handleSplitBill = async () => {
    if (splitParts.length < 2) {
      setSplitError("You must split the bill into at least two parts");
      return;
    }

    if (hasSuccessfulPayments) {
      setSplitError("Cannot split a bill that already has successful payments.");
      return;
    }

    const partsPayload = splitParts.map(part => ({
      label: part.label.trim() || "Guest",
      lines: (Object.entries(part.items) as Array<[string, number]>)
        .filter(([_, qty]) => qty > 0)
        .map(([itemId, qty]) => ({
          order_item_id: Number(itemId),
          qty: qty
        }))
    })).filter(part => part.lines.length > 0);

    if (partsPayload.length < 2) {
      setSplitError("At least two guests must have items assigned to them");
      return;
    }

    setSplitSubmitting(true);
    setSplitError(null);
    try {
      await apiClient.post(OrderApis.splitBill(orderId), {
        source_order_id: orderId,
        parts: partsPayload,
        keep_unassigned_in_parent: true
      });
      toast.success("Bill split successfully");
      setSplitBillOpen(false);
      await fetchBill();
    } catch (err: any) {
      setSplitError(extractApiErrorMessage(err, "Failed to split bill"));
    } finally {
      setSplitSubmitting(false);
    }
  };

  const handleCancelSplit = async () => {
    const confirmCancel = window.confirm("Are you sure you want to revert the split? This will merge all guest bills back into the main order.");
    if (!confirmCancel) return;

    try {
      await apiClient.post(OrderApis.cancelGuestBillSplit(orderId));
      toast.success("Split reverted successfully");
      await fetchBill();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to revert split");
    }
  };

  const handlePayAllGuestBills = async () => {
    if (payAllMethod === "cash" && !(await ensureCashDrawerReady())) {
      return;
    }
    setPayAllSubmitting(true);
    try {
      await apiClient.post(OrderApis.payAllGuestBills(orderId), {
        method: payAllMethod,
        reference: payAllReference.trim() || null
      });
      toast.success("All guest bills paid successfully");
      setPayAllOpen(false);
      setPayAllReference("");
      await fetchBill();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to pay all guest bills");
    } finally {
      setPayAllSubmitting(false);
    }
  };

  const handleIssueRefund = async () => {
    const entered = parseFloat(refundAmount) || 0;
    if (entered <= 0) {
      setRefundError("Amount must be greater than zero");
      return;
    }
    if (entered > bill!.total_paid) {
      setRefundError(`Amount cannot exceed total paid: ${formatCurrency(bill!.total_paid, curr)}`);
      return;
    }
    if (!refundReason.trim()) {
      setRefundError("Reason is required");
      return;
    }

    setRefundSubmitting(true);
    setRefundError(null);
    try {
      await apiClient.post(OrderApis.refundOrder(orderId), {
        amount: entered,
        reason: refundReason.trim(),
        method: refundMethod,
        reference: refundReference.trim() || null,
      });
      setRefundOpen(false);
      setRefundAmount("");
      setRefundReason("");
      setRefundReference("");
      await fetchBill();
      toast.success("Refund processed successfully");
    } catch (err: any) {
      setRefundError(err?.response?.data?.detail || "Failed to process refund");
    } finally {
      setRefundSubmitting(false);
    }
  };

  const handleVerifyFonepay = useCallback(async () => {
    if (!fonepayPrn || !bill || fonepayVerifying) return;

    setFonepayVerifying(true);
    try {
      const statusRes = await apiClient.get(PaymentApis.fonepayStatus(fonepayPrn), {
        params: { order_id: orderId, restaurant_id: user?.restaurant_id },
      });
      const payload = statusRes?.data?.data || statusRes?.data || {};
      const statusRaw = String(payload?.status ?? payload?.payment_status ?? payload?.state ?? "").toLowerCase();
      const isSuccess = Boolean(
        payload?.is_paid ||
        payload?.paid ||
        payload?.success ||
        payload?.payment_complete ||
        statusRaw === "success" ||
        statusRaw === "paid" ||
        statusRaw === "completed" ||
        statusRaw === "settled"
      );

      setFonepayStatus(statusRaw || (isSuccess ? "success" : "pending"));

      if (!isSuccess) return;

      const paidAmountRaw = Number(payload?.amount ?? payload?.paid_amount ?? payload?.total_amount ?? 0);
      const amountToApply = Math.min(
        paidAmountRaw > 0 ? paidAmountRaw : displayBalanceDue,
        displayBalanceDue
      );

      // Only attempt to record the payment if there's still a balance due.
      // The webhook may have already posted it — any 400 from addPayment here
      // means the payment is already recorded, so we safely swallow it.
      if (amountToApply > 0.009) {
        try {
          await apiClient.post(OrderApis.addPayment(orderId), {
            payment: {
              method: "fonepay",
              amount: amountToApply,
              reference: fonepayPrn,
              status: "success",
            },
          });
        } catch (payErr: any) {
          // Swallow any 400 — the webhook likely already recorded this payment.
          // Only re-throw network errors or 5xx server errors.
          const statusCode = payErr?.response?.status;
          if (!statusCode || statusCode >= 500) {
            throw payErr;
          }
          // 400/409 etc — payment already posted, continue to sync bill
          console.warn("[Fonepay] Payment already recorded by webhook, skipping duplicate post.");
        }
      }

      await Promise.all([fetchBill(), fetchContext(), fetchCustomers()]);
      setFonepayDialogOpen(false);
      setFonepayPrn(null);
      setFonepayQr(null);
      setFonepayPayloadText(null);
      setFonepayStatus("success");
      setPayAmount("");
      setPayReference("");
      setPayMethod("cash");
      setShouldAutoRedirectAfterPayment(true);
      toast.success("Fonepay payment verified and synced.");
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to verify Fonepay payment";
      toast.error(detail);
    } finally {
      setFonepayVerifying(false);
    }
  }, [bill, fetchBill, fetchContext, fonepayPrn, fonepayVerifying, orderId, user?.restaurant_id]);

  useEffect(() => {
    if (!fonepayDialogOpen || !fonepayPrn) return;
    const timer = window.setInterval(() => {
      handleVerifyFonepay();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [fonepayDialogOpen, fonepayPrn, handleVerifyFonepay]);

  useEffect(() => {
    if (payMethod !== "digital") return;
    if (staticPaymentQrs.length === 0) {
      setSelectedStaticQrIndex(0);
      return;
    }
    if (selectedStaticQrIndex >= staticPaymentQrs.length) {
      setSelectedStaticQrIndex(0);
    }
  }, [payMethod, selectedStaticQrIndex, staticPaymentQrs.length]);

  useEffect(() => {
    if (payMethod !== "card") return;
    if (staticPaymentCards.length === 0) {
      setSelectedCardIndex(0);
      return;
    }
    if (selectedCardIndex >= staticPaymentCards.length) {
      setSelectedCardIndex(0);
    }
  }, [payMethod, selectedCardIndex, staticPaymentCards.length]);

  useEffect(() => {
    if (editPayMethod !== "digital") return;
    if (staticPaymentQrs.length === 0) {
      setEditSelectedStaticQrIndex(0);
      return;
    }
    if (editSelectedStaticQrIndex >= staticPaymentQrs.length) {
      setEditSelectedStaticQrIndex(0);
    }
  }, [editPayMethod, editSelectedStaticQrIndex, staticPaymentQrs.length]);

  useEffect(() => {
    if (editPayMethod !== "card") return;
    if (staticPaymentCards.length === 0) {
      setEditSelectedCardIndex(0);
      return;
    }
    if (editSelectedCardIndex >= staticPaymentCards.length) {
      setEditSelectedCardIndex(0);
    }
  }, [editPayMethod, editSelectedCardIndex, staticPaymentCards.length]);

  // ── Apply Discount ────────────────────────────────
  const cashDrawerReadinessPanel = (
    <div className="space-y-3 rounded-xl border bg-muted/20 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Banknote className="h-4 w-4 text-emerald-600" />
            Cash drawer
            {drawerLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : null}
          </div>
          {hasCurrentCashierDrawer ? (
            <p className="text-xs text-muted-foreground">
              Open: {currentCashierDrawer?.station} / {currentCashierDrawer?.drawer_key}
              {currentCashierDrawer?.counted_opening_cash != null
                ? ` - Opening ${formatCurrency(Number(currentCashierDrawer.counted_opening_cash), curr)}`
                : ""}
            </p>
          ) : hasCashDrawerConflict ? (
            <p className="text-xs text-destructive">
              Multiple active drawers are assigned to you. Close or reassign one before taking cash.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Open your cash drawer from Cash Drawers before accepting physical cash.
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadCashDrawerState()}
            disabled={drawerLoading}
            className="h-8 gap-1.5"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", drawerLoading && "animate-spin")} />
            Refresh
          </Button>
          <Button asChild size="sm" className="h-8">
            <Link href="/cash-drawers">Manage</Link>
          </Button>
        </div>
      </div>

      {drawerError ? (
        <div className="rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
          {drawerError}
        </div>
      ) : null}

      {hasCurrentCashierDrawer ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          <CheckCircle className="h-4 w-4" />
          Cash payments will be recorded in this drawer.
        </div>
      ) : !hasCashDrawerConflict ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
          No active drawer is assigned to you. Open one in Cash Drawers, then return here to take cash.
        </div>
      ) : null}
    </div>
  );
  const handleApplyDiscount = async () => {
    if (!canApplyDiscount) {
      setDiscountError("You do not have permission to apply discounts.");
      return;
    }

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
        const dueAmountForManualDiscount = Math.max(0, Number(bill?.balance_due || 0));
        const amt = parseFloat(manualDiscountAmount);
        if (!amt || amt <= 0) {
          setDiscountError("Enter a valid amount");
          setDiscountSubmitting(false);
          return;
        }
        if (dueAmountForManualDiscount > 0 && amt > dueAmountForManualDiscount) {
          setDiscountError("Discount cannot exceed balance due");
          setDiscountSubmitting(false);
          return;
        }
        await apiClient.patch(OrderApis.updateOrder(orderId), {
          manual_discount_amount: Number(amt.toFixed(2)),
        });
      }
      setDiscountOpen(false);
      setDiscountCode("");
      setManualDiscountAmount("");
      setManualDiscountPercent("");
      await fetchBill();
    } catch (err: any) {
      setDiscountError(err?.response?.data?.detail || "Failed to apply discount");
    } finally {
      setDiscountSubmitting(false);
    }
  };

  // ── Remove Discount ───────────────────────────────
  const handleRemoveDiscount = async () => {
    if (!canApplyDiscount) {
      toast.error("You do not have permission to modify discounts.");
      return;
    }

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
    const receiptUrl = `/orders/${orderId}/receipt${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`;
    router.push(receiptUrl);
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

  const computedDiscount = Math.max(
    0,
    Number((bill.subtotal + bill.tax_total + bill.service_charge - bill.grand_total).toFixed(2))
  );
  const hasDiscount = computedDiscount > 0;
  const displayBillItems = bill.items.map((item) => {
    const overrides = itemOverrides[item.id] || {};
    const displayItem = {
      ...item,
      ...overrides,
      qty: overrides.qty ?? item.qty,
      notes: overrides.notes !== undefined ? overrides.notes : item.notes,
      is_nc: overrides.is_nc !== undefined ? overrides.is_nc : item.is_nc,
    };
    return {
      ...displayItem,
      line_total: getItemEffectiveLineTotal(displayItem),
    };
  });
  const displaySubtotal = Number(displayBillItems.reduce((sum, item) => sum + Number(item.line_total || 0), 0).toFixed(2));
  const displayGrandTotal = Number((displaySubtotal + Number(bill.tax_total || 0) + Number(bill.service_charge || 0) - computedDiscount).toFixed(2));
  const displayBalanceDue = Math.max(0, Number((displayGrandTotal - Number(bill.total_paid || 0)).toFixed(2)));
  const displayIsFullyPaid = displayBalanceDue <= 0;
  const showCheckoutControls = !displayIsFullyPaid
    || hasNcItems
    || (guestBills?.orders?.length > 0 && guestBills?.split_group_id);
  const dueAmountForManualDiscount = displayBalanceDue;
  const checkoutCustomerId = selectedCheckoutCustomerId ?? orderMeta?.customer_id;
  const checkoutCustomer = checkoutCustomerId
    ? customers.find((c: any) => Number(c?.id) === Number(checkoutCustomerId))
    : null;
  const availableLoyaltyPoints = Number(checkoutCustomer?.loyalty_points || 0);
  const customerTotalSpent = Number(checkoutCustomer?.total_spent ?? checkoutCustomer?.totalSpent ?? checkoutCustomer?.lifetime_spent ?? 0);
  const customerCredit = Number(checkoutCustomer?.credit ?? checkoutCustomer?.outstanding_credit ?? 0);
  const customerMaxDiscount = Number(
    checkoutCustomer?.max_discount ??
    checkoutCustomer?.max_discount_amount ??
    checkoutCustomer?.loyalty_max_discount ??
    0
  );
  const orderLabel = orderMeta?.table_name
    ? `${orderMeta.table_name} • Order #${orderMeta.restaurant_order_id || orderId}`
    : `Order #${orderMeta?.restaurant_order_id || orderId}`;

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-8">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => {
            if (returnTo) router.push(returnTo);
            else if (orderMeta?.channel === "room_service") router.push("/rooms/checkin");
             else router.back();
            }} className="rounded-xl">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {orderMeta?.channel === "room_service" ? "Room Folio & Checkout" : "Bill & Payment"}
            </h1>
            <p className="text-sm text-muted-foreground">{orderLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchBill} className="gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          {displayIsFullyPaid && (
            <Button variant="outline" size="sm" onClick={handlePrintReceipt} className="gap-2">
              <Printer className="h-3.5 w-3.5" /> Print
            </Button>
          )}
        </div>
      </div>

      {/* ── Fully Paid Banner ── */}
      {displayIsFullyPaid && (!guestBills?.split_group_id || guestBills.orders.every((g: any) => g.is_fully_paid)) && (
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
                      <th className="text-center p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground w-40">Qty</th>
                      <th className="text-right p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground w-28">Price</th>
                      <th className="text-right p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground w-32">Total</th>
                      <th className="text-right p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground w-44">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayBillItems.map((displayItem) => {
                      const item = bill.items.find((source) => source.id === displayItem.id) || displayItem;
                      return (
                      <tr key={item.id} className="border-b border-border/30 hover:bg-muted/10 transition-colors">
                        <td className="p-4">
                          <p className="font-medium text-sm">{displayItem.name_snapshot}</p>
                          {displayItem.category_name_snapshot && (
                            <p className="text-xs text-muted-foreground">{displayItem.category_name_snapshot}</p>
                          )}
                          {displayItem.modifiers.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {displayItem.modifiers.map((m) => (
                                <Badge key={m.id} variant="secondary" className="text-[10px] font-normal">
                                  {m.modifier_name_snapshot}
                                  {m.price_adjustment_snapshot !== 0 && (
                                    <span className="ml-1">+{formatCurrency(m.price_adjustment_snapshot, curr)}</span>
                                  )}
                                </Badge>
                              ))}
                            </div>
                          )}
                          {displayItem.notes && (
                            <p className="text-xs text-muted-foreground mt-1 italic">{displayItem.notes}</p>
                          )}
                          {displayItem.is_nc && (
                            <Badge variant="outline" className="mt-2 h-5 text-[10px] font-semibold text-orange-600 border-orange-500/40">
                              NC
                            </Badge>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              disabled={orderEditLocked || itemUpdating || (displayItem.qty <= 1 && !canVoidItem)}
                              onClick={() => void handleQtyChange(item, -1)}
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </Button>
                            <div className="min-w-[2.5rem] text-center font-semibold tabular-nums">
                              {displayItem.qty}
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              disabled={orderEditLocked || itemUpdating}
                              onClick={() => void handleQtyChange(item, 1)}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                        <td className="p-4 text-right text-sm tabular-nums text-muted-foreground">
                          {formatCurrency(displayItem.unit_price, curr)}
                        </td>
                        <td className="p-4 text-right font-semibold tabular-nums">
                          {formatCurrency(displayItem.line_total, curr)}
                        </td>
                        <td className="p-4 text-right">
                          {!orderEditLocked ? (
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                variant={displayItem.is_nc ? "default" : "outline"}
                                size="sm"
                                className={cn(
                                  "h-8 gap-1.5 px-2 text-xs font-semibold",
                                  displayItem.is_nc && "bg-orange-500 hover:bg-orange-600 text-white"
                                )}
                                disabled={itemUpdating || !canMarkNc}
                                onClick={() => handleNcToggle(item)}
                              >
                                <Award className="h-3.5 w-3.5" />
                                NC
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1.5 px-2 text-xs font-semibold"
                                onClick={() => handleOpenItemEdit(item)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Note
                              </Button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">
                              Locked
                            </span>
                          )}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
          {orderEditLocked && (
            <p className="text-xs text-muted-foreground">
              Item quantity changes are available until the order is completed or canceled. Completed-order item changes need backend support.
            </p>
          )}
          <Dialog
            open={Boolean(editingItem)}
            onOpenChange={(open) => {
              if (!open) handleCloseItemEdit();
            }}
          >
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Edit Note</DialogTitle>
                <DialogDescription>
                  {editingItem ? editingItem.name_snapshot : "Update the item note."}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2">
                <Textarea
                  value={editItemNotes}
                  onChange={(e) => setEditItemNotes(e.target.value)}
                  placeholder="Add a note for this item"
                  className="min-h-[96px]"
                />
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={handleCloseItemEdit}>Cancel</Button>
                <Button
                  onClick={handleSaveItemEdit}
                  disabled={!editingItem || itemUpdating}
                  className="gap-2"
                >
                  {itemUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Save Note
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          {hasNcItems && !pendingCheckoutCustomerId && (
            <Card className="border-amber-500/30 bg-amber-500/10">
              <CardContent className="p-4 text-sm">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 text-amber-500" />
                  <div>
                    <p className="font-semibold text-foreground">Customer required before checkout</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      NC items can be marked here, but you must select a customer in checkout before payment or completion.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Right: Summary & Actions ── */}
        <div className="space-y-4">
          {/* Bill Summary */}
          <Card className="border-border/40">
            <CardContent className="p-5 space-y-3">
              <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground mb-4">Summary</h3>

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">{formatCurrency(displaySubtotal, curr)}</span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Tax {(bill as any).tax_rate !== undefined ? `(${(bill as any).tax_rate * 100}%)` : ""}
                  {bill.tax_breakdown_note && (
                    <span className="text-xs ml-1">({bill.tax_breakdown_note})</span>
                  )}
                </span>
                <span className="tabular-nums">{formatCurrency(bill.tax_total, curr)}</span>
              </div>

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
                    {!displayIsFullyPaid && canApplyDiscount && (
                      <button onClick={handleRemoveDiscount} className="text-destructive hover:text-destructive/80 ml-1">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <span className="tabular-nums text-emerald-600 font-medium">-{formatCurrency(computedDiscount, curr)}</span>
                </div>
              )}

              <Separator />

              <div className="flex justify-between font-bold text-lg">
                <span>Grand Total</span>
                <span className="tabular-nums">{formatCurrency(displayGrandTotal, curr)}</span>
              </div>

              <Separator />

              {bill.total_paid > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Paid</span>
                  <span className="tabular-nums text-emerald-600 font-medium">{formatCurrency(bill.total_paid, curr)}</span>
                </div>
              )}

              <div className="flex justify-between font-bold text-base">
                <span className={displayBalanceDue > 0 ? "text-destructive" : "text-emerald-600"}>
                  {displayBalanceDue > 0 ? "Balance Due" : "Settled"}
                </span>
                <span className={cn("tabular-nums", displayBalanceDue > 0 ? "text-destructive" : "text-emerald-600")}>
                  {formatCurrency(displayBalanceDue, curr)}
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
                  const instrument = readPaymentInstrument(p);
                  const isRemoving = removingPaymentId === p.id;
                  const canRemovePayment = Number(p.amount || 0) >= 0;
                  return (
                    <div key={p.id} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
                      <div className="flex items-center gap-3">
                        <div className={cn("p-2 rounded-lg bg-muted/50", method?.color)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium capitalize">{p.method}</p>
                          {instrument?.name && (
                            <p className="text-xs text-muted-foreground">
                              {instrument.name}
                            </p>
                          )}
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
                      <div className="flex items-center gap-3">
                        <span className="font-semibold tabular-nums">{formatCurrency(p.amount, curr)}</span>
                        {canEditPayment && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-[11px]"
                            disabled={isRemoving}
                            onClick={() => openEditPaymentDialog(p)}
                          >
                            Edit
                          </Button>
                        )}
                        {canDeletePayment && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-[11px] text-destructive hover:text-destructive"
                            disabled={isRemoving || !canRemovePayment}
                            onClick={() => handleRemovePayment(p)}
                          >
                            {isRemoving ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                            <span className="ml-1">Remove</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          {showCheckoutControls && (
            <div className="space-y-3">
              <Card className="border-border/40">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Award className="h-4 w-4 text-orange-600" />
                      <span className="text-sm font-semibold">Loyalty & Customer</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {checkoutCustomer ? "Customer selected" : "Select customer"}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <CustomerSearchSelect
                      label="Customer"
                      placeholder="Select customer to view loyalty details"
                      customers={customers}
                      value={checkoutCustomerId ? String(checkoutCustomerId) : ""}
                      currency={curr}
                      onValueChange={setSelectedCustomerId}
                      onQuickAdd={() => setQuickAddOpen(true)}
                    />
                  </div>

                  {hasNcItems && !pendingCheckoutCustomerId && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
                      <p className="font-semibold text-foreground">NC items are on this order.</p>
                      <p className="mt-1 text-muted-foreground">
                        Select a customer here before taking payment or completing the order.
                      </p>
                    </div>
                  )}

                  {checkoutCustomer ? (
                    <>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg border p-2">
                          <p className="text-muted-foreground">Points</p>
                          <p className="font-bold tabular-nums">{availableLoyaltyPoints}</p>
                        </div>
                        <div className="rounded-lg border p-2">
                          <p className="text-muted-foreground">Total Spent</p>
                          <p className="font-bold tabular-nums">{formatCurrency(customerTotalSpent, curr)}</p>
                        </div>
                        <div className="rounded-lg border p-2">
                          <p className="text-muted-foreground">Credit</p>
                          <p className="font-bold tabular-nums">{formatCurrency(customerCredit, curr)}</p>
                        </div>
                        <div className="rounded-lg border p-2">
                          <p className="text-muted-foreground">Max Discount</p>
                          <p className="font-bold tabular-nums">{formatCurrency(customerMaxDiscount, curr)}</p>
                        </div>
                      </div>

                      {canApplyDiscount && (
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full"
                          onClick={() => {
                            setLoyaltyError(null);
                            setLoyaltyPoints("");
                            setLoyaltyOpen(true);
                          }}
                          disabled={availableLoyaltyPoints <= 0}
                        >
                          Redeem Loyalty Points
                        </Button>
                      )}
                      {availableLoyaltyPoints <= 0 && (
                        <p className="text-xs text-muted-foreground">
                          No redeemable points available for this customer.
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Select a customer to view loyalty details and redeem points before payment.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Guest Bills Section */}
              {guestBills?.orders?.length > 0 && guestBills?.split_group_id && String(guestBills.anchor_order_id) === String(orderId) && (
                <div className="space-y-3 mb-4">
                  <Card className="border-orange-200 bg-orange-50/20 dark:bg-orange-950/10">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-orange-100 dark:border-orange-900/50 pb-2">
                        <h3 className="font-bold text-sm text-orange-600 dark:text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Users className="h-4 w-4" /> Guest Bills ({guestBills.orders.length})
                        </h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCancelSplit}
                          className="h-8 text-xs text-muted-foreground hover:text-destructive gap-1 px-2"
                        >
                          <X className="h-3 w-3" /> Revert Split
                        </Button>
                      </div>

                      <div className="space-y-2">
                        {guestBills.orders.map((gOrder: any) => (
                          <div key={gOrder.order_id} className="flex items-center justify-between p-2 rounded-lg border bg-background/50 text-sm">
                            <div>
                              <p className="font-semibold text-xs sm:text-sm">{gOrder.split_label || `Guest ${gOrder.split_sequence}`}</p>
                              <p className="text-[10px] text-muted-foreground">Order #{gOrder.order_id}</p>
                            </div>
                            <div className="text-right flex items-center gap-2 sm:gap-3">
                              <div>
                                <p className="font-bold tabular-nums text-xs sm:text-sm">{formatCurrency(gOrder.grand_total, curr)}</p>
                                {gOrder.is_fully_paid ? (
                                  <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 text-[10px] px-1.5 py-0">Paid</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-orange-600 border-orange-200 text-[10px] px-1.5 py-0">Pending</Badge>
                                )}
                              </div>
                              {!gOrder.is_fully_paid && (
                                <Button
                                  size="sm"
                                  className="h-8 px-2.5 font-semibold text-xs"
                                  onClick={() => {
                                    if (String(gOrder.order_id) === String(orderId)) {
                                      setPayAmount(displayBalanceDue.toFixed(2));
                                      setPaymentOpen(true);
                                    } else {
                                      router.push(`/orders/${gOrder.order_id}/checkout?returnTo=${encodeURIComponent(window.location.pathname)}`);
                                    }
                                  }}
                                >
                                  Pay
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {!guestBills.orders.every((g: any) => g.is_fully_paid) && (
                        <Button
                          type="button"
                          className="w-full h-10 bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs sm:text-sm gap-2"
                          onClick={() => {
                            setPayAllMethod("cash");
                            setPayAllReference("");
                            setPayAllOpen(true);
                          }}
                        >
                          <CreditCard className="h-4 w-4" /> Pay All Guest Bills
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {canProcessPayment && displayBalanceDue > 0 ? (
                <Button
                  className="w-full h-12 text-base font-semibold shadow-lg gap-2"
                  onClick={async () => {
                    if (hasNcItems) {
                      const customerId = await attachSelectedCustomerToOrderIfNeeded();
                      if (!customerId) {
                        setPayError("Select a customer before taking payment for an order with NC items.");
                        toast.error("Select a customer before taking payment for an order with NC items.");
                        return;
                      }
                    }
                    setPayAmount(displayBalanceDue.toFixed(2));
                    setPaymentOpen(true);
                  }}
                  disabled={guestBills?.orders?.length > 0 && guestBills?.split_group_id && String(guestBills.anchor_order_id) === String(orderId) && !guestBills.orders.every((g: any) => g.is_fully_paid)}
                >
                  <CreditCard className="h-4 w-4" />
                  Take Payment ({formatCurrency(displayBalanceDue, curr)})
                  </Button>
              ) : displayBalanceDue > 0 ? (
                <p className="text-xs text-muted-foreground text-center px-2">
                  Payment processing requires the billing.payment.process permission.
                </p>
              ) : null}

              {guestBills?.orders?.length > 0 && guestBills?.split_group_id && String(guestBills.anchor_order_id) === String(orderId) && !guestBills.orders.every((g: any) => g.is_fully_paid) && (
                <p className="text-[11px] text-orange-600 dark:text-orange-400 text-center mt-1">
                  Please settle individual Guest Bills above.
                </p>
              )}

              {canProcessRefund && bill.total_paid > 0 && !displayIsFullyPaid && (
                <Button
                  variant="destructive"
                  className="w-full h-12 text-base font-semibold shadow-lg gap-2 mt-3"
                  onClick={() => {
                    setRefundAmount("");
                    setRefundReason("");
                    setRefundReference("");
                    setRefundError(null);
                    setRefundOpen(true);
                  }}
                >
                  <RefreshCw className="h-4 w-4" />
                  Issue Refund
                </Button>
              )}

              <div className="grid grid-cols-2 gap-3 mt-3">
                {canApplyDiscount && (
                  <Button
                    variant="outline"
                    className="gap-2 text-xs sm:text-sm"
                    onClick={() => setDiscountOpen(true)}
                  >
                    <Tag className="h-4 w-4" />
                    {hasDiscount ? "Discount" : "Add Discount"}
                  </Button>
                )}
                {/* Split Bill Button */}
                <Button
                  variant="outline"
                  className="gap-2 text-xs sm:text-sm text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950/20 border-orange-200"
                  onClick={() => {
                    const initialItems = buildSplitInitialItems();
                    setSplitParts([
                      { label: "Guest 1", items: { ...initialItems } },
                      { label: "Guest 2", items: { ...initialItems } }
                    ]);
                    setSplitError(null);
                    setSplitBillOpen(true);
                  }}
                  disabled={displayIsFullyPaid || hasSuccessfulPayments || (guestBills?.orders?.length > 0 && guestBills?.split_group_id)}
                >
                  <RefreshCw className="h-4 w-4" />
                  Split Bill
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-3">
                <Button
                  variant="outline"
                  className="gap-2 text-xs sm:text-sm"
                  onClick={() => router.push(`/orders/${orderId}/edit`)}
                >
                  <Receipt className="h-4 w-4" />
                  Edit Order
                </Button>
                <Button
                  variant="outline"
                  className="gap-2 text-xs sm:text-sm"
                  onClick={() => router.push(`/orders/${orderId}/receipt${returnTo ? '?returnTo=' + encodeURIComponent(returnTo) : ''}`)}
                >
                  <Printer className="h-4 w-4" />
                  Pre-Bill
                </Button>
              </div>
            </div>
          )}

          {displayIsFullyPaid && (
            <div className="space-y-3">
              {(allKotsServed || orderMeta?.channel === "room_service") && orderMeta?.status !== 'completed' && (
                <Button 
                  className="w-full h-12 text-base font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20 shadow-lg gap-2"
                  onClick={handleComplete}
                  disabled={completing || ncNeedsCustomer}
                >
                  {completing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  {ncNeedsCustomer
                    ? "Select Customer For NC"
                    : `Complete ${orderMeta?.channel === "room_service" ? "Stay & Checkout" : "Order"}`}
                </Button>
              )}

              {canProcessRefund && bill.total_paid > 0 && (
                <Button
                  variant="destructive"
                  className="w-full h-12 text-base font-semibold shadow-lg gap-2"
                  onClick={() => {
                    setRefundAmount("");
                    setRefundReason("");
                    setRefundReference("");
                    setRefundError(null);
                    setRefundOpen(true);
                  }}
                >
                  <RefreshCw className="h-4 w-4" />
                  Issue Refund
                </Button>
              )}

              <Button
                variant="outline"
                className="w-full h-12 text-base font-semibold gap-2"
                onClick={() => {
                  if (returnTo) router.push(returnTo);
                  else if (orderMeta?.channel === "room_service") router.push("/rooms/checkin");
                  else router.push("/orders/active");
                }}
              >
                <CheckCircle className="h-4 w-4" />
                {orderMeta?.channel === "room_service" ? "Back to Rooms" : "Back to Orders"}
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

      <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Note</DialogTitle>
            <DialogDescription>
              Add or update a note for this item.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Notes</Label>
              <Input
                placeholder="e.g., Less spicy, no onions"
                value={editItemNotes}
                onChange={(e) => setEditItemNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingItem(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveItemEdit} disabled={itemUpdating}>
              {itemUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Payment Dialog ── */}
      <Dialog open={paymentOpen} onOpenChange={(open) => {
        setPaymentOpen(open);
        if (!open) {
          setIsMultiPayment(false);
          setMultiPayments([{ method: "cash", amount: "", reference: "", selectedStaticQrIndex: 0, selectedCardIndex: 0 }]);
        }
      }}>
        <DialogContent className="w-[96vw] sm:w-[92vw] sm:max-w-2xl max-h-[90vh] overflow-x-hidden overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Payment</DialogTitle>
            <DialogDescription>
              Balance due: <span className="font-bold text-foreground">{formatCurrency(displayBalanceDue, curr)}</span>
            </DialogDescription>
          </DialogHeader>

          {/* Toggle for Single vs Multiple */}
          <div className="flex gap-2 border-b pb-3">
            <button
              type="button"
              onClick={() => setIsMultiPayment(false)}
              className={cn(
                "flex-1 py-2 text-sm font-semibold border-b-2 transition-all",
                !isMultiPayment ? "border-primary text-primary" : "border-transparent text-muted-foreground"
              )}
            >
              Single Payment
            </button>
            <button
              type="button"
              onClick={() => {
                setIsMultiPayment(true);
                setMultiPayments([
                  { method: "cash", amount: (displayBalanceDue / 2).toFixed(2), reference: "", selectedStaticQrIndex: 0, selectedCardIndex: 0 },
                  { method: "digital", amount: (displayBalanceDue / 2).toFixed(2), reference: "", selectedStaticQrIndex: 0, selectedCardIndex: 0 }
                ]);
              }}
              className={cn(
                "flex-1 py-2 text-sm font-semibold border-b-2 transition-all",
                isMultiPayment ? "border-primary text-primary" : "border-transparent text-muted-foreground"
              )}
            >
              Multiple Payments
            </button>
          </div>

          <div className="space-y-4 py-2 min-w-0">
            {payError && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium">{payError}</div>
            )}

            {cashMethodSelected ? cashDrawerReadinessPanel : null}

            {!isMultiPayment ? (
              <>
                {/* Payment Method */}
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <div className="grid grid-cols-2 gap-2 min-w-0">
                    {PAYMENT_METHODS.map((m) => (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setPayMethod(m.value)}
                        className={cn(
                          "flex items-center gap-2 p-3 rounded-xl border-2 transition-all text-sm font-medium min-w-0",
                          payMethod === m.value
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border/50 hover:border-border text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <m.icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{m.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Customer Selection for Credit Method */}
                {payMethod === "credit" && !orderMeta?.customer_id && (
                  <div className="space-y-2">
                    <CustomerSearchSelect
                      label="Select Customer"
                      placeholder="Select a customer to assign credit tracking"
                      customers={customers}
                      value={selectedCustomerId}
                      currency={curr}
                      onValueChange={setSelectedCustomerId}
                      onQuickAdd={() => setQuickAddOpen(true)}
                    />
                  </div>
                )}
                
                {payMethod === "credit" && orderMeta?.customer_id && (
                   <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg text-sm flex items-center gap-2 border border-blue-100 dark:border-blue-900">
                      <User className="h-4 w-4" />
                      Charging to order&apos;s customer: <span className="font-bold">{orderMeta.customer_name || "Guest"}</span>
                   </div>
                )}

                {payMethod === "digital" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Static QR</Label>
                      {staticPaymentQrs.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {selectedStaticQrIndex + 1}/{staticPaymentQrs.length}
                        </span>
                      )}
                    </div>
                    {staticPaymentQrs.length === 0 ? (
                      <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                        {qrConfigHelpText}
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          {staticPaymentQrs.map((qr, idx) => (
                            <button
                              key={`${qr.name}-${idx}`}
                              type="button"
                              onClick={() => setSelectedStaticQrIndex(idx)}
                              className={cn(
                                "rounded-lg border px-3 py-2 text-left text-sm",
                                selectedStaticQrIndex === idx
                                  ? "border-primary bg-primary/5 text-primary"
                                  : "border-border/50 text-muted-foreground hover:text-foreground"
                              )}
                            >
                              <div className="font-medium truncate">{qr.name}</div>
                            </button>
                          ))}
                        </div>
                        <div className="mx-auto h-[210px] w-[210px] rounded-xl border bg-white p-2">
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=420x420&data=${encodeURIComponent(staticPaymentQrs[selectedStaticQrIndex]?.payload || "")}`}
                            alt={staticPaymentQrs[selectedStaticQrIndex]?.name || "Static payment QR"}
                            className="h-full w-full object-contain"
                          />
                        </div>
                        <p className="text-[11px] text-muted-foreground break-all">
                          {staticPaymentQrs[selectedStaticQrIndex]?.payload}
                        </p>
                      </>
                    )}
                  </div>
                )}

                {payMethod === "card" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Card Account</Label>
                      {staticPaymentCards.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {selectedCardIndex + 1}/{staticPaymentCards.length}
                        </span>
                      )}
                    </div>
                    {staticPaymentCards.length === 0 ? (
                      <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                        {cardConfigHelpText}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {staticPaymentCards.map((card, idx) => (
                          <button
                            key={`${card.name}-${idx}`}
                            type="button"
                            onClick={() => {
                              if (!card.isSelectable) return;
                              setSelectedCardIndex(idx);
                            }}
                            disabled={!card.isSelectable}
                            className={cn(
                              "rounded-lg border px-3 py-2 text-left text-sm",
                              !card.isSelectable && "opacity-60 cursor-not-allowed",
                              selectedCardIndex === idx
                                ? "border-primary bg-primary/5 text-primary"
                                : "border-border/50 text-muted-foreground hover:text-foreground"
                            )}
                          >
                            <div className="font-medium truncate">{card.name}</div>
                            <div className="text-[11px] text-muted-foreground truncate">
                              {card.identifier || "No identifier"}
                            </div>
                            {!card.isSelectable && (
                              <div className="text-[11px] text-amber-600 mt-1">
                                Saved in settings only. Sync it in Accounting Setup to use it here.
                              </div>
                            )}
                          </button>
                        ))}
                        </div>
                        {hasUnsyncedLegacyCards && (
                          <p className="text-xs text-amber-600">
                            Some cards are visible from settings but disabled because they are not active accounting instruments yet.
                          </p>
                        )}
                      </div>
                    )}
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
                    const change = entered > displayBalanceDue ? entered - displayBalanceDue : 0;
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
              </>
            ) : (
              /* Multi Payment Rows */
              <div className="space-y-4">
                <div className="space-y-3">
                  {multiPayments.map((row, idx) => (
                    <div key={idx} className="flex flex-col gap-3 p-3 border rounded-xl bg-muted/20 relative">
                      <button
                        type="button"
                        onClick={() => {
                          const newRows = [...multiPayments];
                          newRows.splice(idx, 1);
                          setMultiPayments(newRows);
                        }}
                        className="absolute right-2 top-2 p-1 hover:bg-destructive/10 hover:text-destructive rounded-lg text-muted-foreground"
                        disabled={multiPayments.length <= 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>

                      <div className="flex flex-col sm:flex-row gap-3 pt-4 sm:pt-0">
                        <div className="flex-1 space-y-2">
                          <Label>Method</Label>
                          <Select
                            value={row.method}
                            onValueChange={(val) => {
                              const newRows = [...multiPayments];
                              newRows[idx].method = val;
                              setMultiPayments(newRows);
                            }}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="cash">Cash</SelectItem>
                              <SelectItem value="card">Card</SelectItem>
                              <SelectItem value="digital">Digital (Static QR)</SelectItem>
                              <SelectItem value="credit">Credit / Charge Customer</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex-1 space-y-2">
                          <Label>Amount</Label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">{curr}</span>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={row.amount}
                              onChange={(e) => {
                                const newRows = [...multiPayments];
                                const newValStr = e.target.value;
                                newRows[idx].amount = newValStr;

                                if (newRows.length >= 2) {
                                  const targetAdjustIdx = idx === newRows.length - 1 ? 0 : newRows.length - 1;
                                  const newValNum = parseFloat(newValStr) || 0;
                                  
                                  const otherSum = newRows.reduce((sum, r, rIdx) => {
                                    if (rIdx === idx || rIdx === targetAdjustIdx) return sum;
                                    return sum + (parseFloat(r.amount) || 0);
                                  }, 0);

                                  const remaining = Math.max(0, displayBalanceDue - otherSum - newValNum);
                                  newRows[targetAdjustIdx].amount = remaining.toFixed(2);
                                }

                                setMultiPayments(newRows);
                              }}
                              className="pl-8 h-10 font-medium tabular-nums"
                            />
                          </div>
                        </div>

                        <div className="flex-1 space-y-2">
                          <Label>Ref / Notes</Label>
                          <Input
                            placeholder="Ref..."
                            value={row.reference}
                            onChange={(e) => {
                              const newRows = [...multiPayments];
                              newRows[idx].reference = e.target.value;
                              setMultiPayments(newRows);
                            }}
                            className="h-10"
                          />
                        </div>
                      </div>

                      {row.method === "card" && (
                        <div className="space-y-3 mt-1 pt-1">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs">Select Card Terminal</Label>
                          </div>
                          {staticPaymentCards.length === 0 ? (
                            <div className="rounded-lg border border-dashed p-2 text-xs text-muted-foreground">
                              {cardConfigHelpText}
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {staticPaymentCards.map((card, cIdx) => (
                                <button
                                  key={`${card.name}-${cIdx}`}
                                  type="button"
                                  onClick={() => {
                                    if (!card.isSelectable) return;
                                    const newRows = [...multiPayments];
                                    newRows[idx].selectedCardIndex = cIdx;
                                    setMultiPayments(newRows);
                                  }}
                                  disabled={!card.isSelectable}
                                  className={cn(
                                    "rounded-lg border px-2 py-1.5 text-left text-xs",
                                    !card.isSelectable && "opacity-60 cursor-not-allowed",
                                    row.selectedCardIndex === cIdx
                                      ? "border-primary bg-primary/5 text-primary"
                                      : "border-border/50 text-muted-foreground hover:text-foreground"
                                  )}
                                >
                                  <div className="font-medium truncate">{card.name}</div>
                                  {!card.isSelectable && (
                                    <div className="text-[10px] text-amber-600 mt-1 truncate">
                                      Not synced
                                    </div>
                                  )}
                                </button>
                              ))}
                              </div>
                              {hasUnsyncedLegacyCards && (
                                <p className="text-[11px] text-amber-600">
                                  Unsynced cards are shown but disabled.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {row.method === "digital" && (
                        <div className="space-y-3 mt-1 pt-1">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs">Select QR Code</Label>
                          </div>
                          {staticPaymentQrs.length === 0 ? (
                            <div className="rounded-lg border border-dashed p-2 text-xs text-muted-foreground">
                              {qrConfigHelpText}
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {staticPaymentQrs.map((qr, qIdx) => (
                                <button
                                  key={`${qr.name}-${qIdx}`}
                                  type="button"
                                  onClick={() => {
                                    const newRows = [...multiPayments];
                                    newRows[idx].selectedStaticQrIndex = qIdx;
                                    setMultiPayments(newRows);
                                  }}
                                  className={cn(
                                    "rounded-lg border px-2 py-1.5 text-left text-xs",
                                    row.selectedStaticQrIndex === qIdx
                                      ? "border-primary bg-primary/5 text-primary"
                                      : "border-border/50 text-muted-foreground hover:text-foreground"
                                  )}
                                >
                                  <div className="font-medium truncate">{qr.name}</div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const totalAllocated = multiPayments.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
                    const remaining = Math.max(0, displayBalanceDue - totalAllocated);
                    setMultiPayments([
                      ...multiPayments,
                      { method: "cash", amount: remaining > 0 ? remaining.toFixed(2) : "", reference: "", selectedStaticQrIndex: 0, selectedCardIndex: 0 }
                    ]);
                  }}
                  className="w-full gap-2 border-dashed"
                >
                  + Add Payment Row
                </Button>

                {/* Customer Selection for Credit in Multi Payment */}
                {(() => {
                  const hasCreditInMulti = multiPayments.some(r => r.method === "credit");
                  if (!hasCreditInMulti) return null;

                  return (
                    <div className="space-y-2 border-t pt-3 mt-2">
                      {!orderMeta?.customer_id ? (
                        <CustomerSearchSelect
                          label="Select Customer for Credit"
                          placeholder="Select a customer to assign credit tracking"
                          customers={customers}
                          value={selectedCustomerId}
                          currency={curr}
                          onValueChange={setSelectedCustomerId}
                          onQuickAdd={() => setQuickAddOpen(true)}
                        />
                      ) : (
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg text-sm flex items-center gap-2 border border-blue-100 dark:border-blue-900">
                          <User className="h-4 w-4" />
                          Charging to order&apos;s customer: <span className="font-bold">{orderMeta.customer_name || "Guest"}</span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Summary */}
                <div className="p-3 bg-muted/40 rounded-xl space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Balance Due:</span>
                    <span className="font-bold">{formatCurrency(displayBalanceDue, curr)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Allocated:</span>
                    {(() => {
                      const totalAllocated = multiPayments.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
                      const difference = totalAllocated - displayBalanceDue;
                      return (
                        <span className={cn(
                          "font-bold",
                          Math.abs(difference) < 0.01 ? "text-emerald-600" : "text-orange-600"
                        )}>
                          {formatCurrency(totalAllocated, curr)}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentOpen(false)}>Cancel</Button>
            <Button onClick={handleAddPayment} disabled={paySubmitting} className="gap-2">
              {paySubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              {paySubmitting ? "Processing..." : (isMultiPayment ? "Process Multiple Payments" : (payMethod === "fonepay" ? "Generate Fonepay QR" : "Add Payment"))}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editPaymentOpen} onOpenChange={setEditPaymentOpen}>
        <DialogContent className="w-[96vw] sm:w-[92vw] sm:max-w-2xl max-h-[90vh] overflow-x-hidden overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Payment</DialogTitle>
            <DialogDescription>
              Update payment method/reference after settlement. Amount is fixed for this payment record.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 min-w-0">
            {editPayError && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium">{editPayError}</div>
            )}

            <div className="rounded-lg border bg-muted/20 p-3 text-sm">
              Amount: <span className="font-semibold">{formatCurrency(Number(editingPayment?.amount || 0), curr)}</span>
            </div>

            <div className="space-y-2">
              <Label>Payment Method</Label>
              <div className="grid grid-cols-2 gap-2 min-w-0">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={`edit-${m.value}`}
                    type="button"
                    onClick={() => setEditPayMethod(m.value)}
                    className={cn(
                      "flex items-center gap-2 p-3 rounded-xl border-2 transition-all text-sm font-medium min-w-0",
                      editPayMethod === m.value
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border/50 hover:border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <m.icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {editPayMethod === "digital" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Static QR</Label>
                  {staticPaymentQrs.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {editSelectedStaticQrIndex + 1}/{staticPaymentQrs.length}
                    </span>
                  )}
                </div>
                {staticPaymentQrs.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                    {qrConfigHelpText}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {staticPaymentQrs.map((qr, idx) => (
                      <button
                        key={`edit-qr-${qr.name}-${idx}`}
                        type="button"
                        onClick={() => setEditSelectedStaticQrIndex(idx)}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-left text-sm",
                          editSelectedStaticQrIndex === idx
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border/50 text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <div className="font-medium truncate">{qr.name}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {editPayMethod === "card" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Card Account</Label>
                  {staticPaymentCards.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {editSelectedCardIndex + 1}/{staticPaymentCards.length}
                    </span>
                  )}
                </div>
                {staticPaymentCards.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                    {cardConfigHelpText}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {staticPaymentCards.map((card, idx) => (
                      <button
                        key={`edit-card-${card.name}-${idx}`}
                        type="button"
                        onClick={() => {
                          if (!card.isSelectable) return;
                          setEditSelectedCardIndex(idx);
                        }}
                        disabled={!card.isSelectable}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-left text-sm",
                          !card.isSelectable && "opacity-60 cursor-not-allowed",
                          editSelectedCardIndex === idx
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border/50 text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <div className="font-medium truncate">{card.name}</div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {card.identifier || "No identifier"}
                        </div>
                        {!card.isSelectable && (
                          <div className="text-[11px] text-amber-600 mt-1">
                            Saved in settings only. Sync it in Accounting Setup to use it here.
                          </div>
                        )}
                      </button>
                    ))}
                    </div>
                    {hasUnsyncedLegacyCards && (
                      <p className="text-xs text-amber-600">
                        Unsynced cards are shown but disabled.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="edit-pay-ref">Reference (optional)</Label>
              <Input
                id="edit-pay-ref"
                placeholder="Transaction ID, receipt number..."
                value={editPayReference}
                onChange={(e) => setEditPayReference(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPaymentOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdatePayment} disabled={editPaySubmitting} className="gap-2">
              {editPaySubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              {editPaySubmitting ? "Updating..." : "Update Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Split Bill Dialog ── */}
      <Dialog open={splitBillOpen} onOpenChange={setSplitBillOpen}>
        <DialogContent className="w-[96vw] sm:w-[92vw] sm:max-w-4xl max-h-[90vh] overflow-x-hidden overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Split Bill</DialogTitle>
            <DialogDescription>
              Assign item quantities to different guests to generate separate child bills.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2 min-w-0">
            {splitError && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium">{splitError}</div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Guests: {splitParts.length}</span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (splitParts.length <= 2) return;
                    const newParts = [...splitParts];
                    newParts.pop();
                    setSplitParts(newParts);
                  }}
                  disabled={splitParts.length <= 2}
                >
                  - Remove Guest
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSplitParts([
                      ...splitParts,
                      { label: `Guest ${splitParts.length + 1}`, items: buildSplitInitialItems() }
                    ]);
                  }}
                >
                  + Add Guest
                </Button>
              </div>
            </div>

            {/* Items Assignment Grid */}
            <div className="border rounded-xl overflow-hidden bg-muted/10">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left">
                      <th className="p-3 font-semibold">Item & Qty</th>
                      {splitParts.map((part, idx) => (
                        <th key={idx} className="p-3 font-semibold min-w-[140px]">
                          <Input
                            className="h-8 py-1 px-2 font-bold"
                            value={part.label}
                            onChange={(e) => {
                              const newParts = [...splitParts];
                              newParts[idx].label = e.target.value;
                              setSplitParts(newParts);
                            }}
                          />
                        </th>
                      ))}
                      <th className="p-3 font-semibold text-right text-muted-foreground">Unassigned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {splitSourceItems.map((item: any) => {
                      const totalAllocated = splitParts.reduce((sum, part) => sum + (part.items[item.id] || 0), 0);
                      const unassigned = item.qty - totalAllocated;
                      const itemName = item.name_snapshot || item.name || "Item";
                      const modifierText = item.modifiers?.length
                        ? ` • ${item.modifiers.map((mod: any) => mod.modifier_name_snapshot).join(", ")}`
                        : "";
                      const noteText = item.notes ? ` • Note: ${item.notes}` : "";

                      return (
                        <tr key={item.id} className="border-b last:border-0 bg-background/30 hover:bg-muted/5">
                          <td className="p-3 font-medium">
                            <div>{itemName}</div>
                            <div className="text-xs text-muted-foreground">
                              Total: {item.qty} • {formatCurrency(item.unit_price, curr)} each{modifierText}{noteText}
                            </div>
                          </td>
                          {splitParts.map((part, partIdx) => (
                            <td key={partIdx} className="p-3">
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="h-7 w-7 rounded-lg"
                                  onClick={() => {
                                    const currentQty = part.items[item.id] || 0;
                                    if (currentQty <= 0) return;
                                    const newParts = [...splitParts];
                                    newParts[partIdx].items[item.id] = currentQty - 1;
                                    setSplitParts(newParts);
                                  }}
                                  disabled={(part.items[item.id] || 0) <= 0}
                                >
                                  -
                                </Button>
                                <span className="w-8 text-center font-bold">{part.items[item.id] || 0}</span>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="h-7 w-7 rounded-lg"
                                  onClick={() => {
                                    const currentQty = part.items[item.id] || 0;
                                    if (unassigned <= 0) return;
                                    const newParts = [...splitParts];
                                    newParts[partIdx].items[item.id] = currentQty + 1;
                                    setSplitParts(newParts);
                                  }}
                                  disabled={unassigned <= 0}
                                >
                                  +
                                </Button>
                              </div>
                            </td>
                          ))}
                          <td className={cn(
                            "p-3 text-right font-bold tabular-nums",
                            unassigned > 0 ? "text-orange-600" : "text-muted-foreground"
                          )}>
                            {unassigned}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSplitBillOpen(false)}>Cancel</Button>
            <Button onClick={handleSplitBill} disabled={splitSubmitting} className="gap-2">
              {splitSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {splitSubmitting ? "Splitting..." : "Perform Split"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Pay All Guest Bills Dialog ── */}
      <Dialog open={payAllOpen} onOpenChange={setPayAllOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pay All Guest Bills</DialogTitle>
            <DialogDescription>
              Record a single bulk payment to settle all outstanding guest bills.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={payAllMethod} onValueChange={setPayAllMethod}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="digital">Digital (Fonepay/QR)</SelectItem>
                  <SelectItem value="credit">Credit (Charge Customer)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {payAllMethod === "cash" ? cashDrawerReadinessPanel : null}

            <div className="space-y-2">
              <Label htmlFor="pay-all-ref">Reference / Notes (optional)</Label>
              <Input
                id="pay-all-ref"
                placeholder="Bulk payment reference..."
                value={payAllReference}
                onChange={(e) => setPayAllReference(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPayAllOpen(false)}>Cancel</Button>
            <Button onClick={handlePayAllGuestBills} disabled={payAllSubmitting} className="gap-2 bg-orange-600 hover:bg-orange-700 text-white">
              {payAllSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              {payAllSubmitting ? "Paying..." : "Pay All Guest Bills"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={loyaltyOpen} onOpenChange={setLoyaltyOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Redeem Loyalty Points</DialogTitle>
            <DialogDescription>
              {checkoutCustomer
                ? `Customer: ${checkoutCustomer.full_name || checkoutCustomer.name || checkoutCustomer.phone || "Customer"}`
                : "Select a customer first to redeem points."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {loyaltyError && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium">
                {loyaltyError}
              </div>
            )}
            <div className="rounded-lg border bg-muted/20 p-3 text-sm">
              Available points: <span className="font-semibold">{availableLoyaltyPoints}</span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="loyalty-points">Points to redeem</Label>
              <Input
                id="loyalty-points"
                type="number"
                min="1"
                value={loyaltyPoints}
                onChange={(e) => setLoyaltyPoints(e.target.value)}
                placeholder="Enter points"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setLoyaltyOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={loyaltySubmitting || !checkoutCustomerId}
              onClick={async () => {
                if (!canApplyDiscount) {
                  setLoyaltyError("You do not have permission to apply discounts.");
                  return;
                }
                if (!checkoutCustomerId) {
                  setLoyaltyError("No customer attached to this order");
                  return;
                }
                if (!bill) {
                  setLoyaltyError("Bill data unavailable");
                  return;
                }
                const points = Math.floor(Number(loyaltyPoints || 0));
                if (!Number.isFinite(points) || points <= 0) {
                  setLoyaltyError("Enter valid points to redeem");
                  return;
                }
                if (availableLoyaltyPoints > 0 && points > availableLoyaltyPoints) {
                  setLoyaltyError("Cannot redeem more points than available");
                  return;
                }
                const maxAllowedByProfile = customerMaxDiscount > 0 ? customerMaxDiscount : Number.MAX_SAFE_INTEGER;
                const redeemAmount = Math.min(
                  points, // 1 point = 1 currency unit
                  displayGrandTotal || 0,
                  maxAllowedByProfile
                );
                if (!Number.isFinite(redeemAmount) || redeemAmount <= 0) {
                  setLoyaltyError("Redeem amount is not valid for this order");
                  return;
                }
                setLoyaltySubmitting(true);
                setLoyaltyError(null);
                try {
                  const beforeGrandTotal = Number(displayGrandTotal || 0);

                  // Ensure order has selected customer before applying loyalty discount.
                  if (String(orderMeta?.customer_id || "") !== String(checkoutCustomerId)) {
                    await apiClient.patch(OrderApis.updateOrder(orderId), {
                      customer_id: Number(checkoutCustomerId),
                    });
                    setOrderMeta((prev) => (
                      prev
                        ? { ...prev, customer_id: Number(checkoutCustomerId) }
                        : prev
                    ));
                  }

                  await apiClient.post(CustomerApis.redeemLoyaltyPoints(checkoutCustomerId), {
                    points,
                    order_id: orderId,
                  });

                  // Check whether backend already reflected loyalty discount in order totals.
                  const postRedeemBillRes = await apiClient.get(OrderApis.getOrderBill(orderId));
                  const postRedeemBill = postRedeemBillRes?.data?.data;
                  const afterGrandTotal = Number(postRedeemBill?.grand_total ?? beforeGrandTotal);
                  const reducedBy = Math.max(0, beforeGrandTotal - afterGrandTotal);

                  // Apply fallback discount only if backend did not reduce totals.
                  if (reducedBy < 0.009) {
                    const loyaltyReason = `Loyalty Points - ${checkoutCustomer?.full_name || checkoutCustomer?.name || orderMeta?.customer_name || "Customer"} (${points} pts)`;
                    await apiClient.patch(OrderApis.updateOrder(orderId), {
                      manual_discount_amount: redeemAmount,
                      loyalty_points_redeemed: points,
                      discount_reason: loyaltyReason,
                    });
                  }

                  await Promise.all([fetchBill(), fetchCustomers()]);
                  setLoyaltyOpen(false);
                  setLoyaltyPoints("");
                  toast.success(`Loyalty points redeemed. ${formatCurrency(redeemAmount, curr)} applied to bill.`);
                } catch (err: any) {
                  setLoyaltyError(err?.response?.data?.detail || err?.response?.data?.message || "Failed to redeem loyalty points");
                } finally {
                  setLoyaltySubmitting(false);
                }
              }}
            >
              {loyaltySubmitting ? "Redeeming..." : "Redeem"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={fonepayDialogOpen} onOpenChange={setFonepayDialogOpen}>
        <DialogContent className="w-[96vw] sm:w-[92vw] sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">Fonepay Payment</DialogTitle>
            <DialogDescription>
              PRN: <span className="font-semibold text-foreground">{fonepayPrn || "-"}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg border bg-muted/20 p-3 text-sm flex items-center justify-between">
              <div>
                Status: <span className={cn("font-semibold capitalize", fonepayStatus === "success" ? "text-emerald-600" : "text-orange-600")}>{fonepayStatus}</span>
              </div>
              {fonepayStatus === "pending" && <Loader2 className="h-5 w-5 animate-spin text-orange-500" />}
            </div>
            
            {fonepayStatus === "success" ? (
              <div className="mx-auto w-[300px] h-[300px] rounded-xl border bg-emerald-50 dark:bg-emerald-900/20 p-2 flex flex-col items-center justify-center gap-4">
                <div className="h-24 w-24 rounded-full bg-emerald-100 dark:bg-emerald-800/40 flex items-center justify-center">
                  <CheckCircle className="h-14 w-14 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="font-bold text-lg text-emerald-700 dark:text-emerald-400">Payment Successful</p>
                <p className="text-sm text-emerald-600/80">Redirecting to receipt...</p>
              </div>
            ) : fonepayQr ? (
              <div className="mx-auto w-[300px] h-[300px] rounded-xl border bg-white p-3 relative shadow-md">
                <img src={fonepayQr} alt="Fonepay QR" className={cn("h-full w-full object-contain transition-opacity", fonepayStatus === "success" ? "opacity-0" : "opacity-100")} />
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
                QR image not returned by backend. Use PRN/reference for payment confirmation.
              </div>
            )}
            
            {fonepayPayloadText && fonepayStatus !== "success" && (
              <div className="rounded-lg border bg-muted/20 p-3 text-xs break-all text-center">{fonepayPayloadText}</div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={async () => {
                setFonepayLoading(true);
                try {
                  await handleStartFonepay();
                } finally {
                  setFonepayLoading(false);
                }
              }}
              disabled={fonepayLoading || fonepayVerifying || fonepayStatus === "success"}
            >
              {fonepayLoading ? "Refreshing QR..." : "Refresh QR"}
            </Button>
            <Button onClick={handleVerifyFonepay} disabled={fonepayVerifying || fonepayStatus === "success"} className="gap-2">
              {fonepayVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              {fonepayVerifying ? "Verifying..." : "Verify Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Quick Add Customer Dialog ── */}
      <Dialog open={quickAddOpen} onOpenChange={setQuickAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Quick Add Customer</DialogTitle>
            <DialogDescription>
              Add a new customer and attach credit payment quickly.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleQuickAddCustomer} className="space-y-4 py-2">
            {quickAddError && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium">
                {quickAddError}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="qa-name">Full Name</Label>
              <Input
                id="qa-name"
                value={quickAddForm.name}
                onChange={(e) => setQuickAddForm((s) => ({ ...s, name: e.target.value }))}
                placeholder="Customer name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qa-phone">Phone Number</Label>
              <Input
                id="qa-phone"
                value={quickAddForm.phone}
                onChange={(e) => setQuickAddForm((s) => ({ ...s, phone: e.target.value }))}
                placeholder="+977 98..."
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qa-email">Email (Optional)</Label>
              <Input
                id="qa-email"
                type="email"
                value={quickAddForm.email}
                onChange={(e) => setQuickAddForm((s) => ({ ...s, email: e.target.value }))}
                placeholder="customer@example.com"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setQuickAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={quickAddSubmitting} className="gap-2">
                {quickAddSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {quickAddSubmitting ? "Adding..." : "Add Customer"}
              </Button>
            </DialogFooter>
          </form>
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
                <div className="text-xs text-muted-foreground">
                  Balance due: <span className="font-semibold text-foreground">{formatCurrency(dueAmountForManualDiscount, curr)}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                        onChange={(e) => {
                          const value = e.target.value;
                          setManualDiscountAmount(value);
                          const trimmed = value.trim();
                          if (!trimmed) {
                            setManualDiscountPercent("");
                            return;
                          }
                          const amount = parseFloat(trimmed);
                          if (!Number.isFinite(amount) || amount < 0 || dueAmountForManualDiscount <= 0) {
                            setManualDiscountPercent("");
                            return;
                          }
                          const pct = (amount / dueAmountForManualDiscount) * 100;
                          setManualDiscountPercent(pct.toFixed(2));
                        }}
                        className="pl-12"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="manual-discount-percent">Discount Percent (%)</Label>
                    <div className="relative">
                      <Input
                        id="manual-discount-percent"
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={manualDiscountPercent}
                        onChange={(e) => {
                          const value = e.target.value;
                          setManualDiscountPercent(value);
                          const trimmed = value.trim();
                          if (!trimmed) {
                            setManualDiscountAmount("");
                            return;
                          }
                          const pct = parseFloat(trimmed);
                          if (!Number.isFinite(pct) || pct < 0 || dueAmountForManualDiscount <= 0) {
                            setManualDiscountAmount("");
                            return;
                          }
                          const amount = dueAmountForManualDiscount * (pct / 100);
                          setManualDiscountAmount(amount.toFixed(2));
                        }}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">%</span>
                    </div>
                  </div>
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

      {/* ── Issue Refund Dialog ── */}
      <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Issue Refund</DialogTitle>
            <DialogDescription>
              Process a refund for this order. Maximum refundable amount is{" "}
              <span className="font-bold text-foreground">
                {bill ? formatCurrency(bill.total_paid, curr) : ""}
              </span>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {refundError && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium">
                {refundError}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="refund-amount">Refund Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
                  {curr}
                </span>
                <Input
                  id="refund-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={bill?.total_paid || 0}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  className="pl-12"
                  placeholder="0.00"
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="refund-method">Refund Method</Label>
              <Select value={refundMethod} onValueChange={setRefundMethod}>
                <SelectTrigger id="refund-method">
                  <SelectValue placeholder="Select refund method" />
                </SelectTrigger>
                <SelectContent>
                  {REFUND_PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      <span className="flex items-center gap-2">
                        <m.icon className={cn("h-4 w-4", m.color)} />
                        {m.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="refund-reason">Reason for Refund</Label>
              <Input
                id="refund-reason"
                placeholder="Why is this order being refunded?"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="refund-reference">Reference / Notes (Optional)</Label>
              <Input
                id="refund-reference"
                placeholder="Transaction ID, customer notes, etc."
                value={refundReference}
                onChange={(e) => setRefundReference(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleIssueRefund}
              disabled={refundSubmitting}
              className="gap-2"
            >
              {refundSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {refundSubmitting ? "Processing..." : "Confirm Refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
