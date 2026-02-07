"use client";

import { useTheme } from "next-themes";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface RevenueChartProps {
  data: any[];
  loading?: boolean;
}

export function RevenueChart({ data, loading }: RevenueChartProps) {
  const { theme } = useTheme();
  
  // Mock data if empty or loading (for skeleton effect or empty state)
  const chartData = data?.length ? data : [];

  return (
    <Card className="col-span-4 bg-card border-border shadow-sm">
      <CardHeader>
        <CardTitle>Revenue Trend</CardTitle>
        <CardDescription>
          Your gross sales over the selected period.
        </CardDescription>
      </CardHeader>
      <CardContent className="pl-2">
        <div className="h-[300px] w-full">
            {loading ? (
                 <div className="h-full w-full flex items-center justify-center bg-muted/20 animate-pulse rounded-md">
                    <span className="text-muted-foreground text-sm">Loading chart...</span>
                 </div>
            ) : chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                    <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <XAxis
                        dataKey="date"
                        stroke="#888888"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => {
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
                        stroke="#888888"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `Rs.${value >= 1000 ? (value / 1000).toFixed(1) + 'k' : value}`}
                    />
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#333' : '#eee'} />
                    <Tooltip 
                         contentStyle={{ 
                             backgroundColor: theme === 'dark' ? '#1e1e1e' : '#fff',
                             borderRadius: '8px',
                             border: 'none',
                             boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                         }}
                         itemStyle={{ color: '#f97316', fontWeight: 'bold' }}
                         formatter={(value: any) => [`Rs. ${Number(value).toLocaleString()}`, "Revenue"]}
                         labelFormatter={(label) => {
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
                        type="monotone"
                        dataKey="value"
                        stroke="#f97316"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorRevenue)"
                    />
                    </AreaChart>
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
