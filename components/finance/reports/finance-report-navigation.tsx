"use client";

import { usePathname, useRouter } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { reportGroups } from "@/components/finance/reports/finance-report-catalog";
import { BackButton } from "@/components/patterns/page/page-header";

export function FinanceReportNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const current = reportGroups.flatMap((group) => group.reports).find((report) => report.href === pathname);

  return (
    <div className="flex min-w-0 items-center gap-3 border-b border-border pb-3">
      <div className="flex min-w-0 flex-1 items-center gap-1">
        <BackButton href="/finance/reports" label="All reports" className="-ml-2" />
        <span className="truncate text-sm font-medium text-muted-foreground">All reports</span>
      </div>
      <Select value={current?.href} onValueChange={(href) => router.push(href)}>
        <SelectTrigger className="h-11 w-[min(15rem,60vw)] rounded-xl bg-background" aria-label="Switch report">
          <SelectValue placeholder="Switch report" />
        </SelectTrigger>
        <SelectContent>
          {reportGroups.map((group) => (
            <SelectGroup key={group.label}>
              <SelectLabel>{group.label}</SelectLabel>
              {group.reports.map((report) => (
                <SelectItem key={report.href} value={report.href}>{report.label}</SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
