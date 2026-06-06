"use client";

import { useCallback, useEffect, useMemo, useState, Fragment } from "react";
import { AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, TrendingUp, TrendingDown, DollarSign, CreditCard, Activity, Wallet, ArrowUpRight, ArrowDownRight, ReceiptText, ChevronRight, ChevronDown, Bed, Utensils, LayoutGrid, Users, ChefHat, Boxes, ArrowLeftRight, Star, Clock, Check, X, AlertCircle, Package, Tag, ShoppingCart, BarChart2, Award, UserCheck } from "lucide-react";
import apiClient from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { useAnalyticsViewAccess } from "@/hooks/use-analytics-view-access";
import { Badge } from "@/components/ui/badge";
import { useRestaurant } from "@/hooks/use-restaurant";
import { AnalyticsApis, DayCloseApis, ItemCategoryApis } from "@/lib/api/endpoints";
import { cn } from "@/lib/utils";
import { DateRangeDropdown, DateRangePreset } from "@/components/ui/date-range-dropdown";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useRef } from "react";
import { DateRange } from "react-day-picker";
import Link from "next/link";
import {
  AnalyticsAccessDenied,
  AnalyticsAccessLoading,
  AnalyticsFetchError,
} from "@/components/analytics/analytics-access-states";
import { HistoryScopeNotice } from "@/components/shared/history-scope-notice";
import {
  getAnalyticsPresetRange,
  resolvePrimaryRole,
  validateAnalyticsDateRange,
  validationToScopeError,
} from "@/lib/date-scope-policy";
import { isPlanScopeError, parseApiScopeError, type ParsedScopeError } from "@/lib/parse-api-scope-error";

import { RevenueChart } from "@/components/analytics/revenue-chart";
import { CategoryPieChart } from "@/components/analytics/category-pie";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { DayCloseModal } from "@/components/analytics/day-close-modal";
import {
    breakdownPieCopy,
    formatCancellationRate,
    mapAnalyticsTrends,
    mapBreakdownToPie,
    preferHourlyTrends,
    topItemQuantitySold,
    type BreakdownTab,
} from "@/lib/analytics-dashboard-mapper";
import {
    parseDayCloseCurrent,
    parseDayCloseSnapshotData,
    unwrapApiData,
    type BusinessLine,
} from "@/types/day-close";

export default function AnalyticsPage() {
    const [activeRange, setActiveRange] = useState<DateRangePreset>("today");
    const [data, setData] = useState<any>(null);
    const [trendsData, setTrendsData] = useState<any[]>([]);
    const [categoryData, setCategoryData] = useState<any[]>([]);
    const [breakdownType, setBreakdownType] = useState<BreakdownTab>('source');
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [scopeNotice, setScopeNotice] = useState<ParsedScopeError | null>(null);
    const [fetchTrigger, setFetchTrigger] = useState(0);
    const [date, setDate] = useState<DateRange | undefined>();
    const [isDayCloseOpen, setIsDayCloseOpen] = useState(false);
    const [businessLine, setBusinessLine] = useState<string | undefined>("restaurant");
    const [selectedDayCloseSession, setSelectedDayCloseSession] = useState<any | null>(null);
    const [sessions, setSessions] = useState<any[]>([]);
    const [loadingSessions, setLoadingSessions] = useState(false);
    const [dayCloseAlignedToday, setDayCloseAlignedToday] = useState(false);
    const [dayCloseNetSalesOverride, setDayCloseNetSalesOverride] = useState<
        number | undefined
    >(undefined);
    const user = useAuth(state => state.user);
    const { ready, canViewAnalytics } = useAnalyticsViewAccess();
    const restaurant = useRestaurant((s) => s.restaurant);
    const primaryRole = useMemo(() => resolvePrimaryRole(user), [user]);

    const [station, setStation] = useState<string | undefined>();
    // Revenue Trends card: selected day (triggers refetch for that specific day's hourly data)
    const [revenueCardDay, setRevenueCardDay] = useState<string | null>(null);
    const [revenueCardDayLabel, setRevenueCardDayLabel] = useState<string | null>(null);

    const prevActiveRangeRef = useRef(activeRange);
    const prevDateRef = useRef(date);
    const prevStationRef = useRef(station);
    const prevBusinessLineRef = useRef(businessLine);
    useEffect(() => {
        if (
            prevActiveRangeRef.current !== activeRange || 
            prevDateRef.current !== date ||
            prevStationRef.current !== station ||
            prevBusinessLineRef.current !== businessLine
        ) {
            setSelectedDayCloseSession(null);
        }
        prevActiveRangeRef.current = activeRange;
        prevDateRef.current = date;
        prevStationRef.current = station;
        prevBusinessLineRef.current = businessLine;
    }, [activeRange, date, station, businessLine]);

    useEffect(() => {
        setNcOrdersPage(1);
    }, [activeRange, date, selectedDayCloseSession, businessLine]);

    const [activeTab, setActiveTab] = useState<string>("overview");

    // Menu Details Tab State
    const [menuData, setMenuData] = useState<any>(null);
    const [menuLoading, setMenuLoading] = useState(false);
    const [menuSearch, setMenuSearch] = useState("");
    const [menuCategory, setMenuCategory] = useState("");
    const [menuSortBy, setMenuSortBy] = useState<string>("revenue");
    const [menuSortDir, setMenuSortDir] = useState<string>("desc");
    const [menuPage, setMenuPage] = useState(1);
    const [menuPageSize] = useState(20);
    const [menuCategories, setMenuCategories] = useState<string[]>([]);

    // Staff Details Tab State
    const [staffData, setStaffData] = useState<any>(null);
    const [staffLoading, setStaffLoading] = useState(false);
    const [staffPage, setStaffPage] = useState(1);
    const [staffPageSize] = useState(20);
    
    // NC Details Tab State
    const [ncOrdersData, setNcOrdersData] = useState<any>(null);
    const [ncOrdersLoading, setNcOrdersLoading] = useState(false);
    const [ncOrdersPage, setNcOrdersPage] = useState(1);
    const [ncOrdersPageSize] = useState(20);

    const formatDateStr = (d: Date) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const getActiveDates = useCallback(() => {
        const now = new Date();
        let dateFrom = formatDateStr(now);
        let dateTo = formatDateStr(now);

        if (activeRange === 'yesterday') {
            const y = new Date(now); y.setDate(y.getDate() - 1);
            dateFrom = formatDateStr(y); dateTo = formatDateStr(y);
        } else if (activeRange === 'last7') {
            const l7 = new Date(now); l7.setDate(l7.getDate() - 6);
            dateFrom = formatDateStr(l7);
        } else if (activeRange === 'last30') {
            const l30 = new Date(now); l30.setDate(l30.getDate() - 29);
            dateFrom = formatDateStr(l30);
        } else if (activeRange === 'month') {
            const m = new Date(now.getFullYear(), now.getMonth(), 1);
            dateFrom = formatDateStr(m);
        } else if (activeRange === 'custom' && date?.from) {
            dateFrom = formatDateStr(date.from);
            dateTo = date.to ? formatDateStr(date.to) : dateFrom;
        }
        
        let startTime: string | undefined = undefined;
        let endTime: string | undefined = undefined;
        let queryBusinessLine = businessLine;

        if (selectedDayCloseSession) {
            startTime = selectedDayCloseSession.period_start_at;
            endTime = selectedDayCloseSession.period_end_at;
            queryBusinessLine = selectedDayCloseSession.business_line;
        } else if (activeRange === 'custom' && date?.from) {
            startTime = date.from.toISOString();
            endTime = date.to ? date.to.toISOString() : date.from.toISOString();
        }
        
        return { dateFrom, dateTo, startTime, endTime, businessLine: queryBusinessLine };
    }, [activeRange, date, selectedDayCloseSession, businessLine]);

    // Fetch Menu Categories
    useEffect(() => {
        if (!user?.restaurant_id) return;
        const fetchMenuCategories = async () => {
            try {
                const res = await apiClient.get(ItemCategoryApis.getItemCategories(user.restaurant_id!));
                const list = Array.isArray(res.data?.data) ? res.data.data : [];
                const names = Array.from(new Set(list.map((c: any) => String(c?.name || "").trim()).filter(Boolean))).sort();
                setMenuCategories(names as string[]);
            } catch (e) {
                console.error("Failed to load menu categories", e);
            }
        };
        fetchMenuCategories();
    }, [user?.restaurant_id]);

    // Fetch Menu Details
    useEffect(() => {
        if (activeTab !== "menu" || !user?.restaurant_id) return;
        const fetchMenuDetails = async () => {
            setMenuLoading(true);
            try {
                const dates = getActiveDates();
                const url = AnalyticsApis.menuDetails({
                    restaurantId: user.restaurant_id!,
                    dateFrom: dates.dateFrom,
                    dateTo: dates.dateTo,
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    page: menuPage,
                    pageSize: menuPageSize,
                    sortBy: menuSortBy as any,
                    sortDir: menuSortDir as any,
                    search: menuSearch.trim() || undefined,
                    category: menuCategory.trim() || undefined,
                    businessLine: dates.businessLine,
                });
                const res = await apiClient.get(url);
                if (res.data?.status === "success") {
                    setMenuData(res.data.data);
                }
            } catch (e) {
                console.error("Failed to load menu details", e);
            } finally {
                setMenuLoading(false);
            }
        };
        fetchMenuDetails();
    }, [activeTab, user?.restaurant_id, getActiveDates, selectedDayCloseSession, menuPage, menuPageSize, menuSortBy, menuSortDir, menuCategory]);

    // Fetch Staff Details
    useEffect(() => {
        if (activeTab !== "staff" || !user?.restaurant_id) return;
        const fetchStaffDetails = async () => {
            setStaffLoading(true);
            try {
                const dates = getActiveDates();
                const url = AnalyticsApis.staffDetails({
                    restaurantId: user.restaurant_id!,
                    dateFrom: dates.dateFrom,
                    dateTo: dates.dateTo,
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    page: staffPage,
                    pageSize: staffPageSize,
                    businessLine: dates.businessLine,
                });
                const res = await apiClient.get(url);
                if (res.data?.status === "success") {
                    setStaffData(res.data.data);
                }
            } catch (e) {
                console.error("Failed to load staff details", e);
            } finally {
                setStaffLoading(false);
            }
        };
        fetchStaffDetails();
    }, [activeTab, user?.restaurant_id, getActiveDates, selectedDayCloseSession, staffPage, staffPageSize]);

    // Fetch NC Order History
    useEffect(() => {
        if (activeTab !== "nc" || !user?.restaurant_id) return;
        const fetchNcOrders = async () => {
            setNcOrdersLoading(true);
            try {
                const dates = getActiveDates();
                const url = AnalyticsApis.ncOrders({
                    restaurantId: user.restaurant_id!,
                    dateFrom: dates.startTime ? undefined : dates.dateFrom,
                    dateTo: dates.startTime ? undefined : dates.dateTo,
                    startTime: dates.startTime,
                    endTime: dates.endTime,
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    businessLine: dates.businessLine,
                    skip: (ncOrdersPage - 1) * ncOrdersPageSize,
                    limit: ncOrdersPageSize,
                });
                const res = await apiClient.get(url);
                if (res.data?.status === "success") {
                    setNcOrdersData(res.data.data);
                }
            } catch (e) {
                console.error("Failed to load NC orders history", e);
            } finally {
                setNcOrdersLoading(false);
            }
        };
        fetchNcOrders();
    }, [activeTab, user?.restaurant_id, getActiveDates, selectedDayCloseSession, ncOrdersPage, ncOrdersPageSize]);

    // Fetch day-close sessions
    useEffect(() => {
        const rId = user?.restaurant_id;
        if (!rId) return;
        const fetchSessions = async () => {
            setLoadingSessions(true);
            try {
                const res = await apiClient.get(DayCloseApis.sessions({
                    restaurantId: rId,
                    businessLine: businessLine || undefined,
                    skip: 0,
                    limit: 50,
                }));
                if (Array.isArray(res.data)) {
                    setSessions(res.data);
                } else if (Array.isArray(res.data?.data)) {
                    setSessions(res.data.data);
                }
            } catch (err) {
                console.error("Failed to fetch sessions", err);
            } finally {
                setLoadingSessions(false);
            }
        };
        fetchSessions();
    }, [user?.restaurant_id, businessLine]);

    const getSessionDateLabel = (session: any) => {
        if (!session) return "";
        try {
            const source = session.period_end_at || session.confirmed_at || session.business_date;
            const parsed = new Date(source);
            if (isNaN(parsed.getTime())) return session.business_date;
            const day = parsed.getDate();
            const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            const month = months[parsed.getMonth()];
            const year = parsed.getFullYear();
            let hours = parsed.getHours();
            const minutes = String(parsed.getMinutes()).padStart(2, '0');
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12; hours = hours ? hours : 12;
            return `${day} ${month} ${year}, ${hours}:${minutes} ${ampm}`;
        } catch (e) { return session.business_date; }
    };

    const getSessionRangeLabel = (session: any) => {
        if (!session) return "";
        try {
            const start = new Date(session.period_start_at);
            const end = new Date(session.period_end_at);
            if (isNaN(start.getTime()) || isNaN(end.getTime())) return "";
            const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            const formatTime = (d: Date) => {
                const day = d.getDate();
                const month = months[d.getMonth()];
                const year = d.getFullYear();
                let hours = d.getHours();
                const minutes = String(d.getMinutes()).padStart(2, '0');
                const ampm = hours >= 12 ? 'PM' : 'AM';
                hours = hours % 12; hours = hours ? hours : 12;
                const sameYear = start.getFullYear() === end.getFullYear();
                const yearStr = sameYear ? '' : ` ${year}`;
                return `${month} ${day}${yearStr}, ${hours}:${minutes} ${ampm}`;
            };
            return `${formatTime(start)} - ${formatTime(end)}`;
        } catch (e) { return ""; }
    };

    const formatSessionCoveredRange = (session: any) => {
        if (!session) return "";
        return `Covers ${getSessionRangeLabel(session)}`;
    };

    const applyAllowedAnalyticsRange = useCallback(() => {
        setActiveRange("last30");
        setDate(undefined);
        setScopeNotice(null);
        setFetchTrigger((t) => t + 1);
    }, []);

    // Fetch all analytics from unified /analytics/dashboard (same as Flutter)
    useEffect(() => {
        const fetchAnalytics = async () => {
            if (!user?.restaurant_id || !canViewAnalytics) {
                setData(null); setTrendsData([]); setCategoryData([]);
                setLoading(false); return;
            }
            if (activeRange === 'custom' && (!date?.from || !date?.to)) return;

            const presetRange = getAnalyticsPresetRange(activeRange, date);
            const validation = validateAnalyticsDateRange(presetRange, {
                role: primaryRole,
                effectivePlan: restaurant?.effective_plan,
            });
            if (!validation.allowed) {
                setScopeNotice(validationToScopeError(validation));
                setFetchError(null); setData(null); setTrendsData([]); setCategoryData([]);
                setLoading(false); return;
            }

            setScopeNotice(null);
            setLoading(true);
            setFetchError(null);
            try {
                const formatDate = (date: Date) => {
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    return `${year}-${month}-${day}`;
                };
                const now = new Date();
                let dateFrom = formatDate(now);
                let dateTo = formatDate(now);

                if (activeRange === 'yesterday') {
                    const y = new Date(now); y.setDate(y.getDate() - 1);
                    dateFrom = formatDate(y); dateTo = formatDate(y);
                } else if (activeRange === 'last7') {
                    const l7 = new Date(now); l7.setDate(l7.getDate() - 6);
                    dateFrom = formatDate(l7);
                } else if (activeRange === 'last30') {
                    const l30 = new Date(now); l30.setDate(l30.getDate() - 29);
                    dateFrom = formatDate(l30);
                } else if (activeRange === 'month') {
                    const m = new Date(now.getFullYear(), now.getMonth(), 1);
                    dateFrom = formatDate(m);
                } else if (activeRange === 'custom' && date?.from) {
                    dateFrom = formatDate(date.from);
                    dateTo = date.to ? formatDate(date.to) : dateFrom;
                }
                let startTime: string | undefined = undefined;
                let endTime: string | undefined = undefined;
                let queryBusinessLine = businessLine;
                let dayCloseAlignedTodayLocal = false;
                let dayCloseNetSalesOverrideLocal: number | undefined = undefined;

                if (selectedDayCloseSession) {
                    startTime = selectedDayCloseSession.period_start_at;
                    endTime = selectedDayCloseSession.period_end_at;
                    queryBusinessLine = selectedDayCloseSession.business_line;
                    dayCloseAlignedTodayLocal = false;
                    dayCloseNetSalesOverrideLocal = undefined;
                } else if (activeRange === 'custom' && date?.from) {
                    startTime = date.from.toISOString();
                    endTime = date.to ? date.to.toISOString() : date.from.toISOString();
                    dayCloseAlignedTodayLocal = false;
                    dayCloseNetSalesOverrideLocal = undefined;
                } else if (
                    activeRange === "today" &&
                    !selectedDayCloseSession &&
                    (businessLine === "restaurant" || businessLine === "hotel")
                ) {
                    dayCloseAlignedTodayLocal = false;
                    dayCloseNetSalesOverrideLocal = undefined;
                    try {
                        const [currentRes, snapshotRes] = await Promise.all([
                            apiClient.get(
                                DayCloseApis.current({
                                    restaurantId: user.restaurant_id,
                                    businessLine: businessLine as BusinessLine,
                                }),
                            ),
                            apiClient.get(
                                DayCloseApis.generateSnapshot({
                                    restaurantId: user.restaurant_id,
                                    businessLine: businessLine as BusinessLine,
                                }),
                            ),
                        ]);

                        const currentClose = unwrapApiData(currentRes.data, parseDayCloseCurrent);
                        const snapshotData = unwrapApiData(
                            snapshotRes.data,
                            parseDayCloseSnapshotData,
                        );
                        if (currentClose?.period_start_at && currentClose?.period_end_at) {
                            startTime = currentClose.period_start_at;
                            endTime = currentClose.period_end_at;
                            queryBusinessLine =
                                currentClose.business_line ?? businessLine;
                            dayCloseAlignedTodayLocal = true;
                            dayCloseNetSalesOverrideLocal =
                                snapshotData?.net_sales ?? undefined;
                        }
                    } catch {
                        dayCloseAlignedTodayLocal = false;
                        dayCloseNetSalesOverrideLocal = undefined;
                    }
                }

                const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                setDayCloseAlignedToday(dayCloseAlignedTodayLocal);
                setDayCloseNetSalesOverride(dayCloseNetSalesOverrideLocal);

                const dashboardUrl = AnalyticsApis.dashboard({
                    restaurantId: user.restaurant_id,
                    dateFrom: selectedDayCloseSession ? undefined : dateFrom,
                    dateTo: selectedDayCloseSession ? undefined : dateTo,
                    startTime,
                    endTime,
                    timezone,
                    businessLine: queryBusinessLine,
                    station:
                        selectedDayCloseSession || dayCloseAlignedTodayLocal
                            ? undefined
                            : station,
                    include: "core",
                });

                const res = await apiClient.get(dashboardUrl);

                if (res.data?.status === "success") {
                    const d = res.data.data;
                    setData(d);
                    setTrendsData(
                        mapAnalyticsTrends(d, preferHourlyTrends(activeRange))
                    );
                } else {
                    setFetchError(res.data?.message || "Failed to load analytics dashboard");
                }

            } catch (err: unknown) {
                const parsed = parseApiScopeError(err, { role: primaryRole });
                if (parsed) {
                    setScopeNotice(parsed); setFetchError(null); setData(null);
                    setTrendsData([]); setCategoryData([]); return;
                }
                const axiosErr = err as { response?: { data?: { detail?: unknown; message?: string } } };
                const message =
                    (typeof axiosErr?.response?.data?.detail === "string"
                        ? axiosErr.response.data.detail
                        : null) ||
                    axiosErr?.response?.data?.message ||
                    "Failed to load analytics dashboard";
                setFetchError(message);
            } finally {
                setLoading(false);
            }
        };

        if (!ready) return;
        if (user?.restaurant_id) { fetchAnalytics(); }
    }, [ready, canViewAnalytics, user, activeRange, businessLine, date, station, fetchTrigger, primaryRole, restaurant?.effective_plan, selectedDayCloseSession]);

    useEffect(() => {
        if (!data) { setCategoryData([]); return; }
        setCategoryData(mapBreakdownToPie(data, breakdownType));
    }, [data, breakdownType]);

    // ── Data extraction helpers (mirrors Flutter's fromJson) ──────────────────
    const overview = data?.tabs?.overview?.overview || data?.overview || {};
    const kpis = data?.tabs?.overview?.kpis || data?.tabs?.finance?.kpis || data?.kpis || {};
    const comparison = data?.tabs?.overview?.comparison || data?.tabs?.finance?.comparison || data?.comparison || {};
    const receivables = data?.tabs?.finance?.receivables || data?.receivables || {};
    const operations = data?.tabs?.orders?.operations || data?.tabs?.orders || data?.operations || {};
    const trendsChart = data?.tabs?.overview?.trends_chart || data?.trends_chart || {};

    // today snapshot (Flutter: todayIncome / todayExpense)
    const todaySnapshot = data?.tabs?.overview?.today_snapshot || {};
    const todayIncome = todaySnapshot.income ?? 0;
    const todayExpense = todaySnapshot.expense ?? 0;

    // executive summary metrics
    const v2 = useMemo(() => {
        if (!data?.tabs) return null;
        const overviewMetrics = data.tabs.overview?.executive_summary?.metrics || [];
        const financeMetrics = data.tabs.finance?.pnl_summary?.metrics || [];
        const ordersMetrics = data.tabs.orders?.outcome_summary?.metrics || [];

        const getMetric = (list: any[], keys: string[]) => {
            if (!Array.isArray(list)) return null;
            for (const key of keys) { const found = list.find((m: any) => m?.key === key); if (found) return found; }
            return null;
        };
        const getVal = (list: any[], keys: string[], fallback = 0) => {
            const m = getMetric(list, keys);
            return m && typeof m.value === 'number' ? m.value : fallback;
        };
        const getValOptional = (list: any[], keys: string[]) => {
            const m = getMetric(list, keys);
            return m && typeof m.value === 'number' ? m.value : undefined;
        };
        const getDelta = (list: any[], keys: string[]) => {
            const m = getMetric(list, keys);
            return m?.delta?.vs_previous_period_pct ?? 0;
        };

        const income = getVal(overviewMetrics, ["income", "sales"]);
        const expense = getVal(overviewMetrics, ["expense"]);
        const profit = getVal(overviewMetrics, ["net_profit", "profit"]);
        const orders = getVal(overviewMetrics, ["orders"]);
        const sales = getVal(overviewMetrics, ["sales", "income"]);

        const incomeDelta = getDelta(overviewMetrics, ["income", "sales"]);
        const expenseDelta = getDelta(overviewMetrics, ["expense"]);
        const profitDelta = getDelta(overviewMetrics, ["net_profit", "profit"]);
        const ordersDelta = getDelta(overviewMetrics, ["orders"]);

        const avgOrderValue = orders > 0 ? sales / orders : 0;

        const cancellationRateVal = getVal(ordersMetrics, ["canceled_orders", "order_cancellation_pct"]);
        const avgServiceTime = getVal(ordersMetrics, ["avg_service_time_min"]);

        const discounts = getVal(financeMetrics, ["discounts", "discount", "total_discount", "discount_total"]) ||
                          getVal(overviewMetrics, ["discounts", "discount", "total_discount", "discount_total"]) || 0;
        const refunds = getVal(ordersMetrics, ["refund_total", "refunds", "total_refunds", "refund_amount"]) ||
                        getVal(overviewMetrics, ["refund_total", "refunds", "total_refunds", "refund_amount"]) || 0;

        const peakHour = data.tabs.overview?.table_utilization?.peak_hour || "—";

        // Finance summary metrics
        const grossIncome = getVal(financeMetrics, ["gross_income", "income", "sales"]) || income;
        const netProfit = getVal(financeMetrics, ["net_profit", "profit"]) || profit;
        const totalExpense = getVal(financeMetrics, ["expenses", "expense"]) || expense;
        const discount = getVal(financeMetrics, ["discount", "discounts", "total_discount"]) || discounts;
        const netSales =
            getValOptional(financeMetrics, ["net_sales"]) ??
            getValOptional(overviewMetrics, ["net_sales"]);

        const grossIncomeDelta = getDelta(financeMetrics, ["gross_income", "income", "sales"]);
        const netProfitDelta = getDelta(financeMetrics, ["net_profit", "profit"]);
        const totalExpenseDelta = getDelta(financeMetrics, ["expenses", "expense"]);
        const discountDelta = getDelta(financeMetrics, ["discount", "discounts", "total_discount"]);

        return {
            income, incomeDelta, expense, expenseDelta, profit, profitDelta,
            orders, ordersDelta, avgOrderValue, cancellationRateVal, avgServiceTime,
            peakHour, discounts, refunds,
            grossIncome, grossIncomeDelta, netProfit, netProfitDelta,
            totalExpense, totalExpenseDelta, discount, discountDelta,
            netSales,
        };
    }, [data]);

    // Revenue/Performance trends data
    const revenueTrendsData = useMemo(() => {
        const overviewTab = data?.tabs?.overview || {};
        const financeTab = data?.tabs?.finance || {};
        const overviewRevenueTrends = overviewTab.revenue_trends || {};
        const incomeVsExpense = financeTab.income_vs_expense || {};

        const incomeVsExpenseLabels = incomeVsExpense.labels?.length || 0;
        const overviewRevenueLabels = overviewRevenueTrends.labels?.length || 0;

        const revenueSection = (incomeVsExpenseLabels >= overviewRevenueLabels && incomeVsExpenseLabels > 0)
            ? incomeVsExpense
            : overviewRevenueTrends;

        if (!revenueSection.labels) return [];

        return revenueSection.labels.map((label: string, i: number) => ({
            date: label,
            revenue: revenueSection.revenue?.[i] ?? 0,
            expense: revenueSection.expense?.[i] ?? 0,
            profit: revenueSection.profit?.[i] ?? 0,
            orders: revenueSection.orders?.[i] ?? 0,
        }));
    }, [data]);

    const performanceTrendsData = useMemo(() => {
        const overviewTab = data?.tabs?.overview || {};
        const trends = overviewTab.health_trends || data?.health_trends || {};
        const legacyHourly = data?.trends_chart?.hourly?.orders || [];
        const legacyHourlyLabels = data?.trends_chart?.hourly?.labels || [];
        const legacyDaily = data?.trends_chart?.daily?.orders || [];
        const legacyDailyLabels = data?.trends_chart?.daily?.labels || [];

        let labels = trends.labels || [];
        let orders = trends.orders || [];

        if (orders.length === 0) {
            if (legacyHourly.length > 0) { orders = legacyHourly; labels = legacyHourlyLabels; }
            else if (legacyDaily.length > 0) { orders = legacyDaily; labels = legacyDailyLabels; }
        }

        if (!labels || labels.length === 0) return [];

        // cumulative series
        let runningOrders = 0;
        return labels.map((label: string, i: number) => {
            const val = orders[i] ?? 0;
            runningOrders += val;
            return { date: label, orders: runningOrders, rawOrders: val };
        });
    }, [data]);

    // Key values
    const currentIncome = v2 ? v2.income : (overview.total_income || kpis.gross_sales || 0);
    const currentExpense = v2 ? v2.expense : (overview.total_expense || kpis.total_expense || 0);
    const currentProfit = v2 ? v2.profit : (overview.net_profit || 0);
    const compIncomeDelta = v2 ? v2.incomeDelta : (comparison.deltas?.income_pct ?? 0);
    const compExpenseDelta = v2 ? v2.expenseDelta : (comparison.deltas?.expense_pct ?? 0);
    const compProfitDelta = v2 ? v2.profitDelta : (comparison.deltas?.profit_pct ?? 0);
    const totalOrdersVal = v2 ? v2.orders : (overview.orders_count || kpis.total_orders || 0);
    const avgOrderVal = v2 ? v2.avgOrderValue : (overview.avg_order_value || kpis.avg_order_value || 0);
    const peakHourVal = v2 ? v2.peakHour : (operations.peak_hour || "—");
    const grossSalesVal = v2 ? v2.income : (kpis.gross_sales || 0);
    const currentDiscounts = v2 ? v2.discounts : (kpis.discount_total || data?.discount_total || 0);
    const currentRefunds = v2 ? v2.refunds : (kpis.refund_total || data?.refund_total || 0);

    const cancellationRateStr = v2
        ? `${Number(v2.cancellationRateVal).toFixed(1)}%`
        : formatCancellationRate(operations);

    // ── Orders tab data ───────────────────────────────────────────────────────
    const livePipeline = data?.tabs?.orders?.live_pipeline || {};
    const liveCompleted = livePipeline.completed ?? 0;
    const livePending = livePipeline.pending ?? 0;
    const liveDelayed = livePipeline.delayed ?? 0;
    const liveCanceled = livePipeline.canceled ?? 0;

    const sourceMixItems = data?.tabs?.orders?.source_mix?.items || [];
    const ordersTopItems = data?.tabs?.orders?.top_selling_items?.items || [];
    const topSellingTables = data?.tabs?.orders?.top_selling_tables?.items || [];
    const topCustomers = data?.tabs?.orders?.top_customers?.items || [];

    // ── Menu tab data ─────────────────────────────────────────────────────────
    const menuTopItems = data?.tabs?.menu?.top_items?.items || data?.tabs?.menu?.menu_snapshot?.top_items || [];
    const menuLowItems = data?.tabs?.menu?.low_items?.items || [];
    const menuSummaryMetrics = data?.tabs?.menu?.performance_summary?.metrics || [];
    const menuSnapshotTopItem = menuTopItems[0];

    // ── Staff tab data ────────────────────────────────────────────────────────
    const staffLeaderboard = data?.tabs?.staff?.leaderboard?.items || [];
    const staffTopPerformer = data?.tabs?.staff?.top_performer || {};
    const staffSummaryMetrics = data?.tabs?.staff?.productivity_summary?.metrics || [];
    const topStaff = staffLeaderboard[0] || staffTopPerformer;

    // ── NC tab data ───────────────────────────────────────────────────────────
    const ncTab = data?.tabs?.nc || {};
    const ncSummary = ncTab.summary || {};
    const ncTopItems = ncTab.top_items?.items || [];
    const ncTopCustomers = ncTab.top_customers?.items || [];
    const ncTrend = ncTab.trend?.items || [];
    const ncRecentOrders = ncTab.recent_orders?.items || [];
    const ncOrdersList = ncOrdersData?.items || [];
    const ncOrdersTotal = ncOrdersData?.total_items || 0;
    const ncOrdersHasMore = Boolean(ncOrdersData?.has_more);
    const ncOrdersTotalPages = Math.max(1, Math.ceil(ncOrdersTotal / ncOrdersPageSize));
    const ncTotalValue = Number(ncSummary.nc_total_value || 0);
    const ncTotalItems = Number(ncSummary.nc_items_count || 0);
    const ncOrdersCount = Number(ncSummary.nc_orders_count || 0);
    const ncCustomersCount = Number(ncSummary.customers_with_nc_items || 0);

    const incomeVsExpenseData = useMemo(() => {
        const ivs = data?.tabs?.finance?.income_vs_expense || {};
        if (!ivs.labels) return [];
        return ivs.labels.map((label: string, i: number) => ({
            date: label,
            revenue: ivs.revenue?.[i] ?? ivs.income?.[i] ?? 0,
            expense: ivs.expense?.[i] ?? 0,
            profit: ivs.profit?.[i] ?? 0,
        }));
    }, [data]);

    // ── Payment methods expansion (mirrors Flutter _expandedPaymentMethods) ──
    const expandedPaymentMethods = useMemo(() => {
        const paymentMix = data?.tabs?.overview?.payment_mix || {};
        const paymentSettlementMix = data?.tabs?.finance?.payment_settlement_mix || {};
        const breakdown = data?.breakdown || {};
        const methods: any[] =
            paymentMix.items?.length
                ? paymentMix.items
                : paymentSettlementMix.items?.length
                  ? paymentSettlementMix.items
                  : breakdown.income_by_payment_method || [];
        const rawInstrumentRows: any[] =
            data?.tabs?.finance?.income_by_payment_instrument ||
            paymentMix.income_by_payment_instrument ||
            paymentSettlementMix.income_by_payment_instrument ||
            paymentMix.by_payment_instrument ||
            paymentSettlementMix.by_payment_instrument ||
            data?.income_by_payment_instrument ||
            breakdown.income_by_payment_instrument ||
            [];

        const normalize = (m: string) => {
            const compact = String(m || "").trim().toLowerCase().replace(/_/g, ' ');
            if (compact.includes('card')) return 'card';
            if (compact.includes('digital') || compact.includes('upi') || compact.includes('qr') || compact.includes('fonepay')) return 'digital';
            if (compact.includes('cash')) return 'cash';
            if (compact.includes('credit')) return 'credit';
            return compact;
        };

        const parseInstrumentRow = (row: any) => {
            let method = String(row?.method || row?.payment_method || row?.type || row?.channel || "").trim();
            let instrument = String(row?.instrument || row?.instrument_name || row?.name || "").trim();

            if (!method || !instrument) {
                const label = String(row?.label || "").trim();
                if (label) {
                    const normalizedLabel = label
                        .replaceAll("•", "|")
                        .replaceAll("·", "|")
                        .replaceAll("-", "|");
                    const parts = normalizedLabel.split("|").map((v) => v.trim()).filter(Boolean);
                    if (parts.length > 0) {
                        if (!method) method = parts[0];
                        if (!instrument && parts.length > 1) {
                            instrument = parts.slice(1).join(" • ");
                        }
                    }
                }
            }

            return {
                method,
                instrument,
                amount: Number(row?.amount || row?.total || 0),
            };
        };

        const grouped: Record<string, any[]> = {};
        for (const raw of rawInstrumentRows) {
            const ins = parseInstrumentRow(raw);
            const mk = normalize(ins.method || "");
            if (mk === 'card' || mk === 'digital') {
                if (!grouped[mk]) grouped[mk] = [];
                grouped[mk].push(ins);
            }
        }

        if (Object.keys(grouped).length === 0) {
            return methods;
        }

        const hasCardInstruments = grouped["card"]?.length > 0;
        const hasDigitalInstruments = grouped["digital"]?.length > 0;
        const expanded: any[] = [];

        for (const method of methods) {
            const mk = normalize(method.label || method.method || "");
            const shouldReplace =
                (mk === "card" && hasCardInstruments) ||
                (mk === "digital" && hasDigitalInstruments);
            if (!shouldReplace) {
                expanded.push(method);
            }
        }

        const appendInstrumentRows = (methodKey: string, methodLabel: string) => {
            const rows = grouped[methodKey];
            if (!rows?.length) return;
            const sorted = [...rows].sort((a, b) => (b.amount || 0) - (a.amount || 0));
            for (const row of sorted) {
                const instrumentName = String(row.instrument || "").trim();
                expanded.push({
                    label: instrumentName ? `${methodLabel} • ${instrumentName}` : `${methodLabel} • Unspecified`,
                    amount: row.amount || 0,
                    method: methodLabel,
                    isInstrument: true,
                });
            }
        };

        appendInstrumentRows("card", "Card");
        appendInstrumentRows("digital", "Digital");

        if (!expanded.length && !methods.length) {
            const fallback: any[] = [];
            const appendFallback = (methodKey: string, methodLabel: string) => {
                const rows = grouped[methodKey];
                if (!rows?.length) return;
                const sorted = [...rows].sort((a, b) => (b.amount || 0) - (a.amount || 0));
                for (const row of sorted) {
                    const instrumentName = String(row.instrument || "").trim();
                    fallback.push({
                        label: `${methodLabel} • ${instrumentName || "Unspecified"}`,
                        amount: row.amount || 0,
                        method: methodLabel,
                        isInstrument: true,
                    });
                }
            };
            appendFallback("card", "Card");
            appendFallback("digital", "Digital");
            if (fallback.length) return fallback;
        }

        return expanded.length ? expanded : methods;
    }, [data]);

    // ── Table utilization ─────────────────────────────────────────────────────
    const tableUtil = data?.tabs?.overview?.table_utilization || {};
    const tableAvailable = tableUtil.available !== false;
    const totalTables = tableUtil.total_tables || 0;
    const tablesUsed = Math.min(tableUtil.tables_used || 0, totalTables);
    const utilizationPct = totalTables > 0 ? Math.round((tablesUsed / totalTables) * 100) : (tableUtil.utilization_pct ?? 0);
    const tableOrders = tableUtil.table_orders ?? tableUtil.orders_count ?? 0;
    const avgOrdersPerUsedTable = tableUtil.avg_orders_per_used_table ?? (tablesUsed > 0 ? (tableOrders / tablesUsed) : 0);
    const freeTables = Math.max(0, totalTables - tablesUsed);
    const topSellingTablesList = data?.tabs?.orders?.top_selling_tables?.items || topSellingTables;

    // ── Helpers ───────────────────────────────────────────────────────────────
    const fmt = (n: number) => `Rs. ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const fmtShort = (n: number) => `Rs. ${Number(n || 0).toLocaleString()}`;
    const fmtCount = (n: number) => Number(n || 0).toLocaleString();

    const menuSnapshot = data?.tabs?.menu?.menu_snapshot || {};
    const topMenuItems = menuSnapshot.top_items || menuTopItems;
    const pieCopy = breakdownPieCopy(breakdownType);

    if (!ready) return <AnalyticsAccessLoading />;
    if (!canViewAnalytics) return <AnalyticsAccessDenied />;

    return (
        <div className="flex flex-col gap-8 max-w-[1600px] mx-auto pb-10">
            {scopeNotice ? (
                <HistoryScopeNotice
                    error={scopeNotice}
                    onUseSuggestedRange={
                        isPlanScopeError(scopeNotice) || scopeNotice.kind === "role_manager_limit"
                            ? applyAllowedAnalyticsRange
                            : scopeNotice.kind === "role_cashier_limit"
                              ? () => { setActiveRange("today"); setDate(undefined); setScopeNotice(null); setFetchTrigger((t) => t + 1); }
                              : undefined
                    }
                    suggestedRangeLabel={scopeNotice.kind === "role_cashier_limit" ? "View today only" : "View last 30 days"}
                />
            ) : null}
            {fetchError && !scopeNotice ? (
                <AnalyticsFetchError message={fetchError} onRetry={() => setFetchTrigger((t) => t + 1)} />
            ) : null}

            {/* Header & Filters */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
                    <p className="text-muted-foreground text-sm uppercase tracking-wider text-orange-500 font-semibold">
                        {restaurant?.name || "YUMMY"}
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <DateRangeDropdown
                        activeRange={activeRange}
                        setActiveRange={setActiveRange}
                        date={date}
                        setDate={setDate}
                    />

                    {/* Daybook Select */}
                    <div className="flex flex-col min-w-[220px]">
                        <Select
                            value={selectedDayCloseSession ? String(selectedDayCloseSession.id) : "all"}
                            onValueChange={(val) => {
                                if (val === "all") {
                                    setSelectedDayCloseSession(null);
                                    setFetchTrigger((t) => t + 1);
                                } else {
                                    const sess = sessions.find((s) => String(s.id) === val);
                                    if (sess) {
                                        setSelectedDayCloseSession(sess);
                                        if (sess.business_line) setBusinessLine(sess.business_line);
                                        setFetchTrigger((t) => t + 1);
                                    }
                                }
                            }}
                        >
                            <SelectTrigger className="h-10 rounded-xl bg-card border-border/60 font-medium">
                                <SelectValue placeholder="Daybook: All">
                                    {selectedDayCloseSession ? `Daybook: ${getSessionDateLabel(selectedDayCloseSession)}` : "Daybook: All"}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="rounded-xl max-w-[450px]">
                                <SelectItem value="all" textValue="Daybook: All">Daybook: All</SelectItem>
                                {sessions.map((sess: any) => (
                                    <SelectItem key={sess.id} value={String(sess.id)} textValue={`Daybook: ${getSessionDateLabel(sess)}`}>
                                        <div className="flex flex-col gap-0.5 py-1 text-left">
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-sm">{getSessionDateLabel(sess)}</span>
                                                <Badge variant="outline" className="text-[9px] uppercase px-1 py-0 scale-90 border-orange-500/20 text-orange-500 bg-orange-500/5">
                                                    {sess.business_line}
                                                </Badge>
                                            </div>
                                            <span className="text-xs text-muted-foreground font-medium">
                                                Covers: {getSessionRangeLabel(sess)}
                                            </span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Station Select */}
                    <div className="flex flex-col min-w-[200px]">
                        <Select
                            value={station || "all"}
                            onValueChange={(val) => { setStation(val === "all" ? undefined : val); setFetchTrigger((t) => t + 1); }}
                            disabled={!!selectedDayCloseSession}
                        >
                            <SelectTrigger className="h-10 rounded-xl bg-card border-border/60 font-medium">
                                <SelectValue placeholder="Station: All">
                                    {station ? `Station: ${station.charAt(0).toUpperCase() + station.slice(1)}` : "Station: All"}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="all">Station: All</SelectItem>
                                <SelectItem value="kitchen">Kitchen</SelectItem>
                                <SelectItem value="bar">Bar</SelectItem>
                                <SelectItem value="cafe">Cafe</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Business Line Select */}
                    {restaurant?.hotel_enabled && restaurant?.restaurant_enabled && (
                        <div className="flex flex-col min-w-[220px]">
                            <Select
                                value={businessLine || "all"}
                                onValueChange={(val) => {
                                    setBusinessLine(val === "all" ? undefined : val);
                                    setFetchTrigger((t) => t + 1);
                                }}
                            >
                                <SelectTrigger className="h-10 rounded-xl bg-card border-border/60 font-medium">
                                    <SelectValue placeholder="View Metrics For: All Services">
                                        {businessLine === "restaurant"
                                            ? "View Metrics For: Restaurant"
                                            : businessLine === "hotel"
                                              ? "View Metrics For: Hotel / Rooms"
                                              : "View Metrics For: All Services"}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    <SelectItem value="all">All Services</SelectItem>
                                    <SelectItem value="restaurant">Restaurant</SelectItem>
                                    <SelectItem value="hotel">Hotel / Rooms</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>
            </div>

            {selectedDayCloseSession && (
                <div className="bg-orange-500/10 border border-orange-500/20 text-orange-500 px-4 py-3 rounded-2xl text-xs font-semibold flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    <span>Daybook: {getSessionDateLabel(selectedDayCloseSession)}. {formatSessionCoveredRange(selectedDayCloseSession)}</span>
                </div>
            )}

            {loading && !data && !scopeNotice ? (
                <AnalyticsSkeleton />
            ) : scopeNotice ? null : (
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                        <TabsList className="bg-muted p-1 rounded-xl flex overflow-x-auto gap-1 max-w-full no-scrollbar">
                            <TabsTrigger value="overview" className="rounded-lg font-semibold shrink-0">Overview</TabsTrigger>
                            <TabsTrigger value="orders" className="rounded-lg font-semibold shrink-0">Orders</TabsTrigger>
                            <TabsTrigger value="finance" className="rounded-lg font-semibold shrink-0">Finance</TabsTrigger>
                            <TabsTrigger value="menu" className="rounded-lg font-semibold shrink-0">Menu</TabsTrigger>
                            <TabsTrigger value="staff" className="rounded-lg font-semibold shrink-0">Staff</TabsTrigger>
                            <TabsTrigger value="nc" className="rounded-lg font-semibold shrink-0">NC</TabsTrigger>
                        </TabsList>
                        <div className="flex flex-wrap items-center gap-2">
                            <Link href="/analytics/kitchen">
                                <Button variant="outline" className="rounded-full gap-2 h-8 text-xs font-semibold">
                                    <ChefHat className="w-3.5 h-3.5" /> Kitchen Details
                                </Button>
                            </Link>
                            <Link href="/analytics/inventory">
                                <Button variant="outline" className="rounded-full gap-2 h-8 text-xs font-semibold">
                                    <Boxes className="w-3.5 h-3.5" /> Inventory Details
                                </Button>
                            </Link>
                            <Link href="/analytics/compare">
                                <Button variant="outline" className="rounded-full gap-2 h-8 text-xs font-semibold">
                                    <ArrowLeftRight className="w-3.5 h-3.5" /> Compare
                                </Button>
                            </Link>
                        </div>
                    </div>

                    {/* ══════════════════════════════════════════════════ OVERVIEW TAB */}
                    <TabsContent value="overview" className="space-y-6 outline-none">
                        {/* Today Snapshot */}
                        <section className="space-y-3">
                            <h3 className="text-base font-bold text-muted-foreground uppercase tracking-wider">Today Snapshot</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <SnapshotCard
                                    label="CURRENT INCOME"
                                    value={
                                        dayCloseAlignedToday &&
                                        dayCloseNetSalesOverride != null
                                            ? dayCloseNetSalesOverride
                                            : todayIncome || currentIncome
                                    }
                                    icon={<Wallet className="w-4 h-4" />}
                                    color="text-orange-500"
                                    bgColor="bg-orange-500/10"
                                    borderColor="border-orange-500/20"
                                />
                                <SnapshotCard label="CURRENT EXPENSE" value={todayExpense || currentExpense} icon={<TrendingDown className="w-4 h-4" />} color="text-red-500" bgColor="bg-red-500/10" borderColor="border-red-500/20" />
                            </div>
                        </section>

                        {/* Summary */}
                        <section className="space-y-3">
                            <h3 className="text-base font-bold text-muted-foreground uppercase tracking-wider">Summary</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <BigMetricCard
                                    label="Sales"
                                    value={
                                        dayCloseAlignedToday &&
                                        dayCloseNetSalesOverride != null
                                            ? dayCloseNetSalesOverride
                                            : grossSalesVal
                                    }
                                    icon={<DollarSign className="w-4.5 h-4.5" />}
                                    color="text-orange-500"
                                    trend={compIncomeDelta}
                                    tagColor={
                                        Number(compIncomeDelta) >= 0
                                            ? "bg-emerald-500/10 text-emerald-500"
                                            : "bg-red-500/10 text-red-500"
                                    }
                                />
                                <BigMetricCard label="Order" value={totalOrdersVal} noCurrency icon={<ReceiptText className="w-4.5 h-4.5" />} color="text-blue-500" trend={v2?.ordersDelta} tagColor={Number(v2?.ordersDelta) >= 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"} />
                                <BigMetricCard label="Income" value={currentIncome} icon={<Wallet className="w-4.5 h-4.5" />} color="text-emerald-500" trend={v2?.incomeDelta ?? compIncomeDelta} tagColor={Number(v2?.incomeDelta ?? compIncomeDelta) >= 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"} />
                                <BigMetricCard label="Expense" value={currentExpense} icon={<TrendingDown className="w-4.5 h-4.5" />} color="text-red-500" trend={compExpenseDelta} tagColor={Number(compExpenseDelta) <= 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"} />
                            </div>
                        </section>

                        {/* Charts */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <RevenueTrendsCard
                                data={revenueTrendsData}
                                loading={loading}
                                activeRange={activeRange}
                                currentDayLabel={revenueCardDayLabel || undefined}
                                onDaySelect={(dateStr) => {
                                    // Build a friendly label for the selected day
                                    try {
                                        const d = new Date(dateStr);
                                        const now = new Date();
                                        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                                        const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
                                        const sel = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                                        const label = sel.getTime() === today.getTime() ? "Today"
                                            : sel.getTime() === yesterday.getTime() ? "Yesterday"
                                            : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
                                        setRevenueCardDay(dateStr);
                                        setRevenueCardDayLabel(label);
                                        // Switch to custom single-day range to refetch hourly data
                                        const from = new Date(dateStr);
                                        from.setHours(0, 0, 0, 0);
                                        const to = new Date(dateStr);
                                        to.setHours(23, 59, 59, 999);
                                        setActiveRange("custom");
                                        setDate({ from, to });
                                        setFetchTrigger(t => t + 1);
                                    } catch { /* ignore */ }
                                }}
                            />
                            <PerformanceTrendsCard
                                data={performanceTrendsData}
                                loading={loading}
                                totalOrders={totalOrdersVal}
                                ordersDelta={v2?.ordersDelta ?? 0}
                                activeRange={activeRange}
                                currentDayLabel={revenueCardDayLabel || undefined}
                                onDaySelect={(dateStr) => {
                                    try {
                                        const d = new Date(dateStr);
                                        const now = new Date();
                                        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                                        const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
                                        const sel = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                                        const label = sel.getTime() === today.getTime() ? "Today"
                                            : sel.getTime() === yesterday.getTime() ? "Yesterday"
                                            : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
                                        setRevenueCardDay(dateStr);
                                        setRevenueCardDayLabel(label);
                                        const from = new Date(dateStr);
                                        from.setHours(0, 0, 0, 0);
                                        const to = new Date(dateStr);
                                        to.setHours(23, 59, 59, 999);
                                        setActiveRange("custom");
                                        setDate({ from, to });
                                        setFetchTrigger(t => t + 1);
                                    } catch { /* ignore */ }
                                }}
                            />
                        </div>

                        {/* Table Utilization & Payment Methods */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <TableUtilizationCard
                                available={tableAvailable}
                                totalTables={totalTables}
                                tablesUsed={tablesUsed}
                                utilizationPct={utilizationPct}
                                tableOrders={tableOrders}
                                avgOrdersPerUsedTable={avgOrdersPerUsedTable}
                                freeTables={freeTables}
                                peakHour={peakHourVal}
                                topTables={topSellingTablesList}
                            />
                            <PaymentMethodsBreakdownCard
                                expandedMethods={expandedPaymentMethods}
                                currentDayLabel={revenueCardDayLabel || undefined}
                                onDaySelect={(dateStr) => {
                                    try {
                                        const d = new Date(dateStr);
                                        const now = new Date();
                                        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                                        const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
                                        const sel = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                                        const label = sel.getTime() === today.getTime() ? "Today"
                                            : sel.getTime() === yesterday.getTime() ? "Yesterday"
                                            : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
                                        setRevenueCardDay(dateStr);
                                        setRevenueCardDayLabel(label);
                                        const from = new Date(dateStr);
                                        from.setHours(0, 0, 0, 0);
                                        const to = new Date(dateStr);
                                        to.setHours(23, 59, 59, 999);
                                        setActiveRange("custom");
                                        setDate({ from, to });
                                        setFetchTrigger(t => t + 1);
                                    } catch { /* ignore */ }
                                }}
                                topCustomers={topCustomers}
                            />
                        </div>

                        {/* Top Menu Items Preview */}
                        {topMenuItems.length > 0 && (
                            <section className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-semibold text-lg">Top Menu Items</h3>
                                    <button onClick={() => setActiveTab("menu")} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 font-medium transition-colors">
                                        View all <ChevronRight className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {topMenuItems.slice(0, 6).map((item: any, i: number) => (
                                        <Card key={item.id ?? item.name ?? i} className="border-border shadow-sm hover:shadow-md transition-all">
                                            <CardContent className="p-4 flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                                                        <span className="text-xs font-black text-orange-500">#{i + 1}</span>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-semibold truncate text-sm">{item.name}</p>
                                                        <p className="text-xs text-muted-foreground">{topItemQuantitySold(item)} sold</p>
                                                    </div>
                                                </div>
                                                <p className="text-sm font-bold shrink-0">{fmtShort(item.revenue || 0)}</p>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Day Close */}
                        <section>
                            <Card
                                className="bg-card border-border shadow-sm hover:border-orange-500/30 hover:shadow-md transition-all cursor-pointer overflow-hidden"
                                onClick={() => setIsDayCloseOpen(true)}
                            >
                                <CardContent className="p-0">
                                    <div className="flex flex-col lg:flex-row lg:items-center">
                                        <div className="flex items-center gap-4 p-5 lg:p-6 flex-1">
                                            <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
                                                <ReceiptText className="w-7 h-7 text-orange-500" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h3 className="text-lg font-bold text-foreground">Day Close</h3>
                                                    <Badge variant="outline" className="border-orange-500/20 text-orange-500 bg-orange-500/5 text-[10px] uppercase tracking-wider">
                                                        Finance Action
                                                    </Badge>
                                                </div>
                                                <p className="text-sm text-muted-foreground mt-1">
                                                    Reconcile payments, expenses, and daily totals for{" "}
                                                    {new Date().toLocaleDateString()}.
                                                </p>
                                            </div>
                                        </div>
                                        <div className="border-t lg:border-t-0 lg:border-l border-border/50 bg-muted/20 px-5 py-4 lg:px-6 lg:min-w-[240px] flex items-center justify-between gap-4">
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                                    Next Step
                                                </p>
                                                <p className="text-sm font-semibold text-foreground mt-1">
                                                    Open Day Close
                                                </p>
                                            </div>
                                            <div className="w-10 h-10 rounded-full bg-orange-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                                                <ChevronRight className="w-5 h-5" />
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </section>
                    </TabsContent>

                    {/* ══════════════════════════════════════════════════ ORDERS TAB */}
                    <TabsContent value="orders" className="space-y-6 outline-none">
                        {/* Live Order Pipeline */}
                        <Card className="bg-card border-border shadow-sm">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base font-bold flex items-center gap-2">
                                    <Activity className="w-4 h-4 text-emerald-500" /> Live Order
                                </CardTitle>
                                <CardDescription>Real-time order pipeline status</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <LiveOrderStat label="Completed" count={liveCompleted} icon={<Check className="w-3.5 h-3.5" />} color="text-emerald-500" bg="bg-emerald-500/10" />
                                    <LiveOrderStat label="Pending" count={livePending} icon={<Clock className="w-3.5 h-3.5" />} color="text-blue-500" bg="bg-blue-500/10" />
                                    <LiveOrderStat label="Delayed" count={liveDelayed} icon={<AlertCircle className="w-3.5 h-3.5" />} color="text-red-500" bg="bg-red-500/10" />
                                    <LiveOrderStat label="Cancelled" count={liveCanceled} icon={<X className="w-3.5 h-3.5" />} color="text-amber-500" bg="bg-amber-500/10" />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Order Summary */}
                        <section className="space-y-3">
                            <h3 className="text-base font-bold text-muted-foreground uppercase tracking-wider">Order Summary</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                                <BigMetricCard label="TOTAL ORDERS" value={totalOrdersVal} noCurrency icon={<ReceiptText className="w-4 h-4" />} color="text-blue-500" tagColor="bg-blue-500/10 text-blue-500" />
                                <BigMetricCard label="AVG ORDER VALUE" value={avgOrderVal} icon={<Activity className="w-4 h-4" />} color="text-purple-500" tagColor="bg-purple-500/10 text-purple-500" />
                                <BigMetricCard label="PEAK HOUR" value={peakHourVal} noCurrency icon={<TrendingUp className="w-4 h-4" />} color="text-pink-500" />
                                <BigMetricCard label="CANCELLATION" value={cancellationRateStr} noCurrency icon={<ArrowDownRight className="w-4 h-4" />} color="text-rose-500" />
                                <BigMetricCard label="DISCOUNTS" value={currentDiscounts} icon={<Tag className="w-4 h-4" />} color="text-amber-500" />
                                <BigMetricCard label="REFUNDS" value={currentRefunds} icon={<TrendingDown className="w-4 h-4" />} color="text-red-500" />
                            </div>
                        </section>

                        {/* Source Revenue (Orders by channel) */}
                        {sourceMixItems.length > 0 && (
                            <Card className="bg-card border-border shadow-sm">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base font-bold flex items-center gap-2">
                                        <BarChart2 className="w-4 h-4 text-blue-500" /> Order Source
                                    </CardTitle>
                                    <CardDescription>Revenue & order mix by channel</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {(() => {
                                        const total = sourceMixItems.reduce((s: number, i: any) => s + (i.amount || 0), 0);
                                        return sourceMixItems.map((item: any, idx: number) => {
                                            const pct = total > 0 ? ((item.amount || 0) / total) : 0;
                                            const colors = ["bg-orange-500", "bg-blue-500", "bg-purple-500", "bg-emerald-500", "bg-pink-500"];
                                            const color = colors[idx % colors.length];
                                            return (
                                                <div key={idx} className="space-y-1.5">
                                                    <div className="flex items-center justify-between text-xs">
                                                        <div className="flex items-center gap-2">
                                                            <div className={cn("w-2 h-2 rounded-full", color)} />
                                                            <span className="font-semibold capitalize">{item.label || item.source || item.method || "Unknown"}</span>
                                                            <span className="text-muted-foreground">({item.count || 0} orders)</span>
                                                        </div>
                                                        <span className="font-bold">{fmtShort(item.amount || 0)}</span>
                                                    </div>
                                                    <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                                                        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${(pct * 100).toFixed(1)}%` }} />
                                                    </div>
                                                </div>
                                            );
                                        });
                                    })()}
                                </CardContent>
                            </Card>
                        )}

                        {/* Charts and breakdown */}
                        <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
                            <div className="lg:col-span-4 min-w-0">
                                <RevenueChart
                                    data={trendsData}
                                    loading={loading}
                                    hourlyData={trendsChart.hourly}
                                    title="Hourly Orders & Revenue Distribution"
                                />
                            </div>
                            <div className="lg:col-span-3 min-w-0">
                                <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden flex flex-col">
                                    <div className="p-4 border-b border-border flex flex-col sm:flex-row justify-between items-center gap-4">
                                        <div>
                                            <h3 className="font-semibold text-lg">{pieCopy.title}</h3>
                                            <p className="text-sm text-muted-foreground mt-0.5">{pieCopy.description}</p>
                                        </div>
                                        <div className="flex bg-muted p-1 rounded-lg text-xs">
                                            {(['source', 'payment', 'category'] as const).map((type) => (
                                                <button key={type} onClick={() => setBreakdownType(type)} className={`px-3 py-1.5 rounded-md capitalize transition-all ${breakdownType === type ? 'bg-background text-foreground shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'}`}>
                                                    {type === 'source' ? 'channel' : type === 'category' ? 'menu' : type}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="p-4 min-w-0">
                                        <CategoryPieChart embedded data={categoryData} loading={loading} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Top Selling Items */}
                        {ordersTopItems.length > 0 && (
                            <Card className="bg-card border-border shadow-sm">
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-base font-bold flex items-center gap-2">
                                            <Star className="w-4 h-4 text-amber-500" /> Top Selling Items
                                        </CardTitle>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        {ordersTopItems.slice(0, 5).map((item: any, i: number) => (
                                            <TopItemRow key={i} rank={i + 1} name={item.name} qty={item.quantity_sold || item.quantitySold || item.qty || 0} revenue={item.revenue || 0} maxRevenue={ordersTopItems[0]?.revenue || 1} />
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Top Tables & Top Customers */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {topSellingTables.length > 0 && (
                                <Card className="bg-card border-border shadow-sm">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-base font-bold flex items-center gap-2">
                                            <LayoutGrid className="w-4 h-4 text-purple-500" /> Top Tables
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-2">
                                            {topSellingTables.slice(0, 5).map((table: any, i: number) => (
                                                <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/20 last:border-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-6 h-6 rounded-md bg-purple-500/10 flex items-center justify-center text-[10px] font-black text-purple-500">#{i+1}</span>
                                                        <span className="font-semibold text-sm">{table.table_name || table.name || `Table ${table.table_id || i+1}`}</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-xs font-bold">{fmtShort(table.amount || 0)}</p>
                                                        <p className="text-[10px] text-muted-foreground">{table.orders_count || 0} orders</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                            {topCustomers.length > 0 && (
                                <Card className="bg-card border-border shadow-sm">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-base font-bold flex items-center gap-2">
                                            <Users className="w-4 h-4 text-blue-500" /> Top Customers
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-2">
                                            {topCustomers.slice(0, 5).map((cust: any, i: number) => (
                                                <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/20 last:border-0">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-7 h-7 rounded-full bg-blue-500/10 flex items-center justify-center text-[11px] font-black text-blue-500">
                                                            {String(cust.name || cust.customer_name || "?").slice(0, 1).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold text-sm truncate max-w-[120px]">{cust.name || cust.customer_name || "Unknown"}</p>
                                                            <p className="text-[10px] text-muted-foreground">{cust.orders_count || cust.visits || 0} orders</p>
                                                        </div>
                                                    </div>
                                                    <p className="text-xs font-bold">{fmtShort(cust.amount || cust.total_spent || 0)}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </TabsContent>

                    {/* ══════════════════════════════════════════════════ FINANCE TAB */}
                    <TabsContent value="finance" className="space-y-6 outline-none">
                        {/* Finance Summary Cards */}
                        <section className="space-y-3">
                            <h3 className="text-base font-bold text-muted-foreground uppercase tracking-wider">Finance Summary</h3>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                <BigMetricCard label="Gross Income" value={v2?.grossIncome ?? currentIncome} icon={<Wallet className="w-4.5 h-4.5" />} color="text-emerald-500" trend={v2?.grossIncomeDelta ?? compIncomeDelta} tagColor={Number(v2?.grossIncomeDelta ?? compIncomeDelta) >= 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"} />
                                <BigMetricCard label="Expenses" value={v2?.totalExpense ?? currentExpense} icon={<TrendingDown className="w-4.5 h-4.5" />} color="text-red-500" trend={v2?.totalExpenseDelta ?? compExpenseDelta} tagColor={Number(v2?.totalExpenseDelta ?? compExpenseDelta) <= 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"} />
                                <BigMetricCard label="Discount" value={v2?.discount ?? currentDiscounts} icon={<Tag className="w-4.5 h-4.5" />} color="text-amber-500" trend={v2?.discountDelta} tagColor="bg-amber-500/10 text-amber-500" />
                                <BigMetricCard label="Net Profit" value={v2?.netProfit ?? currentProfit} icon={<TrendingUp className="w-4.5 h-4.5" />} color="text-blue-500" trend={v2?.netProfitDelta ?? compProfitDelta} tagColor={Number(v2?.netProfitDelta ?? compProfitDelta) >= 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"} />
                            </div>
                        </section>

                        {/* Receivables */}
                        <Card className="bg-card border-border shadow-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base font-bold flex items-center gap-2">
                                    <CreditCard className="w-4 h-4 text-blue-500" /> Receivables
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="bg-muted/40 border border-border/40 rounded-xl p-3.5 flex flex-col gap-1">
                                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Credit Sales</span>
                                        <span className="text-lg font-bold text-foreground">{fmtShort(receivables.credit_sales ?? 0)}</span>
                                        <span className="text-[9px] text-muted-foreground font-medium">{receivables.credit_orders_count ?? 0} credit orders</span>
                                    </div>
                                    <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-3.5 flex flex-col gap-1">
                                        <span className="text-[10px] font-black text-red-500 uppercase tracking-wider">Outstanding</span>
                                        <span className="text-lg font-bold text-foreground">{fmtShort(receivables.total_outstanding ?? 0)}</span>
                                        <span className="text-[9px] text-muted-foreground font-medium">Unpaid credit bills</span>
                                    </div>
                                    <div className="bg-muted/40 border border-border/40 rounded-xl p-3.5 flex flex-col gap-1">
                                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Cash vs Credit</span>
                                        <span className="text-lg font-bold text-foreground">
                                            {grossSalesVal > 0 ? `${Math.round(((receivables.credit_sales ?? 0) / grossSalesVal) * 100)}%` : "0%"}
                                        </span>
                                        <span className="text-[9px] text-muted-foreground font-medium">of sales on credit</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Non-Chargeable (NC) Snapshot */}
                        {ncTotalItems > 0 && (
                            <Card className="bg-card border-border shadow-sm">
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-base font-bold flex items-center gap-2">
                                            <Utensils className="w-4 h-4 text-orange-500" /> Non-Chargeable (NC) Given
                                        </CardTitle>
                                        <div className="text-right">
                                            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Total Value</p>
                                            <p className="text-lg font-black text-foreground">Rs. {Number(ncTotalValue).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                        </div>
                                    </div>
                                    <CardDescription>Complimentary items are tracked separately from billable analytics.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                                        <div className="bg-muted/40 border border-border/40 rounded-xl p-3.5 flex flex-col gap-1">
                                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">NC Items</span>
                                            <span className="text-lg font-bold text-foreground">{fmtCount(ncTotalItems)}</span>
                                        </div>
                                        <div className="bg-muted/40 border border-border/40 rounded-xl p-3.5 flex flex-col gap-1">
                                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">NC Orders</span>
                                            <span className="text-lg font-bold text-foreground">{fmtCount(ncOrdersCount)}</span>
                                        </div>
                                        <div className="bg-muted/40 border border-border/40 rounded-xl p-3.5 flex flex-col gap-1">
                                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Customers</span>
                                            <span className="text-lg font-bold text-foreground">{fmtCount(ncCustomersCount)}</span>
                                        </div>
                                        <div className="bg-orange-500/5 border border-orange-500/10 rounded-xl p-3.5 flex flex-col gap-1">
                                            <span className="text-[10px] font-black text-orange-500 uppercase tracking-wider">Track Details</span>
                                            <Button
                                                variant="outline"
                                                className="h-8 px-3 mt-1 text-xs font-semibold"
                                                onClick={() => setActiveTab("nc")}
                                            >
                                                Open NC Tab
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        <div className="space-y-4">
                                            <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Top NC Items</h4>
                                            <div className="space-y-2">
                                                {ncTopItems.slice(0, 5).map((item: any, i: number) => (
                                                    <div key={`${item.item_id}-${i}`} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded-md bg-orange-500/10 flex items-center justify-center text-[10px] font-black text-orange-500">
                                                                #{i + 1}
                                                            </div>
                                                            <span className="font-semibold text-sm truncate max-w-[150px]">{item.name}</span>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-xs font-bold">Rs. {Number(item.value).toLocaleString()}</p>
                                                            <p className="text-[10px] text-muted-foreground">{item.qty} items</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Top Customers With NC</h4>
                                            <div className="space-y-2">
                                                {ncTopCustomers.slice(0, 5).map((customer: any, i: number) => (
                                                    <div key={`${customer.customer_id}-${i}`} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center text-[10px] font-black text-blue-500">
                                                                {(customer.name || "?").slice(0, 1).toUpperCase()}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <span className="font-semibold text-sm truncate block max-w-[150px]">{customer.name}</span>
                                                                <span className="text-[10px] text-muted-foreground">{customer.phone || "No phone"}</span>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-xs font-bold">Rs. {Number(customer.value).toLocaleString()}</p>
                                                            <p className="text-[10px] text-muted-foreground">{customer.orders_count} orders • {customer.qty} items</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="mt-6 pt-4 border-t border-border/30">
                                        <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Recent NC Orders</h4>
                                        <div className="max-h-60 overflow-y-auto pr-2 space-y-1">
                                            {ncRecentOrders.slice(0, 5).map((row: any, i: number) => {
                                                const d = new Date(row.created_at);
                                                const timeStr = d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                                return (
                                                    <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/30 transition-colors">
                                                        <div className="flex flex-col min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-semibold text-sm truncate">{row.customer_name || "Walk-in / Unknown"}</span>
                                                                <Link href={row.order_route || `/orders/${row.order_id}`} target="_blank" className="text-[10px] text-blue-500 hover:underline">
                                                                    #{row.restaurant_order_id || row.order_id}
                                                                </Link>
                                                            </div>
                                                            <span className="text-[10px] text-muted-foreground">{timeStr} • {row.nc_items_count} NC items • {row.table_name || row.channel}</span>
                                                        </div>
                                                        <span className="text-xs font-bold">Rs. {Number(row.nc_total_value).toLocaleString()}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Income vs Expense Chart */}
                        <RevenueTrendsCard data={incomeVsExpenseData.length > 0 ? incomeVsExpenseData : revenueTrendsData} loading={loading} activeRange={activeRange} title="Income vs Expense" />

                        {/* Period Comparison */}
                        <Card className="bg-card border-border shadow-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base font-bold flex items-center gap-2">
                                    <ArrowLeftRight className="w-4 h-4 text-orange-500" /> Period Comparison
                                </CardTitle>
                                <CardDescription>Comparison with preceding period of identical length</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {[
                                    { label: "Income", val: currentIncome, delta: compIncomeDelta, positive: Number(compIncomeDelta) >= 0 },
                                    { label: "Expense", val: currentExpense, delta: compExpenseDelta, positive: Number(compExpenseDelta) <= 0 },
                                    { label: "Profit", val: currentProfit, delta: compProfitDelta, positive: Number(compProfitDelta) >= 0 },
                                ].map((row) => (
                                    <div key={row.label} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                                        <span className="text-sm font-semibold text-muted-foreground">{row.label}</span>
                                        <div className="flex items-center gap-4">
                                            <span className="text-sm font-bold">{fmtShort(row.val)}</span>
                                            <Badge className={cn("text-[10px] font-bold px-2 py-0.5", row.positive ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500")}>
                                                {Number(row.delta) >= 0 ? "+" : ""}{Number(row.delta).toFixed(1)}%
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>

                        {/* Payment Methods (also in Finance) */}
                        <PaymentMethodsBreakdownCard expandedMethods={expandedPaymentMethods} />
                    </TabsContent>

                    {/* ══════════════════════════════════════════════════ NC TAB */}
                    <TabsContent value="nc" className="space-y-6 outline-none">
                        <section className="space-y-3">
                            <h3 className="text-base font-bold text-muted-foreground uppercase tracking-wider">NC Summary</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                                <BigMetricCard label="NC Value" value={ncTotalValue} icon={<Tag className="w-4.5 h-4.5" />} color="text-orange-500" />
                                <BigMetricCard label="NC Items" value={ncTotalItems} noCurrency icon={<Utensils className="w-4.5 h-4.5" />} color="text-blue-500" />
                                <BigMetricCard label="NC Orders" value={ncOrdersCount} noCurrency icon={<ReceiptText className="w-4.5 h-4.5" />} color="text-emerald-500" />
                                <BigMetricCard label="Customers" value={ncCustomersCount} noCurrency icon={<Users className="w-4.5 h-4.5" />} color="text-violet-500" />
                            </div>
                        </section>

                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                            <Card className="bg-card border-border shadow-sm xl:col-span-1">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base font-bold flex items-center gap-2">
                                        <Utensils className="w-4 h-4 text-orange-500" /> Top NC Items
                                    </CardTitle>
                                    <CardDescription>Highest complimentary value items in the selected period</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {ncTopItems.length > 0 ? ncTopItems.map((item: any, i: number) => (
                                        <div key={`${item.item_id}-${i}`} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
                                            <div className="min-w-0">
                                                <div className="font-semibold text-sm truncate">{item.name}</div>
                                                <div className="text-[10px] text-muted-foreground">{fmtCount(item.qty)} items</div>
                                            </div>
                                            <div className="text-xs font-bold">{fmtShort(item.value)}</div>
                                        </div>
                                    )) : <div className="text-sm text-muted-foreground">No NC items in this window.</div>}
                                </CardContent>
                            </Card>

                            <Card className="bg-card border-border shadow-sm xl:col-span-1">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base font-bold flex items-center gap-2">
                                        <UserCheck className="w-4 h-4 text-blue-500" /> Top Customers
                                    </CardTitle>
                                    <CardDescription>Customers who received the most NC value</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {ncTopCustomers.length > 0 ? ncTopCustomers.map((customer: any, i: number) => (
                                        <div key={`${customer.customer_id}-${i}`} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
                                            <div className="min-w-0">
                                                <div className="font-semibold text-sm truncate">{customer.name}</div>
                                                <div className="text-[10px] text-muted-foreground">{customer.phone || "No phone"} • {customer.orders_count} orders</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xs font-bold">{fmtShort(customer.value)}</div>
                                                <div className="text-[10px] text-muted-foreground">{fmtCount(customer.qty)} items</div>
                                            </div>
                                        </div>
                                    )) : <div className="text-sm text-muted-foreground">No customer-linked NC activity yet.</div>}
                                </CardContent>
                            </Card>

                            <Card className="bg-card border-border shadow-sm xl:col-span-1">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base font-bold flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-emerald-500" /> NC Trend
                                    </CardTitle>
                                    <CardDescription>Daily NC movement in the selected range</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {ncTrend.length > 0 ? ncTrend.map((row: any, i: number) => (
                                        <div key={`${row.label}-${i}`} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
                                            <div>
                                                <div className="font-semibold text-sm">{row.label}</div>
                                                <div className="text-[10px] text-muted-foreground">{row.orders_count} orders • {row.qty} items</div>
                                            </div>
                                            <div className="text-xs font-bold">{fmtShort(row.value)}</div>
                                        </div>
                                    )) : <div className="text-sm text-muted-foreground">No NC trend data in this window.</div>}
                                </CardContent>
                            </Card>
                        </div>

                        <Card className="bg-card border-border shadow-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base font-bold flex items-center gap-2">
                                    <ReceiptText className="w-4 h-4 text-orange-500" /> NC Order History
                                </CardTitle>
                                <CardDescription>Deep drilldown of orders where complimentary items were given</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {ncOrdersLoading ? (
                                    <div className="text-sm text-muted-foreground">Loading NC order history...</div>
                                ) : ncOrdersList.length > 0 ? (
                                    <>
                                        <div className="rounded-xl border border-border/50 overflow-hidden">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Order</TableHead>
                                                        <TableHead>Customer</TableHead>
                                                        <TableHead>Date</TableHead>
                                                        <TableHead>NC Items</TableHead>
                                                        <TableHead>NC Value</TableHead>
                                                        <TableHead>Receipt</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {ncOrdersList.map((order: any) => (
                                                        <TableRow key={order.order_id}>
                                                            <TableCell>
                                                                <div className="flex flex-col">
                                                                    <Link href={order.order_route || `/orders/${order.order_id}`} className="font-semibold text-blue-500 hover:underline">
                                                                        #{order.restaurant_order_id || order.order_id}
                                                                    </Link>
                                                                    <span className="text-[11px] text-muted-foreground">{order.table_name || order.channel}</span>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="flex flex-col">
                                                                    <span className="font-medium">{order.customer_name || "Walk-in / Unknown"}</span>
                                                                    <span className="text-[11px] text-muted-foreground">{order.customer_phone || "No phone"}</span>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="flex flex-col">
                                                                    <span className="font-medium">
                                                                        {new Date(order.created_at).toLocaleDateString()}
                                                                    </span>
                                                                    <span className="text-[11px] text-muted-foreground">
                                                                        {new Date(order.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                                    </span>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="flex flex-col gap-1">
                                                                    <span className="font-medium">{fmtCount(order.nc_items_count)}</span>
                                                                    <div className="text-[11px] text-muted-foreground">
                                                                        {(order.items || []).slice(0, 2).map((item: any) => item.name).join(", ")}
                                                                        {(order.items || []).length > 2 ? "..." : ""}
                                                                    </div>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="font-semibold">{fmt(order.nc_total_value)}</TableCell>
                                                            <TableCell>
                                                                <div className="flex gap-2">
                                                                    <Link href={order.order_route || `/orders/${order.order_id}`}>
                                                                        <Button variant="outline" size="sm" className="h-8 text-xs">Order</Button>
                                                                    </Link>
                                                                    <Link href={order.receipt_route || `/orders/${order.order_id}/checkout`}>
                                                                        <Button variant="outline" size="sm" className="h-8 text-xs">Receipt</Button>
                                                                    </Link>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <div className="text-xs text-muted-foreground">
                                                Showing page {ncOrdersPage} of {ncOrdersTotalPages} • {fmtCount(ncOrdersTotal)} NC orders total
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8 text-xs"
                                                    disabled={ncOrdersPage <= 1}
                                                    onClick={() => setNcOrdersPage((p) => Math.max(1, p - 1))}
                                                >
                                                    Previous
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8 text-xs"
                                                    disabled={!ncOrdersHasMore}
                                                    onClick={() => setNcOrdersPage((p) => p + 1)}
                                                >
                                                    Next
                                                </Button>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-sm text-muted-foreground">No NC order history found for the selected period.</div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ══════════════════════════════════════════════════ MENU TAB */}
                    <TabsContent value="menu" className="space-y-6 outline-none">
                        {/* Menu Hero Card */}
                        {menuSnapshotTopItem && (
                            <Card className="bg-card border-border shadow-sm overflow-hidden">
                                <div className="bg-gradient-to-r from-orange-500/10 to-transparent p-5">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
                                            <Utensils className="w-5 h-5 text-orange-500" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg">Menu Performance</h3>
                                            <p className="text-sm text-muted-foreground">Sales ranking and item movement</p>
                                        </div>
                                    </div>
                                    <div className="bg-background/60 border border-border/40 rounded-xl p-4 mb-4">
                                        <p className="text-xs font-bold text-orange-500 uppercase tracking-wider mb-2">Best Seller</p>
                                        <p className="text-2xl font-bold truncate">{menuSnapshotTopItem.name}</p>
                                        {menuSnapshotTopItem.category && <p className="text-sm text-muted-foreground mt-1">{menuSnapshotTopItem.category}</p>}
                                    </div>
                                    <div className="grid grid-cols-3 gap-3">
                                        <HeroMetric label="Revenue" value={fmtShort(menuSnapshotTopItem.revenue || 0)} />
                                        <HeroMetric label="Sold" value={fmtCount(menuSnapshotTopItem.quantity_sold || menuSnapshotTopItem.quantitySold || 0)} />
                                        <HeroMetric label="Avg Price" value={fmtShort(menuSnapshotTopItem.avg_price || menuSnapshotTopItem.avgPrice || 0)} />
                                    </div>
                                </div>
                            </Card>
                        )}

                        {/* Menu Summary Cards */}
                        {menuSummaryMetrics.length > 0 && (
                            <section className="space-y-3">
                                <h3 className="text-base font-bold text-muted-foreground uppercase tracking-wider">Menu Summary</h3>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                    <MenuSummaryCards metrics={menuSummaryMetrics} topItems={menuTopItems} />
                                </div>
                            </section>
                        )}

                        {/* Top Selling Items */}
                        {menuTopItems.length > 0 && (
                            <Card className="bg-card border-border shadow-sm">
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-base font-bold flex items-center gap-2">
                                            <Star className="w-4 h-4 text-amber-500" /> Top Selling Items
                                        </CardTitle>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        {menuTopItems.slice(0, 8).map((item: any, i: number) => (
                                            <TopItemRow key={i} rank={i + 1} name={item.name} qty={item.quantity_sold || item.quantitySold || item.qty || 0} revenue={item.revenue || 0} maxRevenue={menuTopItems[0]?.revenue || 1} />
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Low Performing Items */}
                        {menuLowItems.length > 0 && (
                            <Card className="bg-card border-border shadow-sm">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base font-bold flex items-center gap-2">
                                        <TrendingDown className="w-4 h-4 text-red-500" /> Low Performing Items
                                    </CardTitle>
                                    <CardDescription>Items with low sales volume in the selected period</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        {menuLowItems.slice(0, 5).map((item: any, i: number) => (
                                            <div key={i} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <div className="w-6 h-6 rounded-md bg-red-500/10 flex items-center justify-center shrink-0">
                                                        <TrendingDown className="w-3 h-3 text-red-500" />
                                                    </div>
                                                    <span className="font-medium text-sm truncate">{item.name}</span>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <p className="text-xs font-bold">{fmtShort(item.revenue || 0)}</p>
                                                    <p className="text-[10px] text-muted-foreground">{item.quantity_sold || item.quantitySold || 0} sold</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Full Menu Details Table */}
                        <Card className="bg-card border-border shadow-sm">
                            <CardHeader className="pb-3">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <CardTitle className="text-base font-bold flex items-center gap-2">
                                        <Package className="w-4 h-4 text-muted-foreground" /> All Items
                                    </CardTitle>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            placeholder="Search items..."
                                            value={menuSearch}
                                            onChange={(e) => { setMenuSearch(e.target.value); setMenuPage(1); }}
                                            className="h-8 w-[160px] text-xs rounded-lg"
                                        />
                                        <Select value={menuCategory || "all"} onValueChange={(v) => { setMenuCategory(v === "all" ? "" : v); setMenuPage(1); }}>
                                            <SelectTrigger className="h-8 rounded-lg text-xs w-[130px]"><SelectValue placeholder="All Categories" /></SelectTrigger>
                                            <SelectContent className="rounded-xl">
                                                <SelectItem value="all">All Categories</SelectItem>
                                                {menuCategories.map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <Select value={menuSortBy} onValueChange={(v) => { setMenuSortBy(v); setMenuPage(1); }}>
                                            <SelectTrigger className="h-8 rounded-lg text-xs w-[110px]"><SelectValue /></SelectTrigger>
                                            <SelectContent className="rounded-xl">
                                                <SelectItem value="revenue">By Revenue</SelectItem>
                                                <SelectItem value="quantity">By Qty Sold</SelectItem>
                                                <SelectItem value="name">By Name</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {menuLoading ? (
                                    <div className="space-y-2">
                                        {[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-muted/40 animate-pulse rounded-lg" />)}
                                    </div>
                                ) : (menuData?.items || []).length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground text-sm">
                                        {activeTab === "menu" ? "No menu data for selected period" : "Switch to Menu tab to load data"}
                                    </div>
                                ) : (
                                    <div className="rounded-xl border border-border overflow-hidden">
                                        <Table>
                                            <TableHeader className="bg-muted/40">
                                                <TableRow>
                                                    <TableHead className="w-[40px]">#</TableHead>
                                                    <TableHead>Item</TableHead>
                                                    <TableHead>Category</TableHead>
                                                    <TableHead className="text-right">Qty Sold</TableHead>
                                                    <TableHead className="text-right">Revenue</TableHead>
                                                    <TableHead className="text-right">Avg Price</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {(menuData?.items || []).map((item: any, i: number) => (
                                                    <TableRow key={item.id ?? i} className="hover:bg-muted/10">
                                                        <TableCell className="text-muted-foreground text-xs font-medium">{(menuPage - 1) * menuPageSize + i + 1}</TableCell>
                                                        <TableCell className="font-semibold">{item.name}</TableCell>
                                                        <TableCell className="text-xs text-muted-foreground">{item.category || "—"}</TableCell>
                                                        <TableCell className="text-right font-medium">{fmtCount(item.quantity_sold || item.quantitySold || 0)}</TableCell>
                                                        <TableCell className="text-right font-semibold">{fmtShort(item.revenue || 0)}</TableCell>
                                                        <TableCell className="text-right text-muted-foreground text-xs">{fmtShort(item.avg_price || item.avgPrice || 0)}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                                {(menuData?.total_pages || 0) > 1 && (
                                    <div className="flex items-center justify-between mt-4 text-xs text-muted-foreground">
                                        <span>Page {menuPage} of {menuData.total_pages}</span>
                                        <div className="flex gap-2">
                                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setMenuPage(p => Math.max(1, p - 1))} disabled={menuPage === 1}>Prev</Button>
                                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setMenuPage(p => p + 1)} disabled={menuPage >= menuData.total_pages}>Next</Button>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ══════════════════════════════════════════════════ STAFF TAB */}
                    <TabsContent value="staff" className="space-y-6 outline-none">
                        {/* Staff Hero Card */}
                        {(topStaff?.name || staffTopPerformer?.name) && (
                            <Card className="bg-card border-border shadow-sm overflow-hidden">
                                <div className="bg-gradient-to-r from-blue-500/10 to-transparent p-5">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                                            <UserCheck className="w-5 h-5 text-blue-500" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg">Staff Performance</h3>
                                            <p className="text-sm text-muted-foreground">Revenue and order ownership</p>
                                        </div>
                                    </div>
                                    <div className="bg-background/60 border border-border/40 rounded-xl p-4 mb-4">
                                        <p className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-2">Top Performer</p>
                                        <p className="text-2xl font-bold">{topStaff?.name || staffTopPerformer?.name}</p>
                                    </div>
                                    <div className="grid grid-cols-3 gap-3">
                                        <HeroMetric label="Revenue" value={fmtShort(topStaff?.revenue || staffTopPerformer?.revenue || 0)} />
                                        <HeroMetric label="Orders" value={fmtCount(topStaff?.orders_count || topStaff?.orders || staffTopPerformer?.orders_count || 0)} />
                                        <HeroMetric label="Avg Order" value={fmtShort(topStaff?.avg_order_value || staffTopPerformer?.avg_order_value || 0)} />
                                    </div>
                                </div>
                            </Card>
                        )}

                        {/* Staff Summary Cards */}
                        <section className="space-y-3">
                            <h3 className="text-base font-bold text-muted-foreground uppercase tracking-wider">Staff Summary</h3>
                            <StaffSummaryCards leaderboard={staffLeaderboard} topPerformer={staffTopPerformer} />
                        </section>

                        {/* Staff Ranking */}
                        <Card className="bg-card border-border shadow-sm">
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base font-bold flex items-center gap-2">
                                        <Award className="w-4 h-4 text-amber-500" /> Staff Ranking
                                    </CardTitle>
                                    <Badge variant="outline" className="text-xs font-bold">{staffLeaderboard.length} staff</Badge>
                                </div>
                                <CardDescription>Ranked by revenue in selected range</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {staffLeaderboard.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground text-sm">No staff analytics available for this period</div>
                                ) : (
                                    <div className="space-y-3">
                                        {staffLeaderboard.slice(0, 10).map((staff: any, i: number) => {
                                            const maxRev = staffLeaderboard[0]?.revenue || 1;
                                            const progress = maxRev > 0 ? ((staff.revenue || 0) / maxRev) : 0;
                                            const rankColor = i === 0 ? "text-amber-400 bg-amber-400/15 border-amber-400/30" : i === 1 ? "text-slate-400 bg-slate-400/15 border-slate-400/30" : i === 2 ? "text-orange-700 bg-orange-700/15 border-orange-700/30" : "text-muted-foreground bg-muted/40 border-border";
                                            return (
                                                <div key={staff.id ?? i} className="bg-card border border-border rounded-xl p-3 space-y-2">
                                                    <div className="flex items-center gap-3">
                                                        <div className={cn("w-8 h-8 rounded-lg border flex items-center justify-center text-xs font-black shrink-0", rankColor)}>
                                                            #{i + 1}
                                                        </div>
                                                        <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center shrink-0">
                                                            <span className="text-xs font-bold text-foreground">{String(staff.name || "?").slice(0,1).toUpperCase()}</span>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-semibold text-sm truncate">{staff.name || "Unknown"}</p>
                                                            <p className="text-[10px] text-muted-foreground">{staff.orders_count || staff.orders || 0} orders</p>
                                                        </div>
                                                        <div className="text-right shrink-0">
                                                            <p className="text-sm font-bold">{fmtShort(staff.revenue || 0)}</p>
                                                            <p className="text-[10px] text-muted-foreground">Avg: {fmtShort(staff.avg_order_value || 0)}</p>
                                                        </div>
                                                    </div>
                                                    <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                                                        <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${(progress * 100).toFixed(1)}%` }} />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Staff details from dedicated API */}
                        {staffData?.items?.length > 0 && (
                            <Card className="bg-card border-border shadow-sm">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base font-bold flex items-center gap-2">
                                        <Users className="w-4 h-4 text-muted-foreground" /> Detailed Staff Analytics
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="rounded-xl border border-border overflow-hidden">
                                        <Table>
                                            <TableHeader className="bg-muted/40">
                                                <TableRow>
                                                    <TableHead className="w-[40px]">#</TableHead>
                                                    <TableHead>Staff</TableHead>
                                                    <TableHead className="text-right">Orders</TableHead>
                                                    <TableHead className="text-right">Revenue</TableHead>
                                                    <TableHead className="text-right">Avg Order</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {staffData.items.map((staff: any, i: number) => (
                                                    <TableRow key={staff.id ?? i} className="hover:bg-muted/10">
                                                        <TableCell className="text-muted-foreground text-xs font-medium">{(staffPage - 1) * staffPageSize + i + 1}</TableCell>
                                                        <TableCell className="font-semibold">{staff.name || staff.staff_name || "Unknown"}</TableCell>
                                                        <TableCell className="text-right font-medium">{fmtCount(staff.orders_count || staff.orders || 0)}</TableCell>
                                                        <TableCell className="text-right font-semibold">{fmtShort(staff.revenue || 0)}</TableCell>
                                                        <TableCell className="text-right text-muted-foreground text-xs">{fmtShort(staff.avg_order_value || 0)}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>
                </Tabs>
            )}

            {user?.restaurant_id && (
                <DayCloseModal
                    isOpen={isDayCloseOpen}
                    onClose={() => setIsDayCloseOpen(false)}
                    restaurantId={user.restaurant_id}
                    businessLine={businessLine as any}
                />
            )}
        </div>
    );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function SnapshotCard({ label, value, icon, color, bgColor, borderColor }: any) {
    return (
        <Card className={cn("border bg-card overflow-hidden relative group shadow-sm transition-all duration-300 hover:shadow-md", borderColor)}>
            <div className={cn("absolute top-0 left-0 w-[4px] h-full opacity-70", color.replace('text-', 'bg-'))} />
            <div className={cn("absolute inset-0 opacity-5 group-hover:opacity-10 transition-opacity duration-300", bgColor)} />
            <CardContent className="p-6 relative z-10">
                <div className="flex justify-between items-start mb-4">
                    <div className={cn("p-2.5 rounded-xl", bgColor)}>
                        <div className={cn("transition-transform duration-300 group-hover:scale-110", color)}>{icon}</div>
                    </div>
                </div>
                <div className="text-[10px] font-black tracking-widest mb-1.5 uppercase opacity-60 text-muted-foreground">{label}</div>
                <div className="text-2xl font-black text-foreground tracking-tight">Rs. {Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </CardContent>
        </Card>
    );
}

function BigMetricCard({ label, value, trend, icon, color, tagColor, noCurrency }: any) {
    const hasTrend = trend !== undefined && trend !== null && trend !== 0;
    return (
        <Card className="bg-card border-border hover:shadow-md transition-all duration-300 shadow-sm relative overflow-hidden group">
            <div className={cn("absolute bottom-0 left-0 w-full h-[3px] opacity-0 group-hover:opacity-100 transition-opacity", color.replace('text-', 'bg-'))} />
            <CardContent className="p-5 flex flex-col justify-between h-36">
                <div className="flex justify-between items-start">
                    <div className={cn("p-2 rounded-xl bg-muted border border-border transition-transform duration-300 group-hover:scale-110", color)}>{icon}</div>
                    {hasTrend && (
                        <Badge variant="outline" className={cn("border-0 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5", tagColor)}>
                            {Number(trend) >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                            {Math.abs(Number(trend)).toFixed(1)}%
                        </Badge>
                    )}
                </div>
                <div>
                    <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1 opacity-70">{label}</div>
                    <div className="text-xl font-black text-foreground tracking-tight">
                        {noCurrency ? value : `Rs. ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function LiveOrderStat({ label, count, icon, color, bg }: any) {
    return (
        <div className={cn("flex flex-col items-center gap-2 rounded-xl p-4 border", bg, "border-transparent")}>
            <div className={cn("p-2 rounded-lg", bg)}>
                <div className={cn(color)}>{icon}</div>
            </div>
            <span className="text-2xl font-black">{count}</span>
            <span className="text-xs text-muted-foreground font-semibold">{label}</span>
        </div>
    );
}

function TopItemRow({ rank, name, qty, revenue, maxRevenue }: { rank: number; name: string; qty: number; revenue: number; maxRevenue: number }) {
    const pct = maxRevenue > 0 ? Math.min((revenue / maxRevenue) * 100, 100) : 0;
    return (
        <div className="space-y-1.5">
            <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-muted flex items-center justify-center text-[10px] font-black text-muted-foreground shrink-0">#{rank}</span>
                <span className="font-semibold text-sm flex-1 truncate">{name}</span>
                <span className="text-xs text-muted-foreground shrink-0">{qty} sold</span>
                <span className="text-sm font-bold shrink-0">Rs. {Number(revenue).toLocaleString()}</span>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden ml-7">
                <div className="h-full rounded-full bg-orange-500 transition-all" style={{ width: `${pct.toFixed(1)}%` }} />
            </div>
        </div>
    );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
    return (
        <div className="bg-background/60 border border-border/40 rounded-xl p-3">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
            <p className="text-sm font-bold truncate">{value}</p>
        </div>
    );
}

function MenuSummaryCards({ metrics, topItems }: { metrics: any[]; topItems: any[] }) {
    const getVal = (keys: string[]) => {
        for (const key of keys) {
            const m = metrics.find((m: any) => m?.key === key);
            if (m && typeof m.value === 'number') return m.value;
        }
        return 0;
    };

    const menuRevenue = getVal(["menu_revenue", "sales", "income"]);
    const soldQty = topItems.reduce((s: number, i: any) => s + (i.quantity_sold || i.quantitySold || 0), 0);
    const avgPrice = soldQty > 0 ? menuRevenue / soldQty : 0;
    const itemCount = topItems.length;

    return (
        <>
            <BigMetricCard label="Menu Revenue" value={menuRevenue} icon={<DollarSign className="w-4 h-4" />} color="text-orange-500" tagColor="bg-orange-500/10 text-orange-500" />
            <BigMetricCard label="Items Sold" value={soldQty} noCurrency icon={<ShoppingCart className="w-4 h-4" />} color="text-blue-500" tagColor="bg-blue-500/10 text-blue-500" />
            <BigMetricCard label="Avg Item Price" value={avgPrice} icon={<Tag className="w-4 h-4" />} color="text-purple-500" tagColor="bg-purple-500/10 text-purple-500" />
            <BigMetricCard label="Tracked Items" value={itemCount} noCurrency icon={<Package className="w-4 h-4" />} color="text-emerald-500" tagColor="bg-emerald-500/10 text-emerald-500" />
        </>
    );
}

function StaffSummaryCards({ leaderboard, topPerformer }: { leaderboard: any[]; topPerformer: any }) {
    const topName = leaderboard[0]?.name || topPerformer?.name || "N/A";
    const totalStaff = leaderboard.length;
    const totalOrders = leaderboard.reduce((s: number, i: any) => s + (i.orders_count || i.orders || 0), 0) || topPerformer?.orders_count || 0;
    const revenue = leaderboard.reduce((s: number, i: any) => s + (i.revenue || 0), 0) || topPerformer?.revenue || 0;
    const avgOrder = totalOrders > 0 ? revenue / totalOrders : 0;
    return (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <BigMetricCard label="Top Performer" value={topName} noCurrency icon={<Award className="w-4 h-4" />} color="text-amber-500" tagColor="bg-amber-500/10 text-amber-500" />
            <BigMetricCard label="Active Staff" value={totalStaff} noCurrency icon={<Users className="w-4 h-4" />} color="text-blue-500" tagColor="bg-blue-500/10 text-blue-500" />
            <BigMetricCard label="Staff Orders" value={totalOrders} noCurrency icon={<ReceiptText className="w-4 h-4" />} color="text-orange-500" tagColor="bg-orange-500/10 text-orange-500" />
            <BigMetricCard label="Avg Order" value={avgOrder} icon={<DollarSign className="w-4 h-4" />} color="text-purple-500" tagColor="bg-purple-500/10 text-purple-500" />
            <BigMetricCard label="Handled Revenue" value={revenue} icon={<Wallet className="w-4 h-4" />} color="text-emerald-500" tagColor="bg-emerald-500/10 text-emerald-500" />
        </div>
    );
}

function AnalyticsSkeleton() {
    return (
        <div className="flex flex-col gap-6 animate-pulse">
            <div className="h-48 bg-muted rounded-lg w-full" />
            <div className="grid grid-cols-2 gap-4">
                <div className="h-64 bg-muted rounded-lg" />
                <div className="h-64 bg-muted rounded-lg" />
            </div>
        </div>
    );
}

// ── Revenue Trends Card (mirrors Flutter _buildRevenueTrendsCard) ──────────
function RevenueTrendsCard({
    data, loading, activeRange, title = "Revenue Trends",
    onDaySelect, currentDayLabel,
}: {
    data: any[]; loading: boolean; activeRange?: string; title?: string;
    onDaySelect?: (dateStr: string) => void;
    currentDayLabel?: string;
}) {
    const [metric, setMetric] = useState<"revenue" | "expense" | "profit">("revenue");
    const [selectedDay, setSelectedDay] = useState<string>("all");

    const isHourly = useMemo(() => data.some(d => d.date && d.date.includes(":")), [data]);

    // Reset client-side day filter when data changes
    useEffect(() => { setSelectedDay("all"); }, [data]);

    const config = {
        revenue: { label: "Revenue", color: "#22c55e", gradientId: "gradRevenueTrends" },
        expense: { label: "Expense", color: "#f97316", gradientId: "gradExpenseTrends" },
        profit: { label: "Net Profit", color: "#3b82f6", gradientId: "gradProfitTrends" },
    };
    const selected = config[metric];

    // Global day options (last 14 days) — shown when isHourly (single-day view)
    // so the user can switch which day's hourly data they're viewing
    const globalDayOptions = useMemo(() => {
        if (!onDaySelect) return [];
        const now = new Date();
        const opts: { value: string; label: string }[] = [];
        for (let i = 0; i < 14; i++) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const dateStr = `${y}-${m}-${day}`;
            const label = i === 0 ? "Today" : i === 1 ? "Yesterday"
                : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
            opts.push({ value: dateStr, label });
        }
        return opts;
    }, [onDaySelect]);

    // Client-side day options — shown when data has multiple daily points
    const clientDayOptions = useMemo(() => {
        if (isHourly || data.length <= 1) return [];
        return data.map(d => d.date).filter(Boolean) as string[];
    }, [data, isHourly]);

    // Filtered data for the chart (client-side daily filter)
    const chartData = useMemo(() => {
        if (selectedDay === "all" || !selectedDay) return data;
        return data.filter(d => d.date === selectedDay);
    }, [data, selectedDay]);

    // Big number: value for selected day or total of all
    const displayTotal = useMemo(() => {
        if (selectedDay !== "all" && selectedDay) {
            const found = data.find(d => d.date === selectedDay);
            return found?.[metric] ?? 0;
        }
        return data.reduce((s, d) => s + (d[metric] ?? 0), 0);
    }, [data, metric, selectedDay]);

    // Change pct: selected day vs previous, or last vs second-to-last for all
    const changePct = useMemo(() => {
        if (selectedDay !== "all" && selectedDay) {
            const idx = data.findIndex(d => d.date === selectedDay);
            if (idx <= 0) return 0;
            const curr = data[idx]?.[metric] ?? 0;
            const prev = data[idx - 1]?.[metric] ?? 0;
            if (prev === 0) return curr === 0 ? 0 : 100;
            return ((curr - prev) / prev) * 100;
        }
        if (data.length < 2) return 0;
        const last = data[data.length - 1]?.[metric] ?? 0;
        const prev = data[data.length - 2]?.[metric] ?? 0;
        if (prev === 0) return last === 0 ? 0 : 100;
        return ((last - prev) / prev) * 100;
    }, [data, metric, selectedDay]);

    // Which "day" label to badge in the big-number (global or client-side)
    const activeDayBadge = currentDayLabel
        || (selectedDay !== "all" && selectedDay
            ? (() => { try { const d = new Date(selectedDay); return isNaN(d.getTime()) ? selectedDay : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }); } catch { return selectedDay; } })()
            : null);

    const fmtShortLocal = (n: number) => `Rs. ${Number(n || 0).toLocaleString()}`;
    const fmtDayLabel = (val: string) => {
        if (!val) return val;
        try {
            const d = new Date(val);
            if (isNaN(d.getTime())) return val;
            return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
        } catch { return val; }
    };
    const fmtLabel = (val: string) => {
        if (isHourly) return val;
        try { const d = new Date(val); if (isNaN(d.getTime())) return val; return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }); } catch { return val; }
    };

    return (
        <Card className="bg-card border-border shadow-sm">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 gap-2">
                <div>
                    <CardTitle className="text-base font-bold">{title}</CardTitle>
                    <CardDescription>{isHourly ? "Hourly progression" : "Day-wise financial progression"}</CardDescription>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                    {/* Global day picker — shown when data is hourly (single-day view) */}
                    {isHourly && globalDayOptions.length > 0 && (
                        <Select
                            value={globalDayOptions[0]?.value ?? ""}
                            onValueChange={(v) => { if (onDaySelect) onDaySelect(v); }}
                        >
                            <SelectTrigger className="h-8 rounded-lg text-xs w-[130px] border-border/60 bg-muted font-semibold gap-1">
                                <SelectValue placeholder="Today">
                                    {currentDayLabel || globalDayOptions[0]?.label || "Today"}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="rounded-xl max-h-[260px]">
                                {globalDayOptions.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                    {/* Client-side day filter — shown when data has multiple daily points */}
                    {!isHourly && clientDayOptions.length > 1 && (
                        <Select value={selectedDay} onValueChange={setSelectedDay}>
                            <SelectTrigger className="h-8 rounded-lg text-xs w-[130px] border-border/60 bg-muted font-semibold gap-1">
                                <SelectValue placeholder="All Days" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl max-h-[220px]">
                                <SelectItem value="all" className="text-xs font-semibold">All Days</SelectItem>
                                {clientDayOptions.map((day) => (
                                    <SelectItem key={day} value={day} className="text-xs">
                                        {fmtDayLabel(day)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                    {/* Metric toggle */}
                    <div className="flex bg-muted p-0.5 rounded-lg text-xs font-semibold gap-0.5">
                        {(["revenue", "expense", "profit"] as const).map((m) => (
                            <button key={m} onClick={() => setMetric(m)} className={cn("px-2.5 py-1.5 rounded-md transition-all capitalize", metric === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                                {m === "profit" ? "Profit" : m === "expense" ? "Expense" : "Revenue"}
                            </button>
                        ))}
                    </div>
                </div>
            </CardHeader>
            {/* Big number + trend badge (like Flutter) */}
            <div className="px-6 pb-2">
                <div className="bg-gradient-to-br from-card to-muted/30 border border-border/40 rounded-2xl p-4">
                    <div className="flex items-end justify-between gap-4">
                        <div>
                            <p className="text-xs text-muted-foreground font-medium mb-1 flex items-center gap-2">
                                {selected.label}
                                {activeDayBadge && (
                                    <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-bold border border-border/40">
                                        {activeDayBadge}
                                    </span>
                                )}
                            </p>
                            <p className="text-2xl font-black text-foreground">{fmtShortLocal(displayTotal)}</p>
                        </div>
                        <TrendBadge pct={changePct} />
                    </div>
                </div>
            </div>
            <CardContent className="pl-1">
                <div className="h-[200px] w-full">
                    {loading ? (
                        <div className="h-full w-full flex items-center justify-center bg-muted/20 animate-pulse rounded-md" />
                    ) : chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id={selected.gradientId} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={selected.color} stopOpacity={0.35} />
                                        <stop offset="95%" stopColor={selected.color} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.12} />
                                <XAxis dataKey="date" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} tickFormatter={fmtLabel} interval="preserveStartEnd" />
                                <YAxis stroke="#888888" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `Rs.${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`} width={55} />
                                <RechartsTooltip contentStyle={{ backgroundColor: "#1e1e1e", borderRadius: "8px", border: "none", fontSize: "11px" }} formatter={(value: any) => [`Rs. ${Number(value).toLocaleString()}`, selected.label]} labelFormatter={fmtLabel as any} />
                                <Area type="monotone" dataKey={metric} stroke={selected.color} strokeWidth={2} fillOpacity={1} fill={`url(#${selected.gradientId})`} />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full w-full flex items-center justify-center text-muted-foreground text-xs">No revenue data yet</div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

function buildRecentDayOptions() {
    const now = new Date();
    const opts: { value: string; label: string }[] = [];
    for (let i = 0; i < 14; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${day}`;
        const label = i === 0 ? "Today" : i === 1 ? "Yesterday"
            : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
        opts.push({ value: dateStr, label });
    }
    return opts;
}

// ── Performance Trends Card (mirrors Flutter _buildPerformanceTrendsCard) ──
function PerformanceTrendsCard({
    data,
    loading,
    totalOrders,
    ordersDelta,
    activeRange,
    onDaySelect,
    currentDayLabel,
}: {
    data: any[];
    loading: boolean;
    totalOrders: number;
    ordersDelta: number;
    activeRange?: string;
    onDaySelect?: (dateStr: string) => void;
    currentDayLabel?: string;
}) {
    const isHourly = useMemo(() => data.some(d => d.date && d.date.includes(":")), [data]);
    const [selectedDay, setSelectedDay] = useState<string>("all");

    useEffect(() => { setSelectedDay("all"); }, [data]);

    const globalDayOptions = useMemo(() => buildRecentDayOptions(), []);
    const clientDayOptions = useMemo(() => {
        if (isHourly || data.length <= 1) return [];
        return data.map(d => d.date).filter(Boolean) as string[];
    }, [data, isHourly]);

    const filteredData = useMemo(() => {
        if (selectedDay === "all" || !selectedDay) return data;
        return data.filter(d => d.date === selectedDay);
    }, [data, selectedDay]);

    const changePct = useMemo(() => {
        if (selectedDay !== "all" && selectedDay) {
            const idx = data.findIndex(d => d.date === selectedDay);
            if (idx <= 0) return 0;
            const curr = data[idx]?.rawOrders ?? 0;
            const prev = data[idx - 1]?.rawOrders ?? 0;
            if (prev === 0) return curr === 0 ? 0 : 100;
            return ((curr - prev) / prev) * 100;
        }
        if (filteredData.length < 2) return ordersDelta;
        const raw = filteredData.map(d => d.rawOrders ?? 0);
        const last = raw[raw.length - 1];
        const prev = raw[raw.length - 2];
        if (prev === 0) return last === 0 ? 0 : 100;
        return ((last - prev) / prev) * 100;
    }, [data, filteredData, ordersDelta, selectedDay]);

    const displayOrders = useMemo(() => {
        if (selectedDay !== "all" && selectedDay) {
            const found = data.find(d => d.date === selectedDay);
            return found?.rawOrders ?? 0;
        }
        return totalOrders;
    }, [data, selectedDay, totalOrders]);

    const activeDayBadge = currentDayLabel
        || (selectedDay !== "all" && selectedDay
            ? (() => {
                try {
                    const d = new Date(selectedDay);
                    return isNaN(d.getTime()) ? selectedDay : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
                } catch {
                    return selectedDay;
                }
            })()
            : null);

    const fmtLabel = (val: string) => {
        if (isHourly) return val;
        try { const d = new Date(val); if (isNaN(d.getTime())) return val; return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }); } catch { return val; }
    };

    return (
        <Card className="bg-card border-border shadow-sm">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-base font-bold">Performance Trends</CardTitle>
                        <CardDescription>Cumulative orders progression</CardDescription>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                        {isHourly && onDaySelect && globalDayOptions.length > 0 && (
                            <Select
                                value={globalDayOptions[0]?.value ?? ""}
                                onValueChange={(v) => onDaySelect(v)}
                            >
                                <SelectTrigger className="h-8 rounded-lg text-xs w-[130px] border-border/60 bg-muted font-semibold gap-1">
                                    <SelectValue placeholder="Today">
                                        {currentDayLabel || globalDayOptions[0]?.label || "Today"}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent className="rounded-xl max-h-[260px]">
                                    {globalDayOptions.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                        {!isHourly && clientDayOptions.length > 1 && (
                            <Select value={selectedDay} onValueChange={setSelectedDay}>
                                <SelectTrigger className="h-8 rounded-lg text-xs w-[130px] border-border/60 bg-muted font-semibold gap-1">
                                    <SelectValue placeholder="All Days" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl max-h-[220px]">
                                    <SelectItem value="all" className="text-xs font-semibold">All Days</SelectItem>
                                    {clientDayOptions.map((day) => (
                                        <SelectItem key={day} value={day} className="text-xs">
                                            {fmtLabel(day)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                </div>
            </CardHeader>
            {/* Big number + trend badge (like Flutter) */}
            <div className="px-6 pb-2">
                <div className="bg-gradient-to-br from-card to-muted/30 border border-border/40 rounded-2xl p-4">
                    <div className="flex items-end justify-between gap-4">
                        <div>
                            <p className="text-xs text-muted-foreground font-medium mb-1 flex items-center gap-2">
                                Orders
                                {activeDayBadge && (
                                    <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-bold border border-border/40">
                                        {activeDayBadge}
                                    </span>
                                )}
                            </p>
                            <p className="text-2xl font-black text-foreground">{Number(displayOrders).toLocaleString()} orders</p>
                        </div>
                        <TrendBadge pct={changePct} />
                    </div>
                </div>
            </div>
            <CardContent className="pl-1">
                <div className="h-[200px] w-full">
                    {loading ? (
                        <div className="h-full w-full flex items-center justify-center bg-muted/20 animate-pulse rounded-md" />
                    ) : filteredData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={filteredData}>
                                <defs>
                                    <linearGradient id="gradPerformance" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.35} />
                                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.12} />
                                <XAxis dataKey="date" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} tickFormatter={fmtLabel} interval="preserveStartEnd" />
                                <YAxis stroke="#888888" fontSize={10} tickLine={false} axisLine={false} width={40} />
                                <RechartsTooltip contentStyle={{ backgroundColor: "#1e1e1e", borderRadius: "8px", border: "none", fontSize: "11px" }} formatter={((value: any) => [`${value} orders`, "Cumulative orders"]) as any} labelFormatter={fmtLabel as any} />
                                <Area type="monotone" dataKey="orders" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#gradPerformance)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full w-full flex items-center justify-center text-muted-foreground text-xs">No performance data yet</div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

// ── Trend Badge ───────────────────────────────────────────────────────────
function TrendBadge({ pct }: { pct: number }) {
    const positive = pct >= 0;
    return (
        <div className={cn("flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold border", positive ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-red-500/10 text-red-500 border-red-500/20")}>
            {positive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
            {positive ? "+" : ""}{Number(pct).toFixed(2)}%
        </div>
    );
}

// ── Table Utilization Card (mirrors Flutter _buildTableStatusCard) ─────────
function TableUtilizationCard({ available, totalTables, tablesUsed, utilizationPct, tableOrders, avgOrdersPerUsedTable, freeTables, peakHour, topTables }: any) {
    const utilizationDisplay = Number.isFinite(Number(utilizationPct)) ? Math.round(Number(utilizationPct)) : 0;
    return (
        <Card className="bg-card border-border shadow-sm">
            <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold">Table Utilization</CardTitle>
                <CardDescription>Date-range usage insights</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {!available ? (
                    <div className="text-muted-foreground text-xs py-4 text-center">Table utilization stats not available for this scope</div>
                ) : (
                    <>
                        {/* Main utilization stat */}
                        <div className="bg-gradient-to-br from-card to-muted/30 border border-border/40 rounded-2xl p-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs text-muted-foreground mb-1">Utilization</p>
                                    <p className="text-3xl font-black text-blue-500">{utilizationDisplay}%</p>
                                    <p className="text-[11px] text-muted-foreground mt-1 font-medium">{tablesUsed} of {totalTables} tables active</p>
                                </div>
                                <div className="space-y-2 pt-1">
                                    <TableKpiLine label="Table Orders" value={String(tableOrders)} color="text-amber-400" />
                                    <TableKpiLine label="Orders / Active Table" value={Number(avgOrdersPerUsedTable).toFixed(2)} color="text-purple-400" />
                                    <TableKpiLine label="Free Tables" value={String(freeTables)} color="text-emerald-400" />
                                </div>
                            </div>
                        </div>

                        {/* Utilization progress bar */}
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-xs font-semibold">
                                <span className="text-muted-foreground">Floor Utilization Rate</span>
                                <span>{utilizationDisplay}%</span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                                <div className="bg-blue-500 h-full rounded-full transition-all" style={{ width: `${Math.min(utilizationDisplay, 100)}%` }} />
                            </div>
                        </div>

                        {/* Peak Hour */}
                        {peakHour && peakHour !== "—" && (
                            <div className="flex items-center justify-between bg-muted/30 rounded-xl p-3 text-xs">
                                <span className="font-semibold text-muted-foreground">Peak Hour</span>
                                <span className="font-bold text-foreground">{peakHour}</span>
                            </div>
                        )}

                        {/* Top Tables */}
                        {topTables?.length > 0 && (
                            <div className="space-y-1">
                                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Top Tables</p>
                                {topTables.slice(0, 4).map((t: any, i: number) => (
                                    <div key={i} className="flex items-center justify-between py-1 text-xs border-b border-border/20 last:border-0">
                                        <span className="font-medium">{t.table_name || t.name || `Table ${t.table_id || i+1}`}</span>
                                        <div className="flex items-center gap-3">
                                            <span className="text-muted-foreground">{t.orders_count || 0} orders</span>
                                            <span className="font-bold">Rs. {Number(t.amount || 0).toLocaleString()}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}

function TableKpiLine({ label, value, color }: { label: string; value: string; color: string }) {
    return (
        <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground truncate">{label}</span>
            <span className={cn("font-bold ml-2", color)}>{value}</span>
        </div>
    );
}

// ── Payment Methods Card (mirrors Flutter _expandedPaymentMethods) ─────────
function PaymentMethodsBreakdownCard({
    expandedMethods,
    onDaySelect,
    currentDayLabel,
    topCustomers = [],
}: {
    expandedMethods: any[];
    onDaySelect?: (dateStr: string) => void;
    currentDayLabel?: string;
    topCustomers?: any[];
}) {
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const total = expandedMethods.reduce((s: number, m: any) => s + (m.amount || 0), 0);
    const globalDayOptions = useMemo(() => buildRecentDayOptions(), []);
    const visibleMethods = expandedMethods.filter((item: any) => (item.amount || 0) > 0 || String(item.method || item.label || "").toLowerCase().includes("credit"));

    const methodColor = (label: string) => {
        const l = String(label || "").toLowerCase();
        if (l.includes("cash")) return { bg: "bg-emerald-500", dot: "bg-emerald-500", text: "text-emerald-500" };
        if (l.includes("card")) return { bg: "bg-blue-500", dot: "bg-blue-500", text: "text-blue-500" };
        if (l.includes("digital") || l.includes("qr") || l.includes("fonepay") || l.includes("esewa") || l.includes("khalti")) return { bg: "bg-purple-500", dot: "bg-purple-500", text: "text-purple-500" };
        if (l.includes("credit")) return { bg: "bg-rose-500", dot: "bg-rose-500", text: "text-rose-500" };
        return { bg: "bg-muted-foreground", dot: "bg-muted-foreground", text: "text-muted-foreground" };
    };

    const methodIcon = (label: string) => {
        const l = String(label || "").toLowerCase();
        if (l.includes("cash")) return <Wallet className="w-4 h-4" />;
        if (l.includes("card")) return <CreditCard className="w-4 h-4" />;
        if (l.includes("digital") || l.includes("qr")) return <Activity className="w-4 h-4" />;
        if (l.includes("credit")) return <ReceiptText className="w-4 h-4" />;
        return <DollarSign className="w-4 h-4" />;
    };

    return (
        <Card className="bg-card border-border shadow-sm">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0 gap-4">
                <div>
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-emerald-500" /> Payment Method
                    </CardTitle>
                    <CardDescription>Income breakdown by methods and instruments</CardDescription>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                    {onDaySelect && globalDayOptions.length > 0 && (
                        <Select
                            value={globalDayOptions[0]?.value ?? ""}
                            onValueChange={(v) => onDaySelect(v)}
                        >
                            <SelectTrigger className="h-8 rounded-lg text-xs w-[130px] border-border/60 bg-muted font-semibold gap-1">
                                <SelectValue placeholder="Today">
                                    {currentDayLabel || globalDayOptions[0]?.label || "Today"}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="rounded-xl max-h-[260px]">
                                {globalDayOptions.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                    {expandedMethods.length > 0 && (
                        <Button variant="outline" size="sm" className="rounded-xl h-8 text-xs font-semibold bg-muted hover:bg-muted/80 border-none shrink-0" onClick={() => setIsDetailsOpen(true)}>
                            View All
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                {visibleMethods.length === 0 ? (
                    <div className="text-muted-foreground text-xs py-4 text-center">No payment records found</div>
                ) : (
                    <>
                        {visibleMethods.slice(0, 4).map((item: any, i: number) => {
                            const label = String(item.label || item.method || "");
                            const amount = item.amount || 0;
                            const pct = total > 0 ? (amount / total) : 0;
                            const colors = methodColor(label);
                            const isInstrument = !!item.isInstrument;

                            return (
                                <div key={i} className={cn("border border-border rounded-xl p-3 space-y-2.5", isInstrument ? "ml-2 border-dashed opacity-85" : "")}>
                                    <div className="flex items-center gap-3">
                                        <div className={cn("w-8 h-8 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0", colors.text)}>
                                            {methodIcon(label)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-sm truncate capitalize">{label}</p>
                                            <p className="text-[11px] text-muted-foreground">{(pct * 100).toFixed(0)}% of income</p>
                                        </div>
                                        <p className="font-bold text-sm shrink-0">Rs. {Number(amount).toLocaleString()}</p>
                                    </div>
                                    <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                                        <div className={cn("h-full rounded-full transition-all", colors.bg)} style={{ width: `${(pct * 100).toFixed(1)}%` }} />
                                    </div>
                                </div>
                            );
                        })}
                        {total > 0 && (
                            <div className="flex justify-between items-center bg-muted/30 border border-border/40 rounded-xl p-2.5 text-xs">
                                <span className="font-bold text-muted-foreground">Total Income Captured:</span>
                                <span className="font-extrabold text-foreground text-sm">Rs. {Number(total).toLocaleString()}</span>
                            </div>
                        )}
                    </>
                )}
            </CardContent>

            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DialogContent className="max-w-2xl rounded-2xl border border-border/60 bg-card/95 backdrop-blur-md">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold flex items-center gap-2">
                            <Wallet className="w-5 h-5 text-emerald-500" /> Payment Methods & Instruments
                        </DialogTitle>
                        <DialogDescription>Full breakdown of payment types, instruments, and customer context</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 my-4 max-h-[60vh] overflow-y-auto pr-1">
                        {visibleMethods.map((item: any, i: number) => {
                            const label = String(item.label || item.method || "");
                            const amount = item.amount || 0;
                            const pct = total > 0 ? (amount / total) : 0;
                            const colors = methodColor(label);
                            const isInstrument = !!item.isInstrument;

                            return (
                                <div key={i} className={cn("border border-border rounded-xl p-3 space-y-2", isInstrument ? "ml-4 border-dashed opacity-85" : "")}>
                                    <div className="flex items-center gap-3">
                                        <div className={cn("w-8 h-8 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0", colors.text)}>
                                            {methodIcon(label)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-sm capitalize truncate">{label}</p>
                                            <p className="text-[11px] text-muted-foreground">{(pct * 100).toFixed(1)}% of total income</p>
                                        </div>
                                        <p className="font-bold shrink-0">Rs. {Number(amount).toLocaleString()}</p>
                                    </div>
                                    <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                                        <div className={cn("h-full rounded-full", colors.bg)} style={{ width: `${(pct * 100).toFixed(1)}%` }} />
                                    </div>
                                </div>
                            );
                        })}
                        {topCustomers.length > 0 && (
                            <div className="rounded-xl border border-border/60 p-4 space-y-3 bg-muted/10">
                                <div>
                                    <p className="font-semibold text-sm">Customer Detail View</p>
                                    <p className="text-[11px] text-muted-foreground">Best available customer context for the selected analytics period.</p>
                                </div>
                                <div className="space-y-2">
                                    {topCustomers.slice(0, 8).map((cust: any, i: number) => (
                                        <div key={cust.id ?? `${cust.customer_name}-${i}`} className="flex items-center justify-between py-1.5 border-b border-border/20 last:border-0 gap-3">
                                            <div className="min-w-0">
                                                <p className="font-medium text-sm truncate">{cust.name || cust.customer_name || "Unknown Customer"}</p>
                                                <p className="text-[11px] text-muted-foreground">{cust.orders_count || cust.visits || 0} orders</p>
                                            </div>
                                            <p className="font-bold text-sm shrink-0">Rs. {Number(cust.amount || cust.total_spent || 0).toLocaleString()}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div className="flex justify-between items-center bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-sm font-bold">
                            <span>Total Income Captured</span>
                            <span className="text-emerald-500">Rs. {Number(total).toLocaleString()}</span>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
