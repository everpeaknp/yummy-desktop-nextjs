import Link from "next/link";
import { ArrowRight, BarChart3, BookOpen, Landmark, ReceiptText } from "lucide-react";

import { reportGroups } from "@/components/finance/reports/finance-report-catalog";
import { Card, CardContent } from "@/components/ui/card";

const groupIcons = [BarChart3, Landmark, BookOpen, ReceiptText];

export default function FinanceReportsPage() {
  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-8 px-4 py-6 sm:px-6 lg:px-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Finance</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Reports</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Start with the business question you want to answer. Each report opens with only the filters relevant to it.
        </p>
      </header>

      <div className="grid gap-6 xl:grid-cols-2">
        {reportGroups.map((group, groupIndex) => {
          const Icon = groupIcons[groupIndex];
          return (
            <section key={group.label} className="space-y-3">
              <div className="flex items-center gap-2">
                <Icon className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">{group.label}</h2>
              </div>
              <Card className="overflow-hidden border-border shadow-none">
                <CardContent className="divide-y p-0">
                  {group.reports.map((report) => (
                    <Link key={report.href} href={report.href} className="group flex items-center justify-between gap-4 p-4 transition-colors hover:bg-muted/50">
                      <div>
                        <p className="font-medium">{report.label}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{report.description}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                    </Link>
                  ))}
                </CardContent>
              </Card>
            </section>
          );
        })}
      </div>
    </div>
  );
}
