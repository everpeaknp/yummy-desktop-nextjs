"use client";

import { useState } from "react";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription,
  SheetFooter
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Calendar, 
  Clock, 
  Users, 
  Phone, 
  MapPin, 
  Utensils, 
  Loader2, 
  CheckCircle, 
  XCircle,
  Clock3,
  MessageSquare
} from "lucide-react";
import apiClient from "@/lib/api-client";
import { OrderApis, ReservationApis } from "@/lib/api/endpoints";
import { cn } from "@/lib/utils";

interface ReservationDetailsSheetProps {
  reservation: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh?: () => void;
  onEdit?: () => void;
}

export function ReservationDetailsSheet({ 
  reservation, 
  open, 
  onOpenChange,
  onRefresh,
  onEdit
}: ReservationDetailsSheetProps) {
  const [isActivating, setIsActivating] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);

  if (!reservation) return null;

  const handleActivate = async () => {
    setIsActivating(true);
    try {
      // Use seatReservation (activates order)
      // Must pass table_ids from the reservation to confirm seating
      const tableIds = reservation.table_ids && reservation.table_ids.length > 0 
        ? reservation.table_ids 
        : (reservation.table_id ? [reservation.table_id] : []);
        
      const response = await apiClient.post(ReservationApis.seatReservation(reservation.id), {
        table_ids: tableIds
      });
      if (response.data.status === "success") {
        alert("Reservation seated!");
        onOpenChange(false);
        onRefresh?.();
      }
    } catch (err: any) {
      console.error("Failed to seat reservation:", err);
      alert(err.response?.data?.detail || "Failed to seat reservation");
    } finally {
      setIsActivating(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel this reservation?")) return;
    setIsCanceling(true);
    try {
      // Send reason in body
      const response = await apiClient.post(ReservationApis.cancelReservation(reservation.id), {
        reason: "Staff canceled via dashboard"
      });
      if (response.data.status === "success") {
        alert("Reservation canceled.");
        onOpenChange(false);
        onRefresh?.();
      }
    } catch (err: any) {
      console.error("Failed to cancel reservation:", err);
      alert(err.response?.data?.detail || "Failed to cancel reservation");
    } finally {
      setIsCanceling(false);
    }
  };

  const scheduledAt = new Date(reservation.scheduled_at);
  const statusColors: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    confirmed: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    seated: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    completed: "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400 border-slate-200 dark:border-slate-800",
    canceled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800",
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md flex flex-col gap-0 p-0">
        <SheetHeader className="p-6 bg-slate-50 dark:bg-slate-900/50 border-b">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <SheetTitle className="text-xl font-bold">Reservation Details</SheetTitle>
              <SheetDescription>
                Res ID: #{reservation.id}
              </SheetDescription>
            </div>
            <Badge className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider", statusColors[reservation.status?.toLowerCase()] || statusColors.pending)}>
              {reservation.status || "Pending"}
            </Badge>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Customer Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                {reservation.customer_name?.[0] || "?"}
              </div>
              <div>
                <h3 className="font-bold text-lg leading-none">{reservation.customer_name || "Guest"}</h3>
                <div className="flex items-center gap-1.5 mt-1.5 text-sm text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  {reservation.customer_phone || "No phone provided"}
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Schedule & Tables */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                <Calendar className="h-3 w-3" /> Date
              </div>
              <p className="font-bold text-sm">{scheduledAt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                <Clock className="h-3 w-3" /> Time
              </div>
              <p className="font-bold text-sm">{scheduledAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                <Users className="h-3 w-3" /> Guests
              </div>
              <p className="font-bold text-sm">{reservation.party_size || reservation.number_of_guests || 1} People</p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                <Utensils className="h-3 w-3" /> Tables
              </div>
              <p className="font-bold text-sm">{reservation.table_name || `Table ${reservation.table_id}` || "Unassigned"}</p>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
             <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                <Clock3 className="h-3 w-3" /> Duration
              </div>
              <p className="text-sm font-medium">{reservation.duration_minutes || 60} Minutes</p>
            </div>

            {reservation.notes && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  <MessageSquare className="h-3 w-3" /> Notes
                </div>
                <div className="bg-muted/50 p-3 rounded-xl text-sm italic text-muted-foreground">
                  "{reservation.notes}"
                </div>
              </div>
            )}
          </div>
        </div>

        <SheetFooter className="p-6 border-t bg-slate-50 dark:bg-slate-900/50 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 w-full">
             {/* Edit Button - only show if status is pending/confirmed/scheduled */}
             {['pending', 'confirmed', 'scheduled'].includes(reservation.status?.toLowerCase()) && (
              <Button 
                variant="outline" 
                className="col-span-2 rounded-xl font-bold h-11 border-orange-500/20 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                onClick={onEdit}
              >
                Edit Reservation
              </Button>
            )}

            <Button 
              variant="outline" 
              className="rounded-xl font-bold h-11 border-red-500/20 text-red-500 hover:text-red-600 hover:bg-red-50"
              onClick={handleCancel}
              disabled={isActivating || isCanceling || reservation.status === 'canceled'}
            >
              <XCircle className="h-4 w-4 mr-2" /> Cancel
            </Button>
            
            <Button 
              className="rounded-xl font-bold h-11 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20"
              onClick={handleActivate}
              disabled={isActivating || isCanceling || ['seated', 'canceled', 'completed'].includes(reservation.status?.toLowerCase())}
            >
              {isActivating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Arrived / Seat
            </Button>
          </div>
          
          <Button 
            variant="ghost" 
            className="w-full rounded-xl text-muted-foreground font-medium"
            onClick={() => onOpenChange(false)}
          >
            Close Details
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
