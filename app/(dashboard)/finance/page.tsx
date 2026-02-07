"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api-client";
import { ExpenseApis, IncomeApis } from "@/lib/api/endpoints";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, TrendingUp, TrendingDown, DollarSign, Plus, Receipt, Calendar, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { startOfMonth, startOfWeek, endOfDay, subDays } from "date-fns";
import * as XLSX from "xlsx";

export default function FinancePage() {
    const [activeTab, setActiveTab] = useState("income");
    const [loading, setLoading] = useState(false);
    const [incomeData, setIncomeData] = useState<any>(null);
    const [expenseSummary, setExpenseSummary] = useState<any>(null);
    const [expenses, setExpenses] = useState<any[]>([]);

    // Filters
    const [selectedStation, setSelectedStation] = useState("all");
    const [dateFilter, setDateFilter] = useState("this_month");
    const [categories, setCategories] = useState<any[]>([]);
    const [selectedCategory, setSelectedCategory] = useState("all");

    const user = useAuth(state => state.user);
    const me = useAuth(state => state.me);
    const router = useRouter();

    // 1. Session Restoration & Load Categories
    useEffect(() => {
        const checkAuth = async () => {
            const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
            if (!user && token) await me();
            if (!user && !token) router.push('/');

            // Load Categories
            if (user?.restaurant_id) {
                try {
                    const res = await apiClient.get(ExpenseApis.expenseCategories, {
                        params: { restaurant_id: user.restaurant_id }
                    });
                    if (res.data.status === 'success') {
                        setCategories(res.data.data);
                    }
                } catch (e) { console.error("Failed to load categories", e); }
            }
        };
        const timer = setTimeout(checkAuth, 500);
        return () => clearTimeout(timer);
    }, [user, me, router]);

    // Helper to get dates
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
            // All time (last 365 days for safety)
            start = subDays(now, 365).toISOString().split('T')[0];
        }
        return { start, end };
    };

    // 2. Fetch Data based on Tab & Filters
    useEffect(() => {
        const fetchData = async () => {
            if (!user?.restaurant_id) return;
            setLoading(true);
            const { start, end } = getDateRange();
            const stationParam = selectedStation === 'all' ? undefined : selectedStation;

            try {
                if (activeTab === 'income') {
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
                } else {
                    const res = await apiClient.get(ExpenseApis.list, {
                        params: {
                            restaurant_id: user.restaurant_id,
                            date_from: start,
                            date_to: end,
                            station: stationParam,
                            category_id: selectedCategory === 'all' ? undefined : selectedCategory
                        }
                    });
                    if (res.data.status === 'success') {
                        setExpenses(res.data.data.expenses || []);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch finance data:", err);
            } finally {
                setLoading(false);
            }
        };

        if (user?.restaurant_id) {
            fetchData();
        }
    }, [user, activeTab, selectedStation, dateFilter, selectedCategory]);

    // Export Handlers
    const handleExportIncome = () => {
        if (!incomeData?.recent) return;

        // Flatten data for nicer excel structure
        const dataToExport = incomeData.recent.map((entry: any) => ({
            "Description": entry.description || "Manual Entry",
            "Amount": entry.amount,
            "Date": new Date(entry.paid_at).toLocaleDateString(),
            "Source": entry.source_type || "Day Close",
            "Payment Method": entry.payment_method || "-"
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Income");
        XLSX.writeFile(wb, `Income_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleExportExpenses = () => {
        if (!expenses.length) return;

        const dataToExport = expenses.map((expense: any) => ({
            "Description": expense.description || "Untitled",
            "Category": expense.category?.name || "General",
            "Amount": expense.amount,
            "Date": new Date(expense.expense_date || expense.paid_on).toLocaleDateString(),
            "Status": expense.status || "Completed"
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Expenses");
        XLSX.writeFile(wb, `Expense_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    return (
        <div className="flex flex-col gap-6 max-w-[1600px] mx-auto p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Finance</h1>
                    <p className="text-muted-foreground">Manage expenses and track income.</p>
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

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="bg-muted border border-border mb-6">
                    <TabsTrigger value="income" className="data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-700 dark:data-[state=active]:bg-emerald-950 dark:data-[state=active]:text-emerald-500">
                        <TrendingUp className="w-4 h-4 mr-2" /> Income
                    </TabsTrigger>
                    <TabsTrigger value="expenses" className="data-[state=active]:bg-red-100 data-[state=active]:text-red-700 dark:data-[state=active]:bg-red-950 dark:data-[state=active]:text-red-500">
                        <TrendingDown className="w-4 h-4 mr-2" /> Expenses
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="income">
                    {loading ? <LoadingState /> : (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                <MetricCard
                                    label="Total Revenue"
                                    value={incomeData?.summary?.total_net_income || 0}
                                    icon={<DollarSign className="w-5 h-5" />}
                                    color="text-emerald-500"
                                    borderColor="border-emerald-500/50"
                                />
                                <MetricCard
                                    label="Total Expenses"
                                    value={expenseSummary?.total_amount || 0}
                                    icon={<TrendingDown className="w-5 h-5" />}
                                    color="text-red-500"
                                    borderColor="border-red-500/50"
                                />
                                <MetricCard
                                    label="Net Profit"
                                    value={(incomeData?.summary?.total_net_income || 0) - (expenseSummary?.total_amount || 0)}
                                    icon={<TrendingUp className="w-5 h-5" />}
                                    color={(incomeData?.summary?.total_net_income || 0) - (expenseSummary?.total_amount || 0) >= 0 ? "text-blue-500" : "text-red-500"}
                                    borderColor={(incomeData?.summary?.total_net_income || 0) - (expenseSummary?.total_amount || 0) >= 0 ? "border-blue-500/50" : "border-red-500/50"}
                                />
                                <MetricCard
                                    label="Gross Sales"
                                    value={incomeData?.summary?.gross_sales || 0}
                                    icon={<Receipt className="w-5 h-5" />}
                                    color="text-indigo-500"
                                    borderColor="border-indigo-500/50"
                                />
                            </div>

                            {/* Recent Income Table */}
                            <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
                                <div className="px-6 py-4 border-b border-border bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between">
                                    <h3 className="font-semibold">Recent Income Entries</h3>
                                    <Button variant="outline" size="sm" onClick={handleExportIncome} disabled={!incomeData?.recent?.length}>
                                        <Download className="w-4 h-4 mr-2" /> Export Excel
                                    </Button>
                                </div>
                                {incomeData?.recent?.length === 0 ? (
                                    <div className="p-8 text-center text-muted-foreground">
                                        No recent income entries found.
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-muted text-muted-foreground font-medium border-b border-border">
                                                <tr>
                                                    <th className="px-6 py-4">Description</th>
                                                    <th className="px-6 py-4">Amount</th>
                                                    <th className="px-6 py-4">Date</th>
                                                    <th className="px-6 py-4">Source</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border">
                                                {(incomeData?.recent || []).map((entry: any) => (
                                                    <tr key={entry.order_id || entry.id || Math.random()} className="hover:bg-muted/50 transition-colors">
                                                        <td className="px-6 py-4 font-medium text-foreground">{entry.description || "Manual Entry"}</td>
                                                        <td className="px-6 py-4 font-bold text-emerald-600">+ Rs. {Number(entry.amount).toLocaleString()}</td>
                                                        <td className="px-6 py-4 text-muted-foreground">{new Date(entry.paid_at).toLocaleDateString()}</td>
                                                        <td className="px-6 py-4">
                                                            <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                                                                {entry.source || "Day Close"}
                                                            </Badge>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="expenses">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Filter by:</span>
                            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Category" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Categories</SelectItem>
                                    {categories.map((cat: any) => (
                                        <SelectItem key={cat.id} value={cat.id.toString()}>{cat.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" onClick={handleExportExpenses} disabled={!expenses.length}>
                                <Download className="w-4 h-4 mr-2" /> Export Excel
                            </Button>
                            <Button className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                                <Plus className="w-4 h-4 mr-2" /> Add Expense
                            </Button>
                        </div>
                    </div>
                    {loading ? <LoadingState /> : expenses.length === 0 ? (
                        <div className="h-64 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-lg">
                            <Receipt className="w-12 h-12 mb-4 opacity-20" />
                            <p>No expenses recorded.</p>
                        </div>
                    ) : (
                        <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-muted text-muted-foreground font-medium border-b border-border">
                                        <tr>
                                            <th className="px-6 py-4">Description</th>
                                            <th className="px-6 py-4">Category</th>
                                            <th className="px-6 py-4">Amount</th>
                                            <th className="px-6 py-4">Date</th>
                                            <th className="px-6 py-4">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {expenses.map((expense: any) => (
                                            <tr key={expense.id} className="hover:bg-muted/50 transition-colors">
                                                <td className="px-6 py-4 font-medium text-foreground">{expense.description || "Untitled"}</td>
                                                <td className="px-6 py-4 text-muted-foreground">{expense.category?.name || "General"}</td>
                                                <td className="px-6 py-4 font-bold text-destructive">- Rs. {Number(expense.amount).toLocaleString()}</td>
                                                <td className="px-6 py-4 text-muted-foreground">
                                                    <div className="flex items-center gap-2">
                                                        <Calendar className="w-3 h-3" />
                                                        {new Date(expense.expense_date || expense.paid_on).toLocaleDateString()}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <Badge variant="outline" className="border-border text-muted-foreground">
                                                        {expense.status || "Completed"}
                                                    </Badge>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}

function MetricCard({ label, value, icon, color, borderColor }: any) {
    return (
        <Card className={`bg-card border-l-4 shadow-sm ${borderColor} ${color}`}>
            <CardContent className="p-6 flex items-start justify-between">
                <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1 uppercase tracking-wider">{label}</p>
                    <h3 className="text-3xl font-bold text-foreground">Rs. {value.toLocaleString()}</h3>
                </div>
                <div className={`p-3 rounded-lg bg-muted text-card-foreground ${color}`}>
                    {icon}
                </div>
            </CardContent>
        </Card>
    )
}

function LoadingState() {
    return (
        <div className="h-64 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
    )
}
