"use client";
import Link from "next/link";
import { ClipboardList, ChefHat, DollarSign } from "lucide-react";
import { memo, useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";
import apiClient from "@/lib/api-client";
import { DashboardApis } from "@/lib/api/endpoints";
import { hasPermission, isPathAccessible } from "@/lib/role-permissions";
export const LiveStats = memo(function LiveStats() {
  const user = useAuth((state) => state.user);
  const restaurant = useRestaurant((state) => state.restaurant);
  const [stats, setStats] = useState<{
    activeOrders: number;
    kotPending: number;
    todaySales: number;
  } | null>(null);

  const canViewDashboard = hasPermission(user, "dashboard.view");
  const canViewOrders = isPathAccessible("/orders", user);
  const canViewAnalytics = hasPermission(user, "reports.analytics.view");

  const requestGeneration = useRef(0);
  const fetchStats = useCallback(async () => {
    const generation = requestGeneration.current;
    if (!user?.restaurant_id || !canViewDashboard) return;
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await apiClient.get(
        DashboardApis.dashboardDataV2({
          restaurantId: user.restaurant_id,
          businessLine:
            restaurant?.hotel_enabled && restaurant?.restaurant_enabled
              ? "all"
              : restaurant?.hotel_enabled
                ? "hotel"
                : "restaurant",
          timezone,
        }),
      );
      if (generation === requestGeneration.current && res.data?.status === "success") {
        const d = res.data.data;
        const shiftPulse = d?.home?.shift_pulse;
        const cashWatch = d?.home?.cash_watch;
        setStats({
          activeOrders:
            shiftPulse?.active_orders ?? d?.health?.active_orders ?? 0,
          kotPending: shiftPulse?.kot_pending ?? d?.health?.kot_pending ?? 0,
          todaySales:
            d?.kpis?.gross_sales ??
            (cashWatch?.cash_collected ?? 0) +
              (cashWatch?.digital_collected ?? 0) +
              (cashWatch?.credit_sales ?? 0),
        });
      }
    } catch {
      // silently fail — stats are non-critical
    }
  }, [
    restaurant?.hotel_enabled,
    restaurant?.restaurant_enabled,
    user?.restaurant_id,
    user?.id,
    canViewDashboard,
  ]);

  useEffect(() => {
    requestGeneration.current += 1;
    setStats(null);
    if (!canViewDashboard) return;
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => { requestGeneration.current += 1; clearInterval(interval); };
  }, [fetchStats]);

  if (!canViewDashboard || !stats) return null;

  const currency = restaurant?.currency || user?.currency || "NPR";
  const formatSales = (n: number) => {
    if (n >= 100000) return `${(n / 1000).toFixed(0)}k`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return n.toLocaleString();
  };

  return (
    <div className="hidden items-center gap-2 lg:flex">
      {canViewOrders && <Link
        href="/orders"
        data-tour="navbar-stat-orders"
        className="flex items-center gap-2 px-3 py-1 rounded-md bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors"
      >
        <ClipboardList className="h-3.5 w-3.5 text-blue-500" />
        <span className="text-xs font-bold text-foreground">
          {stats.activeOrders}
        </span>
        <span className="text-[10px] text-muted-foreground uppercase font-black">
          orders
        </span>
      </Link>}
      {canViewOrders && <Link
        href="/orders?tab=kot"
        data-tour="navbar-stat-kot"
        className="flex items-center gap-2 px-3 py-1 rounded-md bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors"
      >
        <ChefHat className="h-3.5 w-3.5 text-orange-500" />
        <span className="text-xs font-bold text-foreground">
          {stats.kotPending}
        </span>
        <span className="text-[10px] text-muted-foreground uppercase font-black">
          KOT
        </span>
      </Link>}
      {canViewAnalytics && (
        <Link
          href="/analytics"
          data-tour="navbar-stat-sales"
          className="flex items-center gap-2 px-3 py-1 rounded-md bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors"
        >
          <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
          <span className="text-xs font-bold text-foreground">
            {currency} {formatSales(stats.todaySales)}
          </span>
          <span className="text-[10px] text-muted-foreground uppercase font-black">
            today
          </span>
        </Link>
      )}
    </div>
  );
});
