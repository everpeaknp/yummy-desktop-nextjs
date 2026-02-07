"use client";

import { Receipt, ChefHat, Package, Settings, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppNotification } from "@/hooks/use-notifications";

// ── Helpers ──────────────────────────────────────────────────────────
function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const secs = Math.floor(diffMs / 1000);
  if (secs < 60) return "Just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function titleCase(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function iconForType(type: string) {
  switch (type.toLowerCase()) {
    case "order": return Receipt;
    case "kot": return ChefHat;
    case "inventory": return Package;
    case "system": return Settings;
    default: return Receipt;
  }
}

function accentForType(type: string): string {
  switch (type.toLowerCase()) {
    case "order": return "text-orange-500 bg-orange-500/10";
    case "kot": return "text-blue-600 bg-blue-600/10";
    case "inventory": return "text-green-600 bg-green-600/10";
    case "system": return "text-gray-500 bg-gray-500/10";
    default: return "text-primary bg-primary/10";
  }
}

function dotColorForType(type: string): string {
  switch (type.toLowerCase()) {
    case "order": return "bg-orange-500";
    case "kot": return "bg-blue-600";
    case "inventory": return "bg-green-600";
    default: return "bg-primary";
  }
}

// ── Content extraction (matches Flutter) ─────────────────────────────
interface ContentView {
  header: string;
  subtitle: string | null;
  bodyLines: string[];
}

function extractContent(n: AppNotification): ContentView {
  const payload = n.payload || {};

  if (n.type.toLowerCase() === "order") {
    const orderNumber = payload.order_number?.toString();
    const tableName = payload.table?.name?.toString();
    const headerParts: string[] = [];
    if (orderNumber) headerParts.push(`Order #${orderNumber}`);
    if (tableName) headerParts.push(`Table ${tableName}`);
    const header = headerParts.length > 0 ? headerParts.join(" • ") : "Order update";

    if (n.event === "order.status_changed") {
      const oldStatus = titleCase(payload.old_status?.toString() || "");
      const newStatus = titleCase(payload.new_status?.toString() || "");
      const subtitle = oldStatus || newStatus ? `Status: ${oldStatus} → ${newStatus}` : null;
      const changedBy = payload.changed_by?.name?.toString();
      return { header, subtitle, bodyLines: changedBy ? [`By ${changedBy}`] : [] };
    }

    // Order created / general
    const department = payload.department?.toString();
    const items: { name: string; qty?: number }[] = [];
    if (Array.isArray(payload.items)) {
      for (const item of payload.items) {
        if (item?.name) items.push({ name: item.name, qty: item.qty ? Number(item.qty) : undefined });
      }
    }
    if (payload.items_by_department && typeof payload.items_by_department === "object") {
      for (const dept of Object.values(payload.items_by_department) as any[]) {
        if (Array.isArray(dept)) {
          for (const item of dept) {
            if (item?.name) items.push({ name: item.name, qty: item.qty ? Number(item.qty) : undefined });
          }
        }
      }
    }
    const itemCount = payload.totals?.item_count ? Number(payload.totals.item_count) : items.length;
    const subtitleParts: string[] = [];
    if (department && department !== "all") subtitleParts.push(titleCase(department));
    if (itemCount > 0) subtitleParts.push(`${itemCount} ${itemCount === 1 ? "item" : "items"}`);
    const subtitle = subtitleParts.join(" • ") || null;

    const bodyLines: string[] = [];
    const displayCount = Math.min(items.length, 2);
    for (let i = 0; i < displayCount; i++) {
      const item = items[i];
      bodyLines.push(`${item.name}${item.qty ? ` x${item.qty}` : ""}`);
    }
    if (items.length > displayCount) bodyLines.push(`+${items.length - displayCount} more`);

    return { header, subtitle, bodyLines };
  }

  // Generic (kot, inventory, system)
  return {
    header: n.title || "Notification",
    subtitle: n.body || null,
    bodyLines: [],
  };
}

// ── Component ────────────────────────────────────────────────────────
export function NotificationCard({ notification }: { notification: AppNotification }) {
  const Icon = iconForType(notification.type);
  const accent = accentForType(notification.type);
  const dotColor = dotColorForType(notification.type);
  const content = extractContent(notification);
  const isUnread = notification.read_at === null;

  return (
    <div className={cn(
      "flex gap-3 px-4 py-3 transition-colors hover:bg-muted/50 cursor-pointer border-b border-border/40 last:border-b-0",
      isUnread && "bg-muted/30"
    )}>
      {/* Icon */}
      <div className={cn("flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center", accent)}>
        <Icon className="h-5 w-5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold truncate">{content.header}</p>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">
              {relativeTime(notification.created_at)}
            </span>
            {isUnread && <div className={cn("w-2 h-2 rounded-full", dotColor)} />}
          </div>
        </div>

        {content.subtitle && (
          <p className="text-xs font-medium text-muted-foreground mt-0.5">{content.subtitle}</p>
        )}

        {content.bodyLines.length > 0 && (
          <div className="mt-1.5 space-y-0.5">
            {content.bodyLines.map((line, i) => (
              <p key={i} className="text-xs text-muted-foreground/80">{line}</p>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1.5 mt-1.5">
          <Clock className="h-3 w-3 text-muted-foreground/60" />
          <span className="text-[11px] text-muted-foreground/60">{formatDate(notification.created_at)}</span>
          {notification.event && (
            <>
              <span className="text-[11px] text-muted-foreground/40">•</span>
              <span className="text-[11px] text-muted-foreground/60 truncate">
                {notification.event.replaceAll("_", " ")}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
