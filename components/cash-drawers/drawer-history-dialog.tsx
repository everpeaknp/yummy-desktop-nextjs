"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import apiClient from "@/lib/api-client";
import { DrawerSessionApis } from "@/lib/api/endpoints";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  DrawerActivityLog,
  DrawerMovement,
  DrawerSession,
  DrawerSettlementLine,
} from "@/types/day-close";

type BaseResponse<T> = { data?: T };

type CashEntry = {
  id: string;
  title: string;
  reference: string;
  amount: number;
  occurredAt: string;
  actor?: string | null;
};

function amount(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: number) {
  return `Rs. ${amount(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function label(value?: string | null) {
  if (!value) return "—";
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function sourceLabel(value?: string | null) {
  const labels: Record<string, string> = {
    retained_float: "Retained float from the previous session",
    standard_float: "Configured standard float",
    manager_override: "Manager-approved opening",
    manual: "Manual opening count",
  };
  return labels[String(value || "").toLowerCase()] ?? label(value);
}

function movementLabel(
  movementType?: string | null,
  metadata?: Record<string, unknown>,
) {
  const sourceType = String(
    metadata?.source_type ?? movementType ?? "",
  ).toLowerCase();
  const labels: Record<string, string> = {
    cash_sale: "Cash sale",
    order: "Order sale",
    order_payment: "Order payment",
    pos_order: "POS order payment",
    manual_income: "Manual income",
    income_entry: "Other income",
    receivable_collection: "Credit collection",
    customer_credit_payment: "Customer credit collection",
    customer_credit_repayment: "Customer credit collection",
    cash_refund: "Cash refund",
    refund: "Cash refund",
    order_refund: "Order refund",
    expense: "Cash expense",
    inventory_payment: "Inventory payment",
    inventory_purchase: "Inventory purchase",
    supplier_payment: "Supplier payment",
    general_awaiting_payment: "Purchase payment",
    inventory_refund: "Inventory purchase reversal",
    purchase_return_refund: "Purchase return refund",
    purchase_return_refund_void: "Purchase return refund reversed",
    tax_payment: "Payroll tax payment",
    cash_drop: "Cash drop",
    transfer_in: "Cash transfer in",
    transfer_out: "Cash transfer out",
    adjustment: "Cash adjustment",
    finance_sales_invoice: "Sales invoice receipt",
    finance_sales_credit_note: "Sales credit note refund",
    hotel_folio_payment: "Hotel folio payment",
    hotel_folio_refund: "Hotel folio refund",
  };
  return labels[sourceType] ?? label(sourceType || movementType);
}

function movementReference(
  movement: Pick<DrawerMovement, "source_key" | "metadata_json">,
) {
  const metadata = movement.metadata_json ?? {};
  return (
    String(metadata.reference ?? metadata.description ?? "").trim() ||
    movement.source_key ||
    "—"
  );
}

function statusClasses(status?: string | null) {
  switch (String(status || "").toLowerCase()) {
    case "approved":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "closed":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "variance_review_required":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "reopened":
      return "border-violet-200 bg-violet-50 text-violet-700";
    default:
      return "border-border bg-muted/50 text-muted-foreground";
  }
}

function Stat({
  label: title,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-border/70 bg-background px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {title}
      </div>
      <div className="mt-1 truncate text-lg font-semibold tabular-nums text-foreground">
        {value}
      </div>
      {helper ? (
        <div className="mt-0.5 text-xs text-muted-foreground">{helper}</div>
      ) : null}
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {eyebrow}
      </div>
      <h3 className="mt-1 text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function settlementLines(session: DrawerSession): DrawerSettlementLine[] {
  if (session.settlement_lines?.length) return session.settlement_lines;
  const settlementAmount = amount(session.settlement_amount);
  if (settlementAmount <= 0 || !session.settlement_destination) return [];
  return [
    {
      id: -1,
      destination_account_id: session.settlement_destination_id ?? 0,
      amount: settlementAmount,
      reference: session.settlement_reference,
      destination_name: session.settlement_destination,
      destination_type: "destination",
      sort_order: 0,
    },
  ];
}

export function DrawerHistoryDialog({
  session,
  open,
  onOpenChange,
}: {
  session: DrawerSession | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [logs, setLogs] = useState<DrawerActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!open || !session) return;
    let active = true;
    setLoading(true);
    setLoadError(false);
    setLogs([]);
    apiClient
      .get<BaseResponse<DrawerActivityLog[]>>(
        DrawerSessionApis.activity(session.id),
      )
      .then((response) => {
        if (active) setLogs(response.data?.data ?? []);
      })
      .catch(() => {
        if (active) setLoadError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, session]);

  const entries = useMemo<CashEntry[]>(() => {
    const activityEntries = logs
      .filter((row) => row.activity_type === "drawer_movement")
      .map((row) => {
        const metadata = row.metadata ?? {};
        const nestedMetadata =
          metadata.metadata_json && typeof metadata.metadata_json === "object"
            ? (metadata.metadata_json as Record<string, unknown>)
            : {};
        const reference =
          String(
            metadata.source_reference ??
              nestedMetadata.reference ??
              nestedMetadata.description ??
              metadata.source_key ??
              row.description ??
              "",
          ).trim() || "—";
        return {
          id: row.id,
          title:
            row.title === "Drawer movement"
              ? movementLabel(
                  String(metadata.movement_type ?? ""),
                  nestedMetadata,
                )
              : row.title,
          reference,
          amount: amount(row.amount),
          occurredAt: row.occurred_at,
          actor:
            row.actor_name ?? (row.actor_id ? `User #${row.actor_id}` : null),
        };
      });

    const fallbackEntries = (session?.movements ?? []).map((movement) => ({
      id: `movement:${movement.id}`,
      title: movementLabel(
        movement.movement_type,
        movement.metadata_json ?? undefined,
      ),
      reference: movementReference(movement),
      amount: amount(movement.signed_amount),
      occurredAt: movement.occurred_at ?? "",
      actor: movement.recorded_by_id
        ? `User #${movement.recorded_by_id}`
        : null,
    }));

    return (activityEntries.length ? activityEntries : fallbackEntries).sort(
      (left, right) =>
        new Date(left.occurredAt).getTime() -
        new Date(right.occurredAt).getTime(),
    );
  }, [logs, session]);

  const auditLogs = useMemo(
    () =>
      logs
        .filter((row) => {
          if (row.activity_type === "drawer_count") {
            return row.metadata?.count_type !== "opening";
          }
          return [
            "drawer_closed",
            "drawer_approval",
            "drawer_reopened",
          ].includes(row.activity_type);
        })
        .sort(
          (left, right) =>
            new Date(left.occurred_at).getTime() -
            new Date(right.occurred_at).getTime(),
        ),
    [logs],
  );

  if (!session) return null;

  const opening = amount(session.counted_opening_cash);
  const movementTotal = entries.reduce(
    (total, entry) => total + entry.amount,
    0,
  );
  const expected = amount(
    session.expected_closing_cash ?? opening + movementTotal,
  );
  const hasClosingCount = session.counted_closing_cash != null;
  const counted = hasClosingCount ? amount(session.counted_closing_cash) : 0;
  const variance = hasClosingCount
    ? amount(session.cash_variance ?? counted - expected)
    : 0;
  const settlements = settlementLines(session);
  const settledAmount = settlements.reduce(
    (total, line) => total + amount(line.amount),
    0,
  );
  const retained = amount(session.retained_float);
  let runningBalance = opening;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] gap-0 overflow-hidden p-0 sm:max-w-[1040px]">
        <DialogHeader className="border-b border-border/70 px-6 py-5 pr-12 text-left">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <DialogTitle className="text-xl">Drawer session</DialogTitle>
              <DialogDescription className="mt-1">
                {session.station} / {session.drawer_key} ·{" "}
                {session.business_date}
              </DialogDescription>
            </div>
            <Badge variant="outline" className={statusClasses(session.status)}>
              {label(session.status)}
            </Badge>
          </div>
          <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
            <span>
              Cashier:{" "}
              {session.cashier_name ||
                (session.cashier_id ? `#${session.cashier_id}` : "Unassigned")}
            </span>
            <span>Opened: {formatDateTime(session.opened_at)}</span>
            <span>Closed: {formatDateTime(session.closed_at)}</span>
          </div>
        </DialogHeader>

        <div className="overflow-y-auto px-6 py-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Opening balance"
              value={formatMoney(opening)}
              helper={sourceLabel(session.suggested_opening_source)}
            />
            <Stat
              label="Net activity"
              value={formatMoney(movementTotal)}
              helper={`${entries.length} cash ${entries.length === 1 ? "entry" : "entries"}`}
            />
            <Stat
              label="Expected close"
              value={formatMoney(expected)}
              helper="Opening plus recorded activity"
            />
            <Stat
              label="Counted close"
              value={hasClosingCount ? formatMoney(counted) : "Not counted"}
              helper={
                !hasClosingCount
                  ? "Pending physical count"
                  : variance === 0
                    ? "Balanced"
                    : `Variance ${formatMoney(variance)}`
              }
            />
          </div>

          <section className="mt-8">
            <SectionHeading
              eyebrow="01 · Opening"
              title="Opening position"
              description="The physical float counted when this drawer session started."
            />
            <div className="mt-4 grid overflow-hidden rounded-xl border border-border/70 sm:grid-cols-3">
              <div className="border-b border-border/70 p-4 sm:border-b-0 sm:border-r">
                <div className="text-xs text-muted-foreground">
                  Suggested float
                </div>
                <div className="mt-1 font-semibold tabular-nums">
                  {formatMoney(amount(session.suggested_opening_cash))}
                </div>
              </div>
              <div className="border-b border-border/70 p-4 sm:border-b-0 sm:border-r">
                <div className="text-xs text-muted-foreground">
                  Counted opening
                </div>
                <div className="mt-1 font-semibold tabular-nums">
                  {formatMoney(opening)}
                </div>
              </div>
              <div className="p-4">
                <div className="text-xs text-muted-foreground">
                  Opening variance
                </div>
                <div
                  className={`mt-1 font-semibold tabular-nums ${amount(session.opening_variance) !== 0 ? "text-amber-700" : ""}`}
                >
                  {formatMoney(amount(session.opening_variance))}
                </div>
              </div>
            </div>
          </section>

          <section className="mt-8">
            <SectionHeading
              eyebrow="02 · Activity"
              title="Cash entries"
              description="Every recorded cash movement in chronological order, with a running drawer balance."
            />
            <div className="mt-4 overflow-hidden rounded-xl border border-border/70">
              <div className="hidden grid-cols-[150px_minmax(180px,1fr)_minmax(160px,1fr)_120px_140px] gap-3 border-b bg-muted/40 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground lg:grid">
                <span>Time</span>
                <span>Entry</span>
                <span>Reference</span>
                <span className="text-right">Movement</span>
                <span className="text-right">Balance</span>
              </div>
              {loading ? (
                <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading drawer
                  entries…
                </div>
              ) : loadError && entries.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-red-600">
                  Drawer activity could not be loaded.
                </div>
              ) : entries.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No cash movements were recorded in this session.
                </div>
              ) : (
                <div className="divide-y divide-border/70">
                  {entries.map((entry) => {
                    runningBalance += entry.amount;
                    return (
                      <div
                        key={entry.id}
                        className="grid gap-2 px-4 py-3 text-sm lg:grid-cols-[150px_minmax(180px,1fr)_minmax(160px,1fr)_120px_140px] lg:items-center lg:gap-3"
                      >
                        <div className="text-xs text-muted-foreground">
                          {formatDateTime(entry.occurredAt)}
                        </div>
                        <div>
                          <div className="font-medium">{entry.title}</div>
                          {entry.actor ? (
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              Recorded by {entry.actor}
                            </div>
                          ) : null}
                        </div>
                        <div className="break-words text-xs text-muted-foreground">
                          {entry.reference}
                        </div>
                        <div
                          className={`text-right font-semibold tabular-nums ${entry.amount < 0 ? "text-red-600" : "text-emerald-700"}`}
                        >
                          {entry.amount > 0 ? "+" : ""}
                          {formatMoney(entry.amount)}
                        </div>
                        <div className="text-right font-semibold tabular-nums">
                          {formatMoney(runningBalance)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="flex items-center justify-between border-t bg-muted/30 px-4 py-3 text-sm">
                <span className="font-medium">
                  Backend expected closing cash
                </span>
                <span className="font-semibold tabular-nums">
                  {formatMoney(expected)}
                </span>
              </div>
            </div>
          </section>

          <section className="mt-8">
            <SectionHeading
              eyebrow="03 · Closing"
              title="Closing position"
              description="Expected cash is compared with the final physical count before settlement."
            />
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Stat label="Expected cash" value={formatMoney(expected)} />
              <Stat
                label="Physical count"
                value={hasClosingCount ? formatMoney(counted) : "Not counted"}
              />
              <Stat
                label="Closing variance"
                value={hasClosingCount ? formatMoney(variance) : "Pending"}
                helper={
                  !hasClosingCount
                    ? "Awaiting closing count"
                    : variance === 0
                      ? "No difference"
                      : variance > 0
                        ? "Cash over"
                        : "Cash shortage"
                }
              />
            </div>
            {auditLogs.length ? (
              <div className="mt-4 rounded-xl border border-border/70 px-4">
                {auditLogs.map((row) => (
                  <div
                    key={row.id}
                    className="flex flex-col gap-1 border-b border-border/60 py-3 last:border-0 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div>
                      <div className="text-sm font-medium">{row.title}</div>
                      {row.description ? (
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {row.description}
                        </div>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground sm:text-right">
                      <div>{formatDateTime(row.occurred_at)}</div>
                      <div>
                        {row.actor_name ||
                          (row.actor_id ? `User #${row.actor_id}` : "System")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          <section className="mt-8 pb-2">
            <SectionHeading
              eyebrow="04 · Settlement"
              title="Settlement allocation"
              description="Where the counted cash was retained or transferred after the drawer was approved."
            />
            <div className="mt-4 overflow-hidden rounded-xl border border-border/70">
              <div className="grid gap-3 border-b border-border/70 bg-muted/30 px-4 py-3 sm:grid-cols-3">
                <div>
                  <div className="text-xs text-muted-foreground">
                    Settlement mode
                  </div>
                  <div className="mt-1 text-sm font-medium">
                    {label(session.settlement_mode)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    Retained in drawer
                  </div>
                  <div className="mt-1 text-sm font-semibold tabular-nums">
                    {formatMoney(retained)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    Transferred
                  </div>
                  <div className="mt-1 text-sm font-semibold tabular-nums">
                    {formatMoney(
                      settledAmount || amount(session.settlement_amount),
                    )}
                  </div>
                </div>
              </div>
              {settlements.length ? (
                <div className="divide-y divide-border/70">
                  {settlements.map((line) => (
                    <div
                      key={line.id}
                      className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <div className="text-sm font-medium">
                          {line.destination_name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {label(line.destination_type)}
                          {line.reference ? ` · Ref ${line.reference}` : ""}
                        </div>
                      </div>
                      <div className="font-semibold tabular-nums">
                        {formatMoney(amount(line.amount))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : retained > 0 ? (
                <div className="px-4 py-4 text-sm text-muted-foreground">
                  All remaining cash was retained as the next opening float.
                </div>
              ) : (
                <div className="px-4 py-4 text-sm text-muted-foreground">
                  No settlement allocation was recorded.
                </div>
              )}
              {session.settlement_reference ? (
                <div className="border-t border-border/70 px-4 py-3 text-xs text-muted-foreground">
                  Settlement reference: {session.settlement_reference}
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
