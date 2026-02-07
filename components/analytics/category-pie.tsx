"use client";

import { useTheme } from "next-themes";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface CategoryPieChartProps {
  data: any[];
  loading?: boolean;
}

const COLORS = ['#f97316', '#3b82f6', '#10b981', '#a855f7', '#ec4899', '#eab308'];

export function CategoryPieChart({ data, loading }: CategoryPieChartProps) {
  const { theme } = useTheme();

  return (
    <Card className="col-span-3 bg-card border-border shadow-sm">
      <CardHeader>
        <CardTitle>Sales by Category</CardTitle>
        <CardDescription>
          Distribution of sales across menu categories.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
            {loading ? (
                 <div className="h-full w-full flex items-center justify-center bg-muted/20 animate-pulse rounded-md">
                    <span className="text-muted-foreground text-sm">Loading chart...</span>
                 </div>
            ) : data && data.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
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
                         formatter={(value: any, name: string) => [`Rs. ${Number(value).toLocaleString()}`, name]}
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
      </CardContent>
    </Card>
  );
}
