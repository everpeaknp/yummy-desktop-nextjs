"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api-client";
import { DrawerSessionApis, ExpenseApis, FinanceApis } from "@/lib/api/endpoints";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, TrendingDown, Receipt, Download, ArrowLeft, Plus, Calendar, TrendingUp, DollarSign, Utensils, Hotel, CheckCircle2, XCircle, Clock, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRestaurant } from "@/hooks/use-restaurant";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { startOfMonth, startOfWeek, endOfDay, subDays } from "date-fns";
import Link from "next/link";
import { FinanceSectionTabs } from "@/components/finance/finance-section-tabs";
import type { FinanceExpensesResponse } from "@/types/finance";
import { CASH_OUT_PAYMENT_METHOD_OPTIONS as PAYMENT_METHOD_OPTIONS } from "@/lib/payment-method-options";
import {
  buildCashExpenseDrawerPayload,
  parseActiveCashDrawers,
  type ActiveCashDrawerSession,
} from "@/lib/cash-expense-drawer-selection";

function hasFinanceActivity(metrics: FinanceExpensesResponse["metrics"] | undefined): boolean {
  if (!metrics) return false;
  return [
    metrics.sales_total,
    metrics.collections_total,
    metrics.credit_sales,
    metrics.refund_total,
    metrics.manual_income_total,
    metrics.manual_operating_expense,
    metrics.inventory_cash_outflow,
    metrics.inventory_asset_acquired,
    metrics.inventory_cogs,
    metrics.refund_liabilities,
    metrics.supplier_payables,
    metrics.supplier_payments,
  ].some((value) => Math.abs(Number(value) || 0) > 0.0001);
}

type BusinessLineFilter = "all" | "restaurant" | "hotel";

function normalizeExpensePaymentMethod(raw: string | null | undefined): string {
  const value = String(raw ?? "").trim().toLowerCase();
  if (!value) return "Unspecified";
  if (value.includes("cash")) return "Cash";
  if (value.includes("card")) return "Card";
  if (
    value.includes("digital") ||
    value.includes("upi") ||
    value.includes("qr") ||
    value.includes("wallet")
  ) {
    return "Digital";
  }
  if (value.includes("credit")) return "Credit";
  if (value.includes("fonepay")) return "Fonepay";
  return value
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildExpensePaymentMethodBreakdown(expenses: any[]) {
  const totals = new Map<string, number>();
  for (const expense of expenses) {
    const method = normalizeExpensePaymentMethod(expense.payment_method);
    const amount = Number(expense.amount) || 0;
    totals.set(method, (totals.get(method) ?? 0) + amount);
  }
  const grandTotal = Array.from(totals.values()).reduce((sum, n) => sum + n, 0);
  return Array.from(totals.entries())
    .map(([method, amount]) => ({
      method,
      amount,
      percentage: grandTotal > 0 ? amount / grandTotal : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export default function ExpensesPage() {
  const [loading, setLoading] = useState(false);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("approved");
  const [financeExpenses, setFinanceExpenses] = useState<FinanceExpensesResponse | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [dateFilter, setDateFilter] = useState("this_month");
  const [businessLine, setBusinessLine] = useState<BusinessLineFilter>("all");
  const [selectedStation, setSelectedStation] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [newExpense, setNewExpense] = useState({
    amount: "",
    description: "",
    station: "other",
    category_id: "",
    payment_method: "cash",
  });
  const [cashDrawerControlsEnabled, setCashDrawerControlsEnabled] = useState(false);
  const [cashDrawerSessions, setCashDrawerSessions] = useState<ActiveCashDrawerSession[]>([]);
  const [selectedCashDrawerSessionId, setSelectedCashDrawerSessionId] = useState("");
  const [cashDrawerLoading, setCashDrawerLoading] = useState(false);
  const [cashDrawerResolved, setCashDrawerResolved] = useState(false);
  const [cashDrawerError, setCashDrawerError] = useState<string | null>(null);
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [customStartTime, setCustomStartTime] = useState("00:00");
  const [customEndTime, setCustomEndTime] = useState("23:59");
  const [recentLimit, setRecentLimit] = useState(25);

  const user = useAuth((state) => state.user);
  const me = useAuth((state) => state.me);
  const router = useRouter();
  const restaurant = useRestaurant((s) => s.restaurant);
  const selectedModule = useRestaurant((s) => s.selectedModule);

  const dualBusinessLines =
    !!restaurant?.hotel_enabled && !!restaurant?.restaurant_enabled;

  const listBusinessLineParam =
    businessLine === "all" ? undefined : businessLine;

  const createBusinessLine = useMemo((): "restaurant" | "hotel" => {
    if (businessLine === "restaurant" || businessLine === "hotel") {
      return businessLine;
    }
    if (selectedModule === "hotel" || selectedModule === "restaurant") {
      return selectedModule;
    }
    if (restaurant?.hotel_enabled && !restaurant?.restaurant_enabled) {
      return "hotel";
    }
    return "restaurant";
  }, [businessLine, selectedModule, restaurant?.hotel_enabled, restaurant?.restaurant_enabled]);

  useEffect(() => {
    let cancelled = false;

    const resetDrawerState = () => {
      setCashDrawerControlsEnabled(false);
      setCashDrawerSessions([]);
      setSelectedCashDrawerSessionId("");
      setCashDrawerResolved(false);
      setCashDrawerError(null);
    };

    const loadCashDrawers = async () => {
      if (!isAddDialogOpen || editingExpense || !user?.restaurant_id) {
        resetDrawerState();
        return;
      }

      setCashDrawerLoading(true);
      setCashDrawerResolved(false);
      setCashDrawerError(null);
      try {
        const response = await apiClient.get(
          DrawerSessionApis.active({
            restaurantId: Number(user.restaurant_id),
            businessLine: createBusinessLine,
          }),
        );
        if (cancelled) return;

        const result = parseActiveCashDrawers(response.data);
        setCashDrawerControlsEnabled(result.controlsEnabled);
        setCashDrawerSessions(result.sessions);
        setCashDrawerResolved(true);
        setSelectedCashDrawerSessionId((current) => {
          if (current && result.sessions.some((session) => String(session.id) === current)) {
            return current;
          }
          return result.sessions[0]?.id ? String(result.sessions[0].id) : "";
        });
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to load active cash drawers", error);
        setCashDrawerControlsEnabled(true);
        setCashDrawerSessions([]);
        setSelectedCashDrawerSessionId("");
        setCashDrawerResolved(false);
        setCashDrawerError("Unable to load open cash drawers. Refresh and try again.");
      } finally {
        if (!cancelled) setCashDrawerLoading(false);
      }
    };

    void loadCashDrawers();
    return () => {
      cancelled = true;
    };
  }, [createBusinessLine, editingExpense, isAddDialogOpen, user?.restaurant_id]);

  useEffect(() => {
    if (!dualBusinessLines) {
      if (restaurant?.hotel_enabled && !restaurant?.restaurant_enabled) {
        setBusinessLine("hotel");
      } else {
        setBusinessLine("restaurant");
      }
    } else if (selectedModule === "hotel" || selectedModule === "restaurant") {
      setBusinessLine(selectedModule);
    }
  }, [
    dualBusinessLines,
    selectedModule,
    restaurant?.hotel_enabled,
    restaurant?.restaurant_enabled,
  ]);

  useEffect(() => {
    const checkAuth = async () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      if (!user && token) await me();
      if (!user && !token) router.push("/");
    };
    void checkAuth();
  }, [user, me, router]);

  const fetchCategories = useCallback(async () => {
    if (!user?.restaurant_id) return;
    try {
      const res = await apiClient.get(ExpenseApis.expenseCategories, {
        params: {
          restaurant_id: user.restaurant_id,
          business_line: listBusinessLineParam,
        },
      });
      if (res.data.status === "success") {
        setCategories(res.data.data);
      }
    } catch (e) {
      console.error("Failed to load categories", e);
    }
  }, [user?.restaurant_id, listBusinessLineParam]);

  useEffect(() => {
    if (user?.restaurant_id) {
      void fetchCategories();
    }
  }, [user?.restaurant_id, fetchCategories]);

  useEffect(() => {
    setSelectedCategory("all");
  }, [businessLine]);

  const getDateRange = () => {
    const now = new Date();
    let start = "";
    let end = endOfDay(now).toISOString().split("T")[0];

    if (dateFilter === "today") {
      start = now.toISOString().split("T")[0];
    } else if (dateFilter === "yesterday") {
      const yesterday = subDays(now, 1);
      start = yesterday.toISOString().split("T")[0];
      end = endOfDay(yesterday).toISOString().split("T")[0];
    } else if (dateFilter === "this_week") {
      start = startOfWeek(now, { weekStartsOn: 1 }).toISOString().split("T")[0];
    } else if (dateFilter === "this_month") {
      start = startOfMonth(now).toISOString().split("T")[0];
    } else if (dateFilter === "custom") {
      start = customStartDate || now.toISOString().split("T")[0];
      end = customEndDate || now.toISOString().split("T")[0];
    } else {
      start = subDays(now, 365).toISOString().split("T")[0];
    }
    return { start, end };
  };

  const fetchData = useCallback(async () => {
    if (!user?.restaurant_id) return;
    setLoading(true);
    const { start, end } = getDateRange();
    const stationParam = selectedStation === "all" ? undefined : selectedStation;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    let startTimeVal: string | undefined = undefined;
    let endTimeVal: string | undefined = undefined;

    if (dateFilter === "custom") {
      const startDateStr = customStartDate || new Date().toISOString().split("T")[0];
      const endDateStr = customEndDate || new Date().toISOString().split("T")[0];
      const startTimeStr = customStartTime || "00:00";
      const endTimeStr = customEndTime || "23:59";

      try {
        const startLocal = new Date(`${startDateStr}T${startTimeStr}:00`);
        const endLocal = new Date(`${endDateStr}T${endTimeStr}:59`);
        if (!isNaN(startLocal.getTime())) {
          startTimeVal = startLocal.toISOString();
        }
        if (!isNaN(endLocal.getTime())) {
          endTimeVal = endLocal.toISOString();
        }
      } catch (e) {
        console.error("Failed to parse custom dates", e);
      }
    }

    try {
      const financeExpensesUrl = FinanceApis.expenses({
        restaurantId: user.restaurant_id,
        dateFrom: start,
        dateTo: end,
        station: stationParam,
        businessLine: listBusinessLineParam,
        timezone: tz,
        startTime: startTimeVal,
        endTime: endTimeVal,
      });
      const [res, financeRes, candidatesRes] = await Promise.all([
        apiClient.get(ExpenseApis.list, {
        params: {
          restaurant_id: user.restaurant_id,
          date_from: start,
          date_to: end,
          station: stationParam,
          category_id: selectedCategory === "all" ? undefined : selectedCategory,
          business_line: listBusinessLineParam,
          limit: recentLimit,
          timezone: tz,
        },
        }),
        apiClient.get(financeExpensesUrl).catch(() => null),
        apiClient.get(ExpenseApis.pendingCandidates, {
          params: {
            restaurant_id: user.restaurant_id,
            status: "pending",
            include: "adjustment",
            limit: 100,
          }
        }).catch(() => null),
      ]);
      if (res.data.status === "success") {
        setExpenses(res.data.data.expenses || []);
      }
      if (financeRes?.data?.status === "success") {
        setFinanceExpenses(financeRes.data.data);
      } else {
        setFinanceExpenses(null);
      }
      if (candidatesRes?.data?.status === "success") {
        setCandidates(candidatesRes.data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch expenses:", err);
    } finally {
      setLoading(false);
    }
  }, [
    user?.restaurant_id,
    selectedStation,
    selectedCategory,
    recentLimit,
    listBusinessLineParam,
    dateFilter,
    customStartDate,
    customEndDate,
    customStartTime,
    customEndTime,
  ]);

  const handleAddExpense = async () => {
    if (!user?.restaurant_id || !newExpense.amount || !newExpense.category_id) {
      toast.error("Please fill in required fields");
      return;
    }

    setSaving(true);
    try {
      if (
        !editingExpense &&
        newExpense.payment_method === "cash" &&
        !cashDrawerResolved
      ) {
        throw new Error(
          cashDrawerError || "Wait for open cash drawers to finish loading.",
        );
      }
      const drawerPayload = editingExpense
        ? {}
        : buildCashExpenseDrawerPayload({
            paymentMethod: newExpense.payment_method,
            controlsEnabled: cashDrawerControlsEnabled,
            selectedDrawerSessionId: selectedCashDrawerSessionId,
          });
      const payload = {
        restaurant_id: user.restaurant_id,
        amount: parseFloat(newExpense.amount),
        description: newExpense.description,
        category_id: parseInt(newExpense.category_id, 10),
        payment_method: newExpense.payment_method,
        station: newExpense.station,
        business_line: createBusinessLine,
        ...drawerPayload,
      };

      const res = editingExpense
        ? await apiClient.patch(ExpenseApis.update(editingExpense.id), {
            amount: payload.amount,
            description: payload.description,
            category_id: payload.category_id,
            payment_method: payload.payment_method,
            station: payload.station,
            business_line: payload.business_line,
          })
        : await apiClient.post(ExpenseApis.list, payload);
      if (res.data.status === "success") {
        toast.success(editingExpense ? "Expense updated successfully" : "Expense recorded successfully");
        setIsAddDialogOpen(false);
        resetExpenseForm();
        void fetchData();
      }
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      const responseMessage = error?.response?.data?.message;
      const message =
        (typeof detail === "string" && detail.trim()) ||
        (typeof responseMessage === "string" && responseMessage.trim()) ||
        (error instanceof Error && error.message) ||
        "Failed to record expense";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleApproveCandidate = async (id: number) => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await apiClient.post(ExpenseApis.approveCandidate(id), null, { params: { timezone: tz } });
      if (res.data.status === "success") {
        toast.success("Expense approved");
        void fetchData();
      }
    } catch {
      toast.error("Failed to approve expense");
    }
  };

  const handleRejectCandidate = async (id: number) => {
    try {
      const res = await apiClient.post(ExpenseApis.rejectCandidate(id));
      if (res.data.status === "success") {
        toast.success("Expense rejected");
        void fetchData();
      }
    } catch {
      toast.error("Failed to reject expense");
    }
  };

  useEffect(() => {
    if (user?.restaurant_id) {
      void fetchData();
    }
  }, [user?.restaurant_id, fetchData, customStartTime, customEndTime]);

  const filteredExpenses = expenses.filter((expense: any) => {
    if (dateFilter !== "custom") return true;
    try {
      const expenseDate = new Date(expense.expense_date || expense.paid_on || expense.created_at);
      const startLocal = new Date(
        `${customStartDate || new Date().toISOString().split("T")[0]}T${customStartTime || "00:00"}:00`,
      );
      const endLocal = new Date(
        `${customEndDate || new Date().toISOString().split("T")[0]}T${customEndTime || "23:59"}:59`,
      );
      return expenseDate >= startLocal && expenseDate <= endLocal;
    } catch {
      return true;
    }
  });

  const paymentMethodBreakdown = useMemo(
    () => buildExpensePaymentMethodBreakdown(filteredExpenses),
    [filteredExpenses],
  );
  const financeExpenseMetrics = hasFinanceActivity(financeExpenses?.metrics) ? financeExpenses?.metrics : null;
  const operatingExpenseTotal =
    financeExpenseMetrics?.manual_operating_expense ??
    filteredExpenses.reduce((acc: number, curr: any) => acc + (Number(curr.amount) || 0), 0);
  const inventoryCashOutflow = financeExpenseMetrics?.inventory_cash_outflow ?? 0;

  const resetExpenseForm = () => {
    setEditingExpense(null);
    setNewExpense({
      amount: "",
      description: "",
      station: "other",
      category_id: "",
      payment_method: "cash",
    });
    setCashDrawerControlsEnabled(false);
    setCashDrawerSessions([]);
    setSelectedCashDrawerSessionId("");
    setCashDrawerLoading(false);
    setCashDrawerResolved(false);
    setCashDrawerError(null);
  };

  const handleEditExpense = (expense: any) => {
    setEditingExpense(expense);
    setNewExpense({
      amount: String(expense.amount ?? ""),
      description: expense.description || "",
      station: expense.station || "other",
      category_id: expense.category_id ? String(expense.category_id) : "",
      payment_method: expense.payment_method || "cash",
    });
    setIsAddDialogOpen(true);
  };

  const handleDeleteExpense = async (expense: any) => {
    if (!expense?.id) return;
    const ok = window.confirm(`Delete expense "${expense.description || "Untitled"}"?`);
    if (!ok) return;
    try {
      await apiClient.delete(ExpenseApis.delete(expense.id));
      toast.success("Expense deleted");
      void fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to delete expense");
    }
  };

  const handleExport = async () => {
    if (!filteredExpenses.length) return;
    const XLSX = await import("xlsx");
    const dataToExport = filteredExpenses.map((expense: any) => ({
      Description: expense.description || "Untitled",
      Category: expense.category?.name || "General",
      Amount: expense.amount,
      Date: new Date(expense.expense_date || expense.paid_on).toLocaleDateString(),
      Status: expense.status || "Completed",
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Expenses");
    XLSX.writeFile(wb, `Expense_Report_${new Date().toISOString().split("T")[0]}.xlsx`);
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
              <Button
                variant="outline"
                size="sm"
                className="hidden sm:flex border-emerald-200 hover:bg-emerald-50 hover:text-emerald-600 dark:border-emerald-900/30 dark:hover:bg-emerald-950/20 gap-2"
              >
                <TrendingUp className="h-4 w-4" />
                View Income
              </Button>
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-end">
            {dualBusinessLines ? (
              <div className="flex items-center bg-muted/50 p-1 rounded-lg border border-border">
                <Button
                  variant={businessLine === "all" ? "secondary" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-8 px-3 text-xs gap-2",
                    businessLine === "all" && "bg-background shadow-sm",
                  )}
                  onClick={() => setBusinessLine("all")}
                >
                  All
                </Button>
                <Button
                  variant={businessLine === "restaurant" ? "secondary" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-8 px-3 text-xs gap-2",
                    businessLine === "restaurant" && "bg-background shadow-sm",
                  )}
                  onClick={() => setBusinessLine("restaurant")}
                >
                  <Utensils className="h-3.5 w-3.5 text-orange-500" />
                  Restaurant
                </Button>
                <Button
                  variant={businessLine === "hotel" ? "secondary" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-8 px-3 text-xs gap-2",
                    businessLine === "hotel" && "bg-background shadow-sm",
                  )}
                  onClick={() => setBusinessLine("hotel")}
                >
                  <Hotel className="h-3.5 w-3.5 text-blue-500" />
                  Hotel
                </Button>
              </div>
            ) : null}

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

            <Select value={dateFilter} onValueChange={setDateFilter}>
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

        <FinanceSectionTabs />

        {dateFilter === "custom" && (
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          label="Operating Expenses"
          value={operatingExpenseTotal}
          icon={<TrendingDown className="w-5 h-5" />}
          color="text-red-500"
          bg="bg-red-50 dark:bg-red-950/20"
        />
        <MetricCard
          label="Inventory Cash Outflow"
          value={inventoryCashOutflow}
          icon={<TrendingUp className="w-5 h-5" />}
          color="text-orange-500"
          bg="bg-orange-50 dark:bg-orange-950/20"
        />
        <MetricCard
          label="Expense Entries"
          value={filteredExpenses.length}
          icon={<Receipt className="w-5 h-5" />}
          color="text-amber-500"
          bg="bg-amber-50 dark:bg-amber-950/20"
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

      <Card className="bg-card border-border shadow-sm">
        <CardContent className="p-6 space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-border/40">
            <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-red-500" />
              Expenses by Payment Method
            </h3>
            <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">
              Outflow split
            </span>
          </div>
          <div className="space-y-2">
            {paymentMethodBreakdown.map((pm) => (
              <div
                key={pm.method}
                className="flex justify-between items-center text-xs py-1 border-b border-border/10 last:border-0"
              >
                <span className="capitalize text-muted-foreground font-medium">{pm.method}</span>
                <div className="flex items-center gap-4">
                  <span className="font-bold text-red-600 dark:text-red-500">
                    Rs. {Number(pm.amount).toLocaleString()}
                  </span>
                  <span className="text-[10px] bg-muted px-2 py-0.5 rounded text-muted-foreground font-bold">
                    {Math.round(pm.percentage * 100)}%
                  </span>
                </div>
              </div>
            ))}
            {paymentMethodBreakdown.length === 0 && (
              <div className="text-center py-4 text-xs text-muted-foreground">
                No expense payment-method data for this period.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

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
                <SelectItem key={cat.id} value={cat.id.toString()}>
                  {cat.name}
                </SelectItem>
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
            onClick={() => {
              resetExpenseForm();
              setIsAddDialogOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" /> Add Expense
          </Button>
        </div>
      </div>

      <Dialog
        open={isAddDialogOpen}
        onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) resetExpenseForm();
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingExpense ? "Edit Expense" : "Add New Expense"}</DialogTitle>
            <DialogDescription>
              {editingExpense ? "Update this business expense." : "Record a new business expense. Required fields are marked with *."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="amount" className="text-right">
                Amount*
              </Label>
              <Input
                id="amount"
                type="number"
                placeholder="0.00"
                className="col-span-3"
                value={newExpense.amount}
                onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="station" className="text-right">
                Station
              </Label>
              <Select
                value={newExpense.station}
                onValueChange={(val) => setNewExpense({ ...newExpense, station: val, category_id: "" })}
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
              <Label htmlFor="category" className="text-right">
                Category*
              </Label>
              <Select
                value={newExpense.category_id}
                onValueChange={(val) => setNewExpense({ ...newExpense, category_id: val })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  {categories
                    .filter(
                      (cat: any) =>
                        cat.type === newExpense.station ||
                        (!cat.type && newExpense.station === "other"),
                    )
                    .map((cat: any) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>
                        {cat.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="method" className="text-right">
                Payment
              </Label>
              <Select
                value={newExpense.payment_method}
                onValueChange={(val) => setNewExpense({ ...newExpense, payment_method: val })}
                disabled={Boolean(editingExpense)}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Method" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHOD_OPTIONS.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {editingExpense && (
              <p className="col-start-2 col-span-3 -mt-2 text-xs text-muted-foreground">
                Payment method is locked after posting. Use an audited correction workflow to reclassify it.
              </p>
            )}
            {!editingExpense && newExpense.payment_method === "cash" && cashDrawerControlsEnabled && (
              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="cash-drawer" className="pt-2 text-right">
                  Cash Drawer*
                </Label>
                <div className="col-span-3 space-y-1.5">
                  <Select
                    value={selectedCashDrawerSessionId}
                    onValueChange={setSelectedCashDrawerSessionId}
                    disabled={cashDrawerLoading || cashDrawerSessions.length === 0}
                  >
                    <SelectTrigger id="cash-drawer">
                      <SelectValue
                        placeholder={cashDrawerLoading ? "Loading open drawers..." : "Select open cash drawer"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {cashDrawerSessions.length === 0 ? (
                        <SelectItem value="none" disabled>
                          No open cash drawers
                        </SelectItem>
                      ) : (
                        cashDrawerSessions.map((session) => (
                          <SelectItem key={session.id} value={String(session.id)}>
                            {`${session.name || session.drawer_key || "Drawer"} · ${session.station || "general"}${session.business_date ? ` · ${session.business_date}` : ""}`}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {cashDrawerError ? (
                    <p className="text-xs text-destructive">{cashDrawerError}</p>
                  ) : cashDrawerSessions.length === 0 && !cashDrawerLoading ? (
                    <p className="text-xs text-destructive">
                      Open a cash drawer before recording a cash expense.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      This expense will reduce the selected drawer&apos;s expected cash.
                    </p>
                  )}
                </div>
              </div>
            )}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="desc" className="text-right">
                Notes
              </Label>
              <Textarea
                id="desc"
                placeholder="What was this for?"
                className="col-span-3"
                value={newExpense.description}
                onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={handleAddExpense}
              disabled={
                saving ||
                (!editingExpense &&
                  newExpense.payment_method === "cash" &&
                  (!cashDrawerResolved ||
                    (cashDrawerControlsEnabled &&
                      (cashDrawerLoading || !selectedCashDrawerSessionId))))
              }
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {editingExpense ? "Update Expense" : "Record Expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="approved" className="gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Approved Expenses
          </TabsTrigger>
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="w-4 h-4" />
            Pending Approvals
            {candidates.length > 0 && (
              <Badge variant="destructive" className="ml-1 px-1.5 py-0 min-w-[20px] text-center">
                {candidates.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="approved" className="mt-0">
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
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredExpenses.map((expense: any) => (
                    <tr key={expense.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 font-medium">{expense.description || "Untitled"}</td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {expense.category?.name || "General"}
                      </td>
                      <td className="px-6 py-4 font-bold text-red-600 dark:text-red-500">
                        - Rs. {Number(expense.amount).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(expense.expense_date || expense.paid_on).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge
                          variant="outline"
                          className="border-border text-muted-foreground capitalize"
                        >
                          {expense.status || "Completed"}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => handleEditExpense(expense)}
                            aria-label="Edit expense"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteExpense(expense)}
                            aria-label="Delete expense"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
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
                  onClick={() => setRecentLimit((prev) => prev + 25)}
                >
                  View More Expenses
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      </TabsContent>

      <TabsContent value="pending" className="mt-0">
        <Card className="border-border">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              {candidates.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-xl bg-muted/20">
                  <CheckCircle2 className="w-12 h-12 mb-4 opacity-20" />
                  <p>No pending expenses to approve.</p>
                </div>
              ) : (
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 text-muted-foreground font-medium border-b border-border">
                    <tr>
                      <th className="px-6 py-4">Description</th>
                      <th className="px-6 py-4">Source</th>
                      <th className="px-6 py-4">Amount</th>
                      <th className="px-6 py-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {candidates.map((candidate: any) => (
                      <tr key={candidate.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-4 font-medium">{candidate.description || "Untitled"}</td>
                        <td className="px-6 py-4 text-muted-foreground capitalize">
                          {candidate.source_type}
                        </td>
                        <td className="px-6 py-4 font-bold text-orange-600 dark:text-orange-500">
                          Rs. {Number(candidate.amount).toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:border-emerald-900/50"
                              onClick={() => handleApproveCandidate(candidate.id)}
                            >
                              <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="text-destructive hover:bg-destructive/10 border-destructive/20"
                              onClick={() => handleRejectCandidate(candidate.id)}
                            >
                              <XCircle className="w-4 h-4 mr-1" /> Reject
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>
      </Tabs>
    </div>
  );
}

function MetricCard({ label, value, icon, color, bg, href, isStringValue }: any) {
  const content = (
    <Card
      className={cn(
        "overflow-hidden border-border bg-card transition-colors",
        href && "hover:bg-muted/50 cursor-pointer",
      )}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
              {label}
            </p>
            <h3 className="text-2xl font-bold">
              {isStringValue ? value : `Rs. ${Number(value || 0).toLocaleString()}`}
            </h3>
          </div>
          <div className={`p-3 rounded-xl ${bg} ${color}`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
