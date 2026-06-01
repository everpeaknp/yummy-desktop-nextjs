"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, ChevronRight, Calculator, AlertTriangle, Receipt, ChevronDown } from "lucide-react";
import apiClient from "@/lib/api-client";
import { DayCloseApis, TableApis, ExpenseApis, OrderApis } from "@/lib/api/endpoints";
import { DayClosePaymentSummary } from "@/components/analytics/day-close-payment-summary";
import { useRestaurant } from "@/hooks/use-restaurant";

interface DayCloseModalProps {
  isOpen: boolean;
  onClose: () => void;
  restaurantId: number;
  businessDate?: string; // YYYY-MM-DD (optional explicit override)
}

type Step = 'health-check' | 'financial-snapshot' | 'cash-reconciliation' | 'success';

function todayDateStringLocal() {
  return format(new Date(), "yyyy-MM-dd");
}

function normalizeDateString(value?: string | null) {
  if (!value) return null;
  const match = String(value).trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

export function DayCloseModal({ isOpen, onClose, restaurantId, businessDate }: DayCloseModalProps) {
  const [currentStep, setCurrentStep] = useState<Step>('health-check');
  const [snapshotData, setSnapshotData] = useState<any>(null);
  const [dayCloseId, setDayCloseId] = useState<number | null>(null);
  const [confirmedData, setConfirmedData] = useState<any>(null);
  const [resolvedBusinessDate, setResolvedBusinessDate] = useState<string>(
    normalizeDateString(businessDate) ?? todayDateStringLocal(),
  );
  const [resolvingBusinessDate, setResolvingBusinessDate] = useState(false);
  const dateStr = resolvedBusinessDate;
  const dateObj = new Date(dateStr + "T00:00:00");

  // Reset state on close
  const handleClose = () => {
    setCurrentStep('health-check');
    setSnapshotData(null);
    setDayCloseId(null);
    setConfirmedData(null);
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;

    const fallbackDate = normalizeDateString(businessDate) ?? todayDateStringLocal();

    // Manual override / history path: trust explicit date.
    if (businessDate) {
      setResolvedBusinessDate(fallbackDate);
      setResolvingBusinessDate(false);
      return;
    }

    // Default path: resolve business date from backend.
    let cancelled = false;
    const resolveCurrentBusinessDate = async () => {
      setResolvingBusinessDate(true);
      try {
        const res = await apiClient.get(DayCloseApis.current, {
          params: { restaurant_id: restaurantId },
        });
        const fromServer = normalizeDateString(res?.data?.data?.business_date);
        if (!cancelled) {
          setResolvedBusinessDate(fromServer ?? fallbackDate);
        }
      } catch (err) {
        if (!cancelled) {
          setResolvedBusinessDate(fallbackDate);
        }
      } finally {
        if (!cancelled) {
          setResolvingBusinessDate(false);
        }
      }
    };

    resolveCurrentBusinessDate();

    return () => {
      cancelled = true;
    };
  }, [isOpen, restaurantId, businessDate]);

  const handleDateOverride = (value: string) => {
    if (!value) return;
    if (value === resolvedBusinessDate) return;
    setResolvedBusinessDate(value);
    setCurrentStep("health-check");
    setSnapshotData(null);
    setDayCloseId(null);
    setConfirmedData(null);
  };

  const steps = [
    { id: 'health-check', label: 'Health Check' },
    { id: 'financial-snapshot', label: 'Snapshot' },
    { id: 'cash-reconciliation', label: 'Reconciliation' },
    { id: 'success', label: 'Complete' },
  ];

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-3xl p-0 gap-0 overflow-hidden sm:rounded-2xl max-h-[90vh] flex flex-col">
          <DialogHeader className="sr-only">
            <DialogTitle>End of Day Close</DialogTitle>
            <DialogDescription>
              Review system health, financial snapshot, and reconcile cash to close the day.
            </DialogDescription>
          </DialogHeader>
          {/* Header */}
          <div className="bg-slate-50 dark:bg-slate-900 border-b p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold">End of Day Close</h2>
                    <p className="text-muted-foreground text-sm min-h-[20px]">
                        {resolvingBusinessDate ? "Resolving current business date..." : null}
                    </p>
                    <p className="text-muted-foreground text-sm">
                        {format(dateObj, 'MMMM do, yyyy')}
                    </p>
                  </div>
                  <div className="px-3 py-1 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 rounded-full text-xs font-semibold border border-orange-200 dark:border-orange-900/50">
                      Step {currentStepIndex + 1} of 4
                  </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <label
                  htmlFor="day-close-business-date"
                  className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Business Date
                </label>
                <input
                  id="day-close-business-date"
                  type="date"
                  className="h-9 w-full sm:w-auto rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                  value={resolvedBusinessDate}
                  onChange={(e) => handleDateOverride(e.target.value)}
                />
              </div>

              {/* Progress Bar */}
              <div className="flex gap-2">
                 {steps.map((step, index) => {
                     const isCompleted = index < currentStepIndex;
                     const isActive = index === currentStepIndex;
                     return (
                         <div key={step.id} className="flex-1 h-1.5 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800">
                             <div 
                                className={cn(
                                    "h-full transition-all duration-500 ease-in-out",
                                    (isActive || isCompleted) ? "bg-orange-500" : "w-0"
                                )} 
                             />
                         </div>
                     )
                 })}
              </div>
          </div>

          {/* Content Body */}
          <div className="flex-1 overflow-y-auto p-6 min-h-[400px]">
             {currentStep === 'health-check' && (
                 <HealthCheckStep onNext={() => setCurrentStep('financial-snapshot')} restaurantId={restaurantId} businessDate={dateStr} />
             )}
             {currentStep === 'financial-snapshot' && (
                 <FinancialSnapshotStep 
                    restaurantId={restaurantId}
                    businessDate={dateStr}
                    onNext={(data, id) => {
                        setSnapshotData(data);
                        setDayCloseId(id);
                        setCurrentStep('cash-reconciliation');
                    }} 
                 />
             )}
             {currentStep === 'cash-reconciliation' && (
                 <CashReconciliationStep 
                    snapshot={snapshotData}
                    dayCloseId={dayCloseId}
                    onNext={(data) => {
                        setConfirmedData(data);
                        setCurrentStep('success');
                    }}
                 />
             )}
             {currentStep === 'success' && (
                 <SuccessStep data={confirmedData} onClose={handleClose} />
             )}
          </div>
      </DialogContent>
    </Dialog>
  );
}

// --------------------------------------------------------------------------
// Step Components
// --------------------------------------------------------------------------

function HealthCheckStep({ onNext, restaurantId, businessDate }: { onNext: () => void; restaurantId: number; businessDate: string }) {
    const [checks, setChecks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [canProceed, setCanProceed] = useState(false);

    useEffect(() => {
        const validate = async () => {
            try {
                const res = await apiClient.get(DayCloseApis.validateClose, {
                    params: { restaurant_id: restaurantId, business_date: businessDate }
                });
                
                if (res.data.status === 'success') {
                    const data = res.data.data;
                    const newChecks = [];

                    // 1. Active Orders
                    if (data.active_orders_count > 0) {
                        newChecks.push({ 
                            label: "Active Orders", 
                            status: 'fail', 
                            message: `${data.active_orders_count} active orders need attention` 
                        });
                    } else {
                        newChecks.push({ 
                            label: "Active Orders", 
                            status: 'pass', 
                            message: "All orders completed" 
                        });
                    }

                    // 2. Pending Refunds
                    if (data.pending_refunds_count > 0) {
                        newChecks.push({ 
                            label: "Pending Refunds", 
                            status: 'fail', 
                            message: `${data.pending_refunds_count} refunds pending processing` 
                        });
                    } else {
                        newChecks.push({ 
                            label: "Pending Refunds", 
                            status: 'pass', 
                            message: "No pending refunds" 
                        });
                    }

                    // 3. Other Blockers (e.g. Already Closed)
                    if (data.blockers && data.blockers.length > 0) {
                        // Filter out the ones we already covered to avoid duplication if backend repeats them
                        const otherBlockers = data.blockers.filter((b: string) => 
                            !b.includes("active order") && !b.includes("pending refund")
                        );
                        
                        otherBlockers.forEach((b: string) => {
                             newChecks.push({ 
                                label: "System Validation", 
                                status: 'fail', 
                                message: b 
                            });
                        });
                    }

                    setChecks(newChecks);
                    setCanProceed(data.can_close);
                } else {
                     setChecks([{ label: "Validation Failed", status: 'fail', message: res.data.message }]);
                }
            } catch (err) {
                console.error("Health check failed", err);
                setChecks([{ label: "System Connection", status: 'fail', message: "Failed to connect to server" }]);
            } finally {
                setLoading(false);
            }
        };
        validate();
    }, [restaurantId, businessDate]);

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-xl border border-blue-100 dark:border-blue-900/50">
                <div className="p-2 bg-white dark:bg-blue-950 rounded-lg">
                    <Activity className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="font-semibold">System Health Check</h3>
                    <p className="text-xs opacity-80">Verifying pending orders and unpaid bills...</p>
                </div>
            </div>
            
            <div className="grid gap-4">
                {loading ? (
                    <div className="p-4 text-center text-muted-foreground">Running checks...</div>
                ) : (
                    checks.map((check, i) => (
                        <CheckItem key={i} label={check.label} status={check.status} message={check.message} />
                    ))
                )}
            </div>

            <div className="pt-4 flex justify-end">
                <Button onClick={onNext} disabled={!canProceed} className="gap-2">
                    Continue to Snapshot <ChevronRight className="w-4 h-4" />
                </Button>
            </div>
        </div>
    )
}

function CheckItem({ label, status, message }: { label: string, status: 'pass' | 'fail' | 'warn', message?: string }) {
    return (
        <div className="flex items-center justify-between p-3 rounded-lg border bg-white dark:bg-slate-950">
            <div>
                <span className="font-medium text-sm block">{label}</span>
                {message && <span className="text-xs text-muted-foreground">{message}</span>}
            </div>
            <div className={cn(
                "flex items-center gap-2 text-xs font-semibold uppercase tracking-wider",
                status === 'pass' ? "text-green-600" : "text-red-500"
            )}>
                {status === 'pass' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                {status === 'pass' ? "Passed" : "Action Needed"}
            </div>
        </div>
    )
}

function FinancialSnapshotStep({ onNext, restaurantId, businessDate }: { onNext: (data: any, id: number) => void; restaurantId: number; businessDate: string }) {
    const restaurant = useRestaurant((s) => s.restaurant);
    const [snapshot, setSnapshot] = useState<any>(null);
    const [tableNameMap, setTableNameMap] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [initiating, setInitiating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showZeroes, setShowZeroes] = useState(false);

    useEffect(() => {
        const generate = async () => {
            try {
                const [res, tablesRes, expensesRes, ordersRes] = await Promise.all([
                    apiClient.get(DayCloseApis.generateSnapshot, {
                        params: {
                            restaurant_id: restaurantId,
                            business_date: businessDate
                        }
                    }),
                    apiClient.get(TableApis.getTables(restaurantId)),
                    // Fetch recent expenses to catch those paid today (limit 200 max)
                    apiClient.get(ExpenseApis.list, {
                        params: { 
                            restaurant_id: restaurantId, 
                            limit: 200 
                        }
                    }).catch(() => null),
                    // Fetch proper orders (limit 100 max to avoid 422)
                    apiClient.get(OrderApis.listOrders, {
                        params: { restaurant_id: restaurantId, date_from: businessDate, date_to: businessDate, limit: 100 }
                    }).catch(() => null)
                ]);

                let snapshotData = null;
                if (res.data.status === 'success') {
                    snapshotData = { ...res.data.data };

                    // 1. Properly calculate expenses
                    const rawExpenses = expensesRes?.data?.data?.expenses || expensesRes?.data?.data?.items;
                    if (rawExpenses) {
                        const expensesArr = rawExpenses.filter((e: any) => {
                            const dateStr = (e.paid_on || e.expense_date || "").split('T')[0];
                            return dateStr === businessDate;
                        });
                        
                        const realExpenses = expensesArr.reduce((acc: number, curr: any) => acc + (Number(curr.amount) || 0), 0);
                        snapshotData.manual_expense_total = realExpenses;

                        // Group by category for the list card
                        const catMap: Record<string, number> = {};
                        expensesArr.forEach((e: any) => {
                            const catName = e.category?.name || "Uncategorized";
                            catMap[catName] = (catMap[catName] || 0) + (Number(e.amount) || 0);
                        });
                        snapshotData.manual_expenses_by_category = Object.entries(catMap).map(([name, amount]) => ({ name, amount }));
                    }

                    // 2. Properly calculate avg items / order
                    const ordersArr = ordersRes?.data?.data?.orders || ordersRes?.data?.data?.items;
                    if (ordersArr) {
                        const orders = ordersArr.filter((o: any) => 
                            o.status === 'completed' || o.status === 'ready' || o.status === 'settled' || o.status === 'paid'
                        );
                        if (orders.length > 0) {
                            const totalItems = orders.reduce((acc: number, curr: any) => {
                                if (curr.items && Array.isArray(curr.items)) {
                                    return acc + curr.items.reduce((sum: number, item: any) => sum + (Number(item.qty || item.quantity) || 1), 0);
                                }
                                return acc + (Number(curr.total_items || curr.total_qty || curr.items_count) || 0);
                            }, 0);
                            snapshotData.manual_avg_items = totalItems / orders.length;
                        } else {
                            snapshotData.manual_avg_items = 0;
                        }
                        
                        // 3. Properly count credit orders
                        const creditOrderList = orders.filter((o: any) => {
                            const method = String(o.payment_method || o.payment_type || "").toLowerCase();
                            const status = String(o.payment_status || "").toLowerCase();
                            return method === "credit" || status === "credit" || o.is_credit === true;
                        });
                        snapshotData.manual_credit_orders = creditOrderList.length;
                    }

                    setSnapshot(snapshotData);
                } else {
                    setError(res.data.message || "Failed to generate snapshot");
                }
                
                if (tablesRes.data?.status === "success" && Array.isArray(tablesRes.data?.data)) {
                    const map: Record<string, string> = {};
                    tablesRes.data.data.forEach((t: any) => {
                        const area = t?.table_type_name || t?.area_name || t?.table_category_name;
                        const table = t?.table_name;
                        const label = area && table ? `${area} - ${table}` : table;
                        if (!label) return;
                        const idKey = String(t.id);
                        const tableKey = String(table);
                        map[idKey] = label;
                        map[idKey.toLowerCase()] = label;
                        map[tableKey] = label;
                        map[tableKey.toLowerCase()] = label;
                    });
                    setTableNameMap(map);
                }
            } catch (err: any) {
                console.error("Snapshot generation failed", err);
                setError(err.response?.data?.message || "Failed to generate snapshot. Please try again.");
            } finally {
                setLoading(false);
            }
        };
        generate();
    }, [restaurantId, businessDate]);

    const handleContinue = async () => {
        setInitiating(true);
        try {
            const res = await apiClient.post(DayCloseApis.initiate, {
                restaurant_id: restaurantId,
                business_date: businessDate
            });
            
            if (res.data.status === 'success') {
                const dayCloseId = res.data.data.id;
                onNext(snapshot, dayCloseId);
            } else {
                // If initiate fails, we might want to handle it. 
                // However, user might already have an open one.
                // Fallback to checking for current if initiate fails?
                // For now, let's assume success or show error.
                setError(res.data.message || "Failed to initiate day close");
            }
        } catch (err: any) {
            console.error("Initiate failed", err);
            setError(err.response?.data?.message || "Failed to proceed. Please try again.");
        } finally {
            setInitiating(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-8 space-y-4">
                <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground">Generating financial snapshot...</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center p-8 space-y-4 text-center">
                <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full">
                    <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                     <p className="font-semibold text-red-600 dark:text-red-400">Generation Failed</p>
                     <p className="text-sm text-muted-foreground mt-1 max-w-[200px] mx-auto">{error}</p>
                </div>
                <Button onClick={() => window.location.reload()} variant="outline">Retry</Button>
            </div>
        )
    }

    const readPath = (obj: any, path: string) =>
        path.split(".").reduce((acc: any, part: string) => (acc == null ? undefined : acc[part]), obj);
    const toNumeric = (value: any): number | null => {
        if (typeof value === "number" && Number.isFinite(value)) return value;
        if (typeof value === "string") {
            const cleaned = value.replace(/[^0-9.-]/g, "");
            if (cleaned && !Number.isNaN(Number(cleaned))) return Number(cleaned);
        }
        return null;
    };
    const extractNumericDeep = (value: any): number | null => {
        const direct = toNumeric(value);
        if (direct != null) return direct;
        if (Array.isArray(value)) {
            for (const item of value) {
                const found = extractNumericDeep(item);
                if (found != null) return found;
            }
            return null;
        }
        if (value && typeof value === "object") {
            const priorityKeys = ["amount", "total", "value", "sales", "sum", "count", "qty", "quantity"];
            for (const key of priorityKeys) {
                if (key in value) {
                    const found = extractNumericDeep(value[key]);
                    if (found != null) return found;
                }
            }
            for (const nested of Object.values(value)) {
                const found = extractNumericDeep(nested);
                if (found != null) return found;
            }
        }
        return null;
    };
    const flattenPairs = (obj: any, prefix = ""): Array<{ label: string; value: any }> => {
        if (!obj || typeof obj !== "object") return [];
        const out: Array<{ label: string; value: any }> = [];
        Object.entries(obj).forEach(([k, v]) => {
            const label = prefix ? `${prefix} ${k}` : k;
            if (Array.isArray(v)) {
                out.push({ label, value: v });
                return;
            }
            if (v && typeof v === "object") {
                out.push(...flattenPairs(v, label));
                return;
            }
            out.push({ label, value: v });
        });
        return out;
    };
    const walkObject = (
        obj: any,
        visitor: (key: string, value: any, path: string[]) => void,
        path: string[] = []
    ) => {
        if (!obj || typeof obj !== "object") return;
        Object.entries(obj).forEach(([key, value]) => {
            visitor(key, value, [...path, key]);
            if (value && typeof value === "object" && !Array.isArray(value)) {
                walkObject(value, visitor, [...path, key]);
            }
        });
    };
    const mapObjectToRows = (obj: Record<string, any>) =>
        Object.entries(obj)
            .map(([name, value]) => ({ name, amount: extractNumericDeep(value) ?? 0 }))
            .filter((r) => r.name);
    const normalizeRows = (rows: any[]): any[] =>
        rows
            .map((row: any, idx: number) => {
                if (row == null) return null;
                if (typeof row === "object") return row;
                if (typeof row === "string") return { name: row, amount: 0, _idx: idx };
                return { name: `Item ${idx + 1}`, amount: extractNumericDeep(row) ?? 0, _idx: idx };
            })
            .filter(Boolean);
    const findBreakdownByTokens = (tokens: string[]): any[] => {
        const lowerTokens = tokens.map((t) => t.toLowerCase());
        const candidates: any[] = [];
        walkObject(snapshot, (key, value, path) => {
            const pathText = [...path, key].join(".").toLowerCase();
            const matches = lowerTokens.every((t) => pathText.includes(t));
            if (!matches) return;
            if (Array.isArray(value)) {
                candidates.push(normalizeRows(value));
                return;
            }
            if (value && typeof value === "object") {
                candidates.push(mapObjectToRows(value as Record<string, any>));
            }
        });
        return candidates.find((c) => Array.isArray(c) && c.length > 0) || [];
    };

    const roots = [
        snapshot,
        snapshot?.snapshot_data,
        snapshot?.totals,
        snapshot?.summary,
        snapshot?.financial_snapshot,
        snapshot?.operational_snapshot,
        snapshot?.breakdowns,
        snapshot?.snapshot_data?.financial_snapshot,
        snapshot?.snapshot_data?.operational_snapshot,
        snapshot?.snapshot_data?.breakdowns,
    ].filter(Boolean);

    const pickNumber = (obj: any, keys: string[], fallback = 0): number => {
        for (const root of [obj, ...roots]) {
            for (const key of keys) {
                const value = readPath(root, key);
                if (typeof value === "number") return value;
                if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) return Number(value);
            }
        }
        return fallback;
    };

    const pickList = (obj: any, keys: string[]): any[] => {
        for (const root of [obj, ...roots]) {
            for (const key of keys) {
                const value = readPath(root, key);
                if (Array.isArray(value)) return value;
            }
        }
        return [];
    };
    const flattened = flattenPairs(snapshot?.snapshot_data || snapshot);
    const pickNumberByLabel = (needles: string[], fallback = 0): number => {
        const normalizedNeedles = needles.map((n) => n.toLowerCase());
        for (const row of flattened) {
            const label = String(row.label || "").toLowerCase();
            if (normalizedNeedles.some((n) => label.includes(n))) {
                const n = extractNumericDeep(row.value);
                if (n != null) return n;
            }
        }
        return fallback;
    };
    const pickBreakdownRows = (needles: string[]): any[] => {
        const normalizedNeedles = needles.map((n) => n.toLowerCase());
        for (const row of flattened) {
            const label = String(row.label || "").toLowerCase();
            if (normalizedNeedles.some((n) => label.includes(n))) {
                if (Array.isArray(row.value)) return row.value;
                if (row.value && typeof row.value === "object") {
                    return Object.entries(row.value).map(([name, value]) => ({ name, amount: extractNumericDeep(value) ?? 0 }));
                }
            }
        }
        return [];
    };
    const pickNumberByPathTokens = (mustInclude: string[], mustExclude: string[] = []): number => {
        const include = mustInclude.map((t) => t.toLowerCase());
        const exclude = mustExclude.map((t) => t.toLowerCase());
        let best: number | null = null;
        walkObject(snapshot, (key, value, path) => {
            const pathText = [...path, key].join(".").toLowerCase();
            const matchesInclude = include.every((t) => pathText.includes(t));
            const matchesExclude = exclude.some((t) => pathText.includes(t));
            if (!matchesInclude || matchesExclude) return;
            const n = extractNumericDeep(value);
            if (n == null || n <= 0) return;
            if (best == null || n > best) best = n;
        });
        return best ?? 0;
    };
    const sumQuantitiesFromItemArrays = (): number => {
        const qtyKeys = ["quantity", "qty", "item_count", "count", "total_items", "items_count"];
        const lineItemArrayKeys = ["items", "order_items", "line_items", "products"];
        let total = 0;
        walkObject(snapshot, (key, value) => {
            const k = String(key || "").toLowerCase();
            if (!Array.isArray(value)) return;
            if (lineItemArrayKeys.includes(k)) {
                for (const row of value) {
                    if (!row || typeof row !== "object") continue;
                    let lineQty = 0;
                    for (const qKey of qtyKeys) {
                        const qVal = (row as Record<string, any>)[qKey];
                        const qNum = extractNumericDeep(qVal);
                        if (qNum != null) {
                            lineQty = qNum;
                            break;
                        }
                    }
                    if (lineQty <= 0) lineQty = 1;
                    total += lineQty;
                }
            }
            for (const row of value) {
                if (!row || typeof row !== "object") continue;
                const hasSalesShape =
                    "amount" in row || "sales" in row || "total" in row || "value" in row;
                if (!hasSalesShape) continue;
                for (const qKey of qtyKeys) {
                    const qVal = (row as Record<string, any>)[qKey];
                    const qNum = extractNumericDeep(qVal);
                    if (qNum != null && qNum > 0) {
                        total += qNum;
                        break;
                    }
                }
            }
        });
        return total;
    };

    const amount = (v: number) => `Rs. ${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const grossSales = pickNumber(snapshot, ["gross_sales", "gross", "total_gross_sales"]);
    const netSales = pickNumber(snapshot, ["net_sales", "net", "total_net_sales"]);
    const totalIncome = pickNumber(snapshot, ["total_income", "income_total", "income"]);
    const totalOrders = pickNumber(snapshot, ["total_orders", "order_count", "orders_count"]);
    const taxCollected = pickNumber(snapshot, ["tax_collected", "taxes_collected", "tax_total"]);
    const discounts = pickNumber(snapshot, ["discounts", "total_discounts", "discount_amount"]);
    const refunds = pickNumber(snapshot, ["refunds", "total_refunds", "refund_amount"]);
    const expenses = pickNumber(snapshot, ["expenses", "total_expenses", "expense_total"]);
    const manualIncome = pickNumber(snapshot, ["manual_income", "other_income", "manual_income_total"]);
    const avgOrderValue = pickNumber(snapshot, ["avg_order_value", "average_order_value"]);
    const avgItemsPerOrder = pickNumber(snapshot, [
        "avg_items_per_order",
        "average_items_per_order",
        "avg_item_per_order",
        "average_item_per_order",
    ]);
    const creditSales = pickNumber(snapshot, ["credit_sales", "credit_sales_total"]);
    const creditCollection = pickNumber(snapshot, ["credit_collection", "credit_collections", "credit_collected"]);
    const receivables = pickNumber(snapshot, ["receivables", "accounts_receivable", "credit_receivable"]);
    const creditOrders = pickNumber(snapshot, ["credit_orders", "credit_order_count"]);
    const cashCollected = pickNumber(snapshot, ["cash_collected", "cash_total", "cash_in"]);

    const derivedGrossSales = grossSales || pickNumberByLabel(["gross sales", "gross_total"]);
    const derivedNetSales = netSales || pickNumberByLabel(["net sales", "net_total"]);
    const derivedTotalIncome = totalIncome || pickNumberByLabel(["total income", "income total"]);
    const derivedTotalOrders = totalOrders || pickNumberByLabel(["total orders", "order count"]);
    const derivedTaxCollected = taxCollected || pickNumberByLabel(["tax collected", "tax total"]);
    const derivedDiscounts = discounts || pickNumberByLabel(["discount", "total discounts"]);
    const derivedRefunds = refunds || pickNumberByLabel(["refund", "total refunds"]);
    const derivedExpenses = snapshot?.manual_expense_total ?? (expenses || pickNumberByLabel(["expense", "total expenses"]));
    const derivedManualIncome = manualIncome || pickNumberByLabel(["manual income", "other income"]);
    const derivedAvgOrderValue =
        avgOrderValue ||
        pickNumberByLabel(["avg order", "average order"]) ||
        ((derivedTotalOrders || 0) > 0 ? (derivedNetSales || derivedGrossSales) / derivedTotalOrders : 0);
    const totalItems = pickNumber(snapshot, [
        "total_items",
        "items_total",
        "total_quantity",
        "items_count",
        "item_count",
        "total_items_sold",
        "items_sold",
        "sold_items_count",
        "order_items_count",
        "total_order_items",
        "total_qty",
    ]) || pickNumberByLabel(["total items", "total quantity", "items total", "item count", "items sold", "order items"]);
    const discoveredTotalItems =
        totalItems > 0
            ? totalItems
            : pickNumberByPathTokens(["item", "count"], ["avg", "average"]) ||
              pickNumberByPathTokens(["items", "total"], ["avg", "average"]) ||
              pickNumberByPathTokens(["quantity", "total"], ["avg", "average"]) ||
              sumQuantitiesFromItemArrays();
    const derivedAvgItemsPerOrder =
        snapshot?.manual_avg_items ?? (
            avgItemsPerOrder ||
            pickNumberByLabel(["avg items", "average items", "items per order"]) ||
            ((derivedTotalOrders || 0) > 0 ? discoveredTotalItems / derivedTotalOrders : 0)
        );
    const derivedCreditSales = creditSales || pickNumberByLabel(["credit sales"]);
    const derivedCreditCollection = creditCollection || pickNumberByLabel(["credit collection", "credit collected"]);
    const derivedReceivables = receivables || pickNumberByLabel(["receivable", "accounts receivable"]);
    const derivedCreditOrders = snapshot?.manual_credit_orders ?? (creditOrders || pickNumberByLabel(["credit orders"]));
    const derivedCashCollected = cashCollected || pickNumberByLabel(["cash collected", "cash in"]);

    const salesByCategory = pickList(snapshot, ["sales_by_category", "category_sales", "by_category"]).length
        ? pickList(snapshot, ["sales_by_category", "category_sales", "by_category"])
        : pickBreakdownRows(["sales by category", "category sales"]).length
            ? pickBreakdownRows(["sales by category", "category sales"])
            : findBreakdownByTokens(["category"]);
    const salesByTable = pickList(snapshot, ["sales_by_table", "table_sales", "by_table"]).length
        ? pickList(snapshot, ["sales_by_table", "table_sales", "by_table"])
        : pickBreakdownRows(["sales by table", "table sales"]).length
            ? pickBreakdownRows(["sales by table", "table sales"])
            : findBreakdownByTokens(["table"]);

    const allMetrics = [
        { label: "Gross Sales", value: derivedGrossSales, isAmount: true, color: "text-emerald-600 dark:text-emerald-400" },
        { label: "Net Sales", value: derivedNetSales, isAmount: true, color: "text-emerald-600 dark:text-emerald-400" },
        { label: "Total Income", value: derivedTotalIncome, isAmount: true, color: "text-emerald-600 dark:text-emerald-400" },
        { label: "Expected Cash", value: pickNumber(snapshot, ["expected_cash", "net_cash_position"]) || pickNumberByLabel(["expected cash"]), isAmount: true, color: "text-emerald-600 dark:text-emerald-400" },
        { label: "Expenses", value: derivedExpenses, isAmount: true, color: "text-rose-600 dark:text-rose-400" },
        { label: "Credit Sales", value: derivedCreditSales, isAmount: true, color: "text-blue-600 dark:text-blue-400" },
        { label: "Receivables", value: derivedReceivables, isAmount: true, color: "text-blue-600 dark:text-blue-400" },
        { label: "Cash Collected", value: derivedCashCollected, isAmount: true, color: "text-emerald-600 dark:text-emerald-400" },
        { label: "Avg Order", value: derivedAvgOrderValue, isAmount: true },
        { label: "Avg Items / Order", value: derivedAvgItemsPerOrder, isAmount: false, format: (v: number) => Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 2 }) },
        { label: "Total Orders", value: derivedTotalOrders, isAmount: false },
        { label: "Tax Collected", value: derivedTaxCollected, isAmount: true },
        { label: "Discounts", value: derivedDiscounts, isAmount: true, color: "text-rose-600 dark:text-rose-400" },
        { label: "Refunds", value: derivedRefunds, isAmount: true, color: "text-rose-600 dark:text-rose-400" },
        { label: "Manual Income", value: derivedManualIncome, isAmount: true, color: "text-emerald-600 dark:text-emerald-400" },
        { label: "Credit Collection", value: derivedCreditCollection, isAmount: true, color: "text-emerald-600 dark:text-emerald-400" },
        { label: "Credit Orders", value: derivedCreditOrders, isAmount: false },
    ];

    const primaryLabels = ["Gross Sales", "Net Sales", "Total Income", "Expected Cash"];
    
    const primaryCards = allMetrics.filter(m => primaryLabels.includes(m.label));
    const secondaryCards = allMetrics.filter(m => !primaryLabels.includes(m.label));

    const renderCard = (card: any, isPrimary = false) => {
        const val = card.format ? card.format(card.value) : card.isAmount ? amount(card.value) : Number(card.value || 0).toLocaleString();
        
        let valColor = card.color;
        if (card.isAmount && Number(card.value) < 0) {
             valColor = "text-rose-600 dark:text-rose-400";
        } else if (!valColor) {
             valColor = isPrimary ? "text-slate-800 dark:text-slate-100" : "text-slate-800 dark:text-slate-200";
        }

        return (
            <div key={card.label} className={cn("p-3 rounded-xl border bg-slate-50 dark:bg-slate-900", isPrimary ? "bg-white dark:bg-slate-950 shadow-sm" : "")}>
                <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-semibold mb-1">{card.label}</p>
                <p className={cn("font-bold leading-tight", isPrimary ? "text-2xl" : "text-lg", valColor)}>{val}</p>
            </div>
        );
    };

    return (
        <div className="space-y-6">
             <div className="flex items-center gap-4 p-4 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-xl border border-purple-100 dark:border-purple-900/50">
                <div className="p-2 bg-white dark:bg-purple-950 rounded-lg">
                    <Calculator className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="font-semibold">Financial Snapshot</h3>
                    <p className="text-xs opacity-80">Review calculated totals for this business day</p>
                </div>
            </div>

            <div className="space-y-3">
                <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Primary Metrics</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {primaryCards.map(c => renderCard(c, true))}
                </div>
            </div>

            <div className="space-y-3">
                <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Additional Metrics</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {secondaryCards.map(c => renderCard(c))}
                </div>
            </div>

            <div className="pt-4">
                <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Detailed Breakdowns</h4>
                <Tabs defaultValue="payments" className="w-full">
                    <TabsList className="w-full justify-start overflow-x-auto h-auto p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                        <TabsTrigger value="payments" className="rounded-lg">Payments</TabsTrigger>
                        <TabsTrigger value="categories" className="rounded-lg">Categories</TabsTrigger>
                        <TabsTrigger value="tables" className="rounded-lg">Tables</TabsTrigger>
                        <TabsTrigger value="expenses" className="rounded-lg">Expenses</TabsTrigger>
                    </TabsList>
                    <div className="mt-4">
                        <TabsContent value="payments" className="m-0 space-y-4">
                            <DayClosePaymentSummary
                                snapshotData={snapshot}
                                restaurant={restaurant}
                                restaurantId={restaurantId}
                                netSales={derivedNetSales}
                                title="Payment totals"
                                subtitle="Uses payment methods from Manage → Settings → Payments."
                                showBars
                            />
                        </TabsContent>
                        <TabsContent value="categories" className="m-0">
                            <SnapshotListCard title="Sales By Category" rows={salesByCategory} labelKeys={["category", "category_name", "name"]} valueKeys={["sales", "amount", "total"]} />
                        </TabsContent>
                        <TabsContent value="tables" className="m-0">
                            <SnapshotListCard title="Sales By Table" rows={salesByTable} labelKeys={["table", "table_name", "name"]} valueKeys={["sales", "amount", "total"]} tableNameMap={tableNameMap} />
                        </TabsContent>
                        <TabsContent value="expenses" className="m-0">
                            <SnapshotListCard title="Expenses By Category" rows={snapshot?.manual_expenses_by_category || []} labelKeys={["name"]} valueKeys={["amount"]} />
                        </TabsContent>
                    </div>
                </Tabs>
            </div>
            
            <div className="pt-4 flex justify-end">
                <Button onClick={handleContinue} disabled={initiating} className="gap-2">
                    {initiating ? "Starting..." : "Confirm & Reconcile"} <ChevronRight className="w-4 h-4" />
                </Button>
            </div>
        </div>
    )
}

function SnapshotListCard({
    title,
    rows,
    labelKeys,
    valueKeys,
    tableNameMap,
}: {
    title: string;
    rows: any;
    labelKeys: string[];
    valueKeys: string[];
    tableNameMap?: Record<string, string>;
}) {
    const safeRows = Array.isArray(rows) ? rows : [];

    const formatTableLabel = (row: any): string | null => {
        if (!row || typeof row !== "object") return null;
        const area =
            row.table_category_name ||
            row.table_type_name ||
            row.area_name ||
            row.area ||
            row.section ||
            row.zone ||
            row.hall ||
            row.floor ||
            null;
        const table =
            row.table_name ||
            row.table ||
            row.name ||
            row.label ||
            row.table_no ||
            row.table_number ||
            null;
        if (!table) return null;
        return area ? `${area} - ${table}` : String(table);
    };

    const readValue = (row: any, keys: string[]) => {
        for (const key of keys) {
            const v = row?.[key];
            if (v != null && `${v}`.trim() !== "") return v;
        }
        return null;
    };

    return (
        <div className="rounded-xl border bg-slate-50 dark:bg-slate-900 p-3">
            <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-semibold mb-2">{title}</p>
            {safeRows.length === 0 ? (
                <p className="text-xs text-muted-foreground">No data available</p>
            ) : (
                <div className="space-y-1.5 max-h-44 overflow-auto pr-1">
                    {safeRows.slice(0, 12).map((row, idx) => {
                        const rawLabel = readValue(row, labelKeys);
                        const rawLabelText = rawLabel != null ? String(rawLabel) : null;
                        const mappedLabel = rawLabelText != null
                            ? (tableNameMap?.[rawLabelText] ?? tableNameMap?.[rawLabelText.toLowerCase()])
                            : undefined;
                        const label =
                            title.toLowerCase().includes("sales by table")
                                ? (formatTableLabel(row) ?? mappedLabel ?? rawLabel ?? `Table ${idx + 1}`)
                                : (rawLabel ?? `Item ${idx + 1}`);
                        const rawValue = readValue(row, valueKeys);
                        const num = typeof rawValue === "number"
                            ? rawValue
                            : typeof rawValue === "string"
                                ? Number(rawValue.replace(/[^0-9.-]/g, "")) || 0
                                : (() => {
                                    if (!rawValue || typeof rawValue !== "object") return 0;
                                    const amountLike = (rawValue as Record<string, any>).amount
                                        ?? (rawValue as Record<string, any>).total
                                        ?? (rawValue as Record<string, any>).value
                                        ?? (rawValue as Record<string, any>).sales;
                                    if (typeof amountLike === "number") return amountLike;
                                    if (typeof amountLike === "string") return Number(amountLike.replace(/[^0-9.-]/g, "")) || 0;
                                    return 0;
                                })();
                        
                        const isExpense = title.toLowerCase().includes("expense");
                        let valColor = isExpense ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400";
                        if (num < 0) valColor = "text-rose-600 dark:text-rose-400";

                        return (
                            <div key={`${label}-${idx}`} className="flex items-center justify-between rounded-lg border border-black/5 dark:border-white/10 bg-background px-2 py-1.5">
                                <span className="text-xs font-medium truncate pr-2">{label}</span>
                                <span className={cn("text-xs font-bold whitespace-nowrap", valColor)}>Rs. {num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function CashReconciliationStep({ onNext, snapshot, dayCloseId }: { onNext: (data: any) => void; snapshot: any; dayCloseId: number | null }) {
    const [actualCash, setActualCash] = useState<string>('');
    const [confirmationNotes, setConfirmationNotes] = useState<string>('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async () => {
        if (!dayCloseId) {
            setError("Missing Day Close ID. Please restart the process.");
            return;
        }

        setSubmitting(true);
        setError(null);
        try {
             const res = await apiClient.post(DayCloseApis.confirm(dayCloseId), {
                 actual_cash: Number(actualCash),
                 confirmation_notes: confirmationNotes
             });
             if (res.data.status === 'success') {
                 onNext(res.data.data);
             } else {
                 setError(res.data.message || "Failed to submit day close.");
             }
        } catch (err: any) {
            console.error("Failed to confirm day close", err);
            setError(err.response?.data?.message || "Failed to submit day close.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
             <div className="flex items-center gap-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 rounded-xl border border-emerald-100 dark:border-emerald-900/50">
                <div className="p-2 bg-white dark:bg-emerald-950 rounded-lg">
                    <Receipt className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="font-semibold">Cash Reconciliation</h3>
                    <p className="text-xs opacity-80">Verify physical cash on hand</p>
                </div>
            </div>

            <div className="space-y-4">
                 <div className="p-4 border rounded-xl bg-slate-50 dark:bg-slate-900">
                     <p className="text-sm font-medium mb-2">Expected Cash</p>
                     <p className="text-2xl font-bold text-slate-700 dark:text-slate-200">
                        Rs. {Number(snapshot?.expected_cash ?? snapshot?.cash_collected ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                     </p>
                 </div>
                 
                 <div className="space-y-2">
                     <label className="text-sm font-medium">Actual Cash Count</label>
                     <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">Rs.</span>
                        <input 
                            type="number" 
                            className="w-full text-2xl p-4 pl-12 rounded-xl border bg-background" 
                            placeholder="0.00"
                            value={actualCash}
                            onChange={(e) => setActualCash(e.target.value)}
                        />
                     </div>
                 </div>

                 <div className="space-y-2">
                     <label className="text-sm font-medium">Notes (Optional)</label>
                     <textarea 
                        className="w-full p-3 rounded-xl border bg-background text-sm" 
                        placeholder="Any discrepancies or comments..."
                        rows={3}
                        value={confirmationNotes}
                        onChange={(e) => setConfirmationNotes(e.target.value)}
                     />
                 </div>

                 {error && (
                     <div className="p-3 bg-red-100 text-red-600 text-sm rounded-lg flex items-center gap-2">
                         <AlertTriangle className="w-4 h-4" />
                         {error}
                     </div>
                 )}
            </div>

            <div className="pt-4 flex justify-end">
                <Button 
                    onClick={handleSubmit} 
                    disabled={submitting || !actualCash}
                    variant="default" 
                    className="gap-2 bg-green-600 hover:bg-green-700"
                >
                    {submitting ? "Closing..." : "Submit Day Close"} <CheckCircle2 className="w-4 h-4" />
                </Button>
            </div>
        </div>
    )
}

function SuccessStep({ onClose, data }: { onClose: () => void; data: any }) {
    const discrepancy = Number(data?.cash_discrepancy || 0);
    const isMatched = Math.abs(discrepancy) < 0.01;
    const isOverage = discrepancy > 0;

    return (
        <div className="flex flex-col items-center justify-center h-full text-center space-y-6 py-6">
            <div className={cn(
                "w-20 h-20 rounded-full flex items-center justify-center border-4",
                isMatched ? "bg-green-100 text-green-600 border-green-200" :
                isOverage ? "bg-blue-100 text-blue-600 border-blue-200" :
                "bg-red-100 text-red-600 border-red-200"
            )}>
                {isMatched ? <CheckCircle2 className="w-10 h-10" /> : <AlertTriangle className="w-10 h-10" />}
            </div>
            
            <div className="space-y-2">
                <h2 className="text-2xl font-bold">
                    {isMatched ? "Day Closed Successfully!" : "Day Closed with Discrepancy"}
                </h2>
                <p className="text-muted-foreground max-w-xs mx-auto text-sm">
                    All reports have been generated and the sales register has been reset for tomorrow.
                </p>
            </div>

            {!isMatched && (
                <div className={cn(
                    "p-4 rounded-xl border w-full max-w-sm mx-auto text-left",
                    isOverage ? "bg-blue-50 border-blue-100 dark:bg-blue-900/20" : "bg-red-50 border-red-100 dark:bg-red-900/20"
                )}>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                         <span className="text-muted-foreground">Expected:</span>
                         <span className="font-mono text-right font-medium">Rs. {Number(data?.expected_cash || 0).toFixed(2)}</span>
                         
                         <span className="text-muted-foreground">Actual:</span>
                         <span className="font-mono text-right font-medium">Rs. {Number(data?.actual_cash || 0).toFixed(2)}</span>
                         
                         <div className="col-span-2 h-px bg-slate-200 dark:bg-slate-700 my-1" />
                         
                         <span className="font-semibold">{isOverage ? "Overage:" : "Shortage:"}</span>
                         <span className={cn("font-mono text-right font-bold", isOverage ? "text-blue-600" : "text-red-600")}>
                             {isOverage ? "+" : ""}
                             Rs. {discrepancy.toFixed(2)}
                         </span>
                    </div>
                    <div className="mt-3 text-xs bg-white dark:bg-slate-950 p-2 rounded border border-black/5 dark:border-white/5 mx-auto text-center">
                        {isOverage ? "Recorded as Income Entry" : "Recorded as Expense Entry"}
                    </div>
                </div>
            )}

            <Button onClick={onClose} size="lg" className="min-w-[200px]">
                Done
            </Button>
        </div>
    )
}

function Activity(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  )
}
