"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { hasPermission } from "@/lib/role-permissions";
import { useRestaurant } from "@/hooks/use-restaurant";
import {
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  ShoppingCart,
  CheckCircle2,
  XCircle,
  Undo2,
  Calendar,
  User,
  Calculator,
  Utensils,
  Hotel,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import apiClient from "@/lib/api-client";
import { GeneralPurchaseApis, PurchaseApis, PurchaseReturnApis } from "@/lib/api/endpoints";
import { RecordPurchaseDialog } from "@/components/purchases/record-purchase-dialog";
import { PurchaseDialog } from "@/components/manage/purchases/purchase-dialog";
import { FixedAssetsDialog } from "@/components/manage/purchases/fixed-assets-dialog";
import { CashBankAccountSelect, type CashBankAccountOption } from "@/components/finance/cash-bank-account-select";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { FinanceWorkspaceNav } from "@/components/finance/workspace/finance-workspace-nav";
import { MetricCard } from "@/components/cards/metric-card";
import { FilterChip } from "@/components/patterns/controls/filter-chip";
import { SearchField } from "@/components/patterns/controls/search-field";
import { DataList } from "@/components/patterns/data/data-list";
import {
  EmptyState,
  LoadingState,
} from "@/components/patterns/feedback/feedback-state";
import { AppPage } from "@/components/patterns/page/app-page";
import { PageHeader } from "@/components/patterns/page/page-header";
import {
  TransactionDetailSheet,
  type TransactionDetailModel,
} from "@/components/finance/transaction-detail/transaction-detail-sheet";

type BusinessLineFilter = "all" | "restaurant" | "hotel";

const purchaseStatusLabels: Record<string, string> = {
  cancelled: "Cancelled",
  draft: "Draft",
  received: "Received",
  returned: "Returned",
};

const purchasePaymentLabels: Record<string, string> = {
  paid: "Paid",
  partial: "Partially paid",
  partially_paid: "Partially paid",
  pending: "Pending",
  unpaid: "Unpaid",
};

function purchaseStatusLabel(value: string | null | undefined) {
  return purchaseStatusLabels[String(value || "").toLowerCase()] || "Recorded";
}

function purchasePaymentLabel(value: string | null | undefined) {
  return (
    purchasePaymentLabels[String(value || "").toLowerCase()] || "Not recorded"
  );
}

export function PurchasesWorkspace({
  financeMode = false,
  returnedOnly = false,
}: {
  financeMode?: boolean;
  returnedOnly?: boolean;
} = {}) {
  const user = useAuth((state) => state.user);
  const canManageGeneralPurchases = hasPermission(user, "inventory.stock.manage");
  const restaurant = useRestaurant((s) => s.restaurant);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [stockPurchases, setStockPurchases] = useState<any[]>([]);
  const [stockLoadError, setStockLoadError] = useState(false);
  const [stockLoading, setStockLoading] = useState(true);
  const [returnChoice, setReturnChoice] = useState<"type" | "other">("type");
  const [returnSearch, setReturnSearch] = useState("");
  const [returnablePurchases, setReturnablePurchases] = useState<any[]>([]);
  const [returnableLoading, setReturnableLoading] = useState(false);
  const [returnableError, setReturnableError] = useState(false);
  const [purchaseType, setPurchaseType] = useState<"all" | "stock" | "other">("all");
  const [choiceOpen, setChoiceOpen] = useState(false);
  const [stockFormOpen, setStockFormOpen] = useState(false);
  const [initialKind, setInitialKind] = useState<"operating_expense" | "fixed_asset">("operating_expense");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [businessLine, setBusinessLine] = useState<BusinessLineFilter>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<any>(null);
  const [returningPurchase, setReturningPurchase] = useState<any>(null);
  const [assetsOpen, setAssetsOpen] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [returnAmount, setReturnAmount] = useState("");
  const [refundAccount, setRefundAccount] = useState<CashBankAccountOption | null>(null);
  const [returning, setReturning] = useState(false);
  const [detailPurchase, setDetailPurchase] = useState<any | null>(null);

  const dualBusinessLines =
    !!restaurant?.hotel_enabled && !!restaurant?.restaurant_enabled;

  const listBusinessLineParam =
    businessLine === "all" || (financeMode && purchaseType !== "other") ? undefined : businessLine;

  const createBusinessLine = useMemo((): "restaurant" | "hotel" => {
    if (businessLine === "restaurant" || businessLine === "hotel") {
      return businessLine;
    }
    if (restaurant?.hotel_enabled && !restaurant?.restaurant_enabled) {
      return "hotel";
    }
    return "restaurant";
  }, [businessLine, restaurant?.hotel_enabled, restaurant?.restaurant_enabled]);

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

  const startPurchase = (kind: "operating_expense" | "fixed_asset") => {
    if (!canManageGeneralPurchases) return;
    setInitialKind(kind);
    setChoiceOpen(false);
    setSelectedPurchase(null);
    setIsDialogOpen(true);
  };

  const fetchPurchases = useCallback(async () => {
    if (!user?.restaurant_id) return;
    setLoading(true);
    setLoadError(false);
    try {
      const res = await apiClient.get(
        GeneralPurchaseApis.list({
          restaurantId: user.restaurant_id,
          businessLine: listBusinessLineParam,
          status: returnedOnly ? "returned" : undefined,
        }),
      );
      if (res.data.status === "success") {
        setPurchases(res.data.data.purchases);
      } else {
        setLoadError(true);
      }
    } catch (error) {
      console.error("Failed to fetch purchases:", error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [user?.restaurant_id, listBusinessLineParam, returnedOnly]);

  const fetchReturnablePurchases = useCallback(async () => {
    if (!user?.restaurant_id) return;
    setReturnableLoading(true);
    setReturnableError(false);
    try {
      const response = await apiClient.get(GeneralPurchaseApis.list({ restaurantId: user.restaurant_id, status: "received" }));
      if (response.data.status !== "success") throw new Error("Purchases unavailable");
      setReturnablePurchases(response.data.data?.purchases || []);
    } catch {
      setReturnableError(true);
    } finally {
      setReturnableLoading(false);
    }
  }, [user?.restaurant_id]);

  useEffect(() => {
    if (returnedOnly && choiceOpen && returnChoice === "other") void fetchReturnablePurchases();
  }, [returnedOnly, choiceOpen, returnChoice, fetchReturnablePurchases]);

  useEffect(() => {
    fetchPurchases();
  }, [fetchPurchases]);

  const fetchStockPurchases = useCallback(async () => {
    if (!user?.restaurant_id || !financeMode) return;
    setStockLoading(true);
    setStockLoadError(false);
    try {
      const response = await apiClient.get(returnedOnly
        ? PurchaseReturnApis.list({ restaurantId: user.restaurant_id, limit: 100 })
        : PurchaseApis.list({ restaurantId: user.restaurant_id, limit: 100 }));
      if (response.data.status !== "success") throw new Error("Stock purchases unavailable");
      setStockPurchases((returnedOnly ? response.data.data?.purchase_returns : response.data.data?.purchases) || []);
    } catch {
      setStockLoadError(true);
    } finally {
      setStockLoading(false);
    }
  }, [user?.restaurant_id, financeMode, returnedOnly]);

  useEffect(() => { void fetchStockPurchases(); }, [fetchStockPurchases]);

  const handleAction = async (
    id: number,
    action: "receive" | "cancel" | "delete",
  ) => {
    if (!canManageGeneralPurchases) return;
    if (!confirm(`Are you sure you want to ${action} this purchase?`)) return;

    try {
      let res;
      if (action === "receive")
        res = await apiClient.post(GeneralPurchaseApis.receive(id));
      else if (action === "cancel")
        res = await apiClient.post(GeneralPurchaseApis.cancel(id));
      else res = await apiClient.delete(GeneralPurchaseApis.delete(id));

      if (res.data.status === "success") {
        toast.success(`Purchase ${action}d successfully`);
        fetchPurchases();
      }
    } catch (error: any) {
      toast.error(
        error.response?.data?.detail || `Failed to ${action} purchase`,
      );
    }
  };

  const openReturn = (purchase: any) => {
    if (!canManageGeneralPurchases) return;
    setReturningPurchase(purchase);
    setReturnReason("");
    setReturnAmount(String(Number(purchase.total_cost || 0).toFixed(2)));
    setRefundAccount(null);
  };

  const handleReturn = async () => {
    if (!canManageGeneralPurchases) return;
    const parsedReturnAmount = Number(returnAmount || 0);
    if (
      !returningPurchase?.id ||
      !returnReason.trim() ||
      parsedReturnAmount <= 0
    ) {
      toast.error("Enter the refund amount and a reason for this return.");
      return;
    }
    if (returningPurchase.payment_status === "paid" && !refundAccount) {
      toast.error("Choose the cash or bank account receiving the refund.");
      return;
    }
    setReturning(true);
    try {
      const res = await apiClient.post(
        GeneralPurchaseApis.return(returningPurchase.id),
        {
          return_amount: parsedReturnAmount,
          reason: returnReason.trim(),
          refund_account_type: refundAccount?.account_type ?? null,
          refund_account_id: refundAccount?.id ?? null,
        },
      );
      if (res.data.status === "success") {
        toast.success("Purchase returned and its financial effect reversed.");
        setReturningPurchase(null);
        await fetchPurchases();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Failed to return purchase");
    } finally {
      setReturning(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return (
          <Badge variant="secondary" className="capitalize">
            Draft
          </Badge>
        );
      case "received":
        return (
          <Badge
            variant="default"
            className="bg-green-600 hover:bg-green-700 capitalize"
          >
            Received
          </Badge>
        );
      case "returned":
        return (
          <Badge
            variant="outline"
            className="text-orange-600 border-orange-200 bg-orange-50 capitalize"
          >
            Returned
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="destructive" className="capitalize">
            Cancelled
          </Badge>
        );
      default:
        return <Badge variant="outline">Recorded</Badge>;
    }
  };

  const getPaymentBadge = (status: string) => {
    if (status === "paid") {
      return (
        <Badge
          variant="outline"
          className="text-emerald-600 border-emerald-200 bg-emerald-50"
        >
          Paid
        </Badge>
      );
    }
    if (status === "pending") {
      return <Badge variant="outline">Pending</Badge>;
    }
    return (
      <Badge
        variant="outline"
        className="text-rose-600 border-rose-200 bg-rose-50"
      >
        Unpaid
      </Badge>
    );
  };

  const filteredPurchases = purchases.filter(
    (p) =>
      (!returnedOnly || p.status === "returned") &&
      (p.purchase_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.supplier?.name?.toLowerCase().includes(searchQuery.toLowerCase())),
  );
  const filteredStockPurchases = stockPurchases.filter((p) =>
    `${p.supplier_name || ""} ${p.reference_number || ""} ${p.return_number || ""} ${p.id}`.toLowerCase().includes(searchQuery.toLowerCase()));

  const totalSpent = purchases
    .filter((p) => p.status === "received" && p.payment_status === "paid")
    .reduce((acc, curr) => acc + Number(curr.total_cost || 0), 0);

  const pendingPayables = purchases
    .filter((p) => p.status === "received" && p.payment_status === "pending")
    .reduce((acc, curr) => acc + Number(curr.total_cost || 0), 0);

  const purchaseDetail: TransactionDetailModel | null = detailPurchase
    ? {
        eyebrow:
          detailPurchase.status === "returned" ? "Purchase return" : "Purchase",
        title: detailPurchase.purchase_name || `Purchase #${detailPurchase.id}`,
        reference: `Purchase #${detailPurchase.id}`,
        subtitle: detailPurchase.supplier?.name || "Supplier purchase",
        occurredAt: detailPurchase.created_at || detailPurchase.purchased_date,
        status: detailPurchase.status,
        amount: detailPurchase.total_cost,
        amountLabel:
          detailPurchase.status === "returned"
            ? "Returned value"
            : "Purchase value",
        amountTone: "out",
        badges: [
          detailPurchase.purchase_kind === "fixed_asset" ? "Equipment / asset" : detailPurchase.purchase_kind === "unclassified" ? "Unclassified" : "Running cost",
          detailPurchase.business_line,
          detailPurchase.payment_status,
        ].filter(Boolean),
        sections: [
          {
            title: "Purchase overview",
            fields: [
              {
                label: "Purchase date",
                value: formatDate(detailPurchase.purchased_date),
              },
              {
                label: "Supplier",
                value:
                  detailPurchase.supplier?.name ||
                  (detailPurchase.supplier_id
                    ? `Supplier #${detailPurchase.supplier_id}`
                    : "No supplier"),
              },
              { label: "Item / purpose", value: detailPurchase.purchase_name },
              {
                label: "Type",
                value: detailPurchase.purchase_kind === "fixed_asset" ? "Equipment / asset" : detailPurchase.purchase_kind === "unclassified" ? "Recorded before classification" : "Running cost or service",
              },
              { label: "Unit", value: detailPurchase.unit || "—" },
              {
                label: "Business",
                value: detailPurchase.business_line || "Restaurant",
              },
              {
                label: "Recorded by",
                value: detailPurchase.created_by
                  ? `Staff #${detailPurchase.created_by}`
                  : "System",
              },
              {
                label: "Notes",
                value: detailPurchase.notes || "—",
                fullWidth: true,
              },
            ],
          },
          {
            title: "VAT on this bill",
            fields: [
              { label: "VAT shown", value: formatCurrency(detailPurchase.vat_amount || 0) },
              { label: "Input VAT", value: detailPurchase.claim_input_vat ? "Claimed after review" : "Not claimed" },
              { label: "Invoice number", value: detailPurchase.invoice_number || "—" },
              { label: "Supplier VAT/PAN", value: detailPurchase.supplier_vat_number || "—" },
            ],
          },
          {
            title: "Settlement",
            fields: [
              {
                label: "Total",
                value: formatCurrency(detailPurchase.total_cost),
              },
              {
                label: "Payment status",
                value: purchasePaymentLabel(detailPurchase.payment_status),
              },
              {
                label: "Payment method",
                value:
                  detailPurchase.payment_method?.replaceAll("_", " ") ||
                  "Not recorded",
              },
              {
                label: "Lifecycle status",
                value: purchaseStatusLabel(detailPurchase.status),
              },
            ],
          },
          {
            title: "Audit",
            fields: [
              {
                label: "Created",
                value: detailPurchase.created_at
                  ? formatDateTime(detailPurchase.created_at)
                  : "—",
              },
              {
                label: "Last updated",
                value: detailPurchase.updated_at
                  ? formatDateTime(detailPurchase.updated_at)
                  : "—",
              },
            ],
          },
        ],
      }
    : null;

  return (
    <AppPage width="wide" className="p-4 sm:p-6">
      <PageHeader
        title={returnedOnly ? "Purchase returns" : "Purchases"}
        description={
          returnedOnly
            ? "Review returned supplier purchases and their financial reversals."
            : "Record stock, running costs, and equipment in one place."
        }
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row [&>button]:w-full sm:[&>button]:w-auto">
            {!returnedOnly && hasPermission(user, "finance.coa.manage") ? <Button variant="outline" className="order-2 h-11 rounded-xl sm:order-none" onClick={() => setAssetsOpen(true)}>Equipment & assets</Button> : null}
            {!returnedOnly && (canManageGeneralPurchases || (financeMode && hasPermission(user, "inventory.purchases.post"))) ? (
              <Button className="h-11 rounded-xl" onClick={() => financeMode ? setChoiceOpen(true) : startPurchase("operating_expense")}>
                <Plus className="w-4 h-4 mr-2" />
                Record purchase
              </Button>
            ) : null}
            {returnedOnly && (canManageGeneralPurchases || hasPermission(user, "inventory.purchase_returns.create")) ? (
              <Button className="h-11 rounded-xl" onClick={() => { setReturnChoice("type"); setReturnSearch(""); setChoiceOpen(true); }}>
                <Undo2 className="mr-2 h-4 w-4" />Record return
              </Button>
            ) : null}
          </div>
        }
      />

      {financeMode ? (
        <FinanceWorkspaceNav
          links={[
            { label: "Purchases", href: "/finance/purchases" },
            { label: "Purchase returns", href: "/finance/purchases/returns" },
          ]}
          action={returnedOnly ? { label: "All purchases", href: "/finance/purchases" } : undefined}
        />
      ) : null}

      {/* Quick Stats */}
      {!returnedOnly && (!financeMode || purchaseType === "other") ? <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard
          label="Costs & equipment"
          value={purchases.length}
          icon={<ShoppingCart className="h-4 w-4" />}
          tone="neutral"
        />
        <MetricCard
          label="Paid purchases"
          value={formatCurrency(totalSpent)}
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone="success"
        />
        <MetricCard
          label="Unpaid"
          value={formatCurrency(pendingPayables)}
          icon={<Calculator className="h-4 w-4" />}
          tone="danger"
        />
        <MetricCard
          label="Other returns"
          value={purchases.filter((p) => p.status === "returned").length}
          icon={<Undo2 className="h-4 w-4" />}
          tone="warning"
        />
      </div> : null}

      <div className="flex min-w-0 flex-col gap-3">
        {financeMode ? <div className="grid w-full min-w-0 grid-cols-3 gap-1 rounded-xl bg-muted/70 p-1 sm:flex sm:w-fit" role="group" aria-label={returnedOnly ? "Return types" : "Purchase types"}>
          <FilterChip className="min-w-0 whitespace-normal rounded-lg border-transparent px-2 text-xs sm:px-4 sm:text-sm" active={purchaseType === "all"} onClick={() => setPurchaseType("all")}>{returnedOnly ? "All returns" : "All purchases"}</FilterChip>
          <FilterChip className="min-w-0 whitespace-normal rounded-lg border-transparent px-2 text-xs sm:px-4 sm:text-sm" active={purchaseType === "stock"} onClick={() => setPurchaseType("stock")}>Stock</FilterChip>
          <FilterChip className="min-w-0 whitespace-normal rounded-lg border-transparent px-2 text-xs sm:px-4 sm:text-sm" active={purchaseType === "other"} onClick={() => setPurchaseType("other")}>Costs & equipment</FilterChip>
        </div> : null}
        <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center">
        <SearchField
          containerClassName="w-full min-w-0 md:max-w-md md:flex-1"
          aria-label="Search purchases by item or supplier"
          placeholder="Search items or suppliers"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
        />
        {dualBusinessLines && purchaseType === "other" ? (
          <div className="grid min-w-0 grid-cols-3 gap-2 md:flex" role="group" aria-label="Business line">
            <FilterChip
              className="min-w-0 gap-1 px-2 text-xs sm:px-4 sm:text-sm"
              active={businessLine === "all"}
              onClick={() => setBusinessLine("all")}
            >
              All
            </FilterChip>
            <FilterChip
              className="min-w-0 gap-1 px-2 text-xs sm:px-4 sm:text-sm"
              active={businessLine === "restaurant"}
              onClick={() => setBusinessLine("restaurant")}
            >
              <Utensils className="h-3.5 w-3.5 text-orange-500" />
              Restaurant
            </FilterChip>
            <FilterChip
              className="min-w-0 gap-1 px-2 text-xs sm:px-4 sm:text-sm"
              active={businessLine === "hotel"}
              onClick={() => setBusinessLine("hotel")}
            >
              <Hotel className="h-3.5 w-3.5 text-blue-500" />
              Hotel
            </FilterChip>
          </div>
        ) : null}
        </div>
      </div>
      {financeMode && purchaseType !== "other" ? <div className="rounded-2xl border border-border bg-card">
        <div className="flex min-w-0 items-center justify-between gap-3 border-b border-border px-4 py-2">
          <h2 className="min-w-0 text-sm font-semibold sm:text-base">{returnedOnly ? "Stock returns" : "Recent stock purchases"}</h2>
          <Link href={returnedOnly ? "/inventory/purchases/returns" : "/inventory/purchases"} aria-label={returnedOnly ? "View all stock returns" : "View all stock purchases"} className="inline-flex min-h-11 shrink-0 items-center text-sm font-medium text-primary underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">View all</Link>
        </div>
        {stockLoadError ? <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-5 text-sm text-destructive"><span>Could not load stock {returnedOnly ? "returns" : "purchases"}.</span><Button variant="outline" size="sm" onClick={() => void fetchStockPurchases()}>Retry</Button></div>
        : stockLoading ? <LoadingState label={returnedOnly ? "Loading stock returns…" : "Loading stock purchases…"} />
        : filteredStockPurchases.length === 0
          ? <p className="px-4 py-5 text-sm text-muted-foreground">No stock {returnedOnly ? "returns" : "purchases"} match this view.</p>
          : <div className="divide-y divide-border">{filteredStockPurchases.map((purchase) => <Link key={purchase.id} href={returnedOnly ? `/inventory/purchases/returns?return_id=${purchase.id}` : `/inventory/purchases?purchase_id=${purchase.id}`} className="flex min-h-14 flex-col items-start gap-1 px-4 py-3 hover:bg-muted/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <span className="w-full min-w-0 sm:w-auto"><span className="block truncate font-medium">{purchase.supplier_name || `Stock ${returnedOnly ? "return" : "purchase"} #${purchase.id}`}</span><span className="block text-xs text-muted-foreground">Stock · {formatDate(purchase.return_date || purchase.purchase_date || purchase.created_at)} · {purchase.status || "Recorded"}</span>{returnedOnly ? <span className="block text-xs text-muted-foreground">{purchase.settlement_type === "refund_received" ? "Refund received" : "Supplier credit"}</span> : null}</span>
              <span className="max-w-full break-words text-sm font-semibold tabular-nums sm:shrink-0 sm:text-base">{formatCurrency(purchase.total_cost)}</span>
            </Link>)}</div>}
      </div> : null}
      {financeMode && purchaseType !== "stock" ? <h2 className="text-sm font-semibold sm:text-base">Costs & equipment {returnedOnly ? "returns" : "purchases"}</h2> : null}
      {purchaseType !== "stock" && (loading ? (
        <LoadingState label={returnedOnly ? "Loading costs and equipment returns…" : "Loading purchases…"} />
      ) : loadError ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5 text-sm text-destructive"><span>Could not load costs and equipment purchases.</span><Button variant="outline" size="sm" onClick={() => void fetchPurchases()}>Retry</Button></div>
      ) : filteredPurchases.length === 0 ? (
        <EmptyState
          title={returnedOnly ? "No costs or equipment returns" : "No costs or equipment purchases"}
          description={returnedOnly ? "To return a cost or equipment purchase, choose Record return and select the original purchase." : "Record a running cost, service, or equipment purchase to track its payment and VAT."}
        />
      ) : (
        <>
          <DataList className="lg:hidden">
            {filteredPurchases.map((purchase) => (
              <button
                type="button"
                key={purchase.id}
                onClick={() => setDetailPurchase(purchase)}
                className="block w-full min-w-0 space-y-2 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:-outline-offset-2"
              >
                <span className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="min-w-0 max-w-full break-words text-sm font-medium">{purchase.purchase_name}</span>
                  <span className="max-w-full break-words text-sm font-semibold tabular-nums">{formatCurrency(purchase.total_cost)}</span>
                </span>
                <span className="flex min-w-0 items-center justify-between gap-3">
                  <span className="min-w-0 text-xs leading-5 text-muted-foreground"><span className="block truncate">{purchase.supplier?.name || "No supplier"}</span><span>{returnedOnly ? "Purchase dated " : ""}{formatDate(purchase.purchased_date)}</span></span>
                  <span className="shrink-0">{getStatusBadge(purchase.status)}</span>
                </span>
              </button>
            ))}
          </DataList>
          <div className="hidden overflow-x-auto rounded-2xl border border-border bg-card lg:block">
            <Table className="min-w-[920px] table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[27%] min-w-[220px]">
                    Date / item
                  </TableHead>
                  <TableHead className="w-[22%] min-w-[180px]">
                    Supplier
                  </TableHead>
                  <TableHead className="w-[150px] whitespace-nowrap">
                    Amount
                  </TableHead>
                  <TableHead className="w-[120px] whitespace-nowrap">
                    Payment
                  </TableHead>
                  <TableHead className="w-[120px] whitespace-nowrap">
                    Status
                  </TableHead>
                  <TableHead className="w-16 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPurchases.map((purchase) => (
                  <TableRow
                    key={purchase.id}
                    tabIndex={0}
                    role="button"
                    onClick={() => setDetailPurchase(purchase)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setDetailPurchase(purchase);
                      }
                    }}
                    className={cn(
                      "cursor-pointer focus-visible:bg-muted/40 focus-visible:outline-none",
                      purchase.status === "cancelled" && "opacity-60",
                    )}
                  >
                    <TableCell className="min-w-[220px]">
                      <div className="flex flex-col">
                        <span className="font-semibold text-sm">
                          {purchase.purchase_name}
                        </span>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          {formatDate(purchase.purchased_date)}
                          <span>· {purchase.purchase_kind === "fixed_asset" ? "Equipment / asset" : purchase.purchase_kind === "unclassified" ? "Unclassified" : "Running cost"}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="min-w-[180px]">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center">
                          <User className="w-3.5 h-3.5 text-slate-500" />
                        </div>
                        <span className="truncate text-sm font-medium">
                          {purchase.supplier?.name || "No Supplier"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-bold">
                          {formatCurrency(purchase.total_cost)}
                        </span>
                        {purchase.unit && (
                          <span className="text-[10px] text-muted-foreground">
                            {purchase.unit}
                          </span>
                        )}
                        {Number(purchase.vat_amount) > 0 && (
                          <span className="text-[10px] text-muted-foreground">
                            VAT {formatCurrency(purchase.vat_amount)} · {purchase.claim_input_vat ? "claimed" : "not claimed"}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {getPaymentBadge(purchase.payment_status)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {getStatusBadge(purchase.status)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      <div
                        className="flex items-center justify-end gap-1"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        {canManageGeneralPurchases ? <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Actions for ${purchase.purchase_name}`}
                            >
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            {purchase.status === "draft" && (
                              <DropdownMenuItem
                                onClick={() =>
                                  handleAction(purchase.id, "receive")
                                }
                              >
                                <CheckCircle2 className="w-4 h-4 mr-2 text-green-600" />
                                Mark as Received
                              </DropdownMenuItem>
                            )}
                            {purchase.status === "received" && (
                              <DropdownMenuItem
                                onClick={() => openReturn(purchase)}
                              >
                                <Undo2 className="w-4 h-4 mr-2 text-orange-600" />
                                Return Item
                              </DropdownMenuItem>
                            )}

                            <DropdownMenuSeparator />

                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedPurchase(purchase);
                                setIsDialogOpen(true);
                              }}
                              disabled={
                                purchase.status === "cancelled" ||
                                purchase.status === "returned"
                              }
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              Edit Record
                            </DropdownMenuItem>

                            {purchase.status === "draft" && (
                              <DropdownMenuItem
                                onClick={() =>
                                  handleAction(purchase.id, "delete")
                                }
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete Draft
                              </DropdownMenuItem>
                            )}

                            {(purchase.status === "draft" ||
                              (purchase.status === "received" &&
                                purchase.payment_status !== "paid")) && (
                              <DropdownMenuItem
                                onClick={() =>
                                  handleAction(purchase.id, "cancel")
                                }
                                className="text-destructive focus:text-destructive"
                              >
                                <XCircle className="w-4 h-4 mr-2" />
                                Cancel Purchase
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu> : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      ))}

      {canManageGeneralPurchases ? <PurchaseDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        purchase={selectedPurchase}
        businessLine={createBusinessLine}
        dualBusinessLines={dualBusinessLines}
        initialKind={initialKind}
        onSuccess={fetchPurchases}
      /> : null}
      {financeMode && !returnedOnly && hasPermission(user, "inventory.purchases.post") ? <RecordPurchaseDialog open={stockFormOpen} onOpenChange={setStockFormOpen} restaurantId={user?.restaurant_id || 0} onRecorded={fetchStockPurchases} /> : null}
      {financeMode && !returnedOnly ? <Dialog open={choiceOpen} onOpenChange={setChoiceOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>What did you buy?</DialogTitle><DialogDescription>Choose the type of purchase to record.</DialogDescription></DialogHeader>
          <div className="divide-y rounded-xl border">
            {hasPermission(user, "inventory.purchases.post") ? <button type="button" className="w-full px-4 py-4 text-left hover:bg-muted/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" onClick={() => { setChoiceOpen(false); setStockFormOpen(true); }}><span className="block font-medium">Food, ingredients, or stock</span><span className="text-sm text-muted-foreground">Adds received items to inventory.</span></button> : null}
            {canManageGeneralPurchases ? <button type="button" className="w-full px-4 py-4 text-left hover:bg-muted/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" onClick={() => startPurchase("operating_expense")}><span className="block font-medium">Running cost or service</span><span className="text-sm text-muted-foreground">Rent, repairs, utilities, and similar costs.</span></button> : null}
            {canManageGeneralPurchases ? <button type="button" className="w-full px-4 py-4 text-left hover:bg-muted/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" onClick={() => startPurchase("fixed_asset")}><span className="block font-medium">Equipment or long-term asset</span><span className="text-sm text-muted-foreground">Records an asset for its own depreciation schedule.</span></button> : null}
          </div>
        </DialogContent>
      </Dialog> : null}
      <TransactionDetailSheet
        open={detailPurchase != null}
        onOpenChange={(open) => !open && setDetailPurchase(null)}
        detail={purchaseDetail}
        actionHref={
          detailPurchase?.supplier_id
            ? `/suppliers/${detailPurchase.supplier_id}`
            : null
        }
        actionLabel="Open supplier"
        footer={canManageGeneralPurchases && detailPurchase?.status === "received" ? (
          <Button variant="outline" className="min-h-11 w-full" onClick={() => { openReturn(detailPurchase); setDetailPurchase(null); }}><Undo2 className="mr-2 h-4 w-4" />Return purchase</Button>
        ) : undefined}
      />
      {financeMode && returnedOnly ? <Dialog open={choiceOpen} onOpenChange={setChoiceOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{returnChoice === "other" ? "Choose the original purchase" : "What are you returning?"}</DialogTitle>
            <DialogDescription>{returnChoice === "other" ? "Select a received cost or equipment purchase. Returns reverse the whole bill." : "Start from the original purchase so its supplier, payment and VAT stay linked."}</DialogDescription>
          </DialogHeader>
          {returnChoice === "type" ? <div className="grid gap-3">
            {hasPermission(user, "inventory.purchase_returns.create") ? <Button asChild variant="outline" className="min-h-12 justify-start"><Link href="/inventory/purchases/returns?record=1">Stock items</Link></Button> : null}
            {canManageGeneralPurchases ? <Button variant="outline" className="min-h-12 justify-start" onClick={() => setReturnChoice("other")}>Costs & equipment</Button> : null}
          </div> : <div className="space-y-3">
            <SearchField aria-label="Find the original purchase" placeholder="Search items or suppliers" value={returnSearch} onChange={(event) => setReturnSearch(event.target.value)} />
            {loading ? <LoadingState label="Loading purchases…" /> : loadError ? <Button variant="outline" onClick={() => void fetchPurchases()}>Could not load purchases. Retry</Button> : <DataList>
              {returnablePurchases.filter((p) => p.status === "received" && `${p.purchase_name} ${p.supplier?.name || ""}`.toLowerCase().includes(returnSearch.toLowerCase())).map((purchase) => <button type="button" key={purchase.id} className="flex min-h-14 w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left hover:bg-muted/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" onClick={() => { setChoiceOpen(false); openReturn(purchase); }}><span className="min-w-0"><span className="block break-words text-sm font-medium">{purchase.purchase_name}</span><span className="block text-xs text-muted-foreground">{purchase.supplier?.name || "No supplier"} · {formatDate(purchase.purchased_date)}</span></span><span className="text-sm font-semibold tabular-nums">{formatCurrency(purchase.total_cost)}</span></button>)}
              {!returnablePurchases.some((p) => p.status === "received" && `${p.purchase_name} ${p.supplier?.name || ""}`.toLowerCase().includes(returnSearch.toLowerCase())) ? <p className="p-4 text-sm text-muted-foreground">No received purchases match. Draft, cancelled and returned purchases cannot be returned.</p> : null}
            </DataList>}
            <Button variant="ghost" onClick={() => setReturnChoice("type")}>Back</Button>
          </div>}
        </DialogContent>
      </Dialog> : null}
      {canManageGeneralPurchases ? <Dialog
        open={Boolean(returningPurchase)}
        onOpenChange={(open) => {
          if (!open && !returning) setReturningPurchase(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Return purchase</DialogTitle>
            <DialogDescription>
              Return {returningPurchase?.purchase_name || "this purchase"}. This
              reverses the full bill, including any claimed input VAT.
              {returningPurchase?.payment_status === "paid" ? " Confirm only after receiving the full supplier refund." : " The supplier balance will be adjusted; no money receipt is recorded."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="purchase-return-amount">Full bill total</Label>
            <Input
              id="purchase-return-amount"
              type="number"
              min="0.01"
              step="0.01"
              max={Number(returningPurchase?.total_cost || 0)}
              value={returnAmount}
              readOnly
            />
            <Label htmlFor="purchase-return-reason">Reason</Label>
            <Textarea
              id="purchase-return-reason"
              value={returnReason}
              onChange={(event) => setReturnReason(event.target.value)}
              placeholder="Damaged, incorrect item, supplier return..."
            />
            {returningPurchase?.payment_status === "paid" ? (
              <CashBankAccountSelect
                value={refundAccount}
                onChange={setRefundAccount}
                businessLine={returningPurchase.business_line || "restaurant"}
                label="Refund received into"
                accountFilter={(account) => account.bank_type !== "owner_equity"}
              />
            ) : null}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReturningPurchase(null)}
              disabled={returning}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleReturn()}
              disabled={
                returning ||
                !returnReason.trim() ||
                Number(returnAmount || 0) <= 0
                || (returningPurchase?.payment_status === "paid" && !refundAccount)
              }
            >
              {returning ? "Returning..." : "Confirm return"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog> : null}
      {hasPermission(user, "finance.coa.manage") ? <FixedAssetsDialog open={assetsOpen} onOpenChange={setAssetsOpen} restaurantId={Number(user?.restaurant_id || 0)} /> : null}
    </AppPage>
  );
}

export default function PurchasesPage() {
  return <PurchasesWorkspace />;
}
