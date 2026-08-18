"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, MoonStar, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getApiErrorMessage } from "@/lib/api-error-message";
import { hotelPmsApi } from "@/lib/hotel/api";
import type { HotelNightAudit } from "@/lib/hotel/types";
import { HotelEmptyState, HotelStatusBadge, humanizeHotelStatus } from "./hotel-ui";

interface Props {
  restaurantId: number;
  canRun: boolean;
  refreshKey: number;
  onChanged: () => void;
}

function displayValue(value: unknown): string {
  if (value == null) return "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function NightAuditPanel({ restaurantId, canRun, refreshKey, onChanged }: Props) {
  const [businessDate, setBusinessDate] = useState("");
  const [audit, setAudit] = useState<HotelNightAudit | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const preview = useCallback(async () => {
    setLoading(true);
    try {
      const settings = await hotelPmsApi.getSettings(restaurantId);
      setBusinessDate(settings.current_business_date);
      setAudit(await hotelPmsApi.previewNightAudit(restaurantId, settings.current_business_date));
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not load the hotel day summary"));
    } finally { setLoading(false); }
  }, [restaurantId]);

  useEffect(() => { void preview(); }, [preview, refreshKey]);

  const run = async () => {
    if (!businessDate) return;
    if (!window.confirm(`Close the hotel day for ${businessDate}?`)) return;
    setRunning(true);
    try {
      const result = await hotelPmsApi.runNightAudit(restaurantId, businessDate);
      setAudit(result);
      if (result.status === "completed") {
        toast.success("Hotel day closed");
        await preview();
      }
      else toast.warning("Resolve the listed items before closing the hotel day");
      onChanged();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not close the hotel day"));
    } finally { setRunning(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><h2 className="text-2xl font-black tracking-tight">Close the hotel day</h2><p className="mt-1 text-sm text-muted-foreground">Check arrivals, departures, and unpaid guest bills before moving to the next day.</p></div>
        <div className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2"><div><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Current hotel day</p><p className="text-sm font-bold tabular-nums">{businessDate || "Loading..."}</p></div><Button aria-label="Refresh day summary" className="ml-2 h-9 w-9 rounded-xl" variant="ghost" size="icon" onClick={() => void preview()} disabled={loading}><RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} /></Button></div>
      </div>
      {loading && !audit ? <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin" /></div> : audit ? <>
        <Card className="overflow-hidden shadow-sm"><CardContent className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center"><div className="flex items-center gap-3"><div className="rounded-2xl bg-indigo-500/10 p-3 text-indigo-600"><MoonStar className="h-6 w-6" /></div><div><p className="font-bold">Date to close: {audit.business_date}</p><div className="mt-1"><HotelStatusBadge value={audit.status} /></div></div></div>{canRun ? <Button className="rounded-xl" onClick={() => void run()} disabled={running || audit.blockers.length > 0 || audit.status === "completed"}>{running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MoonStar className="mr-2 h-4 w-4" />}Close this day</Button> : null}</CardContent></Card>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="shadow-sm"><CardHeader><CardTitle className="text-base">Before closing</CardTitle></CardHeader><CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">{Object.entries(audit.summary).map(([key, value]) => <div key={key} className="flex items-center justify-between rounded-xl border bg-muted/20 px-3 py-2.5"><span className="text-sm text-muted-foreground">{humanizeHotelStatus(key)}</span><span className="font-bold">{displayValue(value)}</span></div>)}</CardContent></Card>
          <Card className="shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-base">{audit.blockers.length ? <AlertTriangle className="h-4 w-4 text-amber-600" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}{audit.blockers.length ? "Needs attention" : "Ready to close"}</CardTitle></CardHeader><CardContent className="space-y-2">{audit.blockers.length ? audit.blockers.map((blocker, index) => <div key={index} className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3"><p className="font-semibold">{humanizeHotelStatus(String(blocker.code ?? "attention_required"))}</p><p className="mt-1 text-xs text-muted-foreground">{blocker.booking_id != null ? `Booking #${displayValue(blocker.booking_id)}` : "This booking needs attention"}{blocker.balance != null ? ` · Amount due: ${displayValue(blocker.balance)}` : ""}</p></div>) : <HotelEmptyState title="Everything is ready" description="There are no unpaid departures or other issues to resolve." />}</CardContent></Card>
        </div>
      </> : <HotelEmptyState title="No day summary" description="Choose a date and refresh." />}
    </div>
  );
}
