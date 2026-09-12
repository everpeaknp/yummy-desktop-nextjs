"use client";

import { useEffect, useState, useCallback, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import apiClient from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { useOrderFull } from "@/hooks/use-order-full";
import { OrderApis, KotApis, TableApis, TableTypeApis } from "@/lib/api/endpoints";
import { RoomContainer, type TableData } from "@/components/tables/room-container";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  ShoppingCart,
  Receipt,
  Clock,
  ChefHat,
  Activity,
  FileText,
  Users,
  MapPin,
  Utensils,
  AlertCircle,
  RefreshCw,
  XCircle,
  CheckCircle,
  Circle,
  Timer,
  Ban,
  Plus,
  Minus,
  CreditCard,
  Armchair,
  Eye,
  Table2,
  Hash,
  ShoppingBag,
  Zap,
  Calendar,
  Truck,
  Award,
  MoreHorizontal,
} from "lucide-react";
import { 
  getStatusColor, 
  getChannelIcon, 
  getStatusBadgeColor 
} from "@/components/orders/order-card";
import type {
  Order,
  OrderFullContext,
  OrderTableSummary,
  KOTUpdate,
  OrderEvent,
  OrderItem,
  OrderPayment,
} from "@/types/order";
import { toast } from "sonner";
import { usePosBillingPermissions } from "@/hooks/use-pos-billing-permissions";
import { getRecordedOrderDiscount } from "@/lib/order-totals";
import { getKOTHeading, getKOTItemDisplay } from "@/lib/order-kot-display";
import { SalesDocumentDetailSheet } from "@/components/finance/transaction-detail/sales-document-detail-sheet";
import { useMobileAppBarTitle } from "@/components/layout/mobile-app-bar-title";

// ── Helpers ──────────────────────────────────────────
function formatCurrency(amount: number) {
  return `Rs. ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
  return new Date(dateStr).toLocaleDateString();
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function OrderDetailAppBarTitle({ title }: { title: string }) {
  useMobileAppBarTitle(title);
  return null;
}

function computeOrderDiscount(order: Order) {
  return getRecordedOrderDiscount(order);
}

function getOrderItemEffectiveUnitPrice(item: OrderItem) {
  const modifierTotal = Array.isArray(item.modifiers)
    ? item.modifiers.reduce((sum, modifier) => sum + Number(modifier.price_adjustment_snapshot || 0), 0)
    : 0;
  return Number(item.unit_price || 0) + modifierTotal;
}

function getOrderItemEffectiveLineTotal(item: OrderItem) {
  if (item.is_nc) return 0;
  return getOrderItemEffectiveUnitPrice(item) * Number(item.qty || 0);
}

function isTableAvailable(status: string | undefined) {
  return ["FREE", "AVAILABLE"].includes((status || "").toUpperCase());
}

function getAssignedTableIds(order: Order, tables: OrderTableSummary[]): number[] {
  if (order.table_ids?.length) return order.table_ids;
  if (tables.length > 0) return tables.map((t) => t.id);
  if (order.table_id) return [order.table_id];
  return [];
}

function buildTableIdsPayload(
  selectedIds: number[],
  primaryTableId?: number | null,
): number[] {
  const unique = Array.from(new Set(selectedIds.filter((id) => id > 0)));
  if (unique.length === 0) return [];
  if (primaryTableId && unique.includes(primaryTableId)) {
    return [primaryTableId, ...unique.filter((id) => id !== primaryTableId)];
  }
  return unique;
}

function getStatusConfig(s: string) {
  switch (s.toLowerCase()) {
    case "pending": return { label: "Pending", color: "#f59e0b", bg: "bg-amber-500/10", icon: Clock };
    case "running": return { label: "Running", color: "#3b82f6", bg: "bg-blue-500/10", icon: Activity };
    case "preparing": return { label: "Preparing", color: "#f97316", bg: "bg-orange-500/10", icon: ChefHat };
    case "ready": return { label: "Ready", color: "#10b981", bg: "bg-emerald-500/10", icon: CheckCircle };
    case "completed": return { label: "Completed", color: "#10b981", bg: "bg-emerald-500/10", icon: CheckCircle };
    case "canceled": return { label: "Canceled", color: "#ef4444", bg: "bg-red-500/10", icon: XCircle };
    case "requested": return { label: "Pending Verification", color: "#6366f1", bg: "bg-indigo-500/10", icon: Timer };
    default: return { label: s, color: "#64748b", bg: "bg-slate-500/10", icon: Circle };
  }
}

function getKOTStatusConfig(s: string) {
  switch (s.toLowerCase()) {
    case "pending": return { label: "Pending", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" };
    case "acknowledged": return { label: "Acknowledged", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" };
    case "preparing": return { label: "Preparing", color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" };
    case "partial": return { label: "Partially ready", color: "text-cyan-600 dark:text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/20" };
    case "ready": return { label: "Ready", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" };
    case "served": return { label: "Served", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" };
    case "completed": return { label: "Completed", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" };
    case "rejected": return { label: "Rejected", color: "text-red-600 dark:text-red-400", bg: "bg-red-500/10 border-red-500/20" };
    case "cancelled": return { label: "Cancelled", color: "text-red-600 dark:text-red-400", bg: "bg-red-500/10 border-red-500/20" };
    default: return { label: s, color: "text-muted-foreground", bg: "bg-muted border-border/40" };
  }
}

type DetailKotStatus = "PENDING" | "PREPARING" | "READY" | "SERVED" | "REJECTED";

function nextKotStatus(status: string): DetailKotStatus | null {
  const normalized = status.trim().toUpperCase();
  if (normalized === "PENDING" || normalized === "ACKNOWLEDGED") return "PREPARING";
  if (normalized === "PREPARING" || normalized === "PARTIAL") return "READY";
  if (normalized === "READY") return "SERVED";
  return null;
}

function kotActionLabel(status: string): string | null {
  const normalized = status.trim().toUpperCase();
  if (normalized === "PENDING" || normalized === "ACKNOWLEDGED") return "Start cooking";
  if (normalized === "PREPARING" || normalized === "PARTIAL") return "Mark ready";
  if (normalized === "READY") return "Mark served";
  return null;
}

type TabKey = "details" | "kots" | "events";

// ── Main Page ────────────────────────────────────────
export default function OrderDetailPage() {
  const params = useParams() as { id?: string | string[] } | null;
  const rawId = Array.isArray(params?.id) ? params?.id[0] : params?.id;
  const orderId = Number(rawId || 0);
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const me = useAuth((s) => s.me);

  const {
    context,
    loading,
    error,
    fetchContext,
    updateKotLocal,
    isFullyPaid,
    allKotsServed,
  } = useOrderFull(orderId);
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("details");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [canceling, setCanceling] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [changeTableOpen, setChangeTableOpen] = useState(false);
  const [multiAssignMode, setMultiAssignMode] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState<string>("");
  const [selectedTableIds, setSelectedTableIds] = useState<number[]>([]);
  const [changingTable, setChangingTable] = useState(false);
  const [allTables, setAllTables] = useState<TableData[]>([]);
  const [tableTypes, setTableTypes] = useState<any[]>([]);
  const [selectedArea, setSelectedArea] = useState("All Areas");
  const [itemOverrides, setItemOverrides] = useState<Record<number, Partial<OrderItem>>>({});
  const [kotUpdatingId, setKotUpdatingId] = useState<number | null>(null);

  const { canVoidOrder, canTransferOrder, canMarkNc } = usePosBillingPermissions();
  const sourceOrder = context?.order;
  const displayOrder = sourceOrder
    ? (() => {
        const items = sourceOrder.items.map((item) => {
          const overrides = itemOverrides[item.id] || {};
          const displayItem = {
            ...item,
            ...overrides,
            qty: overrides.qty ?? item.qty,
            notes: overrides.notes !== undefined ? overrides.notes : item.notes,
            is_nc: overrides.is_nc !== undefined ? overrides.is_nc : item.is_nc,
          };
          return {
            ...displayItem,
            line_total: getOrderItemEffectiveLineTotal(displayItem),
          };
        });
        const subtotal = Number(items.reduce((sum, item) => sum + Number(item.line_total || 0), 0).toFixed(2));
        const computedDiscount = computeOrderDiscount(sourceOrder);
        // Menu prices/subtotal are tax-inclusive; VAT is reported separately
        // and must not be added to the amount due a second time.
        const grandTotal = Number((subtotal + Number(sourceOrder.service_charge || 0) - computedDiscount).toFixed(2));
        return {
          ...sourceOrder,
          items,
          subtotal,
          grand_total: grandTotal,
        };
      })()
    : null;

  // Auth guard
  useEffect(() => {
    const checkAuth = async () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      if (!user && token) await me();
      const updatedToken = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      if (!user && !updatedToken) router.push("/");
    };
    const timer = setTimeout(checkAuth, 500);
    return () => clearTimeout(timer);
  }, [user, me, router]);

  // Fetch events
  const fetchEvents = useCallback(async () => {
    if (!orderId) return;
    setEventsLoading(true);
    try {
      const res = await apiClient.get(OrderApis.getOrderEvents(orderId, "group"));
      if (res.data.status === "success") {
        setEvents(res.data.data);
      }
    } catch (err) {
      console.error("Failed to fetch events:", err);
    } finally {
      setEventsLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (activeTab === "events") {
      fetchEvents();
    }
  }, [activeTab, fetchEvents]);

  const handleRefresh = useCallback(() => {
    void fetchContext();
    if (activeTab === "events") {
      void fetchEvents();
    }
  }, [activeTab, fetchContext, fetchEvents]);

  const handleKotStatusChange = useCallback(async (kotId: number, status: string) => {
    const next = nextKotStatus(status);
    if (!next) return;
    const previousKot = context?.kots.find((kot) => kot.id === kotId);
    updateKotLocal(kotId, { status: next });
    setKotUpdatingId(kotId);
    try {
      await apiClient.patch(KotApis.updateKotStatus(kotId), { status: next });
      toast.success(`KOT marked ${next.toLowerCase()}`);
    } catch (err: any) {
      if (previousKot) updateKotLocal(kotId, previousKot);
      const detail = err?.response?.data?.detail || err?.response?.data?.message || "Failed to update KOT status";
      toast.error(detail);
    } finally {
      setKotUpdatingId(null);
    }
  }, [context?.kots, updateKotLocal]);

  const handleKotReject = useCallback(async (kotId: number) => {
    if (typeof window !== "undefined" && !window.confirm("Reject this kitchen ticket?")) return;
    const previousKot = context?.kots.find((kot) => kot.id === kotId);
    updateKotLocal(kotId, { status: "REJECTED" });
    setKotUpdatingId(kotId);
    try {
      await apiClient.post(KotApis.rejectKot(kotId), undefined);
      toast.success("KOT rejected");
    } catch (err: any) {
      if (previousKot) updateKotLocal(kotId, previousKot);
      const detail = err?.response?.data?.detail || err?.response?.data?.message || "Failed to reject KOT";
      toast.error(detail);
    } finally {
      setKotUpdatingId(null);
    }
  }, [context?.kots, updateKotLocal]);

  useEffect(() => {
    setItemOverrides({});
  }, [sourceOrder?.updated_at]);

  // Cancel order
  const handleCancel = async () => {
    if (!canVoidOrder) {
      toast.error("You do not have permission to void orders.");
      return;
    }
    if (!cancelReason.trim()) return;
    setCanceling(true);
    try {
      await apiClient.post(OrderApis.cancelOrder(orderId), { reason: cancelReason });
      setCancelOpen(false);
      setCancelReason("");
      await fetchContext();
    } catch (err: any) {
      console.error("Failed to cancel order:", err);
      const detail = err?.response?.data?.detail || err?.response?.data?.message || "Failed to cancel order";
      toast.error(detail);
    } finally {
      setCanceling(false);
    }
  };

  // Complete order
  const handleComplete = async () => {
    setCompleting(true);
    try {
      await apiClient.patch(OrderApis.updateOrderStatus(orderId), { status: "completed" });
      await fetchContext();
    } catch (err: any) {
      console.error("Failed to complete order:", err);
      const detail = err?.response?.data?.detail || err?.response?.data?.message || "Failed to complete order";
      toast.error(detail);
    } finally {
      setCompleting(false);
    }
  };

  const handleVerifyOrder = async () => {
    setVerifying(true);
    try {
      const res = await apiClient.patch(OrderApis.updateOrderStatus(orderId), { status: "pending" });
      const updatedOrder = res?.data?.data || res?.data;

      if (updatedOrder?.id && Number(updatedOrder.id) !== Number(orderId)) {
        toast.success(`Order verified and merged into #${updatedOrder.id}`);
        router.push(`/orders/${updatedOrder.id}`);
        return;
      }

      await fetchContext();
      toast.success("Order verified successfully");
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.response?.data?.message || "Failed to verify order";
      console.error("Failed to verify order:", err);
      toast.error(detail);
    } finally {
      setVerifying(false);
    }
  };

  // Fetch all tables
  const fetchAvailableTables = useCallback(async () => {
    if (!context?.order?.restaurant_id) return;
    try {
      const [tablesRes, typesRes] = await Promise.all([
        apiClient.get(TableApis.getTables(context.order.restaurant_id)),
        apiClient.get(TableTypeApis.getTableTypes(context.order.restaurant_id))
      ]);
      if (tablesRes.data.status === "success") {
        setAllTables(tablesRes.data.data || []);
      }
      if (typesRes.data.status === "success") {
        setTableTypes(typesRes.data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch tables:", err);
    }
  }, [context?.order?.restaurant_id]);

  // Open change table dialog
  const handleOpenChangeTable = () => {
    fetchAvailableTables();
    const assigned = getAssignedTableIds(context?.order ?? ({} as Order), context?.tables ?? []);
    setSelectedTableIds(assigned);
    setSelectedTableId("");
    setMultiAssignMode(false);
    setChangeTableOpen(true);
  };

  const handleChangeTableClick = (table: TableData) => {
    if (multiAssignMode) {
      if (!isTableAvailable(table.status)) {
        toast.error(
          "Multi-table assign only supports available tables. Use single-table mode to merge into an occupied table.",
        );
        return;
      }
      setSelectedTableIds((prev) =>
        prev.includes(table.id) ? prev.filter((id) => id !== table.id) : [...prev, table.id],
      );
      return;
    }

    if (table.id === context?.order.table_id) return;
    setSelectedTableId(String(table.id));
  };

  // Change table (single move/merge) or multi-table assign via table_ids
  const handleChangeTable = async () => {
    if (!canTransferOrder) {
      toast.error("You do not have permission to transfer orders.");
      return;
    }

    if (multiAssignMode) {
      if (selectedTableIds.length === 0) return;
      setChangingTable(true);
      try {
        const tableIds = buildTableIdsPayload(selectedTableIds, context?.order.table_id);
        const blocked = tableIds.filter((id) => {
          const t = allTables.find((table) => table.id === id);
          return t && !isTableAvailable(t.status);
        });
        if (blocked.length > 0) {
          toast.error("All selected tables must be available for multi-table assignment.");
          setChangingTable(false);
          return;
        }

        await apiClient.patch(OrderApis.updateOrder(orderId), { table_ids: tableIds });
        const names = tableIds
          .map((id) => allTables.find((t) => t.id === id)?.table_name || `Table ${id}`)
          .join(", ");
        toast.success(`Assigned tables: ${names}`);
        setChangeTableOpen(false);
        setSelectedTableIds([]);
        await fetchContext();
      } catch (err: any) {
        console.error("Failed to assign tables:", err);
        toast.error(err?.response?.data?.detail || "Failed to assign tables");
      } finally {
        setChangingTable(false);
      }
      return;
    }

    if (!selectedTableId) return;
    setChangingTable(true);
    try {
      const selectedTable = allTables.find((t) => String(t.id) === selectedTableId);
      const isOccupiedTarget = selectedTable && !isTableAvailable(selectedTable.status);

      if (isOccupiedTarget) {
        const confirmMerge = window.confirm(
          `Table "${selectedTable?.table_name}" is occupied. Do you want to MERGE this bill into its active order?`
        );
        if (!confirmMerge) {
          setChangingTable(false);
          return;
        }

        const res = await apiClient.post(OrderApis.transferGuestBillTable(orderId), {
          destination_table_id: Number(selectedTableId),
        });

        const action = res.data?.data?.action || res.data?.action || "merged";
        if (action === "merged") {
          toast.success(`Bill merged into ${selectedTable?.table_name}.`);
        } else {
          toast.success(`Bill moved to ${selectedTable?.table_name}.`);
        }
        
        setChangeTableOpen(false);
        setSelectedTableId("");
        router.push("/orders/active");
      } else {
        await apiClient.patch(OrderApis.updateOrder(orderId), {
          table_ids: [Number(selectedTableId)],
        });
        toast.success(`Bill moved to ${selectedTable?.table_name}.`);
        setChangeTableOpen(false);
        setSelectedTableId("");
        await fetchContext();
      }
    } catch (err: any) {
      console.error("Failed to change table:", err);
      toast.error(err?.response?.data?.detail || "Failed to transfer/change table");
    } finally {
      setChangingTable(false);
    }
  };

  // ── Loading State ──
  if (loading) {
    return (
      <div className="flex flex-col gap-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  // ── Error State ──
  if (error && !context) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-destructive font-medium">{error}</p>
        <Button variant="outline" onClick={fetchContext}>
          <RefreshCw className="h-4 w-4 mr-2" /> Retry
        </Button>
      </div>
    );
  }

  if (!context || !displayOrder) return null;

  if (displayOrder.status === "completed") {
    return (
      <>
        <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
          Opening completed sale…
        </div>
        <SalesDocumentDetailSheet
          orderId={orderId}
          open
          onOpenChange={(nextOpen) => {
            if (!nextOpen) router.back();
          }}
        />
      </>
    );
  }

  const order = displayOrder;
  const computedDiscount = computeOrderDiscount(displayOrder);
  const statusColors = getStatusColor(displayOrder.status);
  const statusBadgeColor = getStatusBadgeColor(displayOrder.status);
  const ChannelIcon = getChannelIcon(displayOrder.channel);
  const isEditable = !["completed", "canceled"].includes(displayOrder.status);
  const isCancellable = !["completed", "canceled"].includes(displayOrder.status);
  const isTableOrder = displayOrder.channel === "table";
  const isRoomServiceOrder = displayOrder.channel === "room_service";
  const assignedTables = context.tables.length > 0
    ? context.tables
    : getAssignedTableIds(displayOrder, context.tables).map((id) => ({
        id,
        name: id === displayOrder.table_id ? displayOrder.table_name : null,
        status: null,
        capacity: null,
        table_type_id: null,
      }));
  
  // Format Title
  let title = `Order #${displayOrder.restaurant_order_id || displayOrder.id}`;
  if (assignedTables.length > 1) {
    const primary =
      assignedTables.find((t) => t.id === displayOrder.table_id) ?? assignedTables[0];
    const primaryLabel =
      primary?.name ||
      displayOrder.table_name ||
      `Table ${primary?.id ?? displayOrder.table_id}`;
    title = `Table ${primaryLabel} + ${assignedTables.length - 1}`;
  } else if (displayOrder.table_name || assignedTables[0]?.name) {
    const name = displayOrder.table_name || assignedTables[0]?.name;
    title = /^table\b/i.test(name || "") ? String(name) : `Table ${name}`;
  }

  // Format Subtitle
  let subtitle = displayOrder.channel.toUpperCase().replace('_', ' ');
  if (displayOrder.channel === 'table' || displayOrder.table_name) subtitle = 'DINE-IN';
  if (isRoomServiceOrder) subtitle = 'ROOM SERVICE';

  const tabs: { key: TabKey; label: string; icon: any; count?: number }[] = [
    { key: "details", label: "Details", icon: FileText },
    { key: "kots", label: "KOTs", icon: ChefHat, count: context.kots?.length || 0 },
    { key: "events", label: "Events", icon: Activity },
  ];

  console.log("Rendering Order Detail", orderId);

  return (
    <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-5 pb-24 md:pb-8">
      <OrderDetailAppBarTitle title={title} />
      {/* ── Header ── */}
      <header className="flex flex-col gap-3 border-b border-border/50 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ChannelIcon className="h-4 w-4" />
          </div>
          <span className="text-xs font-semibold">{subtitle}</span>
          <span className="h-1 w-1 shrink-0 rounded-full bg-muted-foreground/30" />
          <span className="truncate text-xs">{timeAgo(order.created_at)}</span>
          <div
            className={cn(
              "ml-auto shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold sm:ml-1",
              statusBadgeColor
            )}
          >
            {String(order.status).replace(/_/g, " ")}
          </div>
        </div>

        <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
          {isEditable && isTableOrder && canTransferOrder && (
            <Button variant="outline" size="sm" onClick={handleOpenChangeTable} className="h-10 shrink-0 gap-2 rounded-xl px-3 font-semibold hover:bg-muted">
              <Table2 className="h-4 w-4" /> <span className="hidden sm:inline">Change table</span><span className="sm:hidden">Table</span>
            </Button>
          )}

          {isEditable && (
            <Link href={`/orders/${orderId}/add-items`} className="shrink-0">
              <Button variant="outline" size="sm" className="h-10 gap-2 rounded-xl px-3 font-semibold">
                <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Add items</span><span className="sm:hidden">Add</span>
              </Button>
            </Link>
          )}

          {String(order.status).toLowerCase() === "requested" ? (
            <Button
              size="sm"
              className="h-10 min-w-0 flex-1 gap-2 rounded-xl bg-indigo-600 px-3 font-semibold text-white shadow-sm hover:bg-indigo-700 sm:flex-none"
              onClick={handleVerifyOrder}
              disabled={verifying}
            >
              {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              Verify
            </Button>
          ) : !isRoomServiceOrder && isEditable && isFullyPaid ? (
            <Button
              size="sm"
              className="h-10 min-w-0 flex-1 gap-2 rounded-xl bg-emerald-600 px-3 font-semibold text-white shadow-sm hover:bg-emerald-700 sm:flex-none"
              onClick={handleComplete}
              disabled={completing}
            >
              {completing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              Complete
            </Button>
          ) : (
            <Link href={`/orders/${orderId}/checkout`} className="min-w-0 flex-1 sm:flex-none">
              <Button size="sm" className="h-10 w-full min-w-0 gap-2 rounded-xl px-3 font-semibold shadow-sm sm:w-auto">
                <Receipt className="h-4 w-4 shrink-0" />
                <span className="truncate">
                  {isRoomServiceOrder ? "Mark delivered" : isFullyPaid ? "Payments" : "Checkout"}
                </span>
              </Button>
            </Link>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-xl" aria-label="More order actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem asChild>
                <Link href={`/orders/${orderId}/receipt`} className="flex cursor-pointer items-center gap-2">
                  <Eye className="h-4 w-4" /> View receipt
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleRefresh} className="gap-2">
                <RefreshCw className="h-4 w-4" /> Refresh order
              </DropdownMenuItem>
              {(isCancellable || String(order.status).toLowerCase() === "requested") && canVoidOrder && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="gap-2 text-destructive focus:text-destructive"
                    onSelect={() => {
                      setCancelReason(String(order.status).toLowerCase() === "requested" ? "Rejected by staff" : "");
                      setCancelOpen(true);
                    }}
                  >
                    <Ban className="h-4 w-4" />
                    {String(order.status).toLowerCase() === "requested" ? "Reject order" : "Cancel order"}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* ── Tab Bar ── */}
      <nav aria-label="Order detail sections" className="grid grid-cols-3 gap-1 rounded-xl border border-border/40 bg-muted/30 p-1">
        {tabs.map((tab) => {
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-xs font-semibold transition-all duration-200",
                activeTab === tab.key
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <TabIcon className="h-3.5 w-3.5" />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={cn(
                  "ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-black",
                  activeTab === tab.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* ── Content Grid ── */}
      <div className="w-full max-w-3xl min-w-0">
        <div className="space-y-4">
          {activeTab === "details" && (
            <DetailsTab
              order={displayOrder}
              tables={context.tables}
              onRefresh={fetchContext}
              canMarkNc={canMarkNc}
              itemOverrides={itemOverrides}
              setItemOverrides={setItemOverrides}
              summary={
                <OrderBillSummary
                  order={displayOrder}
                  payments={context.payments}
                  computedDiscount={computedDiscount}
                />
              }
            />
          )}
            {activeTab === "kots" && (
              <KOTsTab
                kots={context.kots}
                onStatusChange={handleKotStatusChange}
                onReject={handleKotReject}
                updatingKotId={kotUpdatingId}
              />
            )}
          {activeTab === "events" && <EventsTab events={events} loading={eventsLoading} />}
        </div>
      </div>

      {/* ── Cancel Dialog ── */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel Order</DialogTitle>
            <DialogDescription>
              This action cannot be undone. Please provide a reason for cancellation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Input
              placeholder="Reason for cancellation..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>Go Back</Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={canceling || !cancelReason.trim()}
              className="gap-2"
            >
              {canceling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
              {canceling ? "Canceling..." : "Cancel Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Change Table Dialog ── */}
      <Dialog open={changeTableOpen} onOpenChange={setChangeTableOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>Change or Merge Table</DialogTitle>
            <DialogDescription>
              {multiAssignMode
                ? "Select multiple available tables for this order. Occupied tables require merge mode (single-table)."
                : "Select a target table to move this order to or merge it with another active order."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0 py-4 px-1 space-y-4 no-scrollbar">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant={multiAssignMode ? "secondary" : "outline"}
                size="sm"
                className={cn(
                  "h-8 text-xs font-bold gap-2",
                  multiAssignMode && "bg-orange-600 hover:bg-orange-700 text-white",
                )}
                onClick={() => {
                  setMultiAssignMode((prev) => !prev);
                  setSelectedTableId("");
                  if (!multiAssignMode) {
                    setSelectedTableIds(getAssignedTableIds(order, context.tables));
                  }
                }}
              >
                <Table2 className="h-3.5 w-3.5" />
                Multi-Table Assign
              </Button>
              {multiAssignMode && selectedTableIds.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {selectedTableIds.length} table{selectedTableIds.length === 1 ? "" : "s"} selected
                  {selectedTableIds.length > 1 && (
                    <span className="ml-1 font-medium text-foreground">
                      ({selectedTableIds
                        .map((id) => allTables.find((t) => t.id === id)?.table_name || id)
                        .join(", ")})
                    </span>
                  )}
                </span>
              )}
            </div>

            {/* Area Filter */}
            <div className="flex flex-wrap items-center gap-2 p-1 bg-muted/30 rounded-2xl w-fit">
              {(() => {
                const set = new Set<string>();
                tableTypes.forEach((tt) => set.add(tt.name));
                allTables.forEach((t) => { if (t.table_type_name) set.add(t.table_type_name); });
                const areas = ["All Areas", ...Array.from(set).sort()];
                
                return areas.map((area) => (
                  <button
                    key={area}
                    onClick={() => setSelectedArea(area)}
                    className={cn(
                      "px-4 py-1.5 rounded-xl text-xs font-bold transition-all duration-300",
                      selectedArea === area
                        ? "bg-white dark:bg-zinc-800 text-foreground shadow-sm ring-1 ring-border/50"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    {area}
                  </button>
                ));
              })()}
            </div>

            {/* Status Legend */}
            <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /><span>Available (Move)</span></div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /><span>Occupied (Merge)</span></div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-500" /><span>Reserved (Merge)</span></div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {(() => {
                const filtered = selectedArea === "All Areas" ? allTables : allTables.filter((t) => (t.table_type_name || "General") === selectedArea);
                const grouped = filtered.reduce((acc, table) => {
                  const area = table.table_type_name || "General";
                  if (!acc[area]) acc[area] = [];
                  acc[area].push(table);
                  return acc;
                }, {} as Record<string, TableData[]>);
                const sortedRooms = Object.keys(grouped).sort();
                
                const getLayoutHeight = (areaName: string) => {
                  const tt = tableTypes.find((t) => t.name === areaName);
                  return tt?.layout_height ?? 200;
                };

                return sortedRooms.map((roomName) => (
                  <RoomContainer
                    key={roomName}
                    title={roomName}
                    tables={grouped[roomName]}
                    layoutHeight={getLayoutHeight(roomName)}
                    onTableClick={handleChangeTableClick}
                    selectedTableId={multiAssignMode ? undefined : Number(selectedTableId) || undefined}
                    selectedTableIds={multiAssignMode ? selectedTableIds : undefined}
                  />
                ));
              })()}
            </div>
          </div>

          <DialogFooter className="shrink-0 pt-4 border-t">
            <Button variant="outline" onClick={() => setChangeTableOpen(false)}>Cancel</Button>
            {(() => {
              if (multiAssignMode) {
                return (
                  <Button
                    onClick={handleChangeTable}
                    disabled={changingTable || selectedTableIds.length === 0}
                    className="gap-2"
                  >
                    {changingTable ? <Loader2 className="h-4 w-4 animate-spin" /> : <Table2 className="h-4 w-4" />}
                    {changingTable
                      ? "Assigning..."
                      : `Assign ${selectedTableIds.length || ""} Table${selectedTableIds.length === 1 ? "" : "s"}`.trim()}
                  </Button>
                );
              }
              const selectedTable = allTables.find((t) => String(t.id) === selectedTableId);
              const isOccupiedTarget = selectedTable && !isTableAvailable(selectedTable.status);
              return (
                <Button
                  onClick={handleChangeTable}
                  disabled={changingTable || !selectedTableId}
                  className="gap-2"
                >
                  {changingTable ? <Loader2 className="h-4 w-4 animate-spin" /> : <Table2 className="h-4 w-4" />}
                  {changingTable ? "Transferring..." : isOccupiedTarget ? "Merge Bill" : "Move Bill"}
                </Button>
              );
            })()}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Details Tab ─────────────────────────────────────
function OrderBillSummary({
  order,
  payments,
  computedDiscount,
}: {
  order: Order;
  payments: OrderPayment[];
  computedDiscount: number;
}) {
  return (
    <Card className="overflow-hidden border-border/50 bg-card shadow-sm">
      <CardContent className="space-y-3 p-4">
        <h3 className="text-sm font-semibold">Bill summary</h3>

        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="tabular-nums font-medium">{formatCurrency(order.subtotal)}</span>
        </div>

        {order.tax_total > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tax</span>
            <span className="tabular-nums font-medium">{formatCurrency(order.tax_total)}</span>
          </div>
        )}

        {order.service_charge > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Service charge</span>
            <span className="tabular-nums font-medium">{formatCurrency(order.service_charge)}</span>
          </div>
        )}

        {computedDiscount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="font-medium text-emerald-600 dark:text-emerald-400">Discount</span>
            <span className="tabular-nums font-medium text-emerald-600 dark:text-emerald-400">
              -{formatCurrency(computedDiscount)}
            </span>
          </div>
        )}

        {payments.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2 pt-1">
              <p className="text-xs font-medium text-muted-foreground">Payments</p>
              {payments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between text-sm">
                  <span className="flex min-w-0 items-center gap-2 capitalize">
                    <CreditCard className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{payment.method}</span>
                  </span>
                  <span className="shrink-0 tabular-nums font-medium text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(payment.amount)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>

      <div className="flex items-center justify-between border-t border-border/30 bg-muted/30 px-4 py-3">
        <span className="text-sm font-semibold">Total</span>
        <span className="text-xl font-bold tracking-tight tabular-nums text-foreground">
          <span className="mr-1 text-sm font-medium text-muted-foreground">Rs.</span>
          {order.grand_total.toLocaleString()}
        </span>
      </div>
    </Card>
  );
}

function DetailsTab({
  order,
  tables,
  onRefresh,
  canMarkNc,
  itemOverrides,
  setItemOverrides,
  summary,
}: {
  order: Order;
  tables: OrderTableSummary[];
  onRefresh: () => void;
  canMarkNc: boolean;
  itemOverrides: Record<number, Partial<OrderItem>>;
  setItemOverrides: Dispatch<SetStateAction<Record<number, Partial<OrderItem>>>>;
  summary: ReactNode;
}) {
  const router = useRouter();
  const [selectedItem, setSelectedItem] = useState<OrderItem | null>(null);
  const [selectedItemQuantity, setSelectedItemQuantity] = useState(1);
  const [selectedItemNc, setSelectedItemNc] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const displayItems = order.items;

  const handleApplyItemUpdate = useCallback(async (itemId: number, patch: { qty?: number; is_nc?: boolean }) => {
    setIsUpdating(true);
    try {
      const item = order.items.find((candidate) => candidate.id === itemId);
      if (!item) throw new Error("Order line not found");
      const displayItem = displayItems.find((candidate) => candidate.id === itemId) || item;
      const qty = patch.qty ?? displayItem.qty;
      if (patch.qty !== undefined || patch.is_nc !== undefined) {
        await apiClient.patch(OrderApis.updateOrderLine(order.id, item.id), {
          ...(patch.qty !== undefined ? { qty } : {}),
          ...(patch.is_nc !== undefined ? { is_nc: patch.is_nc } : {}),
          expected_version: (order as any).version,
          idempotency_key: crypto.randomUUID(),
        });
      }
      if (patch.qty !== undefined) toast.success("Quantity updated");
      if (patch.is_nc !== undefined) toast.success("NC status updated");
      await onRefresh();
      setItemOverrides({});
      return true;
    } catch (err: any) {
      console.error("Failed to update item:", err);
      toast.error(err.response?.data?.detail || "Failed to update item");
      // Revert optimistic update on error
      setItemOverrides(prev => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
      return false;
    } finally {
      setIsUpdating(false);
    }
  }, [order, displayItems, onRefresh, setItemOverrides]);

  const handleOpenItemDetail = (item: OrderItem) => {
    setSelectedItem(item);
    setSelectedItemQuantity(Number(itemOverrides[item.id]?.qty ?? item.qty));
    setSelectedItemNc(Boolean(itemOverrides[item.id]?.is_nc ?? item.is_nc));
  };

  const handleSaveItemDetail = async () => {
    if (!selectedItem) return;
    const nextQty = Math.max(1, Math.floor(selectedItemQuantity || 1));
    const currentQty = Number(itemOverrides[selectedItem.id]?.qty ?? selectedItem.qty);
    const currentNc = Boolean(itemOverrides[selectedItem.id]?.is_nc ?? selectedItem.is_nc);
    if (nextQty === currentQty && selectedItemNc === currentNc) {
      setSelectedItem(null);
      return;
    }
    const saved = await handleApplyItemUpdate(selectedItem.id, {
      qty: nextQty,
      ...(selectedItemNc !== currentNc ? { is_nc: selectedItemNc } : {}),
    });
    if (saved) setSelectedItem(null);
  };

  return (
    <div className="space-y-4">
      {/* Items Card */}
      <Card className="overflow-hidden border-border/50 bg-card shadow-sm">
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b border-border/30 px-4 py-3">
            <div className="flex items-center gap-2">
              <Utensils className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Items</span>
            </div>
            <Badge variant="secondary" className="text-xs font-medium">
              {displayItems.length} items
            </Badge>
          </div>

          <div className="divide-y divide-border/20">
            {displayItems.map((item: OrderItem) => {
              const canEdit = order.status !== "completed" && order.status !== "canceled";
              return (
              <div
                key={item.id}
                role={canEdit ? "button" : undefined}
                tabIndex={canEdit ? 0 : undefined}
                aria-label={canEdit ? `Edit ${item.name_snapshot}` : undefined}
                className={cn(
                  "px-4 py-3.5 transition-colors",
                  canEdit && "cursor-pointer hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
                )}
                onClick={canEdit ? () => handleOpenItemDetail(item) : undefined}
                onKeyDown={canEdit ? (event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleOpenItemDetail(item);
                  }
                } : undefined}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{item.name_snapshot}</p>
                    {item.category_name_snapshot && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {item.category_name_snapshot}
                      </p>
                    )}
                    {item.modifiers && item.modifiers.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {item.modifiers.map((m) => (
                          <Badge key={m.id} variant="secondary" className="text-[10px] font-medium px-2 py-0.5">
                            {m.modifier_name_snapshot}
                            {m.price_adjustment_snapshot !== 0 && (
                              <span className="ml-1 text-muted-foreground">+{formatCurrency(m.price_adjustment_snapshot)}</span>
                            )}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {item.notes && (
                      <p className="text-xs text-muted-foreground italic mt-1.5">📝 {item.notes}</p>
                    )}
                    {item.is_nc && (
                      <Badge variant="outline" className="mt-2 h-5 text-[10px] font-semibold text-orange-600 border-orange-500/40">
                        NC
                      </Badge>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0 flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="rounded-md bg-muted px-2 py-1 text-xs font-semibold tabular-nums">
                        ×{item.qty}
                      </span>
                      <span className="font-bold text-sm tabular-nums">{formatCurrency(item.line_total)}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      @ {formatCurrency(item.unit_price)}
                    </span>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {summary}

      {/* Quick Info Card */}
      <Card className="overflow-hidden border-border/50 bg-card shadow-sm">
        <CardContent className="p-0">
          <div className="border-b border-border/30 px-4 py-3">
            <h3 className="text-sm font-semibold">Order details</h3>
          </div>

          <div className="grid grid-cols-2 divide-x divide-y divide-border/30">
            {/* Tables */}
            {tables && tables.length > 0 ? (
              <div className="flex min-w-0 items-start gap-2.5 p-3 text-sm">
                <div className="mt-0.5 rounded-lg bg-orange-500/10 p-2">
                  <Armchair className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate font-semibold text-foreground">
                    {tables.length > 1
                      ? `${tables.find((t) => t.id === order.table_id)?.name || tables[0]?.name || `Table ${order.table_id}`} + ${tables.length - 1}`
                      : tables.map((t) => t.name || `Table ${t.id}`).join(", ")}
                  </p>
                  <p className="line-clamp-2 text-[10px] leading-snug text-muted-foreground">
                    {tables.map((t) => t.name || `Table ${t.id}`).join(", ")}
                    {tables.some((t) => t.capacity) && (
                      <span className="block mt-0.5 normal-case">
                        {tables.reduce((sum, t) => sum + (t.capacity || 0), 0)} seats total
                      </span>
                    )}
                  </p>
                </div>
              </div>
            ) : order.table_ids && order.table_ids.length > 1 ? (
              <div className="flex min-w-0 items-start gap-2.5 p-3 text-sm">
                <div className="mt-0.5 rounded-lg bg-orange-500/10 p-2">
                  <Armchair className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate font-semibold text-foreground">
                    {(order.table_name || `Table ${order.table_id}`) + ` + ${order.table_ids.length - 1}`}
                  </p>
                  <p className="line-clamp-2 text-[10px] leading-snug text-muted-foreground">
                    {order.table_ids.map((id) => `Table ${id}`).join(", ")}
                  </p>
                </div>
              </div>
            ) : order.table_name ? (
              <div className="flex min-w-0 items-center gap-2.5 p-3 text-sm">
                <div className="rounded-lg bg-orange-500/10 p-2">
                  <Armchair className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">{order.table_name}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{order.table_category_name || "Table"}</p>
                </div>
              </div>
            ) : null}

            {/* Customer */}
            {order.customer_name ? (
              <div className="flex min-w-0 items-center gap-2.5 p-3 text-sm">
                <div className="rounded-lg bg-blue-500/10 p-2">
                  <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">{order.customer_name}</p>
                  {order.customer_phone && (
                    <p className="text-[10px] text-muted-foreground">{order.customer_phone}</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex min-w-0 items-center gap-2.5 p-3 text-sm">
                <div className="rounded-lg bg-blue-500/10 p-2">
                  <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">Walk-in customer</p>
                  <p className="text-[10px] text-muted-foreground">Guest</p>
                </div>
              </div>
            )}

            {/* Guests */}
            {order.number_of_guests ? (
              <div className="flex min-w-0 items-center gap-2.5 p-3 text-sm">
                <div className="rounded-lg bg-purple-500/10 p-2">
                  <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">{order.number_of_guests} guests</p>
                  <p className="text-[10px] text-muted-foreground">Party size</p>
                </div>
              </div>
            ) : (
              <div className="flex min-w-0 items-center gap-2.5 p-3 text-sm">
                <div className="rounded-lg bg-purple-500/10 p-2">
                  <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">1 guest</p>
                  <p className="text-[10px] text-muted-foreground">Party size</p>
                </div>
              </div>
            )}

            {/* Time / Date */}
            <div className="flex min-w-0 items-center gap-2.5 p-3 text-sm">
              <div className="rounded-lg bg-muted p-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-foreground">{formatTime(order.created_at)}</p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(order.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="m-3 rounded-lg border border-border/30 bg-muted/50 p-3 text-sm italic text-muted-foreground">
              {order.notes}
            </div>
          )}
        </CardContent>
      </Card>


      <Sheet open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <SheetContent side="bottom" className="mx-auto w-full max-w-3xl rounded-t-2xl px-6 pb-6 pt-8">
          <SheetHeader className="pr-8">
            <SheetTitle>{selectedItem?.name_snapshot}</SheetTitle>
            <SheetDescription>
              {selectedItem?.category_name_snapshot || "Menu item"} · {selectedItem ? formatCurrency(selectedItem.unit_price) : ""} each
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-5 py-6">
            <div className="flex items-center justify-between rounded-xl border border-border/60 p-4">
              <div>
                <p className="font-semibold">Quantity</p>
                <p className="text-sm text-muted-foreground">Changes are sent to the kitchen only when you confirm.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10"
                  disabled={isUpdating || selectedItemQuantity <= 1}
                  onClick={() => setSelectedItemQuantity((value) => Math.max(1, value - 1))}
                  aria-label="Reduce quantity"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  type="number"
                  min={1}
                  value={selectedItemQuantity}
                  onChange={(event) => setSelectedItemQuantity(Math.max(1, Number(event.target.value) || 1))}
                  className="h-10 w-20 text-center font-bold tabular-nums"
                  aria-label="Quantity"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10"
                  disabled={isUpdating}
                  onClick={() => setSelectedItemQuantity((value) => value + 1)}
                  aria-label="Increase quantity"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {canMarkNc && (
              <button
                type="button"
                className={cn(
                  "flex w-full items-center justify-between rounded-xl border p-4 text-left transition-colors",
                  selectedItemNc ? "border-orange-500/50 bg-orange-50 dark:bg-orange-950/20" : "border-border/60 hover:bg-muted/40"
                )}
                disabled={isUpdating}
                onClick={() => setSelectedItemNc((value) => !value)}
              >
                <div className="flex items-center gap-3">
                  <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", selectedItemNc ? "bg-orange-500 text-white" : "bg-muted text-muted-foreground")}>
                    <Award className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="font-semibold">Non-chargeable (NC)</p>
                    <p className="text-sm text-muted-foreground">Exclude this item from the bill.</p>
                  </div>
                </div>
                <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", selectedItemNc ? "bg-orange-500 text-white" : "bg-muted text-muted-foreground")}>
                  {selectedItemNc ? "NC" : "Chargeable"}
                </span>
              </button>
            )}
          </div>

          <SheetFooter>
            <Button variant="outline" onClick={() => setSelectedItem(null)} disabled={isUpdating}>Cancel</Button>
            <Button onClick={handleSaveItemDetail} disabled={!selectedItem || isUpdating}>
              {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Update & Send
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ── KOTs Tab ────────────────────────────────────────
function KOTsTab({
  kots,
  onStatusChange,
  onReject,
  updatingKotId,
}: {
  kots: KOTUpdate[];
  onStatusChange?: (kotId: number, status: string) => void;
  onReject?: (kotId: number) => void;
  updatingKotId?: number | null;
}) {
  if (!kots || kots.length === 0) {
    return (
      <Card className="border-border/50 bg-card shadow-sm">
        <CardContent className="flex min-h-48 flex-col items-center justify-center p-6 text-center text-muted-foreground">
          <div className="mb-3 rounded-xl bg-muted p-3">
            <ChefHat className="h-5 w-5" />
          </div>
          <p className="text-sm font-semibold text-foreground">No kitchen tickets yet</p>
          <p className="mt-1 max-w-xs text-xs leading-relaxed">Kitchen tickets appear when ordered items are sent to the kitchen.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {kots.map((kot) => {
        const statusConfig = getKOTStatusConfig(kot.status);
        const next = nextKotStatus(kot.status);
        const action = kotActionLabel(kot.status);
        const isUpdating = updatingKotId === kot.id;
        return (
          <Card key={kot.id} className={cn("overflow-hidden border-border/50 bg-card shadow-sm", statusConfig.bg)}>
            <CardContent className="p-0">
              {/* KOT Header */}
              <div className="flex flex-col gap-3 border-b border-border/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="rounded-lg bg-background/80 p-2">
                    <ChefHat className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold">{getKOTHeading(kot)}</span>
                      <Badge variant="secondary" className={cn("shrink-0 text-[10px] font-semibold", statusConfig.color)}>
                        {statusConfig.label}
                      </Badge>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span className="truncate capitalize">{kot.station}</span>
                      <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                      <span className="capitalize">{kot.type}</span>
                      <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                      <span>{formatTime(kot.created_at)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:justify-end">
                  {action && next && onStatusChange && (
                    <Button
                      size="sm"
                      className="h-8 flex-1 px-3 text-xs sm:flex-none"
                      onClick={() => onStatusChange(kot.id, kot.status)}
                      disabled={isUpdating || Boolean(updatingKotId && updatingKotId !== kot.id)}
                    >
                      {isUpdating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                      {action}
                    </Button>
                  )}
                  {next && onReject && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-3 text-xs text-destructive hover:text-destructive"
                      onClick={() => onReject(kot.id)}
                      disabled={isUpdating || Boolean(updatingKotId && updatingKotId !== kot.id)}
                    >
                      Reject
                    </Button>
                  )}
                </div>
              </div>

              {/* KOT Items */}
              <div className="divide-y divide-border/10">
                {kot.items.map((item) => {
                  const display = getKOTItemDisplay(item);
                  const itemStatus = getKOTStatusConfig(item.item_status || "pending");
                  const isDeleted = Number(item.is_deleted || 0) === 1;

                  return (
                    <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={cn("text-sm font-medium", isDeleted && "line-through text-muted-foreground")}>
                            {display.name}
                          </span>
                          <Badge variant="secondary" className={cn("text-[10px] font-medium", itemStatus.color)}>
                            {isDeleted ? "Cancelled" : itemStatus.label}
                          </Badge>
                        </div>
                        {item.notes && (
                          <p className="mt-1 text-[10px] text-muted-foreground italic">Note: {item.notes}</p>
                        )}
                        {item.modifiers && item.modifiers.length > 0 && (
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            {item.modifiers.map((modifier) => modifier.modifier_name_snapshot).join(", ")}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-sm font-bold tabular-nums">×{display.quantity}</span>
                        {display.progressLabel && (
                          <Badge variant="secondary" className="text-[10px]">
                            {display.progressLabel}
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ── Events Tab ──────────────────────────────────────
function EventsTab({ events, loading }: { events: OrderEvent[]; loading: boolean }) {
  if (loading) {
    return (
      <Card className="border-border/50 bg-card shadow-sm">
        <CardContent className="space-y-4 p-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (events.length === 0) {
    return (
      <Card className="border-border/50 bg-card shadow-sm">
        <CardContent className="flex min-h-48 flex-col items-center justify-center p-6 text-center text-muted-foreground">
          <div className="mb-3 rounded-xl bg-muted p-3">
            <Activity className="h-5 w-5" />
          </div>
          <p className="text-sm font-semibold text-foreground">No activity yet</p>
          <p className="mt-1 max-w-xs text-xs leading-relaxed">Updates to this order will appear here.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 bg-card shadow-sm">
      <CardContent className="p-4">
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute bottom-3 left-4 top-3 w-px bg-border/40" />

          <div className="space-y-0">
            {events.map((event, index) => {
              const isFirst = index === 0;
              return (
                <div key={event.id} className="relative flex gap-3 pb-5 last:pb-0">
                  {/* Timeline dot */}
                  <div className={cn(
                    "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                    isFirst
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-border/50 bg-muted text-muted-foreground"
                  )}>
                    <Activity className="h-3.5 w-3.5" />
                  </div>

                  {/* Event Content */}
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-sm font-semibold text-foreground">{event.title}</p>
                    {event.result && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{event.result}</p>}
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
                      {event.triggered_by?.name && (
                        <>
                          <span className="font-medium">{event.triggered_by.name}</span>
                          <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                        </>
                      )}
                      {event.triggered_at && (
                        <span>{new Date(event.triggered_at).toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
