"use client";

import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, ReceiptText, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { OperationalFinanceReportClient } from "@/components/finance/reports/operational-finance-report-client";

const tasks = [
  {
    title: "Customer receipt",
    description: "Collect an outstanding customer balance. This reduces receivables; it does not create income again.",
    href: "/customers",
    action: "Open customers",
    icon: ArrowDownLeft,
  },
  {
    title: "Supplier payment",
    description: "Pay one of a supplier's open bills from a drawer, bank, or safe. This reduces payables; it is not another expense.",
    href: "/suppliers",
    action: "Open suppliers",
    icon: ArrowUpRight,
  },
  {
    title: "Staff advance or recovery",
    description: "Record an employee advance or repayment from the staff record. Salary payments remain in Payroll.",
    href: "/workforce",
    action: "Open workforce",
    icon: Users,
  },
];

export function FinancePaymentsClient() {
  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-6 p-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Finance</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Payments</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Settle money already owed by a customer, to a supplier, or by a staff member. New sales, purchases, income, and expenses are recorded in their own workspaces.
        </p>
      </header>

      <div className="grid gap-3 lg:grid-cols-3">
        {tasks.map((task) => {
          const Icon = task.icon;
          return (
            <Card key={task.title} className="shadow-none">
              <CardContent className="flex h-full flex-col p-5">
                <Icon className="h-5 w-5 text-primary" />
                <h2 className="mt-4 font-semibold">{task.title}</h2>
                <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">{task.description}</p>
                <Button asChild variant="outline" className="mt-5 w-full justify-between">
                  <Link href={task.href}>{task.action}<ReceiptText className="h-4 w-4" /></Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="border-t border-border pt-2">
        <OperationalFinanceReportClient mode="payments" showReportNavigation={false} />
      </div>
    </div>
  );
}
