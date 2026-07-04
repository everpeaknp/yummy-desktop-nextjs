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
  PackageOpen,
  ReceiptText,
  Scale,
  Settings,
  Truck,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { hasPermission, type PermissionKey } from "@/lib/role-permissions";

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
      { href: "/finance/accounting/inventory", label: "Inventory", icon: PackageOpen, permission: "inventory.accounting.view" as PermissionKey },
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
  const user = useAuth((state) => state.user);

  return (
    <nav
      aria-label="Accounting navigation"
      className="rounded-2xl border border-border/60 bg-card/70 p-4 shadow-sm backdrop-blur-sm"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Accounting Map
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Jump straight to setup, controls, and reports.
          </p>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
      {accountingNavGroups.map((group) => (
        <section
          key={group.title}
          className="rounded-xl border border-border/50 bg-background/60 p-3"
        >
          <div className="mb-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {group.title}
            </div>
            {group.eyebrow ? (
              <div className="mt-1 text-xs text-muted-foreground">{group.eyebrow}</div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {group.items.filter((link) => !("permission" in link) || hasPermission(user, link.permission as PermissionKey)).map((link) => {
              const Icon = link.icon;
              const active =
                pathname === link.href ||
                (link.href !== "/finance/accounting" && pathname.startsWith(`${link.href}/`));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors",
                    active
                      ? "border-primary/80 bg-primary text-primary-foreground shadow-sm"
                      : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
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
      </div>
    </nav>
  );
}
