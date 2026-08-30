"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { CashBankAccountSelect, type CashBankAccountOption } from "@/components/finance/cash-bank-account-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import apiClient from "@/lib/api-client";
import { CustomerApis, OrderApis } from "@/lib/api/endpoints";
import { financeReportingApi } from "@/lib/api/finance-reporting-api";
import { financeSalesApi } from "@/lib/api/finance-sales-api";
import type { FinanceReportingHeadRead } from "@/types/finance-reporting";
import type { FinanceSalesDocument, FinanceSalesReturnLineInput, FinanceSalesReturnSource } from "@/types/finance-sales";

type SourceRow = FinanceSalesReturnLineInput & {
  key: string;
  available: number;
  label: string;
  amount: number;
};
type CustomerOption = { id: number; name?: string; full_name?: string };

const today = () => new Date().toISOString().slice(0, 10);
const manualRow = (): SourceRow => ({
  key: crypto.randomUUID(), label: "", item_name: "", quantity: 1,
  unit_price: 0, tax_amount: 0, reporting_head_id: null,
  available: 999999, amount: 0,
});

export function FinanceSalesReturnDialog({
  open, onOpenChange, onCreated, initialInvoiceId, initialOrderId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
  initialInvoiceId?: number | null;
  initialOrderId?: number | null;
}) {
  const restaurantId = useAuth((state) => state.user?.restaurant_id);
  const [sourceType, setSourceType] = useState<FinanceSalesReturnSource>("finance_invoice");
  const [invoices, setInvoices] = useState<FinanceSalesDocument[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [heads, setHeads] = useState<FinanceReportingHeadRead[]>([]);
  const [sourceId, setSourceId] = useState(initialInvoiceId ? String(initialInvoiceId) : "");
  const [order, setOrder] = useState<any>(null);
  const [rows, setRows] = useState<SourceRow[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [businessDate, setBusinessDate] = useState(today());
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [outcome, setOutcome] = useState<"refund_now" | "customer_credit">("refund_now");
  const [account, setAccount] = useState<CashBankAccountOption | null>(null);
  const [originalPaymentId, setOriginalPaymentId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !restaurantId) return;
    Promise.all([
      financeSalesApi.list(Number(restaurantId), { kind: "invoice", limit: 200 }),
      apiClient.get(CustomerApis.listCustomers(Number(restaurantId))),
      financeReportingApi.getEligibleLeaves(Number(restaurantId), { head_type: "income" }),
      initialOrderId
        ? financeSalesApi.getByOrder(Number(restaurantId), initialOrderId)
        : Promise.resolve(null),
    ]).then(([invoiceResult, customerResult, eligibleHeads, initialPosInvoice]) => {
      const availableInvoices = initialPosInvoice
        && !invoiceResult.documents.some((item) => item.id === initialPosInvoice.id)
        ? [initialPosInvoice, ...invoiceResult.documents]
        : invoiceResult.documents;
      setInvoices(availableInvoices);
      setCustomers(customerResult.data?.data?.customers || []);
      setHeads(eligibleHeads);
      if (initialPosInvoice) setSourceId(String(initialPosInvoice.id));
    }).catch((error) => {
      toast.error(error.response?.data?.detail || "Could not load return options.");
    });
  }, [initialOrderId, open, restaurantId]);

  useEffect(() => {
    if (!open) return;
    setSourceType("finance_invoice");
    if (initialInvoiceId) setSourceId(String(initialInvoiceId));
  }, [initialInvoiceId, open]);

  useEffect(() => {
    if (!open || sourceType !== "finance_invoice" || !sourceId || !invoices.length) return;
    const invoice = invoices.find((item) => item.id === Number(sourceId));
    if (!invoice) return;

    setRows(invoice.lines.map((line) => ({
      key: `invoice:${line.id}`,
      source_line_id: line.id,
      quantity: 0,
      available: Number(line.quantity),
      label: line.item_name,
      amount: Number(line.line_total),
      reporting_head_id: line.reporting_head_id,
    })));
    setCustomerId(invoice.customer_id ? String(invoice.customer_id) : "");

    if (invoice.source_type === "pos_order" && invoice.source_id) {
      apiClient.get(OrderApis.getOrder(Number(invoice.source_id))).then((response) => {
        const loaded = response.data?.data || response.data;
        setOrder(loaded);
        const successful = (loaded.payments || []).filter(
          (payment: any) => String(payment.status).toLowerCase() === "success" && Number(payment.amount) > 0,
        );
        setOriginalPaymentId(successful[0]?.id ? String(successful[0].id) : "");
      }).catch((error) => toast.error(error.response?.data?.detail || "Could not load the original settlement."));
    } else {
      setOrder(null);
      setOriginalPaymentId("");
    }
  }, [invoices, open, sourceId, sourceType]);

  const selectedInvoice = invoices.find((invoice) => invoice.id === Number(sourceId)) || null;
  const isPosInvoice = selectedInvoice?.source_type === "pos_order";
  const successfulPayments = (order?.payments || []).filter(
    (payment: any) => String(payment.status).toLowerCase() === "success" && Number(payment.amount) > 0,
  );
  const selectedRows = rows.filter((row) => Number(row.quantity) > 0);
  const estimatedTotal = useMemo(() => selectedRows.reduce((sum, row) => {
    if (sourceType === "external") {
      return sum + Number(row.quantity) * Number(row.unit_price || 0) + Number(row.tax_amount || 0);
    }
    return sum + (row.available ? row.amount * Number(row.quantity) / row.available : 0);
  }, 0), [selectedRows, sourceType]);

  const updateRow = (key: string, patch: Partial<SourceRow>) => {
    setRows((current) => current.map((row) => row.key === key ? { ...row, ...patch } : row));
  };

  const submit = async () => {
    if (!restaurantId || !reason.trim()) { toast.error("A return reason is required."); return; }
    if (sourceType === "finance_invoice" && !sourceId) { toast.error("Select an invoice."); return; }
    if (!selectedRows.length) { toast.error("Enter a return quantity for at least one item."); return; }
    if (selectedRows.some((row) => Number(row.quantity) > row.available)) { toast.error("Return quantity cannot exceed the sold quantity."); return; }
    if (sourceType === "external" && (!reference.trim() || selectedRows.some((row) => !row.item_name?.trim() || Number(row.unit_price) <= 0 || !row.reporting_head_id))) {
      toast.error("External returns require a reference, item, positive rate, and sales head."); return;
    }
    if (outcome === "refund_now" && !account) { toast.error("Choose the account that pays the refund."); return; }
    if (outcome === "customer_credit" && !customerId) { toast.error("Customer credit requires a customer."); return; }

    setSaving(true);
    try {
      await financeSalesApi.createReturn({
        restaurant_id: Number(restaurantId), business_line: "restaurant",
        business_date: businessDate, source_type: sourceType,
        source_id: sourceType === "external" ? null : Number(sourceId),
        customer_id: customerId ? Number(customerId) : null,
        external_reference: reference.trim() || null, reason: reason.trim(),
        idempotency_key: `web-sales-return:${crypto.randomUUID()}`,
        lines: selectedRows.map(({ key: _key, available: _available, label: _label, amount: _amount, ...line }) => ({
          ...line, quantity: Number(line.quantity),
          unit_price: line.unit_price == null ? null : Number(line.unit_price),
          tax_amount: line.tax_amount == null ? null : Number(line.tax_amount),
        })),
        outcome,
        settlement: outcome === "refund_now" && account
          ? { account_type: account.account_type, account_id: account.id, reference: reference.trim() || null }
          : null,
        original_payment_id: isPosInvoice && originalPaymentId ? Number(originalPaymentId) : null,
      });
      toast.success("Sales return and credit note recorded.");
      onOpenChange(false);
      onCreated?.();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Could not record sales return.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record sales return / credit note</DialogTitle>
          <p className="text-sm text-muted-foreground">Select the invoice customers recognize. POS and manual sales share this register; internal order IDs stay hidden.</p>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Return source</Label>
            <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={sourceType} onChange={(event) => {
              const value = event.target.value as FinanceSalesReturnSource;
              setSourceType(value); setSourceId(""); setOrder(null);
              setRows(value === "external" ? [manualRow()] : []);
            }}>
              <option value="finance_invoice">Recorded invoice</option>
              <option value="external">Sale not recorded here</option>
            </select>
          </div>
          {sourceType === "finance_invoice" ? (
            <div className="space-y-2 md:col-span-2">
              <Label>Invoice *</Label>
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={sourceId} onChange={(event) => setSourceId(event.target.value)}>
                <option value="">Select by invoice number</option>
                {invoices.map((invoice) => (
                  <option key={invoice.id} value={invoice.id}>
                    {invoice.document_number}{invoice.daily_order_number ? ` · Daily order #${invoice.daily_order_number}` : ""} · {invoice.source_type === "pos_order" ? "POS" : "Manual"} · NPR {Number(invoice.grand_total).toLocaleString()}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <>
              <div className="space-y-2"><Label>External reference *</Label><Input value={reference} onChange={(event) => setReference(event.target.value)} /></div>
              <div className="space-y-2"><Label>Date *</Label><Input type="date" value={businessDate} onChange={(event) => setBusinessDate(event.target.value)} /></div>
            </>
          )}
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/50 text-left"><tr><th className="p-3">Item</th><th className="p-3">Sold / available</th><th className="p-3">Return qty</th>{sourceType === "external" ? <><th className="p-3">Rate</th><th className="p-3">Tax</th><th className="p-3">Sales head</th></> : null}<th /></tr></thead>
            <tbody>{rows.map((row) => (
              <tr key={row.key} className="border-t">
                <td className="p-2">{sourceType === "external" ? <Input value={row.item_name || ""} onChange={(event) => updateRow(row.key, { item_name: event.target.value, label: event.target.value })} placeholder="Returned item" /> : <span className="font-medium">{row.label}</span>}</td>
                <td className="p-3 text-muted-foreground">{sourceType === "external" ? "—" : row.available}</td>
                <td className="p-2"><Input className="w-28" type="number" min="0" max={row.available} step="0.001" value={row.quantity} onChange={(event) => updateRow(row.key, { quantity: Number(event.target.value) })} /></td>
                {sourceType === "external" ? <>
                  <td className="p-2"><Input className="w-28" type="number" min="0" step="0.01" value={row.unit_price || 0} onChange={(event) => updateRow(row.key, { unit_price: Number(event.target.value) })} /></td>
                  <td className="p-2"><Input className="w-28" type="number" min="0" step="0.01" value={row.tax_amount || 0} onChange={(event) => updateRow(row.key, { tax_amount: Number(event.target.value) })} /></td>
                  <td className="p-2"><select className="h-10 min-w-48 rounded-md border bg-background px-2" value={row.reporting_head_id || ""} onChange={(event) => updateRow(row.key, { reporting_head_id: Number(event.target.value) })}><option value="">Select head</option>{heads.map((head) => <option key={head.id} value={head.id}>{head.hierarchy_path || head.name}</option>)}</select></td>
                  <td className="p-2"><Button variant="ghost" size="icon" disabled={rows.length === 1} onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}><Trash2 className="h-4 w-4" /></Button></td>
                </> : <td />}
              </tr>
            ))}</tbody>
          </table>
        </div>
        {sourceType === "external" ? <Button variant="outline" className="w-fit" onClick={() => setRows((current) => [...current, { ...manualRow(), reporting_head_id: heads[0]?.id || null }])}><Plus className="mr-2 h-4 w-4" />Add line</Button> : null}

        <div className="grid gap-5 rounded-lg border p-4 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            <div className="space-y-2"><Label>Customer {outcome === "customer_credit" ? "*" : "(optional)"}</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">No customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.full_name || customer.name || `Customer #${customer.id}`}</option>)}</select></div>
            <div className="space-y-2"><Label>Reason *</Label><Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why are these items being returned?" /></div>
            {isPosInvoice && successfulPayments.length ? <div className="space-y-2"><Label>Original payment to reverse</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={originalPaymentId} onChange={(event) => setOriginalPaymentId(event.target.value)}>{successfulPayments.map((payment: any) => <option key={payment.id} value={payment.id}>{String(payment.method).replaceAll("_", " ")} · NPR {Number(payment.amount).toLocaleString()}</option>)}</select></div> : null}
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 rounded-lg bg-muted p-1"><Button variant={outcome === "refund_now" ? "default" : "ghost"} onClick={() => setOutcome("refund_now")}>Refund now</Button><Button variant={outcome === "customer_credit" ? "default" : "ghost"} disabled={isPosInvoice} onClick={() => setOutcome("customer_credit")}>Customer credit</Button></div>
            {outcome === "refund_now" ? <CashBankAccountSelect value={account} onChange={setAccount} label="Refund from *" /> : <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">No money leaves now. The amount remains available as customer credit.</p>}
            <div className="flex justify-between border-t pt-4 font-semibold"><span>Estimated return</span><span>NPR {estimatedTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
          </div>
        </div>
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={saving} onClick={() => void submit()}>{saving ? "Recording..." : "Record credit note"}</Button></div>
      </DialogContent>
    </Dialog>
  );
}
