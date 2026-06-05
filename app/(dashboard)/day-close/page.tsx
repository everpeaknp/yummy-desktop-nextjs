"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DayCloseModal } from "@/components/analytics/day-close-modal";
import { DayCloseHistory } from "@/components/analytics/day-close-history";
import { Calendar, CheckCircle2, RefreshCw } from "lucide-react";
import apiClient from "@/lib/api-client";
import { DayCloseApis } from "@/lib/api/endpoints";
import {
  formatDayCloseCurrency,
  formatDayCloseListHeading,
  pickBackendAmount,
} from "@/lib/day-close-format";
import {
  parseDayCloseCurrent,
  parseDayCloseSnapshotData,
  unwrapApiData,
  type DayCloseCurrent,
  type DayCloseSnapshotData,
  type BusinessLine,
} from "@/types/day-close";

export default function DayClosePage() {
  const user = useAuth((s) => s.user);
  const restaurant = useRestaurant((s) => s.restaurant);
  const restaurantId = user?.restaurant_id ?? undefined;
  const [closeOpen, setCloseOpen] = useState(false);
  const [businessLine, setBusinessLine] = useState<BusinessLine>("restaurant");
  const [currentLoading, setCurrentLoading] = useState(false);
  const [currentClose, setCurrentClose] = useState<DayCloseCurrent | null>(null);
  const [snapshotPreview, setSnapshotPreview] = useState<DayCloseSnapshotData | null>(null);

  const showBusinessLinePicker = Boolean(
    restaurant?.hotel_enabled && restaurant?.restaurant_enabled,
  );

  const loadCurrent = useCallback(async () => {
    if (!restaurantId) return;
    setCurrentLoading(true);
    try {
      const [sessionRes, snapshotRes] = await Promise.all([
        apiClient.get(DayCloseApis.current({ restaurantId, businessLine })),
        apiClient.get(DayCloseApis.generateSnapshot({ restaurantId, businessLine })),
      ]);

      if (sessionRes.data?.status === "success") {
        setCurrentClose(unwrapApiData(sessionRes.data, parseDayCloseCurrent));
      } else {
        setCurrentClose(null);
      }

      if (snapshotRes.data?.status === "success") {
        setSnapshotPreview(unwrapApiData(snapshotRes.data, parseDayCloseSnapshotData));
      } else {
        setSnapshotPreview(null);
      }
    } catch {
      setCurrentClose(null);
      setSnapshotPreview(null);
    } finally {
      setCurrentLoading(false);
    }
  }, [restaurantId, businessLine]);

  useEffect(() => {
    if (restaurantId) loadCurrent();
  }, [restaurantId, loadCurrent]);

  const actionLabel = useMemo(() => {
    const label = currentClose?.action_label?.trim();
    if (label) return label;
    const status = String(currentClose?.status ?? "open").toLowerCase();
    if (status === "pending") return "Continue Close";
    if (status === "confirmed") return "View Current Day";
    return "Close Today";
  }, [currentClose?.action_label, currentClose?.status]);

  const displayNetSales = pickBackendAmount(
    snapshotPreview?.net_sales,
    currentClose?.snapshot_preview?.net_sales,
  );
  const displayExpenseTotal = pickBackendAmount(
    snapshotPreview?.expense_total,
    currentClose?.snapshot_preview?.expense_total,
  );

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto p-6">
      <Card className="bg-card border-border/60 rounded-3xl overflow-hidden">
        <CardContent className="p-8 sm:p-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="space-y-3 flex-1">
              <h1 className="text-3xl font-black tracking-tight">Day Close</h1>
              <div className="flex items-center gap-2 text-muted-foreground/80">
                <Calendar className="w-4 h-4" />
                <p className="text-sm font-semibold">
                  Period and totals come from the backend day-close service
                </p>
              </div>

              {showBusinessLinePicker ? (
                <div className="max-w-xs">
                  <Select
                    value={businessLine}
                    onValueChange={(value) => setBusinessLine(value as BusinessLine)}
                  >
                    <SelectTrigger className="h-11 rounded-2xl font-bold">
                      <SelectValue placeholder="Business line" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="restaurant">Restaurant Close</SelectItem>
                      <SelectItem value="hotel">Hotel Close</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              <div className="rounded-2xl border border-border/60 bg-muted/10 p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
                    Current day
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    onClick={loadCurrent}
                    disabled={!restaurantId || currentLoading}
                  >
                    <RefreshCw className={currentLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                  </Button>
                </div>
                <p className="text-sm font-bold">
                  {currentClose?.id
                    ? formatDayCloseListHeading({
                        id: currentClose.id,
                        business_line: currentClose.business_line,
                        period_start_at: currentClose.period_start_at,
                        period_end_at: currentClose.period_end_at,
                      })
                    : "—"}
                </p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                  Status: {currentClose?.status ?? "—"}
                </p>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="rounded-xl border bg-emerald-50/50 dark:bg-emerald-500/5 border-emerald-200/50 dark:border-emerald-500/20 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-500">
                      Net Sales
                    </p>
                    <p className="text-lg font-black text-emerald-700 dark:text-emerald-400 mt-1">
                      {formatDayCloseCurrency(displayNetSales)}
                    </p>
                  </div>
                  <div className="rounded-xl border bg-red-50/50 dark:bg-red-500/5 border-red-200/50 dark:border-red-500/20 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-red-700 dark:text-red-500">
                      Total Expenses
                    </p>
                    <p className="text-lg font-black text-red-700 dark:text-red-400 mt-1">
                      {formatDayCloseCurrency(displayExpenseTotal)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <Button
                onClick={() => setCloseOpen(true)}
                className="bg-orange-600 hover:bg-orange-700 text-white font-bold h-12 px-8 rounded-2xl shadow-lg shadow-orange-500/10"
                disabled={!restaurantId}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                {actionLabel}
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
                  Use <span className="font-semibold text-foreground">{actionLabel}</span> to run the close wizard.
                </p>
                <p>
                  Use <span className="font-semibold text-foreground">History</span> to export PDF/Excel and review
                  saved snapshots from the backend.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {restaurantId ? (
        <DayCloseModal
          isOpen={closeOpen}
          onClose={() => {
            setCloseOpen(false);
            loadCurrent();
          }}
          restaurantId={restaurantId}
          businessLine={businessLine}
        />
      ) : null}
    </div>
  );
}
