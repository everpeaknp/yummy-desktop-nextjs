"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";

import apiClient from "@/lib/api-client";
import { DayCloseApis } from "@/lib/api/endpoints";
import {
  formatDayCloseBusinessDate,
  formatDayCloseCurrency,
  formatDayClosePeriod,
} from "@/lib/day-close-format";
import { getApiErrorMessage } from "@/lib/api-error-message";
import { hasPermission } from "@/lib/role-permissions";
import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";
import { AppPage } from "@/components/patterns/page/app-page";
import {
  ErrorState,
  LoadingState,
} from "@/components/patterns/feedback/feedback-state";
import { Button } from "@/components/ui/button";
import type { BusinessLine, DayCloseValidateResult } from "@/types/day-close";
import { parseDayCloseValidateResult, unwrapApiData } from "@/types/day-close";

type AccountingDiagnostic = {
  code: string;
  label?: string;
  count?: number;
  amount?: number;
};

const DIAGNOSTIC_COPY: Record<
  string,
  {
    title: string;
    description: (diagnostic: AccountingDiagnostic) => string;
    steps: string[];
    actionLabel: string;
    actionHref: string;
  }
> = {
  "unposted-events": {
    title: "Some older activity needs administrator review",
    description: (diagnostic) =>
      diagnostic.count
        ? `${diagnostic.count} transaction${diagnostic.count === 1 ? " could" : "s could"} not be added to the current reporting ledger automatically.`
        : "Some activity in this close period could not be added to the current reporting ledger automatically.",
    steps: [
      "Ask a finance administrator to review the affected source transactions and account setup.",
      "After the underlying issue is corrected, return here and run the check again.",
    ],
    actionLabel: "",
    actionHref: "",
  },
  "suspense-postings": {
    title: "Some entries need the correct account",
    description: (diagnostic) =>
      diagnostic.count
        ? `${diagnostic.count} journal entr${diagnostic.count === 1 ? "y was" : "ies were"} sent to Suspense because an account mapping could not be resolved.`
        : "One or more journal entries were sent to Suspense because an account mapping could not be resolved.",
    steps: [
      "Identify the payment or transaction type shown in the affected entries.",
      "Ask an authorized finance user to add or correct its account mapping.",
      "Correct the affected entries, then run this check again.",
    ],
    actionLabel: "Open finance setup",
    actionHref: "/settings/finance",
  },
  "trial-balance-difference": {
    title: "Debits and credits do not balance",
    description: (diagnostic) =>
      diagnostic.amount
        ? `The ledger is out of balance by ${formatDayCloseCurrency(diagnostic.amount)} for this close period.`
        : "The debit and credit totals do not match for this close period.",
    steps: [
      "Open the Trial Balance for this period.",
      "Find the journal or correction that has unequal debit and credit totals.",
      "Correct it, then return here and run the check again.",
    ],
    actionLabel: "Open Trial Balance",
    actionHref: "/finance/reports/trial-balance",
  },
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readDiagnostics(
  validation: DayCloseValidateResult | null,
): AccountingDiagnostic[] {
  const issue = validation?.issues?.find(
    (item) => item.code === "ACCOUNTING_REVIEW_REQUIRED",
  );
  const details = issue?.details;
  const structured = Array.isArray(details?.diagnostics)
    ? details.diagnostics.flatMap((value) => {
        const row = asRecord(value);
        if (!row?.code) return [];
        return [
          {
            code: String(row.code),
            label: row.label == null ? undefined : String(row.label),
            count: typeof row.count === "number" ? row.count : undefined,
            amount: typeof row.amount === "number" ? row.amount : undefined,
          } satisfies AccountingDiagnostic,
        ];
      })
    : [];
  if (structured.length) return structured;

  return Array.isArray(details?.diagnostic_codes)
    ? details.diagnostic_codes.map((code) => ({ code: String(code) }))
    : [];
}

export default function DayCloseFinanceReviewPage() {
  const user = useAuth((state) => state.user);
  const restaurant = useRestaurant((state) => state.restaurant);
  const search = useSearchParams();
  const [validation, setValidation] = useState<DayCloseValidateResult | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const businessDate = search.get("business_date") ?? "";
  const businessLine = (
    search.get("business_line") === "hotel"
      ? "hotel"
      : search.get("business_line") === "combined"
        ? "combined"
        : "restaurant"
  ) as BusinessLine;
  const restaurantId = user?.restaurant_id;
  const canView = hasPermission(user, "finance.accounting.periods.close");

  const dayCloseHref = `/day-close?${new URLSearchParams({
    business_date: businessDate,
    business_line: businessLine,
  }).toString()}`;

  const load = useCallback(async () => {
    if (!restaurantId || !businessDate || !canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const validationResponse = await apiClient.get(
        DayCloseApis.validateClose({
          restaurantId,
          businessLine,
          businessDate,
        }),
      );
      const result = unwrapApiData(
        validationResponse.data,
        parseDayCloseValidateResult,
      );
      if (!result)
        throw new Error("The finance review response is incomplete.");
      setValidation(result);
    } catch (loadError) {
      setError(
        getApiErrorMessage(loadError, "Could not load the finance review."),
      );
    } finally {
      setLoading(false);
    }
  }, [businessDate, businessLine, canView, restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const diagnostics = useMemo(() => readDiagnostics(validation), [validation]);
  const period = formatDayClosePeriod(
    validation?.period_start_at,
    validation?.period_end_at,
    restaurant?.timezone,
  );

  return (
    <AppPage width="reading" className="pb-8">
      <div className="mx-auto w-full max-w-3xl">
        {loading ? (
          <LoadingState label="Checking the ledger for this close…" />
        ) : !canView ? (
          <ErrorState
            title="Finance administrator access required"
            description="This diagnostic workspace is restricted to users responsible for accounting-period review."
          />
        ) : error ? (
          <ErrorState
            title="Finance review could not be loaded"
            description={error}
            actionLabel="Try again"
            onAction={() => void load()}
          />
        ) : (
          <div className="space-y-7">
            <header className="space-y-2 border-b border-border pb-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Day close finance review
                  </p>
                  <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                    {formatDayCloseBusinessDate(
                      businessDate,
                      restaurant?.timezone,
                    )}
                  </h1>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11"
                  onClick={() => void load()}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Run check again
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Activity included: {period}
              </p>
            </header>

            {diagnostics.length ? (
              <>
                <section>
                  <div className="flex gap-3 border-l-2 border-destructive pl-4">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                    <div>
                      <h2 className="font-semibold">Why closing is blocked</h2>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        The ledger for this exact close period is not ready yet.
                        Resolve every item below, then run the check again.
                        Original transaction amounts and dates are not changed.
                      </p>
                    </div>
                  </div>
                </section>

                <section aria-labelledby="finance-issues-heading">
                  <h2
                    id="finance-issues-heading"
                    className="text-lg font-semibold"
                  >
                    What needs attention
                  </h2>
                  <div className="mt-2 divide-y border-y border-border">
                    {diagnostics.map((diagnostic) => {
                      const copy = DIAGNOSTIC_COPY[diagnostic.code];
                      return (
                        <article key={diagnostic.code} className="py-5">
                          <h3 className="font-semibold">
                            {copy?.title ??
                              diagnostic.label ??
                              "Accounting check needs review"}
                          </h3>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">
                            {copy?.description(diagnostic) ??
                              "An authorized finance user needs to review this ledger exception."}
                          </p>
                          {copy ? (
                            <div className="mt-4">
                              <p className="text-sm font-semibold">
                                How to resolve it
                              </p>
                              <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-6 text-muted-foreground">
                                {copy.steps.map((step) => (
                                  <li key={step}>{step}</li>
                                ))}
                              </ol>
                              {copy.actionHref && copy.actionLabel ? (
                                <Button
                                  asChild
                                  variant="outline"
                                  className="mt-4 min-h-11"
                                >
                                  <Link href={copy.actionHref}>
                                    {copy.actionLabel}
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                  </Link>
                                </Button>
                              ) : null}
                            </div>
                          ) : null}
                          <details className="mt-4 text-xs text-muted-foreground">
                            <summary className="cursor-pointer py-1 font-medium">
                              Technical detail
                            </summary>
                            <p className="mt-1 font-mono">{diagnostic.code}</p>
                          </details>
                        </article>
                      );
                    })}
                  </div>
                </section>
              </>
            ) : (
              <section className="border-y border-border py-6">
                <div className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  <div>
                    <h2 className="font-semibold">Finance check is clear</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      No accounting blocker is currently reported for this close
                      period.
                    </p>
                  </div>
                </div>
              </section>
            )}

            <Button asChild className="h-11 w-full sm:w-auto">
              <Link href={dayCloseHref}>Return to Day close</Link>
            </Button>
          </div>
        )}
      </div>
    </AppPage>
  );
}
