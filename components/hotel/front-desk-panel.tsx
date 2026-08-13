"use client";

import { useCallback, useEffect, useState } from "react";
import { BedDouble, CalendarCheck2, DoorOpen, Loader2, RefreshCw, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getApiErrorMessage } from "@/lib/api-error-message";
import { hotelDate, hotelPmsApi } from "@/lib/hotel/api";
import type { HotelBooking, HotelFrontDesk, HotelStay } from "@/lib/hotel/types";
import { HotelEmptyState, HotelStatusBadge, humanizeHotelStatus } from "./hotel-ui";

interface Props {
  restaurantId: number;
  refreshKey: number;
  onOpenBooking: (bookingId: number) => void;
}

function BookingRow({ booking, onOpen }: { booking: HotelBooking; onOpen: () => void }) {
  const room = booking.rooms[0]?.assigned_room;
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-muted/50">
      <div className="min-w-0">
        <p className="truncate font-semibold">{booking.primary_guest_name}</p>
        <p className="truncate text-xs text-muted-foreground">{booking.confirmation_code} · {room ? `Room ${room.number}` : "Unassigned"}</p>
      </div>
      <HotelStatusBadge value={booking.status} />
    </button>
  );
}

function StayRow({ stay, onOpen }: { stay: HotelStay; onOpen: () => void }) {
  const activeRooms = stay.assignments.filter((assignment) => !assignment.released_at).map((assignment) => assignment.room.number);
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-muted/50">
      <div className="min-w-0">
        <p className="truncate font-semibold">{stay.booking.primary_guest_name}</p>
        <p className="truncate text-xs text-muted-foreground">{stay.booking.confirmation_code} · {activeRooms.length ? `Room ${activeRooms.join(", ")}` : "No active room"}</p>
      </div>
      <HotelStatusBadge value={stay.status} />
    </button>
  );
}

export function FrontDeskPanel({ restaurantId, refreshKey, onOpenBooking }: Props) {
  const [businessDate, setBusinessDate] = useState(hotelDate(new Date()));
  const [data, setData] = useState<HotelFrontDesk | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await hotelPmsApi.getFrontDesk(restaurantId, businessDate));
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to load front desk"));
    } finally {
      setLoading(false);
    }
  }, [restaurantId, businessDate]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  if (loading && !data) {
    return <div className="flex min-h-72 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin" /></div>;
  }

  const metrics = [
    { label: "Arrivals", value: data?.arrivals.length ?? 0, icon: CalendarCheck2, color: "text-blue-600" },
    { label: "Departures", value: data?.departures.length ?? 0, icon: DoorOpen, color: "text-amber-600" },
    { label: "In house", value: data?.in_house.length ?? 0, icon: UsersRound, color: "text-emerald-600" },
    { label: "Unassigned", value: data?.unassigned.length ?? 0, icon: BedDouble, color: "text-rose-600" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div><h2 className="text-xl font-bold">Front desk</h2><p className="text-sm text-muted-foreground">Today&apos;s operational arrivals, departures, and stays.</p></div>
        <div className="flex gap-2">
          <Input className="w-40" type="date" value={businessDate} onChange={(event) => setBusinessDate(event.target.value)} />
          <Button variant="outline" size="icon" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} /></Button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label}><CardContent className="flex items-center justify-between p-5"><div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{metric.label}</p><p className="mt-1 text-3xl font-black">{metric.value}</p></div><metric.icon className={`h-7 w-7 ${metric.color}`} /></CardContent></Card>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Expected arrivals</CardTitle></CardHeader>
          <CardContent className="space-y-2">{data?.arrivals.length ? data.arrivals.map((booking) => <BookingRow key={booking.id} booking={booking} onOpen={() => onOpenBooking(booking.id)} />) : <HotelEmptyState title="No arrivals" description="No guests are expected on this date." />}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Expected departures</CardTitle></CardHeader>
          <CardContent className="space-y-2">{data?.departures.length ? data.departures.map((booking) => <BookingRow key={booking.id} booking={booking} onOpen={() => onOpenBooking(booking.id)} />) : <HotelEmptyState title="No departures" description="No checked-in stays are due out on this date." />}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">In-house guests</CardTitle></CardHeader>
          <CardContent className="space-y-2">{data?.in_house.length ? data.in_house.map((stay) => <StayRow key={stay.id} stay={stay} onOpen={() => onOpenBooking(stay.booking_id)} />) : <HotelEmptyState title="No in-house guests" description="There are no active stays." />}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Unassigned bookings</CardTitle></CardHeader>
          <CardContent className="space-y-2">{data?.unassigned.length ? data.unassigned.map((booking) => <BookingRow key={booking.id} booking={booking} onOpen={() => onOpenBooking(booking.id)} />) : <HotelEmptyState title="All rooms assigned" description="No expected arrival is waiting for a physical room." />}</CardContent>
        </Card>
      </div>
      {data?.room_counts ? (
        <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><BedDouble className="h-4 w-4" />Room state</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-3">{Object.entries(data.room_counts).map(([key, value]) => <div key={key} className="rounded-lg border px-4 py-2"><span className="text-sm text-muted-foreground">{humanizeHotelStatus(key)}</span><span className="ml-2 font-bold">{value}</span></div>)}</CardContent></Card>
      ) : null}
    </div>
  );
}
