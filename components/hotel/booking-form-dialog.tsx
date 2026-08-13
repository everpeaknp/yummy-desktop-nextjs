"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays } from "date-fns";
import { Check, ChevronDown, Loader2, Search, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import apiClient from "@/lib/api-client";
import { CustomerApis } from "@/lib/api/endpoints";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getApiErrorMessage } from "@/lib/api-error-message";
import {
  buildHotelBookingRooms,
  type HotelRoomBookingDraft,
  newHotelRoomDraft,
} from "@/lib/hotel/booking-draft";
import { hotelDate, hotelPmsApi } from "@/lib/hotel/api";
import { hotelMoney, type HotelAvailability } from "@/lib/hotel/types";
import { cn } from "@/lib/utils";
import { BookingRoomsEditor } from "./booking-rooms-editor";
import { hotelCurrency } from "./hotel-ui";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: number;
  onCreated: () => void;
}

type CustomerOption = {
  id: number;
  name?: string | null;
  full_name?: string | null;
  phone?: string | null;
  email?: string | null;
};

const customerName = (customer: CustomerOption) =>
  customer.name || customer.full_name || "Guest";

export function BookingFormDialog({ open, onOpenChange, restaurantId, onCreated }: Props) {
  const today = hotelDate(new Date());
  const [arrivalDate, setArrivalDate] = useState(today);
  const [departureDate, setDepartureDate] = useState(hotelDate(addDays(new Date(), 1)));
  const [availability, setAvailability] = useState<HotelAvailability | null>(null);
  const [rooms, setRooms] = useState<HotelRoomBookingDraft[]>([
    newHotelRoomDraft("room-1"),
  ]);
  const [guestMode, setGuestMode] = useState<"existing" | "new">("existing");
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [customerQuery, setCustomerQuery] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [guestName, setGuestName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [deposit, setDeposit] = useState("0");
  const [requests, setRequests] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedCustomer = useMemo(
    () => customers.find((customer) => String(customer.id) === selectedCustomerId) ?? null,
    [customers, selectedCustomerId],
  );
  const filteredCustomers = useMemo(() => {
    const needle = customerQuery.trim().toLowerCase();
    if (!needle) return customers;
    return customers.filter((customer) => [
      customerName(customer),
      customer.phone,
      customer.email,
      String(customer.id),
    ].filter(Boolean).join(" ").toLowerCase().includes(needle));
  }, [customerQuery, customers]);

  useEffect(() => {
    if (!open || !arrivalDate || !departureDate || departureDate <= arrivalDate) return;
    let active = true;
    setLoading(true);
    hotelPmsApi
      .getAvailability(restaurantId, arrivalDate, departureDate)
      .then((data) => {
        if (!active) return;
        setAvailability(data);
        const first = data.room_types.find((row) => row.available_inventory > 0);
        setRooms([
          newHotelRoomDraft(
            `room-${Date.now()}`,
            first ? String(first.room_type.id) : "",
          ),
        ]);
      })
      .catch((error) => {
        if (active) toast.error(getApiErrorMessage(error, "Failed to load room availability"));
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [open, restaurantId, arrivalDate, departureDate]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setCustomersLoading(true);
    apiClient
      .get(CustomerApis.listCustomers(restaurantId), {
        params: { skip: 0, limit: 500 },
      })
      .then((response) => {
        if (!active) return;
        const rows = (response.data?.data?.customers ?? []) as CustomerOption[];
        setCustomers(rows);
        if (rows.length === 0) setGuestMode("new");
      })
      .catch((error) => {
        if (active) {
          setCustomers([]);
          setGuestMode("new");
          toast.error(getApiErrorMessage(error, "Failed to load customers"));
        }
      })
      .finally(() => active && setCustomersLoading(false));
    return () => {
      active = false;
    };
  }, [open, restaurantId]);

  const selectCustomer = (customer: CustomerOption) => {
    setGuestMode("existing");
    setSelectedCustomerId(String(customer.id));
    setGuestName(customerName(customer));
    setPhone(customer.phone || "");
    setEmail(customer.email || "");
    setCustomerPickerOpen(false);
    setCustomerQuery("");
  };

  const changeGuestMode = (mode: "existing" | "new") => {
    setGuestMode(mode);
    if (mode === "new") {
      setSelectedCustomerId("");
      setGuestName("");
      setPhone("");
      setEmail("");
    }
  };

  const reset = () => {
    setGuestMode(customers.length === 0 ? "new" : "existing");
    setSelectedCustomerId("");
    setCustomerPickerOpen(false);
    setCustomerQuery("");
    setGuestName("");
    setPhone("");
    setEmail("");
    const first = availability?.room_types.find((row) => row.available_inventory > 0);
    setRooms([
      newHotelRoomDraft(
        `room-${Date.now()}`,
        first ? String(first.room_type.id) : "",
      ),
    ]);
    setDeposit("0");
    setRequests("");
  };

  const submit = async () => {
    if (
      !guestName.trim()
      || !availability
      || rooms.length === 0
      || departureDate <= arrivalDate
      || (guestMode === "existing" && !selectedCustomerId)
    ) return;
    setSaving(true);
    try {
      let customerId = selectedCustomerId ? Number(selectedCustomerId) : null;
      if (guestMode === "new") {
        const response = await apiClient.post(CustomerApis.createCustomer, {
          restaurant_id: restaurantId,
          name: guestName.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          is_active: true,
        });
        const created = response.data?.data as CustomerOption | undefined;
        if (!created?.id) throw new Error("Customer was created without an id.");
        customerId = created.id;
        setCustomers((current) => [...current, created]);
        setSelectedCustomerId(String(created.id));
        setGuestMode("existing");
      }
      const bookingRooms = buildHotelBookingRooms(rooms, availability, {
        name: guestName,
        phone,
        email,
      });
      await hotelPmsApi.createBooking({
        restaurant_id: restaurantId,
        customer_id: customerId,
        primary_guest_name: guestName.trim(),
        primary_guest_phone: phone.trim() || null,
        primary_guest_email: email.trim() || null,
        arrival_date: arrivalDate,
        departure_date: departureDate,
        status: "confirmed",
        source: "direct",
        deposit_paid: Number(deposit || 0),
        special_requests: requests.trim() || null,
        rooms: bookingRooms,
      });
      toast.success("Booking created");
      reset();
      onOpenChange(false);
      onCreated();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to create booking"));
    } finally {
      setSaving(false);
    }
  };

  const bookingTotal = rooms.reduce((total, room) => {
    const row = availability?.room_types.find(
      (candidate) => String(candidate.room_type.id) === room.roomTypeId,
    );
    return total + hotelMoney(row?.stay_total);
  }, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New hotel booking</DialogTitle>
          <DialogDescription>Availability and rates are checked by the PMS before saving.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="hotel-arrival">Arrival</Label>
            <Input id="hotel-arrival" type="date" min={today} value={arrivalDate} onChange={(event) => setArrivalDate(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hotel-departure">Departure</Label>
            <Input id="hotel-departure" type="date" min={hotelDate(addDays(new Date(`${arrivalDate}T00:00:00`), 1))} value={departureDate} onChange={(event) => setDepartureDate(event.target.value)} />
          </div>
          <BookingRoomsEditor
            availability={availability}
            rooms={rooms}
            onChange={setRooms}
            disabled={loading || saving}
          />
          <div className="space-y-3 md:col-span-2">
            <Label>Guest profile</Label>
            <div className="grid grid-cols-2 gap-2 rounded-xl border bg-muted/20 p-1">
              <button
                type="button"
                onClick={() => changeGuestMode("existing")}
                disabled={saving || customersLoading || customers.length === 0}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                  guestMode === "existing" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
                )}
              >
                <Users className="h-4 w-4" />Existing customer
              </button>
              <button
                type="button"
                onClick={() => changeGuestMode("new")}
                disabled={saving}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                  guestMode === "new" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
                )}
              >
                <UserPlus className="h-4 w-4" />New customer
              </button>
            </div>

            {guestMode === "existing" ? (
              <Popover open={customerPickerOpen} onOpenChange={(next) => {
                setCustomerPickerOpen(next);
                if (!next) setCustomerQuery("");
              }}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="h-11 w-full justify-between font-normal" disabled={customersLoading}>
                    <span className="truncate">
                      {customersLoading
                        ? "Loading customers..."
                        : selectedCustomer
                          ? `${customerName(selectedCustomer)}${selectedCustomer.phone ? ` · ${selectedCustomer.phone}` : ""}`
                          : "Search by name, phone, or email"}
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[min(92vw,620px)] p-0" align="start">
                  <div className="border-b p-3">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input value={customerQuery} onChange={(event) => setCustomerQuery(event.target.value)} placeholder="Search customers..." autoFocus className="pl-9" />
                    </div>
                  </div>
                  <ScrollArea className="max-h-72">
                    <div className="p-1">
                      {filteredCustomers.length === 0 ? (
                        <p className="px-3 py-6 text-sm text-muted-foreground">No customers found.</p>
                      ) : filteredCustomers.map((customer) => (
                        <button
                          key={customer.id}
                          type="button"
                          onClick={() => selectCustomer(customer)}
                          className={cn(
                            "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm hover:bg-muted/70",
                            String(customer.id) === selectedCustomerId && "bg-primary/5 text-primary",
                          )}
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{customerName(customer)}</span>
                            <span className="block truncate text-xs text-muted-foreground">{[customer.phone, customer.email].filter(Boolean).join(" · ") || "No contact details"}</span>
                          </span>
                          {String(customer.id) === selectedCustomerId ? <Check className="h-4 w-4 shrink-0" /> : null}
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            ) : (
              <p className="text-xs text-muted-foreground">This profile will be saved to Customers and linked to the booking.</p>
            )}
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="hotel-guest">Primary guest</Label>
            <Input id="hotel-guest" value={guestName} onChange={(event) => setGuestName(event.target.value)} placeholder="Full name" readOnly={guestMode === "existing"} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hotel-phone">Phone</Label>
            <Input id="hotel-phone" value={phone} onChange={(event) => setPhone(event.target.value)} readOnly={guestMode === "existing"} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hotel-email">Email</Label>
            <Input id="hotel-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} readOnly={guestMode === "existing"} />
          </div>
          <div className="flex items-center justify-between rounded-xl border bg-muted/20 px-4 py-3 md:col-span-2">
            <div>
              <p className="text-sm font-semibold">
                {rooms.length} {rooms.length === 1 ? "room" : "rooms"}
              </p>
              <p className="text-xs text-muted-foreground">One booking and one combined guest bill</p>
            </div>
            <p className="font-semibold">{hotelCurrency(bookingTotal)}</p>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="hotel-deposit">Deposit paid</Label>
            <Input id="hotel-deposit" type="number" min={0} step="0.01" value={deposit} onChange={(event) => setDeposit(event.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="hotel-requests">Special requests</Label>
            <Textarea id="hotel-requests" value={requests} onChange={(event) => setRequests(event.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={saving || loading || !guestName.trim() || !availability || rooms.length === 0 || (guestMode === "existing" && !selectedCustomerId)}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create booking
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
