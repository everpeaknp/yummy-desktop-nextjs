"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, DollarSign, FileText, TrendingDown } from "lucide-react";

import { cn } from "@/lib/utils";

const tabs = [
  { href: "/finance/income", label: "Income", icon: DollarSign },
  { href: "/finance/expenses", label: "Expenses", icon: TrendingDown },
  { href: "/finance/reports", label: "Reports", icon: FileText },
  { href: "/finance/accounting", label: "Accounting", icon: BookOpen },
];

export function FinanceSectionTabs() {
  const pathname = usePathname();

  return (
    <div className="flex w-full overflow-x-auto border-b border-border">
      <div className="flex min-w-max gap-1 px-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors",
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
