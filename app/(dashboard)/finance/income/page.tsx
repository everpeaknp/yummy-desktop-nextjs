"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api-client";
import { IncomeApis, ExpenseApis } from "@/lib/api/endpoints";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, DollarSign, TrendingUp, Receipt, Download, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { startOfMonth, startOfWeek, endOfDay, subDays } from "date-fns";
import * as XLSX from "xlsx";
import Link from "next/link";

export default function IncomePage() {
  const [loading, setLoading] = useState(false);
  const [incomeData, setIncomeData] = useState<any>(null);
  const [expenseSummary, setExpenseSummary] = useState<any>(null);
  const [dateFilter, setDateFilter] = useState("this_month");
  const [selectedStation, setSelectedStation] = useState("all");

  const user = useAuth(state => state.user);
  const me = useAuth(state => state.me);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      if (!user && token) await me();
      if (!user && !token) router.push('/');
    };
    checkAuth();
  }, [user, me, router]);

  const getDateRange = () => {
    const now = new Date();
    let start = "";
    let end = endOfDay(now).toISOString().split('T')[0];

    if (dateFilter === 'today') {
      start = now.toISOString().split('T')[0];
    } else if (dateFilter === 'this_week') {
      start = startOfWeek(now, { weekStartsOn: 1 }).toISOString().split('T')[0];
    } else if (dateFilter === 'this_month') {
      start = startOfMonth(now).toISOString().split('T')[0];
    } else {
      start = subDays(now, 365).toISOString().split('T')[0];
    }
    return { start, end };
  };

  const fetchData = async () => {
    if (!user?.restaurant_id) return;
    setLoading(true);
    const { start, end } = getDateRange();
    const stationParam = selectedStation === 'all' ? undefined : selectedStation;

    try {
      const dashboardUrl = IncomeApis.dashboard({
        restaurantId: user.restaurant_id,
        dateFrom: start,
        dateTo: end,
        station: stationParam
      });

      const [dashboardRes, recentRes, expenseSummaryRes] = await Promise.all([
        apiClient.get(dashboardUrl),
        apiClient.get(IncomeApis.recent, {
          params: { restaurant_id: user.restaurant_id, date_from: start, date_to: end, station: stationParam }
        }),
        apiClient.get(ExpenseApis.summaryTotal, {
          params: {
            restaurant_id: user.restaurant_id,
            date_from: start,
            date_to: end,
            station: stationParam
          }
        })
      ]);

      if (dashboardRes.data.status === 'success') {
        setIncomeData((prev: any) => ({ ...prev, ...dashboardRes.data.data }));
      }
      if (recentRes.data.status === 'success') {
        setIncomeData((prev: any) => ({ ...prev, recent_entries: recentRes.data.data }));
      }
      if (expenseSummaryRes.data.status === 'success') {
        setExpenseSummary(expenseSummaryRes.data.data);
      }
    } catch (err) {
      console.error("Failed to fetch income data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.restaurant_id) {
      fetchData();
    }
  }, [user, selectedStation, dateFilter]);

  const handleExport = () => {
    if (!incomeData?.recent_entries?.length) return;
    const dataToExport = incomeData.recent_entries.map((entry: any) => ({
      "Description": entry.description || "Manual Entry",
      "Amount": entry.amount,
      "Date": new Date(entry.paid_at).toLocaleDateString(),
      "Source": entry.source || "Day Close",
      "Payment Method": entry.payment_method || "-"
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Income");
    XLSX.writeFile(wb, `Income_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="flex flex-col gap-8 max-w-[1600px] mx-auto p-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/manage">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-500">Income</h1>
            <p className="text-muted-foreground">Track sales revenue and cash flow.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedStation} onValueChange={setSelectedStation}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Station" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stations</SelectItem>
              <SelectItem value="kitchen">Kitchen</SelectItem>
              <SelectItem value="bar">Bar</SelectItem>
              <SelectItem value="cafe">Cafe</SelectItem>
              <SelectItem value="general">General</SelectItem>
            </SelectContent>
          </Select>

          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Date Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="this_week">This Week</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              label="Total Revenue"
              value={incomeData?.summary?.total_net_income || 0}
              icon={<DollarSign className="w-5 h-5" />}
              color="text-emerald-500"
              bg="bg-emerald-50 dark:bg-emerald-950/20"
            />
            <MetricCard
              label="Gross Sales"
              value={incomeData?.summary?.gross_sales || 0}
              icon={<Receipt className="w-5 h-5" />}
              color="text-indigo-500"
              bg="bg-indigo-50 dark:bg-indigo-950/20"
            />
            <MetricCard
              label="Net Profit"
              value={(incomeData?.summary?.total_net_income || 0) - (expenseSummary?.total_amount || 0)}
              icon={<TrendingUp className="w-5 h-5" />}
              color={(incomeData?.summary?.total_net_income || 0) - (expenseSummary?.total_amount || 0) >= 0 ? "text-blue-500" : "text-red-500"}
              bg={(incomeData?.summary?.total_net_income || 0) - (expenseSummary?.total_amount || 0) >= 0 ? "bg-blue-50 dark:bg-blue-950/20" : "bg-red-50 dark:bg-red-950/20"}
            />
            <MetricCard
              label="Service Charges"
              value={incomeData?.summary?.total_service_charge || 0}
              icon={<DollarSign className="w-5 h-5" />}
              color="text-amber-500"
              bg="bg-amber-50 dark:bg-amber-950/20"
            />
          </div>

          <Card className="border-border">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/30">
              <h3 className="font-semibold">Recent Income Entries</h3>
              <Button variant="outline" size="sm" onClick={handleExport} disabled={!incomeData?.recent_entries?.length}>
                <Download className="w-4 h-4 mr-2" /> Export Excel
              </Button>
            </div>
            <CardContent className="p-0">
              {!incomeData?.recent_entries?.length ? (
                <div className="p-8 text-center text-muted-foreground">
                  No recent income entries found for this period.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted/50 text-muted-foreground font-medium border-b border-border">
                      <tr>
                        <th className="px-6 py-4">Description</th>
                        <th className="px-6 py-4">Amount</th>
                        <th className="px-6 py-4">Date</th>
                        <th className="px-6 py-4">Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {incomeData.recent_entries.map((entry: any, idx: number) => (
                        <tr key={idx} className="hover:bg-muted/30 transition-colors">
                          <td className="px-6 py-4 font-medium">{entry.description || "Manual Entry"}</td>
                          <td className="px-6 py-4 font-bold text-emerald-600 dark:text-emerald-500">+ Rs. {Number(entry.amount).toLocaleString()}</td>
                          <td className="px-6 py-4 text-muted-foreground">{new Date(entry.paid_at).toLocaleDateString()}</td>
                          <td className="px-6 py-4">
                            <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 capitalize">
                              {entry.source || "Day Close"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, icon, color, bg }: any) {
  return (
    <Card className="overflow-hidden border-border bg-card">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
            <h3 className="text-2xl font-bold">Rs. {Number(value || 0).toLocaleString()}</h3>
          </div>
          <div className={`p-3 rounded-xl ${bg} ${color}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
