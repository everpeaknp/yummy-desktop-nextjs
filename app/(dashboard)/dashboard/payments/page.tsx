"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CreditCard, DollarSign, Receipt, RefreshCw, ShieldCheck } from "lucide-react";

function Stat({
  label,
  value,
  icon,
  badge,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <Card className="bg-card border-border shadow-sm">
      <CardContent className="p-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{label}</p>
            {badge}
          </div>
          <p className="mt-2 text-4xl font-black tracking-tight">{value}</p>
        </div>
        <div className="h-12 w-12 rounded-2xl bg-muted/40 border border-border/60 flex items-center justify-center shrink-0">
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPaymentsPage() {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-8 space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-4xl font-black tracking-tight">Payments</h1>
          <p className="mt-1 text-muted-foreground font-medium">
            Payment health, settlement, and refunds
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Button variant="outline" className="rounded-2xl bg-muted/30 border-border">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button className="rounded-2xl font-black bg-primary text-primary-foreground hover:bg-primary/90">
            Export
          </Button>
        </div>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Stat
          label="Successful Payments"
          value={128}
          icon={<ShieldCheck className="h-6 w-6 text-emerald-500" />}
          badge={
            <Badge
              variant="outline"
              className="font-black text-[10px] uppercase tracking-wider border-emerald-500/30 text-emerald-600 dark:text-emerald-300 bg-emerald-500/10"
            >
              Healthy
            </Badge>
          }
        />
        <Stat
          label="Pending Settlements"
          value={7}
          icon={<Receipt className="h-6 w-6 text-amber-500" />}
          badge={
            <Badge
              variant="outline"
              className="font-black text-[10px] uppercase tracking-wider border-amber-500/30 text-amber-700 dark:text-amber-300 bg-amber-500/10"
            >
              Needs review
            </Badge>
          }
        />
        <Stat
          label="Refunds"
          value={3}
          icon={<CreditCard className="h-6 w-6 text-rose-500" />}
          badge={
            <Badge
              variant="outline"
              className="font-black text-[10px] uppercase tracking-wider border-rose-500/30 text-rose-600 dark:text-rose-300 bg-rose-500/10"
            >
              Today
            </Badge>
          }
        />
        <Stat
          label="Gross Collected"
          value={"Rs. 245,800"}
          icon={<DollarSign className="h-6 w-6 text-blue-500" />}
        />
      </section>

      <Card className="bg-card border-border shadow-sm overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xl font-black tracking-tight">Payment Timeline</p>
              <p className="text-muted-foreground font-medium text-sm mt-1">
                Volume and settlement over time
              </p>
            </div>
            <Button variant="outline" className="rounded-2xl bg-muted/30 border-border">
              Last 30 days
            </Button>
          </div>
          <div className="mt-6 rounded-3xl border border-dashed border-border/70 bg-muted/20 h-[360px] flex items-center justify-center">
            <p className="text-muted-foreground font-medium">
              Payment analytics is unavailable right now.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

