import { BedDouble, CalendarClock, CheckCircle2, CircleUserRound, Hash, MapPin, ShoppingBag, Truck, XCircle, Zap } from "lucide-react";
import type { Order } from "@/types/order";
import { cn } from "@/lib/utils";
import { useRestaurant } from "@/hooks/use-restaurant";

interface OrderHistoryCardProps {
  order: Order;
}

function paymentLabel(order: Order) {
  const payments = Array.isArray(order.payments) ? order.payments : [];
  const paid = payments.filter((payment) => payment.status !== "failed" && payment.status !== "refunded");
  if (!paid.length) return "Unpaid";
  const methods = Array.from(new Set(paid.map((payment) => String(payment.method || "").toLowerCase())))
    .filter(Boolean)
    .map((method) => method === "quick_billing" ? "Quick bill" : method === "fonepay" ? "Fonepay" : method === "digital" ? "Digital" : method.charAt(0).toUpperCase() + method.slice(1));
  return methods.length ? methods.join(" + ") : "Paid";
}

function statusMeta(status: string) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "canceled" || normalized === "cancelled") {
    return { label: "Cancelled", tone: "border-red-200 bg-red-50 text-red-600", icon: XCircle };
  }
  if (normalized === "completed") {
    return { label: "Completed", tone: "border-emerald-200 bg-emerald-50 text-emerald-700", icon: CheckCircle2 };
  }
  return { label: normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : "Closed", tone: "border-slate-200 bg-slate-50 text-slate-600", icon: CalendarClock };
}

function channelIcon(channel: string) {
  switch (String(channel || "").toLowerCase()) {
    case "table": return MapPin;
    case "pickup": return ShoppingBag;
    case "quick_billing": return Zap;
    case "delivery": return Truck;
    case "room_service": return BedDouble;
    default: return Hash;
  }
}

export function OrderHistoryCard({ order }: OrderHistoryCardProps) {
  const restaurant = useRestaurant((state) => state.restaurant);
  const status = statusMeta(order.status);
  const StatusIcon = status.icon;
  const ChannelIcon = channelIcon(order.channel);
  const items = Array.isArray(order.items) ? order.items : [];
  const itemCount = items.reduce((total, item) => total + Number(item.qty ?? item.quantity ?? 0), 0);
  const shownItems = items.slice(0, 3).map((item) => item.name_snapshot || item.item_name || "Item");
  const moreItems = Math.max(0, items.length - shownItems.length);
  const rawDate = (order as any).completed_at || (order as any).canceled_at || order.updated_at || order.created_at;
  const date = rawDate ? new Date(rawDate) : null;
  const timeLabel = date && !Number.isNaN(date.getTime())
    ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : "—";
  const tableLabel = order.table_name || (order.channel === "table" ? "Table order" : "Order");
  const orderNumber = order.restaurant_order_id || order.id;
  const customer = order.customer_name || (order.channel === "table" ? "Walk-in guest" : "Walk-in");
  const currency = (restaurant as any)?.currency || "Rs.";

  return (
    <article className="group relative flex h-[330px] flex-col overflow-hidden rounded-2xl border border-border/70 bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg sm:h-[340px]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted/70 text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
            <ChannelIcon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-[17px] font-bold leading-6 text-foreground">{tableLabel}</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">Order #{orderNumber}</p>
          </div>
        </div>
        <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", status.tone)}>
          <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
          {status.label}
        </span>
      </div>

      <div className="mt-4 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
        <CircleUserRound className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">{customer}</span>
        <span aria-hidden="true" className="text-muted-foreground/50">•</span>
        <span className="shrink-0">{timeLabel}</span>
        <span aria-hidden="true" className="text-muted-foreground/50">•</span>
        <span className="truncate">{paymentLabel(order)}</span>
      </div>

      <div className="mt-4 h-[64px] shrink-0 overflow-hidden border-t border-dashed border-border/70 pt-3">
        {shownItems.length ? (
          <p className="line-clamp-2 text-sm leading-6 text-foreground/85">
            {shownItems.join(", ")}{moreItems > 0 ? ` +${moreItems} more` : ""}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">No items recorded</p>
        )}
      </div>

      <div className="mt-auto flex items-end justify-between border-t border-border/70 pt-3">
        <span className="text-sm text-muted-foreground">{itemCount} {itemCount === 1 ? "item" : "items"}</span>
        <span className="text-lg font-bold tracking-tight text-foreground">{currency} {Number(order.grand_total || 0).toLocaleString()}</span>
      </div>
    </article>
  );
}
