"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Banknote,
  ChevronRight,
  History,
  Loader2,
  Plus,
  ReceiptText,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

import {
  CashBankAccountSelect,
  type CashBankAccountOption,
} from "@/components/finance/cash-bank-account-select";
import { FinanceSalesInvoiceDialog } from "@/components/finance/sales/finance-sales-invoice-dialog";
import { FinanceSalesReturnDialog } from "@/components/finance/sales/finance-sales-return-dialog";
import {
  TransactionDetailSheet,
  type TransactionDetailModel,
} from "@/components/finance/transaction-detail/transaction-detail-sheet";
import { SalesDocumentDetailSheet } from "@/components/finance/transaction-detail/sales-document-detail-sheet";
import {
  partyLedgerEntryDetail,
  settlementAllocationDetail,
} from "@/components/finance/transaction-detail/party-workspace-detail";
import { salesReturnDetail } from "@/components/finance/transaction-detail/sales-return-detail";
import { PartyActivityRow } from "@/components/finance/party-workspace/party-activity-row";
import {
  DetailField,
  DetailGrid,
} from "@/components/patterns/data/detail-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import apiClient from "@/lib/api-client";
import { CustomerApis, PartyLedgerApis } from "@/lib/api/endpoints";
import { financeSalesApi } from "@/lib/api/finance-sales-api";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { FinanceSalesDocument } from "@/types/finance-sales";

type CustomerDetailWorkspaceProps = { customerId: number };
const money = (value: unknown) => Number(value || 0);

export function CustomerDetailWorkspace({
  customerId,
}: CustomerDetailWorkspaceProps) {
  const user = useAuth((state) => state.user);
  const router = useRouter();
  const [customer, setCustomer] = useState<any>(null);
  const [statement, setStatement] = useState<any>(null);
  const [invoices, setInvoices] = useState<FinanceSalesDocument[]>([]);
  const [returns, setReturns] = useState<FinanceSalesDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<
    "activity" | "sales" | "returns" | "payments" | "open" | "statement"
  >("activity");
  const [collectOpen, setCollectOpen] = useState(false);
  const [saleOpen, setSaleOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [paymentOutOpen, setPaymentOutOpen] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [payingOut, setPayingOut] = useState(false);
  const [amount, setAmount] = useState("");
  const [account, setAccount] = useState<CashBankAccountOption | null>(null);
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [manualAllocation, setManualAllocation] = useState(false);
  const [allocations, setAllocations] = useState<Record<number, string>>({});
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutAccount, setPayoutAccount] =
    useState<CashBankAccountOption | null>(null);
  const [payoutDate, setPayoutDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [payoutReference, setPayoutReference] = useState("");
  const [payoutNotes, setPayoutNotes] = useState("");
  const [selectedDetail, setSelectedDetail] =
    useState<TransactionDetailModel | null>(null);
  const [selectedSalesDocument, setSelectedSalesDocument] =
    useState<FinanceSalesDocument | null>(null);
  const [manualPayoutAllocation, setManualPayoutAllocation] = useState(false);
  const [payoutAllocations, setPayoutAllocations] = useState<
    Record<number, string>
  >({});

  const load = useCallback(async () => {
    if (!user?.restaurant_id || !Number.isFinite(customerId) || customerId <= 0)
      return;
    setLoading(true);
    try {
      const [customerResponse, statementResponse, invoiceResult, returnResult] =
        await Promise.all([
          apiClient.get(CustomerApis.getCustomer(customerId)),
          apiClient.get(
            PartyLedgerApis.statement(
              "customer",
              customerId,
              user.restaurant_id,
            ),
          ),
          financeSalesApi.list(Number(user.restaurant_id), {
            kind: "invoice",
            limit: 500,
          }),
          financeSalesApi.list(Number(user.restaurant_id), {
            kind: "credit_note",
            limit: 500,
          }),
        ]);
      setCustomer(customerResponse.data?.data);
      setStatement(statementResponse.data?.data);
      setInvoices(
        invoiceResult.documents.filter(
          (document) => Number(document.customer_id) === customerId,
        ),
      );
      setReturns(
        returnResult.documents.filter(
          (document) => Number(document.customer_id) === customerId,
        ),
      );
    } catch (error: any) {
      console.error("Unable to load customer workspace", error);
      toast.error(
        error.response?.data?.detail ||
          "Could not load this customer's records.",
      );
    } finally {
      setLoading(false);
    }
  }, [customerId, user?.restaurant_id]);

  useEffect(() => {
    void load();
  }, [load]);

  const entries = useMemo(
    () =>
      [...(statement?.entries || [])].sort((a: any, b: any) =>
        String(b.occurred_at || b.created_at).localeCompare(
          String(a.occurred_at || a.created_at),
        ),
      ),
    [statement],
  );
  const openInvoices = useMemo(
    () =>
      entries.filter(
        (entry: any) =>
          entry.entry_side === "debt" && money(entry.open_amount) > 0.004,
      ),
    [entries],
  );
  const receivable = Math.max(money(statement?.net_open), 0);
  const customerCredit = Math.max(-money(statement?.net_open), 0);
  const collections = entries.filter(
    (entry: any) => entry.entry_type === "customer_collection",
  );
  const customerPaymentsOut = entries.filter(
    (entry: any) => entry.entry_type === "customer_payment_out",
  );
  const openCustomerCredits = entries.filter(
    (entry: any) =>
      entry.entry_side === "credit" && money(entry.open_amount) > 0.004,
  );
  const totalSales = invoices.reduce(
    (sum, invoice) => sum + money(invoice.grand_total),
    0,
  );
  const totalReturns = returns.reduce(
    (sum, creditNote) => sum + money(creditNote.grand_total),
    0,
  );
  const totalCollected = collections.reduce(
    (sum, entry: any) => sum + money(entry.amount),
    0,
  );
  const refunded = returns
    .filter(
      (creditNote) =>
        creditNote.settlement_status === "refunded" ||
        creditNote.settlement_status === "refund_now",
    )
    .reduce((sum, creditNote) => sum + money(creditNote.grand_total), 0);
  const totalPaidOut =
    customerPaymentsOut.reduce(
      (sum, entry: any) => sum + money(entry.amount),
      0,
    ) + refunded;
  const openSalesDocument = useCallback((document: FinanceSalesDocument) => {
    if (document.document_kind === "credit_note") {
      setSelectedSalesDocument(null);
      setSelectedDetail(salesReturnDetail(document));
      return;
    }
    setSelectedDetail(null);
    setSelectedSalesDocument(document);
  }, []);
  const openEntryDetail = useCallback(
    (entry: any) => {
      const salesDocument =
        entry.entry_type === "customer_invoice"
          ? invoices.find((document) => document.id === Number(entry.source_id))
          : null;
      if (salesDocument) {
        openSalesDocument(salesDocument);
        return;
      }
      setSelectedSalesDocument(null);
      setSelectedDetail(
        partyLedgerEntryDetail(entry, "customer", statement?.allocations || []),
      );
    },
    [invoices, openSalesDocument, statement],
  );
  const manualTotal = Object.values(allocations).reduce(
    (sum, value) => sum + money(value),
    0,
  );
  const fifoPreview = useMemo(() => {
    let remaining = money(amount);
    return [...openInvoices]
      .sort(
        (a: any, b: any) =>
          String(a.due_date || "9999-12-31").localeCompare(
            String(b.due_date || "9999-12-31"),
          ) ||
          String(a.business_date).localeCompare(String(b.business_date)) ||
          a.id - b.id,
      )
      .map((invoice: any) => {
        const allocationAmount = Math.min(
          Math.max(remaining, 0),
          money(invoice.open_amount),
        );
        remaining -= allocationAmount;
        return { ...invoice, allocationAmount };
      })
      .filter((invoice: any) => invoice.allocationAmount > 0.004);
  }, [amount, openInvoices]);
  const fifoAllocated = fifoPreview.reduce(
    (sum: number, invoice: any) => sum + money(invoice.allocationAmount),
    0,
  );
  const manualPayoutTotal = Object.values(payoutAllocations).reduce(
    (sum, value) => sum + money(value),
    0,
  );
  const payoutFifoPreview = useMemo(() => {
    let remaining = money(payoutAmount);
    return [...openCustomerCredits]
      .sort(
        (a: any, b: any) =>
          String(a.financial_date).localeCompare(String(b.financial_date)) ||
          a.id - b.id,
      )
      .map((credit: any) => {
        const allocationAmount = Math.min(
          Math.max(remaining, 0),
          money(credit.open_amount),
        );
        remaining -= allocationAmount;
        return { ...credit, allocationAmount };
      })
      .filter((credit: any) => credit.allocationAmount > 0.004);
  }, [openCustomerCredits, payoutAmount]);
  const payoutFifoAllocated = payoutFifoPreview.reduce(
    (sum: number, credit: any) => sum + money(credit.allocationAmount),
    0,
  );

  const openCollection = () => {
    setAmount(receivable ? receivable.toFixed(2) : "");
    setAccount(null);
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setReference("");
    setNotes("");
    setManualAllocation(false);
    setAllocations({});
    setCollectOpen(true);
  };

  const openPaymentOut = () => {
    setPayoutAmount(customerCredit ? customerCredit.toFixed(2) : "");
    setPayoutAccount(null);
    setPayoutDate(new Date().toISOString().slice(0, 10));
    setPayoutReference("");
    setPayoutNotes("");
    setManualPayoutAllocation(false);
    setPayoutAllocations({});
    setPaymentOutOpen(true);
  };

  const submitCollection = async () => {
    if (!account || money(amount) <= 0) {
      toast.error(
        "Enter an amount and choose where the customer payment was received.",
      );
      return;
    }
    if (money(amount) > receivable + 0.004) {
      toast.error(
        "A customer collection cannot exceed this customer's open invoices.",
      );
      return;
    }
    if (manualAllocation && Math.abs(manualTotal - money(amount)) > 0.004) {
      toast.error("Manual invoice allocations must equal the payment amount.");
      return;
    }
    if (
      manualAllocation &&
      openInvoices.some(
        (invoice: any) =>
          money(allocations[invoice.id]) > money(invoice.open_amount) + 0.004,
      )
    ) {
      toast.error(
        "An invoice allocation cannot exceed that invoice's remaining balance.",
      );
      return;
    }
    setCollecting(true);
    try {
      await apiClient.post(CustomerApis.repayCredit(customerId), {
        amount: money(amount),
        account_type: account.account_type,
        account_id: account.id,
        payment_method:
          account.account_type === "drawer" ? "cash" : "bank_transfer",
        paid_date: new Date(`${paymentDate}T12:00:00.000Z`).toISOString(),
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
        allocations: manualAllocation
          ? openInvoices
              .filter((invoice: any) => money(allocations[invoice.id]) > 0)
              .map((invoice: any) => ({
                target_entry_id: invoice.id,
                amount: money(allocations[invoice.id]),
              }))
          : [],
      });
      toast.success(
        manualAllocation
          ? "Customer payment allocated to the selected invoices."
          : "Customer payment applied to the oldest invoice first.",
      );
      setCollectOpen(false);
      await load();
    } catch (error: any) {
      toast.error(
        error.response?.data?.detail ||
          "Could not record the customer payment.",
      );
    } finally {
      setCollecting(false);
    }
  };

  const submitPaymentOut = async () => {
    if (!payoutAccount || money(payoutAmount) <= 0) {
      toast.error(
        "Enter an amount and choose the account used to pay the customer.",
      );
      return;
    }
    if (money(payoutAmount) > customerCredit + 0.004) {
      toast.error(
        "A payment out cannot exceed this customer's available credit.",
      );
      return;
    }
    if (
      manualPayoutAllocation &&
      Math.abs(manualPayoutTotal - money(payoutAmount)) > 0.004
    ) {
      toast.error(
        "Manual customer-credit allocations must equal the payment-out amount.",
      );
      return;
    }
    if (
      manualPayoutAllocation &&
      openCustomerCredits.some(
        (credit: any) =>
          money(payoutAllocations[credit.id]) >
          money(credit.open_amount) + 0.004,
      )
    ) {
      toast.error(
        "A credit allocation cannot exceed that credit's available balance.",
      );
      return;
    }
    setPayingOut(true);
    try {
      await apiClient.post(CustomerApis.payOut(customerId), {
        amount: money(payoutAmount),
        account_type: payoutAccount.account_type,
        account_id: payoutAccount.id,
        payment_method:
          payoutAccount.account_type === "drawer" ? "cash" : "bank_transfer",
        paid_date: new Date(`${payoutDate}T12:00:00.000Z`).toISOString(),
        reference: payoutReference.trim() || undefined,
        notes: payoutNotes.trim() || undefined,
        allocations: manualPayoutAllocation
          ? openCustomerCredits
              .filter((credit: any) => money(payoutAllocations[credit.id]) > 0)
              .map((credit: any) => ({
                source_entry_id: credit.id,
                amount: money(payoutAllocations[credit.id]),
              }))
          : [],
      });
      toast.success(
        manualPayoutAllocation
          ? "Customer credit paid out from the selected credit items."
          : "Customer credit paid out using the oldest available credit first.",
      );
      setPaymentOutOpen(false);
      await load();
    } catch (error: any) {
      toast.error(
        error.response?.data?.detail ||
          "Could not record the customer payment out.",
      );
    } finally {
      setPayingOut(false);
    }
  };

  if (loading)
    return (
      <div className="flex min-h-[360px] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading customer workspace…
      </div>
    );
  if (!customer) return <div className="p-6">Customer not found.</div>;

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 px-4 pb-24 pt-4 lg:px-8 lg:pb-8">
      <div className="flex flex-col gap-4 border-b pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
              {String(customer.full_name || customer.name || "CU")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">
                  {customer.full_name || customer.name}
                </h1>
                <Badge variant={customer.is_active ? "default" : "secondary"}>
                  {customer.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {[customer.phone, customer.email, customer.business_name]
                  .filter(Boolean)
                  .join(" · ") || "Customer sales and settlement history"}
              </p>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Current balance
            </p>
            <p
              className={
                receivable > 0
                  ? "mt-0.5 text-xl font-semibold text-orange-600"
                  : "mt-0.5 text-xl font-semibold"
              }
            >
              {receivable > 0
                ? `${formatCurrency(receivable)} receivable`
                : customerCredit > 0
                  ? `${formatCurrency(customerCredit)} customer credit`
                  : "Settled"}
            </p>
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium lg:hidden">Actions</p>
          <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 lg:flex lg:flex-wrap lg:justify-end">
            <Button
              variant="outline"
              className="h-12 justify-start lg:h-11 lg:w-auto"
              onClick={() => setReturnOpen(true)}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Sales return
            </Button>
            <Button
              variant="outline"
              className="h-12 justify-start lg:h-11 lg:w-auto"
              onClick={() => setSaleOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Record sale
            </Button>
            <Button
              variant="outline"
              className="h-12 justify-start lg:h-11 lg:w-auto"
              onClick={openPaymentOut}
              disabled={customerCredit <= 0}
            >
              <Banknote className="mr-2 h-4 w-4" />
              Payment out
            </Button>
            <Button
              className="order-first h-12 justify-start lg:order-none lg:h-11 lg:w-auto"
              onClick={openCollection}
            >
              <ReceiptText className="mr-2 h-4 w-4" />
              Receive payment
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="space-y-5">
          <section>
            <h2 className="text-base font-semibold">Details</h2>
            <DetailGrid className="mt-3 gap-y-3">
              <DetailField
                label="Phone"
                value={customer.phone || "Not recorded"}
              />
              <DetailField
                label="Email"
                value={customer.email || "Not recorded"}
              />
              <DetailField
                label="Address"
                value={
                  customer.address || customer.billing_address || "Not recorded"
                }
              />
              <div>
                <p className="text-muted-foreground">Notes</p>
                <p>{customer.notes || "—"}</p>
              </div>
            </DetailGrid>
          </section>
        </div>
        <div className="space-y-5">
          <section>
            <h2 className="text-base font-semibold">Financial summary</h2>
            <div className="mt-3 overflow-hidden rounded-xl border bg-card sm:grid sm:grid-cols-2 sm:divide-x">
              <Metric
                label="Customer credit"
                value={formatCurrency(customerCredit)}
              />
              <Metric label="Sales" value={formatCurrency(totalSales)} />
              <Metric
                label="Sales returns"
                value={formatCurrency(totalReturns)}
              />
              <Metric
                label="Payments received"
                value={formatCurrency(totalCollected)}
              />
              <Metric
                label="Payments out"
                value={formatCurrency(totalPaidOut)}
              />
            </div>
          </section>
          <section className="space-y-3">
            <h2 className="text-base font-semibold">Quick access</h2>
            <div className="overflow-hidden rounded-xl border bg-card divide-y">
              <Button
                variant="ghost"
                className="h-12 w-full justify-between rounded-none px-3 hover:bg-muted/50"
                onClick={() => setTab("open")}
              >
                <span>Open invoices</span>
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span className="tabular-nums">{openInvoices.length}</span>
                  <ChevronRight className="h-4 w-4" />
                </span>
              </Button>
              <Button
                variant="ghost"
                className="h-12 w-full justify-between rounded-none px-3 hover:bg-muted/50"
                onClick={() => setTab("statement")}
              >
                <span>View statement</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          </section>
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Activity</h2>
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11"
                onClick={() => void load()}
                aria-label="Refresh customer activity"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
              {(
                [
                  ["activity", "All"],
                  ["sales", "Invoices"],
                  ["returns", "Returns"],
                  ["payments", "Payments"],
                ] as const
              ).map(([value, label]) => (
                <Button
                  key={value}
                  size="sm"
                  className="shrink-0"
                  variant={tab === value ? "secondary" : "ghost"}
                  onClick={() => setTab(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
            {tab === "activity" && (
              <CustomerActivityFeed
                entries={entries}
                returns={returns}
                onOpenEntry={openEntryDetail}
                onOpenDocument={openSalesDocument}
              />
            )}
            {tab === "sales" && (
              <CustomerInvoiceRegister
                invoices={invoices}
                openInvoices={openInvoices}
                onOpen={openSalesDocument}
              />
            )}
            {tab === "returns" && (
              <CustomerReturnRegister
                returns={returns}
                onOpen={openSalesDocument}
              />
            )}
            {tab === "payments" && (
              <CustomerPaymentRegister
                entries={[...collections, ...customerPaymentsOut]}
                returns={returns}
                onOpenEntry={openEntryDetail}
                onOpenDocument={openSalesDocument}
              />
            )}
            {tab === "open" && (
              <OpenInvoiceList
                invoices={openInvoices}
                onOpen={openEntryDetail}
                onCollect={openCollection}
                onReturn={() => setReturnOpen(true)}
              />
            )}
            {tab === "statement" && (
              <StatementWithAllocations
                entries={entries}
                allocations={statement?.allocations || []}
                onOpen={openEntryDetail}
                onOpenAllocation={(allocation) =>
                  setSelectedDetail(
                    settlementAllocationDetail(allocation, "customer"),
                  )
                }
              />
            )}
          </section>
        </div>
      </div>

      <Dialog open={collectOpen} onOpenChange={setCollectOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[680px]">
          <DialogHeader>
            <DialogTitle>
              Receive payment from {customer.full_name || customer.name}
            </DialogTitle>
            <DialogDescription>
              Money enters the selected account once. Open invoices are settled
              oldest due first unless you choose exact allocations.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Amount received</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Payment date</Label>
                <Input
                  type="date"
                  value={paymentDate}
                  onChange={(event) => setPaymentDate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Reference</Label>
                <Input
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  placeholder="Receipt or transfer #"
                />
              </div>
            </div>
            <CashBankAccountSelect
              label="Received into"
              value={account}
              onChange={setAccount}
            />
            <div className="rounded-lg border p-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={manualAllocation}
                  onChange={(event) =>
                    setManualAllocation(event.target.checked)
                  }
                />
                Allocate to specific invoices
              </label>
              <p className="mt-1 text-xs text-muted-foreground">
                Leave this off for FIFO. Manual allocations must use the
                complete collection amount.
              </p>
            </div>
            {!manualAllocation && (
              <FifoPreview
                lines={fifoPreview}
                paymentAmount={money(amount)}
                allocated={fifoAllocated}
              />
            )}
            {manualAllocation && (
              <div className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium">Open sales invoices</p>
                  <span className="text-sm text-muted-foreground">
                    Allocated {formatCurrency(manualTotal)}
                  </span>
                </div>
                {openInvoices.length ? (
                  openInvoices.map((invoice: any) => (
                    <div
                      key={invoice.id}
                      className="grid grid-cols-[1fr_150px] items-center gap-3 border-t py-2 first:border-t-0"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {invoice.source_reference || invoice.display_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Open {formatCurrency(invoice.open_amount)} ·{" "}
                          {formatDate(invoice.financial_date)}
                        </p>
                      </div>
                      <Input
                        type="number"
                        min="0"
                        max={String(invoice.open_amount)}
                        step="0.01"
                        value={allocations[invoice.id] || ""}
                        onChange={(event) =>
                          setAllocations((current) => ({
                            ...current,
                            [invoice.id]: event.target.value,
                          }))
                        }
                      />
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    There are no open invoices.
                  </p>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional payment note"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCollectOpen(false)}
              disabled={collecting}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void submitCollection()}
              disabled={collecting}
            >
              {collecting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Record payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={paymentOutOpen} onOpenChange={setPaymentOutOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[680px]">
          <DialogHeader>
            <DialogTitle>
              Pay customer {customer.full_name || customer.name}
            </DialogTitle>
            <DialogDescription>
              This pays back the customer&apos;s existing credit. Use Sales
              return when you need to reverse a specific sale.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Amount paid out</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={String(customerCredit)}
                  value={payoutAmount}
                  onChange={(event) => setPayoutAmount(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Payment date</Label>
                <Input
                  type="date"
                  value={payoutDate}
                  onChange={(event) => setPayoutDate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Reference</Label>
                <Input
                  value={payoutReference}
                  onChange={(event) => setPayoutReference(event.target.value)}
                  placeholder="Receipt or transfer #"
                />
              </div>
            </div>
            <CashBankAccountSelect
              label="Paid from"
              value={payoutAccount}
              onChange={setPayoutAccount}
            />
            <div className="rounded-lg border p-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={manualPayoutAllocation}
                  onChange={(event) =>
                    setManualPayoutAllocation(event.target.checked)
                  }
                />
                Choose specific customer credits
              </label>
              <p className="mt-1 text-xs text-muted-foreground">
                Leave this off for FIFO. Manual allocations must use the
                complete payment-out amount.
              </p>
            </div>
            {!manualPayoutAllocation && (
              <CreditFifoPreview
                lines={payoutFifoPreview}
                paymentAmount={money(payoutAmount)}
                allocated={payoutFifoAllocated}
              />
            )}
            {manualPayoutAllocation && (
              <div className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium">Available customer credit</p>
                  <span className="text-sm text-muted-foreground">
                    Allocated {formatCurrency(manualPayoutTotal)}
                  </span>
                </div>
                {openCustomerCredits.length ? (
                  openCustomerCredits.map((credit: any) => (
                    <div
                      key={credit.id}
                      className="grid grid-cols-[1fr_150px] items-center gap-3 border-t py-2 first:border-t-0"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {credit.source_reference || credit.display_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Available {formatCurrency(credit.open_amount)} ·{" "}
                          {formatDate(credit.financial_date)}
                        </p>
                      </div>
                      <Input
                        type="number"
                        min="0"
                        max={String(credit.open_amount)}
                        step="0.01"
                        value={payoutAllocations[credit.id] || ""}
                        onChange={(event) =>
                          setPayoutAllocations((current) => ({
                            ...current,
                            [credit.id]: event.target.value,
                          }))
                        }
                      />
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    There is no available customer credit.
                  </p>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={payoutNotes}
                onChange={(event) => setPayoutNotes(event.target.value)}
                placeholder="Optional payout note"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPaymentOutOpen(false)}
              disabled={payingOut}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void submitPaymentOut()}
              disabled={payingOut}
            >
              {payingOut ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Record payment out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <FinanceSalesInvoiceDialog
        open={saleOpen}
        onOpenChange={setSaleOpen}
        onCreated={() => void load()}
        initialCustomerId={customerId}
      />
      <FinanceSalesReturnDialog
        open={returnOpen}
        onOpenChange={setReturnOpen}
        onCreated={() => void load()}
        initialCustomerId={customerId}
      />
      <TransactionDetailSheet
        open={Boolean(selectedDetail)}
        onOpenChange={(open) => !open && setSelectedDetail(null)}
        detail={selectedDetail}
      />
      <SalesDocumentDetailSheet
        open={Boolean(selectedSalesDocument)}
        onOpenChange={(open) => !open && setSelectedSalesDocument(null)}
        document={selectedSalesDocument}
      />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between px-3 py-2.5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="ml-3 shrink-0 font-semibold tabular-nums">{value}</p>
    </div>
  );
}
function customerActivity(entry: any) {
  if (entry.entry_type === "customer_invoice")
    return {
      kind: "bill" as const,
      tone: "warning" as const,
      label: "Sales invoice",
      className: "text-orange-600",
    };
  if (entry.entry_type === "customer_collection")
    return {
      kind: "payment" as const,
      tone: "positive" as const,
      label: "Payment received",
      className: "text-emerald-600",
    };
  if (entry.entry_type === "customer_payment_out")
    return {
      kind: "payment" as const,
      tone: "warning" as const,
      label: "Payment out",
      className: "text-orange-600",
    };
  if (entry.entry_type === "customer_credit_note")
    return {
      kind: "return" as const,
      tone: "positive" as const,
      label: "Sales-return credit",
      className: "text-emerald-600",
    };
  return {
    kind: entry.entry_type?.includes("opening")
      ? ("opening" as const)
      : ("credit" as const),
    tone:
      entry.entry_side === "debt"
        ? ("warning" as const)
        : ("positive" as const),
    label: entry.entry_side === "debt" ? "Amount due" : "Customer credit",
    className:
      entry.entry_side === "debt" ? "text-orange-600" : "text-emerald-600",
  };
}
function customerOpenLabel(entry: any) {
  const open = money(entry.open_amount);
  if (open <= 0.004)
    return entry.entry_side === "debt" ? "Settled" : "Fully applied";
  return `Open ${formatCurrency(open)}`;
}
function ActivityList({
  entries,
  returns,
  onOpenEntry,
  onOpenDocument,
}: {
  entries: any[];
  returns: FinanceSalesDocument[];
  onOpenEntry: (entry: any) => void;
  onOpenDocument: (document: FinanceSalesDocument) => void;
}) {
  const refundReturns = returns.filter(
    (item) =>
      item.settlement_status === "refunded" ||
      item.settlement_status === "refund_now",
  );
  return (
    <div className="divide-y border-y">
      <div className="sr-only">Activity</div>
      <div>
        {[
          ...entries.map((entry) => ({
            type: "entry" as const,
            at: entry.occurred_at || entry.created_at,
            data: entry,
          })),
          ...refundReturns.map((document) => ({
            type: "refund" as const,
            at: document.created_at,
            data: document,
          })),
        ]
          .sort((a, b) => String(b.at).localeCompare(String(a.at)))
          .map((item) => {
            if (item.type === "refund")
              return (
                <button
                  type="button"
                  key={`refund-${item.data.id}`}
                  onClick={() => onOpenDocument(item.data)}
                  className="flex w-full items-center justify-between gap-4 rounded-md px-2 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div>
                    <p className="text-sm font-medium">
                      Sales return {item.data.document_number}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(item.data.business_date)} · Refund paid to
                      customer
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-orange-600">
                    Refunded {formatCurrency(item.data.grand_total)}
                  </p>
                </button>
              );
            const presentation = customerActivity(item.data);
            return (
              <button
                type="button"
                key={item.data.id}
                onClick={() => onOpenEntry(item.data)}
                className="flex w-full items-center justify-between gap-4 rounded-md px-2 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div>
                  <p className="text-sm font-medium">
                    {item.data.display_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(item.data.financial_date)} ·{" "}
                    {item.data.source_reference ||
                      item.data.entry_type.replaceAll("_", " ")}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={`text-sm font-semibold ${presentation.className}`}
                  >
                    {presentation.label} {formatCurrency(item.data.amount)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {customerOpenLabel(item.data)}
                  </p>
                </div>
              </button>
            );
          })}
      </div>
    </div>
  );
}
function CustomerActivityFeed({
  entries,
  returns,
  onOpenEntry,
  onOpenDocument,
}: {
  entries: any[];
  returns: FinanceSalesDocument[];
  onOpenEntry: (entry: any) => void;
  onOpenDocument: (document: FinanceSalesDocument) => void;
}) {
  const refundReturns = returns.filter(
    (item) =>
      item.settlement_status === "refunded" ||
      item.settlement_status === "refund_now",
  );
  const rows = [
    ...entries.map((entry) => ({
      type: "entry" as const,
      at: entry.occurred_at || entry.created_at,
      data: entry,
    })),
    ...refundReturns.map((document) => ({
      type: "refund" as const,
      at: document.created_at,
      data: document,
    })),
  ].sort((a, b) => String(b.at).localeCompare(String(a.at)));

  return (
    <div className="overflow-hidden rounded-xl border bg-card divide-y">
      {rows.length ? (
        rows.map((item) => {
          if (item.type === "refund") {
            return (
              <PartyActivityRow
                key={`refund-${item.data.id}`}
                kind="return"
                title={`Sales return ${item.data.document_number}`}
                metadata={`${formatDate(item.data.business_date)} - Refund`}
                amount={formatCurrency(item.data.grand_total)}
                amountTone="warning"
                status="Refunded"
                onClick={() => onOpenDocument(item.data)}
              />
            );
          }

          const presentation = customerActivity(item.data);
          return (
            <PartyActivityRow
              key={item.data.id}
              kind={presentation.kind}
              title={item.data.display_name}
              metadata={`${formatDate(item.data.financial_date)} - ${item.data.source_reference || item.data.entry_type.replaceAll("_", " ")}`}
              amount={formatCurrency(item.data.amount)}
              amountTone={presentation.tone}
              status={customerOpenLabel(item.data)}
              onClick={() => onOpenEntry(item.data)}
            />
          );
        })
      ) : (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          No customer activity yet.
        </p>
      )}
    </div>
  );
}

function CustomerInvoiceRegister({
  invoices,
  openInvoices,
  onOpen,
}: {
  invoices: FinanceSalesDocument[];
  openInvoices: any[];
  onOpen: (invoice: FinanceSalesDocument) => void;
}) {
  const openByInvoice = new Map(
    openInvoices
      .filter((entry) => entry.source_type === "finance_sales_invoice")
      .map((entry) => [entry.source_id, entry]),
  );

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">Sales invoices</h3>
      <div className="overflow-hidden rounded-xl border bg-card divide-y">
        {invoices.length ? (
          invoices.map((invoice) => {
            const entry = openByInvoice.get(invoice.id);
            return (
              <PartyActivityRow
                key={invoice.id}
                kind="bill"
                title={invoice.document_number}
                metadata={`${invoice.source_type === "pos_order" ? "POS sale" : "Manual sale"} - ${formatDate(invoice.business_date)}`}
                amount={formatCurrency(invoice.grand_total)}
                amountTone={entry ? "warning" : "default"}
                status={
                  entry
                    ? `${formatCurrency(entry.open_amount)} open`
                    : "Settled"
                }
                onClick={() => onOpen(invoice)}
              />
            );
          })
        ) : (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            No sales invoices have been recorded for this customer.
          </p>
        )}
      </div>
    </section>
  );
}

function CustomerReturnRegister({
  returns,
  onOpen,
}: {
  returns: FinanceSalesDocument[];
  onOpen: (creditNote: FinanceSalesDocument) => void;
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">Sales returns</h3>
      <div className="overflow-hidden rounded-xl border bg-card divide-y">
        {returns.length ? (
          returns.map((creditNote) => (
            <PartyActivityRow
              key={creditNote.id}
              kind="return"
              title={creditNote.document_number}
              metadata={`${formatDate(creditNote.business_date)} - Sales return`}
              amount={formatCurrency(creditNote.grand_total)}
              amountTone="warning"
              status={creditNote.settlement_status.replaceAll("_", " ")}
              onClick={() => onOpen(creditNote)}
            />
          ))
        ) : (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            No sales returns have been recorded for this customer.
          </p>
        )}
      </div>
    </section>
  );
}

function CustomerPaymentRegister({
  entries,
  returns,
  onOpenEntry,
  onOpenDocument,
}: {
  entries: any[];
  returns: FinanceSalesDocument[];
  onOpenEntry: (entry: any) => void;
  onOpenDocument: (document: FinanceSalesDocument) => void;
}) {
  const refunds = returns.filter(
    (item) =>
      item.settlement_status === "refunded" ||
      item.settlement_status === "refund_now",
  );
  const rows = [
    ...entries.map((entry) => ({
      type: "entry" as const,
      at: entry.financial_date,
      data: entry,
    })),
    ...refunds.map((document) => ({
      type: "refund" as const,
      at: document.business_date,
      data: document,
    })),
  ].sort((a, b) => String(b.at).localeCompare(String(a.at)));

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">Payments</h3>
      <div className="overflow-hidden rounded-xl border bg-card divide-y">
        {rows.length ? (
          rows.map((item) =>
            item.type === "refund" ? (
              <PartyActivityRow
                key={`refund-${item.data.id}`}
                kind="return"
                title={`Refund for ${item.data.document_number}`}
                metadata={`Sales return - ${formatDate(item.data.business_date)}`}
                amount={formatCurrency(item.data.grand_total)}
                amountTone="warning"
                status="Refunded"
                onClick={() => onOpenDocument(item.data)}
              />
            ) : (
              <PartyActivityRow
                key={item.data.id}
                kind="payment"
                title={item.data.display_name}
                metadata={`${item.data.payment_method?.replaceAll("_", " ") || "Payment"} - ${formatDate(item.data.financial_date)}`}
                amount={formatCurrency(item.data.amount)}
                amountTone="positive"
                status={customerOpenLabel(item.data)}
                onClick={() => onOpenEntry(item.data)}
              />
            ),
          )
        ) : (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            No customer payments have been recorded.
          </p>
        )}
      </div>
    </section>
  );
}

function InvoiceList({
  invoices,
  openInvoices,
  onOpen,
  onReturn,
}: {
  invoices: FinanceSalesDocument[];
  openInvoices: any[];
  onOpen: (invoice: FinanceSalesDocument) => void;
  onReturn: (invoiceId: number) => void;
}) {
  const openByInvoice = new Map(
    openInvoices
      .filter((entry) => entry.source_type === "finance_sales_invoice")
      .map((entry) => [entry.source_id, entry]),
  );
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Sales invoices</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {invoices.length ? (
          invoices.map((invoice) => {
            const entry = openByInvoice.get(invoice.id);
            return (
              <div
                key={invoice.id}
                role="button"
                tabIndex={0}
                onClick={() => onOpen(invoice)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ")
                    onOpen(invoice);
                }}
                className="flex cursor-pointer flex-col gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{invoice.document_number}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(invoice.business_date)} ·{" "}
                    {invoice.source_type === "pos_order"
                      ? "POS sale"
                      : "Manual sale"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-medium">
                      {formatCurrency(invoice.grand_total)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {entry
                        ? `Remaining ${formatCurrency(entry.open_amount)}`
                        : "Settled"}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      onReturn(invoice.id);
                    }}
                  >
                    Return
                  </Button>
                </div>
              </div>
            );
          })
        ) : (
          <Empty text="No sales invoices have been recorded for this customer." />
        )}
      </CardContent>
    </Card>
  );
}
function ReturnList({
  returns,
  onOpen,
}: {
  returns: FinanceSalesDocument[];
  onOpen: (creditNote: FinanceSalesDocument) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Sales returns</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {returns.length ? (
          returns.map((creditNote) => (
            <button
              type="button"
              key={creditNote.id}
              onClick={() => onOpen(creditNote)}
              className="flex w-full items-center justify-between gap-4 rounded-lg border p-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div>
                <p className="font-medium">{creditNote.document_number}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(creditNote.business_date)} ·{" "}
                  {creditNote.settlement_status.replaceAll("_", " ")}
                </p>
              </div>
              <p className="font-medium text-emerald-600">
                {formatCurrency(creditNote.grand_total)}
              </p>
            </button>
          ))
        ) : (
          <Empty text="No sales returns have been recorded for this customer." />
        )}
      </CardContent>
    </Card>
  );
}
function PaymentList({
  entries,
  returns,
  onOpenEntry,
  onOpenDocument,
}: {
  entries: any[];
  returns: FinanceSalesDocument[];
  onOpenEntry: (entry: any) => void;
  onOpenDocument: (document: FinanceSalesDocument) => void;
}) {
  const refunds = returns.filter(
    (item) =>
      item.settlement_status === "refunded" ||
      item.settlement_status === "refund_now",
  );
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Payments in and out</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {entries.length || refunds.length ? (
          <>
            {entries.map((entry) => {
              const paymentOut = entry.entry_type === "customer_payment_out";
              return (
                <button
                  type="button"
                  key={entry.id}
                  onClick={() => onOpenEntry(entry)}
                  className="flex w-full items-center justify-between gap-4 rounded-lg border p-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div>
                    <p className="font-medium">{entry.display_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(entry.financial_date)} ·{" "}
                      {entry.payment_method?.replaceAll("_", " ") ||
                        "Payment method not recorded"}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline">
                      {paymentOut ? "Payment out" : "Payment in"}
                    </Badge>
                    <p
                      className={`mt-1 font-medium ${paymentOut ? "text-orange-600" : "text-emerald-600"}`}
                    >
                      {paymentOut ? "Paid" : "Received"}{" "}
                      {formatCurrency(entry.amount)}
                    </p>
                  </div>
                </button>
              );
            })}
            {refunds.map((creditNote) => (
              <button
                type="button"
                key={`refund-${creditNote.id}`}
                onClick={() => onOpenDocument(creditNote)}
                className="flex w-full items-center justify-between gap-4 rounded-lg border p-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div>
                  <p className="font-medium">
                    Refund for {creditNote.document_number}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(creditNote.business_date)} · Sales return
                  </p>
                </div>
                <div className="text-right">
                  <Badge variant="outline">Payment out</Badge>
                  <p className="mt-1 font-medium text-orange-600">
                    Refunded {formatCurrency(creditNote.grand_total)}
                  </p>
                </div>
              </button>
            ))}
          </>
        ) : (
          <Empty text="No customer payments or refunds have been recorded." />
        )}
      </CardContent>
    </Card>
  );
}
function OpenInvoiceList({
  invoices,
  onCollect,
  onReturn,
  onOpen,
}: {
  invoices: any[];
  onCollect: () => void;
  onReturn: (invoiceId: number) => void;
  onOpen: (entry: any) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          Open invoices ready for collection
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {invoices.length ? (
          invoices.map((invoice) => (
            <div
              key={invoice.id}
              role="button"
              tabIndex={0}
              onClick={() => onOpen(invoice)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") onOpen(invoice);
              }}
              className="flex cursor-pointer flex-col gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium">
                  {invoice.source_reference || invoice.display_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(invoice.financial_date)} · Original{" "}
                  {formatCurrency(invoice.amount)} · Remaining{" "}
                  {formatCurrency(invoice.open_amount)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(event) => {
                    event.stopPropagation();
                    onReturn(invoice.source_id);
                  }}
                >
                  Return
                </Button>
                <Button
                  size="sm"
                  onClick={(event) => {
                    event.stopPropagation();
                    onCollect();
                  }}
                >
                  Receive payment
                </Button>
              </div>
            </div>
          ))
        ) : (
          <Empty text="There are no unpaid sales invoices." />
        )}
      </CardContent>
    </Card>
  );
}
function FifoPreview({
  lines,
  paymentAmount,
  allocated,
}: {
  lines: any[];
  paymentAmount: number;
  allocated: number;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <p className="text-sm font-medium">FIFO allocation preview</p>
      <p className="mt-1 text-xs text-muted-foreground">
        This is what will be settled when you record the payment.
      </p>
      <div className="mt-3 space-y-2">
        {lines.length ? (
          lines.map((line) => (
            <div
              key={line.id}
              className="grid grid-cols-[1fr_auto] gap-3 text-sm"
            >
              <div>
                <p className="font-medium">
                  {line.source_reference || line.display_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(line.financial_date)} · Remaining{" "}
                  {formatCurrency(line.open_amount)}
                </p>
              </div>
              <p className="font-medium">
                {formatCurrency(line.allocationAmount)}
              </p>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            No open invoices are available to settle.
          </p>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between border-t pt-3 text-sm">
        <span>Collection applied</span>
        <span className="font-semibold">
          {formatCurrency(allocated)} of {formatCurrency(paymentAmount)}
        </span>
      </div>
    </div>
  );
}
function CreditFifoPreview({
  lines,
  paymentAmount,
  allocated,
}: {
  lines: any[];
  paymentAmount: number;
  allocated: number;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <p className="text-sm font-medium">FIFO customer-credit preview</p>
      <p className="mt-1 text-xs text-muted-foreground">
        The oldest available customer credit is paid out first.
      </p>
      <div className="mt-3 space-y-2">
        {lines.length ? (
          lines.map((line) => (
            <div
              key={line.id}
              className="grid grid-cols-[1fr_auto] gap-3 text-sm"
            >
              <div>
                <p className="font-medium">
                  {line.source_reference || line.display_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(line.financial_date)} · Available{" "}
                  {formatCurrency(line.open_amount)}
                </p>
              </div>
              <p className="font-medium">
                {formatCurrency(line.allocationAmount)}
              </p>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            No customer credit is available to pay out.
          </p>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between border-t pt-3 text-sm">
        <span>Credit applied</span>
        <span className="font-semibold">
          {formatCurrency(allocated)} of {formatCurrency(paymentAmount)}
        </span>
      </div>
    </div>
  );
}
function StatementWithAllocations({
  entries,
  allocations,
  onOpen,
  onOpenAllocation,
}: {
  entries: any[];
  allocations: any[];
  onOpen: (entry: any) => void;
  onOpenAllocation: (allocation: any) => void;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Open-item statement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {entries.length ? (
            entries.map((entry) => (
              <button
                type="button"
                key={entry.id}
                onClick={() => onOpen(entry)}
                className="grid w-full grid-cols-[1fr_auto_auto] items-center gap-4 rounded-lg border p-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div>
                  <p className="font-medium">{entry.display_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(entry.financial_date)} · {entry.status}
                  </p>
                </div>
                <Badge variant="outline">
                  {entry.entry_side === "debt" ? "Invoice" : "Payment / credit"}
                </Badge>
                <div className="text-right text-sm">
                  <p>{formatCurrency(entry.amount)}</p>
                  <p className="text-muted-foreground">
                    {customerOpenLabel(entry)}
                  </p>
                </div>
              </button>
            ))
          ) : (
            <Empty text="No statement entries have been recorded." />
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Settlement allocations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {allocations.length ? (
            allocations.map((allocation) => (
              <button
                type="button"
                key={allocation.id}
                onClick={() => onOpenAllocation(allocation)}
                className="grid w-full gap-2 rounded-lg border p-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[1fr_auto_1fr_auto] sm:items-center"
              >
                <div>
                  <p className="text-sm font-medium">
                    {allocation.source_reference ||
                      allocation.source_display_name ||
                      "Customer payment"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Payment received
                  </p>
                </div>
                <span className="text-center text-muted-foreground">
                  applied to
                </span>
                <div>
                  <p className="text-sm font-medium">
                    {allocation.target_reference ||
                      allocation.target_display_name ||
                      "Sales invoice"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(allocation.financial_date)}
                  </p>
                </div>
                <p className="text-right font-semibold">
                  {formatCurrency(allocation.amount)}
                </p>
              </button>
            ))
          ) : (
            <Empty text="No payment allocations have been recorded." />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="py-10 text-center text-sm text-muted-foreground">
      <History className="mx-auto mb-2 h-5 w-5" />
      {text}
    </div>
  );
}
