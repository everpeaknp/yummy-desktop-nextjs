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
import { cn } from "@/lib/utils";

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

function money(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return `NPR ${(Number.isFinite(parsed) ? parsed : 0).toLocaleString(
    undefined,
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  )}`;
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

function DetailSection({ section }: { section: TransactionDetailSection }) {
  const visibleFields = (section.fields || []).filter(
    (field) => !/(^|\s)id$/i.test(field.label.trim()),
  );
  const hasFields = visibleFields.length > 0;
  const hasRows = Boolean(section.table?.rows.length);

  return (
    <section className="border-b border-border px-4 py-5 last:border-b-0 sm:px-6">
      <div className="mb-4">
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
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          {visibleFields.map((field, index) => (
            <div
              key={`${field.label}-${index}`}
              className={cn("min-w-0", field.fullWidth && "sm:col-span-2")}
            >
              <dt className="text-xs font-medium text-muted-foreground">
                {field.label}
              </dt>
              <dd className="mt-1 break-words text-sm font-medium text-foreground">
                {field.value ?? "—"}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {hasRows && section.table ? (
        <>
          <div className="space-y-3 sm:hidden">
            {section.table.rows.map((row, rowIndex) => (
              <div
                key={rowIndex}
                className="rounded-lg border border-border p-3"
              >
                {section.table!.columns.map((column, columnIndex) => (
                  <div
                    key={column}
                    className="flex items-start justify-between gap-4 py-1.5 first:pt-0 last:pb-0"
                  >
                    <span className="text-xs text-muted-foreground">
                      {column}
                    </span>
                    <span className="min-w-0 text-right text-sm font-medium">
                      {row[columnIndex] ?? "—"}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="hidden overflow-x-auto rounded-lg border border-border sm:block">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs font-medium text-muted-foreground">
                <tr>
                  {section.table.columns.map((column) => (
                    <th key={column} className="px-3 py-2.5">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {section.table.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex} className="px-3 py-3 align-top">
                        {cell ?? "—"}
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
  const amountTone = detail?.amountTone || "neutral";
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl lg:max-w-[900px]">
        <SheetHeader className="shrink-0 border-b border-border px-4 py-4 text-left sm:px-6 sm:py-5">
          <div className="flex flex-col gap-4 pr-8 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                {detail?.eyebrow || "Transaction details"}
              </p>
              <SheetTitle className="mt-1 truncate text-xl sm:text-2xl">
                {detail?.title || "Transaction"}
              </SheetTitle>
              <SheetDescription className="mt-1 line-clamp-2">
                {detail?.subtitle ||
                  "Complete source, settlement and audit information."}
              </SheetDescription>
            </div>
            {detail?.amount != null ? (
              <div className="shrink-0 sm:text-right">
                <p className="text-xs font-medium text-muted-foreground">
                  {detail.amountLabel || "Amount"}
                </p>
                <p
                  className={cn(
                    "mt-1 text-xl font-semibold tabular-nums",
                    amountTone === "in" && "text-emerald-600",
                    amountTone === "out" && "text-rose-600",
                  )}
                >
                  {amountTone === "in"
                    ? "+ "
                    : amountTone === "out"
                      ? "− "
                      : ""}
                  {money(detail.amount)}
                </p>
              </div>
            ) : null}
          </div>
          {detail ? (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
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
                <Badge variant="outline" className="capitalize">
                  {humanize(detail.status)}
                </Badge>
              ) : null}
              {detail.badges?.map((badge) => (
                <Badge key={badge} variant="secondary" className="capitalize">
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
            ? detail.sections.map((section, index) => (
                <DetailSection
                  key={`${section.title}-${index}`}
                  section={section}
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
      value:
        typeof value === "string"
          ? humanize(value)
          : String(value),
    }));
}
