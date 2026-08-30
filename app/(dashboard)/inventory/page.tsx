"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api-client";
import { DrawerSessionApis, InventoryApis, SupplierApis } from "@/lib/api/endpoints";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Package, AlertTriangle, ArrowUpDown, Loader2, Filter, History, Utensils } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InventoryConsumptionDialog } from "@/components/inventory/inventory-consumption-dialog";
import { InventoryActivityPanel } from "@/components/inventory/inventory-activity-panel";
import { CashBankAccountSelect, type CashBankAccountOption } from "@/components/finance/cash-bank-account-select";
import { ReasonCodeSelect } from "@/components/inventory/reason-code-select";
import { InventoryItemDetailsSheet } from "@/components/inventory/inventory-item-details-sheet";
import { StationPicker } from "@/components/stations/station-picker";

export default function InventoryPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [inventoryView, setInventoryView] = useState<"items" | "activity">("items");
  const [focusAdjustmentId, setFocusAdjustmentId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [valuation, setValuation] = useState<any | null>(null);

  // Item details sheet -- opened by clicking a row; quick summary +
  // shortcuts into Add/Reduce/Count Stock and the full ledger.
  const [detailsItem, setDetailsItem] = useState<any | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Advanced ops: ledger history
  const [opsOpen, setOpsOpen] = useState(false);
  const [opsItem, setOpsItem] = useState<any | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledger, setLedger] = useState<{ movements: any[]; total: number } | null>(null);

  // Add Stock modal state -- never creates a purchase, expense, supplier
  // payable, payment, or supplier ledger entry, only a stock movement.
  const [addStockItem, setAddStockItem] = useState<any>(null);
  const [addStockForm, setAddStockForm] = useState({
    quantity: "",
    reason_code: "stock_count_correction",
    unit_cost: "",
    notes: "",
  });
  const [addStockSubmitting, setAddStockSubmitting] = useState(false);

  // Reduce Stock modal state -- never creates a purchase return, expense,
  // or supplier transaction, only a stock movement.
  const [reduceStockItem, setReduceStockItem] = useState<any>(null);
  const [reduceStockForm, setReduceStockForm] = useState({
    quantity: "",
    reason_code: "waste",
    notes: "",
    allow_negative: false,
  });
  const [reduceStockSubmitting, setReduceStockSubmitting] = useState(false);

  // Count Stock modal state -- records the delta between system and
  // counted quantity as a single Add/Reduce Stock movement.
  const [countStockItem, setCountStockItem] = useState<any>(null);
  const [countStockForm, setCountStockForm] = useState({ counted_quantity: "", notes: "" });
  const [countStockSubmitting, setCountStockSubmitting] = useState(false);

  // Add/Edit Modal State
  const [editingItem, setEditingItem] = useState<any>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [itemForm, setItemForm] = useState({
    name: "",
    station: "general",
    station_id: null as number | null,
    description: "",
    unit: "",
    current_stock: "",
    min_stock_level: "",
    opening_stock_total_cost: "",
    opening_stock_payment_status: "paid",
    opening_stock_payment_method: "cash",
    supplier_id: "",
    location: "",
    cost_per_unit: "",
    is_active: true,
  });
  const [itemSubmitting, setItemSubmitting] = useState(false);
  const [openingPaymentAccount, setOpeningPaymentAccount] = useState<CashBankAccountOption | null>(null);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [cashDrawerControlsEnabled, setCashDrawerControlsEnabled] = useState(false);
  const [cashDrawerSessions, setCashDrawerSessions] = useState<any[]>([]);
  const [selectedCashDrawerSessionId, setSelectedCashDrawerSessionId] = useState<string>("");
  const [consumeOpen, setConsumeOpen] = useState(false);


  const { toast } = useToast();

  const user = useAuth(state => state.user);
  const me = useAuth(state => state.me);
  const router = useRouter();
  const permissionKeys = new Set(user?.permissions || []);
  const normalizedRole = String(user?.role || user?.primary_role || "").toLowerCase();
  const isInventoryAdmin = normalizedRole === "admin" || normalizedRole === "superadmin";
  const canConsumeInventory =
    isInventoryAdmin ||
    permissionKeys.has("inventory.consume") ||
    permissionKeys.has("inventory.manage");
  const canOverrideNegativeStock =
    isInventoryAdmin || permissionKeys.has("inventory.negative_stock.override");
  const canManageInventory =
    isInventoryAdmin ||
    permissionKeys.has("inventory.manage") ||
    permissionKeys.has("inventory.stock.manage");

  // 1. Session Restoration & Auth Guard
  useEffect(() => {
    const checkAuth = async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      if (!user && token) await me();

      const updatedToken = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      if (!user && !updatedToken) router.push('/');
    };
    const timer = setTimeout(checkAuth, 500);
    return () => clearTimeout(timer);
  }, [user, me, router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("view") === "activity") setInventoryView("activity");
    const adjustmentId = Number(params.get("adjustment"));
    if (adjustmentId > 0) setFocusAdjustmentId(adjustmentId);
  }, []);

  const changeInventoryView = (view: "items" | "activity") => {
    setInventoryView(view);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (view === "activity") url.searchParams.set("view", "activity");
    else url.searchParams.delete("view");
    if (view === "items") url.searchParams.delete("adjustment");
    window.history.replaceState({}, "", url.toString());
  };

  // 2. Fetch Data
  const fetchInventory = async () => {
    if (!user?.restaurant_id) return;
    setLoading(true);

    try {
      const url = InventoryApis.listInventoryWithQuery({
        restaurantId: user.restaurant_id,
        lowStockOnly: activeTab === 'low_stock'
      });

      const [inventoryResult, valuationResult] = await Promise.allSettled([
        apiClient.get(url),
        apiClient.get(InventoryApis.valuation(user.restaurant_id)),
      ]);
      if (inventoryResult.status === "fulfilled" && inventoryResult.value.data.status === "success") {
        setItems(inventoryResult.value.data.data.items || inventoryResult.value.data.data || []);
      } else if (inventoryResult.status === "rejected") {
        throw inventoryResult.reason;
      }
      if (valuationResult.status === "fulfilled" && valuationResult.value.data.status === "success") {
        setValuation(valuationResult.value.data.data || null);
      } else {
        setValuation(null);
      }
    } catch (err) {
      console.error("Failed to fetch inventory:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    if (!user?.restaurant_id) return;
    try {
      const response = await apiClient.get(SupplierApis.listSuppliers(user.restaurant_id));
      if (response.data.status === "success") {
        const supplierData = response.data.data?.suppliers || [];
        setSuppliers(Array.isArray(supplierData) ? supplierData : []);
      }
    } catch (err) {
      console.error("Failed to fetch suppliers:", err);
      setSuppliers([]);
    }
  };

  const fetchCashDrawers = async () => {
    if (!user?.restaurant_id) return;
    try {
      const res = await apiClient.get(DrawerSessionApis.active({
        restaurantId: user.restaurant_id,
        businessLine: "restaurant",
      }));
      const message = String(res.data?.message || "").toLowerCase();
      if (message.includes("controls are disabled")) {
        setCashDrawerControlsEnabled(false);
        setCashDrawerSessions([]);
        setSelectedCashDrawerSessionId("");
        return;
      }
      const rows = Array.isArray(res.data?.data) ? res.data.data : [];
      const paymentReady = rows.filter((session: any) =>
        ["opened", "closing_count_required", "reopened"].includes(String(session.status || "").toLowerCase())
      );
      setCashDrawerControlsEnabled(true);
      setCashDrawerSessions(paymentReady);
      setSelectedCashDrawerSessionId((current) => {
        if (current && paymentReady.some((session: any) => String(session.id) === current)) return current;
        return paymentReady[0]?.id ? String(paymentReady[0].id) : "";
      });
    } catch (err) {
      console.error("Failed to fetch cash drawers:", err);
      setCashDrawerControlsEnabled(true);
      setCashDrawerSessions([]);
      setSelectedCashDrawerSessionId("");
    }
  };


  useEffect(() => {
    if (user?.restaurant_id) {
      fetchInventory();
      fetchSuppliers();
      fetchCashDrawers();
    }
  }, [user, activeTab]);

  const cashDrawerLabel = (session: any) =>
    `${session.name || session.drawer_key || "Drawer"} · ${session.station || "general"} · ${session.business_date || ""}`.trim();

  const drawerSessionIdForCashPayment = () => {
    if (!cashDrawerControlsEnabled) return undefined;
    if (!selectedCashDrawerSessionId) {
      toast({
        title: "Cash Drawer Required",
        description: "Select an open cash drawer before recording a cash inventory payment.",
        variant: "destructive",
      });
      return null;
    }
    return Number(selectedCashDrawerSessionId);
  };

  const renderCashDrawerSelect = (id: string) => {
    if (!cashDrawerControlsEnabled) return null;
    return (
      <div className="grid gap-2">
        <Label htmlFor={id}>Cash Drawer</Label>
        <Select value={selectedCashDrawerSessionId} onValueChange={setSelectedCashDrawerSessionId}>
          <SelectTrigger id={id}>
            <SelectValue placeholder="Select open cash drawer" />
          </SelectTrigger>
          <SelectContent>
            {cashDrawerSessions.length === 0 ? (
              <SelectItem value="none" disabled>
                No open cash drawers
              </SelectItem>
            ) : (
              cashDrawerSessions.map((session) => (
                <SelectItem key={session.id} value={String(session.id)}>
                  {cashDrawerLabel(session)}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        {cashDrawerSessions.length === 0 && (
          <p className="text-xs text-destructive">
            Open a cash drawer before recording cash inventory payments.
          </p>
        )}
      </div>
    );
  };

  const timezone = typeof window !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined;

  const openOps = (item: any) => {
    setOpsItem(item);
    setOpsOpen(true);
  };

  const fetchLedger = async (itemId: number) => {
    setLedgerLoading(true);
    try {
      const url = InventoryApis.getLedger({ itemId, skip: 0, limit: 200, timezone });
      const res = await apiClient.get(url);
      if (res.data?.status === "success") {
        const data = res.data?.data;
        setLedger({
          movements: data?.movements || [],
          total: Number(data?.total || 0),
        });
      } else {
        setLedger({ movements: [], total: 0 });
      }
    } catch (err: any) {
      toast({
        title: "Ledger Failed",
        description: err.response?.data?.detail || "Could not load ledger.",
        variant: "destructive",
      });
      setLedger({ movements: [], total: 0 });
    } finally {
      setLedgerLoading(false);
    }
  };

  useEffect(() => {
    if (!opsOpen || !opsItem?.id) return;
    fetchLedger(opsItem.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opsOpen, opsItem?.id]);


  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addStockItem || !addStockForm.quantity) return;

    setAddStockSubmitting(true);
    try {
      const payload: any = {
        quantity: Number(addStockForm.quantity),
        reason_code: addStockForm.reason_code,
        notes: addStockForm.notes.trim() || undefined,
        unit_cost: addStockForm.unit_cost ? Number(addStockForm.unit_cost) : undefined,
      };
      const response = await apiClient.post(InventoryApis.addStock(addStockItem.id), payload);
      const result = response.data?.data;

      toast({
        title: "Stock added",
        description: result
          ? `${addStockItem.name}: ${result.previous_stock} → ${result.new_stock} ${addStockItem.unit}`
          : `Successfully added stock for ${addStockItem.name}`,
      });

      setAddStockItem(null);
      setAddStockForm({ quantity: "", reason_code: "stock_count_correction", unit_cost: "", notes: "" });
      await fetchInventory();
    } catch (err: any) {
      toast({
        title: "Add Stock Failed",
        description: err.response?.data?.detail || "Could not add stock.",
        variant: "destructive",
      });
    } finally {
      setAddStockSubmitting(false);
    }
  };

  const handleReduceStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reduceStockItem || !reduceStockForm.quantity) return;

    setReduceStockSubmitting(true);
    try {
      const payload: any = {
        quantity: Number(reduceStockForm.quantity),
        reason_code: reduceStockForm.reason_code,
        notes: reduceStockForm.notes.trim() || undefined,
        allow_negative: reduceStockForm.allow_negative,
      };
      const response = await apiClient.post(InventoryApis.reduceStock(reduceStockItem.id), payload);
      const result = response.data?.data;

      toast({
        title: "Stock reduced",
        description: result
          ? `${reduceStockItem.name}: ${result.previous_stock} → ${result.new_stock} ${reduceStockItem.unit}`
          : `Successfully reduced stock for ${reduceStockItem.name}`,
      });

      setReduceStockItem(null);
      setReduceStockForm({ quantity: "", reason_code: "waste", notes: "", allow_negative: false });
      await fetchInventory();
    } catch (err: any) {
      toast({
        title: "Reduce Stock Failed",
        description: err.response?.data?.detail || "Could not reduce stock.",
        variant: "destructive",
      });
    } finally {
      setReduceStockSubmitting(false);
    }
  };

  const handleCountStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!countStockItem || countStockForm.counted_quantity === "") return;

    setCountStockSubmitting(true);
    try {
      const payload: any = {
        counted_quantity: Number(countStockForm.counted_quantity),
        notes: countStockForm.notes.trim() || undefined,
        allow_negative: canOverrideNegativeStock,
      };
      const response = await apiClient.post(InventoryApis.stockCountCorrection(countStockItem.id), payload);
      const result = response.data?.data;

      toast({
        title: result ? "Stock count recorded" : "No variance",
        description: result
          ? `${countStockItem.name}: ${result.previous_stock} → ${result.new_stock} ${countStockItem.unit}`
          : "Counted quantity matches system quantity -- nothing to record.",
      });

      setCountStockItem(null);
      setCountStockForm({ counted_quantity: "", notes: "" });
      await fetchInventory();
    } catch (err: any) {
      toast({
        title: "Stock Count Failed",
        description: err.response?.data?.detail || "Could not record stock count.",
        variant: "destructive",
      });
    } finally {
      setCountStockSubmitting(false);
    }
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.restaurant_id) return;

    const openingQuantity = Number(itemForm.current_stock || 0);
    const openingCost = Number(itemForm.opening_stock_total_cost || 0);
    const isCostedOpeningStock =
      !editingItem &&
      openingQuantity > 0 &&
      openingCost > 0;

    if (isCostedOpeningStock && (!itemForm.supplier_id || itemForm.supplier_id === "none")) {
      toast({
        title: "Supplier Required",
        description: "Supplier is required for every costed inventory purchase.",
        variant: "destructive",
      });
      return;
    }

    setItemSubmitting(true);
    try {
      if (editingItem) {
        const isCapitalized =
          editingItem.accounting_profile?.treatment === "inventory_asset" ||
          Number(editingItem.book_quantity || 0) !== 0 ||
          Number(editingItem.book_unit_cost || 0) !== 0;
        const updatePayload = {
          name: itemForm.name,
          unit: itemForm.unit,
          description: itemForm.description || null,
          min_stock_level: Number(itemForm.min_stock_level),
          ...(!isCapitalized && itemForm.cost_per_unit
            ? { cost_per_unit: Number(itemForm.cost_per_unit) }
            : {}),
          supplier_id: (itemForm.supplier_id && itemForm.supplier_id !== "none") ? Number(itemForm.supplier_id) : null,
          storage_location: itemForm.location || null,
          station: itemForm.station,
          station_id: itemForm.station_id,
          is_active: itemForm.is_active,
        };
        await apiClient.patch(InventoryApis.updateInventoryItem(editingItem.id), updatePayload);
      } else {
        if (isCostedOpeningStock && itemForm.opening_stock_payment_status === "paid") {
          if (!openingPaymentAccount) {
            toast({ title: "Account Required", description: "Select the account used to pay for the opening stock.", variant: "destructive" });
            return;
          }
        }
        const createPayload = {
          restaurant_id: user.restaurant_id,
          name: itemForm.name,
          station: itemForm.station,
          station_id: itemForm.station_id,
          description: itemForm.description || null,
          unit: itemForm.unit,
          current_stock: Number(itemForm.current_stock),
          min_stock_level: Number(itemForm.min_stock_level),
          opening_stock_total_cost: itemForm.opening_stock_total_cost ? Number(itemForm.opening_stock_total_cost) : null,
          opening_stock_payment_status: itemForm.opening_stock_payment_status,
          opening_stock_account_type:
            isCostedOpeningStock && itemForm.opening_stock_payment_status === "paid"
              ? openingPaymentAccount?.account_type ?? null
              : null,
          opening_stock_account_id:
            isCostedOpeningStock && itemForm.opening_stock_payment_status === "paid"
              ? openingPaymentAccount?.id ?? null
              : null,
          supplier_id: (itemForm.supplier_id && itemForm.supplier_id !== "none") ? Number(itemForm.supplier_id) : null,
          storage_location: itemForm.location || null,
          is_active: itemForm.is_active,
        };
        await apiClient.post(InventoryApis.createInventoryItem, createPayload);
      }
      
      toast({
        title: "Success",
        description: `Successfully ${editingItem ? 'updated' : 'added'} ${itemForm.name}`,
      });
      
      setIsAddDialogOpen(false);
      setEditingItem(null);
      fetchInventory();
    } catch (err: any) {
      toast({
        title: "Action Failed",
        description: err.response?.data?.detail || `Could not ${editingItem ? 'update' : 'add'} item.`,
        variant: "destructive",
      });
    } finally {
      setItemSubmitting(false);
    }
  };

  const openAddStock = (item: any) => {
    setAddStockItem(item);
    setAddStockForm({ quantity: "", reason_code: "stock_count_correction", unit_cost: "", notes: "" });
  };

  const openReduceStock = (item: any) => {
    setReduceStockItem(item);
    setReduceStockForm({ quantity: "", reason_code: "waste", notes: "", allow_negative: false });
  };

  const openCountStock = (item: any) => {
    setCountStockItem(item);
    setCountStockForm({ counted_quantity: String(item.current_stock ?? ""), notes: "" });
  };

  const openAdd = () => {
    setEditingItem(null);
    setOpeningPaymentAccount(null);
    setItemForm({
      name: "",
      station: "general",
      station_id: null,
      description: "",
      unit: "",
      current_stock: "",
      min_stock_level: "",
      opening_stock_total_cost: "",
      opening_stock_payment_status: "paid",
      opening_stock_payment_method: "cash",
      supplier_id: "",
      location: "",
      cost_per_unit: "",
      is_active: true,
    });
    setIsAddDialogOpen(true);
  };

  const openEdit = (item: any) => {
    setEditingItem(item);
    setOpeningPaymentAccount(null);
    setItemForm({
      name: item.name || "",
      station: item.station || "general",
      station_id: item.station_id ?? null,
      description: item.description || "",
      unit: item.unit || "",
      current_stock: item.current_stock?.toString() || "0",
      min_stock_level: item.min_stock_level?.toString() || "0",
      cost_per_unit: item.cost_per_unit?.toString() || "",
      opening_stock_total_cost: "",
      opening_stock_payment_status: "paid",
      opening_stock_payment_method: "cash",
      supplier_id: item.supplier_id?.toString() || "none",
      location: item.storage_location || "",
      is_active: item.is_active ?? true,
    });
    setIsAddDialogOpen(true);
  };

  const valuationByItemId = new Map<number, any>(
    (valuation?.items || []).map((row: any) => [Number(row.inventory_item_id), row]),
  );

  return (
    <div className="flex flex-col gap-6 max-w-[1600px] mx-auto p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
          <p className="text-muted-foreground">Track stock levels and manage supplies.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {inventoryView === "items" && canConsumeInventory ? (
            <Button variant="outline" onClick={() => setConsumeOpen(true)}>
              <Utensils className="mr-2 h-4 w-4" /> Consume
            </Button>
          ) : null}
          {inventoryView === "items" ? <Button
            className="bg-orange-600 hover:bg-orange-700 text-white"
            onClick={openAdd}
          >
            <Plus className="w-4 h-4 mr-2" /> Add Item
          </Button> : null}
        </div>

      </div>

      {user?.restaurant_id ? (
        <InventoryConsumptionDialog
          open={consumeOpen}
          onOpenChange={setConsumeOpen}
          restaurantId={user.restaurant_id}
          items={items}
          canOverrideNegative={canOverrideNegativeStock}
          onCompleted={fetchInventory}
        />
      ) : null}

      <Tabs value={inventoryView} onValueChange={(value) => changeInventoryView(value as "items" | "activity")}>
        <TabsList className="border border-border bg-muted">
          <TabsTrigger value="items">Stock items</TabsTrigger>
          <TabsTrigger value="activity"><History className="mr-2 h-4 w-4" /> Activity</TabsTrigger>
        </TabsList>
      </Tabs>

      {inventoryView === "items" ? (
        <>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="rounded-lg">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Book inventory value</p>
            <p className="mt-1 text-xl font-semibold">
              Rs. {Number(valuation?.total_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">Reconciles to the inventory asset in finance reports.</p>
          </CardContent>
        </Card>
        <Card className="rounded-lg">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Book-valued stock items</p>
            <p className="mt-1 text-xl font-semibold">{Number(valuation?.valued_items || 0)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-lg">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Missing book valuation</p>
            <p className={cn("mt-1 text-xl font-semibold", Number(valuation?.unvalued_items || 0) > 0 && "text-amber-600") }>
              {Number(valuation?.unvalued_items || 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-4 justify-between">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-[400px]">
          <TabsList className="bg-muted border border-border">
            <TabsTrigger value="all">All Items</TabsTrigger>
            <TabsTrigger value="low_stock" className="data-[state=active]:bg-red-100 data-[state=active]:text-red-700 dark:data-[state=active]:bg-red-950 dark:data-[state=active]:text-red-500">
              <AlertTriangle className="w-4 h-4 mr-2" />
              Low Stock
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-full md:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8 bg-muted/50 border-border" placeholder="Search items..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-lg">
          <Package className="w-12 h-12 mb-4 opacity-20" />
          <p>No inventory items found.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-x-auto shadow-sm">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted text-muted-foreground font-medium border-b border-border">
              <tr>
                <th className="px-6 py-4">Item Name</th>
                <th className="px-6 py-4">Station</th>
                <th className="px-6 py-4">Unit</th>
                <th className="px-6 py-4">Stock Level</th>
                <th className="px-6 py-4">Book cost</th>
                <th className="px-6 py-4">Book value</th>
                <th className="px-6 py-4 text-right">Actions</th>

              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.filter((item) => {
                if (!searchQuery.trim()) return true;
                const q = searchQuery.toLowerCase();
                return (item.name || "").toLowerCase().includes(q) || (item.category || "").toLowerCase().includes(q);
              }).map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => {
                    setDetailsItem(item);
                    setDetailsOpen(true);
                  }}
                >
                  <td className="px-6 py-4 font-medium text-foreground">
                    <div className="flex flex-col">
                      <div className="flex items-center">
                        {item.name}
                        {item.is_low_stock && (
                          <Badge variant="outline" className="ml-2 border-red-500/50 bg-red-100 text-red-700 dark:bg-red-950/20 dark:text-red-500 text-[10px] px-1 py-0 h-auto">
                            LOW
                          </Badge>
                        )}
                        {!item.is_active && (
                          <Badge variant="secondary" className="ml-2 text-[10px] px-1 py-0 h-auto">
                            INACTIVE
                          </Badge>
                        )}
                      </div>
                      {item.storage_location && (
                        <span className="text-[10px] text-muted-foreground">Loc: {item.storage_location}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground capitalize">{item.station || "General"}</td>
                  <td className="px-6 py-4 text-muted-foreground">{item.unit}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "font-bold",
                        item.is_low_stock ? "text-red-500" : "text-emerald-500"
                      )}>
                        {item.current_stock}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    Rs. {Number(valuationByItemId.get(Number(item.id))?.book_unit_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 font-medium">
                    Rs. {Number(valuationByItemId.get(Number(item.id))?.inventory_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-muted-foreground hover:text-foreground"
                      onClick={() => openOps(item)}
                      title="View ledger"
                    >
                      <History className="w-4 h-4 mr-1.5" />
                      History
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 text-muted-foreground hover:text-foreground"
                      onClick={() => openEdit(item)}
                    >
                      Edit
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-primary hover:text-primary/80"
                        >
                          Stock
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openAddStock(item)}>
                          Add Stock
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openReduceStock(item)}>
                          Reduce Stock
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openCountStock(item)}>
                          Count Stock
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>

              ))}
            </tbody>
          </table>
        </div>
      )}

        </>
      ) : user?.restaurant_id ? (
        <InventoryActivityPanel
          restaurantId={user.restaurant_id}
          canManage={canManageInventory}
          focusAdjustmentId={focusAdjustmentId}
          cashDrawerControlsEnabled={cashDrawerControlsEnabled}
          cashDrawerSessions={cashDrawerSessions}
          selectedCashDrawerSessionId={selectedCashDrawerSessionId}
          onCashDrawerSessionChange={setSelectedCashDrawerSessionId}
          onInventoryChanged={fetchInventory}
        />
      ) : null}

      {/* Add Stock Dialog */}
      <Dialog open={!!addStockItem} onOpenChange={(open) => !open && setAddStockItem(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleAddStock}>
            <DialogHeader>
              <DialogTitle>Add Stock: {addStockItem?.name}</DialogTitle>
              <DialogDescription>
                Use this only for a verified count surplus or genuinely free stock. It updates
                inventory value and posts the matching variance or inventory-gain entry. Stock
                received from a supplier must be recorded in Purchases.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-4 bg-muted/50 p-3 rounded-lg border border-border">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-muted-foreground">Current Stock:</span>
                  <span className="text-sm font-bold">{addStockItem?.current_stock} {addStockItem?.unit}</span>
                </div>
                {addStockForm.quantity && (
                  <div className="flex justify-between items-center pt-2 border-t border-border">
                    <span className="text-sm font-medium text-muted-foreground">New Total:</span>
                    <span className="text-sm font-bold text-emerald-600">
                      {Number(addStockItem?.current_stock || 0) + Number(addStockForm.quantity)} {addStockItem?.unit}
                    </span>
                  </div>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="add_quantity">Quantity ({addStockItem?.unit})</Label>
                <Input
                  id="add_quantity"
                  type="number"
                  step="0.001"
                  min="0.001"
                  required
                  placeholder="0.00"
                  value={addStockForm.quantity}
                  onChange={(e) => setAddStockForm({ ...addStockForm, quantity: e.target.value })}
                />
              </div>
              <ReasonCodeSelect
                operation="add"
                value={addStockForm.reason_code}
                onChange={(v) => setAddStockForm({ ...addStockForm, reason_code: v })}
              />
              <div className="grid gap-2">
                <Label htmlFor="add_unit_cost">Unit Cost (NPR, optional)</Label>
                <Input
                  id="add_unit_cost"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={addStockForm.unit_cost}
                  onChange={(e) => setAddStockForm({ ...addStockForm, unit_cost: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Used for valuation only -- does not create an expense or payment.
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="add_notes">Notes</Label>
                <Input
                  id="add_notes"
                  placeholder="e.g. Complimentary sample from supplier"
                  value={addStockForm.notes}
                  onChange={(e) => setAddStockForm({ ...addStockForm, notes: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setAddStockItem(null)} disabled={addStockSubmitting}>
                Cancel
              </Button>
              <Button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white" disabled={addStockSubmitting}>
                {addStockSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Add Stock"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reduce Stock Dialog */}
      <Dialog open={!!reduceStockItem} onOpenChange={(open) => !open && setReduceStockItem(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleReduceStock}>
            <DialogHeader>
              <DialogTitle>Reduce Stock: {reduceStockItem?.name}</DialogTitle>
              <DialogDescription>
                Use this only for waste, damage, expiry, or a verified count shortage. It reduces
                inventory value and records the matching expense or variance. Preparation, staff
                meals, complimentary items, and testing belong in Consume stock.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-4 bg-muted/50 p-3 rounded-lg border border-border">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-muted-foreground">Current Stock:</span>
                  <span className="text-sm font-bold">{reduceStockItem?.current_stock} {reduceStockItem?.unit}</span>
                </div>
                {reduceStockForm.quantity && (
                  <div className="flex justify-between items-center pt-2 border-t border-border">
                    <span className="text-sm font-medium text-muted-foreground">New Total:</span>
                    <span className={cn(
                      "text-sm font-bold",
                      Number(reduceStockItem?.current_stock || 0) - Number(reduceStockForm.quantity) >= 0
                        ? "text-emerald-600"
                        : "text-red-500"
                    )}>
                      {Number(reduceStockItem?.current_stock || 0) - Number(reduceStockForm.quantity)} {reduceStockItem?.unit}
                    </span>
                  </div>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="reduce_quantity">Quantity ({reduceStockItem?.unit})</Label>
                <Input
                  id="reduce_quantity"
                  type="number"
                  step="0.001"
                  min="0.001"
                  required
                  placeholder="0.00"
                  value={reduceStockForm.quantity}
                  onChange={(e) => setReduceStockForm({ ...reduceStockForm, quantity: e.target.value })}
                />
              </div>
              <ReasonCodeSelect
                operation="reduce"
                value={reduceStockForm.reason_code}
                onChange={(v) => setReduceStockForm({ ...reduceStockForm, reason_code: v })}
              />
              <div className="grid gap-2">
                <Label htmlFor="reduce_notes">Notes</Label>
                <Input
                  id="reduce_notes"
                  placeholder="e.g. Bottle broken during service"
                  value={reduceStockForm.notes}
                  onChange={(e) => setReduceStockForm({ ...reduceStockForm, notes: e.target.value })}
                />
              </div>
              {canOverrideNegativeStock && (
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="reduce_allow_negative">Allow negative stock</Label>
                    <p className="text-xs text-muted-foreground">
                      Requires the restaurant's negative-stock setting to be enabled too.
                    </p>
                  </div>
                  <Switch
                    id="reduce_allow_negative"
                    checked={reduceStockForm.allow_negative}
                    onCheckedChange={(checked) => setReduceStockForm({ ...reduceStockForm, allow_negative: checked })}
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setReduceStockItem(null)} disabled={reduceStockSubmitting}>
                Cancel
              </Button>
              <Button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white" disabled={reduceStockSubmitting}>
                {reduceStockSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Reduce Stock"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Count Stock Dialog */}
      <Dialog open={!!countStockItem} onOpenChange={(open) => !open && setCountStockItem(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleCountStock}>
            <DialogHeader>
              <DialogTitle>Count Stock: {countStockItem?.name}</DialogTitle>
              <DialogDescription>
                Enter the physical counted quantity. The system records the
                difference as an Add Stock or Reduce Stock movement -- it never
                silently overwrites the current quantity.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-4 bg-muted/50 p-3 rounded-lg border border-border">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-muted-foreground">System Quantity:</span>
                  <span className="text-sm font-bold">{countStockItem?.current_stock} {countStockItem?.unit}</span>
                </div>
                {countStockForm.counted_quantity !== "" && (
                  <div className="flex justify-between items-center pt-2 border-t border-border">
                    <span className="text-sm font-medium text-muted-foreground">Variance:</span>
                    <span className={cn(
                      "text-sm font-bold",
                      Number(countStockForm.counted_quantity) - Number(countStockItem?.current_stock || 0) >= 0
                        ? "text-emerald-600"
                        : "text-red-500"
                    )}>
                      {Number(countStockForm.counted_quantity) - Number(countStockItem?.current_stock || 0) >= 0 ? "+" : ""}
                      {Number(countStockForm.counted_quantity) - Number(countStockItem?.current_stock || 0)} {countStockItem?.unit}
                    </span>
                  </div>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="counted_quantity">Counted Quantity ({countStockItem?.unit})</Label>
                <Input
                  id="counted_quantity"
                  type="number"
                  step="0.001"
                  min="0"
                  required
                  placeholder="0.00"
                  value={countStockForm.counted_quantity}
                  onChange={(e) => setCountStockForm({ ...countStockForm, counted_quantity: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="count_notes">Notes</Label>
                <Input
                  id="count_notes"
                  placeholder="e.g. Monthly physical count"
                  value={countStockForm.notes}
                  onChange={(e) => setCountStockForm({ ...countStockForm, notes: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setCountStockItem(null)} disabled={countStockSubmitting}>
                Cancel
              </Button>
              <Button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white" disabled={countStockSubmitting}>
                {countStockSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Record Count"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {/* Add/Edit Item Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSaveItem}>
            <DialogHeader>
              <DialogTitle>{editingItem ? 'Edit Inventory Item' : 'Add New Inventory Item'}</DialogTitle>
              <DialogDescription>
                Fill in the details for the inventory item. All fields with * are required.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Item Name *</Label>
                <Input
                  id="name"
                  required
                  placeholder="e.g. Tomato, Olive Oil..."
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="station">Station *</Label>
                <Select 
                  value={itemForm.station} 
                  onValueChange={(v) => setItemForm({ ...itemForm, station: v })}
                >
                  <SelectTrigger id="station">
                    <SelectValue placeholder="Select station" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="kitchen">Kitchen</SelectItem>
                    <SelectItem value="bar">Bar</SelectItem>
                    <SelectItem value="cafe">Cafe</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                {user?.restaurant_id && (
                  <StationPicker
                    label="Station (cost centre)"
                    restaurantId={user.restaurant_id}
                    value={itemForm.station_id}
                    onChange={(stationId) => setItemForm({ ...itemForm, station_id: stationId })}
                  />
                )}
              </div>
              <div className="grid gap-2 md:col-span-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Input
                  id="description"
                  placeholder="Additional details about the item..."
                  value={itemForm.description}
                  onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="unit">Unit *</Label>
                <Input
                  id="unit"
                  required
                  placeholder="e.g. kg, liters, pieces..."
                  value={itemForm.unit}
                  onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
                />
              </div>
              
              {!editingItem && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="opening_stock_total_cost">Opening Stock Total Cost (NPR)</Label>
                    <Input
                      id="opening_stock_total_cost"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={itemForm.opening_stock_total_cost}
                      onChange={(e) => setItemForm({ ...itemForm, opening_stock_total_cost: e.target.value })}
                    />
                  </div>
                  {Number(itemForm.opening_stock_total_cost || 0) > 0 && (
                    <>
                      <div className="grid gap-2">
                        <Label htmlFor="opening_payment_status">Opening stock settlement</Label>
                        <Select
                          value={itemForm.opening_stock_payment_status}
                          onValueChange={(v) => setItemForm({ ...itemForm, opening_stock_payment_status: v })}
                        >
                          <SelectTrigger id="opening_payment_status">
                            <SelectValue placeholder="Select settlement" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="paid">Paid now</SelectItem>
                            <SelectItem value="pending">Unpaid - supplier payable</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          This is a stock purchase. A payment method is derived from its custody account and is not selected separately.
                        </p>
                      </div>
                      {itemForm.opening_stock_payment_status === "paid" && (
                        <div className="md:col-span-2">
                          <CashBankAccountSelect
                            label="Paid from account"
                            value={openingPaymentAccount}
                            onChange={setOpeningPaymentAccount}
                          />
                          <p className="text-xs text-muted-foreground">
                            Choose the drawer, safe, bank, or owner account that paid for this stock. The selected account—not a payment method—will be reduced.
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
              <div className="grid gap-2">
                <Label htmlFor="current_stock">Current Stock *</Label>
                <Input
                  id="current_stock"
                  type="number"
                  step="0.001"
                  required
                  placeholder="0.000"
                  value={itemForm.current_stock}
                  readOnly={Boolean(editingItem)}
                  className={editingItem ? "cursor-not-allowed bg-muted" : undefined}
                  onChange={(e) => setItemForm({ ...itemForm, current_stock: e.target.value })}
                />
                {editingItem ? (
                  <p className="text-xs text-muted-foreground">Use Adjust Stock or Activity to preserve the inventory audit trail.</p>
                ) : null}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="min_stock_level">Minimum Stock Level *</Label>
                <Input
                  id="min_stock_level"
                  type="number"
                  step="0.001"
                  required
                  placeholder="0.000"
                  value={itemForm.min_stock_level}
                  onChange={(e) => setItemForm({ ...itemForm, min_stock_level: e.target.value })}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="supplier">
                  Supplier {!editingItem && Number(itemForm.current_stock || 0) > 0 && Number(itemForm.opening_stock_total_cost || 0) > 0 ? "*" : ""}
                </Label>
                <Select 
                  value={itemForm.supplier_id || "none"} 
                  onValueChange={(v) => setItemForm({ ...itemForm, supplier_id: v })}
                >
                  <SelectTrigger id="supplier">
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      value="none"
                      disabled={!editingItem && Number(itemForm.current_stock || 0) > 0 && Number(itemForm.opening_stock_total_cost || 0) > 0}
                    >
                      No Supplier
                    </SelectItem>
                    {Array.isArray(suppliers) && suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="location">Storage Location</Label>
                <Input
                  id="location"
                  placeholder="e.g. Shelf A1, Cooler..."
                  value={itemForm.location}
                  onChange={(e) => setItemForm({ ...itemForm, location: e.target.value })}
                />
              </div>
              {editingItem && (
                <div className="grid gap-2">
                  {editingItem.accounting_profile?.treatment === "inventory_asset" ||
                  Number(editingItem.book_quantity || 0) !== 0 ||
                  Number(editingItem.book_unit_cost || 0) !== 0 ? (
                    <div className="rounded-lg border border-border bg-muted/30 p-3">
                      <p className="text-sm font-medium">Inventory cost: Rs. {Number(editingItem.book_unit_cost || 0).toLocaleString()}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        This weighted-average cost is derived from received purchases and approved valuation corrections.
                      </p>
                    </div>
                  ) : (
                    <>
                      <Label htmlFor="cost_per_unit">Reference cost per unit (NPR)</Label>
                      <Input
                        id="cost_per_unit"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={itemForm.cost_per_unit}
                        onChange={(e) => setItemForm({ ...itemForm, cost_per_unit: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Used for recipe and waste estimates only. This direct-expense item has no Balance Sheet value.
                      </p>
                    </>
                  )}
                </div>
              )}
              <div className="flex items-center justify-between pt-4 md:col-span-2 border-t border-border mt-2">
                <div className="space-y-0.5">
                  <Label htmlFor="is_active">Active Status</Label>
                  <p className="text-[10px] text-muted-foreground">
                    Inactive items won&apos;t show in the POS system.
                  </p>
                </div>
                <Switch
                  id="is_active"
                  checked={itemForm.is_active}
                  onCheckedChange={(checked) => setItemForm({ ...itemForm, is_active: checked })}
                />
              </div>

            </div>
            <DialogFooter className="mt-6">
              <Button 
                variant="outline" 
                type="button" 
                onClick={() => setIsAddDialogOpen(false)}
                disabled={itemSubmitting}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="bg-orange-600 hover:bg-orange-700 text-white"
                disabled={itemSubmitting}
              >
                {itemSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  editingItem ? 'Update Item' : 'Add Item'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <InventoryItemDetailsSheet
        item={detailsItem}
        value={valuationByItemId.get(Number(detailsItem?.id))?.inventory_value}
        open={detailsOpen}
        onOpenChange={(open) => {
          setDetailsOpen(open);
          if (!open) setDetailsItem(null);
        }}
        onAddStock={(target) => {
          setDetailsOpen(false);
          openAddStock(target);
        }}
        onReduceStock={(target) => {
          setDetailsOpen(false);
          openReduceStock(target);
        }}
        onCountStock={(target) => {
          setDetailsOpen(false);
          openCountStock(target);
        }}
        onViewLedger={(target) => {
          setDetailsOpen(false);
          openOps(target);
        }}
      />

      {/* Inventory Advanced Ops: Ledger */}
      <Dialog
        open={opsOpen}
        onOpenChange={(open) => {
          setOpsOpen(open);
          if (!open) {
            setOpsItem(null);
            setLedger(null);
          }
        }}
      >
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-[980px] max-h-[90vh] overflow-hidden p-0 rounded-2xl flex flex-col">
          <DialogHeader className="p-6 border-b border-border/60 bg-muted/20">
            <DialogTitle className="text-xl font-black tracking-tight">
              Inventory History
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Ledger movements for <span className="font-semibold text-foreground">{opsItem?.name || "item"}</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 flex-1 min-h-0 overflow-auto">
            {ledgerLoading ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading ledger…
              </div>
            ) : (ledger?.movements || []).length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground border border-dashed border-border rounded-2xl bg-muted/10">
                No ledger movements found.
              </div>
            ) : (
              <div className="border border-border/60 rounded-2xl overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/40 text-muted-foreground font-medium border-b border-border">
                    <tr>
                      <th className="px-5 py-3">Time</th>
                      <th className="px-5 py-3">Source</th>
                      <th className="px-5 py-3">Reason</th>
                      <th className="px-5 py-3 text-right">Delta</th>
                      <th className="px-5 py-3 text-right">Balance</th>
                      <th className="px-5 py-3 text-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(ledger?.movements || []).map((m, idx) => {
                      const delta = Number(m.qty_delta ?? 0);
                      const neg = !!m.is_negative || delta < 0;
                      const balance = m.resulting_balance ?? m.resultingBalance;
                      const unitCost = m.unit_cost ?? m.unitCost ?? m.unit_cost_snapshot;
                      const totalCost = m.total_cost ?? m.totalCost ?? m.value_delta_snapshot;
                      return (
                        <tr key={m.id || idx} className="hover:bg-muted/20 transition-colors">
                          <td className="px-5 py-3 font-semibold">
                            {m.created_at ? new Date(m.created_at).toLocaleString() : "—"}
                          </td>
                          <td className="px-5 py-3 text-muted-foreground">{m.source_type || "—"}</td>
                          <td className="px-5 py-3 text-muted-foreground">{m.reason || "—"}</td>
                          <td className={cn("px-5 py-3 text-right font-bold", neg ? "text-red-500" : "text-emerald-500")}>
                            {delta.toLocaleString()}
                          </td>
                          <td className="px-5 py-3 text-right font-bold">{Number(balance ?? 0).toLocaleString()}</td>
                          <td className="px-5 py-3 text-right text-muted-foreground">
                            {totalCost != null
                              ? `Rs. ${Number(totalCost).toLocaleString()}`
                              : unitCost != null
                              ? `Rs. ${Number(unitCost).toLocaleString()}/unit`
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <DialogFooter className="p-6 border-t border-border/60 bg-muted/20">
            <Button variant="outline" className="h-11 rounded-xl w-full" onClick={() => setOpsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>

  );
}
