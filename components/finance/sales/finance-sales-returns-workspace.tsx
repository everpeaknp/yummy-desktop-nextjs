"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { FinanceSalesReturnDialog } from "@/components/finance/sales/finance-sales-return-dialog";
import {
  originalSaleLabel,
  salesReturnDetail,
} from "@/components/finance/transaction-detail/sales-return-detail";
import { TransactionDetailSheet } from "@/components/finance/transaction-detail/transaction-detail-sheet";
import { FinanceWorkspaceNav } from "@/components/finance/workspace/finance-workspace-nav";
import { MetricCard } from "@/components/cards/metric-card";
import { AppPage } from "@/components/patterns/page/app-page";
import { PageHeader } from "@/components/patterns/page/page-header";
import { DataList, ListRow } from "@/components/patterns/data/data-list";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { financeSalesApi } from "@/lib/api/finance-sales-api";
import type { FinanceSalesDocument } from "@/types/finance-sales";

const formatMoney = (value: number | string) =>
  `NPR ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export function FinanceSalesReturnsWorkspace() {
  const searchParams = useSearchParams();
  const restaurantId = useAuth((state) => state.user?.restaurant_id);
  const invoiceId = Number(searchParams.get("invoice_id") || 0) || null;
  const orderId = Number(searchParams.get("order_id") || 0) || null;
  const [documents, setDocuments] = useState<FinanceSalesDocument[]>([]);
  const [salesDocuments, setSalesDocuments] = useState<FinanceSalesDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(Boolean(invoiceId || orderId));
  const [selectedDocument, setSelectedDocument] =
    useState<FinanceSalesDocument | null>(null);

  const load = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const [returnsResult, salesResult] = await Promise.all([
        financeSalesApi.list(Number(restaurantId), { kind: "credit_note", limit: 200 }),
        financeSalesApi.list(Number(restaurantId), { kind: "invoice", limit: 200 }),
      ]);
      setDocuments(returnsResult.documents);
      setSalesDocuments(salesResult.documents);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Could not load sales returns.");
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (invoiceId || orderId) setDialogOpen(true);
  }, [invoiceId, orderId]);
  const salesById = useMemo(
    () => new Map(salesDocuments.map((document) => [document.id, document])),
    [salesDocuments],
  );

  return (
    <AppPage width="wide" density="compact">
      <PageHeader
        title="Sales returns"
        description="Record a return against a completed sale."
        meta="Sales & receivables"
        actions={<Button onClick={() => setDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />New sales return</Button>}
      />

      <FinanceWorkspaceNav
        links={[
          { label: "Sales", href: "/finance/sales" },
          { label: "Sales returns", href: "/finance/sales/returns" },
        ]}
        action={{ label: "View refund report", href: "/finance/reports/refunds" }}
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        <MetricCard label="Credit notes" value={documents.length.toString()} />
        <MetricCard
          label="Returned value"
          value={formatMoney(documents.reduce((sum, item) => sum + Number(item.grand_total || 0), 0))}
        />
        <MetricCard
          className="col-span-2 sm:col-span-1"
          label="Customer credit"
          tone="warning"
          value={formatMoney(documents.filter((item) => item.settlement_status === "customer_credit").reduce((sum, item) => sum + Number(item.grand_total || 0), 0))}
        />
      </div>

      <div className="overflow-hidden rounded-lg border">
        <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
          <div>
            <h2 className="font-medium">Credit-note register</h2>
            <p className="text-xs text-muted-foreground">
              Select a credit note to see its returned items, settlement, and source sale.
            </p>
          </div>
          <RotateCcw className="h-5 w-5 text-muted-foreground" />
        </div>
        {documents.length ? (
          <>
          <DataList className="rounded-none border-x-0 border-y-0 md:hidden">
            {documents.map((document) => (
              <ListRow
                key={document.id}
                leading={<RotateCcw className="h-4 w-4" />}
                title={document.document_number}
                description={`${document.business_date} · ${originalSaleLabel(document, salesById.get(document.original_document_id || 0))}`}
                meta={<span className="font-semibold tabular-nums">{formatMoney(document.grand_total)}</span>}
                trailing={<span className="max-w-24 truncate rounded-full bg-muted px-2 py-1 text-xs capitalize">{document.settlement_status.replaceAll("_", " ")}</span>}
                interactive
                role="button"
                tabIndex={0}
                onClick={() => setSelectedDocument(document)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedDocument(document);
                  }
                }}
              />
            ))}
          </DataList>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[850px] text-sm">
              <thead className="bg-muted/40 text-left text-muted-foreground">
                <tr>
                  <th className="p-3">Date</th><th className="p-3">Credit note</th><th className="p-3">Original sale</th><th className="p-3">Reason</th><th className="p-3">Outcome</th><th className="p-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((document) => (
                  <tr
                    key={document.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedDocument(document)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedDocument(document);
                      }
                    }}
                    className="cursor-pointer border-t transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
                  >
                    <td className="p-3">{document.business_date}</td>
                    <td className="p-3 font-medium">{document.document_number}</td>
                    <td className="p-3">{originalSaleLabel(document, salesById.get(document.original_document_id || 0))}</td>
                    <td className="max-w-72 truncate p-3 text-muted-foreground">{document.reason || "-"}</td>
                    <td className="p-3"><span className="rounded-full bg-muted px-2 py-1 text-xs capitalize">{document.settlement_status.replaceAll("_", " ")}</span></td>
                    <td className="p-3 text-right font-medium">{formatMoney(document.grand_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        ) : (
          <div className="p-12 text-center"><p className="font-medium">No sales returns recorded.</p><p className="mt-1 text-sm text-muted-foreground">Refunding a completed order through this workflow creates its credit note automatically.</p></div>
        )}
      </div>

      <FinanceSalesReturnDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={() => void load()} initialInvoiceId={invoiceId} initialOrderId={orderId} />
      <TransactionDetailSheet
        open={selectedDocument != null}
        onOpenChange={(open) => !open && setSelectedDocument(null)}
        detail={selectedDocument ? salesReturnDetail(selectedDocument, salesById.get(selectedDocument.original_document_id || 0)) : null}
      />
    </AppPage>
  );
}
