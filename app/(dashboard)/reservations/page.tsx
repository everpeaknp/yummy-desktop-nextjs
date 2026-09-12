"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api-client";
import { ReservationApis } from "@/lib/api/endpoints";
import { 
  Loader2, 
  Plus, 
  Calendar, 
  Users, 
  Clock, 
  ChevronRight,
  Phone,
  User,
  Ticket,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ReservationForm } from "@/components/reservations/reservation-form";
import { ReservationDetailsSheet } from "@/components/reservations/reservation-details-sheet";
import { format } from "date-fns";
import { AppPage } from "@/components/patterns/page/app-page";
import { PageHeader } from "@/components/patterns/page/page-header";
import { SearchField } from "@/components/patterns/controls/search-field";
import { FilterChip } from "@/components/patterns/controls/filter-chip";
import { DataList, ListRow } from "@/components/patterns/data/data-list";
import { EmptyState, LoadingState } from "@/components/patterns/feedback/feedback-state";

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
    console.log("=== fetchReservations CALLED ===");
    console.log("authChecked:", authChecked);
    console.log("user?.restaurant_id:", user?.restaurant_id);
    
    if (!authChecked) return;
    
    if (!user?.restaurant_id) {
       setLoading(false);
       return;
    }

    setLoading(true);
    try {
      const url = ReservationApis.listReservations(user.restaurant_id);
      console.log("=== FETCHING RESERVATIONS ===");
      console.log("URL:", url);
      const response = await apiClient.get(url);
      console.log("Response status:", response.data.status);
      console.log("Response data structure:", Object.keys(response.data.data || {}));
      if (response.data.status === "success") {
        const data = response.data.data;
        // Flutter uses /orders API which returns { orders: [...] }
        // The previous /reservations API returned { reservations: [...] }
        // We check for both to be safe.
        const list = Array.isArray(data) ? data : (data.orders || data.reservations || []);
        console.log("Parsed list length:", list.length);
        console.log("First reservation:", list[0]);
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

  const statuses = ["All", "Pending", "Confirmed", "Seated", "Completed", "Canceled"];

  return (
    <AppPage width="wide" className="gap-4 md:gap-6">
      <div className="hidden md:block">
        <PageHeader
          title="Reservations"
          description="Manage guest bookings and table assignments."
          actions={
            <Button onClick={() => { setSelectedReservation(null); setFormOpen(true); }} className="h-11 rounded-xl">
              <Plus className="mr-1.5 h-4 w-4" /> New reservation
            </Button>
          }
        />
      </div>

      <div className="flex items-center gap-2 md:hidden">
        <SearchField
          containerClassName="flex-1"
          placeholder="Search guests or phone"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          onClear={() => setSearchQuery("")}
        />
        <Button
          size="icon"
          onClick={() => { setSelectedReservation(null); setFormOpen(true); }}
          className="h-11 w-11 shrink-0 rounded-xl"
          aria-label="New reservation"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <SearchField
          containerClassName="hidden w-full md:block md:max-w-md"
          placeholder="Search guest name or phone"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          onClear={() => setSearchQuery("")}
        />
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:pb-0">
          {statuses.map((status) => (
            <FilterChip
              key={status}
              active={statusFilter === status.toLowerCase()}
              onClick={() => setStatusFilter(status.toLowerCase())}
              className="min-h-10 px-3.5 text-xs"
            >
              {status}
            </FilterChip>
          ))}
        </div>
      </div>

      {loading ? (
        <LoadingState label="Loading reservations..." />
      ) : filteredReservations.length === 0 ? (
        <EmptyState
          icon={<Calendar className="h-5 w-5" />}
          title="No reservations found"
          description="Try another status or create a reservation."
          actionLabel="New reservation"
          onAction={() => { setSelectedReservation(null); setFormOpen(true); }}
        />
      ) : (
        <>
          <p className="text-xs text-muted-foreground md:hidden">
            {filteredReservations.length} reservation{filteredReservations.length === 1 ? "" : "s"}
          </p>

          <DataList className="md:hidden">
            {filteredReservations.map((res) => {
              const scheduledAt = new Date(res.scheduled_at);
              const tableLabel = res.table_name || (res.table_id ? `Table ${res.table_id}` : "Table unassigned");
              return (
                <ListRow
                  key={res.id}
                  interactive
                  onClick={() => openDetails(res)}
                  leading={<Calendar className="h-4 w-4 text-orange-600" />}
                  title={res.customer_name || "Guest"}
                  description={`${format(scheduledAt, "EEE, MMM d · h:mm a")} · ${res.party_size || res.number_of_guests || 1} guests · ${tableLabel}`}
                  meta={getStatusBadge(res.status)}
                />
              );
            })}
          </DataList>

          <div className="hidden grid-cols-1 gap-4 md:grid md:grid-cols-2 xl:grid-cols-3">
            {filteredReservations.map((res) => (
              <div
                key={res.id}
                onClick={() => openDetails(res)}
                className="group relative cursor-pointer rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-muted/40"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600">
                      <User className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold">{res.customer_name || "Guest"}</h3>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" /> {res.customer_phone || "No phone"}
                      </div>
                    </div>
                  </div>
                  {getStatusBadge(res.status)}
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-3 text-sm">
                  <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" />{format(new Date(res.scheduled_at), "MMM d, yyyy")}</div>
                  <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" />{format(new Date(res.scheduled_at), "h:mm a")}</div>
                  <div className="flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" />{res.party_size || res.number_of_guests || 1} guests</div>
                  <div className="flex min-w-0 items-center gap-2"><Ticket className="h-4 w-4 shrink-0 text-muted-foreground" /><span className="truncate">{res.table_name || (res.table_id ? `Table ${res.table_id}` : "Unassigned")}</span></div>
                </div>
                {res.notes ? <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" /><span className="line-clamp-2">{res.notes}</span></div> : null}
                <ChevronRight className="absolute bottom-4 right-4 h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
            ))}
          </div>
        </>
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
    </AppPage>
  );
}
