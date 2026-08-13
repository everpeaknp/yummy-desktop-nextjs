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
import type { HotelPropertySettings, HotelRatePlan, HotelRoomType } from "@/lib/hotel/types";
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
      toast.error(getApiErrorMessage(error, "Failed to load hotel rates"));
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
    } catch (error) { toast.error(getApiErrorMessage(error, "Failed to save settings")); }
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
        refundable: true,
        cancellation_policy: policy.trim() || null,
      });
      setRatePlans((current) => [...current, plan]); setRatePlanId(String(plan.id));
      setPlanCode(""); setPlanName(""); setPolicy("");
      toast.success("Rate plan created"); onChanged();
    } catch (error) { toast.error(getApiErrorMessage(error, "Failed to create rate plan")); }
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
      toast.success("Daily rate saved"); onChanged();
    } catch (error) { toast.error(getApiErrorMessage(error, "Failed to save daily rate")); }
    finally { setSaving(false); }
  };

  if (loading && !settings) return <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Rates and property rules</h2><p className="text-sm text-muted-foreground">Server-owned arrival policy, rate plans, and date-specific pricing.</p></div><Button variant="outline" size="icon" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} /></Button></div>
      <div className="grid gap-4 xl:grid-cols-2">
        {settings ? <Card><CardHeader><CardTitle className="text-base">Property settings</CardTitle><CardDescription>These times are interpreted in the property timezone.</CardDescription></CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Default check-in</Label><Input type="time" value={settings.default_checkin_time.slice(0, 5)} disabled={!canManageSettings} onChange={(event) => setSettings({ ...settings, default_checkin_time: event.target.value })} /></div><div className="space-y-2"><Label>Default checkout</Label><Input type="time" value={settings.default_checkout_time.slice(0, 5)} disabled={!canManageSettings} onChange={(event) => setSettings({ ...settings, default_checkout_time: event.target.value })} /></div><div className="space-y-2"><Label>Currency</Label><Input maxLength={3} value={settings.currency} disabled={!canManageSettings} onChange={(event) => setSettings({ ...settings, currency: event.target.value.toUpperCase() })} /></div><div className="space-y-3 pt-7"><label className="flex items-center gap-2 text-sm"><Checkbox checked={settings.require_clean_room_for_checkin} disabled={!canManageSettings} onCheckedChange={(checked) => setSettings({ ...settings, require_clean_room_for_checkin: checked === true })} />Require clean room for check-in</label><label className="flex items-center gap-2 text-sm"><Checkbox checked={settings.allow_overbooking} disabled={!canManageSettings} onCheckedChange={(checked) => setSettings({ ...settings, allow_overbooking: checked === true })} />Allow room-type overbooking</label></div>{canManageSettings ? <Button className="md:col-span-2" disabled={saving} onClick={() => void saveSettings()}><Save className="mr-2 h-4 w-4" />Save settings</Button> : null}</CardContent></Card> : null}
        <Card><CardHeader><CardTitle className="text-base">Rate plans</CardTitle><CardDescription>Plans describe the commercial terms; daily rates hold sell prices.</CardDescription></CardHeader><CardContent className="space-y-3">{ratePlans.length ? ratePlans.map((plan) => <div key={plan.id} className="rounded-xl border p-3"><div className="flex items-start justify-between"><div><p className="font-semibold">{plan.name}</p><p className="text-xs text-muted-foreground">{plan.code} · {humanizeHotelStatus(plan.meal_plan)}</p></div><span className="text-xs font-semibold">{plan.refundable ? "Refundable" : "Non-refundable"}</span></div>{plan.cancellation_policy ? <p className="mt-2 text-xs text-muted-foreground">{plan.cancellation_policy}</p> : null}</div>) : <HotelEmptyState title="No rate plans" description="Create a plan before adding date-specific prices." />}{canManageRates ? <div className="grid gap-2 rounded-xl border border-dashed p-3 md:grid-cols-2"><Input value={planCode} onChange={(event) => setPlanCode(event.target.value.toUpperCase())} placeholder="Code" /><Input value={planName} onChange={(event) => setPlanName(event.target.value)} placeholder="Plan name" /><Select value={mealPlan} onValueChange={setMealPlan}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["room_only", "breakfast", "half_board", "full_board"].map((value) => <SelectItem key={value} value={value}>{humanizeHotelStatus(value)}</SelectItem>)}</SelectContent></Select><Input value={policy} onChange={(event) => setPolicy(event.target.value)} placeholder="Cancellation policy" /><Button className="md:col-span-2" variant="outline" disabled={saving || !planCode.trim() || !planName.trim()} onClick={() => void createPlan()}><Plus className="mr-2 h-4 w-4" />Create plan</Button></div> : null}</CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle className="text-base">Daily rate override</CardTitle><CardDescription>Updates one room type, plan, and stay date. Booking snapshots remain unchanged after sale.</CardDescription></CardHeader><CardContent className="grid gap-3 md:grid-cols-3">{roomTypes.length && ratePlans.length ? <><div className="space-y-2"><Label>Room type</Label><Select value={roomTypeId} onValueChange={(value) => { setRoomTypeId(value); const type = roomTypes.find((item) => item.id === Number(value)); if (type) setPrice(String(type.base_rate)); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{roomTypes.map((type) => <SelectItem key={type.id} value={String(type.id)}>{type.name} · {hotelCurrency(type.base_rate)}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Rate plan</Label><Select value={ratePlanId} onValueChange={setRatePlanId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ratePlans.map((plan) => <SelectItem key={plan.id} value={String(plan.id)}>{plan.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Stay date</Label><Input type="date" value={stayDate} onChange={(event) => setStayDate(event.target.value)} /></div><div className="space-y-2"><Label>Price</Label><Input type="number" min={0} step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} /></div><div className="space-y-2"><Label>Minimum stay</Label><Input type="number" min={1} value={minStay} onChange={(event) => setMinStay(event.target.value)} /></div><div className="space-y-3 pt-7"><label className="flex items-center gap-2 text-sm"><Checkbox checked={closedToArrival} onCheckedChange={(checked) => setClosedToArrival(checked === true)} />Closed to arrival</label><label className="flex items-center gap-2 text-sm"><Checkbox checked={closedToDeparture} onCheckedChange={(checked) => setClosedToDeparture(checked === true)} />Closed to departure</label></div>{canManageRates ? <Button className="md:col-span-3" disabled={saving || !roomTypeId || !ratePlanId || !price} onClick={() => void saveDailyRate()}><Save className="mr-2 h-4 w-4" />Save daily rate</Button> : null}</> : <HotelEmptyState className="md:col-span-3" title="Rate setup incomplete" description="Create at least one room type and one rate plan." />}</CardContent></Card>
    </div>
  );
}
