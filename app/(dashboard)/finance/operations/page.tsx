"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  BookOpen,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Settings2,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";

import { PaymentInstrumentsPanel } from "@/components/finance/payment-instruments-panel";
import { CashDrawerConfigPanel } from "@/components/finance/cash-drawer-config-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";
import apiClient from "@/lib/api-client";
import {
  BalanceTransferApis,
  CashAndBanksApis,
  DayBookApis,
  AccountingApis,
} from "@/lib/api/endpoints";
import { hasPermission } from "@/lib/role-permissions";
import { cn } from "@/lib/utils";

type AccountType = "bank" | "drawer";

interface CashBankAccount {
  account_type: AccountType;
  id: number;
  name: string;
  bank_type: string;
  current_balance: number | string;
  status?: string | null;
  drawer_session_id?: number | null;
}

interface ManagedBankAccount {
  id: number;
  name: string;
  bank_type: string;
  current_balance: number | string;
  is_active: boolean;
}

interface BalanceTransfer {
  id: number;
  from_account_name: string;
  to_account_name: string;
  amount: number | string;
  reference?: string | null;
  remarks?: string | null;
  transfer_date: string;
}

interface DayBookEntry {
  account_type: AccountType;
  account_id: number;
  account_name: string;
  movement_type: string;
  signed_amount: number | string;
  occurred_at: string;
  recorded_by_id?: number | null;
  metadata_json?: Record<string, unknown> | null;
}

const today = () => {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

const money = (value: number | string, currency: string) =>
  new Intl.NumberFormat("en-NP", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const titleCase = (value: string) =>
  value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const accountTypeLabel = (bankType: string) => {
  switch (bankType) {
    case "bank": return "Bank account";
    case "custom": return "Safe / cash account";
    case "owner_equity": return "Owner funds";
    default: return titleCase(bankType);
  }
};

const accountTypeDescription = (bankType: string) => {
  switch (bankType) {
    case "bank": return "Use for bank transfers and card or QR settlements.";
    case "custom": return "Use for a safe or another physical cash location.";
    case "owner_equity": return "Use when the owner adds money to, or withdraws money from, the business.";
    default: return "Financial account";
  }
};

const accountKey = (account: CashBankAccount) =>
  `${account.account_type}:${account.id}`;

function readList<T>(response: { data?: { data?: unknown } }): T[] {
  return Array.isArray(response.data?.data) ? (response.data.data as T[]) : [];
}

export default function FinanceOperationsPage() {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const initialTab = ["accounts", "transfers", "day-book", "payment-instruments", "cash-drawers"].includes(requestedTab || "")
    ? requestedTab!
    : "accounts";
  const user = useAuth((state) => state.user);
  const restaurant = useRestaurant((state) => state.restaurant);
  const restaurantId = restaurant?.id ?? user?.restaurant_id ?? null;
  const currency = restaurant?.currency || user?.currency || "NPR";
  const supportsRestaurant = restaurant?.restaurant_enabled !== false;
  const supportsHotel = restaurant?.hotel_enabled === true;

  const [businessLine, setBusinessLine] = useState<"restaurant" | "hotel">(
    supportsRestaurant ? "restaurant" : "hotel",
  );
  const [date, setDate] = useState(today);
  const [accounts, setAccounts] = useState<CashBankAccount[]>([]);
  const [managedBanks, setManagedBanks] = useState<ManagedBankAccount[]>([]);
  const [transfers, setTransfers] = useState<BalanceTransfer[]>([]);
  const [entries, setEntries] = useState<DayBookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [editingBank, setEditingBank] = useState<ManagedBankAccount | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [accountForm, setAccountForm] = useState({ name: "", bank_type: "bank" });
  const [form, setForm] = useState({
    from: "",
    to: "",
    amount: "",
    reference: "",
    remarks: "",
    transfer_date: today(),
  });

  const load = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    setError(null);
    try {
      const [accountResponse, bankResponse, transferResponse, dayBookResponse] = await Promise.all([
        apiClient.get(CashAndBanksApis.list(restaurantId, businessLine)),
        apiClient.get(AccountingApis.paymentBanks(restaurantId)),
        apiClient.get(BalanceTransferApis.list(restaurantId, businessLine)),
        apiClient.get(
          DayBookApis.list({
            restaurantId,
            businessLine,
            dateFrom: date,
            dateTo: date,
          }),
        ),
      ]);
      setAccounts(readList<CashBankAccount>(accountResponse));
      setManagedBanks(readList<ManagedBankAccount>(bankResponse));
      setTransfers(readList<BalanceTransfer>(transferResponse));
      setEntries(readList<DayBookEntry>(dayBookResponse));
    } catch (requestError: any) {
      setError(
        requestError.response?.data?.detail ||
          requestError.response?.data?.message ||
          "Could not load finance operations.",
      );
    } finally {
      setLoading(false);
    }
  }, [businessLine, date, restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(
    () => ({
      cash: accounts
        .filter((account) => account.account_type === "drawer")
        .reduce((sum, account) => sum + Number(account.current_balance || 0), 0),
      banks: accounts
        .filter((account) => account.account_type === "bank")
        .reduce((sum, account) => sum + Number(account.current_balance || 0), 0),
    }),
    [accounts],
  );

  const submitTransfer = async () => {
    if (!restaurantId) return;
    const from = accounts.find((account) => accountKey(account) === form.from);
    const to = accounts.find((account) => accountKey(account) === form.to);
    const amount = Number(form.amount);
    if (!from || !to) {
      toast.error("Select both accounts.");
      return;
    }
    if (accountKey(from) === accountKey(to)) {
      toast.error("Source and destination must be different.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid transfer amount.");
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.post(BalanceTransferApis.create, {
        restaurant_id: restaurantId,
        business_line: businessLine,
        from_account_type: from.account_type,
        from_account_id: from.id,
        to_account_type: to.account_type,
        to_account_id: to.id,
        amount,
        reference: form.reference.trim() || null,
        remarks: form.remarks.trim() || null,
        transfer_date: form.transfer_date || null,
      });
      toast.success("Balance transfer recorded.");
      setTransferOpen(false);
      setForm({
        from: "",
        to: "",
        amount: "",
        reference: "",
        remarks: "",
        transfer_date: today(),
      });
      await load();
    } catch (requestError: any) {
      toast.error(
        requestError.response?.data?.detail ||
          requestError.response?.data?.message ||
          "Could not record the transfer.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const openAccountEditor = (bank?: ManagedBankAccount) => {
    setEditingBank(bank ?? null);
    setAccountForm({ name: bank?.name ?? "", bank_type: bank?.bank_type ?? "bank" });
    setAccountOpen(true);
  };

  const saveAccount = async () => {
    if (!restaurantId) return;
    const name = accountForm.name.trim();
    if (!name) {
      toast.error("Account name is required.");
      return;
    }
    setSubmitting(true);
    try {
      if (editingBank) {
        await apiClient.patch(AccountingApis.updatePaymentBank(editingBank.id), {
          name,
          bank_type: accountForm.bank_type,
        });
        toast.success("Financial account updated.");
      } else {
        await apiClient.post(AccountingApis.createPaymentBank(), {
          restaurant_id: restaurantId,
          name,
          bank_type: accountForm.bank_type,
          is_active: true,
        });
        toast.success("Financial account created.");
      }
      setAccountForm({ name: "", bank_type: "bank" });
      setEditingBank(null);
      setAccountOpen(false);
      await load();
    } catch (requestError: any) {
      toast.error(
        requestError.response?.data?.detail ||
          requestError.response?.data?.message ||
          "Could not save the account.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const setBankActive = async (bank: ManagedBankAccount, isActive: boolean) => {
    const action = isActive ? "reactivate" : "archive";
    if (!window.confirm(`${action[0].toUpperCase()}${action.slice(1)} financial account \"${bank.name}\"?`)) return;
    setSubmitting(true);
    try {
      await apiClient.patch(AccountingApis.updatePaymentBank(bank.id), { is_active: isActive });
      toast.success(isActive ? "Financial account reactivated." : "Financial account archived.");
      await load();
    } catch (requestError: any) {
      toast.error(
        requestError.response?.data?.detail ||
          requestError.response?.data?.message ||
          `Could not ${action} the account.`,
      );
    } finally {
      setSubmitting(false);
    }
  };

  const canManageAccounts = hasPermission(user, "finance.payment_instruments.manage");
  const moneyAccounts = managedBanks.filter((account) => account.bank_type !== "owner_equity");
  const ownerAccounts = managedBanks.filter((account) => account.bank_type === "owner_equity");

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Cash & Banks</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              See where your money is held, move it between accounts, and manage how customers pay.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            {supportsHotel && supportsRestaurant ? (
              <Select
                value={businessLine}
                onValueChange={(value: "restaurant" | "hotel") => setBusinessLine(value)}
              >
                <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="restaurant">Restaurant</SelectItem>
                  <SelectItem value="hotel">Hotel</SelectItem>
                </SelectContent>
              </Select>
            ) : null}
            <Button variant="outline" size="icon" onClick={() => void load()} disabled={loading} title="Refresh balances">
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              <span className="sr-only">Refresh balances</span>
            </Button>
            <Button onClick={() => setTransferOpen(true)} disabled={accounts.length < 2}>
              <Plus className="mr-2 h-4 w-4" /> Transfer
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Settings2 className="mr-2 h-4 w-4" /> Manage
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {canManageAccounts ? (
                  <DropdownMenuItem onSelect={() => openAccountEditor()}>
                    Add bank, safe, or owner funds
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem asChild>
                  <Link href="/finance/operations?tab=cash-drawers">Configure cash drawers</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="flex items-center justify-between p-5">
              <div><p className="text-sm text-muted-foreground">Cash on hand</p><p className="mt-1 text-2xl font-semibold tabular-nums">{money(totals.cash, currency)}</p><p className="mt-1 text-xs text-muted-foreground">Cash currently held in tills.</p></div>
              <WalletCards className="h-6 w-6 text-primary" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center justify-between p-5">
              <div><p className="text-sm text-muted-foreground">Money in banks & safes</p><p className="mt-1 text-2xl font-semibold tabular-nums">{money(totals.banks, currency)}</p><p className="mt-1 text-xs text-muted-foreground">Money held outside the cash drawers.</p></div>
              <Banknote className="h-6 w-6 text-primary" />
            </CardContent>
          </Card>
        </div>

        {loading && accounts.length === 0 ? (
          <div className="flex min-h-[300px] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
        ) : (
          <Tabs defaultValue={initialTab} className="space-y-4">
            <TabsList>
              <TabsTrigger value="accounts">Where money is held</TabsTrigger>
              <TabsTrigger value="transfers">Transfers</TabsTrigger>
              <TabsTrigger value="day-book">Day Book</TabsTrigger>
              <TabsTrigger value="payment-instruments">Payment Instruments</TabsTrigger>
              <TabsTrigger value="cash-drawers">Cash Drawers</TabsTrigger>
            </TabsList>

            <TabsContent value="accounts" className="space-y-5">
              <div>
                <h2 className="text-sm font-semibold">Where business money is held</h2>
                <p className="mt-1 text-xs text-muted-foreground">Banks, safes, and tills are the places you can move or spend business money from.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {moneyAccounts.map((account) => (
                <Card key={`bank:${account.id}`} className={account.is_active ? "" : "opacity-65"}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div><p className="font-semibold">{account.name}</p><p className="mt-1 text-xs text-muted-foreground">{titleCase(account.bank_type)} · {account.is_active ? "Active" : "Archived"}</p></div>
                      <Banknote className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="mt-5 text-xl font-semibold tabular-nums">{money(account.current_balance, currency)}</p>
                    {canManageAccounts ? <div className="mt-4 flex gap-2"><Button size="sm" variant="outline" onClick={() => openAccountEditor(account)} disabled={submitting}><Pencil className="mr-1 h-3.5 w-3.5" />Edit</Button><Button size="sm" variant="ghost" onClick={() => void setBankActive(account, !account.is_active)} disabled={submitting}>{account.is_active ? "Archive" : "Reactivate"}</Button></div> : null}
                  </CardContent>
                </Card>
              ))}
              {accounts.filter((account) => account.account_type === "drawer").map((account) => (
                <Card key={accountKey(account)}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div><p className="font-semibold">{account.name}</p><p className="mt-1 text-xs text-muted-foreground">{account.account_type === "drawer" ? `Till · ${account.status || "closed"}` : titleCase(account.bank_type)}</p></div>
                      {account.account_type === "drawer" ? <WalletCards className="h-5 w-5 text-muted-foreground" /> : <Banknote className="h-5 w-5 text-muted-foreground" />}
                    </div>
                    <p className="mt-5 text-xl font-semibold tabular-nums">{money(account.current_balance, currency)}</p>
                  </CardContent>
                </Card>
              ))}
              </div>
              {moneyAccounts.length === 0 && accounts.every((account) => account.account_type !== "drawer") ? <Empty text="No cash locations are configured. Add a bank or safe here, or configure a cash drawer." /> : null}
              {ownerAccounts.length > 0 ? (
                <section className="border-t pt-5">
                  <h2 className="text-sm font-semibold">Owner funds</h2>
                  <p className="mt-1 text-xs text-muted-foreground">These record owner contributions and withdrawals. They are not places where business cash is held.</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {ownerAccounts.map((account) => (
                      <Card key={`owner:${account.id}`} className={account.is_active ? "border-amber-200/70 bg-amber-50/30 dark:border-amber-900/60 dark:bg-amber-950/10" : "opacity-65"}>
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div><p className="font-semibold">{account.name}</p><p className="mt-1 text-xs text-muted-foreground">Owner funds · {account.is_active ? "Active" : "Archived"}</p><p className="mt-1 text-xs text-muted-foreground">{accountTypeDescription(account.bank_type)}</p></div>
                            <Banknote className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <p className="mt-5 text-xl font-semibold tabular-nums">{money(account.current_balance, currency)}</p>
                          {canManageAccounts ? <div className="mt-4 flex gap-2"><Button size="sm" variant="outline" onClick={() => openAccountEditor(account)} disabled={submitting}><Pencil className="mr-1 h-3.5 w-3.5" />Edit</Button><Button size="sm" variant="ghost" onClick={() => void setBankActive(account, !account.is_active)} disabled={submitting}>{account.is_active ? "Archive" : "Reactivate"}</Button></div> : null}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </section>
              ) : null}
            </TabsContent>

            <TabsContent value="transfers">
              <Card>
                <CardHeader><CardTitle className="text-base">Transfer history</CardTitle></CardHeader>
                <CardContent className="space-y-1">
                  {transfers.length ? transfers.map((transfer) => (
                    <div key={transfer.id} className="flex flex-col gap-2 border-b py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="flex items-center gap-2 text-sm font-medium"><span>{transfer.from_account_name}</span><ArrowRight className="h-4 w-4 text-muted-foreground" /><span>{transfer.to_account_name}</span></p>
                        <p className="mt-1 text-xs text-muted-foreground">{new Date(transfer.transfer_date).toLocaleString()} {transfer.reference ? `· ${transfer.reference}` : ""}</p>
                      </div>
                      <p className="font-semibold tabular-nums">{money(transfer.amount, currency)}</p>
                    </div>
                  )) : <Empty text="No balance transfers recorded yet." />}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="day-book" className="space-y-4">
              <div className="flex items-center gap-2"><Label htmlFor="day-book-date">Business date</Label><Input id="day-book-date" type="date" className="w-auto" value={date} onChange={(event) => setDate(event.target.value)} /></div>
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><BookOpen className="h-4 w-4" />Movement ledger</CardTitle></CardHeader>
                <CardContent className="space-y-1">
                  {entries.length ? entries.map((entry, index) => {
                    const amount = Number(entry.signed_amount || 0);
                    return (
                      <div key={`${entry.account_type}:${entry.account_id}:${entry.occurred_at}:${index}`} className="flex items-center justify-between gap-4 border-b py-3 last:border-0">
                        <div className="flex min-w-0 items-center gap-3">
                          {amount >= 0 ? <ArrowDownLeft className="h-5 w-5 shrink-0 text-emerald-600" /> : <ArrowUpRight className="h-5 w-5 shrink-0 text-rose-600" />}
                          <div className="min-w-0"><p className="truncate text-sm font-medium">{titleCase(entry.movement_type)}</p><p className="truncate text-xs text-muted-foreground">{entry.account_name} · {new Date(entry.occurred_at).toLocaleString()}</p></div>
                        </div>
                        <p className={cn("shrink-0 font-semibold tabular-nums", amount >= 0 ? "text-emerald-600" : "text-rose-600")}>{amount >= 0 ? "+" : "−"}{money(Math.abs(amount), currency)}</p>
                      </div>
                    );
                  }) : <Empty text="No account movements were recorded on this date." />}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="payment-instruments">
              {restaurantId ? (
                <PaymentInstrumentsPanel
                  restaurantId={restaurantId}
                  businessLine={businessLine}
                />
              ) : (
                <Empty text="Select a restaurant to manage payment instruments." />
              )}
            </TabsContent>

            <TabsContent value="cash-drawers" id="drawer-configuration">
              {restaurantId ? (
                <CashDrawerConfigPanel
                  restaurantId={restaurantId}
                  hotelEnabled={supportsHotel}
                  businessLine={businessLine}
                />
              ) : (
                <Empty text="Select a restaurant to configure cash drawers." />
              )}
            </TabsContent>

          </Tabs>
        )}
      </main>

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Record balance transfer</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <AccountSelect label="From account" value={form.from} accounts={accounts} onChange={(value) => setForm((current) => ({ ...current, from: value }))} />
            <AccountSelect label="To account" value={form.to} accounts={accounts.filter((account) => accountKey(account) !== form.from)} onChange={(value) => setForm((current) => ({ ...current, to: value }))} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="transfer-amount">Amount</Label><Input id="transfer-amount" type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} /></div>
              <div className="space-y-2"><Label htmlFor="transfer-date">Transfer date</Label><Input id="transfer-date" type="date" value={form.transfer_date} onChange={(event) => setForm((current) => ({ ...current, transfer_date: event.target.value }))} /></div>
            </div>
            <div className="space-y-2"><Label htmlFor="transfer-reference">Reference</Label><Input id="transfer-reference" maxLength={160} value={form.reference} onChange={(event) => setForm((current) => ({ ...current, reference: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="transfer-remarks">Remarks</Label><Textarea id="transfer-remarks" maxLength={500} value={form.remarks} onChange={(event) => setForm((current) => ({ ...current, remarks: event.target.value }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setTransferOpen(false)} disabled={submitting}>Cancel</Button><Button onClick={() => void submitTransfer()} disabled={submitting}>{submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Record transfer</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingBank ? "Edit financial account" : "Add financial account"}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Banks and safes are places money is held. Owner funds track money the owner puts into or takes out of the business. Cash drawers are configured separately because they require station and cashier controls.
          </p>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="financial-account-name">Account name</Label>
              <Input id="financial-account-name" value={accountForm.name} onChange={(event) => setAccountForm((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. Nabil Bank - Main" />
            </div>
            <div className="space-y-2">
              <Label>Account type</Label>
              <Select value={accountForm.bank_type} onValueChange={(value) => setAccountForm((current) => ({ ...current, bank_type: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank">Bank account</SelectItem>
                  <SelectItem value="custom">Safe / custom cash account</SelectItem>
                  <SelectItem value="owner_equity">Owner funds (capital)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAccountOpen(false); setEditingBank(null); }} disabled={submitting}>Cancel</Button>
            <Button onClick={() => void saveAccount()} disabled={submitting}>{submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{editingBank ? "Save changes" : "Create account"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AccountSelect({ label, value, accounts, onChange }: { label: string; value: string; accounts: CashBankAccount[]; onChange: (value: string) => void }) {
  return <div className="space-y-2"><Label>{label}</Label><Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger><SelectContent>{accounts.map((account) => <SelectItem key={accountKey(account)} value={accountKey(account)}>{account.name} · {titleCase(account.account_type)}</SelectItem>)}</SelectContent></Select></div>;
}

function Empty({ text }: { text: string }) {
  return <div className="col-span-full rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{text}</div>;
}
