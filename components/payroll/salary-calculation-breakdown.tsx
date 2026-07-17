"use client";

import { useState } from "react";
import {
  CalendarCheck2,
  ChevronDown,
  Clock3,
  Info,
  ReceiptText,
  WalletCards,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { PayrollHistoryItem } from "@/lib/staff/workforce";
import { cn } from "@/lib/utils";

function money(value: number | null | undefined) {
  return `Rs. ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function duration(totalMinutes: number | null | undefined) {
  const value = Math.max(0, Number(totalMinutes || 0));
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${hours}h ${minutes}m`;
}

function readablePolicyValue(value: unknown): string {
  if (value == null) return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.map(readablePolicyValue).join(", ");
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, nested]) => `${key.replaceAll("_", " ")}: ${readablePolicyValue(nested)}`)
      .join("; ");
  }
  return String(value);
}

export function SalaryCalculationBreakdown({
  item,
  defaultOpen = false,
}: {
  item: PayrollHistoryItem;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const earned = Number(item.earned_amount ?? (
    Number(item.regular_pay || 0) +
    Number(item.overtime_pay || 0) +
    Number(item.holiday_premium_pay || 0)
  ));
  const grossAfterAdjustments =
    earned + Number(item.bonus || 0) - Number(item.deduction || 0);

  return (
    <div className="overflow-hidden rounded-xl border bg-background">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 p-4 text-left transition-colors hover:bg-muted/30"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">Salary calculation</p>
            <Badge variant="outline" className="capitalize">
              {item.salary_type}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {money(earned)} earnings + {money(item.bonus)} bonus -{" "}
            {money(item.deduction)} deductions - {money(item.tax_amount)} tax
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Net salary</p>
            <p className="font-bold">{money(item.net_pay)}</p>
          </div>
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
          />
        </div>
      </button>

      {open ? (
        <div className="space-y-5 border-t p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Summary
              icon={WalletCards}
              label="Salary basis"
              value={money(item.base_salary)}
              helper={`${item.salary_type} rate`}
            />
            <Summary
              icon={CalendarCheck2}
              label="Payable attendance"
              value={`${Number(item.payable_days || 0)} days`}
              helper={`${Number(item.scheduled_days || 0)} scheduled`}
            />
            <Summary
              icon={Clock3}
              label="Approved time"
              value={duration(item.regular_minutes)}
              helper={`${duration(item.overtime_minutes)} overtime`}
            />
            <Summary
              icon={ReceiptText}
              label="Final net salary"
              value={money(item.net_pay)}
              helper={`${item.period_days} calendar days`}
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <BreakdownSection title="Attendance used">
              <Line label="Scheduled days" value={String(Number(item.scheduled_days || 0))} />
              <Line label="Payable days" value={String(Number(item.payable_days || 0))} />
              <Line label="Absent days" value={String(Number(item.absent_days || 0))} warning={Number(item.absent_days || 0) > 0} />
              <Line label="Paid leave" value={`${Number(item.paid_leave_days || 0)} days`} />
              <Line label="Unpaid leave" value={`${Number(item.unpaid_leave_days || 0)} days`} />
              <Line label="Paid holidays" value={`${Number(item.paid_holiday_days || 0)} days`} />
              <Line label="Break time" value={duration(item.break_minutes)} />
            </BreakdownSection>

            <BreakdownSection title="Earnings">
              <Line label="Regular pay" value={money(item.regular_pay)} />
              <Line label="Overtime pay" value={money(item.overtime_pay)} />
              <Line label="Holiday premium" value={money(item.holiday_premium_pay)} />
              <Line label="Bonus" value={money(item.bonus)} />
              <Separator />
              <Line label="Earned subtotal" value={money(earned + Number(item.bonus || 0))} strong />
            </BreakdownSection>

            <BreakdownSection title="Reductions and result">
              <Line label="Other deductions" value={money(item.deduction)} warning={Number(item.deduction || 0) > 0} />
              <Line label="Tax" value={money(item.tax_amount)} warning={Number(item.tax_amount || 0) > 0} />
              <Separator />
              <Line label="After adjustments" value={money(grossAfterAdjustments)} />
              <Line label="Net salary" value={money(item.net_pay)} strong />
              {Number(item.absence_deduction || 0) > 0 ? (
                <div className="mt-2 rounded-lg bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-300">
                  Absence reduced regular pay by {money(item.absence_deduction)}.
                  This impact is already included above and is not deducted twice.
                </div>
              ) : null}
            </BreakdownSection>
          </div>

          <div className="rounded-xl border bg-muted/20 p-4">
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-semibold">Calculation evidence</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Salary effective {item.salary_effective_from || "for this period"};
                  daily reference rate {money(item.daily_rate)}.
                </p>
              </div>
            </div>
            {item.policy_evidence?.length ? (
              <div className="mt-3 space-y-2">
                {item.policy_evidence.map((evidence, index) => (
                  <div key={index} className="rounded-lg bg-background p-3 text-xs">
                    {Object.entries(evidence).map(([key, value]) => (
                      <p key={key} className="break-words">
                        <span className="font-medium capitalize">
                          {key.replaceAll("_", " ")}:
                        </span>{" "}
                        <span className="text-muted-foreground">
                          {readablePolicyValue(value)}
                        </span>
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">
                No additional policy evidence was stored for this calculation.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Summary({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: typeof WalletCards;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-muted/10 p-3">
      <div className="rounded-lg bg-primary/10 p-2 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-semibold">{value}</p>
        <p className="text-xs text-muted-foreground">{helper}</p>
      </div>
    </div>
  );
}

function BreakdownSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h4 className="mb-3 text-sm font-semibold">{title}</h4>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Line({
  label,
  value,
  strong = false,
  warning = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
  warning?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-right",
          strong && "font-bold",
          warning && "text-amber-700 dark:text-amber-400",
        )}
      >
        {value}
      </span>
    </div>
  );
}
