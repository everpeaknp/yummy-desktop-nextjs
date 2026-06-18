"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Banknote,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FilePenLine,
  FileSpreadsheet,
  FileText,
  History,
  Landmark,
  ListChecks,
  Map,
  NotebookPen,
  ReceiptText,
  Scale,
  Settings,
  Truck,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";

const accountingNavGroups = [
  {
    title: "Overview",
    eyebrow: "Start here",
    items: [
      { href: "/finance/accounting", label: "Health", icon: BookOpen },
    ],
  },
  {
    title: "Reports",
    eyebrow: "Ledgers & Reports",
    items: [
      { href: "/finance/accounting/trial-balance", label: "Trial Balance", icon: Scale },
      { href: "/finance/accounting/general-ledger", label: "General Ledger", icon: ClipboardList },
      { href: "/finance/accounting/customer-ledger", label: "Customer Ledger", icon: Users },
      { href: "/finance/accounting/ar-aging", label: "AR Aging", icon: Users },
      { href: "/finance/accounting/supplier-ledger", label: "Supplier Ledger", icon: Truck },
      { href: "/finance/accounting/ap-aging", label: "AP Aging", icon: Truck },
      { href: "/finance/accounting/cash-flow", label: "Cash Flow", icon: Banknote },
      { href: "/finance/accounting/profit-loss", label: "P&L", icon: FileText },
      { href: "/finance/accounting/balance-sheet", label: "Balance Sheet", icon: ListChecks },
    ],
  },
  {
    title: "Setup",
    eyebrow: "Accounting setup",
    items: [
      { href: "/finance/accounting/setup", label: "Setup", icon: Settings },
      { href: "/finance/accounting/opening-balances", label: "Opening Balances", icon: NotebookPen },
      { href: "/finance/accounting/chart-of-accounts", label: "Accounts", icon: Landmark },
      { href: "/finance/accounting/ledger-mapping", label: "Mappings", icon: Map },
    ],
  },
  {
    title: "Controls",
    eyebrow: "Tax & Settlement",
    items: [
      { href: "/finance/accounting/vouchers", label: "Vouchers", icon: FilePenLine },
      { href: "/finance/accounting/daybook", label: "Daybook", icon: Banknote },
      { href: "/finance/accounting/day-closes", label: "Day Closes", icon: History },
      { href: "/finance/accounting/period-reports", label: "Period Reports", icon: FileSpreadsheet },
      { href: "/finance/accounting/periods", label: "Periods", icon: CalendarDays },
      { href: "/finance/accounting/settlements", label: "Settlements", icon: CreditCard },
      { href: "/finance/accounting/vat-summary", label: "VAT", icon: ReceiptText },
      { href: "/finance/accounting/vat-export", label: "VAT Export", icon: FileSpreadsheet },
    ],
  },
];

export function AccountingNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Accounting navigation" className="grid gap-3 xl:grid-cols-[1fr_0.75fr_2.3fr_1fr]">
      {accountingNavGroups.map((group) => (
        <section key={group.title} className="rounded-md border border-border bg-background p-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {group.title}
            {group.eyebrow ? <span className="ml-2 normal-case tracking-normal opacity-70">{group.eyebrow}</span> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {group.items.map((link) => {
              const Icon = link.icon;
              const active =
                pathname === link.href ||
                (link.href !== "/finance/accounting" && pathname.startsWith(`${link.href}/`));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </nav>
  );
}
