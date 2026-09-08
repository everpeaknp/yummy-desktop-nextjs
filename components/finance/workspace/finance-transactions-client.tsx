"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";

import apiClient from "@/lib/api-client";
import { FinanceApis, PartyLedgerApis, PurchaseApis, PurchaseReturnApis } from "@/lib/api/endpoints";
import { financeSalesApi } from "@/lib/api/finance-sales-api";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  FinanceReceivablesResponse,
  FinanceTransactionRow,
  FinanceTransactionsResponse,
} from "@/types/finance";
import type { FinanceSalesDocument } from "@/types/finance-sales";
import {
  TransactionDetailSheet,
  type TransactionDetailModel,
} from "@/components/finance/transaction-detail/transaction-detail-sheet";
import { SalesDocumentDetailSheet } from "@/components/finance/transaction-detail/sales-document-detail-sheet";
import {
  partyLedgerEntryDetail,
  purchaseDocumentDetail,
  purchaseReturnDetail,
} from "@/components/finance/transaction-detail/party-workspace-detail";

function yyyyMmDd(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function money(value: number) {
  return `NPR ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function titleCase(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function movementDirection(row: FinanceTransactionRow): "in" | "out" | null {
  const direction = String(row.direction || "").toLowerCase();
  if (direction === "inflow" || direction === "in") return "in";
  if (direction === "outflow" || direction === "out") return "out";
  return null;
}

function salesDocumentForTransaction(
  row: FinanceTransactionRow,
  documents: FinanceSalesDocument[],
) {
  if (String(row.event_type).toLowerCase() !== "sale_recognized") {
    return null;
  }
  const sourceId = Number(row.source_id || 0);
  const orderId = Number(row.order_id || 0);
  return (
    documents.find(
      (document) =>
        row.source_type === "finance_sales_invoice" &&
        document.id === sourceId,
    ) ||
    documents.find(
      (document) =>
        document.source_type === "pos_order" &&
        (document.source_id === sourceId || document.source_id === orderId),
    ) ||
    documents.find((document) => document.document_number === row.invoice_number) ||
    null
  );
}

function eventReference(row: FinanceTransactionRow) {
  if (row.invoice_number) return row.invoice_number;
  if (row.order_number) return `Daily order #${row.order_number}`;
  const itemName = row.metadata_json?.item_name_snapshot;
  if (typeof itemName === "string" && itemName.trim()) {
    return `${titleCase(row.source_type)} · ${itemName}`;
  }
  const profileName = row.metadata_json?.accounting_profile_name;
  if (typeof profileName === "string" && profileName.trim()) {
    return `${titleCase(row.source_type)} · ${profileName}`;
  }
  return titleCase(row.source_type);
}

function ownerLink(row: FinanceTransactionRow) {
  const source = `${row.source_type} ${row.event_type}`.toLowerCase();
  if (
    row.order_id ||
    source.includes("order") ||
    source.includes("sale") ||
    source.includes("refund")
  )
    return "/finance/sales";
  if (source.includes("supplier") || source.includes("payable"))
    return "/suppliers";
  // Non-inventory purchases now record as Expense; check this before the
  // generic "purchase" match below.
  if (source.includes("non_inventory_purchase")) return "/finance/expenses";
  // New inventory-linked Purchase/PurchaseReturn records.
  if (source.includes("inventory_purchase")) return "/inventory/purchases";
  // Legacy GeneralPurchase-sourced records (general_purchase / general_purchase_return)
  // still live only in the old, still-functional workspace -- not the new
  // inventory Purchase screen, which has no knowledge of them.
  if (source.includes("purchase")) return "/finance/purchases";
  if (source.includes("inventory")) return "/inventory";
  if (source.includes("salary") || source.includes("payroll"))
    return "/attendance";
  if (source.includes("income")) return "/finance/other-income";
  if (source.includes("expense")) return "/finance/expenses";
  return null;
}

type RegisterType =
  | "Sales"
  | "Purchase"
  | "Sales return"
  | "Purchase return"
  | "Payment in"
  | "Payment out"
  | "Other income"
  | "Expense"
  | "Transfer"
  | "Adjustment";

type RegisterRow = {
  key: string;
  source: FinanceTransactionRow;
  type: RegisterType;
  reference: string;
  particular: string;
  paymentMode: string;
  status: string;
  amount: number;
  amountTone: "in" | "out" | "neutral";
};

const paymentMethodLabel = (method?: string | null) =>
  method ? titleCase(method) : "—";

function paymentMethods(rows: FinanceTransactionRow[]) {
  const methods = Array.from(
    new Set(
      rows
        .map((row) => paymentMethodLabel(row.payment_method))
        .filter((method) => method !== "—"),
    ),
  );
  return methods.join(", ") || "—";
}

function paymentStatusClass(status: string) {
  const value = status.toLowerCase();
  if (["paid", "refunded"].includes(value)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (["partially paid", "unpaid", "customer credit", "supplier credit"].includes(value)) {
    return "border-orange-200 bg-orange-50 text-orange-700";
  }
  return "border-border bg-muted text-muted-foreground";
}

function typeBadgeClass(type: RegisterType) {
  if (type === "Sales" || type === "Payment in" || type === "Other income") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (type === "Purchase" || type === "Payment out" || type === "Expense") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  if (type.includes("return")) {
    return "border-orange-200 bg-orange-50 text-orange-700";
  }
  return "border-border bg-muted text-muted-foreground";
}

function salesReturnDocumentForTransaction(
  row: FinanceTransactionRow,
  documents: FinanceSalesDocument[],
) {
  const source = String(row.source_type || "").toLowerCase();
  if (source === "finance_sales_credit_note") {
    return documents.find((document) => document.id === Number(row.source_id)) || null;
  }
  if (row.order_id) {
    return documents.find(
      (document) =>
        document.document_kind === "credit_note" &&
        document.source_type === "pos_order" &&
        Number(document.source_id) === Number(row.order_id),
    ) || null;
  }
  return null;
}

function buildRegisterRows(
  rows: FinanceTransactionRow[],
  documents: FinanceSalesDocument[],
): RegisterRow[] {
  const result: RegisterRow[] = [];
  const consumed = new Set<number>();
  const sourceType = (row: FinanceTransactionRow) => String(row.source_type || "").toLowerCase();
  const eventType = (row: FinanceTransactionRow) => String(row.event_type || "").toLowerCase();
  const consume = (row: FinanceTransactionRow) => consumed.add(row.id);
  const isConsumed = (row: FinanceTransactionRow) => consumed.has(row.id);

  const salesRows = rows.filter((row) => eventType(row) === "sale_recognized");
  for (const sale of salesRows) {
    if (isConsumed(sale)) continue;
    const document = salesDocumentForTransaction(sale, documents);
    const linkedCheckoutPayments = rows.filter((candidate) => {
      const candidateSource = sourceType(candidate);
      return (
        eventType(candidate) === "collection_received" &&
        ((candidateSource === "order_payment" &&
          Number(candidate.order_id) === Number(sale.order_id)) ||
          (candidateSource === "finance_sales_invoice_payment" &&
            sourceType(sale) === "finance_sales_invoice" &&
            Number(candidate.source_id) === Number(sale.source_id)))
      );
    });
    const linkedCredit = rows.filter(
      (candidate) =>
        eventType(candidate) === "credit_sale_created" &&
        sourceType(candidate) === "order_payment" &&
        Number(candidate.order_id) === Number(sale.order_id),
    );
    const paidNow = linkedCheckoutPayments.reduce(
      (total, payment) => total + Math.abs(Number(payment.amount || 0)),
      0,
    );
    const total = Math.abs(Number(sale.amount || 0));
    const status = document?.settlement_status === "paid" || paidNow >= total - 0.004
      ? "Paid"
      : paidNow > 0 || document?.settlement_status === "partially_paid"
        ? "Partially paid"
        : linkedCredit.length || document?.settlement_status === "unpaid"
          ? "Unpaid"
          : "Recorded";
    result.push({
      key: `sale:${sale.id}`,
      source: sale,
      type: "Sales",
      reference: document?.document_number || sale.invoice_number || eventReference(sale),
      particular: document?.customer_name || sale.customer_name || "Walk-in customer",
      paymentMode: linkedCheckoutPayments.length
        ? paymentMethods(linkedCheckoutPayments)
        : linkedCredit.length
          ? "Credit"
          : "—",
      status,
      amount: total,
      amountTone: "in",
    });
    consume(sale);
    linkedCheckoutPayments.forEach(consume);
    linkedCredit.forEach(consume);
  }

  const purchaseGroups = new Map<string, FinanceTransactionRow[]>();
  rows.forEach((row) => {
    if (sourceType(row) !== "inventory_purchase" || !row.source_id) return;
    const key = `${sourceType(row)}:${row.source_id}`;
    purchaseGroups.set(key, [...(purchaseGroups.get(key) || []), row]);
  });
  const recognitionPriority = [
    "inventory_asset_acquired",
    "inventory_purchase_expensed",
    "inventory_expense_payable_created",
    "supplier_payable_created",
  ];
  purchaseGroups.forEach((group, key) => {
    const recognised = group.filter((row) => recognitionPriority.includes(eventType(row)));
    if (!recognised.length) return;
    const lines = new Map<string, FinanceTransactionRow[]>();
    recognised.forEach((row) => {
      const lineId = row.metadata_json?.purchase_line_id;
      const lineKey = lineId == null ? `event:${row.id}` : `line:${lineId}`;
      lines.set(lineKey, [...(lines.get(lineKey) || []), row]);
    });
    const sourceRows = Array.from(lines.values()).map((lineEvents) =>
      [...lineEvents].sort(
        (left, right) => recognitionPriority.indexOf(eventType(left)) - recognitionPriority.indexOf(eventType(right)),
      )[0],
    );
    const source = sourceRows[0];
    if (!source) return;
    const amount = sourceRows.reduce((total, row) => total + Math.abs(Number(row.amount || 0)), 0);
    const payments = [
      ...group.filter((row) =>
        ["inventory_cash_outflow", "supplier_payment_made"].includes(eventType(row)) ||
        (eventType(row) === "inventory_purchase_expensed" && Boolean(row.payment_method)),
      ),
      ...rows.filter(
        (row) =>
          sourceType(row) === "inventory_purchase_payment" &&
          Number(row.source_id) === Number(source.source_id) &&
          eventType(row) === "supplier_payment_made",
      ),
    ];
    const paid = payments.reduce((total, row) => total + Math.abs(Number(row.amount || 0)), 0);
    result.push({
      key: `purchase:${key}`,
      source,
      type: "Purchase",
      reference: `Purchase #${source.source_id}`,
      particular: source.supplier_name || "Supplier purchase",
      paymentMode: paymentMethods(payments),
      status: paid >= amount - 0.004 ? "Paid" : paid > 0 ? "Partially paid" : "Unpaid",
      amount,
      amountTone: "out",
    });
    group.forEach(consume);
    payments.forEach(consume);
  });

  for (const row of rows) {
    if (isConsumed(row)) continue;
    const type = eventType(row);
    const source = sourceType(row);
    const amount = Math.abs(Number(row.amount || 0));
    const reference = eventReference(row);
    const party = row.customer_name || row.supplier_name || "—";

    if (type === "inventory_return_processed") {
      result.push({
        key: `purchase-return:${row.id}`,
        source: row,
        type: "Purchase return",
        reference: `Purchase return #${row.source_id}`,
        particular: row.supplier_name || "Supplier",
        paymentMode: paymentMethodLabel(row.payment_method),
        status: row.payment_method ? "Refunded" : "Supplier credit",
        amount,
        amountTone: "in",
      });
      continue;
    }

    if (["refund_processed", "refund_liability_created"].includes(type)) {
      const document = salesReturnDocumentForTransaction(row, documents);
      result.push({
        key: `sales-return:${row.id}`,
        source: row,
        type: "Sales return",
        reference: document?.document_number || reference,
        particular: document?.customer_name || row.customer_name || "Walk-in customer",
        paymentMode: paymentMethodLabel(row.payment_method),
        status: type === "refund_processed" ? "Refunded" : "Customer credit",
        amount,
        amountTone: "out",
      });
      continue;
    }

    if (type === "collection_received") {
      result.push({
        key: `payment-in:${row.id}`,
        source: row,
        type: "Payment in",
        reference,
        particular: row.customer_name || "Customer payment",
        paymentMode: paymentMethodLabel(row.payment_method),
        status: "Recorded",
        amount,
        amountTone: "in",
      });
      continue;
    }

    if (type === "supplier_payment_received") {
      result.push({
        key: `supplier-payment-in:${row.id}`,
        source: row,
        type: "Payment in",
        reference,
        particular: row.supplier_name || "Supplier payment",
        paymentMode: paymentMethodLabel(row.payment_method),
        status: "Recorded",
        amount,
        amountTone: "in",
      });
      continue;
    }

    if (["customer_payment_out", "supplier_payment_made"].includes(type)) {
      result.push({
        key: `payment-out:${row.id}`,
        source: row,
        type: "Payment out",
        reference,
        particular: party === "—" ? "Payment" : party,
        paymentMode: paymentMethodLabel(row.payment_method),
        status: "Recorded",
        amount,
        amountTone: "out",
      });
      continue;
    }

    if (type === "manual_income_received") {
      result.push({ key: `income:${row.id}`, source: row, type: "Other income", reference, particular: reference, paymentMode: paymentMethodLabel(row.payment_method), status: "Recorded", amount, amountTone: "in" });
      continue;
    }
    if (type === "manual_expense_paid") {
      result.push({ key: `expense:${row.id}`, source: row, type: "Expense", reference, particular: reference, paymentMode: paymentMethodLabel(row.payment_method), status: "Recorded", amount, amountTone: "out" });
      continue;
    }
    if (type.includes("transfer") || type.includes("deposit")) {
      result.push({ key: `transfer:${row.id}`, source: row, type: "Transfer", reference, particular: reference, paymentMode: paymentMethodLabel(row.payment_method), status: "Recorded", amount, amountTone: "neutral" });
      continue;
    }
    if (type.includes("variance") || type.includes("reversed")) {
      result.push({ key: `adjustment:${row.id}`, source: row, type: "Adjustment", reference, particular: reference, paymentMode: "—", status: "Recorded", amount, amountTone: "neutral" });
    }
  }

  return result.sort(
    (left, right) => new Date(right.source.event_at).getTime() - new Date(left.source.event_at).getTime(),
  );
}

function EventTable({
  rows,
  salesDocuments,
  loading,
  query = "",
}: {
  rows: FinanceTransactionRow[];
  salesDocuments: FinanceSalesDocument[];
  loading: boolean;
  query?: string;
}) {
  const user = useAuth((state) => state.user);
  const [selected, setSelected] = useState<FinanceTransactionRow | null>(null);
  const [sourceDetail, setSourceDetail] = useState<TransactionDetailModel | null>(null);
  const [sourceLoading, setSourceLoading] = useState(false);
  const registerRows = useMemo(
    () => buildRegisterRows(rows, salesDocuments),
    [rows, salesDocuments],
  );
  const visibleRegisterRows = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return registerRows;
    return registerRows.filter((row) =>
      `${row.reference} ${row.particular} ${row.type} ${row.paymentMode} ${row.status}`
        .toLowerCase()
        .includes(value),
    );
  }, [query, registerRows]);

  useEffect(() => {
    setSourceDetail(null);
    const restaurantId = Number(user?.restaurant_id || 0);
    if (
      !selected ||
      !restaurantId ||
      salesDocumentForTransaction(selected, salesDocuments) ||
      salesReturnDocumentForTransaction(selected, salesDocuments)
    ) {
      setSourceLoading(false);
      return;
    }

    const customerId = Number(selected.customer_id || 0);
    const supplierId = Number(selected.supplier_id || 0);
    const party = customerId > 0 ? "customer" : supplierId > 0 ? "supplier" : null;
    const partyId = customerId || supplierId;
    const source = String(selected.source_type || "").toLowerCase();
    const sourceId = Number(selected.source_id || 0);
    let cancelled = false;

    const loadSourceDetail = async () => {
      setSourceLoading(true);
      try {
        if (source.includes("inventory_purchase_return") && sourceId > 0) {
          const returnResponse = await apiClient.get(PurchaseReturnApis.get(sourceId, restaurantId));
          if (!cancelled) {
            setSourceDetail(purchaseReturnDetail(returnResponse.data.data));
          }
          return;
        }

        if (source.includes("inventory_purchase") && sourceId > 0) {
          const purchaseResponse = await apiClient.get(PurchaseApis.get(sourceId, restaurantId));
          const purchase = purchaseResponse.data.data;
          if (!purchase || cancelled) return;
          const purchaseSupplierId = Number(purchase.supplier_id || supplierId);
          if (purchaseSupplierId > 0) {
            const statementResponse = await apiClient.get(
              PartyLedgerApis.statement("supplier", purchaseSupplierId, restaurantId),
            );
            if (cancelled) return;
            setSourceDetail(purchaseDocumentDetail(purchase, statementResponse.data.data));
          } else {
            setSourceDetail(purchaseDocumentDetail(purchase));
          }
          return;
        }

        if (party && partyId > 0) {
          const response = await apiClient.get(
            PartyLedgerApis.statement(party, partyId, restaurantId),
          );
          if (cancelled) return;
          const statement = response.data.data;
          const entry = (statement?.entries || []).find((candidate: any) => {
            const candidateSource = String(candidate.source_type || "").toLowerCase();
            return (
              Number(candidate.id) === sourceId ||
              (candidateSource === source && Number(candidate.source_id) === sourceId)
            );
          });
          if (entry) {
            setSourceDetail(partyLedgerEntryDetail(entry, party, statement?.allocations || []));
          }
          return;
        }

      } catch (error) {
        console.warn("Transaction source details are unavailable", error);
      } finally {
        if (!cancelled) setSourceLoading(false);
      }
    };

    void loadSourceDetail();
    return () => {
      cancelled = true;
    };
  }, [selected, salesDocuments, user?.restaurant_id]);

  if (loading)
    return (
      <div className="flex min-h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  if (!visibleRegisterRows.length)
    return (
      <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">
        No transactions match this period.
      </div>
    );

  const selectedSalesDocument = selected
    ? salesDocumentForTransaction(selected, salesDocuments) || salesReturnDocumentForTransaction(selected, salesDocuments)
    : null;
  const selectedHref = selectedSalesDocument?.source_type === "pos_order" && selectedSalesDocument.source_id
    ? `/orders/${selectedSalesDocument.source_id}`
    : selected
      ? ownerLink(selected)
      : null;
  const selectedRegisterRow = selected
    ? registerRows.find((row) => row.source.id === selected.id) || null
    : null;
  const selectedDirection = selectedRegisterRow?.amountTone || (selected ? movementDirection(selected) : null);
  const selectedDetail: TransactionDetailModel | null = selected
    ? {
        eyebrow: selectedRegisterRow?.type || "Transaction",
        title: selectedRegisterRow?.reference || "Transaction details",
        reference: selectedRegisterRow?.particular || eventReference(selected),
        subtitle: selectedRegisterRow?.type ? `${selectedRegisterRow.type} details.` : "Transaction details.",
        occurredAt: selected.event_at,
        status: selectedRegisterRow?.status || "Recorded",
        amount: selectedRegisterRow?.amount ?? Math.abs(Number(selected.amount || 0)),
        amountLabel:
          selectedDirection === "in"
            ? "Money in"
            : selectedDirection === "out"
              ? "Money out"
              : "Amount",
        amountTone: selectedDirection || "neutral",
        sections: [
          {
            title: "Related record",
            fields: [
              { label: "Business date", value: selected.business_date },
              {
                label: "Order",
                value: selected.invoice_number || selected.order_number
                  ? eventReference(selected)
                  : null,
              },
              {
                label: "Customer",
                value: selected.customer_name || null,
              },
              {
                label: "Supplier",
                value: selected.supplier_name || null,
              },
            ],
          },
          ...(selectedRegisterRow?.paymentMode && selectedRegisterRow.paymentMode !== "—"
            ? [{
                title: "Payment",
                fields: [{ label: "Method", value: selectedRegisterRow.paymentMode }],
              }]
            : []),
        ],
      }
    : null;

  const resolvedDetail: TransactionDetailModel | null =
    selectedDetail && selected
      ? {
          ...selectedDetail,
          sections: selectedDetail.sections.map((section) => ({
            ...section,
            fields: section.fields?.map((field) => {
              if (field.label === "Customer") {
                return { ...field, value: selected.customer_name || "Walk-in customer" };
              }
              if (field.label === "Supplier") {
                return { ...field, value: selected.supplier_name || "No supplier" };
              }
              if (field.label === "Order") {
                return {
                  ...field,
                  value:
                    selected.invoice_number ||
                    (selected.order_number
                      ? `Daily order #${selected.order_number}`
                      : "Not linked to an order"),
                };
              }
              return field;
            }),
          })),
        }
      : null;

  return (
    <>
      <div className="divide-y divide-border md:hidden">
        {visibleRegisterRows.map((row) => {
          const isIn = row.amountTone === "in";
          const isOut = row.amountTone === "out";
          return (
            <button
              key={row.key}
              type="button"
              onClick={() => setSelected(row.source)}
              className="w-full px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><p className="truncate font-medium">{row.reference}</p><p className="mt-1 truncate text-xs text-muted-foreground">{row.particular || row.type} · {new Date(row.source.event_at).toLocaleDateString()}</p></div>
                <p className={`shrink-0 font-semibold tabular-nums ${isIn ? "text-emerald-600" : isOut ? "text-rose-600" : ""}`}>{isIn ? "+" : isOut ? "−" : ""}{money(row.amount)}</p>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2"><Badge variant="outline" className={typeBadgeClass(row.type)}>{row.type}</Badge><span className="truncate text-xs text-muted-foreground">{row.status}</span></div>
            </button>
          );
        })}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Party</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRegisterRows.map((row) => {
              const isIn = row.amountTone === "in";
              const isOut = row.amountTone === "out";
              return (
                <TableRow
                  key={row.key}
                  tabIndex={0}
                  role="button"
                  onClick={() => setSelected(row.source)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelected(row.source);
                    }
                  }}
                  className="cursor-pointer focus-visible:bg-muted/40 focus-visible:outline-none"
                >
                  <TableCell>
                    <p className="font-medium">
                      {new Date(row.source.event_at).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(row.source.event_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {isIn ? (
                        <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
                      ) : isOut ? (
                        <ArrowUpRight className="h-4 w-4 text-rose-600" />
                      ) : null}
                      <span className="font-medium">
                        {row.reference}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.particular}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={typeBadgeClass(row.type)}>
                      {row.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.paymentMode}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={paymentStatusClass(row.status)}>
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className={`text-right font-semibold tabular-nums ${isIn ? "text-emerald-600" : isOut ? "text-rose-600" : ""}`}
                  >
                    {isIn ? "+" : isOut ? "−" : ""}
                    {money(row.amount)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {selectedSalesDocument ? (
        <SalesDocumentDetailSheet
          open={selected != null}
          onOpenChange={(open) => !open && setSelected(null)}
          document={selectedSalesDocument}
        />
      ) : (
        <TransactionDetailSheet
          open={selected != null}
          onOpenChange={(open) => {
            if (!open) {
              setSelected(null);
              setSourceDetail(null);
            }
          }}
          detail={sourceDetail || resolvedDetail}
          loading={sourceLoading}
          actionHref={selectedHref}
          actionLabel="Open source workspace"
        />
      )}
    </>
  );
}

export function FinanceTransactionsClient() {
  const user = useAuth((state) => state.user);
  const now = useMemo(() => new Date(), []);
  const [dateFrom, setDateFrom] = useState(
    yyyyMmDd(new Date(now.getFullYear(), now.getMonth(), 1)),
  );
  const [dateTo, setDateTo] = useState(yyyyMmDd(now));
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<FinanceTransactionRow[]>([]);
  const [salesDocuments, setSalesDocuments] = useState<FinanceSalesDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.restaurant_id) return;
    setLoading(true);
    try {
      const [response, salesResult] = await Promise.all([
        apiClient.get(
          FinanceApis.transactions({
            restaurantId: Number(user.restaurant_id),
            dateFrom,
            dateTo,
            timezone: "Asia/Kathmandu",
            businessLine: "all",
            limit: 300,
            offset: 0,
          }),
        ),
        financeSalesApi.list(Number(user.restaurant_id), { limit: 500 }),
      ]);
      const data = (response.data?.data ??
        response.data) as FinanceTransactionsResponse;
      setRows(data?.transactions ?? []);
      setSalesDocuments(salesResult.documents);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, user?.restaurant_id]);

  useEffect(() => {
    void load();
  }, [load]);
  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Finance
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Transactions
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sales, purchases, returns, and payments. Each business action appears once.
        </p>
      </header>
      <div className="flex flex-col gap-3 rounded-2xl border border-border p-4 md:flex-row md:items-end">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search reference, party, type, or payment method"
            className="pl-9"
          />
        </div>
        <label className="grid gap-1 text-xs text-muted-foreground">
          From
          <Input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
          />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          To
          <Input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
          />
        </label>
        <Button variant="outline" onClick={() => void load()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>
      <Card className="border-border shadow-none">
        <CardContent className="p-0">
          <EventTable
            rows={rows}
            salesDocuments={salesDocuments}
            loading={loading}
            query={query}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export function FinanceReceivablesClient() {
  const user = useAuth((state) => state.user);
  const now = useMemo(() => new Date(), []);
  const [data, setData] = useState<FinanceReceivablesResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.restaurant_id) return;
    const dateFrom = yyyyMmDd(new Date(now.getFullYear() - 1, 0, 1));
    apiClient
      .get(
        FinanceApis.receivables({
          restaurantId: Number(user.restaurant_id),
          dateFrom,
          dateTo: yyyyMmDd(now),
          timezone: "Asia/Kathmandu",
          businessLine: "all",
        }),
      )
      .then((response) => setData(response.data?.data ?? response.data ?? null))
      .finally(() => setLoading(false));
  }, [now, user?.restaurant_id]);

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Sales
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Customer receivables
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Credit sales create receivables. Later customer payments reduce those
          balances without creating income again.
        </p>
      </header>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Credit sales", value: data?.credit_sales },
          { label: "Collected later", value: data?.credit_repayments },
          { label: "Still outstanding", value: data?.outstanding_receivables },
        ].map((item) => (
          <Card key={item.label} className="shadow-none">
            <CardContent className="p-5">
              <p className="text-xs font-medium uppercase text-muted-foreground">
                {item.label}
              </p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  money(Number(item.value || 0))
                )}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="border-border shadow-none">
        <CardContent className="p-0">
          <EventTable
            rows={data?.transactions ?? []}
            salesDocuments={[]}
            loading={loading}
          />
        </CardContent>
      </Card>
    </div>
  );
}
