"use client";

import Link from "next/link";
import {
  History,
  Landmark,
  ReceiptText,
  RotateCcw,
  WalletCards,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  payrollPaymentMethodLabel,
  payrollPaymentSourceLabel,
} from "@/lib/payroll/payment-form";
import type { PayrollPayment } from "@/lib/payroll/payables";
import type { PayrollHistoryRecord } from "@/lib/staff/workforce";

function money(value: number) {
  return `Rs. ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function displayDate(value?: string | null) {
  if (!value) return "-";
  const parsed = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
}

function displayDateTime(value?: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

export function PayrollPaymentHistory({
  payments,
  canManage,
  historyByItemId,
  legacyHistory = [],
  onReverse,
}: {
  payments: PayrollPayment[];
  canManage: boolean;
  historyByItemId: Map<number, PayrollHistoryRecord>;
  legacyHistory?: PayrollHistoryRecord[];
  onReverse: (payment: PayrollPayment) => void;
}) {
  const allocatedItemIds = new Set(
    payments.flatMap((payment) =>
      payment.allocations.map((allocation) => allocation.payroll_item_id),
    ),
  );
  const hasBackendReconstruction = payments.some(
    (payment) =>
      payment.metadata_reconstructed ||
      (payment.history_quality && payment.history_quality !== "exact"),
  );
  const legacyPaidRuns = hasBackendReconstruction
    ? []
    : legacyHistory.filter(
        ({ run, item }) =>
          run.status.trim().toLowerCase() === "paid" &&
          !allocatedItemIds.has(item.id),
      );
  const recordCount = payments.length + legacyPaidRuns.length;

  return (
    <section>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Payment history</h3>
          <p className="text-sm text-muted-foreground">
            Every payment, funding source, allocation, and correction remains
            auditable.
          </p>
        </div>
        <Badge variant="outline">{recordCount}</Badge>
      </div>
      <div className="space-y-3">
        {payments.map((payment) => (
          <PaymentHistoryCard
            key={payment.id}
            payment={payment}
            canManage={canManage}
            historyByItemId={historyByItemId}
            onReverse={() => onReverse(payment)}
          />
        ))}
        {legacyPaidRuns.map((record) => (
          <LegacyPaymentHistoryCard
            key={`legacy-${record.run.id}-${record.item.id}`}
            record={record}
          />
        ))}
        {!recordCount ? (
          <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
            No salary payments recorded yet.
          </div>
        ) : null}
      </div>
    </section>
  );
}

function PaymentHistoryCard({
  payment,
  canManage,
  historyByItemId,
  onReverse,
}: {
  payment: PayrollPayment;
  canManage: boolean;
  historyByItemId: Map<number, PayrollHistoryRecord>;
  onReverse: () => void;
}) {
  return (
    <article
      className={`rounded-xl border p-4 ${
        payment.status === "reversed"
          ? "border-destructive/30 bg-destructive/5"
          : ""
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{money(payment.amount)}</p>
            <Badge
              variant={payment.status === "posted" ? "default" : "destructive"}
            >
              {payment.status}
            </Badge>
            <Badge variant="outline">
              {payrollPaymentMethodLabel(payment.payment_method)}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {displayDateTime(payment.paid_at)}
            {payment.created_by_name
              ? ` · recorded by ${payment.created_by_name}`
              : ""}
          </p>
        </div>
        {canManage &&
        payment.status === "posted" &&
        !payment.metadata_reconstructed &&
        (!payment.history_quality || payment.history_quality === "exact") ? (
          <Button size="sm" variant="outline" onClick={onReverse}>
            <RotateCcw className="mr-2 h-3.5 w-3.5" /> Correct
          </Button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <HistoryFact
          icon={Landmark}
          label="Payment source"
          value={payrollPaymentSourceLabel(payment)}
        />
        <HistoryFact
          icon={ReceiptText}
          label="Reference"
          value={payment.payment_reference || "No reference"}
        />
        <HistoryFact
          icon={WalletCards}
          label="Balance after payment"
          value={
            payment.balance_after_payment == null
              ? "Not recorded"
              : money(payment.balance_after_payment)
          }
        />
      </div>
      {payment.cash_source === "safe" &&
      payment.source_balance_after != null ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Main Cash / Safe balance after payment:{" "}
          <span className="font-semibold">
            {money(payment.source_balance_after)}
          </span>
        </p>
      ) : null}

      {payment.allocations.length ? (
        <div className="mt-4 rounded-lg bg-muted/30 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Salary periods settled
          </p>
          <div className="mt-2 space-y-1.5">
            {payment.allocations.map((allocation) => {
              const history = historyByItemId.get(allocation.payroll_item_id);
              const dateFrom = allocation.date_from || history?.run.date_from;
              const dateTo = allocation.date_to || history?.run.date_to;
              const runId = allocation.payroll_run_id || history?.run.id;
              return (
                <div
                  key={allocation.id}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <div>
                    {runId ? (
                      <Link
                        href={`/payroll/${runId}`}
                        className="font-medium hover:underline"
                      >
                        {displayDate(dateFrom)} - {displayDate(dateTo)}
                      </Link>
                    ) : (
                      <span className="font-medium">
                        Payroll item #{allocation.payroll_item_id}
                      </span>
                    )}
                  </div>
                  <span className="font-semibold">
                    {money(allocation.amount)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {payment.notes ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Note: {payment.notes}
        </p>
      ) : null}
      {payment.metadata_reconstructed ||
      (payment.history_quality && payment.history_quality !== "exact") ? (
        <p className="mt-3 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          {payment.history_quality === "reconstructed"
            ? "Reconstructed legacy record — available source and balance details were recovered from the finance audit trail."
            : "Partial legacy record — the paid period is preserved, but exact source, actor, or balance snapshots remain unavailable."}
        </p>
      ) : null}
      {payment.status === "reversed" ? (
        <div className="mt-3 rounded-lg bg-destructive/10 p-3 text-sm">
          <p className="font-semibold">Payment reversed</p>
          <p className="mt-1 text-muted-foreground">
            {payment.reversal_reason || "No reason recorded"}
            {payment.reversed_by_name
              ? ` · by ${payment.reversed_by_name}`
              : ""}
            {payment.reversed_at
              ? ` · ${displayDateTime(payment.reversed_at)}`
              : ""}
          </p>
          {payment.cash_source === "safe" ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Cash was restored to Main Cash / Safe (1005).
            </p>
          ) : payment.reversal_drawer_session_name ||
            payment.reversal_drawer_name ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Cash returned to{" "}
              {payment.reversal_drawer_session_name ||
                payment.reversal_drawer_name}
              .
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function LegacyPaymentHistoryCard({
  record: { run, item },
}: {
  record: PayrollHistoryRecord;
}) {
  return (
    <article className="rounded-xl border border-dashed p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{money(item.net_pay)}</p>
            <Badge variant="default">paid</Badge>
            <Badge variant="outline">
              {payrollPaymentMethodLabel(run.payment_method || "legacy")}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {displayDateTime(run.paid_at || run.created_at)}
          </p>
        </div>
        <Badge variant="secondary">Legacy payroll record</Badge>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <HistoryFact
          icon={Landmark}
          label="Payment source"
          value={
            run.payment_method
              ? `Exact source unavailable (recorded method: ${payrollPaymentMethodLabel(
                  run.payment_method,
                )})`
              : "Source not captured"
          }
        />
        <HistoryFact
          icon={ReceiptText}
          label="Reference"
          value={run.payment_reference || "Not captured"}
        />
        <HistoryFact
          icon={WalletCards}
          label="Balance after payment"
          value="Not captured"
        />
      </div>

      <div className="mt-4 rounded-lg bg-muted/30 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Salary period settled
        </p>
        <div className="mt-2 flex items-center justify-between gap-3 text-sm">
          <Link
            href={`/payroll/${run.id}`}
            className="font-medium hover:underline"
          >
            {displayDate(run.date_from)} - {displayDate(run.date_to)}
          </Link>
          <span className="font-semibold">{money(item.net_pay)}</span>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        This run predates detailed payroll payment records. Its original paid
        status is preserved, but bank, drawer, actor, allocation, and resulting
        balance snapshots were not captured.
      </p>
    </article>
  );
}

function HistoryFact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof History;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="break-words text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}
