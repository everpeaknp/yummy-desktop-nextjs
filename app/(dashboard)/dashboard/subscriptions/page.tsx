"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Bell, Calendar, CreditCard, Trophy, Users } from "lucide-react";

function MetricCard({
  title,
  value,
  icon,
  badge,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  badge: React.ReactNode;
}) {
  return (
    <Card className="bg-card border-border shadow-sm">
      <CardContent className="p-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{title}</p>
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

export default function DashboardSubscriptionsPage() {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-8 space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-4xl font-black tracking-tight">Subscriptions & Metrics</h1>
          <p className="mt-1 text-muted-foreground font-medium">
            Live billing mix and subscription status
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Button
            variant="outline"
            size="icon"
            className="relative h-11 w-11 rounded-2xl bg-muted/30 border-border"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-orange-500" />
            <span className="sr-only">Notifications</span>
          </Button>
          <Button className="h-11 px-5 rounded-2xl font-black bg-primary text-primary-foreground hover:bg-primary/90">
            New Campaign
          </Button>
        </div>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <MetricCard
          title="Active Subscriptions"
          value={66}
          icon={<Users className="h-6 w-6 text-blue-500" />}
          badge={
            <Badge variant="outline" className="font-black text-[10px] uppercase tracking-wider">
              Live
            </Badge>
          }
        />
        <MetricCard
          title="Paid Plans"
          value={41}
          icon={<CreditCard className="h-6 w-6 text-emerald-500" />}
          badge={
            <Badge
              variant="outline"
              className="font-black text-[10px] uppercase tracking-wider border-emerald-500/30 text-emerald-600 dark:text-emerald-300 bg-emerald-500/10"
            >
              Paid
            </Badge>
          }
        />
        <MetricCard
          title="Trial Plans"
          value={25}
          icon={<Trophy className="h-6 w-6 text-violet-500" />}
          badge={
            <Badge
              variant="outline"
              className="font-black text-[10px] uppercase tracking-wider border-violet-500/30 text-violet-600 dark:text-violet-300 bg-violet-500/10"
            >
              Trial
            </Badge>
          }
        />
        <MetricCard
          title="Expiring Soon"
          value={8}
          icon={<Calendar className="h-6 w-6 text-amber-500" />}
          badge={
            <Badge
              variant="outline"
              className="font-black text-[10px] uppercase tracking-wider border-amber-500/30 text-amber-700 dark:text-amber-300 bg-amber-500/10"
            >
              Next 14 days
            </Badge>
          }
        />
      </section>

      <Card className="bg-card border-border shadow-sm overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xl font-black tracking-tight">Portfolio Growth</p>
              <p className="text-muted-foreground font-medium text-sm mt-1">
                New restaurants added per month
              </p>
            </div>
            <Button variant="outline" className="rounded-2xl bg-muted/30 border-border">
              Monthly
            </Button>
          </div>
          <div className="mt-6 rounded-3xl border border-dashed border-border/70 bg-muted/20 h-[360px] flex items-center justify-center">
            <p className="text-muted-foreground font-medium">
              Portfolio growth is unavailable right now.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

