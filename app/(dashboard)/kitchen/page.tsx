"use client";
import { OptionSelect } from "@/components/ui/option-select";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { hasPermission } from "@/lib/role-permissions";
import { kitchenStationOptions } from "@/lib/kitchen-station-access";
import { useCustomFinanceStations } from "@/hooks/use-custom-finance-stations";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api-client";
import { KotApis } from "@/lib/api/endpoints";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Loader2,
  ChefHat,
  Clock,
  AlertTriangle,
  Wifi,
  RefreshCw,
  X,
  Calendar as CalendarIcon,
  Archive,
  CheckCircle2,
  Check,
} from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";
import { format, subDays } from "date-fns";
import { FilterChip } from "@/components/patterns/controls/filter-chip";
import {
  EmptyState,
  LoadingState,
} from "@/components/patterns/feedback/feedback-state";
import { PageTabs } from "@/components/patterns/navigation/page-tabs";
import {
  formatKotElapsedTime,
  humanizeKotStation,
  isKotDelayed,
  KitchenTicketCard,
  KotTicketDetail,
} from "@/components/kitchen/kot-ticket-card";
import { KotTicketItems } from "@/components/kitchen/kot-ticket-items";
import { KotSavedPrintEvents } from "@/components/receipts/kot-saved-print-events";

// ── Types ──────────────────────────────────────────────────────────────
interface KotItem {
  id: number;
  item_id: number;
  item_name: string;
  qty_change: number;
  qty_ready: number;
  qty_served: number;
  notes?: string;
  modifiers: {
    id: number;
    modifier_name_snapshot: string;
    price_adjustment_snapshot: number;
  }[];
  is_deleted: number;
  deleted_qty: number;
  item_status: string;
}

interface Kot {
  id: number;
  kot_number: string;
  type: string;
  station: string;
  status: string;
  order_id: number;
  created_at: string;
  items: KotItem[];
  table_name?: string;
  table_category?: string;
  order_created_at?: string;
  created_by_staff_name?: string;
  customer_name?: string;
  restaurant_order_id?: number;
  order?: {
    business_line?: string;
  };
}

interface KotActivityItem {
  id: number;
  event: string;
  change_field?: string | null;
  old_value?: Record<string, any> | null;
  new_value?: Record<string, any> | null;
  actor_id?: number | null;
  actor_name?: string | null;
  actor_role?: string | null;
  created_at: string;
}

type KotStatus = "PENDING" | "PREPARING" | "READY" | "SERVED" | "REJECTED";
const ALL_STATUSES: KotStatus[] = [
  "PENDING",
  "PREPARING",
  "READY",
  "SERVED",
  "REJECTED",
];

// ── Helpers ────────────────────────────────────────────────────────────
function nextStatus(s: string): KotStatus | null {
  switch (s) {
    case "PENDING":
      return "PREPARING";
    case "PREPARING":
      return "READY";
    case "READY":
      return "SERVED";
    default:
      return null;
  }
}

function actionLabel(
  s: string,
  delayed: boolean,
  businessLine?: string,
): string {
  const next = nextStatus(s);
  switch (next) {
    case "PREPARING":
      return "Start Cooking";
    case "READY":
      return "Mark Ready";
    case "SERVED":
      return "Complete";
    default:
      return "Completed";
  }
}

function elapsedLabel(timestamp: string | undefined, status: string): string {
  return formatKotElapsedTime(timestamp, status);
}

function isDelayed(kot: Kot): boolean {
  return isKotDelayed(kot);
}

function itemStatusLabel(item: KotItem): string {
  const ordered = Math.abs(item.qty_change);
  if (item.is_deleted) return "Rejected";
  if (item.qty_served >= ordered) return "Served";
  if (item.qty_ready >= ordered) return "Ready";
  if (item.qty_ready > 0 || item.qty_served > 0) return "Partial";
  if (String(item.item_status || "").toUpperCase() === "PREPARING") return "Preparing";
  return "Pending";
}

function formatTime(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

// ── WebSocket URL ──────────────────────────────────────────────────────
function buildWsUrl(token: string, restaurantId: number): string {
  const base =
    process.env.NEXT_PUBLIC_API_URL ||
    "https://yummy-container-app.ambitiouspebble-f5ba67fe.southeastasia.azurecontainerapps.io";
  let wsBase = base
    .replace(/^https:\/\//, "wss://")
    .replace(/^http:\/\//, "ws://");
  wsBase = wsBase.replace(/\/+$/, "");
  return `${wsBase}/ws/kots?token=${encodeURIComponent(token)}&restaurant_id=${restaurantId}`;
}

// ════════════════════════════════════════════════════════════════════════
// ██  KITCHEN PAGE
// ════════════════════════════════════════════════════════════════════════
export default function KitchenPage() {
  const [kots, setKots] = useState<Kot[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<KotStatus | null>(null);
  const [stationTab, setStationTab] = useState("All");
  const [wsConnected, setWsConnected] = useState(false);
  const [updatingIds, setUpdatingIds] = useState<Set<number>>(new Set());
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [activeKot, setActiveKot] = useState<Kot | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityItems, setActivityItems] = useState<KotActivityItem[]>([]);
  const [activityError, setActivityError] = useState(false);
  const [activityRevision, setActivityRevision] = useState(0);

  const [rejectKotOpen, setRejectKotOpen] = useState(false);
  const [rejectKotId, setRejectKotId] = useState<number | null>(null);

  const user = useAuth((s) => s.user);
  const me = useAuth((s) => s.me);
  const router = useRouter();
  const kotFetchRequestId = useRef(0);
  const wsRef = useRef<WebSocket | null>(null);
  const timersRef = useRef<{
    ping?: ReturnType<typeof setInterval>;
    reconnect?: ReturnType<typeof setTimeout>;
    debounce?: ReturnType<typeof setTimeout>;
    poll?: ReturnType<typeof setInterval>;
  }>({});
  useElapsedTick();

  const canOperateTickets = hasPermission(user, "pos.view");
  const restaurantId = user?.restaurant_id;
  const canListStations = hasPermission(user, "inventory.stations.view") || hasPermission(user, "inventory.stations.manage");
  const customStations = useCustomFinanceStations(canListStations ? restaurantId : null);
  const STATIONS = useMemo(() => kitchenStationOptions(user, customStations.map((s) => s.name.trim())), [user, customStations]);
  useEffect(() => {
    if (!STATIONS.includes(stationTab)) setStationTab(STATIONS[0] || "All");
  }, [STATIONS, stationTab]);

  // ── Auth guard ─────────────────────────────────────────────────────
  useEffect(() => {
    if (user) return;
    const token = localStorage.getItem("accessToken");
    const refreshToken = localStorage.getItem("refreshToken");
    if (token || refreshToken) {
      me().catch(() => {});
    } else {
      router.push("/");
    }
  }, [user, me, router]);

  // ── Fetch KOTs — simple, takes restaurantId as param ───────────────
  const doFetch = useCallback(
    async (rid: number, dateOverride?: Date) => {
      const requestId = ++kotFetchRequestId.current;
      try {
        const targetDate = dateOverride || selectedDate;
        // Convert to start/end of day in local time (browser) -> ISO
        // Actually backend expects ISO. Let's send full day range.
        const start = new Date(targetDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(targetDate);
        end.setHours(23, 59, 59, 999);

        const params = new URLSearchParams({
          restaurant_id: String(rid),
          limit: "100",
          include_printer_config: "false",
          date_from: start.toISOString(),
          date_to: end.toISOString(),
        });

        const res = await apiClient.get(`${KotApis.searchKots}?${params}`);
        if (requestId !== kotFetchRequestId.current) return;
        if (res.data.status === "success") {
          setKots(res.data.data || []);
        }
      } catch (err) {
        if (requestId === kotFetchRequestId.current) {
          console.error("[KOT] Fetch error:", err);
        }
      } finally {
        if (requestId === kotFetchRequestId.current) setLoading(false);
      }
    },
    [selectedDate],
  ); // Re-create fetcher when date changes

  // Trigger fetch when date changes
  useEffect(() => {
    if (restaurantId && canOperateTickets) {
      setLoading(true);
      doFetch(restaurantId);
    }
  }, [restaurantId, selectedDate, doFetch, canOperateTickets]);

  // Initial fetch + polling + WebSocket — single effect, clean lifecycle
  useEffect(() => {
    if (!restaurantId || !canOperateTickets) return;
    let alive = true;

    // ── WebSocket ──────────────────────────────────────────────────
    const connectWs = () => {
      if (!alive) return;
      const token = localStorage.getItem("accessToken");
      if (!token) return;

      if (wsRef.current) {
        const s = wsRef.current.readyState;
        if (s === WebSocket.OPEN || s === WebSocket.CONNECTING) return;
        try {
          wsRef.current.close();
        } catch {}
        wsRef.current = null;
      }

      const url = buildWsUrl(token, restaurantId);
      console.log("[WS] Connecting...");
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[WS] Connected ✅");
        if (alive) setWsConnected(true);
        if (timersRef.current.ping) clearInterval(timersRef.current.ping);
        timersRef.current.ping = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            try {
              ws.send("ping");
            } catch {}
          }
        }, 30000);
      };

      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          const event = data.event;
          if (event === "kots_connected" || event === "pong") return;
          console.log("[WS] Event:", event);

          // Debounce fetch
          if (timersRef.current.debounce)
            clearTimeout(timersRef.current.debounce);
          timersRef.current.debounce = setTimeout(() => {
            // WS update should refresh based on CURRENT selected date
            if (alive) doFetch(restaurantId);
          }, 350);
        } catch {}
      };

      ws.onerror = () => {
        if (alive) setWsConnected(false);
      };

      ws.onclose = (ev) => {
        console.log("[WS] Closed, code:", ev.code);
        if (alive) setWsConnected(false);
        if (timersRef.current.ping) {
          clearInterval(timersRef.current.ping);
          timersRef.current.ping = undefined;
        }
        wsRef.current = null;
        if (alive) {
          timersRef.current.reconnect = setTimeout(connectWs, 3000);
        }
      };
    };

    const wsTimer = setTimeout(connectWs, 500);

    // ── Polling fallback: always fetch every 15s (relaxed) ──────────
    timersRef.current.poll = setInterval(() => {
      if (alive) doFetch(restaurantId);
    }, 15000);

    const onVisible = () => {
      if (document.visibilityState === "visible" && alive) {
        doFetch(restaurantId);
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          connectWs();
        }
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      alive = false;
      clearTimeout(wsTimer);
      if (wsRef.current)
        try {
          wsRef.current.close();
        } catch {}
      if (timersRef.current.ping) clearInterval(timersRef.current.ping);
      if (timersRef.current.reconnect)
        clearTimeout(timersRef.current.reconnect);
      if (timersRef.current.debounce) clearTimeout(timersRef.current.debounce);
      if (timersRef.current.poll) clearInterval(timersRef.current.poll);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [canOperateTickets, restaurantId, doFetch]); // Dependency on doFetch correct? Yes, because doFetch changes when date changes.

  // ── Auto-dismiss messages ────────────────────────────────────────────
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 3000);
    return () => clearTimeout(t);
  }, [message]);

  // ── Status update handler ────────────────────────────────────────────
  const handleStatusChange = useCallback(
    async (kotId: number, newStatus: KotStatus) => {
      setUpdatingIds((prev) => new Set(prev).add(kotId));
      try {
        const response = await apiClient.patch(KotApis.updateKotStatus(kotId), {
          status: newStatus,
        });
        if (response.data?.data) setActiveKot(response.data.data);
        setActivityRevision((value) => value + 1);
        setMessage({ text: `KOT updated`, type: "success" });
        if (restaurantId) await doFetch(restaurantId);
      } catch (err: any) {
        const detail = err.response?.data?.detail || "Failed to update status";
        setMessage({
          text: typeof detail === "string" ? detail : JSON.stringify(detail),
          type: "error",
        });
      } finally {
        setUpdatingIds((prev) => {
          const s = new Set(prev);
          s.delete(kotId);
          return s;
        });
      }
    },
    [restaurantId, doFetch],
  );

  const openRejectKot = useCallback((kotId: number) => {
    setRejectKotId(kotId);
    setRejectKotOpen(true);
  }, []);

  const doRejectKot = useCallback(
    async (kotId: number, reason: string) => {
      setUpdatingIds((prev) => new Set(prev).add(kotId));
      try {
        const response = await apiClient.post(KotApis.rejectKot(kotId), undefined, {
          params: reason ? { reason } : undefined,
        });
        if (response.data?.data) setActiveKot(response.data.data);
        setActivityRevision((value) => value + 1);
        setMessage({ text: "KOT rejected", type: "success" });
        if (restaurantId) await doFetch(restaurantId);
      } catch (err: any) {
        const detail = err.response?.data?.detail || "Failed to reject";
        setMessage({
          text: typeof detail === "string" ? detail : JSON.stringify(detail),
          type: "error",
        });
      } finally {
        setUpdatingIds((prev) => {
          const s = new Set(prev);
          s.delete(kotId);
          return s;
        });
      }
    },
    [restaurantId, doFetch],
  );

  const doFetchActivity = useCallback(async (kotId: number) => {
    setActivityLoading(true);
    setActivityError(false);
    try {
      const res = await apiClient.get(KotApis.getKotActivity(kotId), {
        params: { skip: 0, limit: 100 },
      });
      if (res.data?.status === "success") {
        setActivityItems(res.data?.data?.items || []);
      } else {
        setActivityError(true);
      }
    } catch {
      setActivityError(true);
    } finally {
      setActivityLoading(false);
    }
  }, []);

  // ── KOT detail dialog activity load ───────────────────────────────────
  const activeKotId = activeKot?.id;
  useEffect(() => {
    if (!detailOpen || !activeKotId) return;
    doFetchActivity(activeKotId);
  }, [detailOpen, activeKotId, activityRevision, doFetchActivity]);

  // ── Filtering ────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = kots;
    if (stationTab !== "All") {
      list = list.filter(
        (k) => k.station?.toLowerCase() === stationTab.toLowerCase(),
      );
    }
    if (statusFilter) {
      list = list.filter((k) => k.status === statusFilter);
    }
    return list;
  }, [kots, statusFilter, stationTab]);

  // ── Counts ───────────────────────────────────────────────────────────
  const counts = useMemo(() => {
    let base = kots;
    if (stationTab !== "All") {
      base = base.filter(
        (k) => k.station?.toLowerCase() === stationTab.toLowerCase(),
      );
    }
    const c: Record<string, number> = {};
    for (const s of ALL_STATUSES) c[s] = 0;
    for (const k of base) c[k.status] = (c[k.status] || 0) + 1;
    return c;
  }, [kots, stationTab]);

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const setDayAndClose = (d: Date) => {
    setSelectedDate(d);
    setDatePickerOpen(false);
  };
  const activeKotItemCount = activeKot?.items.filter(
    (item) => !String(item.item_name || "").toLowerCase().includes("room charge"),
  ).length ?? 0;

  // ════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════
  if (user && !canOperateTickets) {
    return <div className="p-4 sm:p-6"><h1 className="text-xl font-semibold">Kitchen</h1><p className="mt-4 text-sm text-muted-foreground">Kitchen ticket access also requires POS view permission. Ask an administrator to update your access.</p></div>;
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] w-full min-w-0 max-w-[1800px] flex-col overflow-x-clip bg-background">
      {/* Toast */}
      {message && (
        <div
          className={cn(
            "fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 animate-in slide-in-from-right",
            message.type === "success"
              ? "bg-emerald-600 text-white"
              : "bg-red-600 text-white",
          )}
        >
          {message.text}
          <button onClick={() => setMessage(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Operational controls */}
      <div className="shrink-0 border-b border-border/40 bg-background px-4 py-3 sm:px-5 sm:py-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <h1 className="hidden shrink-0 text-xl font-bold tracking-tight sm:block sm:text-2xl">
            Kitchen
          </h1>

          {/* Date Picker (styled, consistent) */}
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="h-11 min-w-0 flex-1 justify-start rounded-xl px-3 text-xs font-semibold sm:flex-none sm:justify-center sm:px-4"
              >
                <CalendarIcon className="h-4 w-4" />
                {format(selectedDate, "d MMM yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="flex w-[calc(100vw-2rem)] max-w-[440px] flex-col overflow-hidden rounded-2xl border border-border/40 bg-background p-0 shadow-2xl sm:w-auto sm:flex-row sm:rounded-[24px]"
              align="start"
            >
              <div className="hidden w-[150px] shrink-0 flex-col border-r border-border/40 bg-muted/20 p-5 sm:flex">
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-orange-500 mb-4">
                  Quick Select
                </p>
                <div className="flex flex-col gap-1 flex-1">
                  <button
                    className="text-left px-3 py-2 rounded-xl text-xs font-bold hover:bg-orange-500/10 transition-colors"
                    onClick={() => setDayAndClose(new Date())}
                  >
                    Today
                  </button>
                  <button
                    className="text-left px-3 py-2 rounded-xl text-xs font-bold hover:bg-orange-500/10 transition-colors"
                    onClick={() => setDayAndClose(subDays(new Date(), 1))}
                  >
                    Yesterday
                  </button>
                </div>
                <button
                  className="text-[9px] font-bold uppercase tracking-widest text-destructive/40 hover:text-destructive transition-colors mt-4 text-left"
                  onClick={() => setDayAndClose(new Date())}
                >
                  Reset
                </button>
              </div>
              <div className="overflow-x-auto p-3 sm:p-4">
                <CalendarComponent
                  initialFocus
                  mode="single"
                  selected={selectedDate}
                  defaultMonth={selectedDate}
                  onSelect={(d) => {
                    if (!d) return;
                    setDayAndClose(d);
                  }}
                  numberOfMonths={1}
                  className="p-0"
                  weekStartsOn={1}
                />
              </div>
            </PopoverContent>
          </Popover>
          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
            <div
              title={
                wsConnected
                  ? "Real-time WebSocket connected"
                  : "Auto-refreshing"
              }
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-xl px-3 text-xs font-semibold transition-colors",
                wsConnected
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200/50",
              )}
            >
              {wsConnected ? (
                <Wifi className="h-3 w-3" />
              ) : (
                <RefreshCw className="h-3 w-3 animate-spin" />
              )}
              <span>{wsConnected ? "Live" : "Polling"}</span>
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                if (restaurantId) {
                  setLoading(true);
                  doFetch(restaurantId);
                }
              }}
              className="h-11 w-11 rounded-xl"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div
          className="mt-3 flex min-w-0 gap-2 overflow-x-auto overscroll-x-contain scroll-px-4 pb-0.5 pr-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Kitchen ticket status"
        >
          <FilterChip
            count={total}
            active={statusFilter === null}
            onClick={() => setStatusFilter(null)}
          >
            All
          </FilterChip>
          {ALL_STATUSES.map((s) => (
            <FilterChip
              key={s}
              count={counts[s] || 0}
              active={statusFilter === s}
              onClick={() => setStatusFilter(s)}
            >
              {s === "PENDING"
                ? "New"
                : s === "PREPARING"
                  ? "Preparing"
                  : s === "READY"
                    ? "Ready"
                    : s === "SERVED"
                      ? "Completed"
                      : "Rejected"}
            </FilterChip>
          ))}
        </div>

        <label className="mt-2 flex min-h-11 items-center gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 text-xs font-medium md:hidden">
          <span className="shrink-0 text-muted-foreground">Station</span>
          <OptionSelect
            aria-label="Kitchen station"
            className="min-w-0 flex-1"
            value={stationTab}
            onValueChange={(event) => setStationTab(event)}
          >
            {STATIONS.map((station) => (
              <option key={station} value={station}>
                {humanizeKotStation(station)}
              </option>
            ))}
          </OptionSelect>
        </label>

        <div className="mt-3 hidden min-w-0 md:block">
          <PageTabs
            ariaLabel="Kitchen station"
            className="max-w-full"
            items={STATIONS.map((station) => ({
              value: station,
              label: humanizeKotStation(station),
            }))}
            mobileMode="scroll"
            value={stationTab}
            onValueChange={setStationTab}
          />
        </div>
      </div>

      {/* KOT Grid */}
      <div className="min-w-0 flex-1 overflow-y-auto px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-4 sm:px-5 lg:pb-10">
        {loading && kots.length === 0 ? (
          <LoadingState label="Fetching orders..." />
        ) : filtered.length === 0 ? (
          <EmptyState
            className="min-h-72"
            icon={<Archive className="h-5 w-5" />}
            title="No tickets found"
            description="Try selecting a different date, station, or status."
          />
        ) : (
          <>
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">
                {filtered.length} {filtered.length === 1 ? "ticket" : "tickets"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {stationTab === "All" ? "All stations" : stationTab}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((kot) => {
                // Final filter check to skip cards that would be empty (e.g. legacy/corrupt KOTs with only room charges)
                const visibleItems = kot.items.filter(
                  (i) =>
                    !String(i.item_name || "")
                      .toLowerCase()
                      .includes("room charge"),
                );
                if (visibleItems.length === 0) return null;

                return (
                  <KitchenTicketCard
                    key={kot.id}
                    kot={kot}
                    isUpdating={updatingIds.has(kot.id)}
                    elapsed={elapsedLabel(
                      kot.created_at || kot.order_created_at,
                      kot.status,
                    )}
                    delayed={isDelayed(kot)}
                    primaryAction={
                      canOperateTickets && nextStatus(kot.status)
                        ? {
                            label: actionLabel(
                              kot.status,
                              isDelayed(kot),
                              kot.order?.business_line,
                            ),
                            onClick: () =>
                              handleStatusChange(
                                kot.id,
                                nextStatus(kot.status)!,
                              ),
                          }
                        : null
                    }
                    onReject={canOperateTickets ? () => openRejectKot(kot.id) : undefined}
                    onOpenDetails={() => {
                      setActiveKot(kot);
                      setDetailOpen(true);
                    }}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* KOT Detail (Item-Level Controls + Activity Timeline) */}
      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) {
            setActiveKot(null);
            setActivityItems([]);
          }
        }}
      >
        {activeKot ? <KotTicketDetail
          ticket={activeKot}
          printEvents={<KotSavedPrintEvents kotId={activeKot.id} />}
          activity={activityItems}
          activityLoading={activityLoading}
          onClose={() => setDetailOpen(false)}
          actions={canOperateTickets && nextStatus(activeKot.status) ? <>
            <Button type="button" className="h-11 w-full font-semibold sm:w-auto" disabled={updatingIds.has(activeKot.id)} onClick={() => handleStatusChange(activeKot.id, nextStatus(activeKot.status)!)}>
              {actionLabel(activeKot.status, isDelayed(activeKot), activeKot.order?.business_line)}
            </Button>
            <Button type="button" variant="outline" className="h-11 w-full border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive sm:w-auto" disabled={updatingIds.has(activeKot.id)} onClick={() => openRejectKot(activeKot.id)}>Reject ticket</Button>
          </> : null}
          activityAction={<>{activityError ? <p role="alert" className="self-center text-xs text-destructive">Could not load activity.</p> : null}<Button size="sm" variant="outline" className="h-9" onClick={() => doFetchActivity(activeKot.id)} disabled={activityLoading}>
            {activityLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button></>}
          items={<KotTicketItems ticket={activeKot} canOperate={canOperateTickets} onUpdated={async (updated) => {
            setActiveKot(updated as Kot);
            setActivityRevision((value) => value + 1);
            if (restaurantId) await doFetch(restaurantId);
          }} />}
        /> : null}
      </Dialog>

      <ReasonDialog
        open={rejectKotOpen}
        onOpenChange={setRejectKotOpen}
        title="Reject KOT"
        description="Write the reason so it shows in the audit/activity log."
        confirmLabel="Reject"
        onConfirm={async (reason) => {
          const id = rejectKotId;
          setRejectKotOpen(false);
          setRejectKotId(null);
          if (!id) return;
          await doRejectKot(id, reason);
        }}
      />

    </div>
  );
}

// ── Elapsed time tick hook ─────────────────────────────────────────────
function useElapsedTick() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);
  return tick;
}

// ── Status Filter Chip ─────────────────────────────────────────────────
function ReasonDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-[520px] bg-card border-border rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold tracking-tight">
            {title}
          </DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70">
            Reason
          </p>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Write a short reason…"
            className="rounded-xl min-h-[110px]"
          />
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            className="h-11 rounded-xl"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="h-11 rounded-xl bg-destructive hover:bg-destructive/90"
            onClick={() => onConfirm(reason.trim())}
            disabled={!reason.trim()}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ██  KOT TICKET CARD (Redesigned)
// ═══════════════════════════════════════════════════════════════════════
function KotTicketCard({
  kot,
  isUpdating,
  onStatusChange,
  onReject,
  onOpenDetails,
  tick,
}: {
  kot: Kot;
  isUpdating: boolean;
  onStatusChange: (id: number, s: KotStatus) => void;
  onReject: (id: number) => void;
  onOpenDetails: (kot: Kot) => void;
  tick: number;
}) {
  const delayed = isDelayed(kot);
  const next = nextStatus(kot.status);
  const canAdvance = next !== null;
  const elapsed = elapsedLabel(
    kot.created_at || kot.order_created_at,
    kot.status,
  );
  const showTimer =
    delayed || kot.status === "PENDING" || kot.status === "PREPARING";
  const displayItems = kot.items.filter(
    (item) =>
      !String(item.item_name || "")
        .toLowerCase()
        .includes("room charge"),
  );

  // Simplified Card Styles
  // Status Colors: Pending(Blue), Preparing(Orange), Ready(Green), Served(Gray)
  const statusColor =
    kot.status === "PENDING"
      ? "bg-blue-500"
      : kot.status === "PREPARING"
        ? "bg-amber-500"
        : kot.status === "READY"
          ? "bg-emerald-500"
          : kot.status === "REJECTED"
            ? "bg-red-500"
            : "bg-gray-500";

  const lightBg =
    kot.status === "PENDING"
      ? "bg-blue-500/5"
      : kot.status === "PREPARING"
        ? "bg-amber-500/5"
        : kot.status === "READY"
          ? "bg-emerald-500/5"
          : "bg-card";

  const borderColor =
    kot.status === "PENDING"
      ? "border-blue-200 dark:border-blue-900/30"
      : kot.status === "PREPARING"
        ? "border-amber-200 dark:border-amber-900/30"
        : kot.status === "READY"
          ? "border-emerald-200 dark:border-emerald-900/30"
          : "border-border";

  return (
    <div
      className={cn(
        "group relative flex min-h-[280px] flex-col overflow-hidden rounded-2xl border border-l-4 bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg cursor-pointer",
        borderColor,
        lightBg,
      )}
      onClick={() => onOpenDetails(kot)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpenDetails(kot);
      }}
    >
      {isUpdating && (
        <div className="absolute inset-0 bg-background/50 z-20 flex items-center justify-center backdrop-blur-[1px] rounded-xl">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {/* HEADER */}
      <div className="flex items-start justify-between gap-3 border-b border-border/60 p-4 pb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className={cn("h-2 w-2 rounded-full", statusColor)} />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              #{kot.kot_number}
            </span>
            {showTimer && elapsed && (
              <span
                className={cn(
                  "text-[10px] font-bold flex items-center gap-1",
                  delayed
                    ? "text-red-600 animate-pulse"
                    : "text-muted-foreground",
                )}
              >
                • <Clock className="h-3 w-3" /> {elapsed}
              </span>
            )}
          </div>
          <h3 className="truncate font-bold text-base leading-tight text-foreground">
            {kot.order?.business_line === "hotel"
              ? kot.table_name || "Room service"
              : kot.table_name ||
                `Order #${kot.restaurant_order_id || kot.order_id}`}
          </h3>
          <p className="mt-1 truncate text-xs font-medium text-muted-foreground">
            {kot.station || "Kitchen"}
            {kot.created_by_staff_name ? ` · ${kot.created_by_staff_name}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <KotStatusBadge status={kot.status} delayed={delayed} />
          {kot.table_category && (
            <Badge
              variant="outline"
              className="h-5 bg-background px-1.5 py-0 text-[10px] font-bold text-muted-foreground"
            >
              {kot.table_category}
            </Badge>
          )}
        </div>
      </div>

      {/* ITEMS */}
      <div className="flex-1 space-y-1.5 px-4 py-3">
        {displayItems.slice(0, 6).map((item) => (
          <div
            key={item.id}
            className={cn(
              "text-sm flex justify-between items-start gap-2",
              item.is_deleted
                ? "opacity-50 line-through decoration-red-500"
                : "",
            )}
          >
            <div className="font-medium leading-snug">
              <span className="font-bold mr-1">
                {Math.abs(item.qty_change)}x
              </span>
              {item.item_name}
              {item.modifiers?.length > 0 && (
                <div className="text-[10px] text-muted-foreground mt-0.5 pl-1 leading-tight">
                  {item.modifiers
                    .map((m) => `+ ${m.modifier_name_snapshot}`)
                    .join(", ")}
                </div>
              )}
              {item.notes && (
                <div className="text-[10px] text-amber-600 italic">
                  Note: {item.notes}
                </div>
              )}
            </div>
            {/* Item Status Dot */}
            {item.qty_ready >= Math.abs(item.qty_change) &&
              !item.is_deleted &&
              kot.status !== "SERVED" && (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
              )}
          </div>
        ))}
        {displayItems.length > 6 && (
          <p className="pt-1 text-xs font-semibold text-primary">
            +{displayItems.length - 6} more item
            {displayItems.length - 6 === 1 ? "" : "s"}
          </p>
        )}
      </div>

      {/* FOOTER ACTIONS */}
      {kot.status !== "SERVED" && kot.status !== "REJECTED" && (
        <div className="p-2 border-t border-border/50 flex items-center gap-2 mt-auto">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 flex-1 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={(e) => {
              e.stopPropagation();
              onReject(kot.id);
            }}
            disabled={isUpdating}
          >
            Reject
          </Button>
          {canAdvance && (
            <Button
              size="sm"
              className={cn(
                "h-8 flex-[2] text-xs font-bold shadow-sm",
                kot.status === "PENDING"
                  ? "bg-blue-600 hover:bg-blue-700"
                  : kot.status === "PREPARING"
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-emerald-600 hover:bg-emerald-700",
              )}
              onClick={(e) => {
                e.stopPropagation();
                onStatusChange(kot.id, next!);
              }}
              disabled={isUpdating}
            >
              {actionLabel(kot.status, delayed, kot.order?.business_line)}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ── KOT Status Badge ───────────────────────────────────────────────────
function KotStatusBadge({
  status,
  delayed,
}: {
  status: string;
  delayed: boolean;
}) {
  const label = delayed ? "DELAYED" : status === "PENDING" ? "NEW" : status;
  const colors = delayed
    ? "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400"
    : status === "PENDING"
      ? "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400"
      : status === "PREPARING"
        ? "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
        : status === "READY"
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
          : status === "SERVED"
            ? "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400"
            : "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400";

  return (
    <span
      className={cn(
        "px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider",
        colors,
      )}
    >
      {delayed && <AlertTriangle className="inline h-3 w-3 mr-1 -mt-0.5" />}
      {label}
    </span>
  );
}

// ── Station Badge ──────────────────────────────────────────────────────
function StationBadge({ station }: { station: string }) {
  const s = station.toLowerCase();
  const colors =
    s === "bar"
      ? "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/40"
      : s === "cafe"
        ? "bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-950/30 dark:text-teal-400 dark:border-teal-900/40"
        : "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-900/40";

  return (
    <span
      className={cn(
        "inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border",
        colors,
      )}
    >
      {station}
    </span>
  );
}

// ── KOT Item Row ───────────────────────────────────────────────────────
function KotItemRow({ item }: { item: KotItem }) {
  const ordered = Math.abs(item.qty_change);
  const isItemDeleted = item.is_deleted && item.qty_change === 0;
  const statusText = itemStatusLabel(item);

  const statusColors: Record<string, string> = {
    Pending: "bg-muted text-muted-foreground",
    Partial:
      "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
    Ready:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
    Served: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    Rejected: "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400",
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "text-sm font-bold flex-1",
            isItemDeleted ? "text-red-500 line-through" : "text-foreground",
          )}
        >
          {item.item_name} × {ordered}
        </span>
        <span
          className={cn(
            "px-2 py-0.5 rounded-md text-[10px] font-extrabold shrink-0",
            statusColors[statusText] || statusColors.Pending,
          )}
        >
          {statusText}
        </span>
      </div>
      {item.is_deleted === 1 && item.deleted_qty > 0 && (
        <p className="text-[11px] font-semibold text-red-500 line-through ml-0.5">
          Cancelled: {item.deleted_qty}
        </p>
      )}
      {item.modifiers?.map((mod, i) => (
        <span
          key={i}
          className="inline-block ml-3 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/60 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800/30 mr-1 mb-0.5"
        >
          + {mod.modifier_name_snapshot}
        </span>
      ))}
      {item.notes && (
        <div className="ml-0.5 px-2 py-1 rounded-md bg-muted/60 text-[11px] text-muted-foreground italic">
          {item.notes}
        </div>
      )}
    </div>
  );
}
