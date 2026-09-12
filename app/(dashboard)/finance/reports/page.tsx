import Link from "next/link";
import { BarChart3, BookOpen, ChevronRight, Landmark, ReceiptText } from "lucide-react";

import { reportGroups } from "@/components/finance/reports/finance-report-catalog";
import { AppPage } from "@/components/patterns/page/app-page";
import { PageHeader } from "@/components/patterns/page/page-header";
import { Card, CardContent } from "@/components/ui/card";

const groupIcons = [BarChart3, Landmark, BookOpen, ReceiptText];

export default function FinanceReportsPage() {
  return (
    <AppPage width="wide" density="compact">
      <PageHeader
        title="Reports"
        description="Choose the business question you want to answer. Each report opens with only the filters it needs."
      />

      <div className="grid gap-5 xl:grid-cols-2">
        {reportGroups.map((group, groupIndex) => {
          const Icon = groupIcons[groupIndex];
          return (
            <section key={group.label} className="space-y-2">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">{group.label}</h2>
              </div>
              <Card className="overflow-hidden rounded-2xl border-border shadow-none">
                <CardContent className="divide-y p-0">
                  {group.reports.map((report) => (
                    <Link key={report.href} href={report.href} className="group flex min-h-[64px] items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/50">
                      <div className="min-w-0">
                        <p className="font-medium">{report.label}</p>
                        <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground sm:text-sm">{report.description}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                    </Link>
                  ))}
                </CardContent>
              </Card>
            </section>
          );
        })}
      </div>
    </AppPage>
  );
}
