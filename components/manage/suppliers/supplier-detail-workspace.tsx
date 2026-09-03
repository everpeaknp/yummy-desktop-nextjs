"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Banknote, ClipboardList, History, Landmark, Loader2, PackageMinus, Plus, ReceiptText, RefreshCw, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import apiClient from "@/lib/api-client";
import { PartyLedgerApis, PurchaseApis, PurchaseReturnApis, SupplierApis } from "@/lib/api/endpoints";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CashBankAccountSelect, type CashBankAccountOption } from "@/components/finance/cash-bank-account-select";
import { TransactionDetailSheet, type TransactionDetailModel } from "@/components/finance/transaction-detail/transaction-detail-sheet";
import { partyLedgerEntryDetail, purchaseDocumentDetail, purchaseReturnDetail, settlementAllocationDetail } from "@/components/finance/transaction-detail/party-workspace-detail";

type SupplierDetailWorkspaceProps = { supplierId: number };

const money = (value: unknown) => Number(value || 0);

export function SupplierDetailWorkspace({ supplierId }: SupplierDetailWorkspaceProps) {
  const user = useAuth((state) => state.user);
  const router = useRouter();
  const [supplier, setSupplier] = useState<any>(null);
  const [statement, setStatement] = useState<any>(null);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"activity" | "bills" | "returns" | "payments" | "open" | "statement">("activity");
  const [payOpen, setPayOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [receiving, setReceiving] = useState(false);
  const [amount, setAmount] = useState("");
  const [account, setAccount] = useState<CashBankAccountOption | null>(null);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [manualAllocation, setManualAllocation] = useState(false);
  const [allocations, setAllocations] = useState<Record<number, string>>({});
  const [receiptAmount, setReceiptAmount] = useState("");
  const [receiptAccount, setReceiptAccount] = useState<CashBankAccountOption | null>(null);
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().slice(0, 10));
  const [receiptReference, setReceiptReference] = useState("");
  const [receiptNotes, setReceiptNotes] = useState("");
  const [selectedDetail, setSelectedDetail] = useState<TransactionDetailModel | null>(null);

  const load = useCallback(async () => {
    if (!user?.restaurant_id) return;
    setLoading(true);
    try {
      const [supplierResponse, statementResponse, purchasesResponse, returnsResponse] = await Promise.all([
        apiClient.get(SupplierApis.getSupplier(supplierId, user.restaurant_id)),
        apiClient.get(PartyLedgerApis.statement("supplier", supplierId, user.restaurant_id)),
        apiClient.get(PurchaseApis.list({ restaurantId: user.restaurant_id, supplierId, limit: 200 })),
        apiClient.get(PurchaseReturnApis.list({ restaurantId: user.restaurant_id, supplierId, limit: 200 })),
      ]);
      setSupplier(supplierResponse.data.data);
      setStatement(statementResponse.data.data);
      setPurchases(purchasesResponse.data.data?.purchases || []);
      setReturns(returnsResponse.data.data?.purchase_returns || []);
    } catch (error) {
      console.error("Unable to load supplier workspace", error);
      toast.error("Could not load this supplier's records.");
    } finally {
      setLoading(false);
    }
  }, [supplierId, user?.restaurant_id]);

  useEffect(() => { load(); }, [load]);

  const openBills = useMemo(
    () => (statement?.entries || []).filter((entry: any) => entry.entry_side === "debt" && money(entry.open_amount) > 0.004),
    [statement],
  );
  const payable = Math.max(money(statement?.net_open), 0);
  const supplierCredit = Math.max(-money(statement?.net_open), 0);
  const manualTotal = Object.values(allocations).reduce((sum, value) => sum + money(value), 0);
  const activity = useMemo(
    () => [...(statement?.entries || [])].sort((a: any, b: any) => String(b.occurred_at || b.created_at).localeCompare(String(a.occurred_at || a.created_at))),
    [statement],
  );
  const payments = useMemo(
    () => activity.filter((entry: any) => ["supplier_payment", "supplier_refund_received", "supplier_payment_received"].includes(entry.entry_type)),
    [activity],
  );
  const totalPurchases = purchases.reduce((sum, purchase) => sum + money(purchase.total_cost), 0);
  const totalReturns = returns.reduce((sum, purchaseReturn) => sum + money(purchaseReturn.total_cost), 0);
  const paymentsOut = payments.filter((entry: any) => entry.entry_type === "supplier_payment").reduce((sum, entry) => sum + money(entry.amount), 0);
  const moneyReceived = payments.filter((entry: any) => ["supplier_refund_received", "supplier_payment_received"].includes(entry.entry_type)).reduce((sum, entry) => sum + money(entry.amount), 0);
  const fifoPreview = useMemo(() => {
    let remaining = money(amount);
    return [...openBills]
      .sort((a: any, b: any) => String(a.due_date || "9999-12-31").localeCompare(String(b.due_date || "9999-12-31")) || String(a.business_date).localeCompare(String(b.business_date)) || a.id - b.id)
      .map((bill: any) => {
        const allocationAmount = Math.min(Math.max(remaining, 0), money(bill.open_amount));
        remaining -= allocationAmount;
        return { ...bill, allocationAmount };
      })
      .filter((bill: any) => bill.allocationAmount > 0.004);
  }, [amount, openBills]);
  const fifoAllocated = fifoPreview.reduce((sum: number, bill: any) => sum + money(bill.allocationAmount), 0);

  const openPayment = () => {
    setAmount(payable ? payable.toFixed(2) : "");
    setAccount(null);
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setReference("");
    setNotes("");
    setManualAllocation(false);
    setAllocations({});
    setPayOpen(true);
  };

  const openReceipt = () => {
    setReceiptAmount("");
    setReceiptAccount(null);
    setReceiptDate(new Date().toISOString().slice(0, 10));
    setReceiptReference("");
    setReceiptNotes("");
    setReceiveOpen(true);
  };

  const submitPayment = async () => {
    if (!user?.restaurant_id || !account || money(amount) <= 0) {
      toast.error("Enter an amount and choose the account used to pay.");
      return;
    }
    if (manualAllocation && manualTotal > money(amount) + 0.004) {
      toast.error("Manual bill allocations cannot exceed the payment amount.");
      return;
    }
    if (manualAllocation && openBills.some((bill: any) => money(allocations[bill.id]) > money(bill.open_amount) + 0.004)) {
      toast.error("A bill allocation cannot exceed that bill's remaining balance.");
      return;
    }
    setPaying(true);
    try {
      await apiClient.post(SupplierApis.pay(supplierId, user.restaurant_id), {
        amount: money(amount),
        account_type: account.account_type,
        account_id: account.id,
        payment_method: account.account_type === "drawer" ? "cash" : "bank_transfer",
        payment_date: paymentDate,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
        idempotency_key: crypto.randomUUID(),
        allocations: manualAllocation
          ? openBills
              .filter((bill: any) => money(allocations[bill.id]) > 0)
              .map((bill: any) => ({ target_entry_id: bill.id, amount: money(allocations[bill.id]) }))
          : [],
      });
      toast.success(manualAllocation ? "Supplier payment allocated to the selected bills." : "Supplier payment applied oldest bill first.");
      setPayOpen(false);
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Could not record the supplier payment.");
    } finally {
      setPaying(false);
    }
  };

  const submitReceipt = async () => {
    if (!user?.restaurant_id || !receiptAccount || money(receiptAmount) <= 0) {
      toast.error("Enter the amount received and choose the bank or cash drawer.");
      return;
    }
    setReceiving(true);
    try {
      await apiClient.post(SupplierApis.receive(supplierId, user.restaurant_id), {
        amount: money(receiptAmount),
        account_type: receiptAccount.account_type,
        account_id: receiptAccount.id,
        payment_method: receiptAccount.account_type === "drawer" ? "cash" : "bank_transfer",
        receipt_date: receiptDate,
        reference: receiptReference.trim() || undefined,
        notes: receiptNotes.trim() || undefined,
        idempotency_key: crypto.randomUUID(),
      });
      toast.success("Supplier payment received and booked as supplier credit.");
      setReceiveOpen(false);
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Could not record the supplier payment received.");
    } finally {
      setReceiving(false);
    }
  };

  if (loading) return <div className="flex min-h-[360px] items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading supplier workspace…</div>;
  if (!supplier) return <div className="p-6">Supplier not found.</div>;

  return (
    <div className="mx-auto max-w-[1440px] space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-3">
          <Button variant="ghost" size="icon" className="mt-0.5" onClick={() => router.push("/suppliers")}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Supplier workspace</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{supplier.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{[supplier.contact_name, supplier.phone, supplier.email].filter(Boolean).join(" · ") || "Supplier details and settlement history"}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => router.push(`/inventory/purchases/returns?supplier_id=${supplierId}`)}><PackageMinus className="mr-2 h-4 w-4" />Purchase return</Button>
          <Button variant="outline" onClick={() => router.push(`/inventory/purchases?supplier_id=${supplierId}`)}><Plus className="mr-2 h-4 w-4" />Record purchase</Button>
          <Button variant="outline" onClick={openReceipt}><ReceiptText className="mr-2 h-4 w-4" />Receive payment</Button>
          <Button onClick={openPayment}><Banknote className="mr-2 h-4 w-4" />Pay supplier</Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <Card className="h-fit">
          <CardContent className="space-y-5 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-lg font-semibold text-primary">{supplier.name.slice(0, 2).toUpperCase()}</div>
            <div><p className="text-sm font-medium">Current balance</p><p className={payable > 0 ? "mt-1 text-2xl font-semibold text-orange-600" : "mt-1 text-2xl font-semibold"}>{payable > 0 ? `${formatCurrency(payable)} payable` : supplierCredit > 0 ? `${formatCurrency(supplierCredit)} supplier credit` : "Settled"}</p></div>
            <div className="flex items-center justify-between border-t pt-4"><p className="text-sm text-muted-foreground">Status</p><Badge variant={supplier.is_active ? "default" : "secondary"}>{supplier.is_active ? "Active" : "Inactive"}</Badge></div>
            <div className="space-y-3 border-t pt-4 text-sm"><div><p className="text-muted-foreground">Contact</p><p>{supplier.contact_name || "Not recorded"}</p></div><div><p className="text-muted-foreground">Address</p><p>{supplier.address || "Not recorded"}</p></div><div><p className="text-muted-foreground">Notes</p><p>{supplier.notes || "—"}</p></div></div>
          </CardContent>
        </Card>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Metric label="Open purchase bills" value={formatCurrency(payable)} icon={<WalletCards className="h-4 w-4" />} />
            <Metric label="Supplier credit" value={formatCurrency(supplierCredit)} icon={<Landmark className="h-4 w-4" />} />
            <Metric label="Purchases" value={formatCurrency(totalPurchases)} icon={<ClipboardList className="h-4 w-4" />} />
            <Metric label="Purchase returns" value={formatCurrency(totalReturns)} icon={<PackageMinus className="h-4 w-4" />} />
            <Metric label="Payments out" value={formatCurrency(paymentsOut)} icon={<Banknote className="h-4 w-4" />} />
            <Metric label="Money received" value={formatCurrency(moneyReceived)} icon={<ReceiptText className="h-4 w-4" />} />
          </div>
          <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/30 p-1">
            {([ ["activity", "All activity"], ["bills", "Purchase bills"], ["returns", "Purchase returns"], ["payments", "Payments"], ["open", "Open bills"], ["statement", "Statement"] ] as const).map(([value, label]) => <Button key={value} size="sm" variant={tab === value ? "secondary" : "ghost"} onClick={() => setTab(value)}>{label}</Button>)}
            <Button variant="ghost" size="icon" className="ml-auto" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
          </div>
          {tab === "activity" && <ActivityList entries={activity} onOpen={(entry) => setSelectedDetail(partyLedgerEntryDetail(entry, "supplier"))} />}
          {tab === "bills" && <BillList purchases={purchases} openBills={openBills} onOpen={(purchase) => setSelectedDetail(purchaseDocumentDetail(purchase))} />}
          {tab === "returns" && <ReturnList returns={returns} onOpen={(purchaseReturn) => setSelectedDetail(purchaseReturnDetail(purchaseReturn))} />}
          {tab === "payments" && <PaymentList entries={payments} onOpen={(entry) => setSelectedDetail(partyLedgerEntryDetail(entry, "supplier"))} />}
          {tab === "open" && <OpenBillList bills={openBills} onOpen={(entry) => setSelectedDetail(partyLedgerEntryDetail(entry, "supplier"))} onReturn={(purchaseId) => router.push(`/inventory/purchases/returns?purchase_id=${purchaseId}`)} />}
          {tab === "statement" && <StatementWithAllocations entries={activity} allocations={statement?.allocations || []} onOpen={(entry) => setSelectedDetail(partyLedgerEntryDetail(entry, "supplier"))} onOpenAllocation={(allocation) => setSelectedDetail(settlementAllocationDetail(allocation, "supplier"))} />}
        </div>
      </div>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[680px]">
          <DialogHeader><DialogTitle>Pay {supplier.name}</DialogTitle><DialogDescription>Money leaves the selected account once. Bills are applied oldest due first unless you choose exact allocations.</DialogDescription></DialogHeader>
          <div className="space-y-5 py-2">
            <div className="grid gap-4 sm:grid-cols-3"><div className="space-y-2"><Label>Payment amount</Label><Input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></div><div className="space-y-2"><Label>Payment date</Label><Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} /></div><div className="space-y-2"><Label>Reference</Label><Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Receipt or transfer #" /></div></div>
            <CashBankAccountSelect label="Paid from" value={account} onChange={setAccount} />
            <div className="rounded-lg border p-3"><label className="flex cursor-pointer items-center gap-2 text-sm font-medium"><input type="checkbox" checked={manualAllocation} onChange={(e) => setManualAllocation(e.target.checked)} /> Allocate to specific purchase bills</label><p className="mt-1 text-xs text-muted-foreground">Leave this off for FIFO. A smaller allocation leaves the rest as an advance with this supplier.</p></div>
            {!manualAllocation && <FifoPreview lines={fifoPreview} paymentAmount={money(amount)} allocated={fifoAllocated} />}
            {manualAllocation && <div className="space-y-2 rounded-lg border p-3"><div className="flex items-center justify-between"><p className="font-medium">Open purchase bills</p><span className="text-sm text-muted-foreground">Allocated {formatCurrency(manualTotal)}</span></div>{openBills.length === 0 ? <p className="text-sm text-muted-foreground">There are no open purchase bills to allocate.</p> : openBills.map((bill: any) => <div key={bill.id} className="grid grid-cols-[1fr_150px] items-center gap-3 border-t py-2 first:border-t-0"><div><p className="text-sm font-medium">{bill.display_name}</p><p className="text-xs text-muted-foreground">Open {formatCurrency(bill.open_amount)} · {bill.source_reference || "No reference"}</p></div><Input type="number" min="0" max={String(bill.open_amount)} step="0.01" value={allocations[bill.id] || ""} onChange={(e) => setAllocations((current) => ({ ...current, [bill.id]: e.target.value }))} /></div>)}</div>}
            <div className="space-y-2"><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional payment note" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setPayOpen(false)} disabled={paying}>Cancel</Button><Button onClick={submitPayment} disabled={paying}>{paying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Record payment</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader><DialogTitle>Receive payment from {supplier.name}</DialogTitle><DialogDescription>This is not income. The money is posted to the selected account and retained as supplier credit for future purchase bills.</DialogDescription></DialogHeader>
          <div className="space-y-5 py-2">
            <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Amount received</Label><Input type="number" min="0.01" step="0.01" value={receiptAmount} onChange={(e) => setReceiptAmount(e.target.value)} /></div><div className="space-y-2"><Label>Receipt date</Label><Input type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} /></div></div>
            <CashBankAccountSelect label="Received into" value={receiptAccount} onChange={setReceiptAccount} />
            <div className="space-y-2"><Label>Reference</Label><Input value={receiptReference} onChange={(e) => setReceiptReference(e.target.value)} placeholder="Supplier receipt, bank transfer or cheque #" /></div>
            <div className="space-y-2"><Label>Notes</Label><Textarea value={receiptNotes} onChange={(e) => setReceiptNotes(e.target.value)} placeholder="Why the supplier paid this amount" /></div>
            <div className="rounded-lg border bg-muted/30 p-3 text-sm"><p className="font-medium">Booked as supplier credit</p><p className="mt-1 text-muted-foreground">This credit reduces what you owe this supplier on a future bill. It does not increase sales or other income.</p></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setReceiveOpen(false)} disabled={receiving}>Cancel</Button><Button onClick={submitReceipt} disabled={receiving}>{receiving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Record payment in</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <TransactionDetailSheet open={Boolean(selectedDetail)} onOpenChange={(open) => !open && setSelectedDetail(null)} detail={selectedDetail} />
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon: ReactNode }) { return <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div><div className="text-muted-foreground">{icon}</div></CardContent></Card>; }
function supplierActivityPresentation(entry: any) {
  switch (entry.entry_type) {
    case "supplier_bill":
      return { amountLabel: "Purchase bill", amountClass: "text-orange-600" };
    case "supplier_payment":
      return { amountLabel: "Paid", amountClass: "text-emerald-600" };
    case "supplier_payment_received":
      return { amountLabel: "Received", amountClass: "text-emerald-600" };
    case "supplier_credit":
      return { amountLabel: "Supplier credit", amountClass: "text-emerald-600" };
    case "supplier_refund_received":
      return { amountLabel: "Refund received", amountClass: "text-emerald-600" };
    case "supplier_refund_due":
      return { amountLabel: "Refund due", amountClass: "text-amber-600" };
    default:
      return {
        amountLabel: entry.entry_side === "debt" ? "Amount due" : "Supplier credit",
        amountClass: entry.entry_side === "debt" ? "text-orange-600" : "text-emerald-600",
      };
  }
}

function supplierActivityOpenLabel(entry: any) {
  const openAmount = Number(entry.open_amount || 0);
  if (openAmount <= 0.004) return entry.entry_side === "debt" ? "Settled" : "Fully applied";
  return entry.entry_side === "debt"
    ? `Remaining bill ${formatCurrency(openAmount)}`
    : `Available supplier credit ${formatCurrency(openAmount)}`;
}

function ActivityList({ entries, onOpen }: { entries: any[]; onOpen: (entry: any) => void }) {
  return <Card>
    <CardHeader className="pb-3">
      <CardTitle className="text-base">Activity</CardTitle>
      <p className="text-xs text-muted-foreground">Amounts describe what happened, rather than accounting debit and credit signs.</p>
    </CardHeader>
    <CardContent className="space-y-1">
      {entries.length ? entries.map((entry) => {
        const presentation = supplierActivityPresentation(entry);
        return <button type="button" key={entry.id} onClick={() => onOpen(entry)} className="flex w-full items-center justify-between gap-4 rounded-md px-2 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <div>
            <p className="text-sm font-medium">{entry.display_name}</p>
            <p className="text-xs text-muted-foreground">{formatDate(entry.financial_date)} · {entry.source_reference || entry.entry_type.replaceAll("_", " ")}</p>
          </div>
          <div className="text-right">
            <p className={`text-sm font-semibold ${presentation.amountClass}`}>{presentation.amountLabel} {formatCurrency(entry.amount)}</p>
            <p className="text-xs text-muted-foreground">{supplierActivityOpenLabel(entry)}</p>
          </div>
        </button>;
      }) : <Empty text="No supplier activity has been recorded." />}
    </CardContent>
  </Card>;
}
function BillList({ purchases, openBills, onOpen }: { purchases: any[]; openBills: any[]; onOpen: (purchase: any) => void }) { const openBySource = new Map(openBills.map((bill) => [bill.source_id, bill])); return <Card><CardHeader className="pb-3"><CardTitle className="text-base">Purchase bills</CardTitle></CardHeader><CardContent className="space-y-2">{purchases.length ? purchases.map((purchase) => { const bill = openBySource.get(purchase.id); return <button type="button" key={purchase.id} onClick={() => onOpen(purchase)} className="flex w-full items-center justify-between gap-4 rounded-lg border p-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><div><p className="font-medium">{purchase.reference_number || `Purchase #${purchase.id}`}</p><p className="text-xs text-muted-foreground">{formatDate(purchase.purchase_date)} · {purchase.payment_status || "unpaid"}</p></div><div className="text-right"><p className="font-medium">{formatCurrency(purchase.total_cost)}</p><p className="text-xs text-muted-foreground">{bill ? `${formatCurrency(bill.open_amount)} open` : "Settled"}</p></div></button>; }) : <Empty text="No purchases have been recorded for this supplier." />}</CardContent></Card>; }
function ReturnList({ returns, onOpen }: { returns: any[]; onOpen: (purchaseReturn: any) => void }) { return <Card><CardHeader className="pb-3"><CardTitle className="text-base">Purchase returns</CardTitle></CardHeader><CardContent className="space-y-2">{returns.length ? returns.map((entry) => <button type="button" key={entry.id} onClick={() => onOpen(entry)} className="flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><div><p className="font-medium">{entry.return_number || `Purchase return #${entry.id}`}</p><p className="text-xs text-muted-foreground">{formatDate(entry.return_date)} · {String(entry.settlement_type || "").replaceAll("_", " ")}</p></div><p className="font-medium text-emerald-600">{formatCurrency(entry.total_cost)}</p></button>) : <Empty text="No purchase returns have been recorded for this supplier." />}</CardContent></Card>; }
function StatementList({ entries, onOpen }: { entries: any[]; onOpen: (entry: any) => void }) { return <Card><CardHeader className="pb-3"><CardTitle className="text-base">Open-item statement</CardTitle></CardHeader><CardContent className="space-y-2">{entries.length ? entries.map((entry) => <button type="button" key={entry.id} onClick={() => onOpen(entry)} className="grid w-full grid-cols-[1fr_auto_auto] items-center gap-4 rounded-lg border p-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><div><p className="font-medium">{entry.display_name}</p><p className="text-xs text-muted-foreground">{formatDate(entry.financial_date)} · {entry.status}</p></div><Badge variant="outline">{entry.entry_side === "debt" ? "Bill" : "Payment / credit"}</Badge><div className="text-right text-sm"><p>{formatCurrency(entry.amount)}</p><p className="text-muted-foreground">Open {formatCurrency(entry.open_amount)}</p></div></button>) : <Empty text="No statement entries have been recorded." />}</CardContent></Card>; }
function FifoPreview({ lines, paymentAmount, allocated }: { lines: any[]; paymentAmount: number; allocated: number }) {
  const credit = Math.max(paymentAmount - allocated, 0);
  return <div className="rounded-lg border bg-muted/20 p-3"><p className="text-sm font-medium">FIFO allocation preview</p><p className="mt-1 text-xs text-muted-foreground">This is what will be settled when you record the payment.</p><div className="mt-3 space-y-2">{lines.length ? lines.map((line) => <div key={line.id} className="grid grid-cols-[1fr_auto] gap-3 text-sm"><div><p className="font-medium">{line.source_reference || line.display_name}</p><p className="text-xs text-muted-foreground">{formatDate(line.financial_date)} · Remaining {formatCurrency(line.open_amount)}</p></div><p className="font-medium">{formatCurrency(line.allocationAmount)}</p></div>) : <p className="text-sm text-muted-foreground">No open bills will be settled. This becomes a supplier advance.</p>}</div><div className="mt-3 flex items-center justify-between border-t pt-3 text-sm"><span>Unallocated supplier credit</span><span className="font-semibold">{formatCurrency(credit)}</span></div></div>;
}

function PaymentList({ entries, onOpen }: { entries: any[]; onOpen: (entry: any) => void }) { return <Card><CardHeader className="pb-3"><CardTitle className="text-base">Payments in and out</CardTitle></CardHeader><CardContent className="space-y-2">{entries.length ? entries.map((entry) => <button type="button" key={entry.id} onClick={() => onOpen(entry)} className="flex w-full items-center justify-between gap-4 rounded-lg border p-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><div><p className="font-medium">{entry.display_name}</p><p className="text-xs text-muted-foreground">{formatDate(entry.financial_date)} · {entry.payment_method?.replaceAll("_", " ") || "No payment method recorded"}</p></div><div className="text-right"><Badge variant="outline">{entry.entry_type === "supplier_payment" ? "Payment out" : entry.entry_type === "supplier_payment_received" ? "Payment in · credit" : "Refund received"}</Badge><p className="mt-1 font-medium">{formatCurrency(entry.amount)}</p></div></button>) : <Empty text="No supplier payments have been recorded." />}</CardContent></Card>; }

function OpenBillList({ bills, onReturn, onOpen }: { bills: any[]; onReturn: (purchaseId: number) => void; onOpen: (entry: any) => void }) { return <Card><CardHeader className="pb-3"><CardTitle className="text-base">Open bills ready for payment</CardTitle></CardHeader><CardContent className="space-y-2">{bills.length ? bills.map((bill) => <div key={bill.id} role="button" tabIndex={0} onClick={() => onOpen(bill)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onOpen(bill); }} className="flex cursor-pointer flex-col gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{bill.source_reference || bill.display_name}</p><p className="text-xs text-muted-foreground">{formatDate(bill.financial_date)} · Original {formatCurrency(bill.amount)} · Remaining {formatCurrency(bill.open_amount)}</p></div>{bill.source_type === "inventory_purchase" && bill.source_id ? <Button variant="outline" size="sm" onClick={(event) => { event.stopPropagation(); onReturn(bill.source_id); }}>Return items</Button> : null}</div>) : <Empty text="There are no unpaid purchase bills." />}</CardContent></Card>; }

function StatementWithAllocations({ entries, allocations, onOpen, onOpenAllocation }: { entries: any[]; allocations: any[]; onOpen: (entry: any) => void; onOpenAllocation: (allocation: any) => void }) { return <div className="space-y-4"><StatementList entries={entries} onOpen={onOpen} /><Card><CardHeader className="pb-3"><CardTitle className="text-base">Settlement allocations</CardTitle></CardHeader><CardContent className="space-y-2">{allocations.length ? allocations.map((allocation) => <button type="button" key={allocation.id} onClick={() => onOpenAllocation(allocation)} className="grid w-full gap-2 rounded-lg border p-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[1fr_auto_1fr_auto] sm:items-center"><div><p className="text-sm font-medium">{allocation.source_reference || allocation.source_display_name || "Supplier payment"}</p><p className="text-xs text-muted-foreground">Payment / credit</p></div><span className="text-center text-muted-foreground">applied to</span><div><p className="text-sm font-medium">{allocation.target_reference || allocation.target_display_name || "Purchase bill"}</p><p className="text-xs text-muted-foreground">{formatDate(allocation.financial_date)}</p></div><p className="text-right font-semibold">{formatCurrency(allocation.amount)}</p></button>) : <Empty text="No payment allocations have been recorded." />}</CardContent></Card></div>; }

function Empty({ text }: { text: string }) { return <div className="py-10 text-center text-sm text-muted-foreground"><History className="mx-auto mb-2 h-5 w-5" />{text}</div>; }
