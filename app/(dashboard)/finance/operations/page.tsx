"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Banknote,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";

import { PaymentInstrumentsPanel } from "@/components/finance/payment-instruments-panel";
import { CashDrawerConfigPanel } from "@/components/finance/cash-drawer-config-panel";
import { AppPage } from "@/components/patterns/page/app-page";
import { PageHeader } from "@/components/patterns/page/page-header";
import { Button } from "@/components/ui/button";
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
import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";
import apiClient from "@/lib/api-client";
import {
  BalanceTransferApis,
  CashAndBanksApis,
  AccountingApis,
} from "@/lib/api/endpoints";
import { hasPermission } from "@/lib/role-permissions";
import { cn, formatCurrency, formatDateTime } from "@/lib/utils";

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

const today = () => {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

const money = (value: number | string, currency: string) =>
  formatCurrency(value, currency);

const titleCase = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const accountTypeDescription = (bankType: string) => {
  switch (bankType) {
    case "bank":
      return "Use for bank transfers and card or QR settlements.";
    case "custom":
      return "Use for a safe or another physical cash location.";
    case "owner_equity":
      return "Use when the owner adds money to, or withdraws money from, the business.";
    default:
      return "Financial account";
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
  const initialTab = [
    "accounts",
    "transfers",
    "payment-instruments",
    "cash-drawers",
  ].includes(requestedTab || "")
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
  const [activeTab, setActiveTab] = useState(initialTab);
  const [accounts, setAccounts] = useState<CashBankAccount[]>([]);
  const [managedBanks, setManagedBanks] = useState<ManagedBankAccount[]>([]);
  const [transfers, setTransfers] = useState<BalanceTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [editingBank, setEditingBank] = useState<ManagedBankAccount | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [accountForm, setAccountForm] = useState({
    name: "",
    bank_type: "bank",
  });
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
      const [accountResponse, bankResponse, transferResponse] =
        await Promise.all([
          apiClient.get(CashAndBanksApis.list(restaurantId, businessLine)),
          apiClient.get(AccountingApis.paymentBanks(restaurantId)),
          apiClient.get(BalanceTransferApis.list(restaurantId, businessLine)),
        ]);
      setAccounts(readList<CashBankAccount>(accountResponse));
      setManagedBanks(readList<ManagedBankAccount>(bankResponse));
      setTransfers(readList<BalanceTransfer>(transferResponse));
    } catch (requestError: any) {
      setError(
        requestError.response?.data?.detail ||
          requestError.response?.data?.message ||
          "Could not load finance operations.",
      );
    } finally {
      setLoading(false);
    }
  }, [businessLine, restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(
    () => ({
      cash: accounts
        .filter((account) => account.account_type === "drawer")
        .reduce(
          (sum, account) => sum + Number(account.current_balance || 0),
          0,
        ),
      banks: accounts
        .filter((account) => account.account_type === "bank")
        .reduce(
          (sum, account) => sum + Number(account.current_balance || 0),
          0,
        ),
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
    setAccountForm({
      name: bank?.name ?? "",
      bank_type: bank?.bank_type ?? "bank",
    });
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
        await apiClient.patch(
          AccountingApis.updatePaymentBank(editingBank.id),
          {
            name,
            bank_type: accountForm.bank_type,
          },
        );
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
    if (
      !window.confirm(
        `${action[0].toUpperCase()}${action.slice(1)} financial account \"${bank.name}\"?`,
      )
    )
      return;
    setSubmitting(true);
    try {
      await apiClient.patch(AccountingApis.updatePaymentBank(bank.id), {
        is_active: isActive,
      });
      toast.success(
        isActive
          ? "Financial account reactivated."
          : "Financial account archived.",
      );
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

  const canManageAccounts = hasPermission(
    user,
    "finance.payment_instruments.manage",
  );
  const moneyAccounts = managedBanks.filter(
    (account) => account.bank_type !== "owner_equity",
  );
  const ownerAccounts = managedBanks.filter(
    (account) => account.bank_type === "owner_equity",
  );
  return (
    <AppPage width="wide" density="compact">
      <PageHeader
        title="Cash & Banks"
        description="Balances, transfers and money-handling configuration."
        actions={
          <div className="flex w-full gap-2 sm:w-auto">
            <Button
              className="h-11 flex-1 rounded-xl sm:flex-none"
              onClick={() => setTransferOpen(true)}
              disabled={accounts.length < 2}
            >
              <Plus className="mr-2 h-4 w-4" /> Transfer
            </Button>
            {canManageAccounts ? (
              <Button
                variant="outline"
                className="h-11 flex-1 rounded-xl sm:flex-none"
                onClick={() => openAccountEditor()}
              >
                <Banknote className="mr-2 h-4 w-4" /> Add account
              </Button>
            ) : null}
          </div>
        }
      />

      {supportsHotel && supportsRestaurant ? (
        <div className="grid grid-cols-2 rounded-xl bg-muted/60 p-1 sm:w-72">
          {(["restaurant", "hotel"] as const).map((line) => (
            <button
              key={line}
              type="button"
              onClick={() => setBusinessLine(line)}
              className={cn(
                "min-h-10 rounded-lg px-3 text-sm font-medium capitalize transition-colors",
                businessLine === line
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground",
              )}
            >
              {line}
            </button>
          ))}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <dl
        aria-label="Financial position"
        className="grid overflow-hidden rounded-xl border border-border bg-background sm:grid-cols-2"
      >
        <div className="flex min-w-0 items-center justify-between gap-4 border-b border-border px-4 py-3 sm:border-b-0 sm:border-r">
          <dt className="text-sm text-muted-foreground">Cash on hand</dt>
          <dd className="truncate text-base font-semibold tabular-nums">
            {money(totals.cash, currency)}
          </dd>
        </div>
        <div className="flex min-w-0 items-center justify-between gap-4 px-4 py-3">
          <dt className="text-sm text-muted-foreground">Banks & safes</dt>
          <dd className="truncate text-base font-semibold tabular-nums">
            {money(totals.banks, currency)}
          </dd>
        </div>
      </dl>

      {loading && accounts.length === 0 ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : (
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-4"
        >
          <div className="max-w-full overflow-x-auto overscroll-x-contain border-b border-border">
            <TabsList className="h-auto w-max min-w-full justify-start rounded-none bg-transparent p-0">
              <TabsTrigger
                value="accounts"
                className="min-h-11 shrink-0 rounded-none border-b-2 border-transparent px-4 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                Accounts
              </TabsTrigger>
              <TabsTrigger
                value="transfers"
                className="min-h-11 shrink-0 rounded-none border-b-2 border-transparent px-4 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                Transfers
              </TabsTrigger>
              <TabsTrigger
                value="payment-instruments"
                className="min-h-11 shrink-0 rounded-none border-b-2 border-transparent px-4 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                Payment methods
              </TabsTrigger>
              <TabsTrigger
                value="cash-drawers"
                className="min-h-11 shrink-0 rounded-none border-b-2 border-transparent px-4 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                Cash drawers
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="accounts" className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Accounts</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Banks, safes and tills where business money is held.
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 shrink-0"
                onClick={() => void load()}
                disabled={loading}
                aria-label="Refresh balances"
              >
                <RefreshCw
                  className={cn("h-4 w-4", loading && "animate-spin")}
                />
              </Button>
            </div>
            <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-background">
              {moneyAccounts.map((account) => (
                <div
                  key={`bank:${account.id}`}
                  className={cn(
                    "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 p-4 lg:grid-cols-[minmax(0,1fr)_180px_auto]",
                    !account.is_active && "opacity-65",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{account.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {titleCase(account.bank_type)} ·{" "}
                        {account.is_active ? "Active" : "Archived"}
                      </p>
                    </div>
                    <Banknote className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-right text-base font-semibold tabular-nums">
                    {money(account.current_balance, currency)}
                  </p>
                  {canManageAccounts ? (
                    <div className="col-span-2 mt-2 flex gap-1 lg:col-span-1 lg:mt-0 lg:justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openAccountEditor(account)}
                        disabled={submitting}
                      >
                        <Pencil className="mr-1 h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          void setBankActive(account, !account.is_active)
                        }
                        disabled={submitting}
                      >
                        {account.is_active ? "Archive" : "Reactivate"}
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
              {accounts
                .filter((account) => account.account_type === "drawer")
                .map((account) => (
                  <div
                    key={accountKey(account)}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 p-4 lg:grid-cols-[minmax(0,1fr)_180px_auto]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{account.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {account.account_type === "drawer"
                            ? `Till · ${account.status || "closed"}`
                            : titleCase(account.bank_type)}
                        </p>
                      </div>
                      {account.account_type === "drawer" ? (
                        <WalletCards className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Banknote className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <p className="text-right text-base font-semibold tabular-nums">
                      {money(account.current_balance, currency)}
                    </p>
                  </div>
                ))}
            </div>
            {moneyAccounts.length === 0 &&
            accounts.every((account) => account.account_type !== "drawer") ? (
              <Empty text="No cash locations are configured. Add a bank or safe here, or configure a cash drawer." />
            ) : null}
            {ownerAccounts.length > 0 ? (
              <section className="border-t pt-5">
                <h2 className="text-sm font-semibold">Owner funds</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  These record owner contributions and withdrawals. They are not
                  places where business cash is held.
                </p>
                <div className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-background">
                  {ownerAccounts.map((account) => (
                    <div
                      key={`owner:${account.id}`}
                      className={cn("p-4", !account.is_active && "opacity-65")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{account.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Owner funds ·{" "}
                            {account.is_active ? "Active" : "Archived"}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {accountTypeDescription(account.bank_type)}
                          </p>
                        </div>
                        <Banknote className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <p className="mt-3 text-base font-semibold tabular-nums">
                        {money(account.current_balance, currency)}
                      </p>
                      {canManageAccounts ? (
                        <div className="mt-2 flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openAccountEditor(account)}
                            disabled={submitting}
                          >
                            <Pencil className="mr-1 h-3.5 w-3.5" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              void setBankActive(account, !account.is_active)
                            }
                            disabled={submitting}
                          >
                            {account.is_active ? "Archive" : "Reactivate"}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </TabsContent>

          <TabsContent value="transfers" className="space-y-4">
            <div>
              <h2 className="text-base font-semibold">Transfers</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Recorded movement between tills, safes and bank accounts.
              </p>
            </div>
            <section className="overflow-hidden rounded-xl border border-border bg-background">
              <div className="divide-y divide-border">
                {transfers.length ? (
                  transfers.map((transfer) => (
                    <div
                      key={transfer.id}
                      className="flex items-start justify-between gap-3 px-4 py-3"
                    >
                      <div>
                        <p className="flex items-center gap-2 text-sm font-medium">
                          <span>{transfer.from_account_name}</span>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          <span>{transfer.to_account_name}</span>
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDateTime(transfer.transfer_date)}{" "}
                          {transfer.reference ? `· ${transfer.reference}` : ""}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold tabular-nums">
                        {money(transfer.amount, currency)}
                      </p>
                    </div>
                  ))
                ) : (
                  <Empty text="No balance transfers recorded yet." />
                )}
              </div>
            </section>
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
                currency={currency}
              />
            ) : (
              <Empty text="Select a restaurant to configure cash drawers." />
            )}
          </TabsContent>
        </Tabs>
      )}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Record balance transfer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <AccountSelect
              label="From account"
              value={form.from}
              accounts={accounts}
              onChange={(value) =>
                setForm((current) => ({ ...current, from: value }))
              }
            />
            <AccountSelect
              label="To account"
              value={form.to}
              accounts={accounts.filter(
                (account) => accountKey(account) !== form.from,
              )}
              onChange={(value) =>
                setForm((current) => ({ ...current, to: value }))
              }
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="transfer-amount">Amount</Label>
                <Input
                  id="transfer-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.amount}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      amount: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="transfer-date">Transfer date</Label>
                <Input
                  id="transfer-date"
                  type="date"
                  value={form.transfer_date}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      transfer_date: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="transfer-reference">Reference</Label>
              <Input
                id="transfer-reference"
                maxLength={160}
                value={form.reference}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    reference: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="transfer-remarks">Remarks</Label>
              <Textarea
                id="transfer-remarks"
                maxLength={500}
                value={form.remarks}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    remarks: event.target.value,
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTransferOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={() => void submitTransfer()} disabled={submitting}>
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Record transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingBank ? "Edit financial account" : "Add financial account"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Banks and safes are places money is held. Owner funds track money
            the owner puts into or takes out of the business. Cash drawers are
            configured separately because they require station and cashier
            controls.
          </p>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="financial-account-name">Account name</Label>
              <Input
                id="financial-account-name"
                value={accountForm.name}
                onChange={(event) =>
                  setAccountForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="e.g. Nabil Bank - Main"
              />
            </div>
            <div className="space-y-2">
              <Label>Account type</Label>
              <Select
                value={accountForm.bank_type}
                onValueChange={(value) =>
                  setAccountForm((current) => ({
                    ...current,
                    bank_type: value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank">Bank account</SelectItem>
                  <SelectItem value="custom">
                    Safe / custom cash account
                  </SelectItem>
                  <SelectItem value="owner_equity">
                    Owner funds (capital)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAccountOpen(false);
                setEditingBank(null);
              }}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={() => void saveAccount()} disabled={submitting}>
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {editingBank ? "Save changes" : "Create account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppPage>
  );
}

function AccountSelect({
  label,
  value,
  accounts,
  onChange,
}: {
  label: string;
  value: string;
  accounts: CashBankAccount[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select account" />
        </SelectTrigger>
        <SelectContent>
          {accounts.map((account) => (
            <SelectItem key={accountKey(account)} value={accountKey(account)}>
              {account.name} · {titleCase(account.account_type)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="col-span-full rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
