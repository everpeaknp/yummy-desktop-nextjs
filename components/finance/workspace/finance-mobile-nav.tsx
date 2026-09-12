"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowDownUp,
  Banknote,
  BookOpenCheck,
  ChartNoAxesCombined,
  CircleDollarSign,
  FileBarChart,
  Landmark,
  MoreHorizontal,
  ReceiptText,
  Settings2,
  ShoppingCart,
  TrendingDown,
  WalletCards,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const topLevelRoutes = new Set([
  "/finance",
  "/finance/sales",
  "/finance/purchases",
  "/finance/other-income",
  "/finance/expenses",
  "/finance/payments",
  "/finance/operations",
  "/cash-drawers",
  "/day-close",
  "/finance/transactions",
  "/finance/journals",
  "/finance/reports",
  "/finance/setup",
]);

const primaryItems = [
  { label: "Overview", href: "/finance", icon: ChartNoAxesCombined },
  { label: "Sales", href: "/finance/sales", icon: ReceiptText },
  { label: "Purchases", href: "/finance/purchases", icon: ShoppingCart },
  { label: "Cash", href: "/finance/operations", icon: Landmark },
] as const;

const moreGroups = [
  {
    label: "Record and settle",
    items: [
      { label: "Other income", href: "/finance/other-income", icon: CircleDollarSign },
      { label: "Expenses", href: "/finance/expenses", icon: TrendingDown },
      { label: "Payments", href: "/finance/payments", icon: WalletCards },
    ],
  },
  {
    label: "Control cash",
    items: [
      { label: "Cash drawers", href: "/cash-drawers", icon: Banknote },
      { label: "Day close", href: "/day-close", icon: BookOpenCheck },
    ],
  },
  {
    label: "Review and configure",
    items: [
      { label: "Transactions", href: "/finance/transactions", icon: ArrowDownUp },
      { label: "Journal vouchers", href: "/finance/journals", icon: BookOpenCheck },
      { label: "Reports", href: "/finance/reports", icon: FileBarChart },
      { label: "Setup", href: "/finance/setup", icon: Settings2 },
    ],
  },
] as const;

const moreHrefs = new Set(moreGroups.flatMap((group) => group.items.map((item) => item.href)));

export function FinanceMobileNav() {
  const pathname = usePathname() || "";
  const [open, setOpen] = useState(false);

  if (!topLevelRoutes.has(pathname)) return null;

  return (
    <nav
      aria-label="Finance workspace"
      className="shrink-0 border-b border-border/70 bg-background px-3 py-2 md:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-5 rounded-2xl bg-muted/55 p-1">
        {primaryItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-medium transition-colors",
                active
                  ? "bg-background text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          );
        })}

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              aria-current={moreHrefs.has(pathname) ? "page" : undefined}
              className={cn(
                "h-auto min-h-12 min-w-0 flex-col gap-1 rounded-xl px-1 text-[10px] font-medium",
                moreHrefs.has(pathname)
                  ? "bg-background text-primary shadow-sm hover:bg-background"
                  : "text-muted-foreground",
              )}
            >
              <MoreHorizontal className="h-4 w-4" />
              <span>More</span>
            </Button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="max-h-[78dvh] overflow-hidden rounded-t-3xl p-0"
          >
            <SheetHeader className="border-b px-5 py-4 text-left">
              <SheetTitle>Finance</SheetTitle>
            </SheetHeader>
            <div className="overflow-y-auto overscroll-contain px-3 py-3 pb-[max(env(safe-area-inset-bottom),1rem)]">
              {moreGroups.map((group) => (
                <section key={group.label} className="mb-4 last:mb-0">
                  <h2 className="px-3 pb-1.5 text-xs font-medium text-muted-foreground">
                    {group.label}
                  </h2>
                  <div className="overflow-hidden rounded-2xl border bg-background">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = pathname === item.href;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setOpen(false)}
                          className={cn(
                            "flex min-h-12 items-center gap-3 border-b px-3 py-2.5 text-sm font-medium last:border-b-0",
                            active ? "bg-primary/5 text-primary" : "text-foreground",
                          )}
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
