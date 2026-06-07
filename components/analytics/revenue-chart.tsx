import { useState } from "react";
import { useTheme } from "next-themes";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface RevenueChartProps {
  data: any[];
  loading?: boolean;
  title?: string;
  description?: string;
  hourlyData?: {
    labels: string[];
    revenue: number[];
    orders: number[];
  } | null;
}

function formatChartLabel(value: string): string {
  if (/^\d{1,2}:\d{2}/.test(value)) return value;
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return value;
  }
}

function formatTooltipLabel(label: string, isHourly: boolean): string {
  if (isHourly) return `Hour: ${label}`;
  if (/^\d{1,2}:\d{2}/.test(label)) return label;
  try {
    const d = new Date(label);
    if (isNaN(d.getTime())) return label;
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return label;
  }
}

export function RevenueChart({
  data,
  loading,
  title,
  description,
  hourlyData,
}: RevenueChartProps) {
  const { theme } = useTheme();
  const [chartType, setChartType] = useState<"area" | "bar">("area");

  const isHourly = !!(hourlyData && hourlyData.labels && hourlyData.labels.length > 0);

  const chartData = isHourly
    ? hourlyData!.labels.map((label, idx) => ({
        date: label,
        revenue: hourlyData!.revenue[idx] || 0,
        orders: hourlyData!.orders[idx] || 0,
      }))
    : data?.length
      ? data
      : [];

  const chartTitle = title ?? (isHourly ? "Hourly Performance" : "Revenue Trend");
  const chartDescription =
    description ??
    (isHourly
      ? "Hourly income and orders distribution today."
      : "Your gross sales over the selected period.");

  return (
    <Card className="col-span-4 dc-card h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-black/[0.08] pb-4 dark:border-white/10">
        <div>
          <CardTitle className="dc-card-title">{chartTitle}</CardTitle>
          <CardDescription className="text-xs text-muted-foreground">{chartDescription}</CardDescription>
        </div>
        <div className="flex rounded-xl border border-black/[0.08] bg-muted/50 p-1 text-xs dark:border-white/15">
          <button
            onClick={() => setChartType("area")}
            className={`rounded-lg px-3 py-1.5 transition-all ${
              chartType === "area"
                ? "bg-primary/10 font-semibold text-primary"
                : "text-muted-foreground hover:bg-primary/5 hover:text-primary"
            }`}
          >
            Area/Line
          </button>
          <button
            onClick={() => setChartType("bar")}
            className={`rounded-lg px-3 py-1.5 transition-all ${
              chartType === "bar"
                ? "bg-primary/10 font-semibold text-primary"
                : "text-muted-foreground hover:bg-primary/5 hover:text-primary"
            }`}
          >
            Bar
          </button>
        </div>
      </CardHeader>
      <CardContent className="pl-2">
        <div className="h-[300px] w-full min-w-0 shrink-0">
          {loading ? (
            <div className="h-full w-full flex items-center justify-center bg-muted/20 animate-pulse rounded-md">
              <span className="text-muted-foreground text-sm">Loading chart...</span>
            </div>
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240}>
              {chartType === "area" ? (
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                    {isHourly && (
                      <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    )}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === "dark" ? "#333" : "#eee"} />
                  <XAxis
                    dataKey="date"
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => (isHourly ? value : formatChartLabel(value))}
                  />
                  <YAxis
                    yAxisId="left"
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) =>
                      `Rs.${value >= 1000 ? (value / 1000).toFixed(1) + "k" : value}`
                    }
                  />
                  {isHourly && (
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      stroke="#888888"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `${value}`}
                    />
                  )}
                  <Tooltip
                    contentStyle={{
                      backgroundColor: theme === "dark" ? "#1e1e1e" : "#fff",
                      borderRadius: "8px",
                      border: "none",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    }}
                    formatter={(value: any, name: any) => {
                      if (name === "revenue") return [`Rs. ${Number(value).toLocaleString()}`, "Revenue"];
                      return [value, "Orders"];
                    }}
                    labelFormatter={(label) => formatTooltipLabel(String(label), isHourly)}
                  />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey={isHourly ? "revenue" : "value"}
                    name="revenue"
                    stroke="#f97316"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorRevenue)"
                  />
                  {isHourly && (
                    <Area
                      yAxisId="right"
                      type="monotone"
                      dataKey="orders"
                      name="orders"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      fillOpacity={0.1}
                      fill="url(#colorOrders)"
                    />
                  )}
                  {isHourly && <Legend />}
                </AreaChart>
              ) : (
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === "dark" ? "#333" : "#eee"} />
                  <XAxis
                    dataKey="date"
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => (isHourly ? value : formatChartLabel(value))}
                  />
                  <YAxis
                    yAxisId="left"
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) =>
                      `Rs.${value >= 1000 ? (value / 1000).toFixed(1) + "k" : value}`
                    }
                  />
                  {isHourly && (
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      stroke="#888888"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `${value}`}
                    />
                  )}
                  <Tooltip
                    contentStyle={{
                      backgroundColor: theme === "dark" ? "#1e1e1e" : "#fff",
                      borderRadius: "8px",
                      border: "none",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    }}
                    formatter={(value: any, name: any) => {
                      if (name === "revenue") return [`Rs. ${Number(value).toLocaleString()}`, "Revenue"];
                      return [value, "Orders"];
                    }}
                    labelFormatter={(label) => formatTooltipLabel(String(label), isHourly)}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey={isHourly ? "revenue" : "value"}
                    name="revenue"
                    fill="#f97316"
                    radius={[4, 4, 0, 0]}
                  />
                  {isHourly && (
                    <Bar
                      yAxisId="right"
                      dataKey="orders"
                      name="orders"
                      fill="#3b82f6"
                      radius={[4, 4, 0, 0]}
                    />
                  )}
                  {isHourly && <Legend />}
                </BarChart>
              )}
            </ResponsiveContainer>
          ) : (
            <div className="h-full w-full flex items-center justify-center text-muted-foreground">
              No data available for this period
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
