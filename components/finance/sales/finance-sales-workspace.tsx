"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { FinanceSalesInvoiceDialog } from "@/components/finance/sales/finance-sales-invoice-dialog";
import {
  TransactionDetailSheet,
  type TransactionDetailModel,
} from "@/components/finance/transaction-detail/transaction-detail-sheet";
import { FinanceWorkspaceNav } from "@/components/finance/workspace/finance-workspace-nav";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { financeSalesApi } from "@/lib/api/finance-sales-api";
import type { FinanceSalesDocument } from "@/types/finance-sales";

const formatMoney = (value: number | string) =>
  `NPR ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

function documentDetail(
  document: FinanceSalesDocument,
): TransactionDetailModel {
  return {
    eyebrow: document.source_type === "pos_order" ? "POS sale" : "Manual sale",
    title: document.document_number,
    reference:
      document.fiscal_document_number ||
      document.external_reference ||
      (document.source_type === "pos_order" ? "POS invoice" : "Sales invoice"),
    subtitle: document.daily_order_number
      ? `Daily order #${document.daily_order_number}`
      : "Sales invoice",
    occurredAt: document.created_at || document.business_date,
    status: document.settlement_status,
    amount: document.grand_total,
    amountLabel: "Invoice total",
    amountTone: "in",
    badges: [document.business_line, document.source_type],
    sections: [
      {
        title: "Invoice overview",
        fields: [
          { label: "Business date", value: document.business_date },
          {
            label: "Source",
            value:
              document.source_type === "pos_order"
                ? "Point of sale order"
                : "Manual invoice",
          },
          { label: "Order / source ID", value: document.source_id || "—" },
          {
            label: "Customer",
            value: document.customer_name || "Cash customer",
          },
          {
            label: "Created by",
            value: document.created_by_name || "System",
          },
          {
            label: "Notes",
            value: document.notes || document.reason || "—",
            fullWidth: true,
          },
        ],
      },
      {
        title: "Items",
        description: "The products and amounts recorded on this invoice.",
        table: {
          columns: ["Item", "Quantity", "Rate", "Amount"],
          rows: document.lines.map((line) => [
            <div key={line.id}>
              <p className="font-medium">{line.item_name}</p>
              {line.description ? (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {line.description}
                </p>
              ) : null}
            </div>,
            Number(line.quantity || 0).toLocaleString(),
            formatMoney(line.unit_price),
            <span
              key={`amount-${line.id}`}
              className="font-medium tabular-nums"
            >
              {formatMoney(line.line_total)}
            </span>,
          ]),
        },
      },
      {
        title: "Totals & settlement",
        fields: [
          { label: "Subtotal", value: formatMoney(document.subtotal) },
          { label: "Discount", value: formatMoney(document.discount_total) },
          { label: "Tax", value: formatMoney(document.tax_total) },
          { label: "Grand total", value: formatMoney(document.grand_total) },
          {
            label: "Settlement",
            value: document.settlement_status.replaceAll("_", " "),
          },
          {
            label: "Fiscal document",
            value: document.fiscal_document_number || "Not issued",
          },
        ],
      },
    ],
  };
}

export function FinanceSalesWorkspace() {
  const restaurantId = useAuth((state) => state.user?.restaurant_id);
  const [documents, setDocuments] = useState<FinanceSalesDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] =
    useState<FinanceSalesDocument | null>(null);

  const load = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const result = await financeSalesApi.list(Number(restaurantId), {
        kind: "invoice",
        limit: 200,
      });
      setDocuments(result.documents);
    } catch (error: any) {
      toast.error(
        error.response?.data?.detail || "Could not load sales invoices.",
      );
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Sales &amp; receivables
          </p>
          <h1 className="text-2xl font-semibold">Sales invoices</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            One register for completed POS orders and manual sales. POS sales
            keep their order and kitchen history; manual sales create no KOT.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" asChild>
            <Link href="/orders/new">
              <Plus className="mr-2 h-4 w-4" />
              New POS sale
            </Link>
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Manual sale
          </Button>
        </div>
      </div>

      <FinanceWorkspaceNav
        links={[
          { label: "Sales invoices", href: "/finance/sales" },
          { label: "Sales returns", href: "/finance/sales/returns" },
        ]}
        action={{
          label: "Detailed sales book",
          href: "/finance/reports/sales-book",
        }}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <p className="text-xs font-medium uppercase text-muted-foreground">
            All invoices
          </p>
          <p className="mt-2 text-2xl font-semibold">{documents.length}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs font-medium uppercase text-muted-foreground">
            Invoice value
          </p>
          <p className="mt-2 text-2xl font-semibold">
            {formatMoney(
              documents.reduce(
                (sum, doc) => sum + Number(doc.grand_total || 0),
                0,
              ),
            )}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs font-medium uppercase text-muted-foreground">
            Outstanding
          </p>
          <p className="mt-2 text-2xl font-semibold text-amber-600">
            {formatMoney(
              documents
                .filter((doc) => doc.settlement_status !== "paid")
                .reduce((sum, doc) => sum + Number(doc.grand_total || 0), 0),
            )}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
          <div>
            <h2 className="font-medium">Invoice register</h2>
            <p className="text-xs text-muted-foreground">
              Select an invoice to see its items, settlement and source.
            </p>
          </div>
          <FileText className="h-5 w-5 text-muted-foreground" />
        </div>
        {documents.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead className="bg-muted/40 text-left text-muted-foreground">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Invoice</th>
                  <th className="p-3">Source</th>
                  <th className="p-3">Order / reference</th>
                  <th className="p-3">Items</th>
                  <th className="p-3">Settlement</th>
                  <th className="p-3 text-right">Total</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {documents.map((document) => (
                  <tr
                    key={document.id}
                    tabIndex={0}
                    role="button"
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
                    <td className="p-3">
                      <p className="font-medium">{document.document_number}</p>
                      {document.fiscal_document_number ? (
                        <p className="text-xs text-muted-foreground">
                          Fiscal: {document.fiscal_document_number}
                        </p>
                      ) : null}
                    </td>
                    <td className="p-3">
                      <span className="rounded-full bg-muted px-2 py-1 text-xs">
                        {document.source_type === "pos_order"
                          ? "POS"
                          : "Manual"}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {document.daily_order_number
                        ? `Daily order #${document.daily_order_number}`
                        : document.external_reference || "—"}
                    </td>
                    <td className="p-3">{document.lines.length}</td>
                    <td className="p-3">
                      <span className="rounded-full bg-muted px-2 py-1 text-xs capitalize">
                        {document.settlement_status.replaceAll("_", " ")}
                      </span>
                    </td>
                    <td className="p-3 text-right font-medium">
                      {formatMoney(document.grand_total)}
                    </td>
                    <td className="p-3 text-right">
                      <Link
                        onClick={(event) => event.stopPropagation()}
                        className="text-primary hover:underline"
                        href={`/finance/sales/returns?invoice_id=${document.id}`}
                      >
                        Return
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <p className="font-medium">No sales invoices yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Complete a POS sale or record a manual sale to create the first
              invoice.
            </p>
          </div>
        )}
      </div>

      <FinanceSalesInvoiceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={() => void load()}
      />
      <TransactionDetailSheet
        open={selectedDocument != null}
        onOpenChange={(open) => !open && setSelectedDocument(null)}
        detail={selectedDocument ? documentDetail(selectedDocument) : null}
        actionHref={
          selectedDocument?.source_type === "pos_order" &&
          selectedDocument.source_id
            ? `/orders/${selectedDocument.source_id}`
            : null
        }
        actionLabel="Open order"
      />
    </div>
  );
}
