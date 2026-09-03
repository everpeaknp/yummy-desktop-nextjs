import { Badge } from "@/components/ui/badge";
import { Order } from "@/types/order";
import { Clock, Utensils, MapPin, ShoppingBag, Zap, Calendar, Truck, User, BedDouble, CheckCircle2 } from "lucide-react";
import { useRestaurant } from "@/hooks/use-restaurant";
import { cn } from "@/lib/utils";

interface OrderCardProps {
  order: Order;
  onClick?: () => void;
}

const statusStyles: Record<string, { badge: string; border: string; dot: string }> = {
  pending: { badge: "bg-blue-50 text-blue-700 border-blue-200", border: "border-l-blue-500", dot: "bg-blue-500" },
  confirmed: { badge: "bg-blue-50 text-blue-700 border-blue-200", border: "border-l-blue-500", dot: "bg-blue-500" },
  running: { badge: "bg-blue-50 text-blue-700 border-blue-200", border: "border-l-blue-500", dot: "bg-blue-500" },
  scheduled: { badge: "bg-indigo-50 text-indigo-700 border-indigo-200", border: "border-l-indigo-500", dot: "bg-indigo-500" },
  requested: { badge: "bg-indigo-50 text-indigo-700 border-indigo-200", border: "border-l-indigo-500", dot: "bg-indigo-500" },
  preparing: { badge: "bg-amber-50 text-amber-700 border-amber-200", border: "border-l-amber-500", dot: "bg-amber-500" },
  ready: { badge: "bg-emerald-50 text-emerald-700 border-emerald-200", border: "border-l-emerald-500", dot: "bg-emerald-500" },
  ready_for_pickup: { badge: "bg-emerald-50 text-emerald-700 border-emerald-200", border: "border-l-emerald-500", dot: "bg-emerald-500" },
  out_for_delivery: { badge: "bg-amber-50 text-amber-700 border-amber-200", border: "border-l-amber-500", dot: "bg-amber-500" },
  completed: { badge: "bg-emerald-50 text-emerald-700 border-emerald-200", border: "border-l-emerald-500", dot: "bg-emerald-500" },
  canceled: { badge: "bg-slate-50 text-slate-600 border-slate-200", border: "border-l-slate-400", dot: "bg-slate-400" },
  cancelled: { badge: "bg-slate-50 text-slate-600 border-slate-200", border: "border-l-slate-400", dot: "bg-slate-400" },
};

export const getStatusColor = (status: string) => statusStyles[String(status).toLowerCase()]?.badge || "bg-muted text-muted-foreground border-border";
export const getStatusBadgeColor = getStatusColor;

export const getChannelIcon = (channel: string) => {
  switch (String(channel).toLowerCase()) {
    case "table": return MapPin;
    case "pickup": return ShoppingBag;
    case "quick_billing": return Zap;
    case "delivery": return Truck;
    case "reservation": return Calendar;
    case "room_service": return BedDouble;
    default: return Utensils;
  }
};

function elapsedLabel(raw: string | undefined, terminal: boolean) {
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  const end = terminal ? date : new Date();
  const minutes = Math.max(0, Math.floor((end.getTime() - date.getTime()) / 60000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}h${remainder ? ` ${remainder}m` : ""}`;
}

export function OrderCard({ order, onClick }: OrderCardProps) {
  const currency = useRestaurant((s) => s.restaurant?.currency || "Rs.");
  const status = String(order.status || "pending").toLowerCase();
  const style = statusStyles[status] || statusStyles.pending;
  const ChannelIcon = getChannelIcon(order.channel);
  const terminal = status === "completed" || status === "canceled" || status === "cancelled";
  const rawOrder = order as any;
  const timestamp = terminal ? rawOrder.completed_at || rawOrder.canceled_at || order.updated_at : rawOrder.started_at || order.created_at;
  const title = order.table_name
    ? order.table_name
    : order.channel === "room_service"
      ? "Room service"
      : `Order #${order.restaurant_order_id || order.id}`;
  const orderNumber = order.restaurant_order_id || order.id;
  const titleIsOrderNumber = title === `Order #${orderNumber}`;
  const channelLabel = order.channel === "table" ? "Dine-in" : String(order.channel || "").replace(/_/g, " ");
  const customer = order.customer_name || (order.channel === "table" ? "Walk-in guest" : "Walk-in");
  const items = Array.isArray(order.items) ? order.items : [];
  // Legacy responses use `quantity`; current responses use `qty`.
  const itemQuantity = (item: any) => {
    const value = Number(item?.qty ?? item?.quantity ?? 0);
    return Number.isFinite(value) && value > 0 ? value : 0;
  };
  const itemLineCount = items.length;
  const itemQuantityTotal = items.reduce((sum, item) => sum + itemQuantity(item), 0);
  const readyCount = items.reduce((sum, item) => {
    const quantity = itemQuantity(item);
    const readyValue = Number(
      (item as any).qty_ready ??
      (item as any).fulfilled_qty ??
      (((item as any).status || "").toLowerCase() === "ready" ? quantity : 0),
    );
    const ready = Number.isFinite(readyValue) ? readyValue : 0;
    return sum + Math.min(quantity, Math.max(0, ready));
  }, 0);
  const paid = (order.payments || []).filter((p) => p.status !== "failed" && p.status !== "refunded").reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const balance = Math.max(0, Number(order.grand_total || 0) - paid);
  const displayItems = items.filter((item) => !String(item.name_snapshot || item.item_name || "").toLowerCase().includes("room charge"));
  const previewItems = displayItems.slice(0, 5);

  return (
    <article
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(event) => { if (onClick && (event.key === "Enter" || event.key === " ")) onClick(); }}
      className={cn(
        "group relative h-[330px] sm:h-[340px] overflow-hidden rounded-2xl border border-border/70 border-l-4 bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg",
        onClick && "cursor-pointer",
        style.border,
      )}
    >
      <div className="flex h-full flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1.5 flex items-center gap-2">
              <span className={cn("h-2 w-2 shrink-0 rounded-full", style.dot)} />
              <Badge variant="outline" className={cn("h-6 rounded-md px-2 text-[10px] font-bold uppercase tracking-wide", style.badge)}>
                {status === "requested" ? "Pending" : status}
              </Badge>
              <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> {elapsedLabel(timestamp, terminal)}
              </span>
            </div>
            <h3 className="truncate text-base font-bold text-foreground">{title}</h3>
            {!titleIsOrderNumber && <p className="mt-0.5 text-xs font-medium text-muted-foreground">Order #{orderNumber}</p>}
          </div>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted/70 text-muted-foreground">
            <ChannelIcon className="h-4 w-4" />
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <User className="h-3.5 w-3.5" /> <span className="max-w-[55%] truncate">{customer}</span>
          <span className="text-border">•</span>
          <span className="truncate capitalize">{channelLabel}</span>
        </div>

        <div className="mt-3 flex h-[128px] shrink-0 flex-col border-t border-dashed border-border/70 pt-3">
          <div className="space-y-1">
          {previewItems.length ? previewItems.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-2 text-[13px] leading-4">
              <span className="truncate text-foreground">{item.name_snapshot || item.item_name || "Item"}</span>
              <span className="shrink-0 font-semibold text-muted-foreground">×{itemQuantity(item)}</span>
            </div>
          )) : <span className="text-xs text-muted-foreground">No items recorded</span>}
          </div>
        </div>

        {itemQuantityTotal > 0 && !terminal && (
          <div className="mt-1 flex items-center justify-between text-xs font-semibold">
            <span className={cn("flex items-center gap-1", readyCount === itemQuantityTotal ? "text-emerald-600" : "text-blue-600")}>
              {readyCount === itemQuantityTotal && <CheckCircle2 className="h-3.5 w-3.5" />}
              {readyCount}/{itemQuantityTotal} ready
            </span>
            <span className={balance > 0 ? "text-muted-foreground" : "text-emerald-600"}>{balance > 0 ? "Unpaid" : "Paid"}</span>
          </div>
        )}

        <div className="mt-2 flex items-center justify-between border-t border-border/70 pt-2">
          <span className="text-xs font-semibold text-muted-foreground">{itemLineCount} item{itemLineCount === 1 ? "" : "s"}</span>
          <span className="text-base font-black text-foreground">{currency} {Number(order.grand_total || 0).toLocaleString()}</span>
        </div>
      </div>
    </article>
  );
}
