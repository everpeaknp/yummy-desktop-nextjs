"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { CashBankAccountSelect, type CashBankAccountOption } from "@/components/finance/cash-bank-account-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { financeSalesApi } from "@/lib/api/finance-sales-api";

type ExistingPayment = { id: number; method: string; amount: number; reference?: string | null; status: string };
type ReplacementRow = { key: string; amount: string; account: CashBankAccountOption | null; reference: string };
const row = (amount = ""): ReplacementRow => ({ key: crypto.randomUUID(), amount, account: null, reference: "" });
const cents = (value: number | string) => Math.round(Number(value || 0) * 100);

export function CompletedSettlementCorrectionDialog({
  open,
  onOpenChange,
  orderId,
  total,
  payments,
  onCorrected,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: number;
  total: number;
  payments: ExistingPayment[];
  onCorrected: () => void | Promise<void>;
}) {
  const [rows, setRows] = useState<ReplacementRow[]>([row(String(total || ""))]);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setRows([row(Number(total).toFixed(2))]); setReason(""); } }, [open, total]);
  const allocated = useMemo(() => rows.reduce((sum, item) => sum + cents(item.amount), 0), [rows]);
  const target = cents(total);
  const balanced = allocated === target;

  const submit = async () => {
    if (!reason.trim() || reason.trim().length < 3) { toast.error("Enter why this completed settlement is being corrected."); return; }
    if (!balanced || rows.some((item) => !item.account || cents(item.amount) <= 0)) { toast.error("Replacement lines must use valid accounts and exactly equal the order total."); return; }
    setSaving(true);
    try {
      await financeSalesApi.replaceOrderSettlement(orderId, {
        reason: reason.trim(),
        idempotency_key: `web-order-settlement:${orderId}:${crypto.randomUUID()}`,
        payments: rows.map((item) => ({
          method: item.account!.account_type === "drawer" ? "cash" : "bank_transfer",
          amount: Number(item.amount),
          account_type: item.account!.account_type,
          account_id: item.account!.id,
          reference: item.reference.trim() || null,
          instrument: null,
        })),
      });
      toast.success("Completed settlement corrected without changing the order total.");
      onOpenChange(false);
      await onCorrected();
    } catch (error: any) { toast.error(error.response?.data?.detail || "Could not correct settlement."); }
    finally { setSaving(false); }
  };

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>Correct completed settlement</DialogTitle><DialogDescription>Replace the entire payment allocation. The order stays completed and its total cannot change.</DialogDescription></DialogHeader>
    <div className="rounded-lg border bg-muted/20 p-3 text-sm"><p className="font-medium">Current settlement</p>{payments.filter((payment) => payment.status === "success" && Number(payment.amount) > 0).map((payment) => <div key={payment.id} className="mt-2 flex justify-between text-muted-foreground"><span className="capitalize">{payment.method.replaceAll("_", " ")}</span><span>NPR {Number(payment.amount).toLocaleString()}</span></div>)}</div>
    <div className="space-y-3"><Label>Replacement allocation</Label>{rows.map((item, index) => <div key={item.key} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_130px_40px]"><CashBankAccountSelect value={item.account} onChange={(account) => setRows((current) => current.map((candidate) => candidate.key === item.key ? { ...candidate, account } : candidate))} label={index === 0 ? "Receive account" : "Additional account"} /><div className="space-y-2"><Label>Amount</Label><Input type="number" min="0.01" step="0.01" value={item.amount} onChange={(event) => setRows((current) => current.map((candidate) => candidate.key === item.key ? { ...candidate, amount: event.target.value } : candidate))} /></div><Button className="mt-7" variant="ghost" size="icon" disabled={rows.length === 1} onClick={() => setRows((current) => current.filter((candidate) => candidate.key !== item.key))}><Trash2 className="h-4 w-4" /></Button></div>)}<Button variant="outline" className="w-fit" onClick={() => setRows((current) => [...current, row()])}><Plus className="mr-2 h-4 w-4" />Split to another account</Button></div>
    <div className={`flex justify-between rounded-lg border p-3 text-sm font-medium ${balanced ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-amber-300 bg-amber-50 text-amber-700"}`}><span>{balanced ? "Fully allocated" : "Difference"}</span><span>NPR {(Math.abs(target - allocated) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
    <div className="space-y-2"><Label>Correction reason *</Label><Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="For example: payment was recorded as cash but received by bank transfer" /></div>
    <p className="text-xs text-muted-foreground">This creates an audit revision and custody transfers. It never deletes the completed payment history or reopens the order.</p>
    <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={saving || !balanced} onClick={() => void submit()}>{saving ? "Correcting..." : "Save correction"}</Button></DialogFooter>
  </DialogContent></Dialog>;
}
