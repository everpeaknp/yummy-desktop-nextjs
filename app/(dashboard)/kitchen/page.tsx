"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api-client";
import { KotApis } from "@/lib/api/endpoints";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  ChefHat,
  Clock,
  AlertTriangle,
  Wifi,
  WifiOff,
  RefreshCw,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────
interface KotItem {
  id: number;
  item_id: number;
  item_name: string;
  qty_change: number;
  qty_ready: number;
  qty_served: number;
  notes?: string;
  modifiers: { id: number; modifier_name_snapshot: string; price_adjustment_snapshot: number }[];
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
}

type KotStatus = "PENDING" | "PREPARING" | "READY" | "SERVED" | "REJECTED";
const ALL_STATUSES: KotStatus[] = ["PENDING", "PREPARING", "READY", "SERVED", "REJECTED"];
const STATIONS = ["All", "Kitchen", "Bar", "Cafe"];

// ── Helpers ────────────────────────────────────────────────────────────
function nextStatus(s: string): KotStatus | null {
  switch (s) {
    case "PENDING": return "PREPARING";
    case "PREPARING": return "READY";
    case "READY": return "SERVED";
    default: return null;
  }
}

function actionLabel(s: string, delayed: boolean): string {
  const next = nextStatus(s);
  switch (next) {
    case "PREPARING": return "Accept Order";
    case "READY": return delayed ? "Prioritize & Mark Ready" : "Mark Ready";
    case "SERVED": return "Mark Served";
    default: return "Completed";
  }
}

function elapsedLabel(timestamp: string | undefined, status: string): string {
  if (!timestamp) return "";
  const elapsed = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(elapsed / 60000);
  const isCooking = status === "PREPARING";
  const suffix = isCooking ? "cooking" : "elapsed";
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ${suffix}`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${suffix}`;
  return `${Math.floor(hrs / 24)}d ${suffix}`;
}

function isDelayed(kot: Kot): boolean {
  const ts = kot.created_at || kot.order_created_at;
  if (!ts) return false;
  const elapsed = Date.now() - new Date(ts).getTime();
  return elapsed >= 20 * 60 * 1000 && kot.status !== "SERVED" && kot.status !== "REJECTED";
}

function itemStatusLabel(item: KotItem): string {
  const ordered = Math.abs(item.qty_change);
  if (item.is_deleted) return "Rejected";
  if (ordered === 0) return "Pending";
  if (item.qty_served >= ordered) return "Served";
  if (item.qty_ready >= ordered) return "Ready";
  if (item.qty_ready > 0 || item.qty_served > 0) return "Partial";
  return "Pending";
}

function statusAccentColor(s: string, delayed: boolean): string {
  if (delayed) return "border-l-red-500";
  switch (s) {
    case "PENDING": return "border-l-blue-500";
    case "PREPARING": return "border-l-amber-500";
    case "READY": return "border-l-emerald-500";
    case "SERVED": return "border-l-gray-400";
    case "REJECTED": return "border-l-red-500";
    default: return "border-l-gray-400";
  }
}

function formatTime(ts: string): string {
  try { return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
  catch { return ""; }
}

// ── WebSocket URL ──────────────────────────────────────────────────────
function buildWsUrl(token: string, restaurantId: number): string {
  const base = process.env.NEXT_PUBLIC_API_URL || "https://yummy-container-app.ambitiouspebble-f5ba67fe.southeastasia.azurecontainerapps.io";
  const wsBase = base.replace(/^https:\/\//, "wss://").replace(/^http:\/\//, "ws://");
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
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const user = useAuth((s) => s.user);
  const me = useAuth((s) => s.me);
  const router = useRouter();
  const wsRef = useRef<WebSocket | null>(null);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchKotsRef = useRef<() => void>(() => { });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elapsedTick = useElapsedTick();

  // ── Auth guard ───────────────────────────────────────────────────────
  useEffect(() => {
    const check = async () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      if (!user && token) await me();
      const t2 = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      if (!user && !t2) router.push("/");
    };
    const t = setTimeout(check, 500);
    return () => clearTimeout(t);
  }, [user, me, router]);

  // ── Fetch KOTs ───────────────────────────────────────────────────────
  const fetchKots = useCallback(async () => {
    if (!user?.restaurant_id) return;
    try {
      const params = new URLSearchParams({
        restaurant_id: String(user.restaurant_id),
        limit: "100",
        include_printer_config: "false",
      });
      const res = await apiClient.get(`${KotApis.searchKots}?${params}`);
      if (res.data.status === "success") {
        setKots(res.data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch KOTs:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user?.restaurant_id) {
      fetchKots();
    }
  }, [user, fetchKots]);

  // Keep fetchKots in a ref so WebSocket handler doesn't cause reconnection loops
  useEffect(() => {
    fetchKotsRef.current = fetchKots;
  }, [fetchKots]);

  // Debounced fetch triggered by WS events (prevents rapid API calls)
  const debouncedFetchKots = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchKotsRef.current();
    }, 300);
  }, []);

  // ── WebSocket ────────────────────────────────────────────────────────
  const connectWs = useCallback(() => {
    if (!user?.restaurant_id) return;
    const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
    if (!token) return;

    // Cleanup previous
    if (wsRef.current) {
      try { wsRef.current.close(); } catch { }
    }

    const url = buildWsUrl(token, user.restaurant_id);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[WS] Connected");
      setWsConnected(true);
      // Start ping every 30s
      if (pingRef.current) clearInterval(pingRef.current);
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send("ping");
      }, 30000);
    };

    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        const event = data.event;
        if (
          event === "kot_created" ||
          event === "kot_modified" ||
          event === "kot_updated" ||
          event === "kot_deleted" ||
          event === "kot_status_updated" ||
          event === "kot_item_progress_updated" ||
          event === "order_status_updated"
        ) {
          debouncedFetchKots();
        }
      } catch { }
    };

    ws.onerror = () => {
      setWsConnected(false);
    };

    ws.onclose = () => {
      setWsConnected(false);
      if (pingRef.current) clearInterval(pingRef.current);
      // Reconnect after 5s
      reconnectRef.current = setTimeout(connectWs, 5000);
    };
  }, [user, debouncedFetchKots]);

  useEffect(() => {
    connectWs();
    return () => {
      if (wsRef.current) try { wsRef.current.close(); } catch { }
      if (pingRef.current) clearInterval(pingRef.current);
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [connectWs]);

  // ── Auto-dismiss messages ────────────────────────────────────────────
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 3000);
    return () => clearTimeout(t);
  }, [message]);

  // ── Status update handler ────────────────────────────────────────────
  const handleStatusChange = useCallback(async (kotId: number, newStatus: KotStatus) => {
    setUpdatingIds((prev) => new Set(prev).add(kotId));
    try {
      await apiClient.patch(KotApis.updateKotStatus(kotId), { status: newStatus });
      setMessage({ text: `KOT updated to ${newStatus}`, type: "success" });
      await fetchKots();
    } catch (err: any) {
      const detail = err.response?.data?.detail || "Failed to update status";
      setMessage({ text: typeof detail === "string" ? detail : JSON.stringify(detail), type: "error" });
    } finally {
      setUpdatingIds((prev) => { const s = new Set(prev); s.delete(kotId); return s; });
    }
  }, [fetchKots]);

  const handleReject = useCallback(async (kotId: number) => {
    setUpdatingIds((prev) => new Set(prev).add(kotId));
    try {
      await apiClient.post(KotApis.rejectKot(kotId));
      setMessage({ text: "KOT rejected", type: "success" });
      await fetchKots();
    } catch (err: any) {
      const detail = err.response?.data?.detail || "Failed to reject";
      setMessage({ text: typeof detail === "string" ? detail : JSON.stringify(detail), type: "error" });
    } finally {
      setUpdatingIds((prev) => { const s = new Set(prev); s.delete(kotId); return s; });
    }
  }, [fetchKots]);

  // ── Filtering ────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = kots;
    if (stationTab !== "All") {
      list = list.filter((k) => k.station?.toLowerCase() === stationTab.toLowerCase());
    }
    if (statusFilter) {
      list = list.filter((k) => k.status === statusFilter);
    }
    return list;
  }, [kots, statusFilter, stationTab]);

  // ── Counts ───────────────────────────────────────────────────────────
  const counts = useMemo(() => {
    // Count from the station-filtered set (before status filter)
    let base = kots;
    if (stationTab !== "All") {
      base = base.filter((k) => k.station?.toLowerCase() === stationTab.toLowerCase());
    }
    const c: Record<string, number> = {};
    for (const s of ALL_STATUSES) c[s] = 0;
    for (const k of base) c[k.status] = (c[k.status] || 0) + 1;
    return c;
  }, [kots, stationTab]);

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const activeCount = total - (counts.SERVED || 0) - (counts.REJECTED || 0);
  const pendingCount = counts.PENDING || 0;
  const delayedCount = useMemo(() => {
    let base = kots;
    if (stationTab !== "All") base = base.filter((k) => k.station?.toLowerCase() === stationTab.toLowerCase());
    return base.filter(isDelayed).length;
  }, [kots, stationTab]);

  // ════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-[1800px] mx-auto">
      {/* Toast */}
      {message && (
        <div className={cn(
          "fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 animate-in slide-in-from-right",
          message.type === "success" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
        )}>
          {message.text}
          <button onClick={() => setMessage(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Header */}
      <div className="px-5 pt-4 pb-2 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">KOT Management</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold",
            wsConnected
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-red-500/10 text-red-600 dark:text-red-400"
          )}>
            {wsConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {wsConnected ? "Live" : "Offline"}
          </div>
          <button
            onClick={() => { setLoading(true); fetchKots(); }}
            className="h-9 w-9 flex items-center justify-center rounded-xl bg-muted/50 border border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted transition-all active:scale-95"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Station Tabs */}
      <div className="px-5 pb-2 flex items-center gap-2 overflow-x-auto shrink-0">
        {STATIONS.map((s) => (
          <button
            key={s}
            onClick={() => setStationTab(s)}
            className={cn(
              "px-5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap uppercase tracking-wider",
              stationTab === s
                ? "bg-foreground text-background shadow-md"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="px-5 py-2 grid grid-cols-3 gap-3 shrink-0">
        <SummaryCard label="ACTIVE KOT" value={activeCount} />
        <SummaryCard label="PENDING" value={pendingCount} />
        <SummaryCard label="DELAYED" value={delayedCount} variant="danger" />
      </div>

      {/* Status Filter Chips */}
      <div className="px-5 py-2 flex items-center gap-2.5 overflow-x-auto shrink-0">
        <StatusChip label="All" count={total} active={statusFilter === null} onClick={() => setStatusFilter(null)} />
        {ALL_STATUSES.map((s) => (
          <StatusChip key={s} label={s === "PENDING" ? "Pending" : s === "PREPARING" ? "Preparing" : s === "READY" ? "Ready" : s === "SERVED" ? "Served" : "Rejected"} count={counts[s] || 0} active={statusFilter === s} onClick={() => setStatusFilter(s)} />
        ))}
      </div>

      {/* KOT Grid */}
      <div className="flex-1 overflow-y-auto px-5 pb-6 pt-2">
        {loading && kots.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mb-3" />
            <p className="text-sm font-medium">Loading KOTs...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-2xl">
            <ChefHat className="w-14 h-14 mb-4 opacity-20" />
            <p className="font-bold text-base">No KOT tickets right now.</p>
            <p className="text-sm mt-1">Pull down to refresh or adjust filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((kot) => (
              <KotTicketCard
                key={kot.id}
                kot={kot}
                isUpdating={updatingIds.has(kot.id)}
                onStatusChange={handleStatusChange}
                onReject={handleReject}
                tick={elapsedTick}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Elapsed time tick hook (updates every 30s to refresh time labels) ──
function useElapsedTick() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);
  return tick;
}

// ── Summary Card ───────────────────────────────────────────────────────
function SummaryCard({ label, value, variant }: { label: string; value: number; variant?: "danger" }) {
  return (
    <div className={cn(
      "rounded-2xl border px-4 py-3 text-center transition-all",
      variant === "danger"
        ? "bg-red-500/5 border-red-500/20 dark:bg-red-950/20 dark:border-red-900/30"
        : "bg-card border-border"
    )}>
      <div className={cn(
        "text-2xl font-extrabold tracking-tight",
        variant === "danger" ? "text-red-600 dark:text-red-400" : "text-foreground"
      )}>
        {value}
      </div>
      <div className={cn(
        "text-[10px] font-bold uppercase tracking-widest mt-1",
        variant === "danger" ? "text-red-500/70 dark:text-red-400/70" : "text-muted-foreground"
      )}>
        {label}
      </div>
    </div>
  );
}

// ── Status Filter Chip ─────────────────────────────────────────────────
function StatusChip({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
        active
          ? "bg-foreground text-background shadow-md"
          : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
      )}
    >
      {label}
      {count > 0 && (
        <span className={cn(
          "px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ml-0.5",
          active ? "bg-primary text-white" : "bg-muted text-muted-foreground"
        )}>
          {count}
        </span>
      )}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ██  KOT TICKET CARD
// ═══════════════════════════════════════════════════════════════════════
function KotTicketCard({
  kot,
  isUpdating,
  onStatusChange,
  onReject,
  tick,
}: {
  kot: Kot;
  isUpdating: boolean;
  onStatusChange: (id: number, s: KotStatus) => void;
  onReject: (id: number) => void;
  tick: number;
}) {
  const delayed = isDelayed(kot);
  const rejected = kot.status === "REJECTED";
  const served = kot.status === "SERVED";
  const next = nextStatus(kot.status);
  const canAdvance = next !== null;
  const title = kot.table_name?.trim() || `Order #${kot.restaurant_order_id || kot.order_id}`;
  const timeStr = formatTime(kot.created_at);
  const elapsed = elapsedLabel(kot.created_at || kot.order_created_at, kot.status);
  const stationLabel = kot.station ? kot.station.charAt(0).toUpperCase() + kot.station.slice(1) : null;
  const showTimer = delayed || kot.status === "PENDING" || kot.status === "PREPARING";

  // Sort items: non-deleted first, then alphabetical
  const sortedItems = useMemo(() => {
    return [...kot.items].sort((a, b) => {
      if (a.is_deleted !== b.is_deleted) return a.is_deleted ? 1 : -1;
      return a.item_name.toLowerCase().localeCompare(b.item_name.toLowerCase());
    });
  }, [kot.items]);

  const totalQty = sortedItems.reduce((s, i) => s + Math.abs(i.qty_change), 0);

  return (
    <div className={cn(
      "rounded-2xl border bg-card overflow-hidden transition-all relative",
      `border-l-4 ${statusAccentColor(kot.status, delayed)}`,
      (delayed || rejected) && "bg-red-50/50 dark:bg-red-950/10 border-red-500/30",
    )}>
      {isUpdating && (
        <div className="absolute inset-0 bg-background/60 z-10 flex items-center justify-center rounded-2xl">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      <div className="p-4 space-y-3">
        {/* Top: Status Badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-bold">
            <span>#{kot.kot_number}</span>
            {timeStr && (
              <>
                <span className="h-1 w-1 rounded-full bg-border" />
                <span>{timeStr}</span>
              </>
            )}
          </div>
          <KotStatusBadge status={kot.status} delayed={delayed} />
        </div>

        {/* Station */}
        {stationLabel && (
          <StationBadge station={stationLabel} />
        )}

        {/* Title Row */}
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-extrabold text-foreground text-base leading-tight truncate">
            {title}
          </h3>
          {kot.table_category && (
            <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-muted text-muted-foreground shrink-0">
              {kot.table_category}
            </span>
          )}
        </div>

        {/* Timer */}
        {showTimer && elapsed && (
          <div className={cn(
            "flex items-center gap-1.5 text-xs font-bold",
            delayed ? "text-red-600 dark:text-red-400" : kot.status === "PREPARING" ? "text-amber-600 dark:text-amber-400" : "text-primary"
          )}>
            {delayed && <AlertTriangle className="h-3 w-3" />}
            <Clock className="h-3 w-3" />
            <span>{elapsed}</span>
          </div>
        )}

        {/* Items */}
        <div className="space-y-2 pt-1 border-t border-border/50">
          <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            <span>Items</span>
            <span>{totalQty} qty</span>
          </div>
          {sortedItems.map((item) => (
            <KotItemRow key={item.id} item={item} />
          ))}
        </div>

        {/* Actions */}
        {!served && !rejected && (
          <div className="flex items-center gap-2 pt-2 border-t border-border/50">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs border-red-500/30 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 dark:text-red-400"
              disabled={isUpdating}
              onClick={() => onReject(kot.id)}
            >
              Reject
            </Button>
            {canAdvance && (
              <Button
                size="sm"
                className={cn(
                  "h-8 text-xs flex-1 font-bold",
                  kot.status === "PENDING" && "bg-blue-600 hover:bg-blue-700 text-white",
                  kot.status === "PREPARING" && "bg-amber-600 hover:bg-amber-700 text-white",
                  kot.status === "READY" && "bg-emerald-600 hover:bg-emerald-700 text-white",
                )}
                disabled={isUpdating}
                onClick={() => onStatusChange(kot.id, next!)}
              >
                {actionLabel(kot.status, delayed)}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── KOT Status Badge ───────────────────────────────────────────────────
function KotStatusBadge({ status, delayed }: { status: string; delayed: boolean }) {
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
    <span className={cn("px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider", colors)}>
      {delayed && <AlertTriangle className="inline h-3 w-3 mr-1 -mt-0.5" />}
      {label}
    </span>
  );
}

// ── Station Badge ──────────────────────────────────────────────────────
function StationBadge({ station }: { station: string }) {
  const s = station.toLowerCase();
  const colors = s === "bar"
    ? "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/40"
    : s === "cafe"
      ? "bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-950/30 dark:text-teal-400 dark:border-teal-900/40"
      : "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-900/40";

  return (
    <span className={cn("inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border", colors)}>
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
    Partial: "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
    Ready: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
    Served: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    Rejected: "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400",
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className={cn(
          "text-sm font-bold flex-1",
          isItemDeleted ? "text-red-500 line-through" : "text-foreground"
        )}>
          {item.item_name} × {ordered}
        </span>
        <span className={cn(
          "px-2 py-0.5 rounded-md text-[10px] font-extrabold shrink-0",
          statusColors[statusText] || statusColors.Pending
        )}>
          {statusText}
        </span>
      </div>
      {item.is_deleted === 1 && item.deleted_qty > 0 && (
        <p className="text-[11px] font-semibold text-red-500 line-through ml-0.5">
          Cancelled: {item.deleted_qty}
        </p>
      )}
      {item.modifiers?.map((mod, i) => (
        <span key={i} className="inline-block ml-3 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/60 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800/30 mr-1 mb-0.5">
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
