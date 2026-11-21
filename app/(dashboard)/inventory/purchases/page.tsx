"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Plus, Loader2, MoreVertical, Ban, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RecordPurchaseDialog } from "@/components/purchases/record-purchase-dialog";
import apiClient from "@/lib/api-client";
import {
  PartyLedgerApis,
  PurchaseApis,
  PurchaseReturnApis,
} from "@/lib/api/endpoints";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  TransactionDetailSheet,
  type TransactionDetailModel,
} from "@/components/finance/transaction-detail/transaction-detail-sheet";
import { purchaseDocumentDetail } from "@/components/finance/transaction-detail/party-workspace-detail";
import { AppPage } from "@/components/patterns/page/app-page";
import { PageHeader } from "@/components/patterns/page/page-header";
import { PageSection } from "@/components/patterns/page/page-section";
import { SearchField } from "@/components/patterns/controls/search-field";
import { hasPermission } from "@/lib/role-permissions";

function statusBadge(status: string) {
  switch (status) {
    case "posted":
      return (
        <Badge variant="default" className="bg-green-600 hover:bg-green-700">
          Purchased
        </Badge>
      );
    case "voided":
      return (
        <Badge variant="destructive" className="capitalize">
          Voided
        </Badge>
      );
    default:
      return <Badge variant="outline">Recorded</Badge>;
  }
}

export default function InventoryPurchasesPage() {
  const user = useAuth((state) => state.user);
  const router = useRouter();
  const searchParams = useSearchParams();
  const openedPurchaseId = useRef<number | null>(null);
  const canPostPurchase = hasPermission(user, "inventory.purchases.post");
  const canVoidPurchase = hasPermission(user, "inventory.purchases.void");
  const canCreatePurchaseReturn = hasPermission(
    user,
    "inventory.purchase_returns.create",
  );

  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const [detailPurchase, setDetailPurchase] = useState<any | null>(null);
  const [detailStatement, setDetailStatement] = useState<any | null>(null);
  const [detailReturns, setDetailReturns] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [voidPurchase, setVoidPurchase] = useState<any | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidSubmitting, setVoidSubmitting] = useState(false);

  const fetchPurchases = useCallback(async () => {
    if (!user?.restaurant_id) return;
    setLoading(true);
    try {
      const response = await apiClient.get(
        PurchaseApis.list({
          restaurantId: user.restaurant_id,
          status: statusFilter === "all" ? undefined : statusFilter,
        }),
      );
      if (response.data.status === "success") {
        setPurchases(response.data.data?.purchases || []);
      }
    } catch (err) {
      console.error("Failed to fetch purchases:", err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, user?.restaurant_id]);

  const openPurchaseDetail = useCallback(
    async (purchase: any) => {
      setDetailPurchase(purchase);
      setDetailStatement(null);
      setDetailReturns([]);
      if (!user?.restaurant_id || !purchase?.supplier_id) return;

      setDetailLoading(true);
      try {
        const [purchaseResponse, statementResponse, returnsResponse] =
          await Promise.all([
            apiClient.get(PurchaseApis.get(purchase.id, user.restaurant_id)),
            apiClient.get(
              PartyLedgerApis.statement(
                "supplier",
                purchase.supplier_id,
                user.restaurant_id,
              ),
            ),
            apiClient.get(
              PurchaseReturnApis.list({
                restaurantId: user.restaurant_id,
                supplierId: purchase.supplier_id,
                limit: 200,
              }),
            ),
          ]);
        setDetailPurchase(purchaseResponse.data.data || purchase);
        setDetailStatement(statementResponse.data.data || null);
        setDetailReturns(returnsResponse.data.data?.purchase_returns || []);
      } catch (error) {
        console.error("Failed to load purchase settlement details", error);
      } finally {
        setDetailLoading(false);
      }
    },
    [user?.restaurant_id],
  );

  useEffect(() => {
    fetchPurchases();
  }, [fetchPurchases]);

  useEffect(() => {
    const id = Number(searchParams.get("purchase_id"));
    if (!id || !user?.restaurant_id || openedPurchaseId.current === id) return;
    const purchase = purchases.find((row) => row.id === id);
    openedPurchaseId.current = id;
    if (purchase) {
      void openPurchaseDetail(purchase);
    } else {
      void apiClient.get(PurchaseApis.get(id, user.restaurant_id)).then((response) => {
        if (response.data.data) void openPurchaseDetail(response.data.data);
      }).catch(() => toast.error("Could not open this stock purchase."));
    }
  }, [searchParams, purchases, openPurchaseDetail, user?.restaurant_id]);

  const handleVoid = async () => {
    if (!voidPurchase || !user?.restaurant_id) return;
    if (voidReason.trim().length < 3) {
      toast.error("Reason must be at least 3 characters.");
      return;
    }
    setVoidSubmitting(true);
    try {
      await apiClient.post(
        PurchaseApis.void(voidPurchase.id, user.restaurant_id),
        { reason: voidReason.trim() },
      );
      toast.success("Purchase voided.");
      setVoidPurchase(null);
      setVoidReason("");
      setDetailPurchase(null);
      await fetchPurchases();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to void purchase.");
    } finally {
      setVoidSubmitting(false);
    }
  };

  const filteredPurchases = purchases.filter(
    (p) =>
      ["posted", "voided"].includes(p.status) &&
      (!searchQuery ||
        p.supplier_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.reference_number?.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  const purchaseDetail: TransactionDetailModel | null = detailPurchase
    ? purchaseDocumentDetail(detailPurchase, detailStatement, detailReturns)
    : null;

  return (
    <AppPage width="wide" className="p-4 pb-24 sm:p-6">
      <PageHeader
        title="Stock purchases"
        description="Receive supplier stock and keep inventory quantities accurate."
        actions={
    <div className="grid w-full grid-cols-2 gap-2 md:flex md:w-auto">
            <Button variant="outline" className="h-11 rounded-xl" onClick={() => router.push("/finance/purchases")}>All purchases</Button>
            {canCreatePurchaseReturn ? <Button
              variant="outline"
              className="h-11 rounded-xl"
              onClick={() => router.push("/inventory/purchases/returns")}
            >
              <Undo2 className="mr-2 h-4 w-4" /> Returns
            </Button> : null}
            {canPostPurchase ? <Button className="h-11 rounded-xl" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Record purchase
            </Button> : null}
          </div>
        }
      />

      <PageSection surface className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem]">
          <SearchField
            placeholder="Search supplier or reference"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-11 w-full rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="posted">Purchased</SelectItem>
              <SelectItem value="voided">Voided</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          A posted purchase changes stock only by the quantity actually
          received.
        </p>
      </PageSection>

      <PageSection surface className="overflow-hidden p-0">
        <div className="divide-y divide-border lg:hidden">
          {loading ? (
            <div className="flex items-center justify-center p-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : filteredPurchases.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              No purchases found.
            </p>
          ) : (
            filteredPurchases.map((purchase) => (
              <div key={purchase.id} className="p-4">
                <button
                  type="button"
                  onClick={() => void openPurchaseDetail(purchase)}
                  className="w-full text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {purchase.supplier_name || "Unknown supplier"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Purchase #{purchase.id} ·{" "}
                        {formatDate(purchase.purchase_date)}
                      </p>
                    </div>
                    <p className="shrink-0 font-semibold tabular-nums">
                      {formatCurrency(purchase.total_cost)}
                    </p>
                  </div>
                  <div className="mt-2 truncate text-xs text-muted-foreground">
                    {purchase.reference_number || "No supplier reference"}
                  </div>
                </button>
                <div className="mt-2 flex min-h-9 items-center justify-between gap-2 border-t border-border/60 pt-2">
                  {statusBadge(purchase.status)}
                  {purchase.status === "posted" && (canVoidPurchase || canCreatePurchaseReturn) ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9"
                          aria-label={`Actions for purchase ${purchase.id}`}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canCreatePurchaseReturn ? <DropdownMenuItem
                          onClick={() =>
                            router.push(
                              `/inventory/purchases/returns?purchase_id=${purchase.id}`,
                            )
                          }
                        >
                          <Undo2 className="mr-2 h-4 w-4" /> Return items
                        </DropdownMenuItem> : null}
                        {canVoidPurchase ? <DropdownMenuItem
                          onClick={() => {
                            setVoidPurchase(purchase);
                            setVoidReason("");
                          }}
                          className="text-destructive focus:text-destructive"
                        >
                          <Ban className="mr-2 h-4 w-4" /> Void
                        </DropdownMenuItem> : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
        <div className="hidden overflow-x-auto lg:block">
          <Table className="min-w-[820px] table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-28 whitespace-nowrap">Date</TableHead>
                <TableHead className="w-[28%] min-w-0">Supplier</TableHead>
                <TableHead className="w-32 whitespace-nowrap">
                  Purchase
                </TableHead>
                <TableHead className="w-[24%] min-w-0">
                  Supplier reference
                </TableHead>
                <TableHead className="w-32 whitespace-nowrap">Total</TableHead>
                <TableHead className="w-[104px] whitespace-nowrap">
                  Status
                </TableHead>
                <TableHead className="w-12 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-8 text-muted-foreground"
                  >
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : filteredPurchases.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No purchases found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredPurchases.map((purchase) => (
                  <TableRow
                    key={purchase.id}
                    role="button"
                    tabIndex={0}
                    className="cursor-pointer focus-visible:bg-muted/40 focus-visible:outline-none"
                    onClick={() => void openPurchaseDetail(purchase)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        void openPurchaseDetail(purchase);
                      }
                    }}
                  >
                    <TableCell className="whitespace-nowrap">
                      {formatDate(purchase.purchase_date)}
                    </TableCell>
                    <TableCell>
                      <span className="block truncate">
                        {purchase.supplier_name || "Unknown"}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-medium">
                      Purchase #{purchase.id}
                    </TableCell>
                    <TableCell>
                      <span className="block truncate">
                        {purchase.reference_number || "-"}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-medium">
                      {formatCurrency(purchase.total_cost)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {statusBadge(purchase.status)}
                    </TableCell>
                    <TableCell
                      className="whitespace-nowrap text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label={`Actions for purchase ${purchase.id}`}
                          >
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => void openPurchaseDetail(purchase)}
                          >
                            View details
                          </DropdownMenuItem>
                          {purchase.status === "posted" && (canVoidPurchase || canCreatePurchaseReturn) && (
                            <>
                              {canCreatePurchaseReturn ? <DropdownMenuItem
                                onClick={() =>
                                  router.push(
                                    `/inventory/purchases/returns?purchase_id=${purchase.id}`,
                                  )
                                }
                              >
                                <Undo2 className="w-4 h-4 mr-2" /> Return items
                              </DropdownMenuItem> : null}
                              {canVoidPurchase ? <DropdownMenuItem
                                onClick={() => {
                                  setVoidPurchase(purchase);
                                  setVoidReason("");
                                }}
                                className="text-red-600"
                              >
                                <Ban className="w-4 h-4 mr-2" /> Void
                              </DropdownMenuItem> : null}
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </PageSection>

      {canPostPurchase && <RecordPurchaseDialog open={createOpen} onOpenChange={setCreateOpen} restaurantId={user?.restaurant_id || 0} initialSupplierId={searchParams.get("supplier_id")} onRecorded={fetchPurchases} />}

      <TransactionDetailSheet
        open={detailPurchase != null}
        onOpenChange={(open) => {
          if (!open) {
            setDetailPurchase(null);
            setDetailStatement(null);
            setDetailReturns([]);
          }
        }}
        detail={purchaseDetail}
        loading={detailLoading}
        footer={
          detailPurchase ? (
            <>
              {detailPurchase.status === "posted" && canVoidPurchase ? (
                <Button
                  variant="destructive"
                  onClick={() => {
                    setVoidPurchase(detailPurchase);
                    setVoidReason("");
                  }}
                >
                  Void purchase
                </Button>
              ) : null}
            </>
          ) : null
        }
      />

      {/* Void Dialog */}
      {canVoidPurchase ? <Dialog
        open={!!voidPurchase}
        onOpenChange={(open) => !open && setVoidPurchase(null)}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              Void {voidPurchase?.reference_number || "supplier purchase"}
            </DialogTitle>
            <DialogDescription>
              This reverses the received stock and reverses the linked expense.
              Use a Purchase Return instead if the goods already left the
              restaurant.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Reason *</Label>
            <Textarea
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setVoidPurchase(null)}
              disabled={voidSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleVoid}
              disabled={voidSubmitting}
            >
              {voidSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Void Purchase
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog> : null}
    </AppPage>
  );
}
