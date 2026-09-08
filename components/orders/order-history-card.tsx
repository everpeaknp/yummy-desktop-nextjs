import { BedDouble, CalendarClock, CheckCircle2, CircleUserRound, Hash, MapPin, ShoppingBag, Truck, XCircle, Zap } from "lucide-react";
import type { Order } from "@/types/order";
import { cn } from "@/lib/utils";
import { useRestaurant } from "@/hooks/use-restaurant";
import type { FinanceOrderSettlementSummary } from "@/types/finance-sales";

interface OrderHistoryCardProps {
  order: Order;
  settlement?: FinanceOrderSettlementSummary | null;
}

function settlementMeta(order: Order, settlement?: FinanceOrderSettlementSummary | null) {
  const payments = Array.isArray(order.payments) ? order.payments : [];
  const successful = payments.filter((payment) => payment.status !== "failed" && payment.status !== "refunded");
  const methods = new Set(successful.map((payment) => String(payment.method || "").toLowerCase()));
  if (methods.has("room_charge")) {
    return { label: "Charged to room", balanceDue: 0, tone: "border-blue-200 bg-blue-50 text-blue-700" };
  }

  if (settlement) {
    const status = String(settlement.settlement_status || "unpaid").toLowerCase();
    if (status === "returned") {
      return { label: "Returned", balanceDue: 0, tone: "border-rose-200 bg-rose-50 text-rose-700" };
    }
    if (status === "partially_returned") {
      return { label: "Partially returned", balanceDue: Number(settlement.balance_due || 0), tone: "border-orange-200 bg-orange-50 text-orange-700" };
    }
    if (status === "paid") {
      return { label: "Paid", balanceDue: 0, tone: "border-emerald-200 bg-emerald-50 text-emerald-700" };
    }
    if (status === "partially_paid") {
      return { label: "Partially paid", balanceDue: Number(settlement.balance_due || 0), tone: "border-orange-200 bg-orange-50 text-orange-700" };
    }
    return { label: "Unpaid", balanceDue: Number(settlement.balance_due || order.grand_total || 0), tone: "border-orange-200 bg-orange-50 text-orange-700" };
  }

  const collected = successful
    .filter((payment) => !["credit", "room_charge"].includes(String(payment.method || "").toLowerCase()))
    .reduce((sum, payment) => sum + Math.max(0, Number(payment.amount || 0)), 0);
  const total = Number(order.grand_total || 0);
  if (collected >= total - 0.01) {
    return { label: "Paid", balanceDue: 0, tone: "border-emerald-200 bg-emerald-50 text-emerald-700" };
  }
  if (collected > 0) {
    return { label: "Partially paid", balanceDue: Math.max(0, total - collected), tone: "border-orange-200 bg-orange-50 text-orange-700" };
  }
  return { label: "Unpaid", balanceDue: total, tone: "border-orange-200 bg-orange-50 text-orange-700" };
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

export function OrderHistoryCard({ order, settlement }: OrderHistoryCardProps) {
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
  const payment = settlementMeta(order, settlement);

  return (
    <article className="group relative flex min-h-[224px] flex-col overflow-hidden rounded-xl border border-border/70 bg-card p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg sm:h-[340px] sm:rounded-2xl sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/70 text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary sm:h-11 sm:w-11 sm:rounded-xl">
            <ChannelIcon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold leading-5 text-foreground sm:text-[17px] sm:leading-6">{tableLabel}</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">Order #{orderNumber}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", status.tone)}>
            <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {status.label}
          </span>
          {String(order.status).toLowerCase() === "completed" && (
            <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold", payment.tone)}>
              {payment.label}
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
        <CircleUserRound className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">{customer}</span>
        <span aria-hidden="true" className="text-muted-foreground/50">•</span>
        <span className="shrink-0">{timeLabel}</span>
      </div>

      <div className="mt-3 h-[44px] shrink-0 overflow-hidden border-t border-dashed border-border/70 pt-2 sm:mt-4 sm:h-[64px] sm:pt-3">
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
        <div className="text-right">
          {payment.balanceDue > 0 && String(order.status).toLowerCase() === "completed" && (
            <p className="mb-0.5 text-xs font-semibold text-orange-700">
              {currency} {payment.balanceDue.toLocaleString()} due
            </p>
          )}
          <span className="text-base font-bold tracking-tight text-foreground sm:text-lg">{currency} {Number(order.grand_total || 0).toLocaleString()}</span>
        </div>
      </div>
    </article>
  );
}
