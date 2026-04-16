"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { cn } from "@/lib/utils";
import { format, subDays } from "date-fns";

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

function actionLabel(s: string, delayed: boolean, businessLine?: string): string {
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

function eventLabel(e: string): string {
  const s = String(e || "").trim();
  if (!s) return "Activity";
  return s
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function toKvList(obj: any): Array<{ k: string; v: string }> {
  if (!obj || typeof obj !== "object") return [];
  const out: Array<{ k: string; v: string }> = [];
  for (const [k, v] of Object.entries(obj as Record<string, any>)) {
    if (v === undefined) continue;
    const key = String(k).replace(/_/g, " ").replace(/\s+/g, " ").trim();
    let value = "";
    if (v === null) value = "—";
    else if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") value = String(v);
    else value = JSON.stringify(v);
    out.push({ k: key, v: value });
  }
  return out;
}

function prettyStatus(s: string): string {
  const v = String(s || "").toLowerCase();
  if (!v) return "—";
  return v.replace(/\b\w/g, (m) => m.toUpperCase());
}

function nextTargetForItem(item: KotItem): KotStatus {
  const ordered = Math.abs(item.qty_change);
  const isReady = item.qty_ready >= ordered && ordered > 0;
  return isReady ? "SERVED" : "READY";
}

// ── WebSocket URL ──────────────────────────────────────────────────────
function buildWsUrl(token: string, restaurantId: number): string {
  const base =
    process.env.NEXT_PUBLIC_API_URL ||
    "https://yummy-container-app.ambitiouspebble-f5ba67fe.southeastasia.azurecontainerapps.io";
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
  const [updatingItemKeys, setUpdatingItemKeys] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [activeKot, setActiveKot] = useState<Kot | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityItems, setActivityItems] = useState<KotActivityItem[]>([]);

  const [rejectKotOpen, setRejectKotOpen] = useState(false);
  const [rejectKotId, setRejectKotId] = useState<number | null>(null);
  const [rejectItemOpen, setRejectItemOpen] = useState(false);
  const [rejectItemCtx, setRejectItemCtx] = useState<{ kotId: number; itemId: number } | null>(null);

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

  const openRejectKot = useCallback((kotId: number) => {
    setRejectKotId(kotId);
    setRejectKotOpen(true);
  }, []);

  const doRejectKot = useCallback(async (kotId: number, reason: string) => {
    setUpdatingIds((prev) => new Set(prev).add(kotId));
    try {
      await apiClient.post(KotApis.rejectKot(kotId), undefined, { params: reason ? { reason } : undefined });
      setMessage({ text: "KOT rejected", type: "success" });
      if (restaurantId) await doFetch(restaurantId);
    } catch (err: any) {
      const detail = err.response?.data?.detail || "Failed to reject";
      setMessage({ text: typeof detail === "string" ? detail : JSON.stringify(detail), type: "error" });
    } finally {
      setUpdatingIds((prev) => {
        const s = new Set(prev);
        s.delete(kotId);
        return s;
      });
    }
  }, [restaurantId, doFetch]);

  const itemKey = (kotId: number, itemId: number) => `${kotId}:${itemId}`;

  const doAcceptItem = useCallback(async (kotId: number, itemId: number) => {
    const key = itemKey(kotId, itemId);
    setUpdatingItemKeys((prev) => new Set(prev).add(key));
    try {
      await apiClient.post(KotApis.acceptKotItem(kotId, itemId));
      setMessage({ text: "Item accepted", type: "success" });
      if (restaurantId) await doFetch(restaurantId);
    } catch (err: any) {
      const detail = err.response?.data?.detail || "Failed to accept item";
      setMessage({ text: typeof detail === "string" ? detail : JSON.stringify(detail), type: "error" });
    } finally {
      setUpdatingItemKeys((prev) => {
        const s = new Set(prev);
        s.delete(key);
        return s;
      });
    }
  }, [restaurantId, doFetch]);

  const openRejectItem = useCallback((kotId: number, itemId: number) => {
    setRejectItemCtx({ kotId, itemId });
    setRejectItemOpen(true);
  }, []);

  const doRejectItem = useCallback(async (kotId: number, itemId: number, reason: string) => {
    const key = itemKey(kotId, itemId);
    setUpdatingItemKeys((prev) => new Set(prev).add(key));
    try {
      await apiClient.post(KotApis.rejectKotItem(kotId, itemId), undefined, { params: reason ? { reason } : undefined });
      setMessage({ text: "Item rejected", type: "success" });
      if (restaurantId) await doFetch(restaurantId);
    } catch (err: any) {
      const detail = err.response?.data?.detail || "Failed to reject item";
      setMessage({ text: typeof detail === "string" ? detail : JSON.stringify(detail), type: "error" });
    } finally {
      setUpdatingItemKeys((prev) => {
        const s = new Set(prev);
        s.delete(key);
        return s;
      });
    }
  }, [restaurantId, doFetch]);

  const doMarkItemAll = useCallback(async (kotId: number, itemId: number, target: KotStatus) => {
    const key = itemKey(kotId, itemId);
    setUpdatingItemKeys((prev) => new Set(prev).add(key));
    try {
      await apiClient.post(KotApis.markKotItemAll(kotId, itemId), { target });
      setMessage({ text: target === "READY" ? "Item marked ready" : "Item marked served", type: "success" });
      if (restaurantId) await doFetch(restaurantId);
    } catch (err: any) {
      const detail = err.response?.data?.detail || "Failed to update item";
      setMessage({ text: typeof detail === "string" ? detail : JSON.stringify(detail), type: "error" });
    } finally {
      setUpdatingItemKeys((prev) => {
        const s = new Set(prev);
        s.delete(key);
        return s;
      });
    }
  }, [restaurantId, doFetch]);

  const doFetchActivity = useCallback(async (kotId: number) => {
    setActivityLoading(true);
    try {
      const res = await apiClient.get(KotApis.getKotActivity(kotId), { params: { skip: 0, limit: 100 } });
      if (res.data?.status === "success") {
        setActivityItems(res.data?.data?.items || []);
      } else {
        setActivityItems([]);
      }
    } catch {
      setActivityItems([]);
    } finally {
      setActivityLoading(false);
    }
  }, []);

  // ── KOT detail dialog activity load ───────────────────────────────────
  useEffect(() => {
    if (!detailOpen || !activeKot) return;
    doFetchActivity(activeKot.id);
  }, [detailOpen, activeKot?.id, doFetchActivity]);

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

  const setDayAndClose = (d: Date) => {
    setSelectedDate(d);
    setDatePickerOpen(false);
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
          
          {/* Date Picker (styled, consistent) */}
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="h-10 rounded-xl gap-2 font-bold text-xs uppercase tracking-widest px-4"
              >
                <CalendarIcon className="h-4 w-4" />
                {format(selectedDate, "MM/dd/yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto p-0 flex shadow-2xl border border-border/40 rounded-[24px] overflow-hidden bg-background"
              align="start"
            >
              <div className="flex flex-col p-5 border-r border-border/40 bg-muted/20 w-[150px] shrink-0">
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-orange-500 mb-4">Quick Select</p>
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
              <div className="p-4">
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
            {filtered.map((kot) => {
               // Final filter check to skip cards that would be empty (e.g. legacy/corrupt KOTs with only room charges)
               const visibleItems = kot.items.filter(i => !i.item_name.toLowerCase().includes("room charge"));
               if (visibleItems.length === 0) return null;

	               return (
	                 <KotTicketCard
	                   key={kot.id}
	                   kot={kot}
	                   isUpdating={updatingIds.has(kot.id)}
	                   onStatusChange={handleStatusChange}
	                   onReject={openRejectKot}
	                   onOpenDetails={(k) => { setActiveKot(k); setDetailOpen(true); }}
	                   tick={elapsedTick}
	                 />
	               );
	            })}
	          </div>
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
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-[980px] bg-card border-border p-0 overflow-hidden rounded-2xl sm:rounded-3xl shadow-2xl max-h-[90vh] flex flex-col">
          <DialogHeader className="p-6 sm:p-8 pb-4 sm:pb-5 bg-muted/20 border-b border-border/40">
            <DialogTitle className="text-2xl font-black tracking-tight">KOT Details</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Review items, accept or reject, mark ready/served, and see the activity log.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 sm:p-8 pt-6 overflow-auto no-scrollbar flex-1 min-h-0">
            {!activeKot ? (
              <div className="h-32 flex items-center justify-center text-muted-foreground">No KOT selected.</div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="rounded-2xl border border-border/60 bg-muted/10 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">
                          #{activeKot.kot_number} • {activeKot.station}
                        </p>
                        <p className="text-lg font-black text-foreground truncate mt-1">
                          {activeKot.order?.business_line === "hotel"
                            ? (activeKot.table_name || "Room Service")
                            : (activeKot.table_name || `Order #${activeKot.restaurant_order_id || activeKot.order_id}`)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Created {activeKot.created_at ? format(new Date(activeKot.created_at), "MMM dd, yyyy HH:mm") : "—"}
                          {activeKot.created_by_staff_name ? ` • by ${activeKot.created_by_staff_name}` : ""}
                        </p>
                      </div>
                      <KotStatusBadge status={activeKot.status} delayed={isDelayed(activeKot)} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60 px-1">
                      Items
                    </p>

                    <div className="rounded-2xl border border-border/60 bg-muted/10 overflow-hidden">
                      <div className="max-h-[420px] overflow-auto no-scrollbar">
                        {activeKot.items
                          .filter((i) => !i.item_name.toLowerCase().includes("room charge"))
                          .map((item) => {
                            const ordered = Math.abs(item.qty_change);
                            const statusText = itemStatusLabel(item);
                            const isReady = ordered > 0 && item.qty_ready >= ordered;
                            const isServed = ordered > 0 && item.qty_served >= ordered;
                            const canInteract =
                              activeKot.status !== "SERVED" &&
                              activeKot.status !== "REJECTED" &&
                              item.qty_change > 0 &&
                              !item.is_deleted;

                            const key = `${activeKot.id}:${item.id}`;
                            const itemUpdating = updatingItemKeys.has(key);

                            return (
                              <div key={item.id} className="px-5 py-4 border-b border-border/30 last:border-none">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className={cn("text-sm font-black text-foreground truncate", item.is_deleted ? "line-through decoration-red-500 opacity-60" : "")}>
                                        {item.item_name} × {ordered}
                                      </p>
                                      <span className={cn(
                                        "px-2 py-0.5 rounded-md text-[10px] font-extrabold shrink-0",
                                        statusText === "Pending"
                                          ? "bg-muted text-muted-foreground"
                                          : statusText === "Partial"
                                          ? "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
                                          : statusText === "Ready"
                                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                                          : statusText === "Served"
                                          ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                                          : "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400"
                                      )}>
                                        {statusText}
                                      </span>
                                    </div>

                                    {item.modifiers?.length ? (
                                      <p className="text-[11px] text-muted-foreground mt-1">
                                        {item.modifiers.map((m) => `+ ${m.modifier_name_snapshot}`).join(", ")}
                                      </p>
                                    ) : null}
                                    {item.notes ? (
                                      <p className="text-[11px] text-amber-600 italic mt-1">
                                        Note: {item.notes}
                                      </p>
                                    ) : null}
                                    {ordered > 0 ? (
                                      <p className="text-[11px] text-muted-foreground mt-2">
                                        Ready: <span className="font-bold text-foreground">{item.qty_ready}</span> • Served:{" "}
                                        <span className="font-bold text-foreground">{item.qty_served}</span>
                                      </p>
                                    ) : null}
                                  </div>

                                  <div className="shrink-0 flex flex-col items-end gap-2">
                                    {statusText === "Pending" && canInteract ? (
                                      <div className="flex items-center gap-2">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-9 rounded-xl border-red-500/20 text-red-600 hover:bg-red-500/10"
                                          onClick={() => openRejectItem(activeKot.id, item.id)}
                                          disabled={itemUpdating}
                                        >
                                          Reject
                                        </Button>
                                        <Button
                                          size="sm"
                                          className="h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700"
                                          onClick={() => doAcceptItem(activeKot.id, item.id)}
                                          disabled={itemUpdating}
                                        >
                                          <Check className="h-4 w-4 mr-1" /> Accept
                                        </Button>
                                      </div>
                                    ) : canInteract && statusText !== "Rejected" && !isServed ? (
                                      <Button
                                        size="sm"
                                        className={cn(
                                          "h-9 rounded-xl font-bold",
                                          isReady ? "bg-emerald-600 hover:bg-emerald-700" : "bg-amber-600 hover:bg-amber-700"
                                        )}
                                        onClick={() => doMarkItemAll(activeKot.id, item.id, nextTargetForItem(item))}
                                        disabled={itemUpdating}
                                      >
                                        {isReady ? "Mark Served" : "Mark Ready"}
                                      </Button>
                                    ) : null}

                                    {itemUpdating ? (
                                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Updating…
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60 px-1">
                      Activity Log
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 rounded-xl"
                      onClick={() => activeKot && doFetchActivity(activeKot.id)}
                      disabled={activityLoading}
                    >
                      {activityLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                      Refresh
                    </Button>
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-muted/10 overflow-hidden">
                    <div className="max-h-[520px] overflow-auto no-scrollbar">
                      {activityLoading ? (
                        <div className="p-6 text-sm text-muted-foreground flex items-center justify-center">
                          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading activity…
                        </div>
                      ) : activityItems.length === 0 ? (
                        <div className="p-6 text-sm text-muted-foreground">
                          No activity yet for this KOT.
                        </div>
                      ) : (
                        activityItems.map((a) => (
                          <div key={a.id} className="px-5 py-4 border-b border-border/30 last:border-none">
                            <div className="flex items-start justify-between gap-6">
                              <div className="min-w-0">
                                <p className="text-sm font-black text-foreground truncate">{eventLabel(a.event)}</p>
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                  {(a.actor_name || a.actor_role) ? `${a.actor_name || "Staff"}${a.actor_role ? ` • ${a.actor_role}` : ""}` : "System"}
                                  {a.change_field ? ` • ${a.change_field}` : ""}
                                </p>
                              </div>
                              <p className="text-[11px] font-bold text-muted-foreground/70 uppercase tracking-wider whitespace-nowrap">
                                {a.created_at ? format(new Date(a.created_at), "MMM dd, HH:mm") : "—"}
                              </p>
                            </div>
                            {(a.new_value || a.old_value) ? (
                              <div className="mt-3 rounded-xl border border-border/60 bg-background/40 p-3 text-[11px] text-muted-foreground">
                                {a.old_value ? (
                                  <div className="mb-2">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70 mb-1">From</p>
                                    <div className="space-y-1">
                                      {toKvList(a.old_value).map((row, idx) => (
                                        <div key={idx} className="flex items-start justify-between gap-6">
                                          <span className="font-semibold text-muted-foreground">{row.k}</span>
                                          <span className="font-bold text-foreground text-right">
                                            {row.k.toLowerCase() === "status" ? prettyStatus(row.v) : row.v}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : null}
                                {a.new_value ? (
                                  <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70 mb-1">To</p>
                                    <div className="space-y-1">
                                      {toKvList(a.new_value).map((row, idx) => (
                                        <div key={idx} className="flex items-start justify-between gap-6">
                                          <span className="font-semibold text-muted-foreground">{row.k}</span>
                                          <span className="font-bold text-foreground text-right">
                                            {row.k.toLowerCase() === "status" ? prettyStatus(row.v) : row.v}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="p-6 sm:p-8 pt-4 bg-muted/30 border-t border-border/40">
            <Button variant="outline" className="h-12 rounded-2xl w-full" onClick={() => setDetailOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
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

      <ReasonDialog
        open={rejectItemOpen}
        onOpenChange={setRejectItemOpen}
        title="Reject Item"
        description="Write the reason so it shows in the activity log."
        confirmLabel="Reject"
        onConfirm={async (reason) => {
          const ctx = rejectItemCtx;
          setRejectItemOpen(false);
          setRejectItemCtx(null);
          if (!ctx) return;
          await doRejectItem(ctx.kotId, ctx.itemId, reason);
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
          <DialogTitle className="text-xl font-black tracking-tight">{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70">Reason</p>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Write a short reason…"
            className="rounded-xl min-h-[110px]"
          />
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" className="h-11 rounded-xl" onClick={() => onOpenChange(false)}>
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
      "group relative flex flex-col rounded-xl border bg-card shadow-sm transition-all hover:shadow-md cursor-pointer",
      borderColor,
      lightBg
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
                {kot.order?.business_line === "hotel" ? kot.table_name : (kot.table_name || `Order #${kot.restaurant_order_id}`)}
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
          {kot.items.filter(i => !i.item_name.toLowerCase().includes("room charge")).map(item => (
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
             onClick={(e) => { e.stopPropagation(); onReject(kot.id); }}
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
                onClick={(e) => { e.stopPropagation(); onStatusChange(kot.id, next!); }}
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
