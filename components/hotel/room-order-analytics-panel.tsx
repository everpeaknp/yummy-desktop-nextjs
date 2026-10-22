"use client";

import { useCallback, useEffect, useState } from "react";
import { startOfMonth } from "date-fns";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
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
      toast.error(getApiErrorMessage(error, "We couldn't load the room service report"));
    } finally {
      setLoading(false);
    }
  }, [restaurantId, dateFrom, dateTo]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  const metrics = data ? [
    ["Room service sales", hotelCurrency(data.gross_sales)],
    ["Paid when ordered", hotelCurrency(data.paid_now_sales)],
    ["Charged to guest bills", hotelCurrency(data.posted_to_folio_sales)],
    ["Still open", hotelCurrency(data.unsettled_sales)],
    ["Total orders", String(data.order_count)],
    ["Average order value", hotelCurrency(data.average_order_value)],
  ] : [];

  return <div className="space-y-5">
    <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
      <p className="text-sm text-muted-foreground">Food and drinks ordered by hotel guests. These sales are included in restaurant reports.</p>
      <div className="grid grid-cols-2 gap-2"><Input aria-label="Report start date" className="h-11 rounded-xl" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /><Input aria-label="Report end date" className="h-11 rounded-xl" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></div>
    </div>
    {loading && !data ? <div className="flex min-h-56 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin" /></div> : <>
      <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-3">{metrics.map(([label, value]) => <Card key={label} className="shadow-none"><CardContent className="p-3.5 sm:p-4"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-1 text-base font-bold tabular-nums sm:text-lg">{value}</p></CardContent></Card>)}</div>
      <Card className="shadow-sm"><CardHeader><CardTitle className="text-base">Sales by room</CardTitle></CardHeader><CardContent className="grid gap-2 md:grid-cols-2">{data?.orders_by_room.length ? data.orders_by_room.map((row) => <div key={row.room_id} className="flex items-center justify-between rounded-xl border bg-muted/20 p-3"><div><p className="font-semibold">Room {row.room_number}</p><p className="text-xs text-muted-foreground">{row.order_count} {row.order_count === 1 ? "order" : "orders"}</p></div><p className="font-bold">{hotelCurrency(row.gross_sales)}</p></div>) : <p className="text-sm text-muted-foreground">No room service orders for these dates.</p>}</CardContent></Card>
    </>}
  </div>;
}
