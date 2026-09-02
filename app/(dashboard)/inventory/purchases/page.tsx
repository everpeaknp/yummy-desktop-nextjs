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
import { PurchaseApis, SupplierApis } from "@/lib/api/endpoints";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  TransactionDetailSheet,
  type TransactionDetailModel,
} from "@/components/finance/transaction-detail/transaction-detail-sheet";

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
    ? {
        eyebrow: "Inventory purchase",
        title: detailPurchase.reference_number || "Supplier purchase",
        reference: [detailPurchase.supplier_name, formatDate(detailPurchase.purchase_date)]
          .filter(Boolean)
          .join(" · "),
        subtitle: detailPurchase.supplier_name || "Inventory supplier",
        occurredAt: detailPurchase.created_at || detailPurchase.purchase_date,
        status: detailPurchase.status,
        amount: detailPurchase.total_cost,
        amountLabel: "Purchase value",
        amountTone: "out",
        badges: [detailPurchase.status, detailPurchase.payment_status].filter(Boolean),
        sections: [
          {
            title: "Purchase overview",
            fields: [
              { label: "Supplier", value: detailPurchase.supplier_name || "Supplier not recorded" },
              { label: "Purchase date", value: formatDate(detailPurchase.purchase_date) },
              { label: "Expected delivery", value: detailPurchase.expected_delivery_date ? formatDate(detailPurchase.expected_delivery_date) : "Not specified" },
              { label: "Reference", value: detailPurchase.reference_number || "Not provided" },
              { label: "Notes", value: detailPurchase.notes || "No notes", fullWidth: true },
            ],
          },
          {
            title: "Items received",
            description: "Ordered and received quantities for every inventory item.",
            table: {
              columns: ["Item", "Ordered", "Received", "Unit cost", "Amount"],
              rows: (detailPurchase.lines || []).map((line: any) => {
                const unit = line.purchase_unit || line.item_unit || "unit";
                return [
                  line.item_name || "Inventory item",
                  `${Number(line.ordered_quantity || 0).toLocaleString()} ${unit}`,
                  `${Number(line.received_quantity || 0).toLocaleString()} ${unit}`,
                  formatCurrency(line.unit_cost || 0),
                  formatCurrency(line.line_total || 0),
                ];
              }),
            },
          },
          {
            title: "Settlement",
            fields: [
              { label: "Total purchase value", value: formatCurrency(detailPurchase.total_cost) },
              { label: "Payment status", value: detailPurchase.payment_status?.replaceAll("_", " ") || "Not recorded" },
              { label: "Payment method", value: detailPurchase.payment_method?.replaceAll("_", " ") || "Not recorded" },
              { label: "Lifecycle status", value: detailPurchase.status?.replaceAll("_", " ") || "Not recorded" },
            ],
          },
        ],
      }
    : null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => router.push("/inventory")}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Inventory
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Purchases</h1>
          <p className="text-muted-foreground">
            Stock acquired from suppliers. Posting a purchase increases inventory only by what is actually received.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => router.push("/inventory/purchases/returns")}>
            <Undo2 className="w-4 h-4 mr-2" /> Purchase returns
          </Button>
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" /> Record Purchase
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by supplier or reference..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="posted">Purchased</SelectItem>
            <SelectItem value="voided">Voided</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : filteredPurchases.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
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
                  onClick={() => setDetailPurchase(purchase)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setDetailPurchase(purchase);
                    }
                  }}
                >
                  <TableCell>{formatDate(purchase.purchase_date)}</TableCell>
                  <TableCell>{purchase.supplier_name || "Unknown"}</TableCell>
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
                        <DropdownMenuItem onClick={() => setDetailPurchase(purchase)}>View details</DropdownMenuItem>
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
        </Table>
      </div>

      {/* Create Purchase Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[720px] max-h-[92vh] overflow-y-auto">
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle>Record Purchase</DialogTitle>
              <DialogDescription>
                Add the supplier bill and items once. Saving immediately updates stock,
                supplier balance, and accounting.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
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
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setCreateOpen(false)} disabled={createSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={createSubmitting}>
                {createSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Record purchase
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <TransactionDetailSheet
        open={detailPurchase != null}
        onOpenChange={(open) => !open && setDetailPurchase(null)}
        detail={purchaseDetail}
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
    </div>
  );
}
