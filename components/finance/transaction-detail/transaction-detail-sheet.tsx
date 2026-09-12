"use client";

import type { ReactNode } from "react";
import { CalendarDays, ExternalLink, Hash, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn, formatCurrency } from "@/lib/utils";

export type TransactionDetailField = {
  label: string;
  value: ReactNode;
  fullWidth?: boolean;
};

export type TransactionDetailTable = {
  columns: string[];
  rows: Array<Array<ReactNode>>;
};

export type TransactionDetailSection = {
  title: string;
  description?: string;
  fields?: TransactionDetailField[];
  table?: TransactionDetailTable;
  emptyText?: string;
  /** Internal finance/audit context. Never show this in the operator sheet. */
  internal?: boolean;
};

export type TransactionDetailModel = {
  eyebrow: string;
  title: string;
  reference?: string | null;
  subtitle?: string | null;
  occurredAt?: string | null;
  status?: string | null;
  amount?: number | string | null;
  amountLabel?: string;
  amountTone?: "in" | "out" | "neutral";
  badges?: string[];
  sections: TransactionDetailSection[];
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: TransactionDetailModel | null;
  loading?: boolean;
  error?: string | null;
  actionHref?: string | null;
  actionLabel?: string;
  footer?: ReactNode;
};

function humanize(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dateTime(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusBadgeTone(status: string | null | undefined) {
  const value = String(status || "").toLowerCase();
  if (
    ["paid", "fully paid", "fully_paid", "fully_settled", "settled"].includes(
      value,
    )
  ) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (
    [
      "partially paid",
      "partially_paid",
      "partial",
      "unpaid",
      "open",
      "pending",
    ].includes(value)
  ) {
    return "border-orange-200 bg-orange-50 text-orange-700";
  }
  if (["voided", "reversed", "cancelled", "failed"].includes(value)) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  return "border-border bg-muted text-muted-foreground";
}

const internalFieldLabels = new Set([
  "source owner",
  "source id",
  "source status",
  "financial date",
  "transaction type",
  "instrument type",
  "business",
  "station",
  "order / source id",
]);

const duplicateSummaryLabels = new Set([
  "amount",
  "paid amount",
  "original amount",
  "invoice total",
  "purchase total",
  "return total",
  "grand total",
]);

function hasUserValue(value: ReactNode) {
  if (value == null) return false;
  if (typeof value !== "string") return true;
  const normalized = value.trim().toLowerCase();
  return !["", "—", "n/a", "not recorded", "unknown"].includes(normalized);
}

function DetailSection({
  section,
  hasHeaderAmount,
}: {
  section: TransactionDetailSection;
  hasHeaderAmount: boolean;
}) {
  const visibleFields = (section.fields || []).filter((field) => {
    const label = field.label.trim().toLowerCase();
    if (!hasUserValue(field.value)) return false;
    if (/(^|\s)id$/i.test(label) || internalFieldLabels.has(label)) {
      return false;
    }
    return !hasHeaderAmount || !duplicateSummaryLabels.has(label);
  });
  const hasFields = visibleFields.length > 0;
  const hasRows = Boolean(section.table?.rows.length);

  return (
    <section className="border-b border-border px-4 py-4 last:border-b-0 sm:px-6 sm:py-5">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-foreground">
          {section.title}
        </h3>
        {section.description ? (
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {section.description}
          </p>
        ) : null}
      </div>

      {hasFields ? (
        <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          {visibleFields.map((field, index) => (
            <div
              key={`${field.label}-${index}`}
              className={cn(
                "min-w-0 border-l border-border pl-3",
                field.fullWidth && "sm:col-span-2",
              )}
            >
              <dt className="text-[11px] font-medium leading-4 text-muted-foreground">
                {field.label}
              </dt>
              <dd className="mt-1 break-words text-sm font-medium leading-5 text-foreground">
                {field.value ?? "Not recorded"}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {hasRows && section.table ? (
        <>
          <div className="divide-y divide-border border-y border-border sm:hidden">
            {section.table.rows.map((row, rowIndex) => (
              <dl key={rowIndex} className="py-3 first:pt-0 last:pb-0">
                {section.table!.columns.map((column, columnIndex) => (
                  <div
                    key={column}
                    className="flex items-start justify-between gap-4 py-1.5 first:pt-0 last:pb-0"
                  >
                    <span className="text-xs text-muted-foreground">
                      {column}
                    </span>
                    <span className="min-w-0 text-right text-sm font-medium">
                      {row[columnIndex] ?? "Not recorded"}
                    </span>
                  </div>
                ))}
              </dl>
            ))}
          </div>
          <div className="hidden overflow-x-auto border-y border-border sm:block">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="border-b border-border bg-muted/50 text-left text-[11px] font-medium text-muted-foreground">
                <tr>
                  {section.table.columns.map((column, index) => (
                    <th
                      key={column}
                      className={cn("px-3 py-2.5", index > 0 && "text-right")}
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {section.table.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <td
                        key={cellIndex}
                        className={cn(
                          "px-3 py-3 align-top",
                          cellIndex > 0 && "text-right tabular-nums",
                        )}
                      >
                        {cell ?? "Not recorded"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {!hasFields && !hasRows ? (
        <p className="text-sm text-muted-foreground">
          {section.emptyText || "No details recorded."}
        </p>
      ) : null}
    </section>
  );
}

export function TransactionDetailSheet({
  open,
  onOpenChange,
  detail,
  loading = false,
  error,
  actionHref,
  actionLabel = "Open source",
  footer,
}: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex h-dvh w-full flex-col gap-0 overflow-hidden p-0 sm:h-auto sm:max-w-3xl lg:max-w-[860px]">
        <SheetHeader className="sticky top-0 z-10 shrink-0 border-b border-border bg-background px-4 py-4 pr-12 text-left sm:px-6 sm:py-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">
                {detail?.eyebrow || "Transaction details"}
              </p>
              <SheetTitle className="mt-1 break-words text-xl font-semibold leading-tight tracking-tight sm:text-2xl">
                {detail?.title || "Transaction"}
              </SheetTitle>
              <SheetDescription className="mt-2 max-w-xl text-sm leading-5">
                {detail?.subtitle ||
                  "Review source, settlement, and audit details."}
              </SheetDescription>
            </div>
            {detail?.amount != null ? (
              <div className="shrink-0 border-t border-border pt-3 sm:min-w-40 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0 sm:text-right">
                <p className="text-[11px] font-medium text-muted-foreground">
                  {detail.amountLabel || "Amount"}
                </p>
                <p className="mt-1 whitespace-nowrap text-2xl font-semibold tracking-tight tabular-nums text-foreground">
                  {formatCurrency(detail.amount)}
                </p>
              </div>
            ) : null}
          </div>
          {detail ? (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3 text-xs text-muted-foreground">
              {detail.reference ? (
                <span className="inline-flex items-center gap-1.5">
                  <Hash className="h-3.5 w-3.5" />
                  {detail.reference}
                </span>
              ) : null}
              {dateTime(detail.occurredAt) ? (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {dateTime(detail.occurredAt)}
                </span>
              ) : null}
              {detail.status ? (
                <Badge
                  variant="outline"
                  className={cn(
                    "px-2 py-0.5 font-medium capitalize shadow-none",
                    statusBadgeTone(detail.status),
                  )}
                >
                  {humanize(detail.status)}
                </Badge>
              ) : null}
              {detail.badges?.map((badge) => (
                <Badge
                  key={badge}
                  variant="secondary"
                  className="bg-primary/10 px-2 py-0.5 font-medium capitalize text-primary shadow-none"
                >
                  {humanize(badge)}
                </Badge>
              ))}
            </div>
          ) : null}
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto bg-background">
          {loading ? (
            <div className="flex min-h-72 items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading complete details…
            </div>
          ) : null}
          {!loading && error ? (
            <div className="m-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          {!loading && !error && detail
            ? detail.sections
                .filter((section) => !section.internal)
                .map((section, index) => (
                  <DetailSection
                    key={`${section.title}-${index}`}
                    section={section}
                    hasHeaderAmount={detail.amount != null}
                  />
                ))
            : null}
        </div>

        {actionHref || footer ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border bg-background px-4 py-3 sm:px-6">
            {footer}
            {actionHref ? (
              <Button asChild variant="outline">
                <a href={actionHref}>
                  {actionLabel}
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            ) : null}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

export function transactionMetadataFields(
  metadata: Record<string, unknown> | null | undefined,
) {
  return Object.entries(metadata || {})
    .filter(([key, value]) => {
      if (value == null || typeof value === "object") return false;
      const normalized = key.trim().toLowerCase();
      // Database keys are valuable for support logs, but they are not useful
      // transaction details. Prefer the accompanying names/snapshots instead.
      return normalized !== "id" && !normalized.endsWith("_id");
    })
    .map(([key, value]) => ({
      label: humanize(key.replace(/_snapshot$/i, "")),
      value: typeof value === "string" ? humanize(value) : String(value),
    }));
}
