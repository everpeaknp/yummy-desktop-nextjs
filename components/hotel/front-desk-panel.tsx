"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  BedDouble,
  CalendarCheck2,
  ChevronRight,
  DoorOpen,
  Loader2,
  RefreshCw,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getApiErrorMessage } from "@/lib/api-error-message";
import { hotelDate, hotelPmsApi } from "@/lib/hotel/api";
import type { HotelBooking, HotelFrontDesk, HotelStay } from "@/lib/hotel/types";
import { cn } from "@/lib/utils";
import { HotelEmptyState, HotelStatusBadge, humanizeHotelStatus } from "./hotel-ui";

interface Props {
  restaurantId: number;
  refreshKey: number;
  onOpenBooking: (bookingId: number) => void;
}

function guestInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "G";
}

function BookingRow({ booking, onOpen, attention = false }: { booking: HotelBooking; onOpen: () => void; attention?: boolean }) {
  const roomLabels = booking.rooms.map((item) => item.assigned_room ? `Room ${item.assigned_room.number}` : item.room_type.code);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group flex w-full items-center gap-3 rounded-2xl border bg-background p-3.5 text-left transition-all hover:border-orange-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500",
        attention && "border-amber-300 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20",
      )}
    >
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-black", attention ? "bg-amber-500/15 text-amber-700" : "bg-orange-500/10 text-orange-600")}>{guestInitial(booking.primary_guest_name)}</span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2"><span className="truncate font-bold">{booking.primary_guest_name}</span><HotelStatusBadge value={booking.status} /></span>
        <span className="mt-1 block truncate text-xs text-muted-foreground">{roomLabels.length ? roomLabels.join(", ") : "Room not assigned"} / {booking.confirmation_code}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-orange-600" />
    </button>
  );
}

function StayRow({ stay, onOpen }: { stay: HotelStay; onOpen: () => void }) {
  const roomNumbers = stay.assignments.filter((assignment) => !assignment.released_at).map((assignment) => assignment.room.number);
  return (
    <button type="button" onClick={onOpen} className="group flex w-full items-center gap-3 rounded-2xl border bg-background p-3.5 text-left transition-all hover:border-violet-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-sm font-black text-violet-700">{guestInitial(stay.booking.primary_guest_name)}</span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2"><span className="truncate font-bold">{stay.booking.primary_guest_name}</span><HotelStatusBadge value={stay.status} /></span>
        <span className="mt-1 block truncate text-xs text-muted-foreground">{roomNumbers.length ? `Room ${roomNumbers.join(", ")}` : "No active room"} / {stay.booking.confirmation_code}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-orange-600" />
    </button>
  );
}

function WorkQueue({ title, description, count, children }: { title: string; description: string; count: number; children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b px-4 py-4 sm:px-5">
        <div><h3 className="font-black">{title}</h3><p className="mt-0.5 text-xs text-muted-foreground">{description}</p></div>
        <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-muted px-2 text-xs font-black">{count}</span>
      </div>
      <CardContent className="space-y-2 p-3 sm:p-4">{children}</CardContent>
    </Card>
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

  useEffect(() => { void load(); }, [load, refreshKey]);

  if (loading && !data) {
    return <div className="flex min-h-72 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin" /></div>;
  }

  const metrics = [
    { label: "Arrivals", value: data?.arrivals.length ?? 0, icon: CalendarCheck2, color: "bg-blue-500/10 text-blue-700" },
    { label: "Departures", value: data?.departures.length ?? 0, icon: DoorOpen, color: "bg-amber-500/10 text-amber-700" },
    { label: "In house", value: data?.in_house.length ?? 0, icon: UsersRound, color: "bg-violet-500/10 text-violet-700" },
    { label: "Need a room", value: data?.unassigned.length ?? 0, icon: BedDouble, color: "bg-rose-500/10 text-rose-700" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><h2 className="text-2xl font-black tracking-tight">Front desk</h2><p className="mt-1 text-sm text-muted-foreground">Arrivals, departures, and guests staying on the selected date.</p></div>
        <div className="flex gap-2"><Input aria-label="Front desk date" className="h-11 w-full rounded-xl sm:w-44" type="date" value={businessDate} onChange={(event) => setBusinessDate(event.target.value)} /><Button aria-label="Refresh front desk" variant="outline" size="icon" className="h-11 w-11 rounded-xl" onClick={() => void load()} disabled={loading}><RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /></Button></div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {metrics.map((metric) => <Card key={metric.label} className="shadow-none"><CardContent className="flex items-center gap-3 p-3.5 sm:p-4"><span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", metric.color)}><metric.icon className="h-5 w-5" /></span><div><p className="text-2xl font-black leading-none">{metric.value}</p><p className="mt-1 text-xs text-muted-foreground">{metric.label}</p></div></CardContent></Card>)}
      </div>

      {data?.unassigned.length ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/20 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3"><span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700"><AlertTriangle className="h-4 w-4" /></span><div><p className="font-bold">{data.unassigned.length} arrival{data.unassigned.length === 1 ? " needs" : "s need"} a room</p><p className="text-xs text-muted-foreground">Assign rooms before check-in to keep the arrival queue moving.</p></div></div>
          <Button variant="outline" className="rounded-xl bg-background" onClick={() => onOpenBooking(data.unassigned[0].id)}>Review first booking</Button>
        </div>
      ) : null}

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <WorkQueue title="Arrivals" description="Guests checking in" count={data?.arrivals.length ?? 0}>{data?.arrivals.length ? data.arrivals.map((booking) => <BookingRow key={booking.id} booking={booking} onOpen={() => onOpenBooking(booking.id)} attention={!booking.rooms.some((room) => room.assigned_room)} />) : <HotelEmptyState title="No arrivals" description="No guests are checking in on this date." />}</WorkQueue>
        <WorkQueue title="Departures" description="Guests checking out" count={data?.departures.length ?? 0}>{data?.departures.length ? data.departures.map((booking) => <BookingRow key={booking.id} booking={booking} onOpen={() => onOpenBooking(booking.id)} />) : <HotelEmptyState title="No departures" description="No guests are checking out on this date." />}</WorkQueue>
        <WorkQueue title="Staying guests" description="Guests currently in the hotel" count={data?.in_house.length ?? 0}>{data?.in_house.length ? data.in_house.map((stay) => <StayRow key={stay.id} stay={stay} onOpen={() => onOpenBooking(stay.booking_id)} />) : <HotelEmptyState title="No staying guests" description="No guests are currently checked in." />}</WorkQueue>
        <WorkQueue title="Bookings without rooms" description="Assign before arrival" count={data?.unassigned.length ?? 0}>{data?.unassigned.length ? data.unassigned.map((booking) => <BookingRow key={booking.id} booking={booking} onOpen={() => onOpenBooking(booking.id)} attention />) : <HotelEmptyState title="All rooms assigned" description="Every expected arrival has a room." />}</WorkQueue>
      </div>

      {data?.room_counts ? <div className="rounded-2xl border bg-card p-4"><div className="mb-3 flex items-center gap-2"><BedDouble className="h-4 w-4 text-orange-600" /><h3 className="text-sm font-bold">Room availability</h3></div><div className="flex flex-wrap gap-2">{Object.entries(data.room_counts).map(([key, value]) => <div key={key} className="rounded-xl bg-muted/50 px-3 py-2 text-sm"><span className="text-muted-foreground">{humanizeHotelStatus(key)}</span><span className="ml-2 font-black">{value}</span></div>)}</div></div> : null}
    </div>
  );
}
