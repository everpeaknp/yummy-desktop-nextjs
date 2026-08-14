"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getApiErrorMessage } from "@/lib/api-error-message";
import { hotelDate, hotelPmsApi } from "@/lib/hotel/api";
import type { HotelEarlyDeparturePolicy, HotelPropertySettings, HotelRatePlan, HotelRoomType } from "@/lib/hotel/types";
import { HotelEmptyState, hotelCurrency, humanizeHotelStatus } from "./hotel-ui";

interface Props {
  restaurantId: number;
  canManageRates: boolean;
  canManageSettings: boolean;
  refreshKey: number;
  onChanged: () => void;
}

export function RatesPanel({ restaurantId, canManageRates, canManageSettings, refreshKey, onChanged }: Props) {
  const [settings, setSettings] = useState<HotelPropertySettings | null>(null);
  const [roomTypes, setRoomTypes] = useState<HotelRoomType[]>([]);
  const [ratePlans, setRatePlans] = useState<HotelRatePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [roomTypeId, setRoomTypeId] = useState("");
  const [ratePlanId, setRatePlanId] = useState("");
  const [stayDate, setStayDate] = useState(hotelDate(new Date()));
  const [price, setPrice] = useState("");
  const [minStay, setMinStay] = useState("1");
  const [closedToArrival, setClosedToArrival] = useState(false);
  const [closedToDeparture, setClosedToDeparture] = useState(false);
  const [planCode, setPlanCode] = useState("");
  const [planName, setPlanName] = useState("");
  const [mealPlan, setMealPlan] = useState("room_only");
  const [policy, setPolicy] = useState("");
  const [refundable, setRefundable] = useState(true);
  const [earlyDeparturePolicy, setEarlyDeparturePolicy] = useState<HotelEarlyDeparturePolicy>("refund_unused");
  const [earlyDepartureValue, setEarlyDepartureValue] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextSettings, nextTypes, nextPlans] = await Promise.all([
        hotelPmsApi.getSettings(restaurantId),
        hotelPmsApi.listRoomTypes(restaurantId),
        hotelPmsApi.listRatePlans(restaurantId),
      ]);
      setSettings(nextSettings);
      setRoomTypes(nextTypes);
      setRatePlans(nextPlans);
      setRoomTypeId((current) => current || (nextTypes[0] ? String(nextTypes[0].id) : ""));
      setRatePlanId((current) => current || (nextPlans[0] ? String(nextPlans[0].id) : ""));
    } catch (error) {
      toast.error(getApiErrorMessage(error, "We couldn't load the hotel rates"));
    } finally { setLoading(false); }
  }, [restaurantId]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  const saveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      setSettings(await hotelPmsApi.updateSettings(restaurantId, {
        version: settings.version,
        default_checkin_time: settings.default_checkin_time,
        default_checkout_time: settings.default_checkout_time,
        currency: settings.currency,
        allow_overbooking: settings.allow_overbooking,
        require_clean_room_for_checkin: settings.require_clean_room_for_checkin,
      }));
      toast.success("Hotel settings saved"); onChanged();
    } catch (error) { toast.error(getApiErrorMessage(error, "We couldn't save these settings")); }
    finally { setSaving(false); }
  };

  const createPlan = async () => {
    if (!planCode.trim() || !planName.trim()) return;
    setSaving(true);
    try {
      const plan = await hotelPmsApi.createRatePlan({
        restaurant_id: restaurantId,
        code: planCode.trim(),
        name: planName.trim(),
        meal_plan: mealPlan,
        refundable,
        cancellation_policy: policy.trim() || null,
        early_departure_policy: earlyDeparturePolicy,
        early_departure_value: ["charge_percentage", "charge_fixed"].includes(earlyDeparturePolicy) ? Number(earlyDepartureValue || 0) : 0,
      });
      setRatePlans((current) => [...current, plan]); setRatePlanId(String(plan.id));
      setPlanCode(""); setPlanName(""); setPolicy(""); setRefundable(true); setEarlyDeparturePolicy("refund_unused"); setEarlyDepartureValue("");
      toast.success("Booking option added"); onChanged();
    } catch (error) { toast.error(getApiErrorMessage(error, "We couldn't add the booking option")); }
    finally { setSaving(false); }
  };

  const saveDailyRate = async () => {
    if (!roomTypeId || !ratePlanId || Number(price) < 0 || !price) return;
    setSaving(true);
    try {
      await hotelPmsApi.upsertDailyRate({
        restaurant_id: restaurantId,
        room_type_id: Number(roomTypeId),
        rate_plan_id: Number(ratePlanId),
        stay_date: stayDate,
        price: Number(price),
        min_stay: Math.max(1, Number(minStay || 1)),
        closed_to_arrival: closedToArrival,
        closed_to_departure: closedToDeparture,
      });
      toast.success("Price saved"); onChanged();
    } catch (error) { toast.error(getApiErrorMessage(error, "We couldn't save this price")); }
    finally { setSaving(false); }
  };

  if (loading && !settings) return <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Rates & booking rules</h2><p className="text-sm text-muted-foreground">Set arrival times, booking options, and prices for specific dates.</p></div><Button variant="outline" size="icon" aria-label="Refresh rates" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} /></Button></div>
      <div className="grid gap-4 xl:grid-cols-2">
        {settings ? <Card><CardHeader><CardTitle className="text-base">Hotel settings</CardTitle><CardDescription>These defaults are used when staff create a booking.</CardDescription></CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Usual check-in time</Label><Input type="time" value={settings.default_checkin_time.slice(0, 5)} disabled={!canManageSettings} onChange={(event) => setSettings({ ...settings, default_checkin_time: event.target.value })} /></div><div className="space-y-2"><Label>Usual checkout time</Label><Input type="time" value={settings.default_checkout_time.slice(0, 5)} disabled={!canManageSettings} onChange={(event) => setSettings({ ...settings, default_checkout_time: event.target.value })} /></div><div className="space-y-2"><Label>Currency</Label><Input maxLength={3} value={settings.currency} disabled={!canManageSettings} onChange={(event) => setSettings({ ...settings, currency: event.target.value.toUpperCase() })} /></div><div className="space-y-3 pt-7"><label className="flex items-center gap-2 text-sm"><Checkbox checked={settings.require_clean_room_for_checkin} disabled={!canManageSettings} onCheckedChange={(checked) => setSettings({ ...settings, require_clean_room_for_checkin: checked === true })} />Only check guests into ready rooms</label><label className="flex items-center gap-2 text-sm"><Checkbox checked={settings.allow_overbooking} disabled={!canManageSettings} onCheckedChange={(checked) => setSettings({ ...settings, allow_overbooking: checked === true })} />Allow more bookings than available rooms</label></div>{canManageSettings ? <Button className="md:col-span-2" disabled={saving} onClick={() => void saveSettings()}><Save className="mr-2 h-4 w-4" />Save settings</Button> : null}</CardContent></Card> : null}
        <Card><CardHeader><CardTitle className="text-base">Booking options</CardTitle><CardDescription>Create choices such as flexible, breakfast included, or non-refundable.</CardDescription></CardHeader><CardContent className="space-y-3">
          {ratePlans.length ? ratePlans.map((plan) => <div key={plan.id} className="rounded-xl border p-3"><div className="flex items-start justify-between"><div><p className="font-semibold">{plan.name}</p><p className="text-xs text-muted-foreground">{humanizeHotelStatus(plan.meal_plan)}</p></div><span className="text-xs font-semibold">{plan.refundable ? "Refundable" : "Non-refundable"}</span></div><p className="mt-2 text-xs text-muted-foreground">If the guest leaves early: {humanizeHotelStatus(plan.early_departure_policy)}{["charge_percentage", "charge_fixed"].includes(plan.early_departure_policy) ? ` (${plan.early_departure_value}${plan.early_departure_policy === "charge_percentage" ? "%" : ""})` : ""}</p>{plan.cancellation_policy ? <p className="mt-1 text-xs text-muted-foreground">{plan.cancellation_policy}</p> : null}</div>) : <HotelEmptyState title="No booking options yet" description="Add an option before setting prices for specific dates." />}
          {canManageRates ? <div className="grid gap-2 rounded-xl border border-dashed p-3 md:grid-cols-2">
            <Input value={planCode} onChange={(event) => setPlanCode(event.target.value.toUpperCase())} placeholder="Code" />
            <Input value={planName} onChange={(event) => setPlanName(event.target.value)} placeholder="Option name" />
            <Select value={mealPlan} onValueChange={setMealPlan}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["room_only", "breakfast", "half_board", "full_board"].map((value) => <SelectItem key={value} value={value}>{humanizeHotelStatus(value)}</SelectItem>)}</SelectContent></Select>
            <Input value={policy} onChange={(event) => setPolicy(event.target.value)} placeholder="Cancellation policy" />
            <label className="flex items-center gap-2 rounded-md border px-3 text-sm"><Checkbox checked={refundable} onCheckedChange={(checked) => { const next = checked === true; setRefundable(next); setEarlyDeparturePolicy(next ? "refund_unused" : "retain_full"); }} />Refundable rate</label>
            <Select value={earlyDeparturePolicy} onValueChange={(value) => setEarlyDeparturePolicy(value as HotelEarlyDeparturePolicy)}><SelectTrigger><SelectValue placeholder="Early checkout policy" /></SelectTrigger><SelectContent><SelectItem value="refund_unused">Remove unused nights</SelectItem><SelectItem value="charge_one_night">Charge one unused night</SelectItem><SelectItem value="charge_percentage">Charge percentage of unused nights</SelectItem><SelectItem value="charge_fixed">Charge fixed fee</SelectItem><SelectItem value="retain_full">Keep all booked nights</SelectItem></SelectContent></Select>
            {["charge_percentage", "charge_fixed"].includes(earlyDeparturePolicy) ? <Input type="number" min="0" max={earlyDeparturePolicy === "charge_percentage" ? 100 : undefined} step="0.01" value={earlyDepartureValue} onChange={(event) => setEarlyDepartureValue(event.target.value)} placeholder={earlyDeparturePolicy === "charge_percentage" ? "Fee percentage" : "Fixed fee"} /> : null}
            <Button className="md:col-span-2" variant="outline" disabled={saving || !planCode.trim() || !planName.trim() || (["charge_percentage", "charge_fixed"].includes(earlyDeparturePolicy) && !earlyDepartureValue)} onClick={() => void createPlan()}><Plus className="mr-2 h-4 w-4" />Add booking option</Button>
          </div> : null}
        </CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle className="text-base">Price for a specific date</CardTitle><CardDescription>Use this when a room should cost more or less on a particular date.</CardDescription></CardHeader><CardContent className="grid gap-3 md:grid-cols-3">{roomTypes.length && ratePlans.length ? <><div className="space-y-2"><Label>Room type</Label><Select value={roomTypeId} onValueChange={(value) => { setRoomTypeId(value); const type = roomTypes.find((item) => item.id === Number(value)); if (type) setPrice(String(type.base_rate)); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{roomTypes.map((type) => <SelectItem key={type.id} value={String(type.id)}>{type.name} · {hotelCurrency(type.base_rate)}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Booking option</Label><Select value={ratePlanId} onValueChange={setRatePlanId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ratePlans.map((plan) => <SelectItem key={plan.id} value={String(plan.id)}>{plan.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Date</Label><Input type="date" value={stayDate} onChange={(event) => setStayDate(event.target.value)} /></div><div className="space-y-2"><Label>Nightly price</Label><Input type="number" min={0} step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} /></div><div className="space-y-2"><Label>Minimum nights</Label><Input type="number" min={1} value={minStay} onChange={(event) => setMinStay(event.target.value)} /></div><div className="space-y-3 pt-7"><label className="flex items-center gap-2 text-sm"><Checkbox checked={closedToArrival} onCheckedChange={(checked) => setClosedToArrival(checked === true)} />No check-in on this date</label><label className="flex items-center gap-2 text-sm"><Checkbox checked={closedToDeparture} onCheckedChange={(checked) => setClosedToDeparture(checked === true)} />No checkout on this date</label></div>{canManageRates ? <Button className="md:col-span-3" disabled={saving || !roomTypeId || !ratePlanId || !price} onClick={() => void saveDailyRate()}><Save className="mr-2 h-4 w-4" />Save price</Button> : null}</> : <HotelEmptyState className="md:col-span-3" title="Finish room setup first" description="Add a room type and a booking option before setting prices." />}</CardContent></Card>
    </div>
  );
}
