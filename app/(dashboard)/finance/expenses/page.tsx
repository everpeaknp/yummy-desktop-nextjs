"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api-client";
import { ExpenseApis } from "@/lib/api/endpoints";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, TrendingDown, Receipt, Download, ArrowLeft, Plus, Calendar, TrendingUp, DollarSign, Utensils, Hotel } from "lucide-react";
import { PaymentMethodBreakdown } from "@/components/analytics/payment-method-breakdown";
import {
  fetchAllExpensesForFilters,
  fetchExpenseListPage,
  fetchExpenseSummaryTotal,
  type ExpenseSummaryTotal,
} from "@/lib/finance-expense-api";
import { mapExpenseRowsToPaymentMix } from "@/lib/finance-payment-mix";
import { getApiErrorMessage } from "@/lib/api-response";
import { dispatchFinanceMutationSync } from "@/lib/sync-invalidation";
import { useSyncInvalidation } from "@/hooks/use-sync-invalidation";
import {
  getFinanceDateRange,
  resolveBusinessLineParam,
  type FinanceBusinessLine,
  type FinanceDateFilter,
} from "@/lib/finance-query";
import type { PaymentMixView } from "@/types/analytics";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useRestaurant } from "@/hooks/use-restaurant";
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
// import * as XLSX from "xlsx"; // Removed for optimization
import Link from "next/link";

export default function ExpensesPage() {
  const [loading, setLoading] = useState(false);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [dateFilter, setDateFilter] = useState<FinanceDateFilter>("this_month");
  const [selectedStation, setSelectedStation] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newExpense, setNewExpense] = useState({
    amount: "",
    description: "",
    station: "other",
    category_id: "",
    payment_method: "cash"
  });
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [customStartTime, setCustomStartTime] = useState("00:00");
  const [customEndTime, setCustomEndTime] = useState("23:59");
  const [recentLimit, setRecentLimit] = useState(25);
  const [businessLine, setBusinessLine] = useState<FinanceBusinessLine>("restaurant");
  const [expenseSummary, setExpenseSummary] = useState<ExpenseSummaryTotal | null>(null);
  const [expensePaymentMix, setExpensePaymentMix] = useState<PaymentMixView | null>(null);

  const user = useAuth(state => state.user);
  const me = useAuth(state => state.me);
  const router = useRouter();
  const restaurant = useRestaurant((s) => s.restaurant);

  useEffect(() => {
    const checkAuth = async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      if (!user && token) await me();
      if (!user && !token) router.push('/');

      if (user?.restaurant_id) {
        try {
          const bl = resolveBusinessLineParam(businessLine);
          const res = await apiClient.get(ExpenseApis.expenseCategories, {
            params: {
              restaurant_id: user.restaurant_id,
              ...(bl ? { business_line: bl } : {}),
            },
          });
          if (res.data.status === 'success') {
            setCategories(res.data.data);
          }
        } catch (e) { console.error("Failed to load categories", e); }
      }
    };
    checkAuth();
  }, [user, me, router, businessLine]);

  const fetchData = async () => {
    if (!user?.restaurant_id) return;
    setLoading(true);
    const { start, end } = getFinanceDateRange(dateFilter, {
      startDate: customStartDate,
      endDate: customEndDate,
    });

    const filters = {
      restaurantId: user.restaurant_id,
      dateFrom: start,
      dateTo: end,
      station: selectedStation,
      categoryId:
        selectedCategory === 'all' ? undefined : Number(selectedCategory),
      businessLine,
    };

    try {
      const summary = await fetchExpenseSummaryTotal(apiClient, filters);
      setExpenseSummary(summary);

      const { expenses: listRows } = await fetchExpenseListPage(
        apiClient,
        filters,
        0,
        recentLimit
      );
      setExpenses(listRows as any[]);

      if (summary && summary.total_count > 0) {
        const allRows = await fetchAllExpensesForFilters(
          apiClient,
          filters,
          summary.total_count
        );
        setExpensePaymentMix(
          mapExpenseRowsToPaymentMix(allRows as Array<{ payment_method?: string; amount?: number }>)
        );
      } else {
        setExpensePaymentMix({ available: false, methods: [], expandedPieSlices: [] });
      }
    } catch (err) {
      console.error("Failed to fetch expenses:", err);
      setExpenseSummary(null);
      setExpensePaymentMix(null);
    } finally {
      setLoading(false);
    }
  };

  const handleAddExpense = async () => {
    if (!user?.restaurant_id || !newExpense.amount || !newExpense.category_id) {
        toast.error("Please fill in required fields");
        return;
    }

    setSaving(true);
    try {
        const bl = resolveBusinessLineParam(businessLine) ?? "restaurant";
        const payload = {
            restaurant_id: user.restaurant_id,
            amount: parseFloat(newExpense.amount),
            description: newExpense.description,
            category_id: parseInt(newExpense.category_id),
            payment_method: newExpense.payment_method,
            station: newExpense.station,
            business_line: bl,
        };

        const res = await apiClient.post(ExpenseApis.list, payload);
        if (res.data.status === 'success') {
            toast.success("Expense recorded successfully");
            setIsAddDialogOpen(false);
            setNewExpense({
                amount: "",
                description: "",
                station: "other",
                category_id: "",
                payment_method: "cash"
            });
            dispatchFinanceMutationSync({ reason: "expense-added" });
            fetchData();
        } else {
            toast.error(res.data?.message || "Failed to record expense");
        }
    } catch (err) {
        toast.error(getApiErrorMessage(err, "Failed to record expense"));
    } finally {
        setSaving(false);
    }
  };

  useEffect(() => {
    if (user?.restaurant_id) {
      fetchData();
    }
  }, [user, selectedStation, dateFilter, selectedCategory, recentLimit, customStartDate, customEndDate, customStartTime, customEndTime, businessLine]);

  const fetchDataRef = useRef(fetchData);
  fetchDataRef.current = fetchData;

  useSyncInvalidation(
    ["finance", "day-close"],
    () => {
      void fetchDataRef.current();
    },
    [user?.restaurant_id]
  );

  const filteredExpenses = expenses.filter((expense: any) => {
    if (dateFilter !== 'custom') return true;
    try {
      const expenseDate = new Date(expense.expense_date || expense.paid_on || expense.created_at);
      const startLocal = new Date(`${customStartDate || new Date().toISOString().split('T')[0]}T${customStartTime || "00:00"}:00`);
      const endLocal = new Date(`${customEndDate || new Date().toISOString().split('T')[0]}T${customEndTime || "23:59"}:59`);
      return expenseDate >= startLocal && expenseDate <= endLocal;
    } catch (e) {
      return true;
    }
  });

  const handleExport = async () => {
    if (!filteredExpenses.length) return;
    const XLSX = await import("xlsx");
    const dataToExport = filteredExpenses.map((expense: any) => ({
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
    <div className="flex flex-col gap-8 max-w-[1600px] mx-auto p-6">
      <div className="flex flex-col gap-4 w-full">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 w-full">
          <div className="flex items-center gap-4">
            <Link href="/manage">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-red-600 dark:text-red-500">Expenses</h1>
              <p className="text-muted-foreground whitespace-nowrap">Manage and track your operational costs.</p>
            </div>
            <Link href="/finance/income">
              <Button variant="outline" size="sm" className="hidden sm:flex border-emerald-200 hover:bg-emerald-50 hover:text-emerald-600 dark:border-emerald-900/30 dark:hover:bg-emerald-950/20 gap-2">
                <TrendingUp className="h-4 w-4" />
                View Income
              </Button>
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-end">
            {restaurant?.hotel_enabled && (
              <div className="flex items-center bg-muted/50 p-1 rounded-lg border border-border">
                <Button
                  variant={businessLine === 'restaurant' ? 'secondary' : 'ghost'}
                  size="sm"
                  className={cn("h-8 px-3 text-xs gap-2", businessLine === 'restaurant' && "bg-background shadow-sm")}
                  onClick={() => setBusinessLine('restaurant')}
                >
                  <Utensils className="h-3.5 w-3.5 text-orange-500" />
                  Restaurant
                </Button>
                <Button
                  variant={businessLine === 'hotel' ? 'secondary' : 'ghost'}
                  size="sm"
                  className={cn("h-8 px-3 text-xs gap-2", businessLine === 'hotel' && "bg-background shadow-sm")}
                  onClick={() => setBusinessLine('hotel')}
                >
                  <Hotel className="h-3.5 w-3.5 text-blue-500" />
                  Hotel
                </Button>
              </div>
            )}
            <Select value={selectedStation} onValueChange={setSelectedStation}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Station" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stations</SelectItem>
                <SelectItem value="kitchen">Kitchen</SelectItem>
                <SelectItem value="bar">Bar</SelectItem>
                <SelectItem value="cafe">Cafe</SelectItem>
                {restaurant?.hotel_enabled && (
                  <SelectItem value="rooms">Rooms / Hotel</SelectItem>
                )}
                <SelectItem value="general">General</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as FinanceDateFilter)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="this_week">This Week</SelectItem>
                <SelectItem value="this_month">This Month</SelectItem>
                <SelectItem value="custom">Custom Date</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {dateFilter === 'custom' && (
          <div className="flex flex-wrap items-center gap-2 justify-start md:justify-end w-full animate-in fade-in slide-in-from-top-1 duration-200 bg-muted/30 p-3 rounded-xl border border-border">
            <span className="text-xs font-semibold text-muted-foreground mr-1">Time Slice:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="flex h-9 w-[130px] rounded-md border border-input bg-background dark:bg-muted/50 px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <input
              type="time"
              value={customStartTime}
              onChange={(e) => setCustomStartTime(e.target.value || "00:00")}
              className="flex h-9 w-[100px] rounded-md border border-input bg-background dark:bg-muted/50 px-2 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <span className="text-xs text-muted-foreground font-semibold px-1">to</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="flex h-9 w-[130px] rounded-md border border-input bg-background dark:bg-muted/50 px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <input
              type="time"
              value={customEndTime}
              onChange={(e) => setCustomEndTime(e.target.value || "23:59")}
              className="flex h-9 w-[100px] rounded-md border border-input bg-background dark:bg-muted/50 px-2 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <MetricCard
          label="Total Expenses"
          value={expenseSummary?.total_amount ?? 0}
          icon={<TrendingDown className="w-5 h-5" />}
          color="text-red-500"
          bg="bg-red-50 dark:bg-red-950/20"
        />
        <MetricCard
          label="Expense Entries"
          value={expenseSummary?.total_count ?? 0}
          icon={<Receipt className="w-5 h-5" />}
          color="text-amber-500"
          bg="bg-amber-50 dark:bg-amber-950/20"
          isCount
        />
        <MetricCard
          label="Go to Income"
          value="View Revenue"
          icon={<DollarSign className="w-5 h-5" />}
          color="text-emerald-500"
          bg="bg-emerald-50 dark:bg-emerald-950/20"
          href="/finance/income"
          isStringValue
        />
      </div>

      {!loading && (
        <PaymentMethodBreakdown
          title="Expenses by Payment Method"
          description="Grouped from the full filtered expense set for this period (backend rows)."
          mix={expensePaymentMix}
        />
      )}

      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Category:</span>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Categories" />
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
          <Button variant="outline" onClick={handleExport} disabled={!filteredExpenses.length}>
            <Download className="w-4 h-4 mr-2" /> Export Excel
          </Button>
          <Button 
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            onClick={() => setIsAddDialogOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" /> Add Expense
          </Button>
        </div>
      </div>

      {/* Add Expense Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
                <DialogTitle>Add New Expense</DialogTitle>
                <DialogDescription>
                    Record a new business expense. Required fields are marked with *.
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="amount" className="text-right">Amount*</Label>
                    <Input
                        id="amount"
                        type="number"
                        placeholder="0.00"
                        className="col-span-3"
                        value={newExpense.amount}
                        onChange={(e) => setNewExpense({...newExpense, amount: e.target.value})}
                    />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="station" className="text-right">Station</Label>
                    <Select 
                        value={newExpense.station} 
                        onValueChange={(val) => setNewExpense({...newExpense, station: val, category_id: ""})}
                    >
                        <SelectTrigger className="col-span-3">
                            <SelectValue placeholder="Select Station" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="kitchen">Kitchen</SelectItem>
                            <SelectItem value="bar">Bar</SelectItem>
                            <SelectItem value="cafe">Cafe</SelectItem>
                            {restaurant?.hotel_enabled && (
                              <SelectItem value="rooms">Rooms / Hotel</SelectItem>
                            )}
                            <SelectItem value="other">General / Other</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="category" className="text-right">Category*</Label>
                    <Select 
                        value={newExpense.category_id} 
                        onValueChange={(val) => setNewExpense({...newExpense, category_id: val})}
                    >
                        <SelectTrigger className="col-span-3">
                            <SelectValue placeholder="Select Category" />
                        </SelectTrigger>
                        <SelectContent>
                            {categories
                                .filter((cat: any) => cat.type === newExpense.station || (!cat.type && newExpense.station === 'other'))
                                .map((cat: any) => (
                                    <SelectItem key={cat.id} value={cat.id.toString()}>{cat.name}</SelectItem>
                                ))
                            }
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="method" className="text-right">Payment</Label>
                    <Select 
                        value={newExpense.payment_method} 
                        onValueChange={(val) => setNewExpense({...newExpense, payment_method: val})}
                    >
                        <SelectTrigger className="col-span-3">
                            <SelectValue placeholder="Method" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="cash">Cash</SelectItem>
                            <SelectItem value="card">Card</SelectItem>
                            <SelectItem value="digital">Digital</SelectItem>
                            <SelectItem value="fonepay">Fonepay</SelectItem>
                            <SelectItem value="credit">Credit</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="desc" className="text-right">Notes</Label>
                    <Textarea
                        id="desc"
                        placeholder="What was this for?"
                        className="col-span-3"
                        value={newExpense.description}
                        onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}
                    />
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                <Button 
                    className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                    onClick={handleAddExpense}
                    disabled={saving}
                >
                    {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Record Expense
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-red-500" />
        </div>
      ) : filteredExpenses.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-xl bg-muted/20">
          <Receipt className="w-12 h-12 mb-4 opacity-20" />
          <p>No expenses found for the selected period.</p>
        </div>
      ) : (
        <Card className="border-border">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground font-medium border-b border-border">
                  <tr>
                    <th className="px-6 py-4">Description</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4">Amount</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredExpenses.map((expense: any) => (
                    <tr key={expense.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 font-medium">{expense.description || "Untitled"}</td>
                      <td className="px-6 py-4 text-muted-foreground">{expense.category?.name || "General"}</td>
                      <td className="px-6 py-4 font-bold text-red-600 dark:text-red-500">- Rs. {Number(expense.amount).toLocaleString()}</td>
                      <td className="px-6 py-4 text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(expense.expense_date || expense.paid_on).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className="border-border text-muted-foreground capitalize">
                          {expense.status || "Completed"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {expenses.length >= recentLimit && (
              <div className="p-4 border-t border-border flex justify-center bg-muted/10">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-red-600 hover:text-red-700 dark:text-red-500 dark:hover:text-red-400 font-semibold"
                  onClick={() => setRecentLimit(prev => prev + 25)}
                >
                  View More Expenses
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MetricCard({ label, value, icon, color, bg, href, isStringValue, isCount }: any) {
  const content = (
    <Card className={cn(
      "overflow-hidden border-border bg-card transition-colors",
      href && "hover:bg-muted/50 cursor-pointer"
    )}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
            <h3 className="text-2xl font-bold">
              {isStringValue
                ? value
                : isCount
                  ? Number(value || 0).toLocaleString()
                  : `Rs. ${Number(value || 0).toLocaleString()}`}
            </h3>
          </div>
          <div className={`p-3 rounded-xl ${bg} ${color}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
