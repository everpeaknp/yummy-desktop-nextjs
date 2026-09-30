"use client";

import { AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatDayCloseCurrency } from "@/lib/day-close-format";
import type { DayClosePresentation } from "@/lib/presentation/day-close";
import type { DayCloseDetail } from "@/types/day-close";

type OperationalCloseStatusProps = {
  detail: DayCloseDetail | null;
  presentation?: DayClosePresentation;
};

function reviewStatus(detail: DayCloseDetail | null) {
  const direct = detail?.accounting_review?.status;
  if (direct) return String(direct);
  const status = detail?.accounting_status?.status;
  return status ? String(status) : "unknown";
}

function blockers(detail: DayCloseDetail | null) {
  const reviewBlockers = detail?.accounting_review?.blockers;
  if (Array.isArray(reviewBlockers)) return reviewBlockers.map(String);
  const raw = detail?.accounting_status?.blockers;
  return Array.isArray(raw) ? raw.map(String) : [];
}

export function OperationalCloseStatus({
  detail,
  presentation,
}: OperationalCloseStatusProps) {
  const status = reviewStatus(detail);
  const blockerRows = blockers(detail);
  const accountingReady =
    ["ready", "reviewed", "posted"].includes(status) &&
    blockerRows.length === 0;
  const needsReview = !accountingReady;

  return (
    <div className="grid gap-3 rounded-xl border bg-background p-4 text-left shadow-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-emerald-500/10 p-2 text-emerald-700">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <div>
          <div className="text-sm font-semibold">Operational day closed</div>
          <div className="text-xs text-muted-foreground">
            The close record and cash evidence have been saved.
          </div>
        </div>
      </div>

      <div
        className={cn(
          "flex items-start gap-3 rounded-lg border p-3",
          needsReview
            ? "border-amber-500/30 bg-amber-500/10 text-amber-900"
            : "border-emerald-500/30 bg-emerald-500/10 text-emerald-900",
        )}
      >
        <div className="mt-0.5">
          {needsReview ? (
            <AlertTriangle className="h-4 w-4" />
          ) : (
            <ShieldCheck className="h-4 w-4" />
          )}
        </div>
        <div>
          <div className="text-sm font-semibold">
            {needsReview ? "Finance review required" : "Finance check complete"}
          </div>
          <div className="text-xs opacity-80">
            {needsReview
              ? "An authorized finance user must review the accounting check."
              : "No finance action is required for this close."}
          </div>
        </div>
      </div>

      {presentation ? (
        <dl className="grid grid-cols-2 gap-x-5 gap-y-3 border-t pt-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Sales</dt>
            <dd className="font-medium tabular-nums">
              {formatDayCloseCurrency(presentation.summary.sales)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Payments collected</dt>
            <dd className="font-medium tabular-nums">
              {formatDayCloseCurrency(presentation.summary.paymentsCollected)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Cash counted</dt>
            <dd className="font-medium tabular-nums">
              {presentation.cash.counted == null
                ? "Not counted"
                : formatDayCloseCurrency(presentation.cash.counted)}
            </dd>
            <dd className="text-xs text-muted-foreground">
              {presentation.cash.countSourceLabel}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Cash difference</dt>
            <dd className="font-medium tabular-nums">
              {formatDayCloseCurrency(presentation.cash.difference)}
            </dd>
          </div>
        </dl>
      ) : null}

      {presentation?.warnings.length ? (
        <div className="border-t pt-3 text-xs text-muted-foreground">
          {presentation.warnings.map((warning) => (
            <p key={`${warning.code}-${warning.title}`}>
              <span className="font-medium text-foreground">
                {warning.title}.
              </span>{" "}
              {warning.description}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
