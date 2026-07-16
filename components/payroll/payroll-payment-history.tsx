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
  onReverse,
}: {
  payments: PayrollPayment[];
  canManage: boolean;
  historyByItemId: Map<number, PayrollHistoryRecord>;
  onReverse: (payment: PayrollPayment) => void;
}) {
  return (
    <section>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Payment history</h3>
          <p className="text-sm text-muted-foreground">
            Every payment, funding source, allocation, and correction remains auditable.
          </p>
        </div>
        <Badge variant="outline">{payments.length}</Badge>
      </div>
      <div className="space-y-3">
        {payments.length ? (
          payments.map((payment) => (
            <PaymentHistoryCard
              key={payment.id}
              payment={payment}
              canManage={canManage}
              historyByItemId={historyByItemId}
              onReverse={() => onReverse(payment)}
            />
          ))
        ) : (
          <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
            No salary payments recorded yet.
          </div>
        )}
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
    <article className={`rounded-xl border p-4 ${payment.status === "reversed" ? "border-destructive/30 bg-destructive/5" : ""}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{money(payment.amount)}</p>
            <Badge variant={payment.status === "posted" ? "default" : "destructive"}>
              {payment.status}
            </Badge>
            <Badge variant="outline">{payrollPaymentMethodLabel(payment.payment_method)}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {displayDateTime(payment.paid_at)}
            {payment.created_by_name ? ` · recorded by ${payment.created_by_name}` : ""}
          </p>
        </div>
        {canManage && payment.status === "posted" ? (
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
                <div key={allocation.id} className="flex items-center justify-between gap-3 text-sm">
                  <div>
                    {runId ? (
                      <Link href={`/payroll/${runId}`} className="font-medium hover:underline">
                        {displayDate(dateFrom)} - {displayDate(dateTo)}
                      </Link>
                    ) : (
                      <span className="font-medium">Payroll item #{allocation.payroll_item_id}</span>
                    )}
                  </div>
                  <span className="font-semibold">{money(allocation.amount)}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {payment.notes ? <p className="mt-3 text-sm text-muted-foreground">Note: {payment.notes}</p> : null}
      {payment.status === "reversed" ? (
        <div className="mt-3 rounded-lg bg-destructive/10 p-3 text-sm">
          <p className="font-semibold">Payment reversed</p>
          <p className="mt-1 text-muted-foreground">
            {payment.reversal_reason || "No reason recorded"}
            {payment.reversed_by_name ? ` · by ${payment.reversed_by_name}` : ""}
            {payment.reversed_at ? ` · ${displayDateTime(payment.reversed_at)}` : ""}
          </p>
          {payment.reversal_drawer_session_name || payment.reversal_drawer_name ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Cash returned to {payment.reversal_drawer_session_name || payment.reversal_drawer_name}.
            </p>
          ) : null}
        </div>
      ) : null}
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
