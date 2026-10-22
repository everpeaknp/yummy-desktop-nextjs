"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Banknote,
  Loader2,
  MoreHorizontal,
  Plus,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import apiClient from "@/lib/api-client";
import { DrawerSessionApis } from "@/lib/api/endpoints";
import { hasPermission } from "@/lib/role-permissions";
import { formatCurrency } from "@/lib/utils";
import type {
  DrawerAssignment,
  DrawerCashier,
  DrawerConfiguration,
} from "@/types/day-close";

type DrawerConfigForm = {
  business_line: string;
  station: string;
  drawer_key: string;
  name: string;
  standard_float: string;
  opening_variance_tolerance: string;
  closing_variance_tolerance: string;
  blind_count_enabled: boolean;
  is_active: boolean;
};

const emptyDrawerForm = (businessLine = "restaurant"): DrawerConfigForm => ({
  business_line: businessLine,
  station: "general",
  drawer_key: "",
  name: "",
  standard_float: "0",
  opening_variance_tolerance: "0",
  closing_variance_tolerance: "100",
  blind_count_enabled: true,
  is_active: true,
});

/**
 * Restaurant-wide drawer controls (on/off) and drawer configuration
 * (create/edit tills, float rules, cashier assignment). This is the one
 * place both the operational Cash Drawers workspace and the Finance setup
 * hub link to -- see FINANCE setup migration: this used to live on the old
 * Manage / Settings / Payments & POS page, hidden behind a dead link once
 * that page was redesigned.
 */
export function CashDrawerConfigPanel({
  restaurantId,
  hotelEnabled,
  businessLine,
  currency,
}: {
  restaurantId: number;
  hotelEnabled: boolean;
  businessLine: "restaurant" | "hotel";
  currency?: string | null;
}) {
  const user = useAuth((state) => state.user);
  const [saving, setSaving] = useState(false);
  const [drawerConfigs, setDrawerConfigs] = useState<DrawerConfiguration[]>([]);
  const [drawerAssignments, setDrawerAssignments] = useState<
    DrawerAssignment[]
  >([]);
  const [drawerCashiers, setDrawerCashiers] = useState<DrawerCashier[]>([]);
  const [drawerAssignSelection, setDrawerAssignSelection] = useState<
    Record<string, string>
  >({});
  const [editingAssignmentKey, setEditingAssignmentKey] = useState<
    string | null
  >(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerControlsEnabled, setDrawerControlsEnabled] = useState(false);
  const [drawerControlsSaving, setDrawerControlsSaving] = useState(false);
  const [cashControlMode, setCashControlMode] = useState<
    "separate" | "combined"
  >("separate");
  const [policyMode, setPolicyMode] = useState<"separate" | "combined">(
    "separate",
  );
  const [policyEffectiveFrom, setPolicyEffectiveFrom] = useState("");
  const [policyReason, setPolicyReason] = useState("");
  const [policySaving, setPolicySaving] = useState(false);
  const [drawerDialog, setDrawerDialog] = useState<{
    open: boolean;
    id: number | null;
  }>({
    open: false,
    id: null,
  });
  const [drawerForm, setDrawerForm] = useState<DrawerConfigForm>(() =>
    emptyDrawerForm(businessLine),
  );

  const isDrawerAdmin = user?.role === "admin" || user?.role === "superadmin";
  const canConfigureDrawers =
    isDrawerAdmin || hasPermission(user, "finance.accounting.setup");
  const canAssignDrawers =
    isDrawerAdmin || hasPermission(user, "finance.drawer.assign");
  const canManageDrawers = canAssignDrawers || canConfigureDrawers;

  const tomorrowIso = () => {
    const value = new Date();
    value.setDate(value.getDate() + 1);
    return value.toISOString().slice(0, 10);
  };

  const loadDrawerConfigurations = useCallback(async () => {
    if (!restaurantId) return;
    setDrawerLoading(true);
    try {
      const policyRes = await apiClient.get(
        DrawerSessionApis.cashControlPolicy({ restaurantId }),
      );
      const activeMode =
        policyRes.data?.data?.mode === "combined" ? "combined" : "separate";
      const physicalScope = activeMode === "combined" ? "shared" : businessLine;
      const [configRes, assignmentRes, cashierRes, controlsRes] =
        await Promise.all([
          apiClient.get(
            DrawerSessionApis.configurations({
              restaurantId,
              businessLine: physicalScope,
            }),
          ),
          apiClient.get(
            DrawerSessionApis.assignments({
              restaurantId,
              businessLine: physicalScope,
            }),
          ),
          apiClient.get(DrawerSessionApis.cashiers({ restaurantId })),
          apiClient.get(DrawerSessionApis.controls({ restaurantId })),
        ]);
      setDrawerConfigs(
        Array.isArray(configRes.data?.data) ? configRes.data.data : [],
      );
      setDrawerAssignments(
        Array.isArray(assignmentRes.data?.data) ? assignmentRes.data.data : [],
      );
      setDrawerCashiers(
        Array.isArray(cashierRes.data?.data) ? cashierRes.data.data : [],
      );
      setDrawerControlsEnabled(Boolean(controlsRes.data?.data?.enabled));
      setCashControlMode(activeMode);
      setPolicyMode(activeMode);
      setPolicyEffectiveFrom(
        policyRes.data?.data?.effective_from ?? tomorrowIso(),
      );
      setPolicyReason(policyRes.data?.data?.reason ?? "");
    } catch (err: any) {
      const status = err?.response?.status;
      if (status !== 403) {
        toast.error("Failed to load cash drawers");
      }
      setDrawerConfigs([]);
      setDrawerAssignments([]);
      setDrawerCashiers([]);
      setDrawerControlsEnabled(false);
    } finally {
      setDrawerLoading(false);
    }
  }, [restaurantId, businessLine]);

  const saveCashControlPolicy = async () => {
    if (!restaurantId || !canConfigureDrawers) return;
    if (!policyEffectiveFrom) {
      toast.error(
        "Choose the future date when this cash-control change takes effect",
      );
      return;
    }
    try {
      setPolicySaving(true);
      await apiClient.put(DrawerSessionApis.saveCashControlPolicy, {
        restaurant_id: restaurantId,
        mode: policyMode,
        effective_from: policyEffectiveFrom,
        reason: policyReason.trim() || undefined,
      });
      toast.success(
        "Cash-control policy scheduled. Closed days remain unchanged.",
      );
      await loadDrawerConfigurations();
    } catch (err) {
      console.error("Failed to schedule cash-control policy", err);
      toast.error("Failed to schedule cash-control policy");
    } finally {
      setPolicySaving(false);
    }
  };

  useEffect(() => {
    if (canManageDrawers) void loadDrawerConfigurations();
  }, [canManageDrawers, loadDrawerConfigurations]);

  const drawerScopeKey = (line: string, station: string, drawerKey: string) =>
    `${line}::${station}::${drawerKey}`;

  const activeAssignmentsForDrawer = (drawer: DrawerConfiguration) =>
    drawerAssignments.filter(
      (assignment) =>
        assignment.is_active &&
        (assignment.business_line || "restaurant") ===
          (drawer.business_line || "restaurant") &&
        assignment.station === drawer.station &&
        assignment.drawer_key === drawer.drawer_key,
    );

  const cashierLabel = (cashierId: number) => {
    const cashier = drawerCashiers.find(
      (row) => Number(row.id) === Number(cashierId),
    );
    return cashier
      ? `${cashier.name} (${cashier.email})`
      : `User #${cashierId}`;
  };

  const cashierFor = (cashierId: number) =>
    drawerCashiers.find((row) => Number(row.id) === Number(cashierId));

  function openDrawerDialog(config?: DrawerConfiguration) {
    if (!canConfigureDrawers) {
      toast.error("Drawer configuration requires accounting setup permission");
      return;
    }
    if (!config) {
      setDrawerForm(
        emptyDrawerForm(
          cashControlMode === "combined" ? "shared" : businessLine,
        ),
      );
      setDrawerDialog({ open: true, id: null });
      return;
    }
    setDrawerForm({
      business_line: String(config.business_line || "restaurant"),
      station: String(config.station || "general"),
      drawer_key: String(config.drawer_key || ""),
      name: String(config.name || ""),
      standard_float: String(config.standard_float ?? 0),
      opening_variance_tolerance: String(
        config.opening_variance_tolerance ?? 0,
      ),
      closing_variance_tolerance: String(
        config.closing_variance_tolerance ?? 100,
      ),
      blind_count_enabled: config.blind_count_enabled !== false,
      is_active: config.is_active !== false,
    });
    setDrawerDialog({ open: true, id: config.id });
  }

  const handleDrawerSave = async () => {
    if (!restaurantId) return;
    if (!canConfigureDrawers) {
      toast.error("Drawer configuration requires accounting setup permission");
      return;
    }
    const station = drawerForm.station.trim().toLowerCase();
    const drawerKey = drawerForm.drawer_key.trim().toLowerCase();
    const name = drawerForm.name.trim();
    if (!station || !drawerKey || !name) {
      toast.error("Drawer name, station, and key are required");
      return;
    }
    try {
      setSaving(true);
      await apiClient.put(DrawerSessionApis.saveConfiguration, {
        restaurant_id: restaurantId,
        business_line: drawerForm.business_line,
        station,
        drawer_key: drawerKey,
        name,
        standard_float: Number(drawerForm.standard_float || 0),
        opening_variance_tolerance: Number(
          drawerForm.opening_variance_tolerance || 0,
        ),
        closing_variance_tolerance: Number(
          drawerForm.closing_variance_tolerance || 0,
        ),
        blind_count_enabled: drawerForm.blind_count_enabled,
        is_active: drawerForm.is_active,
      });
      toast.success("Cash drawer saved");
      setDrawerDialog({ open: false, id: null });
      setDrawerForm(
        emptyDrawerForm(
          cashControlMode === "combined" ? "shared" : businessLine,
        ),
      );
      await loadDrawerConfigurations();
    } catch (err) {
      console.error("Failed to save cash drawer", err);
      toast.error("Failed to save cash drawer");
    } finally {
      setSaving(false);
    }
  };

  const handleDrawerDeactivate = async (config: DrawerConfiguration) => {
    if (!restaurantId) return;
    if (!canConfigureDrawers) {
      toast.error("Drawer configuration requires accounting setup permission");
      return;
    }
    try {
      setSaving(true);
      await apiClient.put(DrawerSessionApis.saveConfiguration, {
        restaurant_id: restaurantId,
        business_line: config.business_line || "restaurant",
        station: config.station,
        drawer_key: config.drawer_key,
        name: config.name,
        standard_float: Number(config.standard_float ?? 0),
        opening_variance_tolerance: Number(
          config.opening_variance_tolerance ?? 0,
        ),
        closing_variance_tolerance: Number(
          config.closing_variance_tolerance ?? 0,
        ),
        blind_count_enabled: config.blind_count_enabled !== false,
        is_active: false,
      });
      toast.success("Cash drawer deactivated");
      await loadDrawerConfigurations();
    } catch (err) {
      console.error("Failed to deactivate cash drawer", err);
      toast.error("Failed to deactivate cash drawer");
    } finally {
      setSaving(false);
    }
  };

  const handleAssignCashier = async (drawer: DrawerConfiguration) => {
    if (!restaurantId) return;
    if (!canAssignDrawers) {
      toast.error("Cash drawer assignment permission is required");
      return;
    }
    const key = drawerScopeKey(
      drawer.business_line || businessLine,
      drawer.station,
      drawer.drawer_key,
    );
    const cashierId = Number(drawerAssignSelection[key]);
    if (!cashierId) {
      toast.error("Select a cashier first");
      return;
    }
    try {
      setSaving(true);
      await apiClient.put(DrawerSessionApis.saveAssignment, {
        restaurant_id: restaurantId,
        business_line: drawer.business_line || "restaurant",
        station: drawer.station,
        drawer_key: drawer.drawer_key,
        cashier_id: cashierId,
        is_active: true,
      });
      toast.success("Cashier assigned to drawer");
      setDrawerAssignSelection((current) => ({ ...current, [key]: "" }));
      setEditingAssignmentKey(null);
      await loadDrawerConfigurations();
    } catch (err) {
      console.error("Failed to assign cashier", err);
      toast.error("Failed to assign cashier");
    } finally {
      setSaving(false);
    }
  };

  const handleDrawerControlsToggle = async (enabled: boolean) => {
    if (!restaurantId) return;
    if (!canConfigureDrawers) {
      toast.error("Drawer controls require accounting setup permission");
      return;
    }
    setDrawerControlsSaving(true);
    try {
      await apiClient.post(
        DrawerSessionApis.setControls({ restaurantId, enabled }),
      );
      setDrawerControlsEnabled(enabled);
      toast.success(
        enabled ? "Drawer controls enabled" : "Drawer controls disabled",
      );
      await loadDrawerConfigurations();
    } catch (err) {
      console.error("Failed to update drawer controls", err);
      toast.error("Failed to update drawer controls");
    } finally {
      setDrawerControlsSaving(false);
    }
  };

  const handleRemoveDrawerAssignment = async (assignment: DrawerAssignment) => {
    if (!restaurantId) return;
    if (!canAssignDrawers) {
      toast.error("Cash drawer assignment permission is required");
      return;
    }
    try {
      setSaving(true);
      await apiClient.put(DrawerSessionApis.saveAssignment, {
        restaurant_id: restaurantId,
        business_line: assignment.business_line || businessLine,
        station: assignment.station,
        drawer_key: assignment.drawer_key,
        cashier_id: assignment.cashier_id,
        is_active: false,
      });
      toast.success("Cashier assignment removed");
      await loadDrawerConfigurations();
    } catch (err) {
      console.error("Failed to remove cashier assignment", err);
      toast.error("Failed to remove cashier assignment");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Cash drawers</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Configure tills, cashier assignment and closing rules.
        </p>
      </div>
      {hotelEnabled ? (
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Cash-control policy</CardTitle>
            <CardDescription>
              Choose whether Hotel and Restaurant use separate tills and
              separate closes, or one shared till and a combined close. This
              takes effect on a future date and never rewrites prior closes.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 lg:grid-cols-[1fr_180px_1fr_auto] lg:items-end">
            <div className="space-y-2">
              <Label>Cash custody</Label>
              <Select
                value={policyMode}
                onValueChange={(value) =>
                  setPolicyMode(value as "separate" | "combined")
                }
                disabled={!canConfigureDrawers || policySaving}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="separate">
                    Separate Hotel and Restaurant drawers
                  </SelectItem>
                  <SelectItem value="combined">
                    One shared Hotel and Restaurant drawer
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Effective from</Label>
              <Input
                type="date"
                min={tomorrowIso()}
                value={policyEffectiveFrom}
                onChange={(event) => setPolicyEffectiveFrom(event.target.value)}
                disabled={!canConfigureDrawers || policySaving}
              />
            </div>
            <div className="space-y-2">
              <Label>Reason (optional)</Label>
              <Input
                value={policyReason}
                onChange={(event) => setPolicyReason(event.target.value)}
                placeholder="e.g. shared front-desk till"
                disabled={!canConfigureDrawers || policySaving}
              />
            </div>
            <Button
              onClick={() => void saveCashControlPolicy()}
              disabled={!canConfigureDrawers || policySaving}
            >
              {policySaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}{" "}
              Schedule
            </Button>
            <p className="lg:col-span-4 text-xs text-muted-foreground">
              Active today:{" "}
              <span className="font-medium capitalize text-foreground">
                {cashControlMode}
              </span>
              . Financial documents keep their Hotel or Restaurant identity in
              both modes.
            </p>
          </CardContent>
        </Card>
      ) : null}
      <section id="drawer-configuration" className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Drawer list</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Tills available for this cash-control scope.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11"
              onClick={() => loadDrawerConfigurations()}
              disabled={drawerLoading || !canManageDrawers}
              aria-label="Refresh cash drawers"
            >
              {drawerLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
            {canConfigureDrawers ? (
              <Button
                size="sm"
                className="h-11 rounded-xl"
                onClick={() => openDrawerDialog()}
              >
                <Plus className="mr-1 h-4 w-4" />
                Add drawer
              </Button>
            ) : null}
          </div>
        </div>
        <div className="flex min-h-14 items-center justify-between gap-4 rounded-xl border border-border bg-background px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">Drawer controls</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Enable cash-drawer management for this business line.
            </p>
          </div>
          <Switch
            className="shrink-0"
            checked={drawerControlsEnabled}
            disabled={
              drawerLoading || drawerControlsSaving || !canConfigureDrawers
            }
            onCheckedChange={handleDrawerControlsToggle}
            aria-label="Toggle drawer controls"
          />
        </div>
        <div className="space-y-4">
          {!canManageDrawers ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900">
              Cash drawer assignment or accounting setup permission is required.
            </div>
          ) : !drawerControlsEnabled ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900">
              {canConfigureDrawers
                ? "Drawer controls are off. Enable them above before cashiers can open drawers, count cash, or submit settlement evidence."
                : "Drawer controls are off. Ask a setup user to enable them before assigning cashiers."}
            </div>
          ) : drawerLoading ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading cash drawers...
            </div>
          ) : drawerConfigs.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed rounded-lg bg-muted/20">
              <Banknote className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm text-muted-foreground">
                No cash drawers configured.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {drawerConfigs.map((drawer) => {
                const key = drawerScopeKey(
                  drawer.business_line || businessLine,
                  drawer.station,
                  drawer.drawer_key,
                );
                const assignments = activeAssignmentsForDrawer(drawer);
                const selectedCashier = drawerAssignSelection[key] || "";
                return (
                  <div
                    key={drawer.id}
                    className="space-y-4 rounded-xl border border-border bg-background p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold">{drawer.name}</p>
                          <Badge
                            variant={drawer.is_active ? "default" : "secondary"}
                            className="text-[10px]"
                          >
                            {drawer.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <p className="text-xs capitalize text-muted-foreground">
                          {drawer.business_line || businessLine} ·{" "}
                          {Number(drawer.standard_float || 0) === 0 &&
                          Number(drawer.opening_variance_tolerance || 0) === 0
                            ? "Flexible opening"
                            : "Fixed float"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {drawer.station} / {drawer.drawer_key}
                        </p>
                      </div>
                      {canConfigureDrawers ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-11 w-11 shrink-0"
                              aria-label={`Actions for ${drawer.name}`}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onSelect={() => openDrawerDialog(drawer)}
                            >
                              Edit drawer
                            </DropdownMenuItem>
                            {drawer.is_active ? (
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                disabled={saving}
                                onSelect={() =>
                                  void handleDrawerDeactivate(drawer)
                                }
                              >
                                Deactivate drawer
                              </DropdownMenuItem>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </div>
                    <dl className="grid gap-2 border-y border-border py-3 sm:grid-cols-3 sm:gap-3">
                      <div className="flex items-center justify-between gap-3 sm:block">
                        <dt className="text-[11px] text-muted-foreground">
                          Float
                        </dt>
                        <dd className="mt-1 text-sm font-medium tabular-nums">
                          {formatCurrency(drawer.standard_float, currency)}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-3 sm:block">
                        <dt className="text-[11px] text-muted-foreground">
                          Opening tolerance
                        </dt>
                        <dd className="mt-1 text-sm font-medium tabular-nums">
                          {formatCurrency(
                            drawer.opening_variance_tolerance,
                            currency,
                          )}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-3 sm:block">
                        <dt className="text-[11px] text-muted-foreground">
                          Closing tolerance
                        </dt>
                        <dd className="mt-1 text-sm font-medium tabular-nums">
                          {formatCurrency(
                            drawer.closing_variance_tolerance,
                            currency,
                          )}
                        </dd>
                      </div>
                    </dl>
                    <p className="text-xs text-muted-foreground">
                      {drawer.blind_count_enabled
                        ? "Blind closing count enabled"
                        : "Expected closing shown to cashier"}
                    </p>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">
                          Cashier
                        </p>
                        {assignments.length === 0 ? (
                          <p className="mt-1 text-sm">Not assigned</p>
                        ) : (
                          <div className="mt-1 space-y-2">
                            {assignments.map((assignment) => {
                              const cashier = cashierFor(assignment.cashier_id);
                              return (
                                <div
                                  key={assignment.id}
                                  className="flex items-start justify-between gap-3"
                                >
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium">
                                      {cashier?.name ||
                                        cashierLabel(assignment.cashier_id)}
                                    </p>
                                    {cashier?.email ? (
                                      <p className="truncate text-xs text-muted-foreground">
                                        {cashier.email}
                                      </p>
                                    ) : null}
                                  </div>
                                  {canAssignDrawers ? (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 shrink-0 text-destructive"
                                      disabled={saving}
                                      onClick={() =>
                                        handleRemoveDrawerAssignment(assignment)
                                      }
                                    >
                                      Remove
                                    </Button>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      {canAssignDrawers && editingAssignmentKey !== key ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="h-11 w-full rounded-xl sm:w-auto"
                          onClick={() => setEditingAssignmentKey(key)}
                        >
                          {assignments.length
                            ? "Change cashier"
                            : "Assign cashier"}
                        </Button>
                      ) : null}
                      {canAssignDrawers && editingAssignmentKey === key ? (
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Select
                            value={selectedCashier}
                            onValueChange={(value) =>
                              setDrawerAssignSelection((current) => ({
                                ...current,
                                [key]: value,
                              }))
                            }
                          >
                            <SelectTrigger className="h-11 rounded-xl">
                              <SelectValue
                                placeholder={
                                  assignments.length
                                    ? "Select replacement cashier"
                                    : "Assign cashier"
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {drawerCashiers.map((cashier) => (
                                <SelectItem
                                  key={cashier.id}
                                  value={String(cashier.id)}
                                >
                                  {cashier.name} ({cashier.email})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-11 rounded-xl"
                            disabled={saving || !selectedCashier}
                            onClick={() => handleAssignCashier(drawer)}
                          >
                            {assignments.length ? "Change" : "Assign"}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-11 rounded-xl"
                            onClick={() => setEditingAssignmentKey(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <Dialog
        open={drawerDialog.open}
        onOpenChange={(open) => setDrawerDialog({ ...drawerDialog, open })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {drawerDialog.id !== null
                ? "Edit Cash Drawer"
                : "Add Cash Drawer"}
            </DialogTitle>
            <DialogDescription>
              Use one drawer per physical cash till or cashier station. Set
              standard float to 0 for flexible daily opening cash.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label>Business area</Label>
                <Select
                  value={drawerForm.business_line}
                  disabled={drawerDialog.id !== null}
                  onValueChange={(value) =>
                    setDrawerForm({ ...drawerForm, business_line: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select business area" />
                  </SelectTrigger>
                  <SelectContent>
                    {cashControlMode === "combined" ? (
                      <SelectItem value="shared">
                        Shared Hotel & Restaurant
                      </SelectItem>
                    ) : (
                      <>
                        <SelectItem value="restaurant">
                          Restaurant POS
                        </SelectItem>
                        {hotelEnabled ? (
                          <SelectItem value="hotel">
                            Hotel / front desk
                          </SelectItem>
                        ) : null}
                      </>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Cash payments are resolved only against an open drawer in this
                  area.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Drawer Name</Label>
                <Input
                  value={drawerForm.name}
                  onChange={(e) =>
                    setDrawerForm({ ...drawerForm, name: e.target.value })
                  }
                  placeholder="e.g. Front Counter Drawer"
                />
              </div>
              <div className="space-y-2">
                <Label>Station</Label>
                <Input
                  value={drawerForm.station}
                  disabled={drawerDialog.id !== null}
                  onChange={(e) =>
                    setDrawerForm({ ...drawerForm, station: e.target.value })
                  }
                  placeholder="e.g. front-counter"
                />
              </div>
              <div className="space-y-2">
                <Label>Drawer Key</Label>
                <Input
                  value={drawerForm.drawer_key}
                  disabled={drawerDialog.id !== null}
                  onChange={(e) =>
                    setDrawerForm({ ...drawerForm, drawer_key: e.target.value })
                  }
                  placeholder="e.g. drawer-1"
                />
              </div>
              <div className="space-y-2">
                <Label>Standard Float</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={drawerForm.standard_float}
                  onChange={(e) =>
                    setDrawerForm({
                      ...drawerForm,
                      standard_float: e.target.value,
                    })
                  }
                  placeholder="0.00"
                />
                <p className="text-[11px] text-muted-foreground">
                  Use 0 for flexible opening cash.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Opening Variance Tolerance</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={drawerForm.opening_variance_tolerance}
                  onChange={(e) =>
                    setDrawerForm({
                      ...drawerForm,
                      opening_variance_tolerance: e.target.value,
                    })
                  }
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Closing Variance Tolerance</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={drawerForm.closing_variance_tolerance}
                  onChange={(e) =>
                    setDrawerForm({
                      ...drawerForm,
                      closing_variance_tolerance: e.target.value,
                    })
                  }
                  placeholder="100.00"
                />
              </div>
            </div>
            <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label>Blind Closing Count</Label>
                  <p className="text-xs text-muted-foreground">
                    Hide expected closing cash while cashier counts the drawer.
                  </p>
                </div>
                <Switch
                  checked={drawerForm.blind_count_enabled}
                  onCheckedChange={(val) =>
                    setDrawerForm({ ...drawerForm, blind_count_enabled: val })
                  }
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label>Active</Label>
                  <p className="text-xs text-muted-foreground">
                    Inactive drawers cannot be selected for new sessions.
                  </p>
                </div>
                <Switch
                  checked={drawerForm.is_active}
                  onCheckedChange={(val) =>
                    setDrawerForm({ ...drawerForm, is_active: val })
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDrawerDialog({ open: false, id: null })}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDrawerSave}
              disabled={
                saving ||
                !drawerForm.name.trim() ||
                !drawerForm.station.trim() ||
                !drawerForm.drawer_key.trim()
              }
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Save Drawer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
