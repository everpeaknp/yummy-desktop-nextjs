"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, RefreshCw, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { FinanceSalesReturnDialog } from "@/components/finance/sales/finance-sales-return-dialog";
import { FinanceWorkspaceNav } from "@/components/finance/workspace/finance-workspace-nav";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { financeSalesApi } from "@/lib/api/finance-sales-api";
import type { FinanceSalesDocument } from "@/types/finance-sales";

const formatMoney = (value: number | string) => `NPR ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function FinanceSalesReturnsWorkspace() {
  const searchParams = useSearchParams();
  const restaurantId = useAuth((state) => state.user?.restaurant_id);
  const invoiceId = Number(searchParams.get("invoice_id") || 0) || null;
  const orderId = Number(searchParams.get("order_id") || 0) || null;
  const [documents, setDocuments] = useState<FinanceSalesDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(Boolean(invoiceId || orderId));

  const load = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const result = await financeSalesApi.list(Number(restaurantId), { kind: "credit_note", limit: 200 });
      setDocuments(result.documents);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Could not load sales returns.");
    } finally { setLoading(false); }
  }, [restaurantId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (invoiceId || orderId) setDialogOpen(true); }, [invoiceId, orderId]);

  return <div className="mx-auto w-full max-w-[1500px] space-y-6 p-4 md:p-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Sales &amp; receivables</p><h1 className="text-2xl font-semibold">Sales returns</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Credit notes linked to POS orders, finance invoices, or verified external sales. Returns preserve the original sale and create an auditable reversal.</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button><Button onClick={() => setDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />New sales return</Button></div></div>
    <FinanceWorkspaceNav links={[{ label: "Sales invoices", href: "/finance/sales" }, { label: "Sales returns", href: "/finance/sales/returns" }]} action={{ label: "View refund report", href: "/finance/reports/refunds" }} />
    <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-lg border p-4"><p className="text-xs font-medium uppercase text-muted-foreground">Credit notes</p><p className="mt-2 text-2xl font-semibold">{documents.length}</p></div><div className="rounded-lg border p-4"><p className="text-xs font-medium uppercase text-muted-foreground">Returned value</p><p className="mt-2 text-2xl font-semibold">{formatMoney(documents.reduce((sum, item) => sum + Number(item.grand_total || 0), 0))}</p></div><div className="rounded-lg border p-4"><p className="text-xs font-medium uppercase text-muted-foreground">Customer credit</p><p className="mt-2 text-2xl font-semibold text-amber-600">{formatMoney(documents.filter((item) => item.settlement_status === "customer_credit").reduce((sum, item) => sum + Number(item.grand_total || 0), 0))}</p></div></div>
    <div className="overflow-hidden rounded-lg border"><div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3"><div><h2 className="font-medium">Credit-note register</h2><p className="text-xs text-muted-foreground">The source sale remains unchanged.</p></div><RotateCcw className="h-5 w-5 text-muted-foreground" /></div>{documents.length ? <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-sm"><thead className="bg-muted/40 text-left text-muted-foreground"><tr><th className="p-3">Date</th><th className="p-3">Credit note</th><th className="p-3">Source</th><th className="p-3">Reason</th><th className="p-3">Outcome</th><th className="p-3 text-right">Total</th></tr></thead><tbody>{documents.map((document) => <tr key={document.id} className="border-t"><td className="p-3">{document.business_date}</td><td className="p-3 font-medium">{document.document_number}</td><td className="p-3 capitalize">{document.source_type.replaceAll("_", " ")}{document.source_id ? ` #${document.source_id}` : ""}</td><td className="max-w-72 truncate p-3 text-muted-foreground">{document.reason || "—"}</td><td className="p-3"><span className="rounded-full bg-muted px-2 py-1 text-xs capitalize">{document.settlement_status.replaceAll("_", " ")}</span></td><td className="p-3 text-right font-medium">{formatMoney(document.grand_total)}</td></tr>)}</tbody></table></div> : <div className="p-12 text-center"><p className="font-medium">No sales returns recorded.</p><p className="mt-1 text-sm text-muted-foreground">Refunding a completed order through this workflow creates its credit note automatically.</p></div>}</div>
    <FinanceSalesReturnDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={() => void load()} initialInvoiceId={invoiceId} initialOrderId={orderId} />
  </div>;
}
