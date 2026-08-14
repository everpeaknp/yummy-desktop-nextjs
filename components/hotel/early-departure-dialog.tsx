"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { getApiErrorMessage } from "@/lib/api-error-message";
import { hotelPmsApi } from "@/lib/hotel/api";
import { HOTEL_EARLY_DEPARTURE_POLICY_LABELS, hotelRateContractLabel } from "@/lib/hotel/rate-plan";
import type { HotelEarlyDeparturePolicy, HotelEarlyDepartureQuote, HotelStay } from "@/lib/hotel/types";
import { hotelCurrency } from "./hotel-ui";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stay: HotelStay;
  departureDate: string;
  canOverride: boolean;
  onPrepared: (quote: HotelEarlyDepartureQuote) => Promise<void> | void;
};

const OVERRIDE_POLICIES: HotelEarlyDeparturePolicy[] = [
  "refund_unused",
  "charge_one_night",
  "charge_percentage",
  "charge_fixed",
  "retain_full",
];

export function EarlyDepartureDialog({
  open,
  onOpenChange,
  stay,
  departureDate,
  canOverride,
  onPrepared,
}: Props) {
  const [reason, setReason] = useState("");
  const [quote, setQuote] = useState<HotelEarlyDepartureQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [overrideEnabled, setOverrideEnabled] = useState(false);
  const [overridePolicy, setOverridePolicy] = useState<HotelEarlyDeparturePolicy>("retain_full");
  const [overrideValue, setOverrideValue] = useState("0");
  const [overrideReason, setOverrideReason] = useState("");
  const [previewIsCurrent, setPreviewIsCurrent] = useState(true);

  useEffect(() => {
    if (!open) return;
    setReason("");
    setQuote(null);
    setError("");
    setOverrideEnabled(false);
    setOverridePolicy("retain_full");
    setOverrideValue("0");
    setOverrideReason("");
    setPreviewIsCurrent(true);
    setLoading(true);
    void hotelPmsApi.quoteEarlyDeparture(stay.id, {
      stay_version: stay.version,
      departure_date: departureDate,
    }).then(setQuote).catch((caught) => {
      setError(getApiErrorMessage(caught, "Unable to calculate the early checkout bill"));
    }).finally(() => setLoading(false));
  }, [departureDate, open, stay.id, stay.version]);

  const refreshQuote = async (withOverride: boolean) => {
    setLoading(true);
    setError("");
    try {
      const nextQuote = await hotelPmsApi.quoteEarlyDeparture(stay.id, {
        stay_version: stay.version,
        departure_date: departureDate,
        override_policy: withOverride ? overridePolicy : null,
        override_value: withOverride ? Number(overrideValue || 0) : 0,
        override_reason: withOverride ? overrideReason.trim() || null : null,
      });
      setQuote(nextQuote);
      setPreviewIsCurrent(true);
    } catch (caught) {
      setError(getApiErrorMessage(caught, "Unable to recalculate the early checkout bill"));
    } finally {
      setLoading(false);
    }
  };

  const prepare = async () => {
    if (!quote || reason.trim().length < 3) {
      setError("Enter a short reason for the early checkout.");
      return;
    }
    if (overrideEnabled && (!canOverride || overrideReason.trim().length < 3)) {
      setError("Enter the manager reason for changing the booked terms.");
      return;
    }
    if (overrideEnabled && !previewIsCurrent) {
      setError("Recalculate the bill after changing the override.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const prepared = await hotelPmsApi.prepareEarlyDeparture(stay.id, {
        stay_version: stay.version,
        departure_date: departureDate,
        reason: reason.trim(),
        override_policy: overrideEnabled ? overridePolicy : null,
        override_value: overrideEnabled ? Number(overrideValue || 0) : 0,
        override_reason: overrideEnabled ? overrideReason.trim() : null,
      });
      await onPrepared(prepared);
      onOpenChange(false);
    } catch (caught) {
      setError(getApiErrorMessage(caught, "Unable to prepare the early checkout"));
    } finally {
      setSubmitting(false);
    }
  };

  const valueRequired = overridePolicy === "charge_percentage" || overridePolicy === "charge_fixed";
  const overrideValid = !overrideEnabled
    || (canOverride
      && overrideReason.trim().length >= 3
      && (!valueRequired || Number(overrideValue) >= 0)
      && previewIsCurrent);

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>Review early checkout</DialogTitle>
        <DialogDescription>
          This stay was booked until {stay.booking.departure_date}. The booking terms determine the amount unless an authorized manager approves a change below.
        </DialogDescription>
      </DialogHeader>

      {loading && !quote ? (
        <div className="flex min-h-44 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : quote ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Original room booking</p><p className="text-lg font-semibold">{hotelCurrency(quote.original_booking_value, quote.currency)}</p></div>
            <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Nights used</p><p className="text-lg font-semibold">{quote.rooms.reduce((total, room) => total + room.consumed_nights, 0)}</p></div>
            <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Nights not used</p><p className="text-lg font-semibold">{quote.rooms.reduce((total, room) => total + room.unused_nights, 0)}</p></div>
            <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Final room charge</p><p className="text-lg font-semibold">{hotelCurrency(quote.final_room_value, quote.currency)}</p></div>
          </div>

          <div className="space-y-2">
            {quote.rooms.map((room) => (
              <div key={room.booking_room_id} className="flex flex-col justify-between gap-2 rounded-xl border p-3 sm:flex-row sm:items-center">
                <div>
                  <p className="font-medium">{room.room_number ? `Room ${room.room_number}` : "Unassigned room"}</p>
                  <p className="text-xs text-muted-foreground">
                    Booked terms: {hotelRateContractLabel(room.booked_policy, room.booked_policy_value)}
                  </p>
                  {room.policy_overridden ? (
                    <p className="mt-1 text-xs font-medium text-amber-700">
                      Manager change: {hotelRateContractLabel(room.policy, room.policy_value)}
                    </p>
                  ) : null}
                </div>
                <div className="text-left sm:text-right">
                  <p className="font-medium">{hotelCurrency(room.early_departure_fee, quote.currency)}</p>
                  <p className="text-xs text-muted-foreground">early-checkout charge</p>
                </div>
              </div>
            ))}
          </div>

          {canOverride ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900 dark:bg-amber-950/20">
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 text-amber-700" />
                  <div>
                    <p className="font-semibold">Manager override</p>
                    <p className="text-xs text-muted-foreground">Only change the booking terms when a manager has approved an exception. Add a clear reason for staff records.</p>
                  </div>
                </div>
                <Switch checked={overrideEnabled} onCheckedChange={(checked) => {
                  setOverrideEnabled(checked);
                  setPreviewIsCurrent(false);
                  if (!checked) void refreshQuote(false);
                }} />
              </div>
              {overrideEnabled ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Approved charge rule</Label>
                    <Select value={overridePolicy} onValueChange={(value) => {
                      setOverridePolicy(value as HotelEarlyDeparturePolicy);
                      setPreviewIsCurrent(false);
                    }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {OVERRIDE_POLICIES.map((policy) => (
                          <SelectItem key={policy} value={policy}>{HOTEL_EARLY_DEPARTURE_POLICY_LABELS[policy]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {valueRequired ? (
                    <div className="space-y-2">
                      <Label>{overridePolicy === "charge_percentage" ? "Percentage" : "Fixed fee"}</Label>
                      <Input
                        type="number"
                        min="0"
                        max={overridePolicy === "charge_percentage" ? "100" : undefined}
                        step={overridePolicy === "charge_percentage" ? "1" : "0.01"}
                        value={overrideValue}
                        onChange={(event) => { setOverrideValue(event.target.value); setPreviewIsCurrent(false); }}
                      />
                    </div>
                  ) : null}
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Manager reason</Label>
                    <Textarea value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} placeholder="Who approved this exception and why?" maxLength={500} />
                  </div>
                  <Button type="button" variant="outline" className="sm:col-span-2" disabled={loading || overrideReason.trim().length < 3} onClick={() => void refreshQuote(true)}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    Recalculate bill with override
                  </Button>
                  {!previewIsCurrent ? <p className="text-xs font-medium text-amber-800 sm:col-span-2">Recalculate to review the updated amount before continuing.</p> : null}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="rounded-xl bg-muted/50 p-4">
            <div className="mb-3 flex items-center justify-between text-sm"><span className="text-muted-foreground">Early-checkout charge</span><span className="font-semibold">{hotelCurrency(quote.early_departure_fee, quote.currency)}</span></div>
            {Number(quote.refund_due) > 0.005 ? <><p className="text-sm text-muted-foreground">Refund to guest</p><p className="text-2xl font-bold text-emerald-600">{hotelCurrency(quote.refund_due, quote.currency)}</p></> : Number(quote.amount_due) > 0.005 ? <><p className="text-sm text-muted-foreground">Amount to collect</p><p className="text-2xl font-bold">{hotelCurrency(quote.amount_due, quote.currency)}</p></> : <><p className="text-sm text-muted-foreground">Guest bill after adjustment</p><p className="text-2xl font-bold text-emerald-600">Fully settled</p></>}
          </div>
          <div className="space-y-2"><Label>Early checkout reason</Label><Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="For example: travel plans changed" maxLength={500} /></div>
        </div>
      ) : null}

      {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
        <Button onClick={() => void prepare()} disabled={!quote || loading || submitting || reason.trim().length < 3 || !overrideValid}>
          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Apply and continue
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
