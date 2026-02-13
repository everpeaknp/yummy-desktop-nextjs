"use client";

import { useState, useEffect } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Loader2, 
  Search, 
  User, 
  Phone, 
  Calendar as CalendarIcon, 
  Clock, 
  Users, 
  Table as TableIcon,
  Check
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, parseISO, formatISO } from "date-fns";
import { cn } from "@/lib/utils";
import apiClient from "@/lib/api-client";
import { CustomerApis, TableApis, ReservationApis } from "@/lib/api/endpoints";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useDebounce } from "@/hooks/use-debounce";

interface ReservationFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservation?: any;
  onSuccess?: () => void;
  initialTableId?: number;
}

export function ReservationForm({ 
  open, 
  onOpenChange, 
  reservation, 
  onSuccess,
  initialTableId 
}: ReservationFormProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Form State
  const [formData, setFormData] = useState({
    customerName: "",
    customerPhone: "",
    customerId: null as number | null,
    guests: "2",
    duration: "60",
    date: new Date(),
    time: "18:00",
    tableIds: [] as number[],
    notes: ""
  });

  useEffect(() => {
    if (reservation) {
      setFormData({
        customerName: reservation.customer_name || "",
        customerPhone: reservation.customer_phone || "",
        customerId: reservation.customer_id || null,
        guests: (reservation.party_size || reservation.number_of_guests || "2").toString(),
        duration: (reservation.duration_minutes || "60").toString(),
        date: new Date(reservation.scheduled_at || reservation.reservation_date || new Date()),
        time: reservation.scheduled_at 
          ? format(new Date(reservation.scheduled_at), "HH:mm") 
          : (reservation.reservation_time || "18:00"),
        tableIds: reservation.table_id ? [reservation.table_id] : (reservation.table_ids || []),
        notes: reservation.notes || ""
      });
    } else {
      setFormData(prev => ({
        ...prev,
        tableIds: initialTableId ? [initialTableId] : []
      }));
    }
  }, [reservation, open, initialTableId]);

  useEffect(() => {
    if (open) {
      if (user?.restaurant_id) {
        fetchTables();
      } else {
        setLoadingTables(false);
      }
    }
  }, [open, user?.restaurant_id]);

  const fetchTables = async () => {
    if (!user?.restaurant_id) return;
    setLoadingTables(true);
    try {
      const response = await apiClient.get(TableApis.getTables(user.restaurant_id));
      if (response.data.status === "success") {
        setTables(response.data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch tables:", err);
    } finally {
      setLoadingTables(false);
    }
  };

  useEffect(() => {
    if (debouncedSearchTerm) {
      handleCustomerSearch(debouncedSearchTerm);
    } else {
      setCustomers([]);
    }
  }, [debouncedSearchTerm]);

  const handleCustomerSearch = async (query: string) => {
    if (query.length < 3 || !user?.restaurant_id) {
      setCustomers([]);
      return;
    }
    setSearchingCustomer(true);
    try {
      const response = await apiClient.get(CustomerApis.listCustomers(user.restaurant_id));
      if (response?.data?.status === "success") {
        const customersList = response.data.data?.customers || response.data.data || [];
        const filtered = Array.isArray(customersList) ? customersList.filter((c: any) => 
          (c.name && c.name.toLowerCase().includes(query.toLowerCase())) || 
          (c.phone && c.phone.includes(query))
        ) : [];
        setCustomers(filtered);
      }
    } catch (err) {
      console.error("Failed to search customers:", err);
    } finally {
      setSearchingCustomer(false);
    }
  };

  const selectCustomer = (customer: any) => {
    setFormData(prev => ({
      ...prev,
      customerName: customer.name,
      customerPhone: customer.phone || "",
      customerId: customer.id
    }));
    setCustomers([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerName) {
      alert("Please enter customer name");
      return;
    }
    if (formData.tableIds.length === 0) {
      alert("Please select at least one table");
      return;
    }

    setLoading(true);
    try {
      // Construct scheduledAt
      const [hours, minutes] = formData.time.split(":").map(Number);
      const scheduledAt = new Date(formData.date);
      scheduledAt.setHours(hours, minutes);

      const commonData = {
        customer_name: formData.customerName,
        customer_phone: formData.customerPhone || null,
        scheduled_at: scheduledAt.toISOString(),
        number_of_guests: parseInt(formData.guests),
        duration_minutes: parseInt(formData.duration),
        table_ids: formData.tableIds,
        notes: formData.notes,
        // Fallback for legacy fields if backend needs them temporarily
        special_requests: formData.notes 
      };

      let response;
      if (reservation) {
        // Update existing reservation (Order)
        response = await apiClient.patch(ReservationApis.updateReservation(reservation.id), {
          ...commonData,
          customer_id: formData.customerId,
        });
      } else {
        // Create new reservation (Order)
        response = await apiClient.post(ReservationApis.createReservation, {
          ...commonData,
          restaurant_id: user?.restaurant_id,
          customer_id: formData.customerId,
          channel: 'reservation',
          items: [], // Required for OrderCreate
        });
      }

      if (response.data.status === "success") {
        alert(reservation ? "Reservation updated" : "Reservation created");
        onSuccess?.();
        onOpenChange(false);
      }
    } catch (err: any) {
      console.error("Failed to save reservation:", err);
      alert(err.response?.data?.detail || "Failed to save reservation");
    } finally {
      setLoading(false);
    }
  };

  const toggleTable = (id: number) => {
    setFormData(prev => ({
      ...prev,
      tableIds: prev.tableIds.includes(id) 
        ? prev.tableIds.filter(tid => tid !== id)
        : [...prev.tableIds, id]
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="p-6 border-b bg-slate-50 dark:bg-slate-900/50">
          <DialogTitle>{reservation ? "Edit Reservation" : "New Reservation"}</DialogTitle>
          <DialogDescription>
            Fill in the details to {reservation ? "update" : "create"} a table booking.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Customer Section */}
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Customer Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 relative">
                <Label htmlFor="customerName">Name *</Label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="customerName"
                    placeholder="Search or enter name"
                    className="pl-9"
                    value={formData.customerName}
                    onChange={(e) => {
                      setFormData({...formData, customerName: e.target.value});
                      setSearchTerm(e.target.value);
                    }}
                  />
                </div>
                {customers.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {customers.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full text-left px-4 py-2 hover:bg-muted text-sm flex flex-col"
                        onClick={() => selectCustomer(c)}
                      >
                        <span className="font-bold">{c.name}</span>
                        <span className="text-xs text-muted-foreground">{c.phone || "No phone"}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerPhone">Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="customerPhone"
                    placeholder="+977..."
                    className="pl-9"
                    value={formData.customerPhone}
                    onChange={(e) => setFormData({...formData, customerPhone: e.target.value})}
                  />
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Schedule Section */}
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Schedule & Party</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Date *</Label>
                <div className="relative">
                  <CalendarIcon className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground z-10" />
                  <Input 
                    type="date"
                    className="pl-9"
                    value={formData.date ? format(formData.date, "yyyy-MM-dd") : ""}
                    onChange={(e) => {
                      const date = e.target.value ? new Date(e.target.value) : new Date();
                      setFormData({...formData, date});
                    }}
                    min={format(new Date(), "yyyy-MM-dd")}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Time *</Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    type="time"
                    className="pl-9"
                    value={formData.time}
                    onChange={(e) => setFormData({...formData, time: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Number of Guests *</Label>
                <div className="relative">
                  <Users className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    type="number"
                    min="1"
                    className="pl-9"
                    value={formData.guests}
                    onChange={(e) => setFormData({...formData, guests: e.target.value})}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
               <div className="space-y-2">
                <Label>Duration (Minutes)</Label>
                <Select 
                  value={formData.duration} 
                  onValueChange={(v) => setFormData({...formData, duration: v})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 Minutes</SelectItem>
                    <SelectItem value="60">1 Hour</SelectItem>
                    <SelectItem value="90">1.5 Hours</SelectItem>
                    <SelectItem value="120">2 Hours</SelectItem>
                    <SelectItem value="180">3 Hours</SelectItem>
                    <SelectItem value="240">4 Hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          {/* Table Selection Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Table Selection *</h3>
              <Badge variant="secondary" className="text-[10px] font-bold">
                {formData.tableIds.length} Selected
              </Badge>
            </div>
            
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {loadingTables ? (
                <div className="col-span-full py-4 flex justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : tables.length === 0 ? (
                <div className="col-span-full py-4 text-center text-xs text-muted-foreground">
                  No tables found
                </div>
              ) : (
                tables.map(table => (
                  <button
                    key={table.id}
                    type="button"
                    onClick={() => toggleTable(table.id)}
                    className={cn(
                      "flex flex-col items-center justify-center p-2 rounded-xl border transition-all text-center gap-1",
                      formData.tableIds.includes(table.id)
                        ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                        : "bg-background hover:bg-muted border-border"
                    )}
                  >
                    <TableIcon className={cn("h-4 w-4", formData.tableIds.includes(table.id) ? "text-primary-foreground/80" : "text-muted-foreground")} />
                    <span className="text-[11px] font-bold truncate w-full">{table.table_name}</span>
                    <span className="text-[9px] opacity-70">Cap: {table.capacity}</span>
                    {formData.tableIds.includes(table.id) && (
                      <div className="absolute top-1 right-1">
                        <Check className="h-2 w-2" />
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="notes">Special Requests / Notes</Label>
            <textarea 
              id="notes"
              placeholder="Allergies, birthday, window seating, etc."
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <DialogFooter className="pt-4">
            <Button 
              type="button" 
              variant="ghost" 
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="rounded-xl font-bold"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading || !formData.customerName || formData.tableIds.length === 0}
              className="rounded-xl font-bold bg-orange-600 hover:bg-orange-700 text-white min-w-[120px]"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {reservation ? "Update" : "Confirm Booking"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
