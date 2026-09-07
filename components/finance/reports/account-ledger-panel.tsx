"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import axios from "axios";
import {
  AlertCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  Filter,
  Loader2,
  Lock,
  Pencil,
  RefreshCw,
  ScrollText,
  X,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import apiClient from "@/lib/api-client";
import { FinanceApis, PartyLedgerApis, PurchaseApis, PurchaseReturnApis } from "@/lib/api/endpoints";
import { financeSalesApi } from "@/lib/api/finance-sales-api";
import { useAuth } from "@/hooks/use-auth";
import { financeReportingApi } from "@/lib/api/finance-reporting-api";
import { cn } from "@/lib/utils";
import type {
  FinanceReportingAccountLedgerRead,
  FinanceReportingLedgerLine,
} from "@/types/finance-reporting";
import type { FinanceSalesDocument } from "@/types/finance-sales";
import type { FinanceTransactionRow, FinanceTransactionsResponse } from "@/types/finance";
import { TYPE_LABELS } from "@/components/finance/heads/account-head-dialog";
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

function money(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return (Number.isFinite(parsed) ? parsed : 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function humanize(value: string | null | undefined) {
  if (!value) return "—";
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/**
 * Turns a ledger line into what a restaurant staff member actually
 * recognizes -- an order and who/how it was paid -- instead of the internal
 * plumbing ("Finance Event", an internal row id). Falls back gracefully for
 * lines that were never order-related (payroll, inventory, manual entries),
 * where the stored description is already meaningful.
 */
function ledgerLineLabel(line: FinanceReportingLedgerLine): { primary: string; secondary?: string } {
  if (line.order_reference) {
    const primary = line.order_customer_name
      ? `Order ${line.order_reference} · ${line.order_customer_name}`
      : `Order ${line.order_reference}`;
    const secondary = [
      line.order_channel && line.order_channel !== "quick_billing" ? humanize(line.order_channel) : null,
      line.payment_method ? `${humanize(line.payment_method)} payment` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    return { primary, secondary: secondary || undefined };
  }
  if (line.party_name) {
    return { primary: line.party_name, secondary: line.description || humanize(line.source_type) };
  }
  return {
    primary: line.description || humanize(line.source_type),
    secondary:
      line.party_type ? humanize(line.party_type) : undefined,
  };
}

type BusinessTransactionType =
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

function businessTransactionType(line: FinanceReportingLedgerLine): BusinessTransactionType {
  const value = `${line.source_type} ${line.description || ""} ${line.order_reference || ""}`.toLowerCase();
  if (value.includes("purchase_return") || value.includes("purchase return")) return "Purchase return";
  if (value.includes("sales_return") || value.includes("sales return") || value.includes("refund")) return "Sales return";
  if (value.includes("supplier_payment") || value.includes("payment_out") || value.includes("payment made")) return "Payment out";
  if (value.includes("collection") || value.includes("payment_in") || value.includes("payment received")) return "Payment in";
  if (value.includes("inventory_purchase") || value.includes("general_purchase") || value.includes("purchase")) return "Purchase";
  if (value.includes("sale_recognized") || value.includes("finance_sales") || value.includes("pos_order") || value.includes("order")) return "Sales";
  if (value.includes("income")) return "Other income";
  if (value.includes("expense")) return "Expense";
  if (value.includes("transfer") || value.includes("deposit")) return "Transfer";
  return "Adjustment";
}

function businessTypeClass(type: BusinessTransactionType) {
  if (["Sales", "Payment in", "Other income"].includes(type)) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (["Purchase", "Payment out", "Expense"].includes(type)) return "border-rose-200 bg-rose-50 text-rose-700";
  if (type.includes("return")) return "border-orange-200 bg-orange-50 text-orange-700";
  return "border-border bg-muted text-muted-foreground";
}

function dateTime(value: string | null | undefined) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function readError(error: unknown) {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail ?? error.response?.data?.message;
    if (typeof detail === "string" && detail.trim()) return detail;
  }
  return "This ledger could not be loaded. Please try again.";
}

const PAGE_SIZE = 50;

export interface AccountLedgerPanelProps {
  headId: number | null;
  onOpenChange: (open: boolean) => void;
  /** Operations open a plain-language account statement; Chart of accounts keeps configuration context. */
  presentation?: "operational" | "accounting";
  /** Only passed by the Chart of Accounts screen, which owns editing. */
  onEdit?: () => void;
}

/**
 * Shared right-side "Account Ledger" detail panel. Both the Chart of
 * Accounts screen and the Reports > Accounts list open this same component
 * for the same account, so the two never drift into different-looking
 * ledger views.
 */
export function AccountLedgerPanel({
  headId,
  onOpenChange,
  presentation = "accounting",
  onEdit,
}: AccountLedgerPanelProps) {
  const user = useAuth((state) => state.user);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [partyType, setPartyType] = useState("all");
  const [partyId, setPartyId] = useState("");
  const [sourceType, setSourceType] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [offset, setOffset] = useState(0);

  const [report, setReport] = useState<FinanceReportingAccountLedgerRead | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLine, setSelectedLine] = useState<FinanceReportingLedgerLine | null>(null);
  const [selectedSalesDocument, setSelectedSalesDocument] = useState<FinanceSalesDocument | null>(null);
  const [sourceDetail, setSourceDetail] = useState<TransactionDetailModel | null>(null);
  const [sourceLoading, setSourceLoading] = useState(false);

  useEffect(() => {
    // Reset local state whenever a different account is opened.
    setDateFrom("");
    setDateTo("");
    setPartyType("all");
    setPartyId("");
    setSourceType("");
    setShowFilters(false);
    setOffset(0);
    setSelectedLine(null);
    setSelectedSalesDocument(null);
    setSourceDetail(null);
    setSourceLoading(false);
  }, [headId]);

  const openLedgerLine = (line: FinanceReportingLedgerLine) => {
    setSelectedSalesDocument(null);
    setSourceDetail(null);
    // Do not show an accounting-posting fallback while its business record is
    // being resolved. A statement row should open one canonical detail view.
    setSourceLoading(true);
    setSelectedLine(line);
  };

  const lineLabel = selectedLine ? ledgerLineLabel(selectedLine) : null;
  const selectedType = selectedLine ? businessTransactionType(selectedLine) : "Adjustment";
  const transactionDetail: TransactionDetailModel | null = selectedLine ? {
    eyebrow: selectedType,
    title: lineLabel?.primary || selectedLine.description || "Journal transaction",
    reference: selectedLine.order_reference || selectedLine.party_name || null,
    subtitle: lineLabel?.secondary || selectedLine.description || `${selectedType} details.`,
    occurredAt: selectedLine.occurred_at,
    status: selectedLine.entry_status,
    amount: Math.max(Number(selectedLine.debit || 0), Number(selectedLine.credit || 0)),
    amountLabel: "Transaction amount",
    amountTone: Number(selectedLine.debit || 0) ? "in" : "out",
    badges: [],
    sections: [
      {
        title: "Transaction overview",
        fields: [
          { label: "Account", value: report?.head?.name || "—" },
          { label: "Business date", value: selectedLine.business_date },
          { label: "Balance after posting", value: money(selectedLine.running_balance) },
          { label: "Payment method", value: selectedLine.payment_method ? humanize(selectedLine.payment_method) : "Not recorded" },
          { label: "Party", value: selectedLine.party_name || (selectedLine.party_type ? humanize(selectedLine.party_type) : "—") },
          { label: "Description", value: selectedLine.description || "—", fullWidth: true },
        ],
      },
    ],
  } : null;

  const params = useMemo(
    () => ({
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      party_type: partyType === "all" ? undefined : partyType,
      party_id: Number(partyId) > 0 ? Number(partyId) : undefined,
      source_type: sourceType.trim() || undefined,
      limit: PAGE_SIZE,
      offset,
    }),
    [dateFrom, dateTo, offset, partyId, partyType, sourceType],
  );

  useEffect(() => {
    if (!headId) {
      setReport(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    financeReportingApi
      .getAccountLedger(headId, params)
      .then((data) => {
        if (active) setReport(data);
      })
      .catch((requestError: unknown) => {
        if (active) {
          setReport(null);
          setError(readError(requestError));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [headId, params]);

  useEffect(() => {
    const restaurantId = Number(user?.restaurant_id || 0);
    if (!selectedLine || !restaurantId) {
      setSourceLoading(false);
      return;
    }

    let cancelled = false;
    let source = String(selectedLine.source_type || "").toLowerCase();
    let sourceId = Number(selectedLine.source_id || 0);
    let party: "customer" | "supplier" | null = selectedLine.party_type === "customer" || selectedLine.party_type === "supplier"
      ? selectedLine.party_type
      : null;
    let partyId = Number(selectedLine.party_id || 0);

    const loadCanonicalDetail = async () => {
      setSourceLoading(true);
      try {
        if (source === "finance_event" && selectedLine.finance_event_id) {
          const response = await apiClient.get(FinanceApis.transactions({
            restaurantId,
            dateFrom: selectedLine.business_date,
            dateTo: selectedLine.business_date,
            businessLine: "all",
            limit: 300,
            offset: 0,
          }));
          const financeRows = (response.data?.data ?? response.data) as FinanceTransactionsResponse;
          const event = financeRows.transactions?.find((candidate: FinanceTransactionRow) =>
            Number(candidate.id) === Number(selectedLine.finance_event_id),
          );
          if (event) {
            source = String(event.source_type || "").toLowerCase();
            sourceId = Number(event.source_id || 0);
            party = event.customer_id ? "customer" : event.supplier_id ? "supplier" : party;
            partyId = Number(event.customer_id || event.supplier_id || partyId || 0);
            if (event.order_id && (source.includes("order") || source.includes("sale"))) {
              const document = await financeSalesApi.getByOrder(restaurantId, Number(event.order_id));
              if (!cancelled) setSelectedSalesDocument(document);
              return;
            }
          }
        }

        if (source.includes("inventory_purchase_return") && sourceId > 0) {
          const response = await apiClient.get(PurchaseReturnApis.get(sourceId, restaurantId));
          if (!cancelled) setSourceDetail(purchaseReturnDetail(response.data.data));
          return;
        }

        if (source.includes("inventory_purchase") && sourceId > 0) {
          const response = await apiClient.get(PurchaseApis.get(sourceId, restaurantId));
          const purchase = response.data.data;
          if (!purchase || cancelled) return;
          const supplierId = Number(purchase.supplier_id || partyId);
          if (supplierId > 0) {
            const statement = await apiClient.get(PartyLedgerApis.statement("supplier", supplierId, restaurantId));
            if (cancelled) return;
            setSourceDetail(purchaseDocumentDetail(purchase, statement.data.data));
          } else {
            setSourceDetail(purchaseDocumentDetail(purchase));
          }
          return;
        }

        if (source.includes("pos_order") && sourceId > 0) {
          const document = await financeSalesApi.getByOrder(restaurantId, sourceId);
          if (!cancelled) setSelectedSalesDocument(document);
          return;
        }

        if (source.includes("finance_sales_invoice") || source.includes("finance_sales_credit_note")) {
          const kind = source.includes("credit_note") ? "credit_note" : "invoice";
          const documents = await financeSalesApi.list(restaurantId, { kind, limit: 500 });
          const document = documents.documents.find((candidate) => Number(candidate.id) === sourceId);
          if (!cancelled && document) setSelectedSalesDocument(document);
          return;
        }

        if (party && partyId > 0) {
          const response = await apiClient.get(PartyLedgerApis.statement(party, partyId, restaurantId));
          if (cancelled) return;
          const statement = response.data.data;
          const entry = (statement?.entries || []).find((candidate: any) =>
            Number(candidate.id) === sourceId ||
            (String(candidate.source_type || "").toLowerCase() === source && Number(candidate.source_id) === sourceId),
          );
          if (entry) setSourceDetail(partyLedgerEntryDetail(entry, party, statement?.allocations || []));
        }
      } catch (requestError) {
        console.warn("Could not resolve the business transaction for this account statement line", requestError);
      } finally {
        if (!cancelled) setSourceLoading(false);
      }
    };

    void loadCanonicalDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedLine, user?.restaurant_id]);

  const activeFilterCount = [dateFrom, dateTo, partyType !== "all" ? partyType : "", sourceType].filter(
    Boolean,
  ).length;

  const start = !report || report.total === 0 ? 0 : report.offset + 1;
  const end = report ? Math.min(report.offset + report.lines.length, report.total) : 0;

  return (
    <>
    <Sheet open={headId != null} onOpenChange={(open) => !open && onOpenChange(false)}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl">
        {loading && !report ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="p-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Could not load this account</AlertTitle>
              <AlertDescription className="flex items-center justify-between gap-3">
                <span>{error}</span>
                <Button size="sm" variant="outline" onClick={() => setOffset((value) => value)}>
                  Try again
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        ) : report ? (
          <>
            {/* Header */}
            <SheetHeader className="space-y-3 border-b bg-muted/20 px-6 py-5 text-left">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {presentation === "accounting" ? (
                      <Badge variant="outline" className="shrink-0 font-mono text-xs">
                        {report.head.code}
                      </Badge>
                    ) : null}
                    <SheetTitle className="truncate text-lg">
                      {presentation === "operational" ? "Account statement" : report.head.name}
                    </SheetTitle>
                  </div>
                  {presentation === "operational" ? (
                    <p className="mt-1 text-sm font-medium text-foreground">{report.head.name}</p>
                  ) : null}
                  {presentation === "accounting" ? (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary" className="text-[11px]">
                        {TYPE_LABELS[report.head.head_type]}
                      </Badge>
                      <Badge
                        variant={report.head.is_active ? "outline" : "destructive"}
                        className="text-[11px]"
                      >
                        {report.head.is_active ? "Active" : "Inactive"}
                      </Badge>
                      {report.head.system_role && (
                        <Badge variant="outline" className="gap-1 border-primary/20 bg-primary/5 text-[11px] text-primary">
                          <Lock className="h-2.5 w-2.5" />
                          Built-in
                        </Badge>
                      )}
                    </div>
                  ) : null}
                </div>
                {onEdit && (
                  <Button variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={onEdit}>
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                )}
              </div>
              {report.head.description && (
                <p className="text-xs text-muted-foreground">{report.head.description}</p>
              )}
            </SheetHeader>

            {/* Summary */}
            <div className="grid grid-cols-2 gap-3 border-b px-6 py-5 sm:grid-cols-4">
              <div className="rounded-lg border bg-card p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Opening
                </p>
                <p className="mt-1 font-mono text-base font-semibold tabular-nums">
                  {money(report.opening_balance)}
                </p>
              </div>
              <div className="rounded-lg border bg-card p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Current
                </p>
                <p className="mt-1 font-mono text-base font-semibold tabular-nums text-primary">
                  {money(report.closing_balance)}
                </p>
              </div>
              <div className="rounded-lg border bg-card p-3">
                <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <ArrowUpCircle className="h-3 w-3" /> Debit
                </p>
                <p className="mt-1 font-mono text-base font-semibold tabular-nums text-emerald-600">
                  {money(report.total_debit)}
                </p>
              </div>
              <div className="rounded-lg border bg-card p-3">
                <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <ArrowDownCircle className="h-3 w-3" /> Credit
                </p>
                <p className="mt-1 font-mono text-base font-semibold tabular-nums text-rose-600">
                  {money(report.total_credit)}
                </p>
              </div>
            </div>

            {/* Filter toolbar */}
            <div className="border-b px-6 py-3">
              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs text-muted-foreground"
                  onClick={() => setShowFilters((value) => !value)}
                >
                  <Filter className="h-3.5 w-3.5" />
                  Filters
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary" className="ml-0.5 h-4 px-1.5 text-[10px]">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/finance/reports/account-ledger?head_id=${report.head.id}`}
                    className="text-xs text-muted-foreground hover:text-primary hover:underline"
                  >
                    Open as full page
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setOffset((value) => value)}
                    title="Refresh"
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
                  </Button>
                </div>
              </div>
              {showFilters && (
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">From</Label>
                    <Input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="h-8 w-36 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">To</Label>
                    <Input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="h-8 w-36 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Party</Label>
                    <Select value={partyType} onValueChange={setPartyType}>
                      <SelectTrigger className="h-8 w-32 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All parties</SelectItem>
                        <SelectItem value="customer">Customer</SelectItem>
                        <SelectItem value="supplier">Supplier</SelectItem>
                        <SelectItem value="staff">Staff</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {presentation === "accounting" && partyType !== "all" && (
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Party ID</Label>
                      <Input
                        type="number"
                        min="1"
                        value={partyId}
                        onChange={(e) => setPartyId(e.target.value)}
                        placeholder="All"
                        className="h-8 w-20 text-xs"
                      />
                    </div>
                  )}
                  {presentation === "accounting" ? (
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Source</Label>
                      <Input
                        value={sourceType}
                        onChange={(e) => setSourceType(e.target.value)}
                        placeholder="All sources"
                        className="h-8 w-36 text-xs"
                      />
                    </div>
                  ) : null}
                  {activeFilterCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1 text-xs text-muted-foreground"
                      onClick={() => {
                        setDateFrom("");
                        setDateTo("");
                        setPartyType("all");
                        setPartyId("");
                        setSourceType("");
                      }}
                    >
                      <X className="h-3 w-3" />
                      Clear
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Ledger */}
            <div className="flex-1 overflow-y-auto">
              {report.lines.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
                  <ScrollText className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm font-medium text-foreground">No activity yet</p>
                  <p className="max-w-xs text-xs">
                    Nothing has posted to this category for the selected filters.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-28">Date</TableHead>
                      <TableHead>What happened</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.lines.map((line) => {
                      const label = ledgerLineLabel(line);
                      const type = businessTransactionType(line);
                      return (
                      <TableRow
                        key={line.line_id}
                        role="button"
                        tabIndex={0}
                        onClick={() => openLedgerLine(line)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openLedgerLine(line);
                          }
                        }}
                        className="cursor-pointer focus-visible:bg-muted/40 focus-visible:outline-none"
                      >
                        <TableCell className="align-top text-xs">
                          <div>{line.business_date}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {dateTime(line.occurred_at)}
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="text-sm font-medium">{label.primary}</div>
                          {label.secondary && (
                            <div className="text-xs text-muted-foreground">{label.secondary}</div>
                          )}
                          {line.entry_status === "reversed" && (
                            <Badge variant="destructive" className="mt-1 text-[10px]">
                              Reversed
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="align-top">
                          <Badge variant="outline" className={cn("whitespace-nowrap", businessTypeClass(type))}>
                            {type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right align-top font-mono text-xs tabular-nums text-emerald-600">
                          {Number(line.debit) ? money(line.debit) : "—"}
                        </TableCell>
                        <TableCell className="text-right align-top font-mono text-xs tabular-nums text-rose-600">
                          {Number(line.credit) ? money(line.credit) : "—"}
                        </TableCell>
                        <TableCell className="text-right align-top font-mono text-xs font-semibold tabular-nums">
                          {money(line.running_balance)}
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Pagination */}
            {report.total > 0 && (
              <div className="flex items-center justify-between gap-3 border-t px-6 py-3 text-xs text-muted-foreground">
                <span>
                  Showing {start}–{end} of {report.total}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={offset <= 0}
                    onClick={() => setOffset((value) => Math.max(0, value - PAGE_SIZE))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={offset + PAGE_SIZE >= report.total}
                    onClick={() => setOffset((value) => value + PAGE_SIZE)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : null}
      </SheetContent>
    </Sheet>
    {selectedSalesDocument ? (
      <SalesDocumentDetailSheet
        open={selectedLine != null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedLine(null);
            setSelectedSalesDocument(null);
          }
        }}
        document={selectedSalesDocument}
      />
    ) : selectedLine && !sourceLoading ? (
      <TransactionDetailSheet
        open
        onOpenChange={(open) => {
          if (!open) {
            setSelectedLine(null);
            setSourceDetail(null);
          }
        }}
        detail={sourceDetail || transactionDetail}
        loading={sourceLoading}
      />
    ) : null}
    </>
  );
}
