"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  Search,
  ChevronLeft,
  Loader2,
  MoreVertical,
  Ban,
  Undo2,
} from "lucide-react";

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
import {
  CashBankAccountSelect,
  type CashBankAccountOption,
} from "@/components/finance/cash-bank-account-select";
import {
  PurchaseLineItemsEditor,
  newPurchaseLineDraft,
  type PurchaseLineDraft,
} from "@/components/purchases/purchase-line-items-editor";
import apiClient from "@/lib/api-client";
import { PartyLedgerApis, PurchaseApis, PurchaseReturnApis, SupplierApis } from "@/lib/api/endpoints";
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

function statusBadge(status: string) {
  switch (status) {
    case "posted":
      return <Badge variant="default" className="bg-green-600 hover:bg-green-700">Purchased</Badge>;
    case "voided":
      return <Badge variant="destructive" className="capitalize">Voided</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function InventoryPurchasesPage() {
  const user = useAuth((state) => state.user);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [suppliers, setSuppliers] = useState<any[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    supplier_id: "",
    purchase_date: new Date().toISOString().split("T")[0],
    expected_delivery_date: "",
    reference_number: "",
    notes: "",
  });
  const [createLines, setCreateLines] = useState<PurchaseLineDraft[]>([newPurchaseLineDraft()]);
  const [createPaymentStatus, setCreatePaymentStatus] = useState("pending");
  const [createPaidAmount, setCreatePaidAmount] = useState("");
  const [createAccount, setCreateAccount] = useState<CashBankAccountOption | null>(null);
  const [createSubmitting, setCreateSubmitting] = useState(false);

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

  const fetchSuppliers = useCallback(async () => {
    if (!user?.restaurant_id) return;
    try {
      const response = await apiClient.get(SupplierApis.listSuppliers(user.restaurant_id, true));
      if (response.data.status === "success") {
        setSuppliers(response.data.data?.suppliers || []);
      }
    } catch (err) {
      console.error("Failed to fetch suppliers:", err);
    }
  }, [user?.restaurant_id]);

  const openPurchaseDetail = useCallback(async (purchase: any) => {
    setDetailPurchase(purchase);
    setDetailStatement(null);
    setDetailReturns([]);
    if (!user?.restaurant_id || !purchase?.supplier_id) return;

    setDetailLoading(true);
    try {
      const [purchaseResponse, statementResponse, returnsResponse] = await Promise.all([
        apiClient.get(PurchaseApis.get(purchase.id, user.restaurant_id)),
        apiClient.get(PartyLedgerApis.statement("supplier", purchase.supplier_id, user.restaurant_id)),
        apiClient.get(PurchaseReturnApis.list({ restaurantId: user.restaurant_id, supplierId: purchase.supplier_id, limit: 200 })),
      ]);
      setDetailPurchase(purchaseResponse.data.data || purchase);
      setDetailStatement(statementResponse.data.data || null);
      setDetailReturns(returnsResponse.data.data?.purchase_returns || []);
    } catch (error) {
      console.error("Failed to load purchase settlement details", error);
    } finally {
      setDetailLoading(false);
    }
  }, [user?.restaurant_id]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  useEffect(() => {
    fetchPurchases();
  }, [fetchPurchases]);

  const openCreate = () => {
    const supplierFromUrl = searchParams.get("supplier_id") || "";
    setCreateForm({
      supplier_id: supplierFromUrl,
      purchase_date: new Date().toISOString().split("T")[0],
      expected_delivery_date: "",
      reference_number: "",
      notes: "",
    });
    setCreateLines([newPurchaseLineDraft()]);
    setCreatePaymentStatus("pending");
    setCreatePaidAmount("");
    setCreateAccount(null);
    setCreateOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.restaurant_id || !createForm.supplier_id) {
      toast.error("Select a supplier before saving.");
      return;
    }
    const lines = createLines.filter((l) =>
      l.mode === "existing" ? l.inventoryItemId != null : l.newItem.name.trim() && l.newItem.unit.trim(),
    );
    if (lines.length === 0) {
      toast.error("Add at least one purchase line.");
      return;
    }
    for (const line of lines) {
      if (!line.orderedQuantity || Number(line.orderedQuantity) <= 0 || line.unitCost === "") {
        toast.error("Every line needs a quantity and a unit cost.");
        return;
      }
    }
    if (["paid", "partial"].includes(createPaymentStatus) && !createAccount) {
      toast.error("Select the cash or bank account used to pay.");
      return;
    }
    if (createPaymentStatus === "partial" && Number(createPaidAmount) <= 0) {
      toast.error("Enter the amount paid now.");
      return;
    }

    setCreateSubmitting(true);
    try {
      const payload = {
        restaurant_id: user.restaurant_id,
        supplier_id: Number(createForm.supplier_id),
        purchase_date: createForm.purchase_date,
        expected_delivery_date: createForm.expected_delivery_date || undefined,
        reference_number: createForm.reference_number.trim() || undefined,
        notes: createForm.notes.trim() || undefined,
        payment_status: createPaymentStatus,
        paid_amount: createPaymentStatus === "partial" ? Number(createPaidAmount) : undefined,
        account_type: ["paid", "partial"].includes(createPaymentStatus) ? createAccount?.account_type : undefined,
        account_id: ["paid", "partial"].includes(createPaymentStatus) ? createAccount?.id : undefined,
        idempotency_key: crypto.randomUUID(),
        lines: lines.map((line) => ({
          inventory_item_id: line.mode === "existing" ? line.inventoryItemId : undefined,
          station_id: line.mode === "existing" ? line.stationId : undefined,
          new_item:
            line.mode === "new"
              ? {
                  name: line.newItem.name.trim(),
                  unit: line.newItem.unit.trim(),
                  min_stock_level: Number(line.newItem.min_stock_level || 0),
                  station: line.newItem.station || "general",
                  station_id: line.newItem.stationId,
                  storage_location: line.newItem.storage_location.trim() || undefined,
                }
              : undefined,
          ordered_quantity: Number(line.orderedQuantity),
          purchase_unit: line.purchaseUnit.trim() || undefined,
          unit_conversion_factor: Number(line.unitConversionFactor || 1),
          unit_cost: Number(line.unitCost),
          tax_rate: line.taxRate ? Number(line.taxRate) : undefined,
        })),
      };
      await apiClient.post(PurchaseApis.create, payload);
      toast.success("Purchase recorded and stock updated.");
      setCreateOpen(false);
      await fetchPurchases();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to save purchase.");
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleVoid = async () => {
    if (!voidPurchase || !user?.restaurant_id) return;
    if (voidReason.trim().length < 3) {
      toast.error("Reason must be at least 3 characters.");
      return;
    }
    setVoidSubmitting(true);
    try {
      await apiClient.post(PurchaseApis.void(voidPurchase.id, user.restaurant_id), { reason: voidReason.trim() });
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
        backHref="/inventory"
        title="Purchases"
        description="Receive supplier stock and keep inventory quantities accurate."
        actions={<div className="grid w-full grid-cols-2 gap-2 md:flex md:w-auto"><Button variant="outline" className="h-11 rounded-xl" onClick={() => router.push("/inventory/purchases/returns")}><Undo2 className="mr-2 h-4 w-4" /> Returns</Button><Button className="h-11 rounded-xl" onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Record purchase</Button></div>}
      />

      <PageSection surface className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem]">
          <SearchField placeholder="Search supplier or reference" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
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
        <p className="text-xs leading-5 text-muted-foreground">A posted purchase changes stock only by the quantity actually received.</p>
      </PageSection>

      <PageSection surface className="overflow-hidden p-0">
        <div className="divide-y divide-border md:hidden">
          {loading ? (
            <div className="flex items-center justify-center p-8 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : filteredPurchases.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">No purchases found.</p>
          ) : filteredPurchases.map((purchase) => (
            <div key={purchase.id} className="p-4">
              <button type="button" onClick={() => void openPurchaseDetail(purchase)} className="w-full text-left">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-medium">{purchase.supplier_name || "Unknown supplier"}</p><p className="mt-1 text-xs text-muted-foreground">Purchase #{purchase.id} · {formatDate(purchase.purchase_date)}</p></div><p className="shrink-0 font-semibold tabular-nums">{formatCurrency(purchase.total_cost)}</p></div>
                <div className="mt-2 flex items-center justify-between gap-2"><span className="truncate text-xs text-muted-foreground">{purchase.reference_number || "No supplier reference"}</span>{statusBadge(purchase.status)}</div>
              </button>
              {purchase.status === "posted" ? <div className="mt-3 flex gap-2"><Button size="sm" variant="outline" onClick={() => router.push(`/inventory/purchases/returns?purchase_id=${purchase.id}`)}>Return items</Button><Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => { setVoidPurchase(purchase); setVoidReason(""); }}>Void</Button></div> : null}
            </div>
          ))}
        </div>
        <div className="hidden overflow-x-auto md:block"><Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Purchase</TableHead>
              <TableHead>Supplier reference</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : filteredPurchases.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
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
                  <TableCell>{formatDate(purchase.purchase_date)}</TableCell>
                  <TableCell>{purchase.supplier_name || "Unknown"}</TableCell>
                  <TableCell className="font-medium">Purchase #{purchase.id}</TableCell>
                  <TableCell>{purchase.reference_number || "-"}</TableCell>
                  <TableCell className="font-medium">{formatCurrency(purchase.total_cost)}</TableCell>
                  <TableCell>{statusBadge(purchase.status)}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => void openPurchaseDetail(purchase)}>View details</DropdownMenuItem>
                        {purchase.status === "posted" && (
                          <>
                            <DropdownMenuItem onClick={() => router.push(`/inventory/purchases/returns?purchase_id=${purchase.id}`)}>
                              <Undo2 className="w-4 h-4 mr-2" /> Return items
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setVoidPurchase(purchase);
                                setVoidReason("");
                              }}
                              className="text-red-600"
                            >
                              <Ban className="w-4 h-4 mr-2" /> Void
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table></div>
      </PageSection>

      {/* Create Purchase Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="flex h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-[720px] flex-col gap-0 overflow-hidden p-0 sm:h-auto sm:max-h-[92vh] sm:w-full">
          <form onSubmit={handleCreate} className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <DialogHeader className="shrink-0 border-b px-5 py-4 text-left sm:px-6">
              <DialogTitle>Record Purchase</DialogTitle>
              <DialogDescription>
                Add the supplier bill and items once. Saving immediately updates stock,
                supplier balance, and accounting.
              </DialogDescription>
            </DialogHeader>
            <div className="grid flex-1 gap-4 overflow-y-auto px-5 py-4 sm:px-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Supplier *</Label>
                  <Select
                    value={createForm.supplier_id}
                    onValueChange={(v) => setCreateForm({ ...createForm, supplier_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Purchase date</Label>
                  <Input
                    type="date"
                    value={createForm.purchase_date}
                    onChange={(e) => setCreateForm({ ...createForm, purchase_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Reference number</Label>
                  <Input
                    placeholder="Supplier invoice/bill #"
                    value={createForm.reference_number}
                    onChange={(e) => setCreateForm({ ...createForm, reference_number: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Payment</Label>
                  <Select value={createPaymentStatus} onValueChange={(value) => {
                    setCreatePaymentStatus(value);
                    if (value !== "paid" && value !== "partial") setCreateAccount(null);
                    if (value !== "partial") setCreatePaidAmount("");
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="paid">Paid now</SelectItem>
                      <SelectItem value="partial">Pay part now</SelectItem>
                      <SelectItem value="pending">Pay later / supplier due</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {["paid", "partial"].includes(createPaymentStatus) ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <CashBankAccountSelect label="Paid from account" value={createAccount} onChange={setCreateAccount} />
                  {createPaymentStatus === "partial" ? <div className="space-y-2"><Label>Amount paid now</Label><Input type="number" min="0.01" step="0.01" value={createPaidAmount} onChange={(e) => setCreatePaidAmount(e.target.value)} placeholder="0.00" /><p className="text-xs text-muted-foreground">The remaining amount stays as a supplier bill.</p></div> : null}
                </div>
              ) : null}

              {user?.restaurant_id && (
                <PurchaseLineItemsEditor
                  restaurantId={user.restaurant_id}
                  lines={createLines}
                  onChange={setCreateLines}
                  disabled={createSubmitting}
                />
              )}

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={createForm.notes}
                  onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter className="shrink-0 border-t px-5 py-3 sm:px-6">
              <Button className="h-11 flex-1 sm:flex-none" variant="outline" type="button" onClick={() => setCreateOpen(false)} disabled={createSubmitting}>
                Cancel
              </Button>
              <Button className="h-11 flex-[1.3] sm:flex-none" type="submit" disabled={createSubmitting}>
                {createSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Record purchase
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
              {detailPurchase.status === "posted" ? (
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
      <Dialog open={!!voidPurchase} onOpenChange={(open) => !open && setVoidPurchase(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Void {voidPurchase?.reference_number || "supplier purchase"}</DialogTitle>
            <DialogDescription>
              This reverses the received stock and reverses the linked expense. Use a
              Purchase Return instead if the goods already left the restaurant.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Reason *</Label>
            <Textarea value={voidReason} onChange={(e) => setVoidReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidPurchase(null)} disabled={voidSubmitting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleVoid} disabled={voidSubmitting}>
              {voidSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Void Purchase
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppPage>
  );
}
