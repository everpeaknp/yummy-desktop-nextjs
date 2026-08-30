"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  Search,
  ChevronLeft,
  Loader2,
  MoreVertical,
  CheckCircle2,
  Ban,
  PackageCheck,
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

function statusBadge(status: string) {
  switch (status) {
    case "draft":
      return <Badge variant="secondary" className="capitalize">Draft</Badge>;
    case "ordered":
      return <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50 capitalize">Ordered</Badge>;
    case "posted":
      return <Badge variant="default" className="bg-green-600 hover:bg-green-700 capitalize">Posted</Badge>;
    case "voided":
      return <Badge variant="destructive" className="capitalize">Voided</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function InventoryPurchasesPage() {
  const user = useAuth((state) => state.user);
  const router = useRouter();

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
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const [detailPurchase, setDetailPurchase] = useState<any | null>(null);

  const [receivePurchase, setReceivePurchase] = useState<any | null>(null);
  const [receiveQuantities, setReceiveQuantities] = useState<Record<number, string>>({});
  const [receivePaymentStatus, setReceivePaymentStatus] = useState("pending");
  const [receiveAccount, setReceiveAccount] = useState<CashBankAccountOption | null>(null);
  const [receiveSubmitting, setReceiveSubmitting] = useState(false);

  const [voidPurchase, setVoidPurchase] = useState<any | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidSubmitting, setVoidSubmitting] = useState(false);

  const fetchPurchases = async () => {
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
  };

  const fetchSuppliers = async () => {
    if (!user?.restaurant_id) return;
    try {
      const response = await apiClient.get(SupplierApis.listSuppliers(user.restaurant_id, true));
      if (response.data.status === "success") {
        setSuppliers(response.data.data?.suppliers || []);
      }
    } catch (err) {
      console.error("Failed to fetch suppliers:", err);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, [user?.restaurant_id]);

  useEffect(() => {
    fetchPurchases();
  }, [user?.restaurant_id, statusFilter]);

  const openCreate = () => {
    setCreateForm({
      supplier_id: "",
      purchase_date: new Date().toISOString().split("T")[0],
      expected_delivery_date: "",
      reference_number: "",
      notes: "",
    });
    setCreateLines([newPurchaseLineDraft()]);
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

    setCreateSubmitting(true);
    try {
      const payload = {
        restaurant_id: user.restaurant_id,
        supplier_id: Number(createForm.supplier_id),
        purchase_date: createForm.purchase_date,
        expected_delivery_date: createForm.expected_delivery_date || undefined,
        reference_number: createForm.reference_number.trim() || undefined,
        notes: createForm.notes.trim() || undefined,
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
      toast.success("Purchase saved as draft.");
      setCreateOpen(false);
      await fetchPurchases();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to save purchase.");
    } finally {
      setCreateSubmitting(false);
    }
  };

  const openReceive = (purchase: any) => {
    setReceivePurchase(purchase);
    const defaults: Record<number, string> = {};
    for (const line of purchase.lines || []) {
      const remaining = Number(line.ordered_quantity) - Number(line.received_quantity);
      defaults[line.id] = remaining > 0 ? String(remaining) : "0";
    }
    setReceiveQuantities(defaults);
    setReceivePaymentStatus("pending");
    setReceiveAccount(null);
  };

  const handleReceive = async () => {
    if (!receivePurchase || !user?.restaurant_id) return;
    const lines = Object.entries(receiveQuantities)
      .filter(([, qty]) => Number(qty) > 0)
      .map(([purchase_line_id, qty]) => ({
        purchase_line_id: Number(purchase_line_id),
        quantity_received_now: Number(qty),
      }));
    if (lines.length === 0) {
      toast.error("Enter a quantity to receive for at least one line.");
      return;
    }
    if (receivePaymentStatus === "paid" && !receiveAccount) {
      toast.error("Select the account used to pay for this receipt.");
      return;
    }

    setReceiveSubmitting(true);
    try {
      const payload: any = {
        lines,
        payment_status: receivePaymentStatus,
      };
      if (receivePaymentStatus === "paid" && receiveAccount) {
        payload.account_type = receiveAccount.account_type;
        payload.account_id = receiveAccount.id;
      }
      await apiClient.post(PurchaseApis.receive(receivePurchase.id, user.restaurant_id), payload);
      toast.success("Purchase received.");
      setReceivePurchase(null);
      setDetailPurchase(null);
      await fetchPurchases();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to receive purchase.");
    } finally {
      setReceiveSubmitting(false);
    }
  };

  const handleMarkOrdered = async (purchase: any) => {
    if (!user?.restaurant_id) return;
    try {
      await apiClient.post(PurchaseApis.markOrdered(purchase.id, user.restaurant_id));
      toast.success("Purchase marked as ordered.");
      await fetchPurchases();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to mark purchase as ordered.");
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
      !searchQuery ||
      p.supplier_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.reference_number?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => router.push("/inventory")}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Inventory
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Purchases</h1>
          <p className="text-muted-foreground">
            Stock acquired from suppliers. Posting a purchase increases inventory only by what's actually received.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" /> Record Purchase
        </Button>
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
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="ordered">Ordered</SelectItem>
            <SelectItem value="posted">Posted</SelectItem>
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
                <TableRow key={purchase.id} className="cursor-pointer" onClick={() => setDetailPurchase(purchase)}>
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
                        {purchase.status === "draft" && (
                          <DropdownMenuItem onClick={() => handleMarkOrdered(purchase)}>
                            <CheckCircle2 className="w-4 h-4 mr-2" /> Mark as Ordered
                          </DropdownMenuItem>
                        )}
                        {(purchase.status === "draft" || purchase.status === "ordered" || purchase.status === "posted") && (
                          <DropdownMenuItem onClick={() => openReceive(purchase)}>
                            <PackageCheck className="w-4 h-4 mr-2" /> Receive
                          </DropdownMenuItem>
                        )}
                        {purchase.status === "posted" && (
                          <DropdownMenuItem
                            onClick={() => {
                              setVoidPurchase(purchase);
                              setVoidReason("");
                            }}
                            className="text-red-600"
                          >
                            <Ban className="w-4 h-4 mr-2" /> Void
                          </DropdownMenuItem>
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
                Pick existing inventory items or create new ones inline. Inventory only
                increases once you receive this purchase, not when you save it.
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Expected delivery date</Label>
                  <Input
                    type="date"
                    value={createForm.expected_delivery_date}
                    onChange={(e) => setCreateForm({ ...createForm, expected_delivery_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Reference number</Label>
                  <Input
                    placeholder="Supplier invoice/bill #"
                    value={createForm.reference_number}
                    onChange={(e) => setCreateForm({ ...createForm, reference_number: e.target.value })}
                  />
                </div>
              </div>

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
                Save Draft
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Purchase Detail Dialog */}
      <Dialog open={!!detailPurchase} onOpenChange={(open) => !open && setDetailPurchase(null)}>
        <DialogContent className="sm:max-w-[640px] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Purchase #{detailPurchase?.id} {detailPurchase && statusBadge(detailPurchase.status)}
            </DialogTitle>
            <DialogDescription>
              {detailPurchase?.supplier_name} · {detailPurchase && formatDate(detailPurchase.purchase_date)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {(detailPurchase?.lines || []).map((line: any) => (
              <div key={line.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <div>
                  <p className="font-medium">{line.item_name || `Item #${line.inventory_item_id}`}</p>
                  <p className="text-xs text-muted-foreground">
                    {line.received_quantity} / {line.ordered_quantity} {line.purchase_unit || line.item_unit} received
                  </p>
                </div>
                <span className="font-medium">{formatCurrency(line.line_total)}</span>
              </div>
            ))}
            <div className="flex justify-between pt-2 border-t font-semibold">
              <span>Total</span>
              <span>{detailPurchase ? formatCurrency(detailPurchase.total_cost) : null}</span>
            </div>
          </div>
          <DialogFooter className="gap-2">
            {detailPurchase?.status === "draft" && (
              <Button variant="outline" onClick={() => handleMarkOrdered(detailPurchase)}>
                Mark as Ordered
              </Button>
            )}
            {["draft", "ordered", "posted"].includes(detailPurchase?.status) && (
              <Button variant="outline" onClick={() => openReceive(detailPurchase)}>
                Receive
              </Button>
            )}
            {detailPurchase?.status === "posted" && (
              <Button
                variant="destructive"
                onClick={() => {
                  setVoidPurchase(detailPurchase);
                  setVoidReason("");
                }}
              >
                Void
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receive Dialog */}
      <Dialog open={!!receivePurchase} onOpenChange={(open) => !open && setReceivePurchase(null)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Receive Purchase #{receivePurchase?.id}</DialogTitle>
            <DialogDescription>
              Enter what actually arrived. Safe to receive partially -- come back later for the rest.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {(receivePurchase?.lines || []).map((line: any) => {
              const remaining = Number(line.ordered_quantity) - Number(line.received_quantity);
              if (remaining <= 0) return null;
              return (
                <div key={line.id} className="flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{line.item_name || `Item #${line.inventory_item_id}`}</p>
                    <p className="text-xs text-muted-foreground">{remaining} remaining of {line.ordered_quantity}</p>
                  </div>
                  <Input
                    type="number"
                    step="0.001"
                    min="0"
                    max={remaining}
                    className="w-28"
                    value={receiveQuantities[line.id] ?? ""}
                    onChange={(e) =>
                      setReceiveQuantities({ ...receiveQuantities, [line.id]: e.target.value })
                    }
                  />
                </div>
              );
            })}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="space-y-2">
                <Label>Payment status</Label>
                <Select value={receivePaymentStatus} onValueChange={setReceivePaymentStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Paid now</SelectItem>
                    <SelectItem value="pending">Unpaid / supplier payable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {receivePaymentStatus === "paid" && (
                <CashBankAccountSelect label="Paid from account" value={receiveAccount} onChange={setReceiveAccount} />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceivePurchase(null)} disabled={receiveSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleReceive} disabled={receiveSubmitting}>
              {receiveSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Receive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Void Dialog */}
      <Dialog open={!!voidPurchase} onOpenChange={(open) => !open && setVoidPurchase(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Void Purchase #{voidPurchase?.id}</DialogTitle>
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
