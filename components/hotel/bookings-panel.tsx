"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
      toast.error(getApiErrorMessage(error, "Failed to load bookings"));
    } finally {
      setLoading(false);
    }
  }, [restaurantId, search, status]);

  useEffect(() => {
    void load();
  }, [refreshKey, status]); // Search is deliberately submitted, not fired per keystroke.

  const created = () => {
    void load();
    onChanged();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div><h2 className="text-xl font-bold">Bookings</h2><p className="text-sm text-muted-foreground">Search and manage the complete reservation lifecycle.</p></div>
        {canManage ? <Button onClick={() => setFormOpen(true)}><Plus className="mr-2 h-4 w-4" />New booking</Button> : null}
      </div>
      <div className="flex flex-col gap-2 md:flex-row">
        <div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void load(); }} placeholder="Guest, phone, or confirmation code" /></div>
        <Select value={status} onValueChange={setStatus}><SelectTrigger className="md:w-48"><SelectValue /></SelectTrigger><SelectContent>{["all", "held", "pending", "confirmed", "checked_in", "checked_out", "canceled", "no_show"].map((value) => <SelectItem key={value} value={value}>{value === "all" ? "All statuses" : humanizeHotelStatus(value)}</SelectItem>)}</SelectContent></Select>
        <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />Search</Button>
      </div>
      <Card><CardContent className="p-0">
        {loading && !bookings.length ? <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin" /></div> : bookings.length ? (
          <Table>
            <TableHeader><TableRow><TableHead>Guest</TableHead><TableHead>Stay</TableHead><TableHead>Rooms</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>{bookings.map((booking) => (
              <TableRow key={booking.id} className="cursor-pointer" onClick={() => onOpenBooking(booking.id)}>
                <TableCell><p className="font-semibold">{booking.primary_guest_name}</p><p className="text-xs text-muted-foreground">{booking.confirmation_code}</p></TableCell>
                <TableCell>{booking.arrival_date} → {booking.departure_date}</TableCell>
                <TableCell>{booking.rooms.map((room) => room.assigned_room?.number ?? room.room_type.code).join(", ")}</TableCell>
                <TableCell>{hotelCurrency(booking.rooms.reduce((sum, room) => sum + Number(room.room_charge_total), 0), booking.currency)}</TableCell>
                <TableCell><HotelStatusBadge value={booking.status} /></TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        ) : <HotelEmptyState className="m-5" title="No bookings found" description="Change the filters or create a booking." />}
      </CardContent></Card>
      <BookingFormDialog open={formOpen} onOpenChange={setFormOpen} restaurantId={restaurantId} onCreated={created} />
    </div>
  );
}
