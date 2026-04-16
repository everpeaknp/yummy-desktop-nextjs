"use client";

import { useEffect, useMemo, useState } from "react";
import { NotificationApis } from "@/lib/api/endpoints";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { format } from "date-fns";
import { Bell, Loader2, RefreshCw, CheckCircle2 } from "lucide-react";

type NotificationItem = {
  id: number;
  type: string;
  status: string;
  event: string;
  title?: string | null;
  body?: string | null;
  entity_type?: string | null;
  entity_id?: number | null;
  payload?: Record<string, any> | null;
  created_at: string;
  read_at?: string | null;
};

export function EntityNotificationsCard({
  title = "Notifications",
  restaurantId,
  entity,
  entityId,
}: {
  title?: string;
  restaurantId?: number;
  entity: "order" | "kot" | "inventory_item";
  entityId: number;
}) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [marking, setMarking] = useState(false);

  const unreadCount = useMemo(
    () => items.filter((n) => String(n.status || "").toLowerCase() !== "read").length,
    [items],
  );

  const headersWithAuth = (extra?: Record<string, string>) => {
    const h: Record<string, string> = { ...(extra || {}) };
    const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
    if (token) h.authorization = `Bearer ${token}`;
    return h;
  };

  const proxyPath = (p: string) => `/api${p}`;

  const fetchEntityNotifications = async () => {
    setLoading(true);
    try {
      const typeKey = entity === "order" ? "order" : entity === "kot" ? "kot" : "inventory";

      const fallbackUrl = NotificationApis.list({
        restaurantId,
        type: typeKey,
        entityType: entity,
        entityId,
        skip: 0,
        limit: 50,
      });

      let url = "";
      if (entity === "order") url = NotificationApis.forOrder(entityId, { restaurantId, skip: 0, limit: 50 });
      if (entity === "kot") url = NotificationApis.forKot(entityId, { restaurantId, skip: 0, limit: 50 });
      if (entity === "inventory_item") url = NotificationApis.forInventoryItem(entityId, { restaurantId, skip: 0, limit: 50 });

      // Prefer scoped endpoints when available, but fall back to /notifications list.
      // In some deployments a missing route or CORS/proxy misconfig can surface as a network error (no response),
      // so we treat that as "scoped unavailable" and fall back.
      let scopedSucceeded = false;
      try {
        const res = await fetch(proxyPath(url), {
          headers: headersWithAuth({ accept: "application/json" }),
          cache: "no-store",
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.status === "success") {
          setItems(data.data?.items || []);
          scopedSucceeded = true;
        }
      } catch (e: any) {
        const status = e?.status;
        if (status && status !== 404) {
          // If scoped returns an actual non-404 error (401/403/500), surface it.
          throw e;
        }
        // 404 or network error: treat scoped as unavailable and fall back.
      }
      if (scopedSucceeded) return;

      const res2 = await fetch(proxyPath(fallbackUrl), {
        headers: headersWithAuth({ accept: "application/json" }),
        cache: "no-store",
      });
      const data2 = await res2.json().catch(() => null);
      if (res2.ok && data2?.status === "success") {
        setItems(data2.data?.items || []);
      } else {
        toast.error(data2?.message || data2?.detail || "Failed to load notifications");
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntityNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity, entityId]);

  const markAllRead = async () => {
    if (!items.length) return;
    setMarking(true);
    try {
      const payload: any = {
        mark_all: true,
        type: entity === "order" ? "order" : entity === "kot" ? "kot" : "inventory",
        entity_type: entity,
        entity_id: entityId,
      };
      const params = new URLSearchParams();
      if (restaurantId) params.set("restaurant_id", String(restaurantId));
      const markReadUrl = `${NotificationApis.markRead}${params.toString() ? `?${params}` : ""}`;

      const res = await fetch(proxyPath(markReadUrl), {
        method: "PATCH",
        headers: headersWithAuth({ "content-type": "application/json", accept: "application/json" }),
        body: JSON.stringify(payload),
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.status === "success") {
        toast.success("Marked as read");
        fetchEntityNotifications();
      } else {
        toast.error(data?.message || data?.detail || "Failed to mark as read");
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to mark as read");
    } finally {
      setMarking(false);
    }
  };

  return (
    <Card className="border-border/40 bg-white dark:bg-[#1a1a1a]">
      <CardContent className="p-0">
        <div className="p-5 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="font-black text-[11px] uppercase tracking-[0.15em] text-muted-foreground">{title}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Bell className="w-4 h-4 opacity-60" />
              <span className="font-semibold">{items.length} notifications</span>
              {unreadCount > 0 ? (
                <Badge className="h-6 rounded-full px-2.5 text-[10px] font-black bg-orange-500/10 text-orange-700 dark:text-orange-500 border-none">
                  {unreadCount} unread
                </Badge>
              ) : (
                <Badge className="h-6 rounded-full px-2.5 text-[10px] font-black bg-emerald-500/10 text-emerald-700 dark:text-emerald-500 border-none">
                  All read
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full text-muted-foreground hover:text-foreground"
              onClick={fetchEntityNotifications}
              disabled={loading}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
            <Button
              variant="secondary"
              className="h-9 rounded-xl font-bold text-xs"
              onClick={markAllRead}
              disabled={marking || items.length === 0 || unreadCount === 0}
            >
              {marking ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Mark Read
            </Button>
          </div>
        </div>

        <Separator />

        <div className="max-h-[320px] overflow-auto no-scrollbar">
          {loading ? (
            <div className="p-6 text-sm text-muted-foreground flex items-center justify-center">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading…
            </div>
          ) : items.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">
              No notifications for this {entity.replace("_", " ")}.
              {entity === "order" ? (
                <span className="block mt-2 opacity-80">
                  Tip: The full order timeline is in the <span className="font-semibold text-foreground">Events</span> tab.
                </span>
              ) : null}
            </div>
          ) : (
            items.map((n) => {
              const isRead = String(n.status || "").toLowerCase() === "read";
              return (
                <div key={n.id} className="px-5 py-4 border-b border-border/30 last:border-none">
                  <div className="flex items-start justify-between gap-6">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-foreground truncate">
                        {n.title || n.event || "Notification"}
                      </p>
                      {n.body ? (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.body}</p>
                      ) : null}
                      <p className="text-[11px] text-muted-foreground/70 font-bold uppercase tracking-wider mt-2">
                        {n.created_at ? format(new Date(n.created_at), "MMM dd, yyyy HH:mm") : "—"}
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className={
                        isRead
                          ? "h-7 px-3 rounded-full text-[10px] font-black uppercase bg-muted text-muted-foreground border-none"
                          : "h-7 px-3 rounded-full text-[10px] font-black uppercase bg-orange-500/10 text-orange-700 dark:text-orange-500 border-none"
                      }
                    >
                      {isRead ? "Read" : "Unread"}
                    </Badge>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
