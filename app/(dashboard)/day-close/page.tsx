"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DayCloseModal } from "@/components/analytics/day-close-modal";
import { DayCloseHistory } from "@/components/analytics/day-close-history";
import { Calendar, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

export default function DayClosePage() {
  const user = useAuth((s) => s.user);
  const restaurantId = user?.restaurant_id ?? undefined;
  const [closeOpen, setCloseOpen] = useState(false);

  const todayLabel = useMemo(() => format(new Date(), "MMMM do, yyyy"), []);

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto p-6">
      <Card className="bg-card border-border/60 rounded-3xl overflow-hidden">
        <CardContent className="p-8 sm:p-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="space-y-2">
              <h1 className="text-3xl font-black tracking-tight">Day Close</h1>
              <div className="flex items-center gap-2 text-muted-foreground/80">
                <Calendar className="w-4 h-4" />
                <p className="text-sm font-semibold">{todayLabel}</p>
              </div>
              <p className="text-sm text-muted-foreground max-w-2xl">
                Close your business day, export reports, and review corrections with a full audit trail.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={() => setCloseOpen(true)}
                className="bg-orange-600 hover:bg-orange-700 text-white font-bold h-12 px-8 rounded-2xl shadow-lg shadow-orange-500/10"
                disabled={!restaurantId}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Close Today
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="history" className="w-full">
        <TabsList className="bg-muted/20 border border-border/60 rounded-2xl p-1 h-12">
          <TabsTrigger value="history" className="rounded-xl px-5 font-bold">
            History
          </TabsTrigger>
          <TabsTrigger value="about" className="rounded-xl px-5 font-bold">
            What This Does
          </TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="mt-5">
          <DayCloseHistory restaurantId={restaurantId} />
        </TabsContent>

        <TabsContent value="about" className="mt-5">
          <Card className="bg-card border-border/60 rounded-3xl overflow-hidden">
            <CardContent className="p-8 space-y-4">
              <p className="text-sm text-muted-foreground">
                A Day Close locks in your daily totals (sales, payments, expenses, refunds) and records a cash
                reconciliation. If you spot a mistake later, you can reopen or adjust the close with a reason so the
                system keeps an audit trail.
              </p>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  Use <span className="font-semibold text-foreground">Close Today</span> to run the close wizard.
                </p>
                <p>
                  Use <span className="font-semibold text-foreground">History</span> to export PDF/Excel and review
                  snapshots.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {restaurantId ? (
        <DayCloseModal isOpen={closeOpen} onClose={() => setCloseOpen(false)} restaurantId={restaurantId} />
      ) : null}
    </div>
  );
}
