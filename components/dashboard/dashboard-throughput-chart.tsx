"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export type ThroughputChartPoint = {
  date: string;
  revenue: number;
  orders: number;
};

type DashboardThroughputChartProps = {
  data: ThroughputChartPoint[];
  loading?: boolean;
  title?: string;
  description?: string;
};

const CHART_HEIGHT = 280;

export function DashboardThroughputChart({
  data,
  loading,
  title = "Throughput",
  description,
}: DashboardThroughputChartProps) {
  const { theme } = useTheme();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const hasData = data.length > 0;

  return (
    <Card className="h-full bg-card border-border shadow-sm flex flex-col">
      <CardHeader className="pb-2 shrink-0">
        <CardTitle className="text-sm font-bold">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="pl-2 flex-1 min-h-0 pb-4">
        <div
          className="w-full min-w-0"
          style={{ height: CHART_HEIGHT, minHeight: CHART_HEIGHT }}
        >
          {loading ? (
            <div
              className="flex h-full w-full items-center justify-center rounded-md bg-muted/20 animate-pulse"
              style={{ height: CHART_HEIGHT }}
            >
              <span className="text-sm text-muted-foreground">Loading chart…</span>
            </div>
          ) : !hasData ? (
            <div
              className="flex h-full w-full items-center justify-center text-muted-foreground text-sm"
              style={{ height: CHART_HEIGHT }}
            >
              No throughput data for this period
            </div>
          ) : ready ? (
            <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={0}>
              <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="dashThroughputRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke={theme === "dark" ? "#333" : "#eee"}
                />
                <XAxis
                  dataKey="date"
                  stroke="#888888"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  yAxisId="left"
                  stroke="#888888"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) =>
                    `Rs.${value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}`
                  }
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#888888"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: theme === "dark" ? "#1e1e1e" : "#fff",
                    borderRadius: "8px",
                    border: "none",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  }}
                  formatter={(value: number, name: string) => {
                    if (name === "revenue") {
                      return [`Rs. ${Number(value).toLocaleString()}`, "Sales"];
                    }
                    return [value, "Orders"];
                  }}
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="revenue"
                  name="revenue"
                  stroke="#f97316"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#dashThroughputRevenue)"
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="orders"
                  name="orders"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fillOpacity={0}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: CHART_HEIGHT }} className="w-full bg-muted/10 rounded-md" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
