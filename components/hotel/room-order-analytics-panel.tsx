"use client";

import { useCallback, useEffect, useState } from "react";
import { startOfMonth } from "date-fns";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getApiErrorMessage } from "@/lib/api-error-message";
import { hotelDate, hotelPmsApi } from "@/lib/hotel/api";
import type { HotelRoomOrderAnalytics } from "@/lib/hotel/types";
import { hotelCurrency } from "./hotel-ui";

export function RoomOrderAnalyticsPanel({ restaurantId, refreshKey }: { restaurantId: number; refreshKey: number }) {
  const [dateFrom, setDateFrom] = useState(hotelDate(startOfMonth(new Date())));
  const [dateTo, setDateTo] = useState(hotelDate(new Date()));
  const [data, setData] = useState<HotelRoomOrderAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await hotelPmsApi.getRoomOrderAnalytics(restaurantId, dateFrom, dateTo));
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to load room-order analytics"));
    } finally {
      setLoading(false);
    }
  }, [restaurantId, dateFrom, dateTo]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  const metrics = data ? [
    ["Completed sales", hotelCurrency(data.gross_sales)],
    ["Paid directly", hotelCurrency(data.paid_now_sales)],
    ["Added to room bills", hotelCurrency(data.posted_to_folio_sales)],
    ["Open room orders", hotelCurrency(data.unsettled_sales)],
    ["Orders", String(data.order_count)],
    ["Average order", hotelCurrency(data.average_order_value)],
  ] : [];

  return <div className="space-y-5">
    <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
      <div><h2 className="text-xl font-bold">Room-order analytics</h2><p className="text-sm text-muted-foreground">Hotel operational attribution for F&amp;B orders. These sales are already included once in restaurant analytics and finance.</p></div>
      <div className="flex items-center gap-2"><Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /><Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /><Button variant="outline" size="icon" onClick={() => void load()}><RefreshCw className="h-4 w-4" /></Button></div>
    </div>
    {loading && !data ? <div className="flex min-h-56 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin" /></div> : <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{metrics.map(([label, value]) => <Card key={label}><CardContent className="p-5"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></CardContent></Card>)}</div>
      <Card><CardHeader><CardTitle className="text-base">By room</CardTitle></CardHeader><CardContent className="space-y-2">{data?.orders_by_room.length ? data.orders_by_room.map((row) => <div key={row.room_id} className="flex items-center justify-between rounded-lg border p-3"><div><p className="font-semibold">Room {row.room_number}</p><p className="text-xs text-muted-foreground">{row.order_count} order(s)</p></div><p className="font-semibold">{hotelCurrency(row.gross_sales)}</p></div>) : <p className="text-sm text-muted-foreground">No room orders in this period.</p>}</CardContent></Card>
    </>}
  </div>;
}
