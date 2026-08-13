"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { ArrowRightLeft, Loader2, LogIn, LogOut, MoreHorizontal, UtensilsCrossed, WalletCards } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { getApiErrorMessage } from "@/lib/api-error-message";
import { hotelDate, hotelPmsApi } from "@/lib/hotel/api";
import { hasHotelPaymentDue, unbilledBookingRoomCharges } from "@/lib/hotel/bill-summary";
import type { HotelAvailability, HotelBooking, HotelFolioPaymentQuote, HotelRoomOrder, HotelStay } from "@/lib/hotel/types";
import { hasUnassignedRooms, hotelMoney, isPreArrivalBooking } from "@/lib/hotel/types";
import { HotelStatusBadge, hotelCurrency, humanizeHotelStatus, roomServiceStatusLabel } from "./hotel-ui";
import { FolioPaymentDialog } from "./folio-payment-dialog";
import { GuestBillCard } from "./guest-bill-card";

interface Permissions {
  bookings: boolean;
  checkin: boolean;
  checkout: boolean;
  folioEdit: boolean;
  roomOrderCreate: boolean;
}

interface Props {
  bookingId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  permissions: Permissions;
  onChanged: () => void;
}

function dateLabel(value: string): string {
  return format(parseISO(value), "d MMM yyyy");
}

export function BookingDetailDialog({ bookingId, open, onOpenChange, permissions, onChanged }: Props) {
  const router = useRouter();
  const [booking, setBooking] = useState<HotelBooking | null>(null);
  const [stay, setStay] = useState<HotelStay | null>(null);
  const [roomOrders, setRoomOrders] = useState<HotelRoomOrder[]>([]);
  const [availability, setAvailability] = useState<HotelAvailability | null>(null);
  const [assignments, setAssignments] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [checkoutAfterPayment, setCheckoutAfterPayment] = useState(false);
  const [paymentQuote, setPaymentQuote] = useState<HotelFolioPaymentQuote | null>(null);
  const [billQuote, setBillQuote] = useState<HotelFolioPaymentQuote | null>(null);
  const [extensionDate, setExtensionDate] = useState("");
  const [moveBookingRoomId, setMoveBookingRoomId] = useState("");
  const [moveTargetRoomId, setMoveTargetRoomId] = useState("");
  const [moveReason, setMoveReason] = useState("");

  const load = useCallback(async () => {
    if (!bookingId) return;
    setLoading(true);
    setBillQuote(null);
    setPaymentQuote(null);
    try {
      const nextBooking = await hotelPmsApi.getBooking(bookingId);
      setBooking(nextBooking);
      setAssignments({});
      let nextStay: HotelStay | null = null;
      if (["checked_in", "checked_out"].includes(nextBooking.status)) {
        nextStay = await hotelPmsApi.getBookingStay(bookingId);
      }
      setStay(nextStay);
      if (nextStay) {
        const activeFolio = nextStay.folios[0];
        const [nextRoomOrders, nextBillQuote] = await Promise.all([
          hotelPmsApi.listStayRoomOrders(nextStay.id).catch((error) => {
            toast.error(getApiErrorMessage(error, "Could not refresh room service"));
            return [];
          }),
          activeFolio && nextStay.status !== "checked_out" && activeFolio.status !== "closed"
            ? hotelPmsApi.getFolioPaymentQuote(activeFolio.id).catch((error) => {
                toast.error(getApiErrorMessage(error, "Could not refresh the guest bill"));
                return null;
              })
            : Promise.resolve(null),
        ]);
        setRoomOrders(nextRoomOrders);
        setBillQuote(nextBillQuote);
      } else {
        setRoomOrders([]);
        setBillQuote(null);
      }
      const currentDay = hotelDate(new Date());
      const arrival = nextStay ? currentDay : nextBooking.arrival_date;
      const departure =
        nextBooking.departure_date > arrival
          ? nextBooking.departure_date
          : hotelDate(addDays(new Date(`${arrival}T00:00:00`), 1));
      setAvailability(
        await hotelPmsApi.getAvailability(
          nextBooking.restaurant_id,
          arrival,
          departure,
          { exclude_booking_id: nextBooking.id },
        ),
      );
      const active = nextStay?.assignments.find((assignment) => !assignment.released_at);
      setMoveBookingRoomId(active ? String(active.booking_room_id) : "");
      setMoveTargetRoomId("");
      setExtensionDate(hotelDate(addDays(parseISO(nextBooking.departure_date), 1)));
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to load booking"));
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const run = async (action: () => Promise<void>, success: string) => {
    setWorking(true);
    try {
      await action();
      toast.success(success);
      await load();
      onChanged();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Hotel operation failed"));
    } finally {
      setWorking(false);
    }
  };

  const availableRooms = useMemo(
    () => availability?.room_types.flatMap((row) => row.available_rooms) ?? [],
    [availability],
  );
  const activeAssignments = stay?.assignments.filter((assignment) => !assignment.released_at) ?? [];
  const selectedMoveAssignment = activeAssignments.find(
    (assignment) => String(assignment.booking_room_id) === moveBookingRoomId,
  );
  const targetRooms = availableRooms.filter((room) => room.id !== selectedMoveAssignment?.room_id);
  const folio = stay?.folios[0] ?? null;
  const displayFolio = billQuote?.folio ?? folio;
  const canTakePayment = billQuote == null || hasHotelPaymentDue(billQuote.maximum_payment);
  const unpostedRoomCharges = useMemo(() => {
    if (!booking || !displayFolio || stay?.status === "checked_out") return 0;
    return Math.max(
      hotelMoney(billQuote?.unposted_room_charges ?? 0),
      unbilledBookingRoomCharges(booking, displayFolio),
    );
  }, [billQuote, booking, displayFolio, stay?.status]);
  const resultingRoomIds =
    booking?.rooms.map((room) => room.assigned_room_id ?? assignments[room.id]).filter((id): id is number => id != null) ?? [];
  const allAssigned =
    resultingRoomIds.length === (booking?.rooms.length ?? 0) &&
    new Set(resultingRoomIds).size === resultingRoomIds.length;
  const editableRoomOrderFor = (assignmentId: number) =>
    roomOrders.find(
      (order) =>
        order.room_order_context.stay_room_assignment_id === assignmentId &&
        order.room_order_context.settlement_status === "unsettled" &&
        ["pending", "preparing", "ready"].includes(order.status),
    );

  const openRoomOrderComposer = (assignmentId: number, roomNumber: string) => {
    const editableOrder = editableRoomOrderFor(assignmentId);
    onOpenChange(false);
    if (editableOrder) {
      router.push(`/orders/${editableOrder.id}/edit`);
      return;
    }
    router.push(`/orders/create?channel=room_service&stay_assignment=${assignmentId}&room=${encodeURIComponent(roomNumber)}&guest=${encodeURIComponent(booking?.primary_guest_name || "")}`);
  };

  const assignOrCheckIn = (checkIn: boolean) => {
    if (!booking || !allAssigned) return;
    void run(async () => {
      if (checkIn) {
        await hotelPmsApi.checkIn(booking.id, booking.version, assignments);
      } else {
        await hotelPmsApi.assignRooms(booking.id, booking.version, assignments);
      }
    }, checkIn ? "Guest checked in" : "Rooms assigned");
  };

  const beginCheckout = async () => {
    if (!stay) return;
    setWorking(true);
    try {
      const prepared = await hotelPmsApi.prepareCheckout(stay.id, stay.version);
      setStay(prepared);
      setBillQuote(null);
      const preparedFolio = prepared.folios[0];
      if (!preparedFolio) throw new Error("The guest bill is unavailable.");
      if (hotelMoney(preparedFolio.balance) > 0) {
        if (!permissions.folioEdit) {
          toast.error("A user with permission to take hotel payments must complete this bill.");
          return;
        }
        setCheckoutAfterPayment(true);
        setPaymentQuote(null);
        setPaymentOpen(true);
        return;
      }
      if (hotelMoney(preparedFolio.balance) < 0) {
        toast.error("The guest has overpaid. Record a refund or adjustment before checkout.");
        return;
      }
      if (!window.confirm("The guest bill is fully paid. Check out this guest and release the room?")) return;
      await hotelPmsApi.checkout(prepared.id, prepared.version);
      toast.success("Guest checked out");
      await load();
      onChanged();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to prepare hotel checkout"));
    } finally {
      setWorking(false);
    }
  };

  const beginPayment = async () => {
    if (!stay || !folio) return;
    setWorking(true);
    try {
      const quote = await hotelPmsApi.getFolioPaymentQuote(folio.id);
      const maximumPayment = hotelMoney(quote.maximum_payment);
      if (maximumPayment <= 0.005) {
        toast.info("Payments and deposits already cover the current bill and remaining room charges.");
        return;
      }
      setCheckoutAfterPayment(false);
      setPaymentQuote(quote);
      setBillQuote(quote);
      setPaymentOpen(true);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to prepare the guest bill for payment"));
    } finally {
      setWorking(false);
    }
  };

  if (!bookingId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Booking details</DialogTitle>
          <DialogDescription>Guest, room, bill, and stay information in one place.</DialogDescription>
        </DialogHeader>
        {loading || !booking ? (
          <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin" /></div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-col justify-between gap-3 rounded-xl border p-4 md:flex-row md:items-start">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-bold">{booking.primary_guest_name}</h3>
                  <HotelStatusBadge value={booking.status} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{booking.confirmation_code} · {dateLabel(booking.arrival_date)} → {dateLabel(booking.departure_date)}</p>
                <p className="mt-1 text-sm text-muted-foreground">{booking.primary_guest_phone || "No phone"} · {booking.source}</p>
              </div>
              <div className="text-left md:text-right">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Room total</p>
                <p className="font-bold">{hotelCurrency(booking.rooms.reduce((sum, room) => sum + hotelMoney(room.room_charge_total), 0), booking.currency)}</p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {booking.rooms.map((room) => {
                const roomGuests = booking.guests.filter(
                  (guest) => guest.booking_room_id === room.id,
                );
                return (
                <Card key={room.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{room.room_type.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p>{room.assigned_room ? `Room ${room.assigned_room.number}` : "Physical room not assigned"}</p>
                    <p className="text-muted-foreground">{room.adults} adult(s) · {room.children} child(ren) · {room.nights.length} night(s)</p>
                    {roomGuests.length ? (
                      <p className="text-muted-foreground">
                        Guests: {roomGuests.map((guest) => guest.name).join(", ")}
                      </p>
                    ) : null}
                    {!room.assigned_room && isPreArrivalBooking(booking) && permissions.bookings ? (
                      <Select
                        value={assignments[room.id] ? String(assignments[room.id]) : ""}
                        onValueChange={(value) => setAssignments((current) => ({ ...current, [room.id]: Number(value) }))}
                      >
                        <SelectTrigger><SelectValue placeholder="Assign room" /></SelectTrigger>
                        <SelectContent>
                          {availableRooms
                            .filter(
                              (candidate) =>
                                candidate.room_type_id === room.room_type_id &&
                                !booking.rooms.some(
                                  (other) =>
                                    other.id !== room.id &&
                                    (other.assigned_room_id ?? assignments[other.id]) === candidate.id,
                                ),
                            )
                            .map((candidate) => (
                              <SelectItem key={candidate.id} value={String(candidate.id)}>Room {candidate.number} · {humanizeHotelStatus(candidate.housekeeping_status)}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    ) : null}
                  </CardContent>
                </Card>
                );
              })}
            </div>

            {isPreArrivalBooking(booking) ? (
              <div className="space-y-3 rounded-xl border p-4">
                <h4 className="font-semibold">Arrival actions</h4>
                <div className="flex flex-wrap gap-2">
                  {permissions.bookings && hasUnassignedRooms(booking) ? (
                    <Button variant="outline" disabled={working || !allAssigned} onClick={() => assignOrCheckIn(false)}>Assign rooms</Button>
                  ) : null}
                  {permissions.checkin ? (
                    <Button disabled={working || !allAssigned} onClick={() => assignOrCheckIn(true)}><LogIn className="mr-2 h-4 w-4" />Check in</Button>
                  ) : null}
                  {permissions.bookings ? (
                    <Button variant="outline" disabled={working} onClick={() => void run(() => hotelPmsApi.markNoShow(booking.id, booking.version).then(() => undefined), "Booking marked no-show")}>Mark no-show</Button>
                  ) : null}
                </div>
                {permissions.bookings ? (
                  <div className="flex flex-col gap-2 md:flex-row">
                    <Input value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Cancellation reason" />
                    <Button variant="destructive" disabled={working || !cancelReason.trim()} onClick={() => void run(() => hotelPmsApi.cancelBooking(booking.id, booking.version, cancelReason.trim()).then(() => undefined), "Booking canceled")}>Cancel booking</Button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {stay && folio ? (
              <div className="space-y-4">
                <Separator />
                <GuestBillCard
                  folio={displayFolio ?? folio}
                  unpostedRoomCharges={unpostedRoomCharges}
                />

                <Card>
                  <CardHeader className="flex-row items-center justify-between space-y-0">
                    <div><CardTitle className="text-base">Room service</CardTitle><p className="mt-1 text-xs text-muted-foreground">Food and drinks ordered for this stay.</p></div>
                    {permissions.roomOrderCreate && activeAssignments.length === 1 ? (
                      <Button size="sm" onClick={() => {
                        const assignment = activeAssignments[0];
                        openRoomOrderComposer(assignment.id, assignment.room.number);
                      }}><UtensilsCrossed className="mr-2 h-4 w-4" />
                        {editableRoomOrderFor(activeAssignments[0].id) ? "Add items" : "Start room service"}
                      </Button>
                    ) : null}
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {permissions.roomOrderCreate && activeAssignments.length > 1 ? activeAssignments.map((assignment) => (
                      <Button key={assignment.id} variant="outline" size="sm" onClick={() => {
                        openRoomOrderComposer(assignment.id, assignment.room.number);
                      }}><UtensilsCrossed className="mr-2 h-4 w-4" />
                        {editableRoomOrderFor(assignment.id) ? "Add items to" : "Start room service for"} room {assignment.room.number}
                      </Button>
                    )) : null}
                    {roomOrders.length ? roomOrders.map((order) => (
                      <button key={order.id} type="button" className="flex w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-muted/40" onClick={() => { onOpenChange(false); router.push(`/orders/${order.id}`); }}>
                        <div><p className="font-medium">Order #{order.restaurant_order_id || order.id}</p><p className="text-xs text-muted-foreground">{roomServiceStatusLabel({ status: order.status, settlementStatus: order.room_order_context.settlement_status })}</p></div>
                        <span className="font-semibold">{hotelCurrency(order.grand_total, folio.currency)}</span>
                      </button>
                    )) : <p className="text-sm text-muted-foreground">No room orders have been created for this stay.</p>}
                  </CardContent>
                </Card>

                {stay.status !== "checked_out" ? (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {permissions.folioEdit && canTakePayment ? (
                      <Card>
                        <CardHeader><CardTitle className="text-base">Guest payment</CardTitle></CardHeader>
                        <CardContent>
                          <p className="mb-3 text-xs text-muted-foreground">Prepare current room charges, then accept a partial or full payment without checking the guest out.</p>
                          <Button disabled={working} onClick={() => void beginPayment()}>
                            <WalletCards className="mr-2 h-4 w-4" />Add payment
                          </Button>
                        </CardContent>
                      </Card>
                    ) : null}

                    {permissions.bookings ? (
                      <Card>
                        <CardHeader><CardTitle className="text-base">Extend stay</CardTitle></CardHeader>
                        <CardContent className="flex gap-2">
                          <Input type="date" min={hotelDate(addDays(parseISO(booking.departure_date), 1))} value={extensionDate} onChange={(event) => setExtensionDate(event.target.value)} />
                          <Button variant="outline" disabled={working || extensionDate <= booking.departure_date} onClick={() => void run(() => hotelPmsApi.extendStay(stay.id, stay.version, extensionDate).then(() => undefined), "Stay extended")}><MoreHorizontal className="mr-2 h-4 w-4" />Extend</Button>
                        </CardContent>
                      </Card>
                    ) : null}

                    {permissions.checkin && activeAssignments.length ? (
                      <Card className="lg:col-span-2">
                        <CardHeader><CardTitle className="text-base">Move room</CardTitle></CardHeader>
                        <CardContent className="grid gap-2 md:grid-cols-[1fr_1fr_2fr_auto]">
                          <Select value={moveBookingRoomId} onValueChange={(value) => { setMoveBookingRoomId(value); setMoveTargetRoomId(""); }}>
                            <SelectTrigger><SelectValue placeholder="Current room" /></SelectTrigger>
                            <SelectContent>{activeAssignments.map((assignment) => <SelectItem key={assignment.id} value={String(assignment.booking_room_id)}>Room {assignment.room.number}</SelectItem>)}</SelectContent>
                          </Select>
                          <Select value={moveTargetRoomId} onValueChange={setMoveTargetRoomId}>
                            <SelectTrigger><SelectValue placeholder="Target room" /></SelectTrigger>
                            <SelectContent>{targetRooms.map((room) => <SelectItem key={room.id} value={String(room.id)}>Room {room.number} · {room.room_type.name}</SelectItem>)}</SelectContent>
                          </Select>
                          <Input value={moveReason} onChange={(event) => setMoveReason(event.target.value)} placeholder="Reason for move" />
                          <Button variant="outline" disabled={working || !moveTargetRoomId || moveReason.trim().length < 3} onClick={() => void run(() => hotelPmsApi.moveRoom(stay.id, {
                            stay_version: stay.version,
                            booking_room_id: Number(moveBookingRoomId),
                            target_room_id: Number(moveTargetRoomId),
                            reason: moveReason.trim(),
                          }).then(() => undefined), "Room moved")}><ArrowRightLeft className="mr-2 h-4 w-4" />Move</Button>
                        </CardContent>
                      </Card>
                    ) : null}

                    {permissions.checkout ? (
                      <Button className="lg:col-span-2" disabled={working} onClick={() => void beginCheckout()}><LogOut className="mr-2 h-4 w-4" />Prepare &amp; check out</Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
        {stay && folio ? (
          <FolioPaymentDialog
            open={paymentOpen}
            onOpenChange={(nextOpen) => {
              setPaymentOpen(nextOpen);
              if (!nextOpen) setPaymentQuote(null);
            }}
            restaurantId={booking?.restaurant_id ?? stay.restaurant_id}
            stayId={stay.id}
            bookingVersion={booking?.version ?? stay.booking.version}
            customerId={booking?.customer_id ?? stay.booking.customer_id}
            folio={paymentQuote?.folio ?? folio}
            maximumAmount={
              checkoutAfterPayment
                ? Math.max(0, hotelMoney(folio.balance))
                : paymentQuote == null
                  ? undefined
                  : hotelMoney(paymentQuote.maximum_payment)
            }
            unpostedRoomCharges={
              checkoutAfterPayment || paymentQuote == null
                ? 0
                : hotelMoney(paymentQuote.unposted_room_charges)
            }
            checkoutAfterPayment={checkoutAfterPayment}
            onRecorded={async (updatedFolio) => {
              toast.success("Hotel payment recorded");
              if (checkoutAfterPayment && hotelMoney(updatedFolio.balance) === 0) {
                try {
                  await hotelPmsApi.checkout(stay.id, stay.version);
                  toast.success("Guest checked out");
                } catch (error) {
                  toast.error(getApiErrorMessage(error, "Payment was recorded, but checkout still has blockers"));
                }
              }
              await load();
              onChanged();
            }}
          />
        ) : null}
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
