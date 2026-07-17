"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Ban, Loader2, PencilLine, RefreshCw, RotateCcw, Search } from "lucide-react";

import apiClient from "@/lib/api-client";
import { InventoryApis } from "@/lib/api/endpoints";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

type ActivityAction = "correct" | "cancel" | "return";

type InventoryActivity = {
  id: string;
  movement_id: number;
  adjustment_id?: number | null;
  inventory_item_id: number;
  item_name: string;
  item_unit: string;
  activity_type: string;
  lifecycle_status: string;
  quantity_delta: number | string;
  previous_stock: number | string;
  resulting_stock: number | string;
  cost?: number | string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  supplier_name?: string | null;
  reason?: string | null;
  created_by_name?: string | null;
  created_at: string;
  can_correct: boolean;
  can_cancel: boolean;
  can_return: boolean;
  management_block_reason?: string | null;
  reversal_of_adjustment_id?: number | null;
  replacement_adjustment_id?: number | null;
};

type CashDrawer = {
  id: number;
  name?: string;
  drawer_key?: string;
  station?: string;
  business_date?: string;
};

type Props = {
  restaurantId: number;
  canManage: boolean;
  focusAdjustmentId?: number | null;
  cashDrawerControlsEnabled: boolean;
  cashDrawerSessions: CashDrawer[];
  selectedCashDrawerSessionId: string;
  onCashDrawerSessionChange: (value: string) => void;
  onInventoryChanged: () => void | Promise<void>;
};

const actionLabels: Record<ActivityAction, string> = {
  correct: "Correct purchase",
  cancel: "Cancel purchase",
  return: "Return to supplier",
};

const humanize = (value?: string | null) =>
  String(value || "unknown")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const statusClass = (status: string) => {
  switch (status) {
    case "posted":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400";
    case "cancelled":
    case "returned":
      return "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300";
    case "corrected":
    case "partially_returned":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400";
    default:
      return "";
  }
};

export function InventoryActivityPanel({
  restaurantId,
  canManage,
  focusAdjustmentId,
  cashDrawerControlsEnabled,
  cashDrawerSessions,
  selectedCashDrawerSessionId,
  onCashDrawerSessionChange,
  onInventoryChanged,
}: Props) {
  const { toast } = useToast();
  const [activities, setActivities] = useState<InventoryActivity[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activityType, setActivityType] = useState("all");
  const [lifecycleStatus, setLifecycleStatus] = useState("all");
  const [selected, setSelected] = useState<InventoryActivity | null>(null);
  const [action, setAction] = useState<ActivityAction | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    quantity: "",
    cost: "",
    reason: "",
    settlement: "refund_received",
  });

  const loadActivity = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get(
        InventoryApis.activity({
          restaurantId,
          activityType,
          lifecycleStatus,
          limit: 500,
        }),
      );
      const data = response.data?.data || {};
      setActivities(Array.isArray(data.activities) ? data.activities : []);
      setTotal(Number(data.total || 0));
    } catch (error: any) {
      setActivities([]);
      setTotal(0);
      toast({
        title: "Could not load inventory activity",
        description: error.response?.data?.detail || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [activityType, lifecycleStatus, restaurantId, toast]);

  useEffect(() => {
    void loadActivity();
  }, [loadActivity]);

  const visibleActivities = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return activities;
    return activities.filter((row) =>
      [row.item_name, row.activity_type, row.lifecycle_status, row.supplier_name, row.created_by_name, row.reason]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [activities, search]);

  const openAction = (row: InventoryActivity, nextAction: ActivityAction) => {
    setSelected(row);
    setAction(nextAction);
    setForm({
      quantity: nextAction === "cancel" ? "" : String(Math.abs(Number(row.quantity_delta || 0))),
      cost: nextAction === "correct" ? String(Number(row.cost || 0)) : "",
      reason: "",
      settlement: "refund_received",
    });
  };

  const closeAction = () => {
    if (submitting) return;
    setSelected(null);
    setAction(null);
  };

  const selectedNeedsCashDrawer =
    String(selected?.payment_method || "").toLowerCase() === "cash" && cashDrawerControlsEnabled;

  const submitAction = async () => {
    if (!selected?.adjustment_id || !action) return;
    if (form.reason.trim().length < 3) {
      toast({
        title: "Reason required",
        description: "Enter at least three characters so the audit record is meaningful.",
        variant: "destructive",
      });
      return;
    }
    if (action !== "cancel" && Number(form.quantity) <= 0) {
      toast({ title: "Invalid quantity", description: "Quantity must be greater than zero.", variant: "destructive" });
      return;
    }
    if (action === "correct" && Number(form.cost) < 0) {
      toast({ title: "Invalid cost", description: "Cost cannot be negative.", variant: "destructive" });
      return;
    }
    if (selectedNeedsCashDrawer && !selectedCashDrawerSessionId) {
      toast({
        title: "Cash drawer required",
        description: "Select an open cash drawer for the refund or corrected payment.",
        variant: "destructive",
      });
      return;
    }

    const drawer = selectedNeedsCashDrawer
      ? { drawer_session_id: Number(selectedCashDrawerSessionId) }
      : {};
    const reason = form.reason.trim();
    let endpoint: string;
    let payload: Record<string, unknown>;
    if (action === "cancel") {
      endpoint = InventoryApis.cancelPurchase(selected.adjustment_id);
      payload = { reason, ...drawer };
    } else if (action === "correct") {
      endpoint = InventoryApis.correctPurchase(selected.adjustment_id);
      payload = { quantity: Number(form.quantity), cost: Number(form.cost), reason, ...drawer };
    } else {
      endpoint = InventoryApis.returnPurchase(selected.adjustment_id);
      payload = {
        quantity: Number(form.quantity),
        reason,
        settlement: form.settlement,
        ...drawer,
      };
    }

    setSubmitting(true);
    try {
      await apiClient.post(endpoint, payload);
      toast({
        title: `${actionLabels[action]} recorded`,
        description: "Stock and finance were reversed through an auditable activity entry.",
      });
      setSelected(null);
      setAction(null);
      await Promise.all([loadActivity(), Promise.resolve(onInventoryChanged())]);
    } catch (error: any) {
      toast({
        title: `${actionLabels[action]} failed`,
        description: error.response?.data?.detail || "The purchase could not be changed.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const drawerLabel = (drawer: CashDrawer) =>
    `${drawer.name || drawer.drawer_key || "Drawer"} · ${drawer.station || "general"} · ${drawer.business_date || ""}`.trim();

  return (
    <>
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Inventory activity</h2>
            <p className="text-sm text-muted-foreground">
              {total} stock movement{total === 1 ? "" : "s"}. Purchases are corrected with linked reversal entries, never erased.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void loadActivity()} disabled={loading}>
            <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} /> Refresh
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_180px_190px]">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search item, user, supplier or reason"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Select value={activityType} onValueChange={setActivityType}>
            <SelectTrigger><SelectValue placeholder="Activity type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All activities</SelectItem>
              <SelectItem value="purchase">Purchases</SelectItem>
              <SelectItem value="return">Returns</SelectItem>
              <SelectItem value="waste_damage">Waste / damage</SelectItem>
              <SelectItem value="correction">Corrections</SelectItem>
            </SelectContent>
          </Select>
          <Select value={lifecycleStatus} onValueChange={setLifecycleStatus}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="posted">Posted</SelectItem>
              <SelectItem value="corrected">Corrected</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="partially_returned">Partially returned</SelectItem>
              <SelectItem value="returned">Returned</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex h-56 items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-6 w-6 animate-spin" /> Loading activity…
          </div>
        ) : visibleActivities.length === 0 ? (
          <div className="flex h-56 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
            No matching inventory activity.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[1120px] text-left text-sm">
              <thead className="border-b bg-muted text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Item / activity</th>
                  <th className="px-4 py-3">Stock change</th>
                  <th className="px-4 py-3">Cost / payment</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Recorded by</th>
                  <th className="px-4 py-3 text-right">Manage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleActivities.map((row) => {
                  const highlighted = Number(row.adjustment_id) === Number(focusAdjustmentId);
                  const quantity = Number(row.quantity_delta || 0);
                  return (
                    <tr key={row.id} className={cn("align-top hover:bg-muted/40", highlighted && "bg-orange-50 dark:bg-orange-950/20")}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-foreground">{row.item_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {humanize(row.activity_type)}{row.reason ? ` · ${row.reason}` : ""}
                        </p>
                        {row.supplier_name ? <p className="mt-1 text-xs text-muted-foreground">Supplier: {row.supplier_name}</p> : null}
                      </td>
                      <td className="px-4 py-3">
                        <p className={cn("font-semibold", quantity >= 0 ? "text-emerald-600" : "text-red-600")}>
                          {quantity >= 0 ? "+" : ""}{quantity.toLocaleString()} {row.item_unit}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {Number(row.previous_stock).toLocaleString()} → {Number(row.resulting_stock).toLocaleString()}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p>{row.cost == null ? "—" : `Rs. ${Number(row.cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}</p>
                        <p className="text-xs capitalize text-muted-foreground">
                          {[row.payment_method, row.payment_status].filter(Boolean).join(" · ") || "No payment"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={statusClass(row.lifecycle_status)}>{humanize(row.lifecycle_status)}</Badge>
                        {row.replacement_adjustment_id ? (
                          <p className="mt-1 text-xs text-muted-foreground">Replacement #{row.replacement_adjustment_id}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <p>{row.created_by_name || "System"}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(row.created_at).toLocaleString()}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canManage && row.adjustment_id && (row.can_correct || row.can_cancel || row.can_return) ? (
                          <div className="flex justify-end gap-1">
                            {row.can_correct ? (
                              <Button size="sm" variant="ghost" onClick={() => openAction(row, "correct")} title="Correct purchase">
                                <PencilLine className="h-4 w-4" />
                              </Button>
                            ) : null}
                            {row.can_return ? (
                              <Button size="sm" variant="ghost" onClick={() => openAction(row, "return")} title="Return to supplier">
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            ) : null}
                            {row.can_cancel ? (
                              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => openAction(row, "cancel")} title="Cancel purchase">
                                <Ban className="h-4 w-4" />
                              </Button>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground" title={row.management_block_reason || undefined}>Audit only</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={Boolean(selected && action)} onOpenChange={(open) => !open && closeAction()}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{action ? actionLabels[action] : "Manage purchase"}</DialogTitle>
            <DialogDescription>
              {selected?.item_name} purchase #{selected?.adjustment_id}. The original entry remains in the audit history.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {action !== "cancel" ? (
              <div className="grid gap-2">
                <Label htmlFor="activity_quantity">{action === "correct" ? "Correct quantity" : "Return quantity"}</Label>
                <Input
                  id="activity_quantity"
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={form.quantity}
                  onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))}
                />
              </div>
            ) : null}

            {action === "correct" ? (
              <div className="grid gap-2">
                <Label htmlFor="activity_cost">Correct total cost (NPR)</Label>
                <Input
                  id="activity_cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.cost}
                  onChange={(event) => setForm((current) => ({ ...current, cost: event.target.value }))}
                />
              </div>
            ) : null}

            {action === "return" ? (
              <div className="grid gap-2">
                <Label htmlFor="return_settlement">Settlement</Label>
                <Select value={form.settlement} onValueChange={(value) => setForm((current) => ({ ...current, settlement: value }))}>
                  <SelectTrigger id="return_settlement"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="refund_received">Refund received</SelectItem>
                    <SelectItem value="supplier_credit">Supplier credit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="grid gap-2">
              <Label htmlFor="activity_reason">Reason *</Label>
              <Input
                id="activity_reason"
                placeholder={action === "cancel" ? "e.g. Duplicate purchase entry" : "Describe the mistake or supplier return"}
                value={form.reason}
                onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}
              />
            </div>

            {selectedNeedsCashDrawer ? (
              <div className="grid gap-2">
                <Label htmlFor="activity_cash_drawer">Cash drawer</Label>
                <Select value={selectedCashDrawerSessionId} onValueChange={onCashDrawerSessionChange}>
                  <SelectTrigger id="activity_cash_drawer"><SelectValue placeholder="Select open cash drawer" /></SelectTrigger>
                  <SelectContent>
                    {cashDrawerSessions.length ? cashDrawerSessions.map((drawer) => (
                      <SelectItem key={drawer.id} value={String(drawer.id)}>{drawerLabel(drawer)}</SelectItem>
                    )) : <SelectItem value="none" disabled>No open cash drawers</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
              This creates linked reversal entries for stock, expense/accounting, supplier balance, and cash drawer records where applicable.
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeAction} disabled={submitting}>Keep purchase</Button>
            <Button
              onClick={() => void submitAction()}
              disabled={submitting}
              variant={action === "cancel" ? "destructive" : "default"}
              className={action === "cancel" ? undefined : "bg-orange-600 text-white hover:bg-orange-700"}
            >
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {action ? actionLabels[action] : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
