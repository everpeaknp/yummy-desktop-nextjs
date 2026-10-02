"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api-client";
import { ReservationApis } from "@/lib/api/endpoints";
import { Plus, Calendar, Users, Clock, Phone, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ReservationForm } from "@/components/reservations/reservation-form";
import { ReservationDetailsSheet } from "@/components/reservations/reservation-details-sheet";
import { format } from "date-fns";
import { AppPage } from "@/components/patterns/page/app-page";
import { PageHeader } from "@/components/patterns/page/page-header";
import { SearchField } from "@/components/patterns/controls/search-field";
import { FilterBar } from "@/components/patterns/controls/filter-bar";
import { MobileRegisterToolbar } from "@/components/patterns/controls/mobile-register-toolbar";
import { MobileCreateFab } from "@/components/patterns/actions/mobile-create-fab";
import { FilterChip } from "@/components/patterns/controls/filter-chip";
import { DataList, ListRow } from "@/components/patterns/data/data-list";
import {
  EmptyState,
  LoadingState,
} from "@/components/patterns/feedback/feedback-state";

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
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("accessToken")
          : null;
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
      const url = ReservationApis.listReservations(user.restaurant_id);
      const response = await apiClient.get(url);
      if (response.data.status === "success") {
        const data = response.data.data;
        // Flutter uses /orders API which returns { orders: [...] }
        // The previous /reservations API returned { reservations: [...] }
        // We check for both to be safe.
        const list = Array.isArray(data)
          ? data
          : data.orders || data.reservations || [];
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

  const filteredReservations = useMemo(
    () =>
      reservations.filter((res) => {
        const matchesSearch =
          res.customer_name
            ?.toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          res.customer_phone?.includes(searchQuery);

        const matchesStatus =
          statusFilter === "all" ||
          res.status?.toLowerCase() === statusFilter.toLowerCase();

        return matchesSearch && matchesStatus;
      }),
    [reservations, searchQuery, statusFilter],
  );

  const getStatusBadge = (status: string) => {
    const s = status?.toLowerCase() || "pending";
    const colors: Record<string, string> = {
      pending:
        "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800",
      confirmed:
        "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800",
      seated:
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
      completed:
        "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400 border-slate-200 dark:border-slate-800",
      canceled:
        "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800",
    };

    return (
      <Badge
        variant="outline"
        className={cn(
          "rounded-full px-2 py-0 text-xs font-medium",
          colors[s] || colors.pending,
        )}
      >
        {s.charAt(0).toUpperCase() + s.slice(1)}
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

  const statuses = [
    "All",
    "Pending",
    "Confirmed",
    "Seated",
    "Completed",
    "Canceled",
  ];

  return (
    <AppPage width="wide" className="gap-4 lg:gap-6">
      <div className="hidden lg:block">
        <PageHeader
          title="Reservations"
          description="Manage guest bookings and table assignments."
          actions={
            <Button
              onClick={() => {
                setSelectedReservation(null);
                setFormOpen(true);
              }}
              className="h-11 rounded-xl"
            >
              <Plus className="mr-1.5 h-4 w-4" /> New reservation
            </Button>
          }
        />
      </div>

      <MobileRegisterToolbar
        search={
          <SearchField
            placeholder="Search guests or phone"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onClear={() => setSearchQuery("")}
          />
        }
        filter={
          <FilterBar
            title="Filters"
            activeCount={statusFilter === "all" ? 0 : 1}
            responsiveAt="lg"
            mobileTriggerVariant="icon"
            mobileContent={
              <div className="space-y-3">
                <p className="text-sm font-medium">Status</p>
                <div className="flex flex-wrap gap-2">
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
            }
          />
        }
      />

      <div className="hidden flex-col gap-3 lg:flex lg:flex-row lg:items-center lg:justify-between">
        <SearchField
          containerClassName="w-full lg:max-w-md"
          placeholder="Search guest name or phone"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          onClear={() => setSearchQuery("")}
        />
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mx-0 lg:pb-0">
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
          onAction={() => {
            setSelectedReservation(null);
            setFormOpen(true);
          }}
        />
      ) : (
        <>
          <p className="text-xs text-muted-foreground lg:hidden">
            {filteredReservations.length} reservation
            {filteredReservations.length === 1 ? "" : "s"}
          </p>

          <DataList className="lg:hidden">
            {filteredReservations.map((res) => {
              const scheduledAt = new Date(res.scheduled_at);
              const tableLabel =
                res.table_name ||
                (res.table_id ? `Table ${res.table_id}` : "Table unassigned");
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

          <DataList className="hidden lg:block">
            {filteredReservations.map((res) => {
              const scheduledAt = new Date(res.scheduled_at);
              const tableLabel =
                res.table_name ||
                (res.table_id ? `Table ${res.table_id}` : "Table unassigned");
              return (
                <ListRow
                  key={res.id}
                  interactive
                  onClick={() => openDetails(res)}
                  leading={<Calendar className="h-4 w-4 text-primary" />}
                  title={res.customer_name || "Guest"}
                  description={`${format(scheduledAt, "EEE, MMM d · h:mm a")} · ${res.party_size || res.number_of_guests || 1} guests · ${tableLabel}`}
                  meta={getStatusBadge(res.status)}
                  trailing={
                    <div className="hidden min-w-40 text-right text-xs text-muted-foreground lg:block">
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5" />
                        {res.customer_phone || "No phone"}
                      </span>
                    </div>
                  }
                />
              );
            })}
          </DataList>
        </>
      )}

      <MobileCreateFab
        label="New reservation"
        onClick={() => {
          setSelectedReservation(null);
          setFormOpen(true);
        }}
      />

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
