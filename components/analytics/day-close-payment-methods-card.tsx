"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  CreditCard,
  DollarSign,
  Landmark,
  ReceiptText,
  Smartphone,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDayCloseCurrency } from "@/lib/day-close-format";
import { cn } from "@/lib/utils";

export type DayClosePaymentMethodRow = {
  label: string;
  amount?: number;
  secondary?: string;
};

type DayClosePaymentMethodsCardProps = {
  title?: string;
  rows: DayClosePaymentMethodRow[];
  nested?: boolean;
  className?: string;
};

function methodStyle(label: string) {
  const key = label.toLowerCase();
  if (key.includes("cash")) {
    return { bar: "bg-emerald-500", icon: "text-emerald-500", glow: "shadow-emerald-500/20" };
  }
  if (key.includes("card")) {
    return { bar: "bg-blue-500", icon: "text-blue-500", glow: "shadow-blue-500/20" };
  }
  if (key.includes("fonepay")) {
    return { bar: "bg-[#0A9D58]", icon: "text-[#0A9D58]", glow: "shadow-[#0A9D58]/20" };
  }
  if (key.includes("bank")) {
    return { bar: "bg-slate-500", icon: "text-slate-500", glow: "shadow-slate-500/20" };
  }
  if (
    key.includes("digital") ||
    key.includes("qr") ||
    key.includes("esewa") ||
    key.includes("khalti")
  ) {
    return { bar: "bg-purple-500", icon: "text-purple-500", glow: "shadow-purple-500/20" };
  }
  if (key.includes("credit")) {
    return { bar: "bg-rose-500", icon: "text-rose-500", glow: "shadow-rose-500/20" };
  }
  return { bar: "bg-primary", icon: "text-primary", glow: "shadow-primary/20" };
}

function MethodIcon({ label }: { label: string }) {
  const key = label.toLowerCase();
  const className = "w-4 h-4";
  if (key.includes("cash")) return <Wallet className={className} />;
  if (key.includes("card")) return <CreditCard className={className} />;
  if (key.includes("fonepay")) return <Smartphone className={className} />;
  if (key.includes("bank")) return <Landmark className={className} />;
  if (key.includes("digital") || key.includes("qr")) return <Activity className={className} />;
  if (key.includes("credit")) return <ReceiptText className={className} />;
  return <DollarSign className={className} />;
}

export function DayClosePaymentMethodsCard({
  title = "Payment Methods",
  rows,
  nested = false,
  className,
}: DayClosePaymentMethodsCardProps) {
  const [animateBars, setAnimateBars] = useState(false);

  const visibleRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          (row.amount ?? 0) > 0 ||
          row.label.toLowerCase().includes("credit"),
      ),
    [rows],
  );

  const total = useMemo(
    () => visibleRows.reduce((sum, row) => sum + (row.amount ?? 0), 0),
    [visibleRows],
  );

  useEffect(() => {
    setAnimateBars(false);
    const frame = requestAnimationFrame(() => setAnimateBars(true));
    return () => cancelAnimationFrame(frame);
  }, [rows, title]);

  if (visibleRows.length === 0) {
    return (
      <Card
        className={cn(
          "border-border/50 bg-card/80 backdrop-blur-sm shadow-sm rounded-2xl",
          nested && "border-dashed ml-2 opacity-90",
          className,
        )}
      >
        <CardContent className="p-6 text-sm text-muted-foreground text-center">
          Payment breakdown is not available in this snapshot.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "border-border/50 bg-card/80 backdrop-blur-sm shadow-sm rounded-2xl overflow-hidden",
        nested && "border-dashed ml-2 opacity-90",
        className,
      )}
    >
      <CardHeader className="pb-3">
        <CardTitle className="dc-card-title flex items-center gap-2">
          <Wallet className="h-4 w-4 text-emerald-500" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {visibleRows.map((row, index) => {
          const amount = row.amount ?? 0;
          const pct = total > 0 ? (amount / total) * 100 : 0;
          const style = methodStyle(row.label);

          return (
            <div
              key={`${row.label}-${index}`}
              className="rounded-xl border border-border/60 bg-muted/10 p-3 space-y-2.5"
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "w-9 h-9 rounded-xl bg-muted border border-border/60 flex items-center justify-center shrink-0",
                    style.icon,
                  )}
                >
                  <MethodIcon label={row.label} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate capitalize">{row.label}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {pct.toFixed(1)}% of captured income
                    {row.secondary ? ` · ${row.secondary}` : ""}
                  </p>
                </div>
                <p className="dc-amount text-sm shrink-0">
                  {formatDayCloseCurrency(amount)}
                </p>
              </div>
              <div className="w-full h-2 rounded-full bg-muted/60 overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-1000 ease-out shadow-sm",
                    style.bar,
                    style.glow,
                    animateBars && "payment-bar-shimmer",
                  )}
                  style={{
                    width: animateBars ? `${Math.max(pct, amount > 0 ? 4 : 0)}%` : "0%",
                    transitionDelay: `${index * 90}ms`,
                  }}
                />
              </div>
            </div>
          );
        })}
        {total > 0 ? (
          <div className="flex justify-between items-center rounded-xl border border-border/40 bg-muted/20 px-3 py-2.5 text-xs">
            <span className="font-medium text-muted-foreground">Total captured</span>
            <span className="font-semibold text-foreground text-sm tabular-nums">
              {formatDayCloseCurrency(total)}
            </span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
