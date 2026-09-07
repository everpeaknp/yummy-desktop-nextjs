import { Banknote, Clock3 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { FinanceSalesDocumentSettlement } from "@/types/finance-sales";

const money = (value: number | string) =>
  `NPR ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const method = (value?: string | null) =>
  value
    ? value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
    : "Payment received";

export function InvoiceSettlementCard({
  settlement,
}: {
  settlement: FinanceSalesDocumentSettlement;
}) {
  const remaining = Number(settlement.balance_due || 0);
  const received = Number(settlement.amount_received || 0);
  const returned = Number(settlement.amount_returned || 0);
  const refunded = Number(settlement.amount_refunded || 0);
  const status =
    settlement.settlement_status === "returned"
      ? "Returned"
      : settlement.settlement_status === "partially_returned"
        ? "Partially returned"
        : settlement.settlement_status === "paid"
      ? "Paid"
      : settlement.settlement_status === "partially_paid"
        ? "Partially paid"
        : "Unpaid";

  return (
    <Card className="border-border/40">
      <CardContent className="space-y-4 p-5">
        <div>
          <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">
            Invoice settlement
          </h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Payments received after checkout are applied to this invoice here.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-5 gap-y-4 border-y border-border py-4 text-sm">
          {remaining > 0.004 ? (
            <div>
              <p className="text-xs text-muted-foreground">Sold on credit</p>
              <p className="mt-1 font-semibold tabular-nums">{money(settlement.document.grand_total)}</p>
            </div>
          ) : null}
          <div>
            <p className="text-xs text-muted-foreground">Collected</p>
            <p className="mt-1 font-semibold tabular-nums text-emerald-600">{money(received)}</p>
          </div>
          {returned > 0.004 ? (
            <div>
              <p className="text-xs text-muted-foreground">Returned</p>
              <p className="mt-1 font-semibold tabular-nums text-orange-600">{money(returned)}</p>
            </div>
          ) : null}
          <div>
            <p className="text-xs text-muted-foreground">Balance due</p>
            <p className={remaining > 0.004 ? "mt-1 font-semibold tabular-nums text-orange-600" : "mt-1 font-semibold tabular-nums text-emerald-600"}>
              {money(remaining)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <p className="mt-1 font-semibold">{status}</p>
          </div>
        </div>
        {refunded > 0.004 ? (
          <p className="rounded-md border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            Refunded: {money(refunded)}. The original payment is retained in the history below.
          </p>
        ) : null}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Original payments</p>
          {settlement.payments.length ? settlement.payments.map((payment, index) => (
            <div key={`${payment.received_at}-${index}`} className="flex items-start justify-between gap-3 py-1.5 text-sm">
              <div className="flex min-w-0 gap-2">
                <Banknote className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <div>
                  <p className="font-medium">{method(payment.payment_method)}</p>
                  <p className="text-xs text-muted-foreground">{new Date(payment.received_at).toLocaleString()}</p>
                </div>
              </div>
              <p className="shrink-0 font-semibold tabular-nums text-emerald-600">{money(payment.amount)}</p>
            </div>
          )) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock3 className="h-4 w-4" /> No payment has been received yet.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
