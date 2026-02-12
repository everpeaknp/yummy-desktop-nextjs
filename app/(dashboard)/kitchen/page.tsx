"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api-client";
import { KotApis } from "@/lib/api/endpoints";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

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
    case "PREPARING": return "Start Cooking";
    case "READY": return "Mark Ready";
    case "SERVED": return "Complete";
    default: return "Completed";
  }
}

function elapsedLabel(timestamp: string | undefined, status: string): string {
  if (!timestamp) return "";
  const elapsed = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(elapsed / 60000);
  const isCooking = status === "PREPARING";
  const suffix = isCooking ? "cooking" : "ago"; // simpler
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

function formatTime(ts: string): string {
  try { return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
  catch { return ""; }
}

// ── WebSocket URL ──────────────────────────────────────────────────────
function buildWsUrl(token: string, restaurantId: number): string {
  const base = process.env.NEXT_PUBLIC_API_URL || "https://yummy-container-app.ambitiouspebble-f5ba67fe.southeastasia.azurecontainerapps.io";
  let wsBase = base.replace(/^https:\/\//, "wss://").replace(/^http:\/\//, "ws://");
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
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const user = useAuth((s) => s.user);
  const me = useAuth((s) => s.me);
  const router = useRouter();
  const wsRef = useRef<WebSocket | null>(null);
  const timersRef = useRef<{ ping?: ReturnType<typeof setInterval>; reconnect?: ReturnType<typeof setTimeout>; debounce?: ReturnType<typeof setTimeout>; poll?: ReturnType<typeof setInterval> }>({});
  const elapsedTick = useElapsedTick();

  const restaurantId = user?.restaurant_id;

  // ── Auth guard ─────────────────────────────────────────────────────
  useEffect(() => {
    if (user) return; 
    const token = localStorage.getItem("accessToken");
    const refreshToken = localStorage.getItem("refreshToken");
    if (token || refreshToken) {
      me().catch(() => { });
    } else {
      router.push("/");
    }
  }, [user, me, router]);

  // ── Fetch KOTs — simple, takes restaurantId as param ───────────────
  const doFetch = useCallback(async (rid: number, dateOverride?: Date) => {
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
        date_to: end.toISOString()
      });
      
      const res = await apiClient.get(`${KotApis.searchKots}?${params}`);
      if (res.data.status === "success") {
        setKots(res.data.data || []);
      }
    } catch (err) {
      console.error("[KOT] Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]); // Re-create fetcher when date changes

  // Trigger fetch when date changes
  useEffect(() => {
    if (restaurantId) {
       setLoading(true);
       doFetch(restaurantId);
    }
  }, [restaurantId, selectedDate, doFetch]);

  // Initial fetch + polling + WebSocket — single effect, clean lifecycle
  useEffect(() => {
    if (!restaurantId) return;
    let alive = true;

    // ── WebSocket ──────────────────────────────────────────────────
    const connectWs = () => {
      if (!alive) return;
      const token = localStorage.getItem("accessToken");
      if (!token) return;

      if (wsRef.current) {
        const s = wsRef.current.readyState;
        if (s === WebSocket.OPEN || s === WebSocket.CONNECTING) return;
        try { wsRef.current.close(); } catch { }
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
            try { ws.send("ping"); } catch { }
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
          if (timersRef.current.debounce) clearTimeout(timersRef.current.debounce);
          timersRef.current.debounce = setTimeout(() => {
            // WS update should refresh based on CURRENT selected date
            if (alive) doFetch(restaurantId); 
          }, 350);
        } catch { }
      };

      ws.onerror = () => {
        if (alive) setWsConnected(false);
      };

      ws.onclose = (ev) => {
        console.log("[WS] Closed, code:", ev.code);
        if (alive) setWsConnected(false);
        if (timersRef.current.ping) { clearInterval(timersRef.current.ping); timersRef.current.ping = undefined; }
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
      if (wsRef.current) try { wsRef.current.close(); } catch { }
      if (timersRef.current.ping) clearInterval(timersRef.current.ping);
      if (timersRef.current.reconnect) clearTimeout(timersRef.current.reconnect);
      if (timersRef.current.debounce) clearTimeout(timersRef.current.debounce);
      if (timersRef.current.poll) clearInterval(timersRef.current.poll);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [restaurantId, doFetch]); // Dependency on doFetch correct? Yes, because doFetch changes when date changes.

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
      setMessage({ text: `KOT updated`, type: "success" });
      if (restaurantId) await doFetch(restaurantId);
    } catch (err: any) {
      const detail = err.response?.data?.detail || "Failed to update status";
      setMessage({ text: typeof detail === "string" ? detail : JSON.stringify(detail), type: "error" });
    } finally {
      setUpdatingIds((prev) => { const s = new Set(prev); s.delete(kotId); return s; });
    }
  }, [restaurantId, doFetch]);

  const handleReject = useCallback(async (kotId: number) => {
    setUpdatingIds((prev) => new Set(prev).add(kotId));
    try {
      await apiClient.post(KotApis.rejectKot(kotId));
      setMessage({ text: "KOT rejected", type: "success" });
      if (restaurantId) await doFetch(restaurantId);
    } catch (err: any) {
      const detail = err.response?.data?.detail || "Failed to reject";
      setMessage({ text: typeof detail === "string" ? detail : JSON.stringify(detail), type: "error" });
    } finally {
      setUpdatingIds((prev) => { const s = new Set(prev); s.delete(kotId); return s; });
    }
  }, [restaurantId, doFetch]);

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

  // Handle Date Change
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      setSelectedDate(new Date(e.target.value));
    }
  };

  // ════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-[1800px] mx-auto bg-background">
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
      <div className="px-5 pt-5 pb-3 flex items-center justify-between shrink-0 border-b border-border/40">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-black tracking-tighter">Kitchen</h1>
          
          {/* Date Picker */}
          <div className="relative">
             <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
             <input
               type="date"
               value={format(selectedDate, "yyyy-MM-dd")}
               onChange={handleDateChange}
               className="h-10 pl-9 pr-3 rounded-lg border border-input bg-background text-sm font-medium shadow-sm transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
             />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div
            title={wsConnected ? "Real-time WebSocket connected" : "Auto-refreshing"}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-colors",
              wsConnected
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200/50"
            )}
          >
            {wsConnected ? <Wifi className="h-3 w-3" /> : <RefreshCw className="h-3 w-3 animate-spin" />}
            <span>{wsConnected ? "Live" : "Polling"}</span>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => { if (restaurantId) { setLoading(true); doFetch(restaurantId); } }}
            className="h-9 w-9 rounded-lg"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="px-5 py-3 flex items-center justify-between gap-4 shrink-0 bg-muted/20 border-b border-border/40">
          <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg">
             {STATIONS.map((s) => (
                <button
                    key={s}
                    onClick={() => setStationTab(s)}
                    className={cn(
                        "px-4 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap",
                        stationTab === s
                            ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                            : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                    )}
                >
                    {s}
                </button>
             ))}
          </div>

          <div className="flex items-center gap-2">
             <StatusChip label="All" count={total} active={statusFilter === null} onClick={() => setStatusFilter(null)} />
             {ALL_STATUSES.map((s) => (
                <StatusChip 
                  key={s} 
                  label={s === "PENDING" ? "Pending" : s === "PREPARING" ? "Making" : s === "READY" ? "Ready" : s === "SERVED" ? "Served" : "Void"} 
                  count={counts[s] || 0} 
                  active={statusFilter === s} 
                  onClick={() => setStatusFilter(s)} 
                />
             ))}
          </div>
        </div>

      {/* Stats Summary - Optional, maybe hide for cleaner look? Keeping as requested "fix them" */}
      <div className="grid grid-cols-4 gap-4 px-5 py-4 shrink-0">
          <div className="bg-blue-500/5 border border-blue-500/20 text-blue-700 dark:text-blue-300 rounded-xl p-3 flex items-center justify-between">
              <span className="text-xs font-bold uppercase opacity-70">Active</span>
              <span className="text-xl font-black">{activeCount}</span>
          </div>
          <div className="bg-amber-500/5 border border-amber-500/20 text-amber-700 dark:text-amber-300 rounded-xl p-3 flex items-center justify-between">
              <span className="text-xs font-bold uppercase opacity-70">Pending</span>
              <span className="text-xl font-black">{pendingCount}</span>
          </div>
          <div className="bg-red-500/5 border border-red-500/20 text-red-700 dark:text-red-300 rounded-xl p-3 flex items-center justify-between">
              <span className="text-xs font-bold uppercase opacity-70">Delayed</span>
              <span className="text-xl font-black">{delayedCount}</span>
          </div>
          <div className="bg-gray-500/5 border border-gray-500/20 text-gray-700 dark:text-gray-300 rounded-xl p-3 flex items-center justify-between">
              <span className="text-xs font-bold uppercase opacity-70">Completed</span>
              <span className="text-xl font-black">{(counts.SERVED || 0)}</span>
          </div>
      </div>

      {/* KOT Grid */}
      <div className="flex-1 overflow-y-auto px-5 pb-10">
        {loading && kots.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mb-3" />
            <p className="text-sm font-medium">Fetching orders...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="h-[400px] flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border/50 rounded-3xl bg-muted/5 mt-4">
            <Archive className="w-12 h-12 mb-4 opacity-10" />
            <p className="font-bold text-lg text-foreground/50">No orders found</p>
            <p className="text-sm mt-1 opacity-50">Try selecting a different date or filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
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
function StatusChip({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border border-transparent",
        active
          ? "bg-foreground text-background shadow-md border-foreground/10"
          : "bg-background border-border text-muted-foreground hover:bg-muted"
      )}
    >
      {label}
      {count > 0 && (
        <span className={cn(
          "h-4 min-w-[1rem] px-1 rounded-full text-[9px] flex items-center justify-center",
          active ? "bg-background text-foreground" : "bg-muted text-muted-foreground"
        )}>
          {count}
        </span>
      )}
    </button>
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
  tick,
}: {
  kot: Kot;
  isUpdating: boolean;
  onStatusChange: (id: number, s: KotStatus) => void;
  onReject: (id: number) => void;
  tick: number;
}) {
  const delayed = isDelayed(kot);
  const next = nextStatus(kot.status);
  const canAdvance = next !== null;
  const elapsed = elapsedLabel(kot.created_at || kot.order_created_at, kot.status);
  const showTimer = delayed || kot.status === "PENDING" || kot.status === "PREPARING";

  // Simplified Card Styles
  // Status Colors: Pending(Blue), Preparing(Orange), Ready(Green), Served(Gray)
  const statusColor = 
      kot.status === "PENDING" ? "bg-blue-500" :
      kot.status === "PREPARING" ? "bg-amber-500" :
      kot.status === "READY" ? "bg-emerald-500" :
      kot.status === "REJECTED" ? "bg-red-500" : "bg-gray-500";

  const lightBg = 
      kot.status === "PENDING" ? "bg-blue-500/5" :
      kot.status === "PREPARING" ? "bg-amber-500/5" :
      kot.status === "READY" ? "bg-emerald-500/5" : "bg-card";

  const borderColor = 
      kot.status === "PENDING" ? "border-blue-200 dark:border-blue-900/30" :
      kot.status === "PREPARING" ? "border-amber-200 dark:border-amber-900/30" :
      kot.status === "READY" ? "border-emerald-200 dark:border-emerald-900/30" : "border-border";

  return (
    <div className={cn(
      "group relative flex flex-col rounded-xl border bg-card shadow-sm transition-all hover:shadow-md",
      borderColor,
      lightBg
    )}>
      {isUpdating && (
        <div className="absolute inset-0 bg-background/50 z-20 flex items-center justify-center backdrop-blur-[1px] rounded-xl">
           <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {/* HEADER */}
      <div className="p-3 pb-2 flex items-start justify-between">
         <div>
            <div className="flex items-center gap-2 mb-1">
                <span className={cn("h-2 w-2 rounded-full", statusColor)} /> 
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    #{kot.kot_number}
                </span>
                {showTimer && elapsed && (
                    <span className={cn(
                        "text-[10px] font-bold flex items-center gap-1",
                        delayed ? "text-red-600 animate-pulse" : "text-muted-foreground"
                    )}>
                        • <Clock className="h-3 w-3" /> {elapsed}
                    </span>
                )}
            </div>
            <h3 className="font-bold text-base leading-tight">
                {kot.table_name || `Order #${kot.restaurant_order_id}`}
            </h3>
         </div>
         {kot.table_category && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 font-bold text-muted-foreground bg-background">
                {kot.table_category}
            </Badge>
         )}
      </div>

      {/* ITEMS */}
      <div className="flex-1 px-3 py-2 space-y-1.5">
          {kot.items.map(item => (
              <div key={item.id} className={cn("text-sm flex justify-between items-start gap-2", item.is_deleted ? "opacity-50 line-through decoration-red-500" : "")}>
                  <div className="font-medium leading-snug">
                       <span className="font-bold mr-1">{Math.abs(item.qty_change)}x</span>
                       {item.item_name}
                       {item.modifiers?.length > 0 && (
                           <div className="text-[10px] text-muted-foreground mt-0.5 pl-1 leading-tight">
                               {item.modifiers.map(m => `+ ${m.modifier_name_snapshot}`).join(", ")}
                           </div>
                       )}
                       {item.notes && <div className="text-[10px] text-amber-600 italic">Note: {item.notes}</div>}
                  </div>
                  {/* Item Status Dot */}
                  {item.qty_ready >= item.qty_change && !item.is_deleted && kot.status !== 'SERVED' && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  )}
              </div>
          ))}
      </div>

      {/* FOOTER ACTIONS */}
      {kot.status !== 'SERVED' && kot.status !== 'REJECTED' && (
      <div className="p-2 border-t border-border/50 flex items-center gap-2 mt-auto">
          <Button 
             size="sm" 
             variant="ghost" 
             className="h-8 flex-1 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
             onClick={() => onReject(kot.id)}
             disabled={isUpdating}
          >
              Reject
          </Button>
          {canAdvance && (
              <Button 
                size="sm" 
                className={cn(
                    "h-8 flex-[2] text-xs font-bold shadow-sm",
                    kot.status === "PENDING" ? "bg-blue-600 hover:bg-blue-700" : 
                    kot.status === "PREPARING" ? "bg-amber-600 hover:bg-amber-700" : 
                    "bg-emerald-600 hover:bg-emerald-700"
                )}
                onClick={() => onStatusChange(kot.id, next!)}
                disabled={isUpdating}
            >
                {actionLabel(kot.status, delayed)}
            </Button>
          )}
      </div>
      )}
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
