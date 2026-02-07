"use client";

import { create } from "zustand";
import { useEffect, useRef, useCallback } from "react";
import apiClient from "@/lib/api-client";
import { NotificationApis } from "@/lib/api/endpoints";
import { useAuth } from "@/hooks/use-auth";

// ── Types ────────────────────────────────────────────────────────────
export interface AppNotification {
  id: number;
  restaurant_id: number;
  user_id: number | null;
  actor_id: number | null;
  type: string; // "order" | "kot" | "inventory" | "system"
  status: string; // "created" | "sent" | "failed" | "read"
  channel: string;
  event: string;
  title: string | null;
  body: string | null;
  entity_type: string | null;
  entity_id: number | null;
  payload: Record<string, any> | null;
  target_department: string | null;
  target_roles: string[] | null;
  created_at: string;
  read_at: string | null;
}

interface NotificationTab {
  label: string;
  type: string | null;
}

// ── Role-based tabs (matches Flutter) ────────────────────────────────
export function tabsForRole(role: string): NotificationTab[] {
  switch (role.toLowerCase()) {
    case "admin":
      return [
        { label: "Orders", type: "order" },
        { label: "KOT", type: "kot" },
        { label: "Inventory", type: "inventory" },
      ];
    case "kitchen":
    case "bar":
    case "cafe":
    case "barista":
    default:
      return [{ label: "Notifications", type: null }];
  }
}

// ── Browser Notification helpers ─────────────────────────────────────
function getBrowserPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

function showBrowserNotification(title: string, body: string, icon?: string) {
  if (getBrowserPermission() !== "granted") return;
  try {
    const n = new Notification(title, {
      body,
      icon: icon || "/favicon.ico",
      badge: "/favicon.ico",
      tag: `yummy-${Date.now()}`,
      silent: false,
    });
    // Auto-close after 6s
    setTimeout(() => n.close(), 6000);
  } catch {
    // Safari/iOS may not support Notification constructor
  }
}

// ── Role-based notification filtering (matches Flutter exactly) ──────
function shouldShowNotificationForRole(
  event: string,
  userRoles: Set<string>,
): boolean {
  const e = event.toLowerCase();

  const isCreationEvent = e === "kot_created" || e === "kot";
  const isRejectionEvent = e === "kot_deleted" || e === "kot_rejected";

  // Suppress redundant "order" events (Flutter does this too)
  if (e === "order" && !isRejectionEvent) return false;
  if (e === "order" && isRejectionEvent) return false;

  // General updates → allow all
  if (!isCreationEvent && !isRejectionEvent) return true;

  if (userRoles.size === 0) return true; // Default allow if unknown

  if (isCreationEvent) {
    // Block waiters from seeing new KOT. Allow kitchen/bar/cafe/admin.
    const allowed = new Set(["kitchen", "bar", "cafe", "admin"]);
    return Array.from(userRoles).some((r) => allowed.has(r));
  }

  if (isRejectionEvent) {
    // Block kitchen/bar/cafe from seeing rejections (they caused it).
    // Allow waiter/admin.
    const blocked = new Set(["kitchen", "bar", "cafe"]);
    return Array.from(userRoles).some((r) => !blocked.has(r));
  }

  return true;
}

function buildKotNotificationContent(event: string, data: any): { title: string; body: string } | null {
  const e = event.toLowerCase();
  const payload = data?.data || data?.payload || data || {};

  if (e === "kot_created" || e === "kot") {
    const table = payload.table_name || payload.table || "";
    const station = payload.station || payload.department || "";
    const itemCount = payload.item_count || payload.items?.length || "";
    const title = "🍳 New KOT";
    const parts: string[] = [];
    if (table) parts.push(`Table ${table}`);
    if (station) parts.push(station);
    if (itemCount) parts.push(`${itemCount} items`);
    return { title, body: parts.join(" • ") || "New kitchen order ticket" };
  }

  if (e === "kot_deleted" || e === "kot_rejected") {
    const table = payload.table_name || payload.table || "";
    return { title: "❌ KOT Rejected", body: table ? `Table ${table}` : "A KOT was rejected" };
  }

  if (e === "kot_updated" || e === "kot_modified" || e === "kot_status_updated") {
    const status = payload.status || payload.new_status || "";
    const table = payload.table_name || payload.table || "";
    return { title: "📋 KOT Updated", body: [table ? `Table ${table}` : "", status].filter(Boolean).join(" • ") || "KOT status changed" };
  }

  if (e === "kot_item_progress_updated") {
    return { title: "👨‍🍳 Item Progress", body: "A KOT item was updated" };
  }

  if (e === "order_created") {
    const table = payload.table_name || payload.table || "";
    return { title: "🛎️ New Order", body: table ? `Table ${table}` : "New order placed" };
  }

  if (e === "order_status_updated" || e === "order_updated") {
    const status = payload.status || payload.new_status || "";
    return { title: "📦 Order Updated", body: status || "Order status changed" };
  }

  return null;
}

// ── Zustand store ────────────────────────────────────────────────────
interface NotificationState {
  notifications: AppNotification[];
  allNotifications: AppNotification[];
  total: number;
  unreadCount: number;
  loading: boolean;
  activeTab: string | null;
  panelOpen: boolean;
  browserPermission: NotificationPermission | "unsupported";
  setPanelOpen: (open: boolean) => void;
  setActiveTab: (tab: string | null) => void;
  setNotifications: (all: AppNotification[], tab: string | null, total: number) => void;
  setUnreadCount: (count: number) => void;
  setLoading: (loading: boolean) => void;
  appendNotifications: (more: AppNotification[]) => void;
  setBrowserPermission: (p: NotificationPermission | "unsupported") => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  allNotifications: [],
  total: 0,
  unreadCount: 0,
  loading: false,
  activeTab: null,
  panelOpen: false,
  browserPermission: "unsupported",
  setPanelOpen: (open) => set({ panelOpen: open }),
  setActiveTab: (tab) => {
    const all = get().allNotifications;
    const filtered = tab ? all.filter((n) => n.type.toLowerCase() === tab.toLowerCase()) : all;
    set({ activeTab: tab, notifications: filtered });
  },
  setNotifications: (all, tab, total) => {
    const filtered = tab ? all.filter((n) => n.type.toLowerCase() === tab.toLowerCase()) : all;
    set({ allNotifications: all, notifications: filtered, total });
  },
  setUnreadCount: (count) => set({ unreadCount: count }),
  setLoading: (loading) => set({ loading }),
  appendNotifications: (more) => {
    const existing = get().allNotifications;
    const existingIds = new Set(existing.map((n) => n.id));
    const unique = more.filter((n) => !existingIds.has(n.id));
    const all = [...existing, ...unique];
    const tab = get().activeTab;
    const filtered = tab ? all.filter((n) => n.type.toLowerCase() === tab.toLowerCase()) : all;
    set({ allNotifications: all, notifications: filtered });
  },
  setBrowserPermission: (p) => set({ browserPermission: p }),
}));

// ── WS URL builder ───────────────────────────────────────────────────
function buildWsBase(): string {
  const base = process.env.NEXT_PUBLIC_API_URL || "https://yummy-container-app.ambitiouspebble-f5ba67fe.southeastasia.azurecontainerapps.io";
  return base.replace(/^https:\/\//, "wss://").replace(/^http:\/\//, "ws://").replace(/\/+$/, "");
}

// ── Hook for notification data + WS ──────────────────────────────────
export function useNotifications() {
  const user = useAuth((s) => s.user);
  const store = useNotificationStore();
  const notifWsRef = useRef<WebSocket | null>(null);
  const kotWsRef = useRef<WebSocket | null>(null);
  const timersRef = useRef<{
    notifPing?: ReturnType<typeof setInterval>;
    notifReconnect?: ReturnType<typeof setTimeout>;
    kotPing?: ReturnType<typeof setInterval>;
    kotReconnect?: ReturnType<typeof setTimeout>;
    poll?: ReturnType<typeof setInterval>;
  }>({});

  const restaurantId = user?.restaurant_id;
  const role = user?.role || user?.roles?.[0] || "staff";
  const isAdmin = role.toLowerCase() === "admin";
  const userRoles = new Set(
    (user?.roles?.length ? user.roles : user?.role ? [user.role] : []).map((r) => r.toLowerCase())
  );

  // ── Request browser notification permission on mount ───────────
  useEffect(() => {
    store.setBrowserPermission(getBrowserPermission());
    if (user && getBrowserPermission() === "default") {
      // Auto-request after a short delay so user sees the page first
      const t = setTimeout(async () => {
        const granted = await requestNotificationPermission();
        store.setBrowserPermission(granted ? "granted" : Notification.permission);
      }, 2000);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ── Fetch notifications ──────────────────────────────────────────
  const fetchNotifications = useCallback(
    async (opts?: { loadMore?: boolean }) => {
      if (!restaurantId && !isAdmin) return;
      const loadMore = opts?.loadMore ?? false;
      if (!loadMore) store.setLoading(true);

      try {
        const skip = loadMore ? store.allNotifications.length : 0;
        const res = await apiClient.get(
          NotificationApis.list({
            restaurantId: isAdmin ? restaurantId ?? undefined : undefined,
            skip,
            limit: 50,
          })
        );
        if (res.data.status === "success") {
          const data = res.data.data;
          const items: AppNotification[] = data.notifications || [];
          const total: number = data.total || 0;
          if (loadMore) {
            store.appendNotifications(items);
          } else {
            store.setNotifications(items, store.activeTab, total);
          }
        }
      } catch (err) {
        console.error("[Notifications] Fetch error:", err);
      } finally {
        store.setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [restaurantId, isAdmin]
  );

  // ── Fetch unread count ───────────────────────────────────────────
  const fetchUnreadCount = useCallback(async () => {
    if (!restaurantId && !isAdmin) return;
    try {
      const res = await apiClient.get(
        NotificationApis.unreadCount(isAdmin ? restaurantId ?? undefined : undefined)
      );
      if (res.data.status === "success") {
        store.setUnreadCount(res.data.data?.count ?? 0);
      }
    } catch {
      // silent
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, isAdmin]);

  // ── Mark all as read ─────────────────────────────────────────────
  const markAllRead = useCallback(async () => {
    if (!restaurantId && !isAdmin) return;
    try {
      const params = new URLSearchParams();
      if (isAdmin && restaurantId) params.append("restaurant_id", String(restaurantId));
      const url = `${NotificationApis.markRead}${params.toString() ? `?${params}` : ""}`;
      await apiClient.patch(url, { mark_all: true });
      store.setUnreadCount(0);
    } catch (err) {
      console.error("[Notifications] Mark read error:", err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, isAdmin]);

  // ── WebSockets: notification WS (unread badge) + KOT WS (push) ──
  useEffect(() => {
    if (!user || !restaurantId) return;
    let alive = true;

    fetchUnreadCount();

    const wsBase = buildWsBase();
    const token = () => localStorage.getItem("accessToken") || "";

    // ── 1. Notification WebSocket (unread count badge) ─────────
    const connectNotifWs = () => {
      if (!alive || !token()) return;
      if (notifWsRef.current) {
        const s = notifWsRef.current.readyState;
        if (s === WebSocket.OPEN || s === WebSocket.CONNECTING) return;
        try { notifWsRef.current.close(); } catch { }
      }

      const params = new URLSearchParams();
      params.append("restaurant_id", String(restaurantId));
      if (user.id) params.append("user_id", String(user.id));
      if (role) params.append("role", role);
      params.append("token", token());

      const ws = new WebSocket(`${wsBase}/ws/notifications?${params}`);
      notifWsRef.current = ws;

      ws.onopen = () => {
        if (timersRef.current.notifPing) clearInterval(timersRef.current.notifPing);
        timersRef.current.notifPing = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) try { ws.send(JSON.stringify({ type: "ping" })); } catch { }
        }, 30000);
      };

      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data.event === "notifications_unread" && data.payload) {
            const newCount = typeof data.payload.count === "number" ? data.payload.count : parseInt(data.payload.count) || 0;
            const oldCount = useNotificationStore.getState().unreadCount;
            if (alive) useNotificationStore.getState().setUnreadCount(newCount);
            // If count increased and tab is hidden, show browser notification
            if (newCount > oldCount && document.visibilityState === "hidden") {
              showBrowserNotification(
                "🔔 New Notification",
                `You have ${newCount} unread notification${newCount === 1 ? "" : "s"}`,
              );
            }
          }
        } catch { }
      };

      ws.onerror = () => { };
      ws.onclose = () => {
        if (timersRef.current.notifPing) { clearInterval(timersRef.current.notifPing); timersRef.current.notifPing = undefined; }
        notifWsRef.current = null;
        if (alive) timersRef.current.notifReconnect = setTimeout(connectNotifWs, 5000);
      };
    };

    // ── 2. KOT WebSocket (real-time push notifications) ────────
    const connectKotWs = () => {
      if (!alive || !token()) return;
      if (kotWsRef.current) {
        const s = kotWsRef.current.readyState;
        if (s === WebSocket.OPEN || s === WebSocket.CONNECTING) return;
        try { kotWsRef.current.close(); } catch { }
      }

      const url = `${wsBase}/ws/kots?token=${encodeURIComponent(token())}&restaurant_id=${restaurantId}`;
      const ws = new WebSocket(url);
      kotWsRef.current = ws;

      ws.onopen = () => {
        if (timersRef.current.kotPing) clearInterval(timersRef.current.kotPing);
        timersRef.current.kotPing = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) try { ws.send("ping"); } catch { }
        }, 30000);
      };

      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          const event = data.event;
          if (!event || event === "kots_connected" || event === "pong") return;

          // Role-based filtering (matches Flutter)
          if (!shouldShowNotificationForRole(event, userRoles)) return;

          // Build notification content
          const content = buildKotNotificationContent(event, data);
          if (content) {
            showBrowserNotification(content.title, content.body);
          }
        } catch { }
      };

      ws.onerror = () => { };
      ws.onclose = () => {
        if (timersRef.current.kotPing) { clearInterval(timersRef.current.kotPing); timersRef.current.kotPing = undefined; }
        kotWsRef.current = null;
        if (alive) timersRef.current.kotReconnect = setTimeout(connectKotWs, 5000);
      };
    };

    // Start both WS connections
    const t1 = setTimeout(connectNotifWs, 500);
    const t2 = setTimeout(connectKotWs, 800);

    // Poll unread count every 30s as fallback
    timersRef.current.poll = setInterval(() => {
      if (alive) fetchUnreadCount();
    }, 30000);

    // Tab visibility
    const onVisible = () => {
      if (document.visibilityState === "visible" && alive) {
        fetchUnreadCount();
        if (!notifWsRef.current || notifWsRef.current.readyState !== WebSocket.OPEN) connectNotifWs();
        if (!kotWsRef.current || kotWsRef.current.readyState !== WebSocket.OPEN) connectKotWs();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      alive = false;
      clearTimeout(t1);
      clearTimeout(t2);
      if (notifWsRef.current) try { notifWsRef.current.close(); } catch { }
      if (kotWsRef.current) try { kotWsRef.current.close(); } catch { }
      if (timersRef.current.notifPing) clearInterval(timersRef.current.notifPing);
      if (timersRef.current.notifReconnect) clearTimeout(timersRef.current.notifReconnect);
      if (timersRef.current.kotPing) clearInterval(timersRef.current.kotPing);
      if (timersRef.current.kotReconnect) clearTimeout(timersRef.current.kotReconnect);
      if (timersRef.current.poll) clearInterval(timersRef.current.poll);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, restaurantId, role]);

  return {
    ...store,
    fetchNotifications,
    fetchUnreadCount,
    markAllRead,
    role,
    tabs: tabsForRole(role),
    requestPermission: requestNotificationPermission,
  };
}
