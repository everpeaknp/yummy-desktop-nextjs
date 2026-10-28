"use client";

import {
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import apiClient from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { hasPermission } from "@/lib/role-permissions";
import { useOrderFull } from "@/hooks/use-order-full";
import {
  OrderApis,
  KotApis,
  TableApis,
  TableTypeApis,
} from "@/lib/api/endpoints";
import {
  RoomContainer,
  type TableData,
} from "@/components/tables/room-container";
import {
  cn,
  formatCurrency as formatProductCurrency,
  formatDate,
  formatDateTime,
} from "@/lib/utils";
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
  getChannelIcon,
  getStatusBadgeColor,
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
import { PendingItemRequests } from "@/components/orders/pending-item-requests";
import { TableBillSwitcher } from "@/components/orders/table-bill-switcher";
import { OrderCheckoutWorkspace } from "@/components/orders/order-checkout-workspace";
import { OrderItemQuantitySheet, type OrderItemQuantityPatch } from "@/components/orders/order-item-quantity-sheet";
import { usePosBillingPermissions } from "@/hooks/use-pos-billing-permissions";
import { getOrderDiscountLabel, getRecordedOrderDiscount } from "@/lib/order-totals";
import { KotEmbeddedTicketCard, KotTicketDetail, type KitchenTicket, type KotActivityEntry } from "@/components/kitchen/kot-ticket-card";
import { KotTicketItems } from "@/components/kitchen/kot-ticket-items";
import { KotSavedPrintEvents } from "@/components/receipts/kot-saved-print-events";
import { SalesDocumentDetailSheet } from "@/components/finance/transaction-detail/sales-document-detail-sheet";
import { useMobileAppBarTitle } from "@/components/layout/mobile-app-bar-title";

// ── Helpers ──────────────────────────────────────────
function formatCurrency(amount: number) {
  return formatProductCurrency(amount);
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
  return new Date(dateStr).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
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
    ? item.modifiers.reduce(
        (sum, modifier) =>
          sum + Number(modifier.price_adjustment_snapshot || 0),
        0,
      )
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

function getAssignedTableIds(
  order: Order,
  tables: OrderTableSummary[],
): number[] {
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
    case "pending":
      return {
        label: "Pending",
        color: "#f59e0b",
        bg: "bg-amber-500/10",
        icon: Clock,
      };
    case "running":
      return {
        label: "Running",
        color: "#3b82f6",
        bg: "bg-blue-500/10",
        icon: Activity,
      };
    case "preparing":
      return {
        label: "Preparing",
        color: "#f97316",
        bg: "bg-orange-500/10",
        icon: ChefHat,
      };
    case "ready":
      return {
        label: "Ready",
        color: "#10b981",
        bg: "bg-emerald-500/10",
        icon: CheckCircle,
      };
    case "completed":
      return {
        label: "Completed",
        color: "#10b981",
        bg: "bg-emerald-500/10",
        icon: CheckCircle,
      };
    case "canceled":
      return {
        label: "Canceled",
        color: "#ef4444",
        bg: "bg-red-500/10",
        icon: XCircle,
      };
    case "requested":
      return {
        label: "Pending Verification",
        color: "#6366f1",
        bg: "bg-indigo-500/10",
        icon: Timer,
      };
    default:
      return {
        label: s,
        color: "#64748b",
        bg: "bg-slate-500/10",
        icon: Circle,
      };
  }
}

type DetailKotStatus =
  "PENDING" | "PREPARING" | "READY" | "SERVED" | "REJECTED";

function nextKotStatus(status: string): DetailKotStatus | null {
  const normalized = status.trim().toUpperCase();
  if (normalized === "PENDING" || normalized === "ACKNOWLEDGED")
    return "PREPARING";
  if (normalized === "PREPARING" || normalized === "PARTIAL") return "READY";
  if (normalized === "READY") return "SERVED";
  return null;
}

function kotActionLabel(status: string): string | null {
  const normalized = status.trim().toUpperCase();
  if (normalized === "PENDING" || normalized === "ACKNOWLEDGED")
    return "Start cooking";
  if (normalized === "PREPARING" || normalized === "PARTIAL")
    return "Mark ready";
  if (normalized === "READY") return "Mark served";
  return null;
}

type TabKey = "details" | "kots" | "events";

// ── Main Page ────────────────────────────────────────
export default function OrderDetailPage() {
  const params = useParams() as { id?: string | string[] } | null;
  const rawId = Array.isArray(params?.id) ? params?.id[0] : params?.id;
  const orderId = Number(rawId || 0);
  return <OrderDetailContent key={orderId} orderId={orderId} />;
}

function OrderDetailContent({ orderId }: { orderId: number }) {
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
  const [itemOverrides, setItemOverrides] = useState<
    Record<number, Partial<OrderItem>>
  >({});
  const [selectedItem, setSelectedItem] = useState<OrderItem | null>(null);
  const [itemUpdating, setItemUpdating] = useState(false);
  const [billRefreshToken, setBillRefreshToken] = useState(0);
  const [kotUpdatingIds, setKotUpdatingIds] = useState<Set<number>>(new Set());

  const {
    canVoidOrder,
    canTransferOrder,
    canMarkNc,
    canEditOrder,
    canViewBilling,
    canProcessPayment,
    canViewReceipt,
    canSplitPayment,
  } =
    usePosBillingPermissions();
  const sourceOrder = context?.order;
  const checkoutBillRefreshToken = `${billRefreshToken}:${JSON.stringify(
    sourceOrder?.items.map((item) => [
      item.id,
      item.qty,
      item.unit_price,
      item.line_total,
      Boolean(item.is_nc),
      item.modifiers?.map((modifier) => [
        modifier.modifier_id,
        modifier.price_adjustment_snapshot,
      ]),
    ]) ?? [],
  )}`;
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
        const subtotal = Number(
          items
            .reduce((sum, item) => sum + Number(item.line_total || 0), 0)
            .toFixed(2),
        );
        const computedDiscount = computeOrderDiscount(sourceOrder);
        // Menu prices/subtotal are tax-inclusive; VAT is reported separately
        // and must not be added to the amount due a second time.
        const grandTotal = Number(
          (
            subtotal +
            Number(sourceOrder.service_charge || 0) -
            computedDiscount
          ).toFixed(2),
        );
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
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("accessToken")
          : null;
      if (!user && token) await me();
      const updatedToken =
        typeof window !== "undefined"
          ? localStorage.getItem("accessToken")
          : null;
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
      const res = await apiClient.get(
        OrderApis.getOrderEvents(orderId, "group"),
      );
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


  const handleOpenItemDetail = useCallback((item: OrderItem) => {
    setSelectedItem(item);
  }, []);

  const handleApplyItemUpdate = useCallback(
    async (itemId: number, patch: OrderItemQuantityPatch) => {
      const item = sourceOrder?.items.find((candidate) => candidate.id === itemId);
      if (!sourceOrder || !item) {
        toast.error("Order line not found");
        return false;
      }

      setItemUpdating(true);
      try {
        await apiClient.patch(OrderApis.updateOrderLine(sourceOrder.id, item.id), {
          qty: patch.qty,
          ...(patch.is_nc !== undefined ? { is_nc: patch.is_nc } : {}),
          expected_version: (sourceOrder as any).version,
          idempotency_key: crypto.randomUUID(),
        });
        toast.success("Order item updated");
        await fetchContext();
        setItemOverrides({});
        setBillRefreshToken((version) => version + 1);
        return true;
      } catch (err: any) {
        console.error("Failed to update item:", err);
        toast.error(err.response?.data?.detail || "Failed to update item");
        setItemOverrides((prev) => {
          const next = { ...prev };
          delete next[itemId];
          return next;
        });
        return false;
      } finally {
        setItemUpdating(false);
      }
    },
    [fetchContext, setItemOverrides, sourceOrder],
  );

  const handleSaveItemDetail = useCallback(
    async (patch: OrderItemQuantityPatch) => {
      if (!selectedItem) return false;
      const saved = await handleApplyItemUpdate(selectedItem.id, patch);
      if (saved) setSelectedItem(null);
      return saved;
    },
    [handleApplyItemUpdate, selectedItem],
  );

  const handleKotStatusChange = useCallback(
    async (kotId: number, status: string) => {
      const next = nextKotStatus(status);
      if (!next) return;
      const previousKot = context?.kots.find((kot) => kot.id === kotId);
      updateKotLocal(kotId, { status: next });
      setKotUpdatingIds((current) => new Set(current).add(kotId));
      try {
        const response = await apiClient.patch(
          KotApis.updateKotStatus(kotId),
          { status: next },
        );
        const updatedKot = response.data?.data;
        if (updatedKot && Number(updatedKot.id) === kotId) {
          // The backend also updates each item's ready/served quantities. Keep
          // those fields in sync so the ticket does not still show items waiting.
          updateKotLocal(kotId, updatedKot);
        }
        toast.success(`KOT marked ${next.toLowerCase()}`);
      } catch (err: any) {
        if (previousKot) updateKotLocal(kotId, previousKot);
        const detail =
          err?.response?.data?.detail ||
          err?.response?.data?.message ||
          "Failed to update KOT status";
        toast.error(detail);
      } finally {
        setKotUpdatingIds((current) => {
          const next = new Set(current);
          next.delete(kotId);
          return next;
        });
      }
    },
    [context?.kots, updateKotLocal],
  );

  const handleKotReject = useCallback(
    async (kotId: number) => {
      if (
        typeof window !== "undefined" &&
        !window.confirm("Reject this kitchen ticket?")
      )
        return;
      const previousKot = context?.kots.find((kot) => kot.id === kotId);
      updateKotLocal(kotId, { status: "REJECTED" });
      setKotUpdatingIds((current) => new Set(current).add(kotId));
      try {
        await apiClient.post(KotApis.rejectKot(kotId), undefined);
        toast.success("KOT rejected");
      } catch (err: any) {
        if (previousKot) updateKotLocal(kotId, previousKot);
        const detail =
          err?.response?.data?.detail ||
          err?.response?.data?.message ||
          "Failed to reject KOT";
        toast.error(detail);
      } finally {
        setKotUpdatingIds((current) => {
          const next = new Set(current);
          next.delete(kotId);
          return next;
        });
      }
    },
    [context?.kots, updateKotLocal],
  );

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
      await apiClient.post(OrderApis.cancelOrder(orderId), {
        reason: cancelReason,
      });
      setCancelOpen(false);
      setCancelReason("");
      await fetchContext();
    } catch (err: any) {
      console.error("Failed to cancel order:", err);
      const detail =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Failed to cancel order";
      toast.error(detail);
    } finally {
      setCanceling(false);
    }
  };

  // Complete order
  const handleComplete = async () => {
    setCompleting(true);
    try {
      await apiClient.patch(OrderApis.updateOrderStatus(orderId), {
        status: "completed",
      });
      await fetchContext();
    } catch (err: any) {
      console.error("Failed to complete order:", err);
      const detail =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Failed to complete order";
      toast.error(detail);
    } finally {
      setCompleting(false);
    }
  };

  const handleVerifyOrder = async () => {
    setVerifying(true);
    try {
      const res = await apiClient.patch(OrderApis.updateOrderStatus(orderId), {
        status: "pending",
      });
      const updatedOrder = res?.data?.data || res?.data;

      if (updatedOrder?.id && Number(updatedOrder.id) !== Number(orderId)) {
        toast.success(`Order verified and merged into #${updatedOrder.id}`);
        router.push(`/orders/${updatedOrder.id}`);
        return;
      }

      await fetchContext();
      toast.success("Order verified successfully");
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Failed to verify order";
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
        apiClient.get(TableTypeApis.getTableTypes(context.order.restaurant_id)),
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
    const assigned = getAssignedTableIds(
      context?.order ?? ({} as Order),
      context?.tables ?? [],
    );
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
        prev.includes(table.id)
          ? prev.filter((id) => id !== table.id)
          : [...prev, table.id],
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
        const tableIds = buildTableIdsPayload(
          selectedTableIds,
          context?.order.table_id,
        );
        const blocked = tableIds.filter((id) => {
          const t = allTables.find((table) => table.id === id);
          return t && !isTableAvailable(t.status);
        });
        if (blocked.length > 0) {
          toast.error(
            "All selected tables must be available for multi-table assignment.",
          );
          setChangingTable(false);
          return;
        }

        await apiClient.patch(OrderApis.updateOrder(orderId), {
          table_ids: tableIds,
        });
        const names = tableIds
          .map(
            (id) =>
              allTables.find((t) => t.id === id)?.table_name || `Table ${id}`,
          )
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
      const selectedTable = allTables.find(
        (t) => String(t.id) === selectedTableId,
      );
      const isOccupiedTarget =
        selectedTable && !isTableAvailable(selectedTable.status);

      if (isOccupiedTarget) {
        const confirmMerge = window.confirm(
          `Table "${selectedTable?.table_name}" is occupied. Do you want to MERGE this bill into its active order?`,
        );
        if (!confirmMerge) {
          setChangingTable(false);
          return;
        }

        const res = await apiClient.post(
          OrderApis.transferGuestBillTable(orderId),
          {
            destination_table_id: Number(selectedTableId),
          },
        );

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
      toast.error(
        err?.response?.data?.detail || "Failed to transfer/change table",
      );
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
  const statusConfig = getStatusConfig(displayOrder.status);
  const statusBadgeColor = getStatusBadgeColor(displayOrder.status);
  const ChannelIcon = getChannelIcon(displayOrder.channel);
  const isEditable = !["completed", "canceled"].includes(displayOrder.status);
  const isCancellable = !["completed", "canceled"].includes(
    displayOrder.status,
  );
  const isTableOrder = displayOrder.channel === "table";
  const isRoomServiceOrder = displayOrder.channel === "room_service";
  const assignedTables =
    context.tables.length > 0
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
      assignedTables.find((t) => t.id === displayOrder.table_id) ??
      assignedTables[0];
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
  let subtitle = displayOrder.channel.toUpperCase().replace("_", " ");
  if (displayOrder.channel === "table" || displayOrder.table_name)
    subtitle = "DINE-IN";
  if (isRoomServiceOrder) subtitle = "ROOM SERVICE";

  const tabs: { key: TabKey; label: string; icon: any; count?: number }[] = [
    { key: "details", label: "Details", icon: FileText },
    {
      key: "kots",
      label: "KOTs",
      icon: ChefHat,
      count: context.kots?.length || 0,
    },
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
              statusBadgeColor,
            )}
          >
            {statusConfig.label}
          </div>
        </div>

        <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
          {isEditable && isTableOrder && canTransferOrder && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenChangeTable}
              className="h-10 shrink-0 gap-2 rounded-xl px-3 font-semibold hover:bg-muted"
            >
              <Table2 className="h-4 w-4" />{" "}
              <span className="hidden sm:inline">Change table</span>
              <span className="sm:hidden">Table</span>
            </Button>
          )}

          {isEditable && canEditOrder && (
            <Link href={`/orders/${orderId}/add-items`} className="shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="h-10 gap-2 rounded-xl px-3 font-semibold"
              >
                <Plus className="h-4 w-4" />{" "}
                <span className="hidden sm:inline">Add items</span>
                <span className="sm:hidden">Add</span>
              </Button>
            </Link>
          )}

          {String(order.status).toLowerCase() === "requested" && canEditOrder ? (
            <Button
              size="sm"
              className="h-10 min-w-0 flex-1 gap-2 rounded-xl bg-indigo-600 px-3 font-semibold text-white shadow-sm hover:bg-indigo-700 sm:flex-none"
              onClick={handleVerifyOrder}
              disabled={verifying}
            >
              {verifying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              Accept request
            </Button>
          ) : !isRoomServiceOrder && isEditable && isFullyPaid && canEditOrder ? (
            <Button
              size="sm"
              className="h-10 min-w-0 flex-1 gap-2 rounded-xl bg-emerald-600 px-3 font-semibold text-white shadow-sm hover:bg-emerald-700 sm:flex-none"
              onClick={handleComplete}
              disabled={completing}
            >
              {completing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              Complete
            </Button>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 shrink-0 rounded-xl"
                aria-label="More order actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {(canViewBilling || canProcessPayment || (isRoomServiceOrder && hasPermission(user, "hotel.checkout"))) && (
                <DropdownMenuItem onSelect={() => router.push(`/orders/${orderId}/checkout`)} className="gap-2">
                  <Receipt className="h-4 w-4" />
                  {isRoomServiceOrder ? "Mark delivered" : isFullyPaid ? "Payments" : "Checkout"}
                </DropdownMenuItem>
              )}
              {canSplitPayment && isEditable && String(order.status).toLowerCase() !== "requested" && <DropdownMenuItem asChild><Link href={`/orders/${orderId}/checkout#bill-actions`} className="flex cursor-pointer items-center gap-2"><Users className="h-4 w-4" />Manage bills</Link></DropdownMenuItem>}
              {canViewReceipt && <DropdownMenuItem asChild>
                <Link
                  href={`/orders/${orderId}/receipt`}
                  className="flex cursor-pointer items-center gap-2"
                >
                  <Eye className="h-4 w-4" /> View receipt
                </Link>
              </DropdownMenuItem>}
              <DropdownMenuItem onSelect={handleRefresh} className="gap-2">
                <RefreshCw className="h-4 w-4" /> Refresh order
              </DropdownMenuItem>
              {(isCancellable ||
                String(order.status).toLowerCase() === "requested") &&
                canVoidOrder && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="gap-2 text-destructive focus:text-destructive"
                      onSelect={() => {
                        setCancelReason(
                          String(order.status).toLowerCase() === "requested"
                            ? "Rejected by staff"
                            : "",
                        );
                        setCancelOpen(true);
                      }}
                    >
                      <Ban className="h-4 w-4" />
                      {String(order.status).toLowerCase() === "requested"
                        ? "Reject order"
                        : "Cancel order"}
                    </DropdownMenuItem>
                  </>
                )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <OrderItemQuantitySheet
        item={selectedItem}
        canMarkNc={canMarkNc}
        isUpdating={itemUpdating}
        onClose={() => setSelectedItem(null)}
        onSave={handleSaveItemDetail}
      />

      <TableBillSwitcher order={order} canApproveRequests={canEditOrder} canRejectRequests={canVoidOrder} />

      <div className={cn(
        "grid min-w-0 grid-cols-1 items-start gap-6",
        "xl:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]",
      )}>
        <div className="min-w-0">
          {/* ── Tab Bar ── */}
          <nav
        aria-label="Order detail sections"
        className="grid grid-cols-3 gap-1 rounded-xl border border-border/40 bg-muted/30 p-1"
      >
        {tabs.map((tab) => {
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-xs font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1",
                activeTab === tab.key
                  ? "bg-primary/10 text-primary ring-1 ring-inset ring-primary/30 shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <TabIcon className="h-3.5 w-3.5" />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={cn(
                    "ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-black",
                    activeTab === tab.key
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* ── Content Grid ── */}
      <div className="mt-5 w-full min-w-0">
        <div className="space-y-4">
          {activeTab === "details" && (
            <>
            <DetailsTab
              order={displayOrder}
              tables={context.tables}
              onEditItem={handleOpenItemDetail}
              onToggleItemNc={(item) =>
                void handleApplyItemUpdate(item.id, {
                  qty: Number(item.qty),
                  is_nc: !Boolean(item.is_nc),
                })
              }
              canMarkNc={canMarkNc}
              itemUpdating={itemUpdating}
              summary={
                <OrderBillSummary
                  order={displayOrder}
                  payments={context.payments}
                  computedDiscount={computedDiscount}
                />
              }
            />
            <PendingItemRequests requests={context.pending_item_requests || []} canApprove={canEditOrder} canReject={canVoidOrder} onResolved={fetchContext} />
            </>
          )}
          {activeTab === "kots" && (
            <KOTsTab
              kots={context.kots}
              onStatusChange={handleKotStatusChange}
              onReject={handleKotReject}
              onItemUpdated={(updated) => updateKotLocal(updated.id, { ...updated, kot_number: updated.kot_number == null ? null : String(updated.kot_number) } as Partial<KOTUpdate>)}
              canOperate={hasPermission(user, "pos.view")}
              updatingKotIds={kotUpdatingIds}
            />
          )}
          {activeTab === "events" && (
            <EventsTab events={events} loading={eventsLoading} />
          )}
        </div>
        </div>
        </div>
        <aside className="min-w-0 xl:sticky xl:top-4">
          <OrderCheckoutWorkspace
            orderId={orderId}
            presentation="quick"
            billRefreshToken={checkoutBillRefreshToken}
            onEditOrderItem={(itemId) => {
              const item = displayOrder.items.find(
                (candidate) => Number(candidate.id) === Number(itemId),
              );
              if (item) handleOpenItemDetail(item);
            }}
          />
        </aside>
      </div>

      {/* ── Cancel Dialog ── */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel Order</DialogTitle>
            <DialogDescription>
              This action cannot be undone. Please provide a reason for
              cancellation.
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
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Go Back
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={canceling || !cancelReason.trim()}
              className="gap-2"
            >
              {canceling ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Ban className="h-4 w-4" />
              )}
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
                  multiAssignMode &&
                    "bg-orange-600 hover:bg-orange-700 text-white",
                )}
                onClick={() => {
                  setMultiAssignMode((prev) => !prev);
                  setSelectedTableId("");
                  if (!multiAssignMode) {
                    setSelectedTableIds(
                      getAssignedTableIds(order, context.tables),
                    );
                  }
                }}
              >
                <Table2 className="h-3.5 w-3.5" />
                Multi-Table Assign
              </Button>
              {multiAssignMode && selectedTableIds.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {selectedTableIds.length} table
                  {selectedTableIds.length === 1 ? "" : "s"} selected
                  {selectedTableIds.length > 1 && (
                    <span className="ml-1 font-medium text-foreground">
                      (
                      {selectedTableIds
                        .map(
                          (id) =>
                            allTables.find((t) => t.id === id)?.table_name ||
                            id,
                        )
                        .join(", ")}
                      )
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
                allTables.forEach((t) => {
                  if (t.table_type_name) set.add(t.table_type_name);
                });
                const areas = ["All Areas", ...Array.from(set).sort()];

                return areas.map((area) => (
                  <button
                    key={area}
                    onClick={() => setSelectedArea(area)}
                    className={cn(
                      "px-4 py-1.5 rounded-xl text-xs font-bold transition-all duration-300",
                      selectedArea === area
                        ? "bg-white dark:bg-zinc-800 text-foreground shadow-sm ring-1 ring-border/50"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted",
                    )}
                  >
                    {area}
                  </button>
                ));
              })()}
            </div>

            {/* Status Legend */}
            <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>Available (Move)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span>Occupied (Merge)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                <span>Reserved (Merge)</span>
              </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {(() => {
                const filtered =
                  selectedArea === "All Areas"
                    ? allTables
                    : allTables.filter(
                        (t) =>
                          (t.table_type_name || "General") === selectedArea,
                      );
                const grouped = filtered.reduce(
                  (acc, table) => {
                    const area = table.table_type_name || "General";
                    if (!acc[area]) acc[area] = [];
                    acc[area].push(table);
                    return acc;
                  },
                  {} as Record<string, TableData[]>,
                );
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
                    selectedTableId={
                      multiAssignMode
                        ? undefined
                        : Number(selectedTableId) || undefined
                    }
                    selectedTableIds={
                      multiAssignMode ? selectedTableIds : undefined
                    }
                  />
                ));
              })()}
            </div>
          </div>

          <DialogFooter className="shrink-0 pt-4 border-t">
            <Button variant="outline" onClick={() => setChangeTableOpen(false)}>
              Cancel
            </Button>
            {(() => {
              if (multiAssignMode) {
                return (
                  <Button
                    onClick={handleChangeTable}
                    disabled={changingTable || selectedTableIds.length === 0}
                    className="gap-2"
                  >
                    {changingTable ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Table2 className="h-4 w-4" />
                    )}
                    {changingTable
                      ? "Assigning..."
                      : `Assign ${selectedTableIds.length || ""} Table${selectedTableIds.length === 1 ? "" : "s"}`.trim()}
                  </Button>
                );
              }
              const selectedTable = allTables.find(
                (t) => String(t.id) === selectedTableId,
              );
              const isOccupiedTarget =
                selectedTable && !isTableAvailable(selectedTable.status);
              return (
                <Button
                  onClick={handleChangeTable}
                  disabled={changingTable || !selectedTableId}
                  className="gap-2"
                >
                  {changingTable ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Table2 className="h-4 w-4" />
                  )}
                  {changingTable
                    ? "Transferring..."
                    : isOccupiedTarget
                      ? "Merge Bill"
                      : "Move Bill"}
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
          <span className="tabular-nums font-medium">
            {formatCurrency(order.subtotal)}
          </span>
        </div>

        {order.tax_total > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tax included</span>
            <span className="tabular-nums font-medium">
              {formatCurrency(order.tax_total)}
            </span>
          </div>
        )}

        {order.service_charge > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Service charge</span>
            <span className="tabular-nums font-medium">
              {formatCurrency(order.service_charge)}
            </span>
          </div>
        )}

        {computedDiscount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="min-w-0 break-words font-medium text-emerald-600 dark:text-emerald-400">
              {getOrderDiscountLabel(order)}
            </span>
            <span className="tabular-nums font-medium text-emerald-600 dark:text-emerald-400">
              -{formatCurrency(computedDiscount)}
            </span>
          </div>
        )}

        {payments.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2 pt-1">
              <p className="text-xs font-medium text-muted-foreground">
                Payments
              </p>
              {payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between text-sm"
                >
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
          {formatCurrency(order.grand_total)}
        </span>
      </div>
    </Card>
  );
}

function DetailsTab({
  order,
  tables,
  onEditItem,
  onToggleItemNc,
  canMarkNc,
  itemUpdating,
  summary,
}: {
  order: Order;
  tables: OrderTableSummary[];
  onEditItem: (item: OrderItem) => void;
  onToggleItemNc: (item: OrderItem) => void;
  canMarkNc: boolean;
  itemUpdating: boolean;
  summary: ReactNode;
}) {
  const router = useRouter();
  const [selectedItem, setSelectedItem] = useState<OrderItem | null>(null);
  const [selectedItemQuantity, setSelectedItemQuantity] = useState(1);
  const [selectedItemNc, setSelectedItemNc] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const displayItems = order.items.filter((item) => Number(item.qty) > 0);

  return (
    <div className="space-y-4">
      {/* Items Card */}
      <Card className="overflow-hidden border-border/50 bg-card shadow-sm">
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b border-border/30 px-4 py-3">
            <div className="flex items-center gap-2">
              <Utensils className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">{order.status === "requested" ? "Items awaiting approval" : "Accepted items"}</span>
            </div>
            <Badge variant="secondary" className="text-xs font-medium">
              {displayItems.length} {displayItems.length === 1 ? "item" : "items"}
            </Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="border-b border-border/30 bg-muted/20 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-4 py-3">ITEM</th>
                  <th scope="col" className="px-3 py-3 text-center">QTY</th>
                  <th scope="col" className="px-3 py-3 text-right">PRICE</th>
                  <th scope="col" className="px-3 py-3 text-right">TOTAL</th>
                  <th scope="col" className="px-4 py-3 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {displayItems.map((item: OrderItem) => {
                  const canEdit =
                    order.status !== "completed" && order.status !== "canceled";
                  return (
                    <tr
                      key={item.id}
                      className="transition-colors hover:bg-muted/20"
                    >
                      <td className="px-4 py-3.5">
                        <div className="min-w-0">
                          <button
                            type="button"
                            className="flex items-center gap-2 text-left font-semibold text-foreground disabled:cursor-default"
                            disabled={!canEdit}
                            aria-label={`Edit ${item.name_snapshot} quantity`}
                            onClick={() => onEditItem(item)}
                          >
                            {item.name_snapshot}
                            {item.is_nc && (
                              <Badge variant="outline" className="h-5 border-orange-500/40 text-[10px] font-semibold text-orange-600">NC</Badge>
                            )}
                          </button>
                          {item.category_name_snapshot && (
                            <p className="mt-0.5 text-xs text-muted-foreground">{item.category_name_snapshot}</p>
                          )}
                          {item.modifiers?.length ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {item.modifiers.map((modifier) => modifier.modifier_name_snapshot).join(", ")}
                            </p>
                          ) : null}
                          {item.notes && <p className="mt-1 text-xs italic text-muted-foreground">📝 {item.notes}</p>}
                        </div>
                      </td>
                      <td className="px-3 py-3.5 text-center font-semibold tabular-nums">{item.qty}</td>
                      <td className="px-3 py-3.5 text-right text-muted-foreground tabular-nums">{formatCurrency(item.unit_price)}</td>
                      <td className="px-3 py-3.5 text-right font-bold tabular-nums">{formatCurrency(item.line_total)}</td>
                      <td className="px-4 py-3.5 text-right">
                        {canMarkNc && canEdit && (
                          <Button
                            type="button"
                            variant={item.is_nc ? "default" : "outline"}
                            size="sm"
                            className="h-9 gap-1.5"
                            disabled={itemUpdating}
                            aria-label={`${item.is_nc ? "Remove NC from" : "Mark NC for"} ${item.name_snapshot}`}
                            onClick={() => onToggleItemNc(item)}
                          >
                            <Award className="h-4 w-4" />
                            NC
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
                        {tables.reduce((sum, t) => sum + (t.capacity || 0), 0)}{" "}
                        seats total
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
                    {(order.table_name || `Table ${order.table_id}`) +
                      ` + ${order.table_ids.length - 1}`}
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
                  <p className="truncate font-semibold text-foreground">
                    {order.table_name}
                  </p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {order.table_category_name || "Table"}
                  </p>
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
                  <p className="truncate font-semibold text-foreground">
                    {order.customer_name}
                  </p>
                  {order.customer_phone && (
                    <p className="text-[10px] text-muted-foreground">
                      {order.customer_phone}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex min-w-0 items-center gap-2.5 p-3 text-sm">
                <div className="rounded-lg bg-blue-500/10 p-2">
                  <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">
                    Walk-in customer
                  </p>
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
                  <p className="truncate font-semibold text-foreground">
                    {order.number_of_guests} guests
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Party size
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex min-w-0 items-center gap-2.5 p-3 text-sm">
                <div className="rounded-lg bg-purple-500/10 p-2">
                  <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">
                    1 guest
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Party size
                  </p>
                </div>
              </div>
            )}

            {/* Time / Date */}
            <div className="flex min-w-0 items-center gap-2.5 p-3 text-sm">
              <div className="rounded-lg bg-muted p-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-foreground">
                  {formatTime(order.created_at)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {formatDate(order.created_at)}
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

    </div>
  );
}

// ── KOTs Tab ────────────────────────────────────────
function KOTsTab({
  kots,
  onStatusChange,
  onReject,
  onItemUpdated,
  canOperate,
  updatingKotIds,
}: {
  kots: KOTUpdate[];
  onStatusChange?: (kotId: number, status: string) => void;
  onReject?: (kotId: number) => void;
  onItemUpdated: (updated: KitchenTicket) => void;
  canOperate: boolean;
  updatingKotIds?: ReadonlySet<number>;
}) {
  const [selectedKotId, setSelectedKotId] = useState<number | null>(null);
  const [detailTicket, setDetailTicket] = useState<KitchenTicket | null>(null);
  const [activity, setActivity] = useState<KotActivityEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const selectedKot = kots.find((kot) => kot.id === selectedKotId);

  useEffect(() => {
    if (selectedKotId === null) return;
    let cancelled = false;
    setActivityLoading(true);
    setDetailError("");
    Promise.allSettled([
      apiClient.get(KotApis.getKotById(selectedKotId)),
      apiClient.get(KotApis.getKotActivity(selectedKotId), { params: { skip: 0, limit: 100 } }),
    ]).then(([ticketResult, activityResult]) => {
      if (cancelled) return;
      if (ticketResult.status === "fulfilled" && ticketResult.value.data?.status === "success") {
        setDetailTicket(ticketResult.value.data.data);
      } else {
        setDetailError("Could not refresh ticket details. Close and reopen to retry.");
      }
      if (activityResult.status === "fulfilled" && activityResult.value.data?.status === "success") {
        setActivity(activityResult.value.data.data?.items || []);
      } else {
        setDetailError((current) => current ? `${current} Activity could not be loaded.` : "Could not load activity. Close and reopen to retry.");
      }
      setActivityLoading(false);
    });
    return () => { cancelled = true; };
  }, [selectedKotId, selectedKot?.status]);

  if (!kots || kots.length === 0) {
    return (
      <Card className="border-border/50 bg-card shadow-sm">
        <CardContent className="flex min-h-48 flex-col items-center justify-center p-6 text-center text-muted-foreground">
          <div className="mb-3 rounded-xl bg-muted p-3">
            <ChefHat className="h-5 w-5" />
          </div>
          <p className="text-sm font-semibold text-foreground">
            No kitchen tickets yet
          </p>
          <p className="mt-1 max-w-xs text-xs leading-relaxed">
            Kitchen tickets appear when ordered items are sent to the kitchen.
          </p>
        </CardContent>
      </Card>
    );
  }

  const detail = selectedKot ? { ...selectedKot, ...(detailTicket || {}), status: selectedKot.status, items: selectedKot.items } : detailTicket;

  return (
    <>
    <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2 2xl:grid-cols-3">
      {kots.map((kot) => {
        const next = nextKotStatus(kot.status);
        const action = kotActionLabel(kot.status);
        const isUpdating = Boolean(updatingKotIds?.has(kot.id));
        return (
          <KotEmbeddedTicketCard
            key={kot.id}
            kot={kot}
            isUpdating={isUpdating}
            primaryAction={
              action && next && onStatusChange
                ? {
                    label: action,
                    onClick: () => onStatusChange(kot.id, kot.status),
                  }
                : null
            }
            onReject={next && onReject ? () => onReject(kot.id) : undefined}
            onOpenDetails={() => { setDetailTicket(null); setActivity([]); setActivityLoading(true); setSelectedKotId(kot.id); }}
          />
        );
      })}
    </div>
    <Dialog open={selectedKotId !== null} onOpenChange={(open) => { if (!open) { setSelectedKotId(null); setDetailTicket(null); setActivity([]); } }}>
      {detail ? <KotTicketDetail
        ticket={detail}
        printEvents={<KotSavedPrintEvents kotId={detail.id} />}
        activity={activity}
        activityLoading={activityLoading}
        activityAction={detailError ? <p role="status" className="text-xs text-destructive">{detailError}</p> : null}
        onClose={() => setSelectedKotId(null)}
        items={<KotTicketItems ticket={detail} canOperate={canOperate} onUpdated={async (updated) => {
          setDetailTicket(updated);
          onItemUpdated(updated);
          setActivityLoading(true);
          try {
            const response = await apiClient.get(KotApis.getKotActivity(updated.id), { params: { skip: 0, limit: 100 } });
            if (response.data?.status !== "success") throw new Error("Could not load activity");
            setActivity(response.data.data?.items || []);
            setDetailError("");
          } catch {
            setDetailError("Could not load activity. Close and reopen to retry.");
          } finally {
            setActivityLoading(false);
          }
        }} />}
        actions={selectedKot && onStatusChange && nextKotStatus(selectedKot.status) ? <>
          <Button type="button" className="h-11 w-full font-semibold sm:w-auto" disabled={Boolean(updatingKotIds?.has(selectedKot.id))} onClick={() => onStatusChange(selectedKot.id, selectedKot.status)}>{kotActionLabel(selectedKot.status)}</Button>
          {onReject ? <Button type="button" variant="outline" className="h-11 w-full border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive sm:w-auto" disabled={Boolean(updatingKotIds?.has(selectedKot.id))} onClick={() => onReject(selectedKot.id)}>Reject ticket</Button> : null}
        </> : null}
      /> : null}
    </Dialog>
    </>
  );
}

// ── Events Tab ──────────────────────────────────────
function EventsTab({
  events,
  loading,
}: {
  events: OrderEvent[];
  loading: boolean;
}) {
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
          <p className="text-sm font-semibold text-foreground">
            No activity yet
          </p>
          <p className="mt-1 max-w-xs text-xs leading-relaxed">
            Updates to this order will appear here.
          </p>
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
                <div
                  key={event.id}
                  className="relative flex gap-3 pb-5 last:pb-0"
                >
                  {/* Timeline dot */}
                  <div
                    className={cn(
                      "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                      isFirst
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-border/50 bg-muted text-muted-foreground",
                    )}
                  >
                    <Activity className="h-3.5 w-3.5" />
                  </div>

                  {/* Event Content */}
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-sm font-semibold text-foreground">
                      {event.title}
                    </p>
                    {event.result && (
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        {event.result}
                      </p>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
                      {event.triggered_by?.name && (
                        <>
                          <span className="font-medium">
                            {event.triggered_by.name}
                          </span>
                          <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                        </>
                      )}
                      {event.triggered_at && (
                        <span>{formatDateTime(event.triggered_at)}</span>
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
