"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

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

export function FinanceReportNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const current = reportGroups.flatMap((group) => group.reports).find((report) => report.href === pathname);

  return (
    <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
      <Link href="/finance/reports" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-2 h-4 w-4" />All reports
      </Link>
      <Select value={current?.href} onValueChange={(href) => router.push(href)}>
        <SelectTrigger className="w-full bg-background sm:w-64" aria-label="Switch report">
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
