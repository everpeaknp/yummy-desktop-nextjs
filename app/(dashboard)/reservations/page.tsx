"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api-client";
import { ReservationApis } from "@/lib/api/endpoints";
import { 
  Loader2, 
  Plus, 
  Search, 
  Calendar, 
  Users, 
  Clock, 
  Filter, 
  MoreVertical,
  ChevronRight,
  Phone,
  User,
  Ticket,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ReservationForm } from "@/components/reservations/reservation-form";
import { ReservationDetailsSheet } from "@/components/reservations/reservation-details-sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";

export default function ReservationsPage() {
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const user = useAuth((state) => state.user);
  const me = useAuth((state) => state.me);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      if (!user && token) {
        await me();
      }
      setAuthChecked(true);
      if (!user && !token && authChecked) router.push("/");
    };
    checkAuth();
  }, [user, me, router, authChecked]);

  const fetchReservations = useCallback(async () => {
    if (!authChecked) return;
    
    if (!user?.restaurant_id) {
       setLoading(false);
       return;
    }

    setLoading(true);
    try {
      const response = await apiClient.get(ReservationApis.listReservations(user.restaurant_id));
      if (response.data.status === "success") {
        const data = response.data.data;
        // Flutter uses /orders API which returns { orders: [...] }
        // The previous /reservations API returned { reservations: [...] }
        // We check for both to be safe.
        const list = Array.isArray(data) ? data : (data.orders || data.reservations || []);
        setReservations(list);
      }
    } catch (err) {
      console.error("Failed to fetch reservations:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.restaurant_id, authChecked]);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  const filteredReservations = reservations.filter((res) => {
    const matchesSearch = 
      res.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      res.customer_phone?.includes(searchQuery);
    
    const matchesStatus = statusFilter === "all" || res.status?.toLowerCase() === statusFilter.toLowerCase();
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const s = status?.toLowerCase() || "pending";
    const colors: Record<string, string> = {
      pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800",
      confirmed: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800",
      seated: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
      completed: "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400 border-slate-200 dark:border-slate-800",
      canceled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800",
    };

    return (
      <Badge variant="outline" className={cn("px-2 py-0 rounded-full text-[10px] font-bold uppercase tracking-wider", colors[s] || colors.pending)}>
        {s}
      </Badge>
    );
  };

  const openDetails = (res: any) => {
    setSelectedReservation(res);
    setDetailsOpen(true);
  };

  const openEdit = (res: any) => {
    setSelectedReservation(res);
    setFormOpen(true);
  };

  return (
    <div className="flex flex-col gap-6 max-w-[1200px] mx-auto p-4 md:p-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <Calendar className="h-8 w-8 text-orange-600" />
            Reservations
          </h1>
          <p className="text-muted-foreground mt-1">Manage guest bookings and table assignments</p>
        </div>
        <Button 
          onClick={() => { setSelectedReservation(null); setFormOpen(true); }}
          className="bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-2xl h-12 px-6 shadow-lg shadow-orange-600/20"
        >
          <Plus className="mr-2 h-5 w-5" /> New Reservation
        </Button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-4 bg-card p-4 rounded-3xl border shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search guest name or phone..." 
            className="pl-9 bg-background/50 border-none shadow-inner"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
          {["All", "Pending", "Confirmed", "Seated", "Completed", "Canceled"].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status.toLowerCase())}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap",
                statusFilter === status.toLowerCase()
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                  : "bg-background hover:bg-muted text-muted-foreground border border-border"
              )}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* List Content */}
      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-orange-600" />
          <p className="font-bold text-muted-foreground">Loading reservations...</p>
        </div>
      ) : filteredReservations.length === 0 ? (
        <div className="h-96 flex flex-col items-center justify-center text-center gap-4 bg-slate-50 dark:bg-slate-900/20 rounded-[40px] border-2 border-dashed border-slate-200 dark:border-slate-800">
          <div className="h-24 w-24 rounded-[32px] bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <Calendar className="h-12 w-12 text-slate-300 dark:text-slate-600" />
          </div>
          <div>
            <h3 className="text-xl font-bold">No reservations found</h3>
            <p className="text-muted-foreground max-w-xs mx-auto">Try adjusting your filters or search query, or create a new booking.</p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => { setSelectedReservation(null); setFormOpen(true); }}
            className="rounded-2xl font-bold border-2"
          >
            Create First Reservation
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredReservations.map((res) => (
            <div 
              key={res.id}
              onClick={() => openDetails(res)}
              className="group relative bg-card hover:bg-slate-50 dark:hover:bg-slate-900/40 border border-border rounded-[32px] p-5 transition-all hover:shadow-xl hover:shadow-orange-600/5 cursor-pointer"
            >
              {/* Card Header */}
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-orange-600/10 flex items-center justify-center text-orange-600">
                    <User className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-black text-lg truncate max-w-[150px]">{res.customer_name || "Guest"}</h3>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                      <Phone className="h-3 w-3" />
                      {res.customer_phone || "No phone"}
                    </div>
                  </div>
                </div>
                {getStatusBadge(res.status)}
              </div>

              {/* Card Body */}
              <div className="space-y-3 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-border/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-primary opacity-70" />
                    <span className="font-bold">{format(new Date(res.scheduled_at), "MMM d, yyyy")}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-primary opacity-70" />
                    <span className="font-bold">{format(new Date(res.scheduled_at), "h:mm a")}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-primary opacity-70" />
                    <span className="font-bold">{res.party_size || res.number_of_guests || 1} Guests</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Ticket className="h-4 w-4 text-primary opacity-70" />
                    <span className="font-bold">{res.table_name || `Table ${res.table_id}` || "Unassigned"}</span>
                  </div>
                </div>
              </div>

              {/* Action Overlay */}
              <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                 <Button size="icon" variant="secondary" className="rounded-full shadow-lg h-10 w-10">
                    <ChevronRight className="h-5 w-5" />
                 </Button>
              </div>

              {res.notes && (
                <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground bg-amber-500/5 p-2 rounded-xl border border-amber-500/10">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  <span className="italic truncate">{res.notes}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reservation Form Modal */}
      <ReservationForm 
        open={formOpen} 
        onOpenChange={setFormOpen} 
        reservation={selectedReservation}
        onSuccess={fetchReservations}
      />

      <ReservationDetailsSheet 
        open={detailsOpen} 
        onOpenChange={setDetailsOpen} 
        reservation={selectedReservation}
        onRefresh={fetchReservations}
        onEdit={() => {
          setDetailsOpen(false);
          setFormOpen(true);
        }}
      />
    </div>
  );
}
