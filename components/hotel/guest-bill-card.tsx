import { format, parseISO } from "date-fns";
import { AlertCircle, CheckCircle2, CircleDollarSign, ReceiptText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  buildHotelBillSummary,
  hotelBillActivityAmountLabel,
  hotelBillActivityLabel,
  hotelPaymentLabel,
} from "@/lib/hotel/bill-summary";
import type { HotelFolio } from "@/lib/hotel/types";
import { hotelMoney } from "@/lib/hotel/types";
import { cn } from "@/lib/utils";
import { hotelCurrency } from "./hotel-ui";

interface Props {
  folio: HotelFolio;
  unpostedRoomCharges?: string | number;
}

export function GuestBillCard({ folio, unpostedRoomCharges = 0 }: Props) {
  const summary = buildHotelBillSummary(folio, unpostedRoomCharges);
  const status =
    summary.paymentStatus === "due"
      ? {
          label: "Payment due",
          amountLabel: "Amount due",
          amount: summary.balanceDue,
          icon: AlertCircle,
          badge: "destructive" as const,
          color: "text-rose-600",
          iconClass: "bg-rose-500/10 text-rose-600",
        }
      : summary.paymentStatus === "credit"
        ? {
            label: "Guest credit",
            amountLabel: "Credit available",
            amount: summary.guestCredit,
            icon: CircleDollarSign,
            badge: "warning" as const,
            color: "text-amber-600",
            iconClass: "bg-amber-500/10 text-amber-600",
          }
        : {
            label: "Paid in full",
            amountLabel: "Balance due",
            amount: 0,
            icon: CheckCircle2,
            badge: "success" as const,
            color: "text-emerald-600",
            iconClass: "bg-emerald-500/10 text-emerald-600",
          };
  const StatusIcon = status.icon;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="gap-4 border-b bg-muted/15 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className={cn("rounded-xl p-3", status.iconClass)}>
            <StatusIcon className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-lg">Guest bill</CardTitle>
              <Badge variant={status.badge}>{status.label}</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Bill {folio.folio_number}</p>
          </div>
        </div>
        <div className="text-left md:text-right">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{status.amountLabel}</p>
          <p className={cn("text-2xl font-black", status.color)}>{hotelCurrency(status.amount, folio.currency)}</p>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryMetric label="Total bill" value={summary.totalBill} currency={folio.currency} />
          <SummaryMetric label="Amount paid" value={summary.amountPaid} currency={folio.currency} />
          <SummaryMetric
            label={summary.paymentStatus === "credit" ? "Guest credit" : "Balance due"}
            value={summary.paymentStatus === "credit" ? summary.guestCredit : summary.balanceDue}
            currency={folio.currency}
            emphasized
          />
        </div>

        <section>
          <h5 className="mb-2 font-semibold">Bill breakdown</h5>
          <div className="overflow-hidden rounded-xl border">
            <BreakdownRow label="Room charges" value={summary.roomCharges} currency={folio.currency} />
            <BreakdownRow label="Room service" value={summary.roomServiceCharges} currency={folio.currency} />
            {summary.otherCharges > 0.005 ? <BreakdownRow label="Other charges" value={summary.otherCharges} currency={folio.currency} /> : null}
            {summary.discounts > 0.005 ? <BreakdownRow label="Discounts" value={summary.discounts} currency={folio.currency} subtract /> : null}
            {summary.otherCredits > 0.005 ? <BreakdownRow label="Other credits" value={summary.otherCredits} currency={folio.currency} subtract /> : null}
          </div>
          {summary.remainingRoomCharges > 0.005 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Room charges include {hotelCurrency(summary.remainingRoomCharges, folio.currency)} for the remaining booked nights.
            </p>
          ) : null}
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h5 className="font-semibold">Payments</h5>
            <span className="text-xs text-muted-foreground">{summary.payments.length} payment(s)</span>
          </div>
          {summary.payments.length ? (
            <div className="overflow-hidden rounded-xl border">
              {summary.payments.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between gap-4 border-b px-4 py-3 last:border-0">
                  <div>
                    <p className="font-medium">{hotelPaymentLabel(entry)}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(entry.service_date), "d MMM yyyy")}
                      {entry.payment?.reference ? ` · ${entry.payment.reference}` : ""}
                    </p>
                  </div>
                  <p className="font-semibold text-emerald-600">{hotelCurrency(Math.abs(hotelMoney(entry.amount)), folio.currency)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No payments recorded yet.</p>
          )}
        </section>

        <details className="group rounded-xl border">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 font-medium">
            <ReceiptText className="h-4 w-4 text-muted-foreground" />
            View bill activity
            <span className="ml-auto text-xs font-normal text-muted-foreground">{summary.activity.length} record(s)</span>
          </summary>
          <div className="border-t">
            {summary.activity.length ? summary.activity.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-4 border-b px-4 py-3 text-sm last:border-0">
                <div>
                  <p className="font-medium">{hotelBillActivityLabel(entry)}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(parseISO(entry.service_date), "d MMM yyyy")} · {hotelBillActivityAmountLabel(entry)}
                  </p>
                </div>
                <p className={cn("font-semibold", hotelMoney(entry.amount) < 0 && "text-emerald-600")}>
                  {hotelCurrency(Math.abs(hotelMoney(entry.amount)), folio.currency)}
                </p>
              </div>
            )) : <p className="p-4 text-sm text-muted-foreground">No bill activity yet.</p>}
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

function SummaryMetric({
  label,
  value,
  currency,
  emphasized = false,
}: {
  label: string;
  value: number;
  currency: string;
  emphasized?: boolean;
}) {
  return (
    <div className={cn("rounded-xl border p-4", emphasized && "bg-muted/30")}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-bold">{hotelCurrency(value, currency)}</p>
    </div>
  );
}

function BreakdownRow({
  label,
  value,
  currency,
  subtract = false,
}: {
  label: string;
  value: number;
  currency: string;
  subtract?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-medium", subtract && "text-emerald-600")}>
        {subtract ? "- " : ""}{hotelCurrency(value, currency)}
      </span>
    </div>
  );
}
