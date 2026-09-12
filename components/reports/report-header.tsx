import * as React from "react";
import { CalendarDays } from "lucide-react";

import { PageHeader, type PageHeaderProps } from "@/components/patterns/page/page-header";
import { cn } from "@/lib/utils";

export interface ReportHeaderProps extends PageHeaderProps {
  period?: React.ReactNode;
  context?: React.ReactNode[];
}

export function ReportHeader({ period, context = [], meta, className, ...props }: ReportHeaderProps) {
  const reportMeta = period || context.length ? (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
      {period ? <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{period}</span> : null}
      {context.map((item, index) => <span key={index} className="truncate">{item}</span>)}
    </div>
  ) : null;

  return <PageHeader className={cn(className)} meta={meta ?? reportMeta} {...props} />;
}

