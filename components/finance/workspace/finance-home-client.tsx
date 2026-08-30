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
  Search,
  Settings,
  ShoppingCart,
  CircleDollarSign,
  Users,
  TrendingDown,
  TrendingUp,
  BadgeDollarSign,
} from "lucide-react";

import apiClient from "@/lib/api-client";
import { FinanceApis } from "@/lib/api/endpoints";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { FinanceOverviewResponse } from "@/types/finance";

type ModuleLink = {
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
    title: "Purchases",
    description: "Purchase documents, receiving, payment state, and returns.",
    href: "/inventory/purchases",
    icon: ShoppingCart,
    keywords: "purchase supplier bill return payable settlement inventory",
    tone: "bg-amber-500/10 text-amber-600",
    actions: [
      { label: "Purchases", href: "/inventory/purchases" },
      { label: "Purchase returns", href: "/inventory/purchases/returns" },
      { label: "Suppliers", href: "/suppliers" },
    ],
  },
  {
    title: "Other income",
    description: "Rent, commission, interest, grants, and other non-sales income.",
    href: "/finance/other-income",
    icon: CircleDollarSign,
    keywords: "income rent commission interest grant manual revenue",
    tone: "bg-violet-500/10 text-violet-600",
    actions: [{ label: "Open other income", href: "/finance/other-income" }],
  },
  {
    title: "Expenses",
    description: "Recognized costs from manual and source-owned workflows.",
    href: "/finance/expenses",
    icon: TrendingDown,
    keywords: "expense salary rent utilities manual cost inventory",
    tone: "bg-rose-500/10 text-rose-600",
    actions: [{ label: "Open expenses", href: "/finance/expenses" }],
  },
  {
    title: "Suppliers",
    description: "Supplier directory, balances, ledgers, and payments.",
    href: "/suppliers",
    icon: Users,
    keywords: "supplier vendor payable ledger payment",
    tone: "bg-orange-500/10 text-orange-600",
    actions: [{ label: "Manage suppliers", href: "/suppliers" }],
  },
  {
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
    title: "Transactions",
    description: "One chronological day book of every financial event.",
    href: "/finance/transactions",
    icon: ArrowDownUp,
    keywords: "transactions day book movement event audit",
    tone: "bg-blue-500/10 text-blue-600",
    actions: [{ label: "Open day book", href: "/finance/transactions" }],
  },
  {
    title: "Journal vouchers",
    description: "Balanced manual adjustments with approval-grade audit history.",
    href: "/finance/journals",
    icon: BookOpenCheck,
    keywords: "journal voucher adjustment debit credit",
    tone: "bg-rose-500/10 text-rose-600",
    actions: [{ label: "Journal register", href: "/finance/journals" }],
  },
  {
    title: "Reports",
    description: "Statements, ledgers, tax books, and reconciliation.",
    href: "/finance/reports",
    icon: FileBarChart,
    keywords: "report profit loss balance sheet trial balance tax ledger",
    tone: "bg-indigo-500/10 text-indigo-600",
    actions: [{ label: "All reports", href: "/finance/reports" }],
  },
  {
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
    <div className="mx-auto w-full max-w-[1500px] space-y-7 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Finance workspace</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Finance</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Record each event once in its owning workflow, then review the resulting money, balances, and reports here.
          </p>
        </div>
        <div className="relative w-full lg:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find sales, payables, journal..."
            className="h-11 pl-9"
          />
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Net sales", value: metrics?.net_sales, icon: TrendingUp, help: "Revenue after sales discounts and refunds." },
          { label: "Money collected", value: metrics?.collections_total, icon: CreditCard, help: "Cash and bank receipts, including collections of older receivables." },
          { label: "Recognized expenses", value: recognizedExpenses, icon: TrendingDown, help: "Costs recognized in this period; supplier payments are not counted again." },
          { label: "Operating result", value: metrics?.operating_profit, icon: Banknote, help: "Income less recognized operating costs for the selected period." },
        ].map((metric) => (
          <Card key={metric.label} className="border-border shadow-none">
            <CardContent className="flex items-start justify-between p-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{metric.label}</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums">
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : money(metric.value)}
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{metric.help}</p>
              </div>
              <metric.icon className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </section>

      {alerts.length > 0 && (
        <section className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <AlertCircle className="h-4 w-4 text-amber-600" /> Needs attention
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            {alerts.map((alert) => (
              <Link key={alert.label} href={alert.href} className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3 text-sm hover:bg-muted/50">
                <span className="text-muted-foreground">{alert.label}</span>
                <span className="font-semibold tabular-nums">{alert.value}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Workspaces</h2>
          <p className="text-sm text-muted-foreground">Choose the business document you need, not an accounting shortcut.</p>
        </div>
        {visibleModules.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {visibleModules.map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.href} className="group border-border shadow-none transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-sm">
                  <CardContent className="flex h-full flex-col p-5">
                    <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", item.tone)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <Link href={item.href} className="mt-4 flex items-center justify-between gap-3 font-semibold">
                      {item.title}
                      <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
                    </Link>
                    <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">{item.description}</p>
                    <div className="mt-4 flex flex-wrap gap-x-3 gap-y-2 border-t border-border pt-3">
                      {item.actions.map((action) => (
                        <Link key={action.href} href={action.href} className="text-xs font-medium text-muted-foreground hover:text-primary">
                          {action.label}
                        </Link>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
            No finance workspace matches “{query}”.
          </div>
        )}
      </section>
    </div>
  );
}
