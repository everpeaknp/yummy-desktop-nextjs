"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { DateRangeDropdown, DateRangePreset } from "@/components/ui/date-range-dropdown";
import { DashboardHomeSkeleton, DashboardHomeView } from "@/components/dashboard/dashboard-home-view";
import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";
import { useDashboardHomeStore } from "@/stores/dashboard-home-store";
import { hasVisibleDashboardSections } from "@/types/dashboard-v2";
import { DateRange } from "react-day-picker";

const DELTA_POLL_MS = 30_000;

export default function DashboardPage() {
  const user = useAuth((state) => state.user);
  const me = useAuth((state) => state.me);
  const router = useRouter();
  const restaurant = useRestaurant((state) => state.restaurant);
  const selectedModule = useRestaurant((state) => state.selectedModule);

  const meta = useDashboardHomeStore((state) => state.meta);
  const dashboardHome = useDashboardHomeStore((state) => state.dashboardHome);
  const loading = useDashboardHomeStore((state) => state.loading);
  const error = useDashboardHomeStore((state) => state.error);
  const pollDelta = useDashboardHomeStore((state) => state.pollDelta);
  const fetchDashboard = useDashboardHomeStore((state) => state.fetchDashboard);

  const [activeRange, setActiveRange] = useState<DateRangePreset>("today");
  const [date, setDate] = useState<DateRange | undefined>();

  useEffect(() => {
    const checkAuth = async () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      if (!user && token) await me();
      if (!user && !token) router.push("/");
    };
    const timer = setTimeout(checkAuth, 300);
    return () => clearTimeout(timer);
  }, [user, me, router]);

  useEffect(() => {
    if (!user?.restaurant_id) return;
    if (activeRange === "custom" && (!date?.from || !date?.to)) return;

    const timezone =
      restaurant?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const businessLine = selectedModule ?? undefined;

    fetchDashboard({
      restaurantId: user.restaurant_id,
      timezone,
      businessLine,
      activeRange,
      date,
    });
  }, [user?.restaurant_id, restaurant?.timezone, selectedModule, activeRange, date, fetchDashboard]);

  useEffect(() => {
    if (!user?.restaurant_id || !dashboardHome) return;
    const interval = setInterval(() => {
      pollDelta();
    }, DELTA_POLL_MS);
    return () => clearInterval(interval);
  }, [user?.restaurant_id, dashboardHome, pollDelta]);

  if (loading && !dashboardHome) {
    return (
      <div className="flex flex-col gap-8 max-w-[1600px] mx-auto pb-20 px-4">
        <DashboardPageHeader
          outletName={restaurant?.name}
          activeRange={activeRange}
          setActiveRange={setActiveRange}
          date={date}
          setDate={setDate}
        />
        <DashboardHomeSkeleton />
      </div>
    );
  }

  if (error && dashboardHome && !hasVisibleDashboardSections(dashboardHome)) {
    return (
      <div className="flex flex-col gap-8 max-w-[1600px] mx-auto pb-20 px-4">
        <DashboardPageHeader
          outletName={restaurant?.name}
          activeRange={activeRange}
          setActiveRange={setActiveRange}
          date={date}
          setDate={setDate}
        />
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-10 text-center text-sm text-destructive">
          {error}
        </div>
      </div>
    );
  }

  if (!meta || !dashboardHome) {
    return (
      <div className="flex flex-col gap-8 max-w-[1600px] mx-auto pb-20 px-4">
        <DashboardPageHeader
          outletName={restaurant?.name}
          activeRange={activeRange}
          setActiveRange={setActiveRange}
          date={date}
          setDate={setDate}
        />
        <DashboardHomeSkeleton />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 max-w-[1600px] mx-auto pb-20 px-4">
      <DashboardPageHeader
        outletName={meta.outlet_name || restaurant?.name}
        activeRange={activeRange}
        setActiveRange={setActiveRange}
        date={date}
        setDate={setDate}
        accessNote={meta.access_note}
      />
      {meta.access_level === "limited" && meta.access_note ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          {meta.access_note}
        </div>
      ) : null}
      <DashboardHomeView meta={meta} home={dashboardHome} loading={loading} />
    </div>
  );
}

function DashboardPageHeader({
  outletName,
  activeRange,
  setActiveRange,
  date,
  setDate,
  accessNote,
}: {
  outletName?: string;
  activeRange: DateRangePreset;
  setActiveRange: (value: DateRangePreset) => void;
  date?: DateRange;
  setDate: (value: DateRange | undefined) => void;
  accessNote?: string | null;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Operations Dashboard</h1>
        <p className="text-muted-foreground text-sm font-medium">
          Real-time control panel for {outletName || "your outlet"}
        </p>
        {accessNote ? <p className="text-xs text-muted-foreground mt-1">{accessNote}</p> : null}
      </div>
      <div className="flex items-center gap-3">
        <DateRangeDropdown
          activeRange={activeRange}
          setActiveRange={setActiveRange}
          date={date}
          setDate={setDate}
        />
        <Badge variant="secondary" className="gap-2 py-1 px-3 bg-green-500/10 text-green-600 border border-green-200 shrink-0">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Live
        </Badge>
      </div>
    </div>
  );
}
