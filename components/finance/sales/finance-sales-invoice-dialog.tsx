"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  CashBankAccountSelect,
  type CashBankAccountOption,
} from "@/components/finance/cash-bank-account-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import apiClient from "@/lib/api-client";
import { CustomerApis } from "@/lib/api/endpoints";
import { financeReportingApi } from "@/lib/api/finance-reporting-api";
import { financeSalesApi } from "@/lib/api/finance-sales-api";
import type { FinanceReportingHeadRead } from "@/types/finance-reporting";
import type { FinanceSalesDocument, FinanceSalesInvoiceLineInput } from "@/types/finance-sales";

type CustomerOption = { id: number; name?: string; full_name?: string; phone?: string };
type DraftLine = FinanceSalesInvoiceLineInput & { key: string };

const today = () => new Date().toISOString().slice(0, 10);
const newLine = (): DraftLine => ({
  key: crypto.randomUUID(),
  item_name: "",
  quantity: 1,
  unit_price: 0,
  discount_amount: 0,
  tax_amount: 0,
  reporting_head_id: null,
  description: "",
});
const money = (value: number) => Math.round(value * 100) / 100;

export function FinanceSalesInvoiceDialog({
  open,
  onOpenChange,
  onCreated,
  initialCustomerId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (document: FinanceSalesDocument) => void;
  initialCustomerId?: number | null;
}) {
  const restaurantId = useAuth((state) => state.user?.restaurant_id);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [heads, setHeads] = useState<FinanceReportingHeadRead[]>([]);
  const [businessLine, setBusinessLine] = useState<"restaurant" | "hotel">("restaurant");
  const [businessDate, setBusinessDate] = useState(today());
  const [customerId, setCustomerId] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [paid, setPaid] = useState(true);
  const [account, setAccount] = useState<CashBankAccountOption | null>(null);
  const [lines, setLines] = useState<DraftLine[]>([newLine()]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !restaurantId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      apiClient.get(CustomerApis.listCustomers(Number(restaurantId))),
      financeReportingApi.getEligibleLeaves(Number(restaurantId), {
        head_type: "income",
        business_line: businessLine,
      }),
    ])
      .then(([customerResponse, eligibleHeads]) => {
        if (cancelled) return;
        setCustomers(customerResponse.data?.data?.customers || []);
        setHeads(eligibleHeads);
        setLines((current) => current.map((line) => ({
          ...line,
          reporting_head_id: line.reporting_head_id || eligibleHeads[0]?.id || null,
        })));
      })
      .catch((error) => {
        if (!cancelled) toast.error(error.response?.data?.detail || "Could not load sales invoice options.");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [businessLine, open, restaurantId]);

  useEffect(() => {
    if (!open) return;
    setCustomerId(initialCustomerId ? String(initialCustomerId) : "");
  }, [initialCustomerId, open]);

  const total = useMemo(
    () => money(lines.reduce((sum, line) => sum + Math.max(0, Number(line.quantity || 0)) * Math.max(0, Number(line.unit_price || 0)) - Math.max(0, Number(line.discount_amount || 0)) + Math.max(0, Number(line.tax_amount || 0)), 0)),
    [lines],
  );

  const updateLine = (key: string, patch: Partial<DraftLine>) => {
    setLines((current) => current.map((line) => line.key === key ? { ...line, ...patch } : line));
  };

  const reset = () => {
    setBusinessDate(today());
    setCustomerId("");
    setReference("");
    setNotes("");
    setPaid(true);
    setAccount(null);
    setLines([newLine()]);
  };

  const submit = async () => {
    if (!restaurantId) return;
    if (!lines.length || lines.some((line) => !line.item_name.trim() || Number(line.quantity) <= 0 || Number(line.unit_price) <= 0 || !line.reporting_head_id)) {
      toast.error("Complete every item and choose a sales account head.");
      return;
    }
    if (total <= 0) {
      toast.error("Invoice total must be greater than zero.");
      return;
    }
    if (!paid && !customerId) {
      toast.error("A customer is required for an unpaid invoice.");
      return;
    }
    if (paid && !account) {
      toast.error("Choose where the payment was received.");
      return;
    }
    setSaving(true);
    try {
      const document = await financeSalesApi.createInvoice({
        restaurant_id: Number(restaurantId),
        business_line: businessLine,
        business_date: businessDate,
        customer_id: customerId ? Number(customerId) : null,
        external_reference: reference.trim() || null,
        notes: notes.trim() || null,
        idempotency_key: `web-finance-invoice:${crypto.randomUUID()}`,
        lines: lines.map(({ key: _key, ...line }) => ({
          ...line,
          item_name: line.item_name.trim(),
          quantity: Number(line.quantity),
          unit_price: money(Number(line.unit_price)),
          discount_amount: money(Number(line.discount_amount || 0)),
          tax_amount: money(Number(line.tax_amount || 0)),
          description: line.description?.trim() || null,
        })),
        settlement: paid && account ? {
          account_type: account.account_type,
          account_id: account.id,
          reference: reference.trim() || null,
        } : null,
      });
      toast.success(`Sales invoice ${document.document_number} recorded.`);
      onCreated?.(document);
      onOpenChange(false);
      reset();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Could not record sales invoice.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record sales invoice</DialogTitle>
          <p className="text-sm text-muted-foreground">A finance-only sale. It records revenue and settlement without creating an order or printing a KOT.</p>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2 md:col-span-2">
            <Label>Customer {!paid ? "*" : "(optional)"}</Label>
            <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
              <option value="">Walk-in / no customer</option>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.full_name || customer.name || `Customer #${customer.id}`}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Business</Label>
            <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={businessLine} onChange={(event) => setBusinessLine(event.target.value as "restaurant" | "hotel")}>
              <option value="restaurant">Restaurant</option><option value="hotel">Hotel</option>
            </select>
          </div>
          <div className="space-y-2"><Label>Date *</Label><Input type="date" value={businessDate} onChange={(event) => setBusinessDate(event.target.value)} /></div>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-muted/60 text-left"><tr><th className="p-3">Item / service</th><th className="p-3">Qty</th><th className="p-3">Rate</th><th className="p-3">Discount</th><th className="p-3">Tax</th><th className="p-3">Sales head</th><th className="p-3 text-right">Amount</th><th /></tr></thead>
            <tbody>{lines.map((line) => {
              const lineTotal = money(Number(line.quantity || 0) * Number(line.unit_price || 0) - Number(line.discount_amount || 0) + Number(line.tax_amount || 0));
              return <tr key={line.key} className="border-t align-top">
                <td className="p-2"><Input value={line.item_name} placeholder="Item or service name" onChange={(event) => updateLine(line.key, { item_name: event.target.value })} /></td>
                <td className="p-2"><Input className="w-24" type="number" min="0.001" step="0.001" value={line.quantity} onChange={(event) => updateLine(line.key, { quantity: Number(event.target.value) })} /></td>
                <td className="p-2"><Input className="w-28" type="number" min="0" step="0.01" value={line.unit_price} onChange={(event) => updateLine(line.key, { unit_price: Number(event.target.value) })} /></td>
                <td className="p-2"><Input className="w-28" type="number" min="0" step="0.01" value={line.discount_amount} onChange={(event) => updateLine(line.key, { discount_amount: Number(event.target.value) })} /></td>
                <td className="p-2"><Input className="w-28" type="number" min="0" step="0.01" value={line.tax_amount} onChange={(event) => updateLine(line.key, { tax_amount: Number(event.target.value) })} /></td>
                <td className="p-2"><select className="h-10 min-w-52 rounded-md border border-input bg-background px-2" value={line.reporting_head_id || ""} onChange={(event) => updateLine(line.key, { reporting_head_id: Number(event.target.value) })}><option value="">Select head</option>{heads.map((head) => <option key={head.id} value={head.id}>{head.hierarchy_path || head.name}</option>)}</select></td>
                <td className="p-3 text-right font-medium">NPR {lineTotal.toLocaleString()}</td>
                <td className="p-2"><Button type="button" variant="ghost" size="icon" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}><Trash2 className="h-4 w-4" /></Button></td>
              </tr>;
            })}</tbody>
          </table>
        </div>
        <Button type="button" variant="outline" className="w-fit" onClick={() => setLines((current) => [...current, { ...newLine(), reporting_head_id: heads[0]?.id || null }])}><Plus className="mr-2 h-4 w-4" />Add line</Button>

        <div className="grid gap-5 rounded-lg border p-4 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            <div className="space-y-2"><Label>Reference</Label><Input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Optional invoice or receipt reference" /></div>
            <div className="space-y-2"><Label>Notes</Label><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional details" /></div>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 rounded-lg bg-muted p-1"><Button type="button" variant={paid ? "default" : "ghost"} onClick={() => setPaid(true)}>Paid now</Button><Button type="button" variant={!paid ? "default" : "ghost"} onClick={() => setPaid(false)}>Unpaid / credit</Button></div>
            {paid ? <CashBankAccountSelect value={account} onChange={setAccount} businessLine={businessLine} label="Receive into *" /> : <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">The invoice becomes customer receivable. Record the collection later from the customer payment workflow.</p>}
            <div className="flex items-center justify-between border-t pt-4 text-lg font-semibold"><span>Invoice total</span><span>NPR {total.toLocaleString()}</span></div>
          </div>
        </div>

        <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={saving || loading} onClick={submit}>{saving ? "Recording..." : "Record invoice"}</Button></div>
      </DialogContent>
    </Dialog>
  );
}
