"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";
import {
  Plus,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  ChevronLeft,
  RefreshCw,
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
import { GeneralPurchaseApis } from "@/lib/api/endpoints";
import { PurchaseDialog } from "@/components/manage/purchases/purchase-dialog";
import { useRouter } from "next/navigation";
import { formatCurrency, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { FinanceWorkspaceNav } from "@/components/finance/workspace/finance-workspace-nav";
import {
  TransactionDetailSheet,
  type TransactionDetailModel,
} from "@/components/finance/transaction-detail/transaction-detail-sheet";

type BusinessLineFilter = "all" | "restaurant" | "hotel";

export function PurchasesWorkspace({
  financeMode = false,
  returnedOnly = false,
}: {
  financeMode?: boolean;
  returnedOnly?: boolean;
} = {}) {
  const user = useAuth((state) => state.user);
  const router = useRouter();
  const restaurant = useRestaurant((s) => s.restaurant);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [businessLine, setBusinessLine] = useState<BusinessLineFilter>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<any>(null);
  const [returningPurchase, setReturningPurchase] = useState<any>(null);
  const [returnReason, setReturnReason] = useState("");
  const [returnAmount, setReturnAmount] = useState("");
  const [returning, setReturning] = useState(false);
  const [detailPurchase, setDetailPurchase] = useState<any | null>(null);

  const dualBusinessLines =
    !!restaurant?.hotel_enabled && !!restaurant?.restaurant_enabled;

  const listBusinessLineParam =
    businessLine === "all" ? undefined : businessLine;

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

  const startPurchase = () => {
    if (dualBusinessLines && businessLine === "all") {
      toast.info("Choose Restaurant or Hotel before recording a purchase.");
      return;
    }
    setSelectedPurchase(null);
    setIsDialogOpen(true);
  };

  const fetchPurchases = useCallback(async () => {
    if (!user?.restaurant_id) return;
    setLoading(true);
    try {
      const res = await apiClient.get(
        GeneralPurchaseApis.list({
          restaurantId: user.restaurant_id,
          businessLine: listBusinessLineParam,
        }),
      );
      if (res.data.status === "success") {
        setPurchases(res.data.data.purchases);
      }
    } catch (error) {
      console.error("Failed to fetch purchases:", error);
      toast.error("Failed to load purchases");
    } finally {
      setLoading(false);
    }
  }, [user?.restaurant_id, listBusinessLineParam]);

  useEffect(() => {
    fetchPurchases();
  }, [fetchPurchases]);

  const handleAction = async (
    id: number,
    action: "receive" | "cancel" | "delete",
  ) => {
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
    setReturningPurchase(purchase);
    setReturnReason("");
    setReturnAmount(String(Number(purchase.total_cost || 0).toFixed(2)));
  };

  const handleReturn = async () => {
    const parsedReturnAmount = Number(returnAmount || 0);
    if (
      !returningPurchase?.id ||
      !returnReason.trim() ||
      parsedReturnAmount <= 0
    ) {
      toast.error("Enter the refund amount and a reason for this return.");
      return;
    }
    setReturning(true);
    try {
      const res = await apiClient.post(
        GeneralPurchaseApis.return(returningPurchase.id),
        {
          return_amount: parsedReturnAmount,
          reason: returnReason.trim(),
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
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPaymentBadge = (status: string) => {
    return status === "paid" ? (
      <Badge
        variant="outline"
        className="text-emerald-600 border-emerald-200 bg-emerald-50"
      >
        Paid
      </Badge>
    ) : (
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

  const totalSpent = purchases
    .filter((p) => p.status === "received" && p.payment_status === "paid")
    .reduce((acc, curr) => acc + (curr.total_cost || 0), 0);

  const pendingPayables = purchases
    .filter((p) => p.status === "received" && p.payment_status === "pending")
    .reduce((acc, curr) => acc + (curr.total_cost || 0), 0);

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
            title: "Settlement",
            fields: [
              {
                label: "Total",
                value: formatCurrency(detailPurchase.total_cost),
              },
              {
                label: "Payment status",
                value: detailPurchase.payment_status || "—",
              },
              {
                label: "Payment method",
                value:
                  detailPurchase.payment_method?.replaceAll("_", " ") ||
                  "Not recorded",
              },
              {
                label: "Lifecycle status",
                value: detailPurchase.status || "—",
              },
            ],
          },
          {
            title: "Audit",
            fields: [
              {
                label: "Created",
                value: detailPurchase.created_at
                  ? new Date(detailPurchase.created_at).toLocaleString()
                  : "—",
              },
              {
                label: "Last updated",
                value: detailPurchase.updated_at
                  ? new Date(detailPurchase.updated_at).toLocaleString()
                  : "—",
              },
            ],
          },
        ],
      }
    : null;

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          {!financeMode ? (
            <button
              onClick={() => router.push("/manage")}
              className="flex items-center text-sm text-muted-foreground hover:text-primary transition-colors mb-2"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back to Manage
            </button>
          ) : null}
          <h1 className="text-3xl font-bold tracking-tight">
            {returnedOnly ? "Purchase returns" : "Purchases"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {returnedOnly
              ? "Review returned supplier purchases and their financial reversals."
              : "Supplier and general purchase documents, payment state, and return actions."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={fetchPurchases}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          {!returnedOnly ? (
            <Button onClick={startPurchase}>
              <Plus className="w-4 h-4 mr-2" />
              Record Purchase
            </Button>
          ) : null}
        </div>
      </div>

      {financeMode ? (
        <FinanceWorkspaceNav
          links={[
            { label: "Purchases", href: "/finance/purchases" },
            { label: "Purchase returns", href: "/finance/purchases/returns" },
          ]}
          action={
            returnedOnly
              ? { label: "Record purchase", href: "/finance/purchases" }
              : { label: "Open suppliers", href: "/suppliers" }
          }
        />
      ) : null}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">
                Total Orders
              </p>
              <h3 className="text-2xl font-bold">{purchases.length}</h3>
            </div>
            <div className="p-2 bg-slate-100 rounded-lg">
              <ShoppingCart className="w-5 h-5 text-slate-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">
                Paid (Received)
              </p>
              <h3 className="text-2xl font-bold text-green-600">
                {formatCurrency(totalSpent)}
              </h3>
            </div>
            <div className="p-2 bg-green-50 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">
                Unpaid Purchases
              </p>
              <h3 className="text-2xl font-bold text-rose-600">
                {formatCurrency(pendingPayables)}
              </h3>
            </div>
            <div className="p-2 bg-rose-50 rounded-lg">
              <Calculator className="w-5 h-5 text-rose-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">
                Returns
              </p>
              <h3 className="text-2xl font-bold text-orange-600">
                {purchases.filter((p) => p.status === "returned").length}
              </h3>
            </div>
            <div className="p-2 bg-orange-50 rounded-lg">
              <Undo2 className="w-5 h-5 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Table */}
      <Card>
        <div className="p-4 border-b flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search items or suppliers..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {dualBusinessLines ? (
            <div className="flex items-center bg-muted/50 p-1 rounded-lg border border-border">
              <Button
                variant={businessLine === "all" ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "h-8 px-3 text-xs",
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
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date / Item</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-48 text-center text-muted-foreground"
                >
                  <div className="flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Loading purchases...
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredPurchases.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-48 text-center text-muted-foreground"
                >
                  No purchases recorded yet.
                </TableCell>
              </TableRow>
            ) : (
              filteredPurchases.map((purchase) => (
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
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm">
                        {purchase.purchase_name}
                      </span>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        {formatDate(purchase.purchased_date)}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center">
                        <User className="w-3.5 h-3.5 text-slate-500" />
                      </div>
                      <span className="text-sm font-medium">
                        {purchase.supplier?.name || "No Supplier"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-bold">
                        {formatCurrency(purchase.total_cost)}
                      </span>
                      {purchase.unit && (
                        <span className="text-[10px] text-muted-foreground">
                          {purchase.unit}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {getPaymentBadge(purchase.payment_status)}
                  </TableCell>
                  <TableCell>{getStatusBadge(purchase.status)}</TableCell>
                  <TableCell className="text-right">
                    <div
                      className="flex items-center justify-end gap-1"
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      {purchase.status === "received" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openReturn(purchase)}
                          className="text-orange-700"
                        >
                          <Undo2 className="mr-2 h-4 w-4" />
                          Return
                        </Button>
                      ) : null}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
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
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <PurchaseDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        purchase={selectedPurchase}
        businessLine={createBusinessLine}
        onSuccess={fetchPurchases}
      />
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
      />
      <Dialog
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
              reverses the entire received purchase; use an inventory adjustment
              for a partial quantity correction.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="purchase-return-amount">Refund amount</Label>
            <Input
              id="purchase-return-amount"
              type="number"
              min="0.01"
              step="0.01"
              max={Number(returningPurchase?.total_cost || 0)}
              value={returnAmount}
              onChange={(event) => setReturnAmount(event.target.value)}
            />
            <Label htmlFor="purchase-return-reason">Reason</Label>
            <Textarea
              id="purchase-return-reason"
              value={returnReason}
              onChange={(event) => setReturnReason(event.target.value)}
              placeholder="Damaged, incorrect item, supplier return..."
            />
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
              }
            >
              {returning ? "Returning..." : "Confirm return"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function PurchasesPage() {
  return <PurchasesWorkspace />;
}
