"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { hasPermission } from "@/lib/role-permissions";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api-client";
import {
  CashAndBanksApis,
  CustomerApis,
  ExpenseApis,
  FinanceApis,
  StaffProfileApis,
  SupplierApis,
} from "@/lib/api/endpoints";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  TrendingDown,
  Receipt,
  Download,
  Plus,
  Calendar,
  TrendingUp,
  DollarSign,
  Utensils,
  Hotel,
  Pencil,
  Trash2,
  PackageSearch,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useRestaurant } from "@/hooks/use-restaurant";
import { useCustomFinanceStations } from "@/hooks/use-custom-finance-stations";
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
import { AllocationLinesEditor, AllocationLineItem, EligibleHead } from "@/components/finance/allocation-lines-editor";
import { StationPicker } from "@/components/stations/station-picker";
import { financeReportingApi } from "@/lib/api/finance-reporting-api";
import type {
  FinanceExpensesResponse,
  FinanceTransactionRow,
} from "@/types/finance";
import {
  financeStationOptions,
  isFinanceStationAvailable,
  legacyStationBucketForStationName,
  toFinanceAttributionStation,
  toFinanceStationParam,
} from "@/lib/finance-station-scope";
import { shouldUseFinanceMetrics } from "@/lib/finance-metric-authority";

function shouldUseFinanceEventMetrics(
  finance: FinanceExpensesResponse | null | undefined,
): boolean {
  const metrics = finance?.metrics;
  if (!metrics) return false;
  return shouldUseFinanceMetrics(finance.meta?.ledger_complete, [
    metrics.sales_total,
    metrics.collections_total,
    metrics.credit_sales,
    metrics.refund_total,
    metrics.manual_income_total,
    metrics.manual_operating_expense,
    metrics.inventory_direct_expense,
    metrics.inventory_cash_outflow,
    metrics.inventory_asset_acquired,
    metrics.inventory_cogs,
    metrics.inventory_wastage,
    metrics.inventory_variance,
    metrics.refund_liabilities,
    metrics.supplier_payables,
    metrics.supplier_payments,
  ]);
}

type BusinessLineFilter = "all" | "restaurant" | "hotel";

interface CashBankAccount {
  account_type: "drawer" | "bank";
  id: number;
  name: string;
  current_balance: number | string;
  drawer_session_id?: number | null;
}

type ExpensePartyType = "none" | "supplier" | "staff" | "customer";
type ExpenseParty = { id: number; name: string };

function normalizeExpensePaymentMethod(raw: string | null | undefined): string {
  const value = String(raw ?? "")
    .trim()
    .toLowerCase();
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
    if (["cancelled", "corrected"].includes(String(expense.source_status || "").toLowerCase())) {
      continue;
    }
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

function buildFinanceExpensePaymentMethodBreakdown(
  transactions: FinanceTransactionRow[] | undefined,
) {
  const cashOutEventTypes = new Set([
    "manual_expense_paid",
    "inventory_purchase_expensed",
    "inventory_cash_outflow",
    "supplier_payment_made",
    "staff_salary_paid",
    "staff_overtime_paid",
  ]);
  const totals = new Map<string, number>();
  for (const transaction of transactions ?? []) {
    const eventType = String(transaction.event_type || "");
    const originalEventType = String(transaction.metadata_json?.original_event_type || "");
    const isReversal = eventType === "inventory_transaction_reversed";
    if (!cashOutEventTypes.has(isReversal ? originalEventType : eventType)) continue;
    const amount = Number(transaction.amount) || 0;
    if (amount <= 0) continue;
    const method = normalizeExpensePaymentMethod(transaction.payment_method);
    totals.set(method, (totals.get(method) ?? 0) + (isReversal ? -amount : amount));
  }
  const positiveTotals = Array.from(totals.entries()).filter(([, amount]) => amount > 0.0001);
  const grandTotal = positiveTotals.reduce((sum, [, amount]) => sum + amount, 0);
  return positiveTotals
    .map(([method, amount]) => ({
      method,
      amount,
      percentage: grandTotal > 0 ? amount / grandTotal : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

function isFinanceEventExpense(expense: any): boolean {
  return String(expense?.source_type || "").startsWith("finance_event:");
}

function isInventoryFinanceExpense(expense: any): boolean {
  return isFinanceEventExpense(expense) && String(expense?.source_type || "").includes("inventory_");
}

export default function ExpensesPage() {
  const [loading, setLoading] = useState(false);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [expenseTotalCount, setExpenseTotalCount] = useState(0);
  const [expenseSummaryTotal, setExpenseSummaryTotal] = useState(0);
  const [financeExpenses, setFinanceExpenses] =
    useState<FinanceExpensesResponse | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [dateFilter, setDateFilter] = useState("this_month");
  const [businessLine, setBusinessLine] = useState<BusinessLineFilter>("all");
  const [selectedStation, setSelectedStation] = useState("all");
  const [selectedReportingHeadId, setSelectedReportingHeadId] = useState("all");
  const [expenseHeadFilterOptions, setExpenseHeadFilterOptions] = useState<EligibleHead[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [eligibleExpenseHeads, setEligibleExpenseHeads] = useState<EligibleHead[]>([]);
  const [allocationLines, setAllocationLines] = useState<AllocationLineItem[]>([]);
  const [newExpense, setNewExpense] = useState({
    amount: "",
    description: "",
    station: "general",
    station_id: null as number | null,
    category_id: "",
    payment_method: "cash",
    payment_status: "paid" as "paid" | "unpaid" | "partial",
    paid_amount: "",
  });
  const [partyType, setPartyType] = useState<ExpensePartyType>("none");
  const [partyId, setPartyId] = useState("");
  const [parties, setParties] = useState<Record<Exclude<ExpensePartyType, "none">, ExpenseParty[]>>({
    supplier: [], staff: [], customer: [],
  });
  const [partiesLoading, setPartiesLoading] = useState(false);
  const [accounts, setAccounts] = useState<CashBankAccount[]>([]);
  const [selectedAccountKey, setSelectedAccountKey] = useState("");
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [customStartTime, setCustomStartTime] = useState("00:00");
  const [customEndTime, setCustomEndTime] = useState("23:59");
  const [recentLimit, setRecentLimit] = useState(25);

  const user = useAuth((state) => state.user);
  const me = useAuth((state) => state.me);
  const customFinanceStations = useCustomFinanceStations(user?.restaurant_id);
  const router = useRouter();
  const restaurant = useRestaurant((s) => s.restaurant);
  const canManageCoa = hasPermission(user, "finance.coa.manage");

  const dualBusinessLines =
    !!restaurant?.hotel_enabled && !!restaurant?.restaurant_enabled;

  const listBusinessLineParam = businessLine;

  const createBusinessLine = useMemo((): "restaurant" | "hotel" => {
    if (businessLine === "restaurant" || businessLine === "hotel") {
      return businessLine;
    }
    if (restaurant?.hotel_enabled && !restaurant?.restaurant_enabled) {
      return "hotel";
    }
    return "restaurant";
  }, [
    businessLine,
    restaurant?.hotel_enabled,
    restaurant?.restaurant_enabled,
  ]);
  const expenseWriteBusinessLine = useMemo((): "restaurant" | "hotel" => {
    const existingBusinessLine = String(
      editingExpense?.business_line ?? "",
    ).toLowerCase();
    if (existingBusinessLine === "hotel" || editingExpense?.station === "rooms") {
      return "hotel";
    }
    if (existingBusinessLine === "restaurant") return "restaurant";
    return createBusinessLine;
  }, [createBusinessLine, editingExpense]);

  useEffect(() => {
    if (
      !isFinanceStationAvailable(selectedStation, {
        businessLine,
        hotelEnabled: Boolean(restaurant?.hotel_enabled),
        customStations: customFinanceStations,
      })
    ) {
      setSelectedStation("all");
    }
  }, [businessLine, restaurant?.hotel_enabled, selectedStation, customFinanceStations]);

  useEffect(() => {
    if (
      !isFinanceStationAvailable(newExpense.station, {
        businessLine: expenseWriteBusinessLine,
        hotelEnabled: Boolean(restaurant?.hotel_enabled),
        customStations: customFinanceStations,
      })
    ) {
      setNewExpense((current) => ({
        ...current,
        station: "general",
        category_id: "",
      }));
    }
  }, [
    expenseWriteBusinessLine,
    newExpense.station,
    restaurant?.hotel_enabled,
    customFinanceStations,
  ]);

  // Legacy ExpenseCategory is compatibility analytics data only (see
  // FINANCE_PRODUCT_UX_BLUEPRINT.md 10.2) -- real classification now happens
  // through the Allocation Lines editor below. New expenses silently get a
  // sensible default category (the business line's generic "Others" bucket)
  // instead of forcing a second, redundant-looking classification choice.
  useEffect(() => {
    if (editingExpense) return;
    const scoped = categories.filter(
      (cat: any) =>
        String(cat.business_line ?? "restaurant").toLowerCase() ===
        expenseWriteBusinessLine,
    );
    if (scoped.length === 0) return;
    const current = scoped.find(
      (cat: any) => String(cat.id) === newExpense.category_id,
    );
    if (current) return;
    const exactOthers = scoped.find(
      (cat: any) => String(cat.name ?? "").trim().toLowerCase() === "others",
    );
    const byOtherType = scoped.find(
      (cat: any) => String(cat.type ?? "").trim().toLowerCase() === "other",
    );
    const fallback = exactOthers ?? byOtherType ?? scoped[0];
    setNewExpense((current) => ({
      ...current,
      category_id: String(fallback.id),
    }));
  }, [categories, expenseWriteBusinessLine, editingExpense, newExpense.category_id]);

  useEffect(() => {
    let cancelled = false;

    const resetAccountState = () => {
      setAccounts([]);
      setSelectedAccountKey("");
      setAccountsError(null);
    };

    const loadAccounts = async () => {
      if (!isAddDialogOpen || editingExpense || !user?.restaurant_id) {
        resetAccountState();
        return;
      }

      setAccountsLoading(true);
      setAccountsError(null);
      try {
        const response = await apiClient.get(
          CashAndBanksApis.list(Number(user.restaurant_id), createBusinessLine),
        );
        if (cancelled) return;
        const rows = Array.isArray(response.data?.data)
          ? (response.data.data as CashBankAccount[])
          : [];
        const available = rows.filter(
          (account) => account.account_type === "bank" || account.drawer_session_id,
        );
        setAccounts(available);
        setSelectedAccountKey(
          available[0] ? `${available[0].account_type}:${available[0].id}` : "",
        );
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to load Cash & Banks accounts", error);
        setAccounts([]);
        setSelectedAccountKey("");
        setAccountsError("Unable to load Cash & Banks accounts.");
      } finally {
        if (!cancelled) setAccountsLoading(false);
      }
    };

    void loadAccounts();
    return () => {
      cancelled = true;
    };
  }, [
    createBusinessLine,
    editingExpense,
    isAddDialogOpen,
    user?.restaurant_id,
  ]);

  useEffect(() => {
    if (!isAddDialogOpen || !user?.restaurant_id) return;
    let cancelled = false;
    financeReportingApi
      .getEligibleLeaves(user.restaurant_id, {
        head_type: "expense" as any,
        business_line: createBusinessLine,
      })
      .then((res: any) => {
        if (!cancelled) {
          setEligibleExpenseHeads(res || []);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch eligible expense heads", err);
      });
    return () => {
      cancelled = true;
    };
  }, [createBusinessLine, isAddDialogOpen, user?.restaurant_id]);

  // Independent of the Add/Edit dialog -- powers the list page's "Expense
  // head" filter, which replaced the legacy Category filter (see
  // FINANCE_PRODUCT_UX_BLUEPRINT.md 10.2: forms and reporting use reporting
  // heads, not ExpenseCategory).
  useEffect(() => {
    if (!user?.restaurant_id) return;
    let cancelled = false;
    financeReportingApi
      .getEligibleLeaves(user.restaurant_id, { head_type: "expense" as any })
      .then((res: any) => {
        if (!cancelled) setExpenseHeadFilterOptions(res || []);
      })
      .catch((err) => {
        console.error("Failed to fetch expense head filter options", err);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.restaurant_id]);

  useEffect(() => {
    if (!isAddDialogOpen || editingExpense || !user?.restaurant_id) return;
    let cancelled = false;
    setPartiesLoading(true);
    Promise.all([
      apiClient.get(SupplierApis.listSuppliers(Number(user.restaurant_id), true)),
      apiClient.get(StaffProfileApis.list({ limit: 200 })),
      apiClient.get(CustomerApis.listCustomers(Number(user.restaurant_id))),
    ]).then(([supplierRes, staffRes, customerRes]) => {
      if (cancelled) return;
      const supplierRows = supplierRes.data?.data?.suppliers ?? [];
      const staffRows = staffRes.data?.data ?? [];
      const customerRows = customerRes.data?.data?.customers ?? [];
      setParties({
        supplier: supplierRows.map((row: any) => ({ id: Number(row.id), name: String(row.name ?? "Supplier") })),
        staff: staffRows.map((row: any) => ({ id: Number(row.id), name: String(row.user_name ?? row.name ?? "Staff") })),
        customer: customerRows.map((row: any) => ({ id: Number(row.id), name: String(row.name ?? row.business_name ?? "Customer") })),
      });
    }).catch((error) => {
      console.error("Failed to load expense parties", error);
    }).finally(() => {
      if (!cancelled) setPartiesLoading(false);
    });
    return () => { cancelled = true; };
  }, [editingExpense, isAddDialogOpen, user?.restaurant_id]);

  useEffect(() => {
    if (!dualBusinessLines) {
      if (restaurant?.hotel_enabled && !restaurant?.restaurant_enabled) {
        setBusinessLine("hotel");
      } else {
        setBusinessLine("restaurant");
      }
    }
  }, [
    dualBusinessLines,
    restaurant?.hotel_enabled,
    restaurant?.restaurant_enabled,
  ]);

  useEffect(() => {
    const checkAuth = async () => {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("accessToken")
          : null;
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
          business_line: businessLine,
        },
      });
      if (res.data.status === "success") {
        setCategories(res.data.data);
      }
    } catch (e) {
      console.error("Failed to load categories", e);
    }
  }, [user?.restaurant_id, businessLine]);

  useEffect(() => {
    if (user?.restaurant_id) {
      void fetchCategories();
    }
  }, [user?.restaurant_id, fetchCategories]);

  useEffect(() => {
    setSelectedReportingHeadId("all");
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
    const stationParam = toFinanceStationParam(selectedStation, {
      businessLine,
      hotelEnabled: Boolean(restaurant?.hotel_enabled),
      customStations: customFinanceStations,
    });
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    let startTimeVal: string | undefined = undefined;
    let endTimeVal: string | undefined = undefined;

    if (dateFilter === "custom") {
      const startDateStr =
        customStartDate || new Date().toISOString().split("T")[0];
      const endDateStr =
        customEndDate || new Date().toISOString().split("T")[0];
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
      const expenseListParams = {
        restaurant_id: user.restaurant_id,
        date_from: start,
        date_to: end,
        station: stationParam,
        reporting_head_id:
          selectedReportingHeadId === "all" ? undefined : selectedReportingHeadId,
        business_line: listBusinessLineParam,
        timezone: tz,
      };
      const [res, summaryRes, financeRes] = await Promise.all([
        apiClient.get(ExpenseApis.list, {
          params: {
            ...expenseListParams,
            limit: recentLimit,
          },
        }),
        apiClient.get(ExpenseApis.summaryTotal, {
          params: expenseListParams,
        }),
        apiClient.get(financeExpensesUrl).catch(() => null),
      ]);
      if (res.data.status === "success") {
        setExpenses(res.data.data.expenses || []);
        setExpenseTotalCount(Number(res.data.data.total) || 0);
      }
      if (summaryRes.data.status === "success") {
        setExpenseSummaryTotal(
          Number(
            summaryRes.data.data?.total_amount ?? summaryRes.data.data?.total,
          ) || 0,
        );
      }
      if (financeRes?.data?.status === "success") {
        setFinanceExpenses(financeRes.data.data);
      } else {
        setFinanceExpenses(null);
      }
    } catch (err) {
      console.error("Failed to fetch expenses:", err);
    } finally {
      setLoading(false);
    }
  }, [
    user?.restaurant_id,
    selectedStation,
    selectedReportingHeadId,
    recentLimit,
    listBusinessLineParam,
    businessLine,
    restaurant?.hotel_enabled,
    dateFilter,
    customStartDate,
    customEndDate,
    customStartTime,
    customEndTime,
    customFinanceStations,
  ]);

  const handleAddExpense = async () => {
    if (!user?.restaurant_id || !newExpense.amount) {
      toast.error("Please fill in required fields");
      return;
    }
    if (partyType !== "none" && !partyId) {
      toast.error("Select the expense party");
      return;
    }
    const paidNow =
      newExpense.payment_status === "paid"
        ? Number(newExpense.amount)
        : newExpense.payment_status === "unpaid"
          ? 0
          : Number(newExpense.paid_amount);
    if (!Number.isFinite(paidNow) || paidNow < 0 || paidNow > Number(newExpense.amount)) {
      toast.error("Enter a valid amount paid now");
      return;
    }
    if (newExpense.payment_status === "partial" && paidNow <= 0) {
      toast.error("A partial expense needs an amount paid now");
      return;
    }

    if (!editingExpense) {
      if (allocationLines.length === 0) {
        toast.error("Please allocate 100% of the expense amount to reporting heads.");
        return;
      }
      const targetCents = Math.round(parseFloat(newExpense.amount) * 100);
      const linesCents = allocationLines.reduce(
        (sum, l) => sum + Math.round((Number(l.amount) || 0) * 100),
        0
      );
      if (targetCents !== linesCents) {
        toast.error(
          "Allocation lines must sum to exactly 100% of the total expense amount."
        );
        return;
      }
    }

    setSaving(true);
    try {
      const selectedAccount = accounts.find(
        (account) =>
          `${account.account_type}:${account.id}` === selectedAccountKey,
      );
      if (!editingExpense && paidNow > 0 && !selectedAccount) {
        throw new Error(accountsError || "Select a Cash & Banks account.");
      }
      const payload = {
        restaurant_id: user.restaurant_id,
        amount: parseFloat(newExpense.amount),
        description: newExpense.description,
        category_id: newExpense.category_id
          ? parseInt(newExpense.category_id, 10)
          : undefined,
        payment_method: editingExpense
          ? newExpense.payment_method
          : selectedAccount?.account_type === "drawer"
            ? "cash"
            : "bank_transfer",
        station: toFinanceAttributionStation(newExpense.station),
        station_id: newExpense.station_id,
        business_line: expenseWriteBusinessLine,
        payment_status: newExpense.payment_status,
        paid_amount: paidNow,
        ...(allocationLines.length > 0 ? { lines: allocationLines } : {}),
        ...(partyType !== "none"
          ? { party_type: partyType, party_id: Number(partyId) }
          : {}),
        ...(!editingExpense && paidNow > 0 && selectedAccount
          ? {
              account_type: selectedAccount.account_type,
              account_id: selectedAccount.id,
              ...(selectedAccount.account_type === "drawer"
                ? { drawer_session_id: selectedAccount.drawer_session_id }
                : {}),
            }
          : {}),
      };

      const res = editingExpense
        ? await apiClient.patch(ExpenseApis.update(editingExpense.id), {
            description: payload.description,
          })
        : await apiClient.post(ExpenseApis.list, payload);
      if (res.data.status === "success") {
        toast.success(
          editingExpense
            ? "Expense updated successfully"
            : "Expense recorded successfully",
        );
        setIsAddDialogOpen(false);
        resetExpenseForm();
        void fetchData();
      }
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      const responseMessage = error?.response?.data?.message;
      const message =
        (typeof detail === "string" && detail.trim()) ||
        (typeof detail?.message === "string" && detail.message.trim()) ||
        (typeof responseMessage === "string" && responseMessage.trim()) ||
        (error instanceof Error && error.message) ||
        "Failed to record expense";
      toast.error(message);
    } finally {
      setSaving(false);
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
      const expenseDate = new Date(
        expense.expense_date || expense.paid_on || expense.created_at,
      );
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

  const financeExpenseMetrics = shouldUseFinanceEventMetrics(financeExpenses)
    ? financeExpenses?.metrics
    : null;
  const paymentMethodBreakdown = useMemo(
    () =>
      financeExpenseMetrics
        ? buildFinanceExpensePaymentMethodBreakdown(
            financeExpenses?.transactions,
          )
        : buildExpensePaymentMethodBreakdown(filteredExpenses),
    [filteredExpenses, financeExpenseMetrics, financeExpenses?.transactions],
  );
  const accountingMode = Boolean(
    financeExpenses?.meta?.finance_accounting_enabled ||
    financeExpenses?.meta?.accounting_v2_enabled ||
    financeExpenses?.meta?.ledger_complete,
  );
  const inventoryDirectExpense =
    financeExpenseMetrics?.inventory_direct_expense ?? 0;
  const inventoryCashOutflow =
    financeExpenseMetrics?.inventory_cash_outflow ?? 0;
  const simpleInventoryPurchases =
    inventoryDirectExpense + inventoryCashOutflow;
  const inventoryCogs = financeExpenseMetrics?.inventory_cogs ?? 0;
  const inventoryWastage = financeExpenseMetrics?.inventory_wastage ?? 0;
  const inventoryVariance = financeExpenseMetrics?.inventory_variance ?? 0;
  const financeOperatingExpenseTotal =
    (financeExpenseMetrics?.manual_operating_expense ?? 0) +
    inventoryDirectExpense +
    inventoryCogs +
    inventoryWastage +
    inventoryVariance;
  const operatingExpenseTotal = financeExpenseMetrics
    ? financeOperatingExpenseTotal
    : expenseSummaryTotal ||
      filteredExpenses.reduce(
        (acc: number, curr: any) => acc + (Number(curr.amount) || 0),
        0,
      );
  const manualExpenseCount = filteredExpenses.filter(
    (expense) => !isFinanceEventExpense(expense),
  ).length;
  const sourceManagedExpenseCount = filteredExpenses.filter(
    (expense) => isFinanceEventExpense(expense),
  ).length;

  const resetExpenseForm = () => {
    setEditingExpense(null);
    setAllocationLines([]);
    setNewExpense({
      amount: "",
      description: "",
      station: "general",
      station_id: null,
      category_id: "",
      payment_method: "cash",
      payment_status: "paid",
      paid_amount: "",
    });
    setPartyType("none");
    setPartyId("");
    setAccounts([]);
    setSelectedAccountKey("");
    setAccountsLoading(false);
    setAccountsError(null);
  };

  const handleEditExpense = (expense: any) => {
    setEditingExpense(expense);
    setNewExpense({
      amount: String(expense.amount ?? ""),
      description: expense.description || "",
      station: toFinanceAttributionStation(expense.station),
      station_id: expense.station_id ?? null,
      category_id: expense.category_id ? String(expense.category_id) : "",
      payment_method: expense.payment_method || "cash",
      payment_status: expense.payment_status || "paid",
      paid_amount: expense.paid_amount == null ? "" : String(expense.paid_amount),
    });
    setIsAddDialogOpen(true);
  };

  const handleDeleteExpense = async (expense: any) => {
    if (!expense?.id) return;
    const ok = window.confirm(
      `Delete expense "${expense.description || "Untitled"}"?`,
    );
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
      Date: new Date(
        expense.expense_date || expense.paid_on,
      ).toLocaleDateString(),
      Status: expense.status || "Completed",
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Expenses");
    XLSX.writeFile(
      wb,
      `Expense_Report_${new Date().toISOString().split("T")[0]}.xlsx`,
    );
  };

  return (
    <div className="flex flex-col gap-8 max-w-[1600px] mx-auto p-6">
      <div className="flex flex-col gap-4 w-full">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 w-full">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-red-600 dark:text-red-500">
                Expenses
              </h1>
              <p className="text-muted-foreground">
                Recognized costs from manual entries and source-owned workflows. Supplier payments are managed from Suppliers and are not counted again.
              </p>
            </div>
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
                  variant={
                    businessLine === "restaurant" ? "secondary" : "ghost"
                  }
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
                {financeStationOptions({
                  businessLine,
                  hotelEnabled: restaurant?.hotel_enabled,
                  customStations: customFinanceStations,
                }).map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
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

        {dateFilter === "custom" && (
          <div className="flex flex-wrap items-center gap-2 justify-start md:justify-end w-full animate-in fade-in slide-in-from-top-1 duration-200 bg-muted/30 p-3 rounded-xl border border-border">
            <span className="text-xs font-semibold text-muted-foreground mr-1">
              Time Slice:
            </span>
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
            <span className="text-xs text-muted-foreground font-semibold px-1">
              to
            </span>
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          label="Recognized Expenses"
          value={operatingExpenseTotal}
          icon={<TrendingDown className="w-5 h-5" />}
          color="text-red-500"
          bg="bg-red-50 dark:bg-red-950/20"
          caption="Excludes supplier purchases (see Suppliers)"
        />
        <MetricCard
          label="Manual Entries"
          value={manualExpenseCount}
          isStringValue
          icon={<Receipt className="w-5 h-5" />}
          color="text-blue-500"
          bg="bg-blue-50 dark:bg-blue-950/20"
        />
        <MetricCard
          label="From Other Workflows"
          value={sourceManagedExpenseCount}
          isStringValue
          icon={<Receipt className="w-5 h-5" />}
          color="text-amber-500"
          bg="bg-amber-50 dark:bg-amber-950/20"
        />
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        <span>Supplier bills and payments belong to the supplier ledger.</span>
        <Link href="/suppliers" className="font-semibold text-primary hover:underline">Open Suppliers</Link>
        <span>·</span>
        <Link href="/finance/purchases" className="font-semibold text-primary hover:underline">Open Purchases</Link>
      </div>

      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Expense head:</span>
          <Select
            value={selectedReportingHeadId}
            onValueChange={setSelectedReportingHeadId}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="All Expense Heads" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Expense Heads</SelectItem>
              {expenseHeadFilterOptions.map((head) => (
                <SelectItem key={head.id} value={head.id.toString()}>
                  {head.path || head.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={!filteredExpenses.length}
          >
            <Download className="w-4 h-4 mr-2" /> Export Excel
          </Button>
          <Button
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            onClick={() => {
              if (dualBusinessLines && businessLine === "all") {
                toast.info("Choose Restaurant or Hotel before adding an expense.");
                return;
              }
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
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingExpense ? "Edit Expense" : "Add New Expense"}
            </DialogTitle>
            <DialogDescription>
              {editingExpense
                ? "Update the note. Posted financial details are locked to protect the ledger."
                : "Record a new business expense. Required fields are marked with *."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 py-2">
            <div className="grid gap-2">
              <Label htmlFor="amount">Amount*</Label>
              <Input
                id="amount"
                type="number"
                placeholder="0.00"
                value={newExpense.amount}
                disabled={Boolean(editingExpense)}
                onChange={(e) =>
                  setNewExpense({ ...newExpense, amount: e.target.value })
                }
              />
            </div>

            {user?.restaurant_id && (
              <StationPicker
                restaurantId={user.restaurant_id}
                value={newExpense.station_id}
                disabled={Boolean(editingExpense)}
                onChange={(stationId, station) =>
                  setNewExpense({
                    ...newExpense,
                    station_id: stationId,
                    station: legacyStationBucketForStationName(
                      station?.name,
                      expenseWriteBusinessLine,
                      newExpense.station,
                    ),
                  })
                }
              />
            )}

            {editingExpense && (
              <div className="grid gap-2">
                <Label>Category</Label>
                <p className="text-sm text-muted-foreground">
                  {categories.find(
                    (cat: any) => String(cat.id) === newExpense.category_id,
                  )?.name || "General"}
                </p>
              </div>
            )}

            {editingExpense ? (
              <div className="grid gap-2">
                <Label>Payment</Label>
                <p className="text-sm capitalize">
                  {String(newExpense.payment_method || "-").replaceAll("_", " ")}
                </p>
              </div>
            ) : (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="expense-party-type">Party</Label>
                  <Select
                    value={partyType}
                    onValueChange={(value) => {
                      const nextPartyType = value as ExpensePartyType;
                      setPartyType(nextPartyType);
                      setPartyId("");
                      if (nextPartyType !== "supplier") {
                        setNewExpense((current) => ({ ...current, payment_status: "paid", paid_amount: current.amount }));
                      }
                    }}
                  >
                    <SelectTrigger id="expense-party-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No linked party</SelectItem>
                      <SelectItem value="supplier">Supplier</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="customer">Customer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {partyType !== "none" && (
                  <div className="grid gap-2">
                    <Label htmlFor="expense-party">{partyType[0].toUpperCase() + partyType.slice(1)}*</Label>
                    <Select value={partyId} onValueChange={setPartyId} disabled={partiesLoading}>
                      <SelectTrigger id="expense-party"><SelectValue placeholder={partiesLoading ? "Loading parties..." : `Select ${partyType}`} /></SelectTrigger>
                      <SelectContent>
                        {parties[partyType].map((party) => <SelectItem key={party.id} value={String(party.id)}>{party.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid gap-2">
                  <Label htmlFor="expense-payment-status">Payment</Label>
                  <Select value={newExpense.payment_status} onValueChange={(payment_status: "paid" | "unpaid" | "partial") => setNewExpense({ ...newExpense, payment_status, paid_amount: payment_status === "paid" ? newExpense.amount : payment_status === "unpaid" ? "" : newExpense.paid_amount })}>
                    <SelectTrigger id="expense-payment-status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="paid">Paid in full</SelectItem>
                      {partyType === "supplier" && <SelectItem value="partial">Partially paid</SelectItem>}
                      {partyType === "supplier" && <SelectItem value="unpaid">Unpaid (supplier payable)</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
                {newExpense.payment_status === "partial" && (
                  <div className="grid gap-2">
                    <Label htmlFor="expense-paid-now">Paid now*</Label>
                    <Input id="expense-paid-now" type="number" min="0" max={newExpense.amount || undefined} value={newExpense.paid_amount} onChange={(event) => setNewExpense({ ...newExpense, paid_amount: event.target.value })} />
                  </div>
                )}
              </>
            )}

            {editingExpense && (
              <p className="-mt-3 text-xs text-muted-foreground">
                Amount, station, category, payment method, and posting date are
                immutable after posting. Delete and recreate the expense to
                make an audited financial correction.
              </p>
            )}

            {!editingExpense && newExpense.payment_status !== "unpaid" && (
              <div className="grid gap-2">
                <Label htmlFor="expense-account">Account*</Label>
                <Select
                  value={selectedAccountKey}
                  onValueChange={setSelectedAccountKey}
                  disabled={accountsLoading || accounts.length === 0}
                >
                  <SelectTrigger id="expense-account">
                    <SelectValue
                      placeholder={
                        accountsLoading ? "Loading accounts..." : "Select account"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem
                        key={`${account.account_type}:${account.id}`}
                        value={`${account.account_type}:${account.id}`}
                      >
                        {account.name} · Rs. {Number(account.current_balance || 0).toLocaleString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {accountsError ? (
                  <p className="text-xs text-destructive">{accountsError}</p>
                ) : !accountsLoading && accounts.length === 0 ? (
                  <p className="text-xs text-destructive">
                    Add or open an account under Cash & Banks first.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    The expense reduces this account. Drawers record cash;
                    bank accounts record a bank transfer.
                  </p>
                )}
              </div>
            )}

            {!editingExpense && (
              <AllocationLinesEditor
                totalAmount={parseFloat(newExpense.amount) || 0}
                eligibleHeads={eligibleExpenseHeads}
                lines={allocationLines}
                onChange={setAllocationLines}
                headTypeLabel="Expense"
                disabled={saving}
                restaurantId={user?.restaurant_id ?? undefined}
                headType="expense"
                canCreateHead={canManageCoa}
                onHeadCreated={(head) =>
                  setEligibleExpenseHeads((prev) => [head, ...prev])
                }
              />
            )}

            <div className="grid gap-2">
              <Label htmlFor="desc">Notes</Label>
              <Textarea
                id="desc"
                placeholder="What was this for?"
                value={newExpense.description}
                onChange={(e) =>
                  setNewExpense({ ...newExpense, description: e.target.value })
                }
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
                  newExpense.payment_status !== "unpaid" &&
                  (accountsLoading || accounts.length === 0 || !selectedAccountKey))
              }
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {editingExpense ? "Update Expense" : "Record Expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="w-full">
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
                        <th className="px-6 py-4">Party</th>
                        <th className="px-6 py-4">Amount</th>
                        <th className="px-6 py-4">Date</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredExpenses.map((expense: any) => {
                        const readOnlyFinanceRow =
                          isFinanceEventExpense(expense);
                        const inventoryFinanceRow = isInventoryFinanceExpense(expense);
                        const sourceStatus = String(expense.source_status || "").toLowerCase();
                        const superseded = ["cancelled", "corrected"].includes(sourceStatus);
                        return (
                          <tr
                            key={`${expense.source_type || "expense"}-${expense.id}`}
                            className="hover:bg-muted/30 transition-colors"
                          >
                            <td className={cn("px-6 py-4 font-medium", superseded && "text-muted-foreground line-through")}>
                              {expense.description || "Untitled"}
                            </td>
                            <td className="px-6 py-4 text-muted-foreground">
                              {expense.category?.name || "General"}
                            </td>
                            <td className="px-6 py-4 text-muted-foreground">
                              {expense.party_name || (expense.party_type ? `${expense.party_type} #${expense.party_id}` : "—")}
                            </td>
                            <td className={cn("px-6 py-4 font-bold text-red-600 dark:text-red-500", superseded && "text-muted-foreground line-through dark:text-muted-foreground")}>
                              - Rs. {Number(expense.amount).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-3.5 h-3.5" />
                                {new Date(
                                  expense.expense_date || expense.paid_on,
                                ).toLocaleDateString()}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <Badge
                                variant="outline"
                                className="border-border text-muted-foreground capitalize"
                              >
                                {readOnlyFinanceRow
                                  ? sourceStatus || "Recorded"
                                  : expense.status || "Completed"}
                              </Badge>
                            </td>
                            <td className="px-6 py-4">
                              {readOnlyFinanceRow ? (
                                <div className="flex justify-end">
                                  {inventoryFinanceRow && expense.source_id ? (
                                    <Button asChild size="sm" variant="outline">
                                      <Link href={`/inventory?view=activity&adjustment=${expense.source_id}`}>
                                        <PackageSearch className="mr-2 h-4 w-4" /> Manage in inventory
                                      </Link>
                                    </Button>
                                  ) : (
                                    <Badge variant="secondary">Finance event</Badge>
                                  )}
                                </div>
                              ) : (
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
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {(expenseTotalCount || expenses.length) > expenses.length && (
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
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
  color,
  bg,
  href,
  isStringValue,
  caption,
}: any) {
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
              {isStringValue
                ? value
                : `Rs. ${Number(value || 0).toLocaleString()}`}
            </h3>
            {caption && (
              <p className="mt-1 text-xs text-muted-foreground">{caption}</p>
            )}
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

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-sm font-bold">
        Rs.{" "}
        {Number(value || 0).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </div>
    </div>
  );
}
