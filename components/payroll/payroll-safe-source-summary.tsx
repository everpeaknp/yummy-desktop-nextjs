"use client";

import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import type { DrawerCashControlSummary } from "@/types/accounting";

function money(value: number) {
  return `Rs. ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function PayrollSafeSourceSummary({
  summary,
  loading,
  loadFailed,
  amount,
}: {
  summary: DrawerCashControlSummary | null;
  loading: boolean;
  loadFailed: boolean;
  amount: number;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border p-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking Main Cash / Safe...
      </div>
    );
  }

  if (loadFailed || !summary) {
    return (
      <Alert variant="destructive">
        The Main Cash / Safe balance could not be verified. Refresh before
        recording a safe-funded payment.
      </Alert>
    );
  }

  const safeBalance = Number(summary.safe_cash || 0);
  const accountingReady =
    Boolean(summary.finance_accounting_enabled) &&
    Boolean(summary.accounting_v2_enabled) &&
    Boolean(summary.ledger_complete);
  const insufficient = Number.isFinite(amount) && amount > safeBalance + 0.001;

  return (
    <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Main Cash / Safe available
          </p>
          <p className="mt-1 text-xl font-bold">{money(safeBalance)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {summary.source_accounts?.safe_cash || "Account 1005 Main Cash / Safe"}
          </p>
        </div>
        <ShieldCheck className="h-5 w-5 text-blue-600" />
      </div>

      <div
        className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
          accountingReady
            ? "border-emerald-500/30 bg-emerald-500/10"
            : "border-amber-500/30 bg-amber-500/10"
        }`}
      >
        {accountingReady ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        ) : (
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        )}
        <div>
          <p className="font-medium">
            {accountingReady
              ? "Safe accounting is ready"
              : "Accounting readiness needs attention"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {accountingReady
              ? "The payment will credit account 1005 and remain visible in the ledger."
              : "The backend will stop the payment if the safe ledger cannot be posted correctly."}
          </p>
        </div>
      </div>

      {insufficient ? (
        <Alert variant="destructive">
          This payment exceeds the verified Main Cash / Safe balance by{" "}
          {money(amount - safeBalance)}.
        </Alert>
      ) : null}
    </div>
  );
}
