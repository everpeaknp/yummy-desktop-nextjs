import { AlertTriangle, CheckCircle2, Clock, Loader2 } from "lucide-react";
import Link from "next/link";
import { formatDateTime } from "@/lib/utils";
import { useEffect, useId, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface KitchenTicketItem {
  id: number | string;
  item_name: string;
  qty_change: number;
  qty_ready?: number;
  qty_served?: number;
  notes?: string | null;
  modifiers?: {
    id?: number | string;
    modifier_name_snapshot?: string;
    modifier_name?: string;
  }[];
  is_deleted?: number | boolean;
  deleted_qty?: number;
  item_status?: string;
}

export interface KitchenTicket {
  id: number;
  kot_number?: string | number | null;
  station?: string;
  type?: string;
  status: string;
  order_id?: number;
  items: KitchenTicketItem[];
  created_at?: string;
  order_created_at?: string;
  table_name?: string;
  table_category?: string;
  customer_name?: string;
  restaurant_order_id?: number;
  created_by_staff_name?: string;
  order?: { business_line?: string };
}

export interface KitchenTicketPrimaryAction {
  label: string;
  onClick: () => void;
}

const TERMINAL_STATUSES = new Set(["SERVED", "REJECTED"]);

export function kotStatusLabel(status: string): string {
  switch (String(status || "").toUpperCase()) {
    case "PENDING":
      return "New";
    case "ACKNOWLEDGED":
      return "Acknowledged";
    case "PREPARING":
      return "Preparing";
    case "PARTIAL":
      return "Partially ready";
    case "READY":
      return "Ready";
    case "SERVED":
      return "Completed";
    case "REJECTED":
    case "CANCELLED":
      return "Rejected";
    default:
      return String(status || "Unknown")
        .replace(/[._-]+/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
}

export function humanizeKotStation(station?: string): string {
  const normalized = String(station || "").trim();
  if (!normalized) return "Kitchen";
  return normalized
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/**
 * KOT type is the batch origin, not the ticket lifecycle status. The backend
 * emits INITIAL for the order's first batch and ADD for later order lines.
 */
export function kotTypeLabel(type?: string): string | undefined {
  switch (
    String(type || "")
      .trim()
      .toUpperCase()
  ) {
    case "INITIAL":
      return "Initial ticket";
    case "ADD":
      return "Additional items";
    case "REMOVE":
      return "Removed items";
    default:
      return undefined;
  }
}

export function formatKotElapsedTime(
  timestamp?: string,
  status?: string,
): string {
  if (!timestamp || TERMINAL_STATUSES.has(String(status || "").toUpperCase()))
    return "";
  const elapsed = Date.now() - new Date(timestamp).getTime();
  if (!Number.isFinite(elapsed) || elapsed < 0) return "";
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d`;
}

export function isKotDelayed(
  ticket: Pick<KitchenTicket, "created_at" | "order_created_at" | "status">,
): boolean {
  const timestamp = ticket.created_at || ticket.order_created_at;
  if (!timestamp) return false;
  const elapsed = Date.now() - new Date(timestamp).getTime();
  return (
    elapsed >= 20 * 60 * 1000 &&
    !TERMINAL_STATUSES.has(String(ticket.status || "").toUpperCase())
  );
}

export function humanizeKotEvent(event?: string): string {
  const normalized = String(event || "")
    .trim()
    .toLowerCase();
  const labels: Record<string, string> = {
    "kot.created": "Ticket created",
    kot_created: "Ticket created",
    "kot.status_changed": "Ticket status changed",
    "kot.force_completed": "Ticket completed",
    "kot.item_cancelled": "Item cancelled",
    "kot.item_ready_updated": "Item readiness updated",
    "kot.item_served_updated": "Item served updated",
    "kot.items_marked": "Items updated",
    "kot.item_marked_all": "Item updated",
    "kot.item_accepted": "Item accepted",
    "kot.item_rejected": "Item rejected",
    kot_rejected: "Ticket rejected",
  };
  if (labels[normalized]) return labels[normalized];
  return (normalized || "ticket updated")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function kotItemProgressLabel(item: KitchenTicketItem): string {
  const ordered = Math.abs(Number(item.qty_change || 0));
  if (Boolean(item.is_deleted)) return Number(item.deleted_qty || 0) > 0 ? "Cancelled" : "Rejected";
  if (ordered > 0 && Number(item.qty_served || 0) >= ordered) return "Served";
  if (ordered > 0 && Number(item.qty_ready || 0) >= ordered) return "Ready";
  if (Number(item.qty_ready || 0) > 0 || Number(item.qty_served || 0) > 0)
    return "Partially ready";
  if (String(item.item_status || "").toUpperCase() === "PREPARING") return "Preparing";
  return "Waiting";
}

function itemProgressClass(label: string): string {
  if (label === "Ready") return "text-emerald-700 dark:text-emerald-400";
  if (label === "Served") return "text-muted-foreground";
  if (label === "Rejected" || label === "Cancelled") return "text-destructive";
  if (label === "Partially ready") return "text-amber-700 dark:text-amber-400";
  return "text-muted-foreground";
}

function ticketReference(ticket: KitchenTicket): string {
  const orderId = ticket.restaurant_order_id || ticket.order_id;
  return orderId ? `Order #${orderId}` : "Order";
}

function serviceContext(ticket: KitchenTicket): string | undefined {
  if (ticket.order?.business_line === "hotel")
    return ticket.table_name || "Room service";
  return ticket.table_name || ticket.customer_name || kotTypeLabel(ticket.type);
}

export function KotTicketMeta({ ticket, compact = false }: { ticket: KitchenTicket; compact?: boolean }) {
  return (
    <dl className={cn("grid gap-3 border-y border-border/60 py-4 text-sm", compact ? "sm:grid-cols-2" : "sm:grid-cols-3")}>
      <div className="min-w-0 sm:border-r sm:border-border/60 sm:pr-4">
        <dt className="text-xs text-muted-foreground">Created</dt>
        <dd className="mt-1 font-semibold text-foreground">{ticket.created_at ? formatDateTime(ticket.created_at) : "Unknown"}</dd>
      </div>
      <div className={cn("min-w-0", !compact && "sm:border-r sm:border-border/60 sm:pr-4")}>
        <dt className="text-xs text-muted-foreground">Recorded by</dt>
        <dd className="mt-1 break-words font-semibold text-foreground">{ticket.created_by_staff_name || "Unknown"}</dd>
      </div>
      {!compact ? <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">Order</dt>
        <dd className="mt-1 font-semibold">{ticket.order_id ? <Link className="rounded-sm text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" href={`/orders/${ticket.order_id}`}>Order #{ticket.restaurant_order_id || ticket.order_id}</Link> : "Unknown"}</dd>
      </div> : null}
    </dl>
  );
}

export interface KotActivityEntry {
  id: number;
  event: string;
  actor_name?: string | null;
  actor_role?: string | null;
  created_at?: string | null;
  change_field?: string | null;
  new_value?: Record<string, unknown> | null;
}

export function KotTicketActivity({ entries, loading }: { entries: KotActivityEntry[]; loading: boolean }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-border/60 bg-card">
      <div className="border-b border-border/60 px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">Activity</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Changes to this ticket</p>
      </div>
      {loading ? <p className="px-4 py-6 text-sm text-muted-foreground">Loading activity…</p> : entries.length === 0 ? <p className="px-4 py-6 text-sm text-muted-foreground">No activity recorded yet.</p> : (
        <ol className="divide-y divide-border/50">
          {entries.map((entry) => <li key={entry.id} className="flex min-w-0 flex-col gap-1 px-4 py-3 sm:flex-row sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{humanizeKotEvent(entry.event)}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{entry.actor_name || entry.actor_role || "System"}{entry.change_field ? ` · ${entry.change_field}` : ""}</p>
              {entry.new_value?.reason ? <p className="mt-1 break-words text-xs text-muted-foreground">Reason: {String(entry.new_value.reason)}</p> : null}
              {entry.new_value?.status ? <p className="mt-1 text-xs text-muted-foreground">Status: {kotStatusLabel(String(entry.new_value.status))}</p> : null}
            </div>
            <time dateTime={entry.created_at || undefined} className="shrink-0 text-xs text-muted-foreground">{entry.created_at ? formatDateTime(entry.created_at) : "Unknown time"}</time>
          </li>)}
        </ol>
      )}
    </section>
  );
}

export function KotTicketDetail({
  ticket,
  actions,
  printEvents,
  items,
  activity,
  activityLoading,
  activityAction,
  onClose,
}: {
  ticket: KitchenTicket;
  actions?: ReactNode;
  printEvents?: ReactNode;
  items: ReactNode;
  activity: KotActivityEntry[];
  activityLoading: boolean;
  activityAction?: ReactNode;
  onClose: () => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const itemCount = ticket.items.filter(
    (item) => !item.is_deleted && !String(item.item_name || "").toLowerCase().includes("room charge") && Math.abs(Number(item.qty_change || 0)) > 0,
  ).length;

  return (
    <DialogContent aria-labelledby={titleId} aria-describedby={descriptionId} className="flex h-[100dvh] w-full max-w-none min-w-0 flex-col gap-0 overflow-hidden rounded-none border-border bg-card p-0 sm:h-auto sm:max-h-[min(88vh,800px)] sm:w-[calc(100vw-3rem)] sm:max-w-[900px] sm:rounded-2xl">
      <DialogHeader className="shrink-0 border-b border-border/60 p-0 text-left">
        <div className="pr-12 sm:pr-14"><KotTicketHeader ticket={ticket} delayed={isKotDelayed(ticket)} /></div>
        <DialogTitle id={titleId} className="sr-only">KOT #{ticket.kot_number || ticket.id} details</DialogTitle>
        <DialogDescription id={descriptionId} className="sr-only">Kitchen ticket items and activity</DialogDescription>
      </DialogHeader>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">
        <KotTicketMeta ticket={ticket} />
        {actions ? <div className="mt-4 flex flex-wrap items-center gap-2">{actions}</div> : null}
        {printEvents}
        <div className="mt-5 grid min-w-0 grid-cols-1 items-start gap-5 lg:grid-cols-2">
          <section className="min-w-0 overflow-hidden rounded-xl border border-border/60 bg-card">
            <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
              <h3 className="text-sm font-semibold text-foreground">Items to prepare</h3>
              <span className="text-xs font-medium tabular-nums text-muted-foreground">{itemCount} {itemCount === 1 ? "item" : "items"}</span>
            </div>
            {items}
          </section>
          <div className="min-w-0 space-y-2">
            {activityAction ? <div className="flex justify-end">{activityAction}</div> : null}
            <KotTicketActivity entries={activity} loading={activityLoading} />
          </div>
        </div>
      </div>
      <DialogFooter className="shrink-0 border-t border-border/60 bg-muted/20 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-5">
        <Button type="button" variant="outline" className="h-10 w-full sm:w-auto" onClick={onClose}>Close</Button>
      </DialogFooter>
    </DialogContent>
  );
}

export function KotTicketStatusBadge({
  status,
  delayed,
}: {
  status: string;
  delayed: boolean;
}) {
  const normalized = String(status || "").toUpperCase();
  const colors = delayed
    ? "border-destructive/25 bg-destructive/10 text-destructive"
    : normalized === "PENDING"
      ? "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-400"
      : normalized === "PREPARING" || normalized === "PARTIAL"
        ? "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400"
        : normalized === "READY"
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          : normalized === "SERVED"
            ? "border-border bg-muted text-muted-foreground"
            : "border-destructive/25 bg-destructive/10 text-destructive";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold",
        colors,
      )}
    >
      {delayed ? (
        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
      ) : null}
      {delayed ? "Delayed" : kotStatusLabel(status)}
    </span>
  );
}

function KotElapsedTimeBadge({
  ticket,
  elapsed,
  delayed,
}: {
  ticket: KitchenTicket;
  elapsed?: string;
  delayed: boolean;
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(
      () => setTick((value) => value + 1),
      30000,
    );
    return () => window.clearInterval(timer);
  }, []);

  const resolvedElapsed =
    elapsed ??
    formatKotElapsedTime(
      ticket.created_at || ticket.order_created_at,
      ticket.status,
    );
  if (!resolvedElapsed) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-bold tabular-nums",
        delayed
          ? "bg-destructive/10 text-destructive"
          : "bg-muted text-foreground",
      )}
      aria-label={`Elapsed time ${resolvedElapsed}`}
    >
      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
      {resolvedElapsed}
    </span>
  );
}

export function KotTicketHeader({
  ticket,
  elapsed,
  delayed,
  compact = false,
}: {
  ticket: KitchenTicket;
  elapsed?: string;
  delayed: boolean;
  compact?: boolean;
}) {
  const service = serviceContext(ticket);
  return (
    <header
      className={cn(
        "min-w-0",
        compact ? "px-3 py-3" : "px-4 py-4 sm:px-5",
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cn("font-bold tracking-tight text-foreground", compact ? "text-sm" : "text-lg")}>
            KOT #{ticket.kot_number || ticket.id}
          </p>
          <p className="mt-1 truncate text-xs font-medium text-muted-foreground">
            {ticketReference(ticket)}
            {service ? ` · ${service}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <KotElapsedTimeBadge
            ticket={ticket}
            elapsed={elapsed}
            delayed={delayed}
          />
          <KotTicketStatusBadge status={ticket.status} delayed={delayed} />
        </div>
      </div>
      <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="rounded-md bg-muted px-2 py-1 font-medium text-foreground">
          {humanizeKotStation(ticket.station)}
        </span>
        {ticket.table_category ? <span>{ticket.table_category}</span> : null}
      </div>
    </header>
  );
}

export function KotTicketItemList({
  items,
  limit,
  compact = false,
  showProgress = false,
  renderAction,
}: {
  items: KitchenTicketItem[];
  limit?: number;
  compact?: boolean;
  showProgress?: boolean;
  renderAction?: (item: KitchenTicketItem) => ReactNode;
}) {
  const visibleItems = items.filter(
    (item) =>
      Number(item.qty_change || 0) > 0 &&
      !Boolean(item.is_deleted) &&
      !String(item.item_name || "")
        .toLowerCase()
        .includes("room charge"),
  );
  const cancelledItems = items.filter(
    (item) => Number(item.deleted_qty || 0) > 0 &&
      !String(item.item_name || "").toLowerCase().includes("room charge"),
  );
  const displayedItems = limit ? visibleItems.slice(0, limit) : visibleItems;

  return (
    <div className="divide-y divide-border/45">
      {visibleItems.length === 0 ? <p className="px-4 py-6 text-sm text-muted-foreground sm:px-5">No active items on this ticket.</p> : null}
      {displayedItems.map((item) => {
        const itemStatus = kotItemProgressLabel(item);
        const quantity = Math.abs(Number(item.qty_change || 0));
        const action = renderAction?.(item);
        return (
          <div
            key={item.id}
            className={cn(
              "min-w-0 px-4 py-3.5 sm:px-5",
              compact && "px-3 py-2.5",
              Boolean(item.is_deleted) && "bg-destructive/5 opacity-75",
            )}
          >
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start">
              <div className="flex min-w-0 flex-1 items-start gap-2">
                <span className="min-w-8 pt-px text-base font-bold tabular-nums text-foreground">
                  {quantity}×
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "break-words text-[15px] font-semibold leading-snug text-foreground",
                      Boolean(item.is_deleted) &&
                        "line-through decoration-destructive",
                    )}
                  >
                    {item.item_name}
                  </p>
                  {item.modifiers?.length ? (
                    <ul className="mt-1.5 space-y-0.5 text-xs leading-snug text-muted-foreground">
                      {item.modifiers.map((modifier, index) => (
                        <li key={modifier.id ?? `${item.id}-${index}`}>
                          •{" "}
                          {modifier.modifier_name_snapshot ||
                            modifier.modifier_name ||
                            "Modifier"}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {item.notes ? (
                    <p className="mt-2 break-words border-l-2 border-amber-500/70 pl-2 text-xs font-medium leading-snug text-foreground">
                      <span className="mr-1 text-[10px] font-bold text-amber-700 dark:text-amber-400">
                        NOTE
                      </span>
                      {item.notes}
                    </p>
                  ) : null}
                  {showProgress && quantity > 0 ? (
                    <p className="mt-2 text-xs tabular-nums text-muted-foreground">
                      Ready: {item.qty_ready || 0} · Served: {item.qty_served || 0}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">
                <span
                  className={cn(
                    "text-[11px] font-medium",
                    itemProgressClass(itemStatus),
                  )}
                >
                  {itemStatus}
                </span>
                {itemStatus === "Ready" ? (
                  <CheckCircle2
                    className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                    aria-hidden="true"
                  />
                ) : null}
              </div>
            </div>
            {action ? <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-border/45 pt-3">{action}</div> : null}
          </div>
        );
      })}
      {visibleItems.length > displayedItems.length ? (
        <p className="px-4 py-3 text-xs font-medium text-muted-foreground sm:px-5">
          +{visibleItems.length - displayedItems.length} more items
        </p>
      ) : null}
      {!compact && cancelledItems.length > 0 ? (
        <div className="px-4 py-3 text-xs text-destructive sm:px-5">
          <p className="mb-2 font-semibold">Cancelled from this ticket</p>
          {cancelledItems.map((item) => (
            <p key={`cancelled-${item.id}`} className="flex justify-between gap-3 py-0.5">
              <span className="min-w-0 break-words">{item.item_name}</span>
              <span className="shrink-0 tabular-nums">-{item.deleted_qty}</span>
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function KOTTicketCard({
  kot,
  elapsed,
  delayed,
  isUpdating,
  primaryAction,
  onReject,
  onOpenDetails,
}: {
  kot: KitchenTicket;
  elapsed: string;
  delayed: boolean;
  isUpdating: boolean;
  primaryAction?: KitchenTicketPrimaryAction | null;
  onReject?: () => void;
  onOpenDetails: () => void;
}) {
  const isTerminal = TERMINAL_STATUSES.has(
    String(kot.status || "").toUpperCase(),
  );
  const itemCount = kot.items.filter(
    (item) =>
      Number(item.qty_change || 0) > 0 &&
      !Boolean(item.is_deleted) &&
      !String(item.item_name || "")
        .toLowerCase()
        .includes("room charge"),
  ).length;

  return (
    <article
      className={cn(
        "relative flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card shadow-sm",
        "transition-[border-color,box-shadow] duration-200 hover:border-primary/35 hover:shadow-md",
        delayed ? "border-destructive/40" : "border-border/70",
      )}
    >
      {isUpdating ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/65 backdrop-blur-[1px]">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="sr-only">Updating kitchen ticket</span>
        </div>
      ) : null}
      <button
        type="button"
        className="min-w-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
        onClick={onOpenDetails}
        aria-label={`Open KOT ${kot.kot_number || kot.id} details`}
      >
        <div className="border-b border-dashed border-border/70">
          <KotTicketHeader ticket={kot} elapsed={elapsed} delayed={delayed} />
        </div>
        <KotTicketItemList items={kot.items} />
      </button>
      <footer className="mt-auto flex min-w-0 flex-wrap items-center gap-2 border-t border-dashed border-border/70 bg-muted/20 p-3 sm:px-4">
        <span className="mr-auto text-xs font-medium text-muted-foreground">
          {itemCount} {itemCount === 1 ? "item" : "items"}
        </span>
        {!isTerminal && onReject ? (
          <Button
            type="button"
            variant="ghost"
            className="h-11 px-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onReject}
            disabled={isUpdating}
          >
            Reject
          </Button>
        ) : null}
        {primaryAction ? (
          <Button
            type="button"
            className="h-11 px-4 font-semibold"
            onClick={primaryAction.onClick}
            disabled={isUpdating}
          >
            {primaryAction.label}
          </Button>
        ) : null}
      </footer>
    </article>
  );
}

export const KitchenTicketCard = KOTTicketCard;

export function KotCompactTicketCard({
  kot,
  onOpenDetails,
}: {
  kot: KitchenTicket;
  onOpenDetails: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpenDetails}
      aria-label={`Open KOT ${kot.kot_number || kot.id} details`}
      className="block h-full w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      <article className="flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm transition-[border-color,box-shadow] hover:border-primary/35 hover:shadow-md">
        <div className="border-b border-dashed border-border/70">
          <KotTicketHeader ticket={kot} delayed={isKotDelayed(kot)} compact />
        </div>
        <KotTicketItemList items={kot.items} compact limit={4} />
      </article>
    </button>
  );
}

export function KotEmbeddedTicketCard({
  kot,
  primaryAction,
  onReject,
  onOpenDetails,
  isUpdating,
}: {
  kot: KitchenTicket;
  primaryAction?: KitchenTicketPrimaryAction | null;
  onReject?: () => void;
  onOpenDetails?: () => void;
  isUpdating?: boolean;
}) {
  const isTerminal = TERMINAL_STATUSES.has(
    String(kot.status || "").toUpperCase(),
  );
  return (
    <article
      className={cn(
        "min-w-0 overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm",
        isKotDelayed(kot) && "border-destructive/35",
      )}
    >
      <button type="button" className="w-full min-w-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary" onClick={onOpenDetails} aria-label={`Open KOT ${kot.kot_number || kot.id} details`}>
        <div className="border-b border-dashed border-border/70">
          <KotTicketHeader ticket={kot} delayed={isKotDelayed(kot)} compact />
        </div>
        <div className="px-3 sm:px-4"><KotTicketMeta ticket={kot} compact /></div>
        <KotTicketItemList items={kot.items} compact />
      </button>
      {primaryAction || (!isTerminal && onReject) ? (
        <footer className="flex min-w-0 flex-wrap items-center gap-2 border-t border-dashed border-border/70 bg-muted/20 p-3">
          {primaryAction ? (
            <Button
              type="button"
              className="h-11 min-w-0 flex-1 font-semibold"
              onClick={primaryAction.onClick}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {primaryAction.label}
            </Button>
          ) : null}
          {!isTerminal && onReject ? (
            <Button
              type="button"
              variant="ghost"
              className="h-10 shrink-0 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={onReject}
              disabled={isUpdating}
              aria-label="Reject kitchen ticket"
            >
              Reject
            </Button>
          ) : null}
        </footer>
      ) : null}
    </article>
  );
}
