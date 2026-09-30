"use client";

import Link from "next/link";
import { AlertTriangle, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatDayCloseCurrency } from "@/lib/day-close-format";
import type {
  DayCloseAccountMovement,
  DayCloseDetail,
  DayCloseSnapshotData,
} from "@/types/day-close";

function amount(value?: number | null) {
  return value == null ? "Unavailable" : formatDayCloseCurrency(value);
}

function Row({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 py-2 text-sm">
      <dt className={strong ? "font-medium" : "text-muted-foreground"}>
        {label}
      </dt>
      <dd
        className={
          strong ? "font-semibold tabular-nums" : "font-medium tabular-nums"
        }
      >
        {value}
      </dd>
    </div>
  );
}

const accountTypeOrder = [
  "asset",
  "liability",
  "equity",
  "income",
  "contra_income",
  "expense",
];

function accountTypeLabel(value: string) {
  const labels: Record<string, string> = {
    asset: "Assets",
    liability: "Liabilities",
    equity: "Equity",
    income: "Income",
    contra_income: "Contra income",
    expense: "Expenses",
  };
  return labels[value.toLowerCase()] ?? value;
}

function balance(
  value: DayCloseAccountMovement,
  position: "opening" | "closing",
) {
  const debit = value[`${position}_debit`];
  const credit = value[`${position}_credit`];
  if (debit > 0) return `${formatDayCloseCurrency(debit)} Dr`;
  if (credit > 0) return `${formatDayCloseCurrency(credit)} Cr`;
  return formatDayCloseCurrency(0);
}

export function DayCloseFinancialDetails({
  open,
  onOpenChange,
  snapshot,
  detail,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snapshot?: DayCloseSnapshotData | null;
  detail?: DayCloseDetail | null;
}) {
  const financial =
    snapshot?.evidence?.financial ?? snapshot?.financial_summary;
  const methods = snapshot?.payment_distribution ?? {};
  const movements = financial?.account_movements ?? [];
  const movementTypes = [
    ...accountTypeOrder,
    ...Array.from(
      new Set(movements.map((row) => row.head_type.toLowerCase())),
    ).filter((headType) => !accountTypeOrder.includes(headType)),
  ];
  const movementGroups = movementTypes
    .map((headType) => ({
      headType,
      rows: movements.filter((row) => row.head_type.toLowerCase() === headType),
    }))
    .filter((group) => group.rows.length > 0);
  const period = snapshot?.evidence?.period;
  const ledgerHref = (headId: number) => {
    const params = new URLSearchParams({ head_id: String(headId) });
    if (period?.period_start_at) {
      params.set("date_from", period.period_start_at.slice(0, 10));
      params.set("period_start_at", period.period_start_at);
    }
    if (period?.period_end_at) {
      params.set("date_to", period.period_end_at.slice(0, 10));
      params.set("period_end_at", period.period_end_at);
    }
    if (period?.business_line) {
      params.set("business_line", period.business_line);
    }
    return `/finance/reports/account-ledger?${params.toString()}`;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[92dvh] overflow-y-auto rounded-t-3xl pb-[max(1rem,env(safe-area-inset-bottom))] sm:inset-y-0 sm:left-auto sm:right-0 sm:h-full sm:max-h-none sm:w-[440px] sm:rounded-none sm:border-l sm:border-t-0"
      >
        <SheetHeader className="text-left">
          <SheetTitle>Financial details</SheetTitle>
          <SheetDescription>
            Supporting totals for this close period. Performance analysis
            remains in Analytics.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-7">
          <section>
            <h3 className="font-semibold">Income recognized</h3>
            <dl className="mt-2 divide-y border-y border-border">
              <Row
                label="Gross sales"
                value={amount(financial?.gross_sales ?? detail?.gross_sales)}
              />
              <Row
                label="Discounts"
                value={amount(
                  financial?.discount_total ?? detail?.discount_total,
                )}
              />
              <Row
                label="Tax"
                value={amount(financial?.tax_total ?? detail?.tax_total)}
              />
              <Row
                label="Service charge"
                value={amount(
                  financial?.service_charge_total ??
                    detail?.service_charge_total,
                )}
              />
              <Row
                label="Sales"
                value={amount(financial?.net_sales ?? detail?.net_sales)}
              />
              <Row
                label="Other income"
                value={amount(financial?.manual_income_total)}
              />
              <Row
                label="Total income"
                value={amount(financial?.total_income)}
                strong
              />
            </dl>
          </section>

          <section>
            <h3 className="font-semibold">Payments</h3>
            <dl className="mt-2 divide-y border-y border-border">
              <Row
                label="Cash"
                value={amount(
                  typeof methods.cash === "number"
                    ? methods.cash
                    : methods.cash?.amount,
                )}
              />
              <Row
                label="Card"
                value={amount(
                  typeof methods.card === "number"
                    ? methods.card
                    : methods.card?.amount,
                )}
              />
              <Row
                label="Digital / QR"
                value={amount(
                  typeof methods.digital === "number"
                    ? methods.digital
                    : methods.digital?.amount,
                )}
              />
              <Row
                label="FonePay"
                value={amount(
                  typeof methods.fonepay === "number"
                    ? methods.fonepay
                    : methods.fonepay?.amount,
                )}
              />
              <Row
                label="Payments collected"
                value={amount(financial?.collections_total)}
                strong
              />
            </dl>
          </section>

          <section>
            <h3 className="font-semibold">Credit — this period</h3>
            <dl className="mt-2 divide-y border-y border-border">
              <Row
                label="Credit sales"
                value={amount(financial?.credit_sales ?? detail?.credit_sales)}
              />
              <Row
                label="Credit collected"
                value={amount(
                  financial?.credit_collections ?? detail?.credit_collections,
                )}
              />
            </dl>
          </section>

          <section>
            <h3 className="font-semibold">Balance at close</h3>
            <dl className="mt-2 divide-y border-y border-border">
              <Row
                label="Outstanding receivables"
                value={amount(
                  financial?.outstanding_receivables_at_close ??
                    detail?.outstanding_receivables,
                )}
              />
            </dl>
          </section>

          <section>
            <h3 className="font-semibold">Costs recognized</h3>
            <dl className="mt-2 divide-y border-y border-border">
              <Row
                label="Cost of goods sold"
                value={amount(financial?.recognized_cogs)}
              />
              <Row
                label="Other recognized expenses"
                value={amount(financial?.other_recognized_expenses)}
              />
              <Row
                label="Total recognized costs"
                value={amount(
                  financial?.expense_total ?? detail?.expense_total,
                )}
                strong
              />
            </dl>
          </section>

          <section>
            <h3 className="font-semibold">Money paid out</h3>
            <dl className="mt-2 divide-y border-y border-border">
              <Row
                label="Customer refunds"
                value={amount(financial?.refund_total ?? detail?.refund_total)}
              />
              <Row
                label="Inventory purchases paid"
                value={amount(financial?.inventory_purchases_paid)}
              />
              <Row
                label="Supplier bills paid"
                value={amount(financial?.supplier_payments)}
              />
            </dl>
          </section>

          <section>
            <h3 className="font-semibold">Purchasing and suppliers</h3>
            <dl className="mt-2 divide-y border-y border-border">
              <Row
                label="Inventory acquired"
                value={amount(financial?.inventory_acquired)}
              />
              <Row
                label="Purchase returns"
                value={amount(financial?.purchase_returns_total)}
              />
              <Row
                label="Refunds received from suppliers"
                value={amount(financial?.purchase_return_refunds)}
              />
              <Row
                label="Supplier credits received"
                value={amount(financial?.purchase_return_credits)}
              />
              <Row
                label="Supplier payables at close"
                value={amount(financial?.supplier_payables_at_close)}
              />
            </dl>
          </section>

          <section>
            <h3 className="font-semibold">Accounting movements</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Debit and credit movement for every account affected during this
              close period.
            </p>

            {!financial?.account_movements_complete ? (
              <div className="mt-3 flex gap-3 border-l-2 border-amber-500 px-3 py-2 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <div>
                  <p className="font-medium">
                    Accounting movements unavailable
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Resolve Finance review, then run the check again to see the
                    complete account movements.
                  </p>
                </div>
              </div>
            ) : movementGroups.length === 0 ? (
              <p className="mt-3 border-y border-border py-4 text-sm text-muted-foreground">
                No ledger accounts were affected during this close period.
              </p>
            ) : (
              <div className="mt-4 space-y-6">
                {movementGroups.map((group) => (
                  <div key={group.headType}>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {accountTypeLabel(group.headType)}
                    </h4>
                    <div className="mt-2 divide-y border-y border-border">
                      {group.rows.map((movement) => (
                        <Link
                          key={movement.head_id}
                          href={ledgerHref(movement.head_id)}
                          className="block py-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">
                                {movement.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {movement.code}
                              </p>
                            </div>
                            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                          </div>
                          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                            <div>
                              <dt className="text-muted-foreground">Opening</dt>
                              <dd className="mt-0.5 font-medium tabular-nums">
                                {balance(movement, "opening")}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground">Debit</dt>
                              <dd className="mt-0.5 font-medium tabular-nums">
                                {formatDayCloseCurrency(movement.period_debit)}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground">Credit</dt>
                              <dd className="mt-0.5 font-medium tabular-nums">
                                {formatDayCloseCurrency(movement.period_credit)}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground">Closing</dt>
                              <dd className="mt-0.5 font-medium tabular-nums">
                                {balance(movement, "closing")}
                              </dd>
                            </div>
                          </dl>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function FinancialDetailsButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      className="h-11 w-full justify-between px-0"
      onClick={onClick}
    >
      View financial details
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Button>
  );
}
