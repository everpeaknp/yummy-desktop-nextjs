import * as React from "react";

import { MetricCard, type MetricCardProps } from "@/components/cards/metric-card";
import { cn } from "@/lib/utils";

export interface ReportSummaryProps extends React.HTMLAttributes<HTMLDivElement> {
  metrics: Array<MetricCardProps & { key: React.Key }>;
  columns?: 2 | 3 | 4;
}

export function ReportSummary({ metrics, columns = 4, className, ...props }: ReportSummaryProps) {
  const desktopColumns = columns === 2 ? "lg:grid-cols-2" : columns === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4";
  return (
    <div className={cn("grid min-w-0 grid-cols-2 gap-2.5 sm:gap-3", desktopColumns, className)} {...props}>
      {metrics.map(({ key, ...metric }) => <MetricCard key={key} {...metric} />)}
    </div>
  );
}

