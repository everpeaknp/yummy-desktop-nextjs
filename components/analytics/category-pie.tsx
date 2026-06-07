"use client";

import { useTheme } from "next-themes";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface CategoryPieChartProps {
  data: any[];
  loading?: boolean;
  title?: string;
  description?: string;
  /** Render chart only (no outer Card) when nested inside another panel */
  embedded?: boolean;
}

const COLORS = ['#f97316', '#3b82f6', '#10b981', '#a855f7', '#ec4899', '#eab308'];

export function CategoryPieChart({
  data,
  loading,
  title = "Sales by Category",
  description = "Distribution of sales across menu categories.",
  embedded = false,
}: CategoryPieChartProps) {
  const { theme } = useTheme();

  const chartBody = (
    <div className="h-[300px] w-full min-w-0 shrink-0">
      {loading ? (
        <div className="h-full w-full flex items-center justify-center bg-muted/20 animate-pulse rounded-md">
          <span className="text-muted-foreground text-sm">Loading chart...</span>
        </div>
      ) : data && data.length > 0 ? (
        <ResponsiveContainer width="100%" height={300} debounce={50}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
              nameKey="name"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: theme === 'dark' ? '#1e1e1e' : '#fff',
                borderRadius: '8px',
                border: 'none',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }}
              formatter={(value: any, name?: string) => [`Rs. ${Number(value).toLocaleString()}`, name || '']}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-full w-full flex items-center justify-center text-muted-foreground">
          No data available
        </div>
      )}
    </div>
  );

  if (embedded) {
    return chartBody;
  }

  return (
    <Card className="col-span-3 dc-card h-full">
      <CardHeader className="border-b border-black/[0.08] pb-4 dark:border-white/10">
        <CardTitle className="dc-card-title">{title}</CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {chartBody}
      </CardContent>
    </Card>
  );
}
