"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  ArrowDownUp,
  ArrowRight,
  Banknote,
  BookOpenCheck,
  CreditCard,
  FileBarChart,
  Landmark,
  Loader2,
  Receipt,
  Settings,
  ShoppingCart,
  CircleDollarSign,
  TrendingDown,
  TrendingUp,
  BadgeDollarSign,
} from "lucide-react";

import apiClient from "@/lib/api-client";
import { FinanceApis } from "@/lib/api/endpoints";
import { useAuth } from "@/hooks/use-auth";
import { AppPage } from "@/components/patterns/page/app-page";
import { PageHeader } from "@/components/patterns/page/page-header";
import { SearchField } from "@/components/patterns/controls/search-field";
import { cn } from "@/lib/utils";
import type { FinanceOverviewResponse } from "@/types/finance";

type ModuleLink = {
  group: "Daily work" | "Cash control" | "Books and review";
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  keywords: string;
  tone: string;
  actions: Array<{ label: string; href: string }>;
};

const modules: ModuleLink[] = [
  {
    group: "Daily work",
    title: "Sales",
    description: "Invoices, completed sales, and sales returns.",
    href: "/finance/sales",
    icon: Receipt,
    keywords: "sales invoice return refund customer receivable collection",
    tone: "bg-emerald-500/10 text-emerald-600",
    actions: [
      { label: "Invoices", href: "/finance/sales" },
      { label: "Sales returns", href: "/finance/sales/returns" },
      { label: "Customers", href: "/customers" },
    ],
  },
  {
    group: "Daily work",
    title: "Purchases",
    description: "Purchase documents, receiving, payment state, and returns.",
    href: "/finance/purchases",
    icon: ShoppingCart,
    keywords: "purchase supplier bill return payable settlement inventory",
    tone: "bg-amber-500/10 text-amber-600",
    actions: [
      { label: "Purchases", href: "/finance/purchases" },
      { label: "Purchase returns", href: "/finance/purchases/returns" },
      { label: "Suppliers", href: "/suppliers" },
    ],
  },
  {
    group: "Daily work",
    title: "Other income",
    description: "Rent, commission, interest, grants, and other non-sales income.",
    href: "/finance/other-income",
    icon: CircleDollarSign,
    keywords: "income rent commission interest grant manual revenue",
    tone: "bg-violet-500/10 text-violet-600",
    actions: [{ label: "Open other income", href: "/finance/other-income" }],
  },
  {
    group: "Daily work",
    title: "Expenses",
    description: "Recognized costs from manual and source-owned workflows.",
    href: "/finance/expenses",
    icon: TrendingDown,
    keywords: "expense salary rent utilities manual cost inventory",
    tone: "bg-rose-500/10 text-rose-600",
    actions: [{ label: "Open expenses", href: "/finance/expenses" }],
  },
  {
    group: "Daily work",
    title: "Payments",
    description: "Customer receipts, supplier payments, staff settlements, and their register.",
    href: "/finance/payments",
    icon: BadgeDollarSign,
    keywords: "payment in out receipt settlement customer supplier staff",
    tone: "bg-teal-500/10 text-teal-600",
    actions: [
      { label: "Payment register", href: "/finance/payments" },
      { label: "Customers", href: "/customers" },
      { label: "Suppliers", href: "/suppliers" },
    ],
  },
  {
    group: "Cash control",
    title: "Cash & banks",
    description: "Where money is held, transfers, payment instruments, and drawer close.",
    href: "/finance/operations",
    icon: Landmark,
    keywords: "cash bank drawer safe account transfer instrument day close",
    tone: "bg-sky-500/10 text-sky-600",
    actions: [
      { label: "Accounts", href: "/finance/operations" },
      { label: "Cash drawers", href: "/cash-drawers" },
      { label: "Day close", href: "/day-close" },
    ],
  },
  {
    group: "Books and review",
    title: "Transactions",
    description: "One chronological day book of every financial event.",
    href: "/finance/transactions",
    icon: ArrowDownUp,
    keywords: "transactions day book movement event audit",
    tone: "bg-blue-500/10 text-blue-600",
    actions: [{ label: "Open day book", href: "/finance/transactions" }],
  },
  {
    group: "Books and review",
    title: "Journal vouchers",
    description: "Balanced manual adjustments with approval-grade audit history.",
    href: "/finance/journals",
    icon: BookOpenCheck,
    keywords: "journal voucher adjustment debit credit",
    tone: "bg-rose-500/10 text-rose-600",
    actions: [{ label: "Journal register", href: "/finance/journals" }],
  },
  {
    group: "Books and review",
    title: "Reports",
    description: "Statements, ledgers, tax books, and reconciliation.",
    href: "/finance/reports",
    icon: FileBarChart,
    keywords: "report profit loss balance sheet trial balance tax ledger",
    tone: "bg-indigo-500/10 text-indigo-600",
    actions: [{ label: "All reports", href: "/finance/reports" }],
  },
  {
    group: "Books and review",
    title: "Finance setup",
    description: "Financial categories, accounts, instruments, drawers, and tax settings.",
    href: "/finance/setup",
    icon: Settings,
    keywords: "setup account heads categories instruments drawers tax opening balance",
    tone: "bg-slate-500/10 text-slate-600",
    actions: [{ label: "Open setup", href: "/finance/setup" }],
  },
];

function yyyyMmDd(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function money(value: number | undefined) {
  return `NPR ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function FinanceHomeClient() {
  const user = useAuth((state) => state.user);
  const [overview, setOverview] = useState<FinanceOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!user?.restaurant_id) return;
    let cancelled = false;
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    setLoading(true);
    apiClient
      .get(
        FinanceApis.overview({
          restaurantId: Number(user.restaurant_id),
          dateFrom: yyyyMmDd(start),
          dateTo: yyyyMmDd(now),
          businessLine: "all",
          timezone: "Asia/Kathmandu",
        }),
      )
      .then((response) => {
        if (!cancelled) setOverview(response.data?.data ?? response.data ?? null);
      })
      .catch(() => {
        if (!cancelled) setOverview(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.restaurant_id]);

  const visibleModules = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return modules;
    return modules.filter((item) =>
      `${item.title} ${item.description} ${item.keywords}`.toLowerCase().includes(value),
    );
  }, [query]);

  const visibleGroups = useMemo(
    () =>
      (["Daily work", "Cash control", "Books and review"] as const)
        .map((label) => ({ label, items: visibleModules.filter((item) => item.group === label) }))
        .filter((group) => group.items.length > 0),
    [visibleModules],
  );

  const metrics = overview?.metrics;
  const recognizedExpenses =
    Number(metrics?.manual_operating_expense || 0) +
    Number(metrics?.inventory_direct_expense || 0) +
    Number(metrics?.inventory_cogs || 0) +
    Number(metrics?.inventory_wastage || 0) +
    Number(metrics?.inventory_variance || 0);
  const alerts = [
    Number(metrics?.outstanding_receivables || 0) > 0
      ? { label: "Customer money to collect", value: money(metrics?.outstanding_receivables), href: "/customers" }
      : null,
    Number(metrics?.supplier_payables || 0) > 0
      ? { label: "Supplier bills to settle", value: money(metrics?.supplier_payables), href: "/suppliers" }
      : null,
    Number(metrics?.paid_open_orders_count || 0) > 0
      ? { label: "Paid orders still open", value: String(metrics?.paid_open_orders_count), href: "/orders" }
      : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <AppPage width="wide" density="compact">
      <PageHeader title="Finance" />
      <SearchField
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onClear={() => setQuery("")}
        placeholder="Find a finance task"
        containerClassName="w-full lg:ml-auto lg:max-w-sm"
      />

      <section aria-label="This month" className="grid grid-cols-2 overflow-hidden rounded-2xl border bg-card sm:grid-cols-4">
        {[
          { label: "Sales earned", value: metrics?.net_sales, icon: TrendingUp, help: "Net sales after discounts and refunds." },
          { label: "Money collected", value: metrics?.collections_total, icon: CreditCard, help: "Cash and bank receipts, including collections of older receivables." },
          { label: "Costs recognized", value: recognizedExpenses, icon: TrendingDown, help: "Operating costs recognized in this period." },
          { label: "Operating result", value: metrics?.operating_profit, icon: Banknote, help: "Income less recognized operating costs for the selected period." },
        ].map((metric) => (
          <div key={metric.label} className="flex min-w-0 items-start justify-between gap-2 border-b border-r p-3 even:border-r-0 [&:nth-last-child(-n+2)]:border-b-0 sm:border-b-0 sm:even:border-r sm:last:border-r-0 sm:p-4">
              <div className="min-w-0">
                <p className="truncate text-[11px] font-medium text-muted-foreground">{metric.label}</p>
                <p className="mt-1 truncate text-base font-semibold tabular-nums sm:text-xl">
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : money(metric.value)}
                </p>
                <p className="mt-1 hidden text-xs leading-5 text-muted-foreground sm:block">{metric.help}</p>
              </div>
              <metric.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
          </div>
        ))}
      </section>

      {alerts.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-amber-500/25 bg-amber-500/5">
          <div className="flex items-center gap-2 border-b border-amber-500/15 px-4 py-3 text-sm font-semibold">
            <AlertCircle className="h-4 w-4 text-amber-600" /> Needs attention
          </div>
          <div className="divide-y divide-amber-500/15 md:grid md:grid-cols-3 md:divide-x md:divide-y-0">
            {alerts.map((alert) => (
              <Link key={alert.label} href={alert.href} className="flex min-h-12 items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-background/70">
                <span className="text-muted-foreground">{alert.label}</span>
                <span className="font-semibold tabular-nums">{alert.value}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-4">
        {visibleModules.length ? (
          visibleGroups.map((group) => (
            <section key={group.label} className="space-y-2">
              <h2 className="text-sm font-semibold">{group.label}</h2>
              <div className="overflow-hidden rounded-2xl border bg-card md:grid md:grid-cols-2 xl:grid-cols-3">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.href} className="border-b last:border-b-0 md:border-r md:[&:nth-child(even)]:border-r-0 xl:[&:nth-child(even)]:border-r xl:[&:nth-child(3n)]:border-r-0">
                      <Link href={item.href} className="group flex min-h-[68px] items-center gap-3 px-3 py-3 hover:bg-muted/40">
                        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", item.tone)}>
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold">{item.title}</span>
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{item.description}</span>
                        </span>
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                      </Link>
                      <div className="hidden flex-wrap gap-x-3 border-t px-4 py-2 md:flex">
                        {item.actions.map((action) => (
                          <Link key={action.href} href={action.href} className="text-xs font-medium text-muted-foreground hover:text-primary">
                            {action.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
            No finance workspace matches “{query}”.
          </div>
        )}
      </section>
    </AppPage>
  );
}
