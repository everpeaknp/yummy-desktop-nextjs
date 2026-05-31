import { useState } from "react";
import { useTheme } from "next-themes";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LineChart, LayoutGrid } from "lucide-react";

interface RevenueChartProps {
  data: any[];
  loading?: boolean;
  hourlyData?: {
    labels: string[];
    revenue: number[];
    orders: number[];
  } | null;
}

export function RevenueChart({ data, loading, hourlyData }: RevenueChartProps) {
  const { theme } = useTheme();
  const [chartType, setChartType] = useState<"area" | "bar">("area");
  
  // Decide which dataset to use
  const isHourly = !!(hourlyData && hourlyData.labels && hourlyData.labels.length > 0);
  
  const chartData = isHourly 
    ? hourlyData!.labels.map((label, idx) => ({
        date: label,
        revenue: hourlyData!.revenue[idx] || 0,
        orders: hourlyData!.orders[idx] || 0
      }))
    : (data?.length ? data : []);

  return (
    <Card className="col-span-4 bg-card border-border shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle>{isHourly ? "Hourly Performance" : "Revenue Trend"}</CardTitle>
          <CardDescription>
            {isHourly 
              ? "Hourly income and orders distribution today." 
              : "Your gross sales over the selected period."}
          </CardDescription>
        </div>
        <div className="flex bg-muted p-1 rounded-lg text-xs">
          <button
            onClick={() => setChartType("area")}
            className={`px-3 py-1.5 rounded-md transition-all ${
              chartType === "area" ? "bg-background text-foreground shadow-sm font-medium" : "text-muted-foreground"
            }`}
          >
            Area/Line
          </button>
          <button
            onClick={() => setChartType("bar")}
            className={`px-3 py-1.5 rounded-md transition-all ${
              chartType === "bar" ? "bg-background text-foreground shadow-sm font-medium" : "text-muted-foreground"
            }`}
          >
            Bar
          </button>
        </div>
      </CardHeader>
      <CardContent className="pl-2">
        <div className="h-[300px] w-full">
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
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#333' : '#eee'} />
                      <XAxis
                        dataKey="date"
                        stroke="#888888"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => {
                          if (isHourly) return value;
                          try {
                            const d = new Date(value);
                            if (isNaN(d.getTime())) return value;
                            return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                          } catch (e) {
                            return value;
                          }
                        }}
                      />
                      <YAxis
                        yAxisId="left"
                        stroke="#888888"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `Rs.${value >= 1000 ? (value / 1000).toFixed(1) + 'k' : value}`}
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
                          backgroundColor: theme === 'dark' ? '#1e1e1e' : '#fff',
                          borderRadius: '8px',
                          border: 'none',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                        }}
                        formatter={(value: any, name: any) => {
                          if (name === "revenue") return [`Rs. ${Number(value).toLocaleString()}`, "Revenue"];
                          return [value, "Orders"];
                        }}
                        labelFormatter={(label) => {
                          if (isHourly) return `Hour: ${label}`;
                          try {
                            const d = new Date(label);
                            if (isNaN(d.getTime())) return label;
                            return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
                          } catch (e) {
                            return label;
                          }
                        }}
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
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#333' : '#eee'} />
                      <XAxis
                        dataKey="date"
                        stroke="#888888"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => {
                          if (isHourly) return value;
                          try {
                            const d = new Date(value);
                            if (isNaN(d.getTime())) return value;
                            return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                          } catch (e) {
                            return value;
                          }
                        }}
                      />
                      <YAxis
                        yAxisId="left"
                        stroke="#888888"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `Rs.${value >= 1000 ? (value / 1000).toFixed(1) + 'k' : value}`}
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
                          backgroundColor: theme === 'dark' ? '#1e1e1e' : '#fff',
                          borderRadius: '8px',
                          border: 'none',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                        }}
                        formatter={(value: any, name: any) => {
                          if (name === "revenue") return [`Rs. ${Number(value).toLocaleString()}`, "Revenue"];
                          return [value, "Orders"];
                        }}
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

