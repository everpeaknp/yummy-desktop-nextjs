"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeDollarSign,
  BedDouble,
  CircleDollarSign,
  CreditCard,
  Loader2,
  RefreshCw,
  RotateCcw,
  Utensils,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getApiErrorMessage } from "@/lib/api-error-message";
import { hotelDate, hotelPmsApi } from "@/lib/hotel/api";
import type { HotelFinanceSummary } from "@/lib/hotel/types";
import { humanizeHotelStatus } from "./hotel-ui";

interface Props {
  restaurantId: number;
  refreshKey: number;
}

function monthStart(): string {
  const value = new Date();
  value.setDate(1);
  return hotelDate(value);
}

function money(value: string | number | undefined, currency = "NPR"): string {
  const amount = Number(value || 0);
  return `${currency} ${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function FinancePanel({ restaurantId, refreshKey }: Props) {
  const router = useRouter();
  const [dateFrom, setDateFrom] = useState(monthStart);
  const [dateTo, setDateTo] = useState(() => hotelDate(new Date()));
  const [data, setData] = useState<HotelFinanceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (dateTo < dateFrom) {
      toast.error("The end date must be on or after the start date");
      return;
    }
    setLoading(true);
    try {
      setData(await hotelPmsApi.getFinanceSummary(restaurantId, dateFrom, dateTo));
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not load hotel finance"));
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, restaurantId]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  const paymentMethods = useMemo(
    () => Object.entries(data?.payment_methods || {}).sort((a, b) => Number(b[1]) - Number(a[1])),
    [data?.payment_methods],
  );

  if (loading && !data) {
    return <div className="flex min-h-72 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-orange-500" /></div>;
  }

  const currency = data?.currency || "NPR";
  const metrics = [
    { label: "Room revenue", value: data?.gross_room_revenue, icon: BedDouble, tone: "text-orange-600 bg-orange-500/10" },
    { label: "Hotel services", value: data?.hotel_service_revenue, icon: BadgeDollarSign, tone: "text-blue-600 bg-blue-500/10" },
    { label: "Net hotel revenue", value: data?.net_hotel_revenue, icon: CircleDollarSign, tone: "text-emerald-600 bg-emerald-500/10" },
    { label: "Payments received", value: data?.payments_collected, icon: WalletCards, tone: "text-violet-600 bg-violet-500/10" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <h2 className="text-2xl font-black tracking-tight">Hotel finance</h2>
          <p className="mt-1 text-sm text-muted-foreground">Room income, hotel services, guest payments, and unpaid balances.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2 rounded-2xl border bg-card p-2">
          <label className="space-y-1"><span className="px-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">From</span><Input className="h-10 w-40 rounded-xl" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
          <label className="space-y-1"><span className="px-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">To</span><Input className="h-10 w-40 rounded-xl" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
          <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl" onClick={() => void load()} disabled={loading} aria-label="Refresh hotel finance"><RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} /></Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => <Card key={metric.label} className="shadow-sm"><CardContent className="flex items-center gap-4 p-5"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${metric.tone}`}><metric.icon className="h-5 w-5" /></span><div className="min-w-0"><p className="text-sm text-muted-foreground">{metric.label}</p><p className="mt-1 truncate text-xl font-black tabular-nums">{money(metric.value, currency)}</p></div></CardContent></Card>)}
      </div>

      <Card className="border-orange-500/20 bg-orange-500/[0.035] shadow-sm">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-bold">Hotel financial entries</p>
            <p className="mt-1 text-sm text-muted-foreground">Record income and expenses under Hotel so they remain separate from restaurant reporting while using the same accounting ledger.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => router.push("/finance/other-income?business_line=hotel")}>Record income</Button>
            <Button className="rounded-xl bg-orange-500 hover:bg-orange-600" onClick={() => router.push("/finance/expenses?business_line=hotel")}>Record expense</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
        <Card className="shadow-sm">
          <CardHeader><CardTitle className="text-base">Guest bills</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <FinanceRow label="Current unpaid guest balances" value={money(data?.outstanding_guest_balances, currency)} emphasis />
            <FinanceRow label="Open guest bills" value={String(data?.open_guest_bills || 0)} />
            <FinanceRow label="Current guest credit" value={money(data?.guest_credit_balances, currency)} />
            <FinanceRow label="Customer credit used" value={money(data?.customer_credit_used, currency)} />
            <FinanceRow label="Advance payments received" value={money(data?.advance_payments_received, currency)} />
            <FinanceRow label="Discounts" value={money(data?.discounts, currency)} />
            <FinanceRow label="Refunds" value={money(data?.refunds, currency)} icon={<RotateCcw className="h-4 w-4" />} />
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader><CardTitle className="text-base">Payments by method</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {paymentMethods.length ? paymentMethods.map(([method, value]) => <div key={method} className="flex items-center justify-between rounded-xl border bg-muted/20 px-3 py-3"><span className="flex items-center gap-2 text-sm font-semibold"><CreditCard className="h-4 w-4 text-orange-500" />{humanizeHotelStatus(method)}</span><span className="font-bold tabular-nums">{money(value, currency)}</span></div>) : <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No guest payments were recorded in this period.</p>}
          </CardContent>
        </Card>
      </div>

      <Card className="border-orange-500/20 bg-orange-500/[0.04] shadow-none">
        <CardContent className="flex items-start gap-3 p-4"><Utensils className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" /><div><p className="font-bold">Room service on guest bills: {money(data?.room_service_charges, currency)}</p><p className="mt-1 text-sm text-muted-foreground">This is shown for bill visibility. Food and drink sales remain in restaurant finance, so they are not added to hotel revenue again.</p></div></CardContent>
      </Card>
    </div>
  );
}

function FinanceRow({ label, value, emphasis = false, icon }: { label: string; value: string; emphasis?: boolean; icon?: React.ReactNode }) {
  return <div className="rounded-xl border bg-muted/20 p-3"><p className="flex items-center gap-2 text-sm text-muted-foreground">{icon}{label}</p><p className={`mt-1 font-black tabular-nums ${emphasis ? "text-lg text-orange-600" : "text-base"}`}>{value}</p></div>;
}
