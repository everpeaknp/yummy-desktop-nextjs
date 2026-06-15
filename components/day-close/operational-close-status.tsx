"use client";

import { AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import type { DayCloseDetail } from "@/types/day-close";

type OperationalCloseStatusProps = {
  detail: DayCloseDetail | null;
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

export function OperationalCloseStatus({ detail }: OperationalCloseStatusProps) {
  const status = reviewStatus(detail);
  const blockerRows = blockers(detail);
  const accountingReady = ["ready", "reviewed", "posted"].includes(status) && blockerRows.length === 0;
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
            The cashier/manager evidence packet is saved. Cash drawer evidence is now available for accounting review.
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
          {needsReview ? <AlertTriangle className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
        </div>
        <div>
          <div className="text-sm font-semibold">
            {needsReview ? "Accounting review required" : "Accounting ready"}
          </div>
          <div className="text-xs opacity-80">
            {needsReview
              ? "Accountant review is still needed before this day can support period locking."
              : "Accounting checks are clean and the day can move into review approval."}
          </div>
          {blockerRows.length ? (
            <ul className="mt-2 space-y-1 text-xs">
              {blockerRows.map((blocker) => (
                <li key={blocker}>- {blocker}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}
