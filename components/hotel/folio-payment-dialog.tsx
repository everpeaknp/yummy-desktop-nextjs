"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import QRCode from "qrcode";
import { Banknote, CheckCircle2, Loader2, Plus, RefreshCw, Trash2, UserPlus } from "lucide-react";
import apiClient from "@/lib/api-client";
import { AccountingApis, CustomerApis, DrawerSessionApis } from "@/lib/api/endpoints";
import { resolveCheckoutCashDrawerReadiness } from "@/lib/checkout-cash-drawer-readiness";
import { hotelPmsApi } from "@/lib/hotel/api";
import type { HotelFolio, HotelPaymentMethod } from "@/lib/hotel/types";
import type { PaymentInstrument } from "@/types/accounting";
import type { DrawerSession } from "@/types/day-close";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  PaymentMethodGrid,
  PaymentModeTabs,
  STANDARD_PAYMENT_METHODS,
  type PaymentMethodOption,
} from "@/components/payments/payment-composer-controls";
import {
  PAYMENT_AMOUNT_STEP,
  preventPaymentAmountWheelChange,
} from "@/lib/payment-composer-config";
import { hotelCurrency } from "./hotel-ui";

type CustomerOption = {
  id: number;
  name?: string;
  full_name?: string;
  phone?: string | null;
  email?: string | null;
  credit?: number | string | null;
  loyalty_points?: number | string | null;
};

type PaymentDraft = {
  id: string;
  method: HotelPaymentMethod;
  amount: string;
  reference: string;
  instrumentId: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: number;
  stayId: number;
  bookingVersion: number;
  customerId?: number | null;
  folio: HotelFolio;
  maximumAmount?: number;
  unpostedRoomCharges?: number;
  checkoutAfterPayment?: boolean;
  onRecorded: (folio: HotelFolio) => Promise<void> | void;
};

const METHOD_LABELS: Record<HotelPaymentMethod, string> = {
  cash: "Cash",
  card: "Card",
  digital: "Digital / QR",
  fonepay: "Fonepay",
  credit: "Customer credit",
  other: "Other",
};

const HOTEL_PAYMENT_METHODS = STANDARD_PAYMENT_METHODS.map((method) => ({
  ...method,
  value: method.value as HotelPaymentMethod,
})) satisfies PaymentMethodOption<HotelPaymentMethod>[];

const HOTEL_DRAWER_HREF =
  "/cash-drawers?business_line=hotel&return_to=%2Fhotel";

const newDraft = (amount = ""): PaymentDraft => ({
  id: crypto.randomUUID(),
  method: "cash",
  amount,
  reference: "",
  instrumentId: "",
});

function InstrumentQr({ instrument }: { instrument: PaymentInstrument | null }) {
  const [dataUrl, setDataUrl] = useState("");
  const payload = typeof instrument?.metadata_json?.payload === "string"
    ? instrument.metadata_json.payload.trim()
    : "";
  useEffect(() => {
    if (!payload) return setDataUrl("");
    void QRCode.toDataURL(payload, { margin: 1, width: 220 })
      .then(setDataUrl)
      .catch(() => setDataUrl(""));
  }, [payload]);
  return dataUrl ? <div className="flex justify-center rounded-lg border bg-white p-3"><Image unoptimized src={dataUrl} width={176} height={176} alt={`${instrument?.name || "Payment"} QR`} /></div> : null;
}

export function FolioPaymentDialog({
  open,
  onOpenChange,
  restaurantId,
  stayId,
  bookingVersion,
  customerId,
  folio,
  maximumAmount,
  unpostedRoomCharges = 0,
  checkoutAfterPayment = false,
  onRecorded,
}: Props) {
  const collectionLimit = Math.max(0, maximumAmount ?? Number(folio.balance || 0));
  const postedBalance = Number(folio.balance || 0);
  const [multiPayment, setMultiPayment] = useState(false);
  const [payments, setPayments] = useState<PaymentDraft[]>([newDraft()]);
  const [instruments, setInstruments] = useState<PaymentInstrument[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [quickAdd, setQuickAdd] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [discountMode, setDiscountMode] = useState<"amount" | "percent" | "loyalty">("amount");
  const [discountValue, setDiscountValue] = useState("");
  const [discountReason, setDiscountReason] = useState("");
  const [drawerReady, setDrawerReady] = useState(true);
  const [drawerControlsEnabled, setDrawerControlsEnabled] = useState(false);
  const [drawerSessions, setDrawerSessions] = useState<DrawerSession[]>([]);
  const [selectedDrawerSessionId, setSelectedDrawerSessionId] = useState("");
  const [drawerMessage, setDrawerMessage] = useState("");
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const discount = useMemo(() => {
    const raw = Number(discountValue || 0);
    if (!Number.isFinite(raw) || raw <= 0) return 0;
    if (discountMode === "loyalty") return Math.min(collectionLimit, Math.floor(raw));
    return discountMode === "percent"
      ? Math.min(collectionLimit, collectionLimit * Math.min(raw, 100) / 100)
      : Math.min(collectionLimit, raw);
  }, [collectionLimit, discountMode, discountValue]);
  const payable = Math.max(0, collectionLimit - discount);
  const selectedCustomer = customers.find((customer) => String(customer.id) === selectedCustomerId) ?? null;
  const availableLoyaltyPoints = Number(selectedCustomer?.loyalty_points || 0);
  const allocated = payments.reduce((total, row) => total + (Number(row.amount) || 0), 0);
  const usesCash = payable > 0.005 && payments.some((row) => row.method === "cash");

  const loadDrawer = useCallback(async () => {
    setDrawerLoading(true);
    try {
      const response = await apiClient.get<{ data: DrawerSession[]; message?: string }>(
        DrawerSessionApis.active({ restaurantId, businessLine: "hotel" }),
      );
      const readiness = resolveCheckoutCashDrawerReadiness(response.data, {
        businessLine: "hotel",
      });
      const sessions = readiness.paymentReadySessions;
      setDrawerControlsEnabled(readiness.controlsEnabled);
      setDrawerSessions(sessions);
      setSelectedDrawerSessionId((current) => {
        if (sessions.length === 1) return String(sessions[0].id);
        return sessions.some((session) => String(session.id) === current) ? current : "";
      });
      setDrawerReady(!readiness.controlsEnabled || sessions.length === 1);
      setDrawerMessage(readiness.controlsEnabled
        ? sessions.length > 1
          ? "Select the hotel till receiving this cash payment."
          : readiness.message || "Cash will be recorded in the active hotel drawer."
        : "Drawer controls are disabled; hotel cash will be reconciled at day close.");
      if (readiness.ready) setError("");
    } catch {
      setDrawerReady(false);
      setDrawerMessage("Unable to verify the hotel cash drawer.");
    } finally {
      setDrawerLoading(false);
    }
  }, [restaurantId]);

  const loadCustomers = useCallback(async () => {
    try {
      const response = await apiClient.get(CustomerApis.listCustomers(restaurantId), {
        params: { skip: 0, limit: 500 },
      });
      setCustomers(response.data?.data?.customers ?? []);
    } catch {
      setCustomers([]);
    }
  }, [restaurantId]);

  useEffect(() => {
    if (!open) return;
    setMultiPayment(false);
    setPayments([newDraft(collectionLimit.toFixed(2))]);
    setSelectedCustomerId(customerId ? String(customerId) : "");
    setDiscountMode("amount");
    setDiscountValue("");
    setDiscountReason("");
    setError("");
    setQuickAdd(false);
    void loadDrawer();
    void loadCustomers();
    void apiClient
      .get<{ data: PaymentInstrument[] }>(AccountingApis.paymentInstruments({
        restaurantId,
        businessLine: "hotel",
        activeOnly: true,
      }))
      .then((response) => setInstruments(response.data.data ?? []))
      .catch(() => setInstruments([]));
  }, [collectionLimit, customerId, loadCustomers, loadDrawer, open, restaurantId]);

  const updatePayment = (id: string, patch: Partial<PaymentDraft>) => {
    setError("");
    setPayments((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row));
  };

  const instrumentsFor = (method: HotelPaymentMethod) => instruments.filter(
    (item) => item.payment_method.toLowerCase() === method,
  );

  const createCustomer = async () => {
    if (!customerName.trim()) return setError("Enter the customer name.");
    try {
      const response = await apiClient.post(CustomerApis.createCustomer, {
        restaurant_id: restaurantId,
        name: customerName.trim(),
        phone: customerPhone.trim() || null,
        email: customerEmail.trim() || null,
        is_active: true,
      });
      const created = response.data?.data as CustomerOption | undefined;
      await loadCustomers();
      if (created?.id) setSelectedCustomerId(String(created.id));
      setQuickAdd(false);
      setCustomerName("");
      setCustomerPhone("");
      setCustomerEmail("");
      setError("");
    } catch (caught: any) {
      setError(caught?.response?.data?.detail || "Unable to create customer.");
    }
  };

  const submit = async () => {
    const parsed = payable <= 0.005 && discount > 0
      ? []
      : payments.map((row) => ({ ...row, amountNumber: Number(row.amount) }));
    if (parsed.some((row) => !Number.isFinite(row.amountNumber) || row.amountNumber <= 0)) {
      return setError("Every payment row must have an amount greater than zero.");
    }
    if (multiPayment && Math.abs(allocated - payable) > 0.005) {
      return setError(`Multi-payment total must equal ${hotelCurrency(payable, folio.currency)}.`);
    }
    if (!multiPayment && allocated - payable > 0.005) {
      return setError("Payment cannot exceed the remaining stay balance after discount.");
    }
    if (discountMode === "loyalty" && discount > availableLoyaltyPoints) {
      return setError("Loyalty redemption cannot exceed the customer’s available points.");
    }
    if (discountMode === "loyalty" && !selectedCustomerId) {
      return setError("Select a customer before redeeming loyalty points.");
    }
    if (discount > 0 && discountMode !== "loyalty" && discountReason.trim().length < 3) {
      return setError("Enter a reason for the hotel discount.");
    }
    const selectedCustomerNumber = selectedCustomerId ? Number(selectedCustomerId) : null;
    if (parsed.some((row) => row.method === "credit") && !selectedCustomerNumber) {
      return setError("Select a customer before using customer credit.");
    }
    for (const row of parsed) {
      const available = instrumentsFor(row.method);
      if (available.length > 0 && !row.instrumentId) {
        return setError(`Select the ${METHOD_LABELS[row.method]} payment instrument.`);
      }
    }
    if (usesCash && drawerControlsEnabled && !selectedDrawerSessionId) {
      return setError(
        drawerSessions.length > 1
          ? "Select the hotel cash drawer receiving this payment."
          : "Open a hotel cash drawer before accepting cash.",
      );
    }

    setSubmitting(true);
    setError("");
    let latestFolio = folio;
    try {
      if (selectedCustomerNumber && selectedCustomerNumber !== customerId) {
        await hotelPmsApi.updateStayCustomer(stayId, {
          booking_version: bookingVersion,
          customer_id: selectedCustomerNumber,
        });
      }
      if (discount > 0) {
        latestFolio = await hotelPmsApi.applyFolioDiscount(folio.id, {
          amount: Number(discount.toFixed(2)),
          reason: discountMode === "loyalty"
            ? `Loyalty redemption - ${Math.round(discount)} points`
            : discountReason.trim(),
          idempotency_key: `web-hotel-discount:${folio.id}:${crypto.randomUUID()}`,
          loyalty_points_redeemed: discountMode === "loyalty" ? Math.round(discount) : 0,
        });
      }
      for (const row of parsed) {
        const instrument = instruments.find((item) => String(item.id) === row.instrumentId) ?? null;
        latestFolio = await hotelPmsApi.addFolioPayment(folio.id, {
          method: row.method,
          amount: Number(row.amountNumber.toFixed(2)),
          reference: row.reference.trim() || null,
          instrument: instrument ? {
            type: instrument.instrument_type,
            name: instrument.name,
            meta: instrument.metadata_json,
          } : null,
          drawer_session_id: row.method === "cash" && selectedDrawerSessionId
            ? Number(selectedDrawerSessionId)
            : null,
          idempotency_key: `web-hotel-payment:${folio.id}:${crypto.randomUUID()}`,
        });
      }
      await onRecorded(latestFolio);
      onOpenChange(false);
    } catch (caught: any) {
      setError(caught?.response?.data?.detail || caught?.response?.data?.message || "Unable to record the hotel payment.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{checkoutAfterPayment ? "Pay bill and check out" : "Take hotel payment"}</DialogTitle>
          <DialogDescription>
            Amount available to pay: <strong>{hotelCurrency(collectionLimit, folio.currency)}</strong>. Single payments may be partial; multiple payments must cover the full adjusted balance.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {unpostedRoomCharges > 0 ? (
            <Alert><AlertDescription>
              Includes {hotelCurrency(unpostedRoomCharges, folio.currency)} for remaining room nights. Current guest balance: {hotelCurrency(postedBalance, folio.currency)}.
            </AlertDescription></Alert>
          ) : null}

          <section className="space-y-3 rounded-xl border p-4">
            <div className="flex items-center justify-between gap-3">
              <div><p className="font-semibold">Customer</p><p className="text-xs text-muted-foreground">Required for credit and retained on the stay.</p></div>
              <Button type="button" variant="outline" size="sm" onClick={() => setQuickAdd((value) => !value)}><UserPlus className="mr-2 h-4 w-4" />Quick add</Button>
            </div>
            <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
              <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
              <SelectContent>{customers.map((customer) => (
                <SelectItem key={customer.id} value={String(customer.id)}>
                  {customer.name || customer.full_name || "Guest"}{customer.phone ? ` · ${customer.phone}` : ""}
                </SelectItem>
              ))}</SelectContent>
            </Select>
            {quickAdd ? <div className="grid gap-2 md:grid-cols-3">
              <Input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Customer name" />
              <Input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} placeholder="Phone" />
              <Input value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} placeholder="Email" />
              <Button type="button" className="md:col-span-3" onClick={() => void createCustomer()}>Create and select customer</Button>
            </div> : null}
          </section>

          <section className="space-y-3 rounded-xl border p-4">
            <div><p className="font-semibold">Discount</p><p className="text-xs text-muted-foreground">The discount will appear in the guest bill and hotel reports.</p></div>
            <div className="grid gap-3 md:grid-cols-[150px_1fr]">
              <Select value={discountMode} onValueChange={(value) => setDiscountMode(value as "amount" | "percent" | "loyalty")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="amount">Fixed amount</SelectItem><SelectItem value="percent">Percentage</SelectItem><SelectItem value="loyalty">Loyalty points</SelectItem></SelectContent>
              </Select>
              <Input type="number" min="0" max={discountMode === "percent" ? 100 : discountMode === "loyalty" ? availableLoyaltyPoints : collectionLimit} step={discountMode === "loyalty" ? 1 : 0.01} value={discountValue} onChange={(event) => setDiscountValue(event.target.value)} placeholder={discountMode === "percent" ? "0–100%" : discountMode === "loyalty" ? `${availableLoyaltyPoints} points available` : "Discount amount"} />
            </div>
            {discount > 0 && discountMode !== "loyalty" ? <Textarea value={discountReason} onChange={(event) => setDiscountReason(event.target.value)} placeholder="Required discount reason" maxLength={255} /> : null}
            <p className="text-sm">Adjusted balance: <strong>{hotelCurrency(payable, folio.currency)}</strong></p>
          </section>

          <section className="space-y-3 rounded-xl border p-4">
            <div><p className="font-semibold">Payments</p><p className="text-xs text-muted-foreground">Cash, card, QR/digital, Fonepay, or customer credit.</p></div>
            <PaymentModeTabs
              multiple={multiPayment}
              onChange={(multiple) => {
                setMultiPayment(multiple);
                setPayments(multiple
                  ? [newDraft((payable / 2).toFixed(2)), { ...newDraft((payable / 2).toFixed(2)), method: "digital" }]
                  : [newDraft(payable.toFixed(2))]);
              }}
            />

            {payments.map((row, index) => {
              const available = instrumentsFor(row.method);
              const selectedInstrument = instruments.find((item) => String(item.id) === row.instrumentId) ?? null;
              return <div key={row.id} className="space-y-3 rounded-lg bg-muted/40 p-3">
                <div className="flex items-center justify-between"><p className="text-sm font-semibold">Payment {index + 1}</p>{multiPayment && payments.length > 2 ? <Button type="button" variant="ghost" size="icon" onClick={() => setPayments((current) => current.filter((item) => item.id !== row.id))}><Trash2 className="h-4 w-4" /></Button> : null}</div>
                {!multiPayment ? (
                  <div className="space-y-2">
                    <Label>Payment Method</Label>
                    <PaymentMethodGrid
                      methods={HOTEL_PAYMENT_METHODS}
                      value={row.method}
                      onChange={(method) => updatePayment(row.id, { method, instrumentId: "" })}
                    />
                  </div>
                ) : null}
                <div className="grid gap-3 md:grid-cols-2">
                  {multiPayment ? <Select value={row.method} onValueChange={(method) => updatePayment(row.id, { method: method as HotelPaymentMethod, instrumentId: "" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{HOTEL_PAYMENT_METHODS.map((method) => <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>)}</SelectContent>
                  </Select> : null}
                  <Input type="number" min="0" max={payable} step={PAYMENT_AMOUNT_STEP} value={row.amount} onWheel={(event) => preventPaymentAmountWheelChange(event.currentTarget)} onChange={(event) => updatePayment(row.id, { amount: event.target.value })} placeholder="Amount" />
                  {available.length > 0 ? <Select value={row.instrumentId} onValueChange={(instrumentId) => updatePayment(row.id, { instrumentId })}>
                    <SelectTrigger><SelectValue placeholder="Payment instrument" /></SelectTrigger><SelectContent>{available.map((instrument) => <SelectItem key={instrument.id} value={String(instrument.id)}>{instrument.name}</SelectItem>)}</SelectContent>
                  </Select> : null}
                  <Input value={row.reference} onChange={(event) => updatePayment(row.id, { reference: event.target.value })} placeholder="Reference (optional)" maxLength={160} />
                </div>
                <InstrumentQr instrument={selectedInstrument} />
              </div>;
            })}
            {multiPayment ? <Button type="button" variant="outline" onClick={() => setPayments((current) => [...current, newDraft()])}><Plus className="mr-2 h-4 w-4" />Add payment method</Button> : null}
            <div className="flex justify-between text-sm"><span>Payment total</span><strong>{hotelCurrency(allocated, folio.currency)} / {hotelCurrency(payable, folio.currency)}</strong></div>
          </section>

          {usesCash ? <Alert variant={drawerReady ? "default" : "destructive"}>
            {drawerLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : drawerReady ? <CheckCircle2 className="h-4 w-4" /> : <Banknote className="h-4 w-4" />}
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              <span>{drawerLoading ? "Checking hotel cash drawer..." : drawerMessage}</span>
              {!drawerLoading && drawerSessions.length > 1 ? (
                <Select
                  value={selectedDrawerSessionId}
                  onValueChange={(value) => {
                    setSelectedDrawerSessionId(value);
                    setDrawerReady(Boolean(value));
                    setError("");
                  }}
                >
                  <SelectTrigger className="min-w-56 bg-background">
                    <SelectValue placeholder="Select hotel cash drawer" />
                  </SelectTrigger>
                  <SelectContent>
                    {drawerSessions.map((session) => (
                      <SelectItem key={session.id} value={String(session.id)}>
                        {session.station} · {session.drawer_key}{session.cashier_name ? ` · ${session.cashier_name}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
              <span className="flex items-center gap-2">
                {!drawerLoading && !drawerReady ? (
                  <Button asChild size="sm" variant="outline">
                    <Link href={HOTEL_DRAWER_HREF}>Open hotel drawer</Link>
                  </Button>
                ) : null}
                <Button variant="ghost" size="sm" onClick={() => void loadDrawer()} aria-label="Refresh hotel drawer status"><RefreshCw className="h-3.5 w-3.5" /></Button>
              </span>
            </AlertDescription>
          </Alert> : null}
          {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={submitting || (payable <= 0 && discount <= 0) || (usesCash && (drawerLoading || !drawerReady))}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {checkoutAfterPayment ? "Take payment and continue" : "Add payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
