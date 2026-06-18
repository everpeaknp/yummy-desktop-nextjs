"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { accountingEventLabel } from "@/lib/accounting-event-labels";
import type { MappingExceptionReportResponse, MappingExceptionRow } from "@/types/accounting";

type MappingExceptionResolverProps = {
  report: MappingExceptionReportResponse | null;
  onCreateMapping: (eventType: string, paymentMethod: string | null, businessLine: string) => void;
  onOpenSourceTrace: (row: MappingExceptionRow) => void;
  onReverseRepost: (row: MappingExceptionRow) => Promise<void>;
  busyKey?: string | null;
};

function rowKey(row: MappingExceptionRow) {
  return `${row.event_type}-${row.payment_method ?? "any"}-${row.business_line}`;
}

export function MappingExceptionResolver({
  report,
  onCreateMapping,
  onOpenSourceTrace,
  onReverseRepost,
  busyKey,
}: MappingExceptionResolverProps) {
  const rows = report?.rows ?? [];
  if (rows.length === 0) return null;

  return (
    <Card className="border-amber-500/30">
      <CardHeader className="border-b border-amber-500/20 p-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          Mapping exception resolver
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        <p className="text-sm text-muted-foreground">
          Creating a mapping fixes future postings only. It does not automatically fix already-posted journals.
        </p>
        {rows.map((row) => {
          const label = accountingEventLabel(row.event_type);
          const key = rowKey(row);
          const isBusy = busyKey === key;
          const amount = Number(row.suspense_amount || 0).toLocaleString();
          return (
            <div
              key={key}
              className="rounded-md border border-border p-3"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="font-semibold">{label.label}</div>
                  <div className="text-xs text-muted-foreground">{label.meaning}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {row.event_type} | {row.payment_method || "Any method"} | {row.business_line} |{" "}
                    {row.count} events | Rs. {Number(row.suspense_amount || 0).toLocaleString()}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={isBusy}
                    onClick={() => onCreateMapping(row.event_type, row.payment_method ?? null, row.business_line)}
                  >
                    Create mapping for future postings
                  </Button>
                  <Button size="sm" variant="outline" disabled={isBusy} onClick={() => onOpenSourceTrace(row)}>
                    Open source trace
                  </Button>
                  <Link href="/finance/accounting/vouchers">
                    <Button size="sm" variant="outline" disabled={isBusy}>
                      Create correction voucher
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isBusy}
                    onClick={async () => {
                      const confirmed = window.confirm(
                        `Reverse and repost ${row.count} suspense journal(s) for Rs. ${amount}? This reverses existing suspense journals and reposts them through the active mapping.`
                      );
                      if (!confirmed) return;
                      await onReverseRepost(row);
                    }}
                  >
                    {isBusy ? "Reposting..." : "Reverse and repost"}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
