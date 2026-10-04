"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Trophy,
  UserRoundCheck,
} from "lucide-react";

import apiClient from "@/lib/api-client";
import { AnalyticsApis } from "@/lib/api/endpoints";
import { useRestaurant } from "@/hooks/use-restaurant";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/patterns/feedback/feedback-state";
import type {
  StaffPerformanceResponse,
  StaffPerformanceRow,
} from "@/types/staff-performance";

function yyyyMmDd(value: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function scoreText(value: number | null | undefined) {
  return `${Math.round(Number(value || 0))}`;
}

function hours(minutes: number | null | undefined) {
  return `${(Number(minutes || 0) / 60).toFixed(1)}h`;
}

function scoreLabel(value: number | null | undefined) {
  const score = Number(value || 0);
  if (score >= 85) return "Strong contribution";
  if (score >= 65) return "On track";
  if (score > 0) return "Building a record";
  return "No score yet";
}

function BreakdownRow({ label, score, detail }: { label: string; score: number | null | undefined; detail: string }) {
  const available = score !== null && score !== undefined;
  const value = Math.max(0, Math.min(100, Number(score || 0)));
  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0"><p className="text-sm font-medium">{label}</p><p className="mt-0.5 text-xs text-muted-foreground">{detail}</p></div>
        <p className="shrink-0 text-sm font-semibold tabular-nums">{available ? `${Math.round(value)}%` : "Not tracked"}</p>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${available ? value : 0}%` }} /></div>
    </div>
  );
}

/**
 * Reuses the backend-calculated score for both a staff profile and the user's
 * own workspace. Detail is deliberately tucked behind an explicit control so
 * the first view answers the questions people actually ask: how am I doing,
 * what period is this, and what activity supports it?
 */
export function StaffPerformanceCard({ userId }: { userId: number }) {
  const restaurantId = useRestaurant((state) => state.restaurant?.id);
  const authRestaurantId = useAuth((state) => state.user?.restaurant_id);
  const effectiveRestaurantId = restaurantId ?? authRestaurantId;
  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const [dateFrom, setDateFrom] = useState(() => {
    const value = new Date();
    value.setDate(value.getDate() - 29);
    return yyyyMmDd(value);
  });
  const [dateTo, setDateTo] = useState(() => yyyyMmDd(new Date()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [row, setRow] = useState<StaffPerformanceRow | null>(null);

  const load = useCallback(async () => {
    if (!effectiveRestaurantId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(AnalyticsApis.staffDetails({ restaurantId: effectiveRestaurantId, dateFrom, dateTo, timezone, page: 1, pageSize: 1, staffUserId: userId }));
      const data = (response.data?.data || {}) as StaffPerformanceResponse;
      setRow(data.staff?.[0] ?? null);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.detail || requestError?.response?.data?.message || "Performance data is unavailable right now.");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, effectiveRestaurantId, timezone, userId]);

  useEffect(() => { void load(); }, [load]);

  const breakdown = row?.performance_breakdown;
  return (
    <section className="rounded-2xl border bg-card" aria-label="Performance" data-tour="mobile-profile-performance">
      <div className="flex flex-col gap-4 border-b p-4 sm:p-5 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0"><div className="flex items-center gap-2"><Trophy className="h-4 w-4 text-primary" /><h2 className="font-semibold tracking-tight">Performance</h2></div><p className="mt-1 max-w-xl text-sm text-muted-foreground">A role-aware view of attendance and verified order work.</p></div>
        <div className="grid grid-cols-2 gap-2 md:w-[260px]">
          <div><Label htmlFor="staff-performance-from" className="text-xs">From</Label><Input id="staff-performance-from" type="date" value={dateFrom} max={dateTo} onChange={(event) => setDateFrom(event.target.value)} /></div>
          <div><Label htmlFor="staff-performance-to" className="text-xs">To</Label><Input id="staff-performance-to" type="date" value={dateTo} min={dateFrom} onChange={(event) => setDateTo(event.target.value)} /></div>
        </div>
      </div>

      {loading ? <LoadingState label="Loading performance" className="min-h-44" /> : error ? <ErrorState title="Performance is unavailable" description={error} actionLabel="Try again" onAction={() => void load()} className="min-h-44" /> : !row ? <EmptyState title="No performance record yet" description="Approved attendance and attributed order activity will appear here as you work." className="min-h-44" /> : (
        <div className="p-4 sm:p-5">
          <div className="grid overflow-hidden rounded-xl border sm:grid-cols-[0.85fr_1.15fr]">
            <div className="border-b bg-primary/[0.035] p-4 sm:border-b-0 sm:border-r">
              <p className="text-sm text-muted-foreground">Performance score</p>
              <div className="mt-1 flex items-end gap-1"><p className="text-4xl font-semibold tracking-[-0.04em] tabular-nums">{scoreText(row.performance_score)}</p><p className="mb-1 text-sm text-muted-foreground">/100</p></div>
              <p className="mt-2 text-sm font-medium">{scoreLabel(row.performance_score)}</p>
              {!row.eligible_for_ranking ? <p className="mt-2 text-xs leading-5 text-muted-foreground">{row.eligibility_reason || "More verified work is needed before this can be ranked fairly."}</p> : null}
            </div>
            <div className="grid grid-cols-2 divide-x divide-y sm:grid-cols-3 sm:divide-y-0">
              <Metric label="Role rank" value={row.performance_rank && row.eligible_for_ranking ? `#${row.performance_rank}` : "-"} detail={row.eligible_for_ranking ? `Among ${row.role || "staff"}` : "Not ranked yet"} icon={UserRoundCheck} />
              <Metric label="Approved time" value={hours(row.approved_attendance_minutes)} detail={row.scheduled_attendance_minutes ? `${hours(row.scheduled_attendance_minutes)} scheduled` : "No schedule set"} icon={Clock3} />
              <Metric label="Attendance" value={breakdown?.attendance == null ? "-" : `${Math.round(breakdown.attendance)}%`} detail={breakdown?.attendance == null ? "Not tracked" : "Reliability"} icon={CheckCircle2} className="col-span-2 border-t sm:col-span-1 sm:border-t-0" />
            </div>
          </div>

          <div className="mt-4 grid divide-y rounded-xl border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <Evidence label="Orders opened" value={row.orders_count} detail="Created by you" />
            <Evidence label="Orders completed" value={row.orders_completed} detail="Completed by you" />
            <Evidence label="Items added" value={row.items_added} detail="Added after opening" />
          </div>

          <details className="group mt-4 rounded-xl border">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium marker:content-none"><span>See how the score is calculated</span><ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" /></summary>
            <div className="border-t px-4 pt-3"><p className="text-xs leading-5 text-muted-foreground">Your score is normalized against colleagues in the same role for this period. Customer revenue is context, not personal sales credit.</p><div className="mt-2 divide-y"><BreakdownRow label="Attendance reliability" score={breakdown?.attendance} detail="Approved hours, scheduled coverage, and timing" /><BreakdownRow label="Order ownership" score={breakdown?.order_ownership} detail="Orders opened, adjusted for approved hours" /><BreakdownRow label="Order completion" score={breakdown?.order_completion} detail="Final completion work, adjusted for approved hours" /><BreakdownRow label="Order progression" score={breakdown?.order_progression} detail="Items added to existing orders" /></div></div>
          </details>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarRange className="h-3.5 w-3.5" />This performance period runs from {dateFrom} to {dateTo}.</p>
        </div>
      )}
    </section>
  );
}

function Metric({ icon: Icon, label, value, detail, className = "" }: { icon: typeof Clock3; label: string; value: string; detail: string; className?: string }) {
  return <div className={`min-w-0 p-3 ${className}`}><div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5" />{label}</div><p className="mt-2 text-lg font-semibold tabular-nums">{value}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{detail}</p></div>;
}

function Evidence({ label, value, detail }: { label: string; value: number; detail: string }) {
  return <div className="flex items-center justify-between gap-3 p-3"><div><p className="text-sm font-medium">{label}</p><p className="mt-0.5 text-xs text-muted-foreground">{detail}</p></div><p className="text-lg font-semibold tabular-nums">{value}</p></div>;
}
