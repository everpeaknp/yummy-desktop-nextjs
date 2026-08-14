"use client";

import { useCallback, useEffect, useState } from "react";
import { BedDouble, CalendarDays, ChevronRight, Loader2, Plus, RefreshCw, Search, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getApiErrorMessage } from "@/lib/api-error-message";
import { hotelPmsApi } from "@/lib/hotel/api";
import type { HotelBooking } from "@/lib/hotel/types";
import { BookingFormDialog } from "./booking-form-dialog";
import { HotelEmptyState, HotelStatusBadge, hotelCurrency, humanizeHotelStatus } from "./hotel-ui";

interface Props {
  restaurantId: number;
  canManage: boolean;
  refreshKey: number;
  onOpenBooking: (bookingId: number) => void;
  onChanged: () => void;
}

function bookingRooms(booking: HotelBooking) {
  return booking.rooms.map((room) => room.assigned_room?.number ? `Room ${room.assigned_room.number}` : room.room_type.code).join(", ") || "Room not assigned";
}

function bookingTotal(booking: HotelBooking) {
  return hotelCurrency(booking.rooms.reduce((sum, room) => sum + Number(room.room_charge_total), 0), booking.currency);
}

export function BookingsPanel({ restaurantId, canManage, refreshKey, onOpenBooking, onChanged }: Props) {
  const [bookings, setBookings] = useState<HotelBooking[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setBookings(await hotelPmsApi.listBookings(restaurantId, {
        status: status === "all" ? undefined : status,
        search: search.trim() || undefined,
      }));
    } catch (error) {
      toast.error(getApiErrorMessage(error, "We couldn't load the bookings"));
    } finally {
      setLoading(false);
    }
  }, [restaurantId, search, status]);

  useEffect(() => { void load(); }, [refreshKey, status]); // Search is submitted, not fired per keystroke.

  const created = () => { void load(); onChanged(); };

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div><h2 className="text-2xl font-black tracking-tight">Bookings</h2><p className="mt-1 text-sm text-muted-foreground">Search by guest, phone number, or booking code.</p></div>
        {canManage ? <Button className="h-11 rounded-xl" onClick={() => setFormOpen(true)}><Plus className="mr-2 h-4 w-4" />New booking</Button> : null}
      </div>

      <Card className="shadow-none"><CardContent className="flex flex-col gap-2 p-3 md:flex-row">
        <div className="relative flex-1"><Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><Input className="h-11 rounded-xl pl-9" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void load(); }} placeholder="Guest, phone, or confirmation code" /></div>
        <Select value={status} onValueChange={setStatus}><SelectTrigger className="h-11 rounded-xl md:w-48"><SelectValue /></SelectTrigger><SelectContent>{["all", "held", "pending", "confirmed", "checked_in", "checked_out", "canceled", "no_show"].map((value) => <SelectItem key={value} value={value}>{value === "all" ? "All statuses" : humanizeHotelStatus(value)}</SelectItem>)}</SelectContent></Select>
        <Button className="h-11 rounded-xl" variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />Search</Button>
      </CardContent></Card>

      <Card className="overflow-hidden shadow-sm"><CardContent className="p-0">
        {loading && !bookings.length ? <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin" /></div> : bookings.length ? <>
          <div className="divide-y md:hidden">{bookings.map((booking) => <button key={booking.id} type="button" onClick={() => onOpenBooking(booking.id)} className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-muted/40">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600"><UserRound className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="truncate font-black">{booking.primary_guest_name}</span><HotelStatusBadge value={booking.status} /></span><span className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" />{booking.arrival_date} - {booking.departure_date}</span><span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><BedDouble className="h-3.5 w-3.5" />{bookingRooms(booking)}</span><span className="mt-2 block text-sm font-bold">{bookingTotal(booking)}</span></span>
            <ChevronRight className="mt-3 h-4 w-4 shrink-0 text-muted-foreground" />
          </button>)}</div>
          <div className="hidden md:block"><Table>
            <TableHeader><TableRow><TableHead>Guest</TableHead><TableHead>Stay</TableHead><TableHead>Rooms</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>{bookings.map((booking) => <TableRow key={booking.id} className="cursor-pointer transition-colors" onClick={() => onOpenBooking(booking.id)}><TableCell><p className="font-semibold">{booking.primary_guest_name}</p><p className="text-xs text-muted-foreground">{booking.confirmation_code}</p></TableCell><TableCell>{booking.arrival_date} - {booking.departure_date}</TableCell><TableCell>{bookingRooms(booking)}</TableCell><TableCell className="font-semibold">{bookingTotal(booking)}</TableCell><TableCell><HotelStatusBadge value={booking.status} /></TableCell></TableRow>)}</TableBody>
          </Table></div>
        </> : <HotelEmptyState className="m-5" title="No bookings found" description="Change the filters or create a booking." />}
      </CardContent></Card>
      <BookingFormDialog open={formOpen} onOpenChange={setFormOpen} restaurantId={restaurantId} onCreated={created} />
    </div>
  );
}
