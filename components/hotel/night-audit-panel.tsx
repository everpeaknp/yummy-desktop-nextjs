"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, MoonStar, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getApiErrorMessage } from "@/lib/api-error-message";
import { hotelDate, hotelPmsApi } from "@/lib/hotel/api";
import type { HotelNightAudit } from "@/lib/hotel/types";
import { HotelEmptyState, HotelStatusBadge, humanizeHotelStatus } from "./hotel-ui";

interface Props {
  restaurantId: number;
  canRun: boolean;
  refreshKey: number;
  onChanged: () => void;
}

function displayValue(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function NightAuditPanel({ restaurantId, canRun, refreshKey, onChanged }: Props) {
  const [businessDate, setBusinessDate] = useState(hotelDate(new Date()));
  const [audit, setAudit] = useState<HotelNightAudit | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const preview = useCallback(async () => {
    setLoading(true);
    try {
      setAudit(await hotelPmsApi.previewNightAudit(restaurantId, businessDate));
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not load the hotel day summary"));
    } finally { setLoading(false); }
  }, [restaurantId, businessDate]);

  useEffect(() => { void preview(); }, [preview, refreshKey]);

  const run = async () => {
    if (!window.confirm(`Close the hotel day for ${businessDate}?`)) return;
    setRunning(true);
    try {
      const result = await hotelPmsApi.runNightAudit(restaurantId, businessDate);
      setAudit(result);
      if (result.status === "completed") toast.success("Hotel day closed");
      else toast.warning("Resolve the listed items before closing the hotel day");
      onChanged();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not close the hotel day"));
    } finally { setRunning(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div><h2 className="text-xl font-bold">Close hotel day</h2><p className="text-sm text-muted-foreground">Review departures and room charges before starting the next hotel day.</p></div>
        <div className="flex gap-2"><Input className="w-40" type="date" value={businessDate} onChange={(event) => setBusinessDate(event.target.value)} /><Button variant="outline" size="icon" onClick={() => void preview()} disabled={loading}><RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} /></Button></div>
      </div>
      {loading && !audit ? <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin" /></div> : audit ? <>
        <Card><CardContent className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center"><div className="flex items-center gap-3"><div className="rounded-xl bg-indigo-500/10 p-3 text-indigo-600"><MoonStar className="h-6 w-6" /></div><div><p className="font-semibold">Hotel day: {audit.business_date}</p><div className="mt-1"><HotelStatusBadge value={audit.status} /></div></div></div>{canRun ? <Button onClick={() => void run()} disabled={running || audit.blockers.length > 0 || audit.status === "completed"}>{running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MoonStar className="mr-2 h-4 w-4" />}Close day</Button> : null}</CardContent></Card>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card><CardHeader><CardTitle className="text-base">Daily summary</CardTitle></CardHeader><CardContent className="space-y-2">{Object.entries(audit.summary).map(([key, value]) => <div key={key} className="flex items-center justify-between rounded-lg border px-3 py-2"><span className="text-sm text-muted-foreground">{humanizeHotelStatus(key)}</span><span className="font-semibold">{displayValue(value)}</span></div>)}</CardContent></Card>
          <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base">{audit.blockers.length ? <AlertTriangle className="h-4 w-4 text-amber-600" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}Items to resolve</CardTitle></CardHeader><CardContent className="space-y-2">{audit.blockers.length ? audit.blockers.map((blocker, index) => <div key={index} className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3"><p className="font-semibold">{humanizeHotelStatus(String(blocker.code ?? "attention_required"))}</p><p className="mt-1 text-xs text-muted-foreground">{blocker.booking_id != null ? `Booking #${displayValue(blocker.booking_id)}` : "Booking needs attention"}{blocker.balance != null ? ` · Amount due: ${displayValue(blocker.balance)}` : ""}</p></div>) : <HotelEmptyState title="Ready to close" description="No departures need attention." />}</CardContent></Card>
        </div>
      </> : <HotelEmptyState title="No day summary" description="Choose a date and refresh." />}
    </div>
  );
}
