"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, ChevronLeft, Loader2, MoreVertical, Ban } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { InventoryItemSelect } from "@/components/inventory/inventory-item-select";
import {
  CashBankAccountSelect,
  type CashBankAccountOption,
} from "@/components/finance/cash-bank-account-select";
import apiClient from "@/lib/api-client";
import { PurchaseApis, PurchaseReturnApis, SupplierApis } from "@/lib/api/endpoints";
import { formatCurrency, formatDate } from "@/lib/utils";

const REASON_OPTIONS = [
  { value: "damaged_on_delivery", label: "Damaged on delivery" },
  { value: "wrong_item", label: "Wrong item" },
  { value: "poor_quality", label: "Poor quality" },
  { value: "expired_or_short_dated", label: "Expired or short-dated" },
  { value: "excess_delivery", label: "Excess delivery" },
  { value: "price_dispute", label: "Price dispute" },
  { value: "other", label: "Other" },
];

const isRefundCustodyAccount = (account: CashBankAccountOption) =>
  account.account_type === "drawer" || account.bank_type !== "owner_equity";

function statusBadge(status: string) {
  switch (status) {
    case "draft":
      return <Badge variant="secondary" className="capitalize">Draft</Badge>;
    case "posted":
      return <Badge variant="default" className="bg-green-600 hover:bg-green-700 capitalize">Posted</Badge>;
    case "voided":
      return <Badge variant="destructive" className="capitalize">Voided</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

interface ReturnLineDraft {
  key: string;
  purchase_line_id: number | null;
  inventory_item_id: number | null;
  quantity: string;
  unit_cost: string;
}

function newReturnLine(): ReturnLineDraft {
  return {
    key: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    purchase_line_id: null,
    inventory_item_id: null,
    quantity: "",
    unit_cost: "",
  };
}

export default function InventoryPurchaseReturnsPage() {
  const user = useAuth((state) => state.user);
  const router = useRouter();

  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [postedPurchases, setPostedPurchases] = useState<any[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    supplier_id: "",
    purchase_id: "",
    return_date: new Date().toISOString().split("T")[0],
    reason_code: "damaged_on_delivery",
    settlement_type: "supplier_credit",
    goods_physically_returned: true,
  });
  const [createLines, setCreateLines] = useState<ReturnLineDraft[]>([newReturnLine()]);
  const [refundAccount, setRefundAccount] = useState<CashBankAccountOption | null>(null);
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const [voidReturn, setVoidReturn] = useState<any | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidSubmitting, setVoidSubmitting] = useState(false);

  const fetchReturns = async () => {
    if (!user?.restaurant_id) return;
    setLoading(true);
    try {
      const response = await apiClient.get(PurchaseReturnApis.list({ restaurantId: user.restaurant_id }));
      if (response.data.status === "success") {
        setReturns(response.data.data?.purchase_returns || []);
      }
    } catch (err) {
      console.error("Failed to fetch purchase returns:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    if (!user?.restaurant_id) return;
    try {
      const response = await apiClient.get(SupplierApis.listSuppliers(user.restaurant_id, true));
      if (response.data.status === "success") setSuppliers(response.data.data?.suppliers || []);
    } catch (err) {
      console.error("Failed to fetch suppliers:", err);
    }
  };

  const fetchPostedPurchases = async () => {
    if (!user?.restaurant_id) return;
    try {
      const response = await apiClient.get(PurchaseApis.list({ restaurantId: user.restaurant_id, status: "posted" }));
      if (response.data.status === "success") setPostedPurchases(response.data.data?.purchases || []);
    } catch (err) {
      console.error("Failed to fetch posted purchases:", err);
    }
  };

  useEffect(() => {
    fetchReturns();
    fetchSuppliers();
    fetchPostedPurchases();
  }, [user?.restaurant_id]);

  const selectedPurchase = postedPurchases.find((p) => String(p.id) === createForm.purchase_id) || null;

  const openCreate = () => {
    setCreateForm({
      supplier_id: "",
      purchase_id: "",
      return_date: new Date().toISOString().split("T")[0],
      reason_code: "damaged_on_delivery",
      settlement_type: "supplier_credit",
      goods_physically_returned: true,
    });
    setCreateLines([newReturnLine()]);
    setRefundAccount(null);
    setCreateOpen(true);
  };

  const handlePurchaseSelect = (purchaseId: string) => {
    const purchase = postedPurchases.find((p) => String(p.id) === purchaseId);
    setCreateForm({
      ...createForm,
      purchase_id: purchaseId,
      supplier_id: purchase ? String(purchase.supplier_id) : createForm.supplier_id,
    });
    if (purchase?.lines?.length) {
      setCreateLines(
        purchase.lines
          .filter((l: any) => Number(l.received_quantity) - 0 > 0)
          .map((l: any) => ({
            key: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
            purchase_line_id: l.id,
            inventory_item_id: l.inventory_item_id,
            quantity: "",
            unit_cost: String(l.unit_cost ?? ""),
          })),
      );
    }
  };

  const updateLine = (index: number, patch: Partial<ReturnLineDraft>) => {
    const updated = [...createLines];
    updated[index] = { ...updated[index], ...patch };
    setCreateLines(updated);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.restaurant_id || !createForm.supplier_id) {
      toast.error("Select a supplier before saving.");
      return;
    }
    const lines = createLines.filter((l) => l.inventory_item_id != null && Number(l.quantity) > 0);
    if (lines.length === 0) {
      toast.error("Add at least one return line with a quantity.");
      return;
    }
    if (createForm.settlement_type === "refund_received" && !refundAccount) {
      toast.error("Select the bank or cash drawer that received the supplier refund.");
      return;
    }

    setCreateSubmitting(true);
    try {
      const payload = {
        restaurant_id: user.restaurant_id,
        supplier_id: Number(createForm.supplier_id),
        purchase_id: createForm.purchase_id ? Number(createForm.purchase_id) : undefined,
        return_date: createForm.return_date,
        reason_code: createForm.reason_code,
        settlement_type: createForm.settlement_type,
        account_type:
          createForm.settlement_type === "refund_received" ? refundAccount?.account_type : undefined,
        account_id:
          createForm.settlement_type === "refund_received" ? refundAccount?.id : undefined,
        goods_physically_returned: createForm.goods_physically_returned,
        lines: lines.map((l) => ({
          purchase_line_id: l.purchase_line_id || undefined,
          inventory_item_id: l.inventory_item_id,
          quantity: Number(l.quantity),
          unit_cost: l.unit_cost ? Number(l.unit_cost) : undefined,
        })),
      };
      await apiClient.post(PurchaseReturnApis.create, payload);
      toast.success("Purchase return posted.");
      setCreateOpen(false);
      await fetchReturns();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to post purchase return.");
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleVoid = async () => {
    if (!voidReturn || !user?.restaurant_id) return;
    if (voidReason.trim().length < 3) {
      toast.error("Reason must be at least 3 characters.");
      return;
    }
    setVoidSubmitting(true);
    try {
      await apiClient.post(PurchaseReturnApis.void(voidReturn.id, user.restaurant_id), { reason: voidReason.trim() });
      toast.success("Purchase return voided.");
      setVoidReturn(null);
      setVoidReason("");
      await fetchReturns();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to void purchase return.");
    } finally {
      setVoidSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => router.push("/inventory/purchases")}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Purchases
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Purchase Returns</h1>
          <p className="text-muted-foreground">
            Stock returned to a supplier. A manual Reduce Stock for waste or damage is a
            different thing -- use this only for goods actually going back to the supplier.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" /> Record Return
        </Button>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Reason</TableHead>
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
            ) : returns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No purchase returns yet.
                </TableCell>
              </TableRow>
            ) : (
              returns.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{formatDate(r.return_date)}</TableCell>
                  <TableCell>{r.supplier_name || "Unknown"}</TableCell>
                  <TableCell className="capitalize">{r.reason_code?.replace(/_/g, " ")}</TableCell>
                  <TableCell className="font-medium">{formatCurrency(r.total_cost)}</TableCell>
                  <TableCell>{statusBadge(r.status)}</TableCell>
                  <TableCell className="text-right">
                    {r.status === "posted" && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setVoidReturn(r);
                              setVoidReason("");
                            }}
                            className="text-red-600"
                          >
                            <Ban className="w-4 h-4 mr-2" /> Void
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Return Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[640px] max-h-[92vh] overflow-y-auto">
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle>Record Purchase Return</DialogTitle>
              <DialogDescription>
                Preferably reference the original purchase so eligible quantities are
                validated automatically.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Original purchase (optional)</Label>
                  <Select value={createForm.purchase_id} onValueChange={handlePurchaseSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="No specific purchase" />
                    </SelectTrigger>
                    <SelectContent>
                      {postedPurchases.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          #{p.id} · {p.supplier_name} · {formatDate(p.purchase_date)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Supplier *</Label>
                  <Select
                    value={createForm.supplier_id}
                    onValueChange={(v) => setCreateForm({ ...createForm, supplier_id: v })}
                    disabled={!!selectedPurchase}
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
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Return date</Label>
                  <Input
                    type="date"
                    value={createForm.return_date}
                    onChange={(e) => setCreateForm({ ...createForm, return_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Reason</Label>
                  <Select value={createForm.reason_code} onValueChange={(v) => setCreateForm({ ...createForm, reason_code: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REASON_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Settlement</Label>
                  <Select
                    value={createForm.settlement_type}
                    onValueChange={(v) => {
                      setCreateForm({ ...createForm, settlement_type: v });
                      if (v !== "refund_received") setRefundAccount(null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="supplier_credit">Supplier credit</SelectItem>
                      <SelectItem value="refund_received">Refund received</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {createForm.settlement_type === "refund_received" ? (
                <div className="rounded-lg border p-4 space-y-2">
                  <CashBankAccountSelect
                    value={refundAccount}
                    onChange={setRefundAccount}
                    label="Refund received into"
                    accountFilter={isRefundCustodyAccount}
                  />
                  <p className="text-xs text-muted-foreground">
                    This account balance increases now. Voiding the return removes the same amount from it.
                  </p>
                </div>
              ) : null}

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label>Goods physically returned</Label>
                  <p className="text-xs text-muted-foreground">
                    Turn off for a price-dispute credit where nothing physically leaves.
                  </p>
                </div>
                <Switch
                  checked={createForm.goods_physically_returned}
                  onCheckedChange={(checked) => setCreateForm({ ...createForm, goods_physically_returned: checked })}
                />
              </div>

              <div className="space-y-3 border rounded-lg p-4 bg-muted/20">
                <Label className="text-sm font-semibold">Return Lines</Label>
                {createLines.map((line, index) => (
                  <div key={line.key} className="rounded-md border bg-background p-3 space-y-2">
                    {user?.restaurant_id && (
                      <InventoryItemSelect
                        restaurantId={user.restaurant_id}
                        value={line.inventory_item_id}
                        onChange={(itemId) => updateLine(index, { inventory_item_id: itemId })}
                        label="Item"
                        disabled={!!line.purchase_line_id}
                      />
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Quantity *</Label>
                        <Input
                          type="number"
                          step="0.001"
                          min="0.001"
                          value={line.quantity}
                          onChange={(e) => updateLine(index, { quantity: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Unit cost</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.unit_cost}
                          onChange={(e) => updateLine(index, { unit_cost: e.target.value })}
                          placeholder="Defaults to purchase unit cost"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCreateLines([...createLines, newReturnLine()])}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add line
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setCreateOpen(false)} disabled={createSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={createSubmitting}>
                {createSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Post Return
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Void Dialog */}
      <Dialog open={!!voidReturn} onOpenChange={(open) => !open && setVoidReturn(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Void Purchase Return</DialogTitle>
            <DialogDescription>This restores the returned stock and reverses the credit.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Reason *</Label>
            <Textarea value={voidReason} onChange={(e) => setVoidReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidReturn(null)} disabled={voidSubmitting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleVoid} disabled={voidSubmitting}>
              {voidSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Void Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
