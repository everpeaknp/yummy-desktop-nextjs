"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, RefreshCw, Settings, Wrench } from "lucide-react";
import { toast } from "sonner";

import apiClient from "@/lib/api-client";
import { AccountingApis } from "@/lib/api/endpoints";
import { hasPermission } from "@/lib/role-permissions";
import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FinanceSectionTabs } from "@/components/finance/finance-section-tabs";
import { AccountingNav } from "./accounting-nav";
import type { AccountingSetupStatus, PaymentInstrument, PaymentInstrumentInput, PaymentBank, PaymentBankInput } from "@/types/accounting";

type BaseResponse<T> = {
  status?: string;
  data?: T;
  message?: string;
};

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function setupStatusClasses(ready?: boolean) {
  if (ready) return "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300";
  return "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300";
}

function fiscalStartLabel(status: AccountingSetupStatus | null) {
  const settings = status?.settings;
  if (!settings) return "-";
  return `${settings.fiscal_year_start_month}/${settings.fiscal_year_start_day}`;
}

function keyList(values?: string[]) {
  if (!values?.length) return "Ready";
  return values.map((value) => value.replace(/_/g, " ")).join(", ");
}

function errorMessage(error: any, fallback: string) {
  return (
    error?.response?.data?.detail ||
    error?.response?.data?.message ||
    error?.message ||
    fallback
  );
}

export function AccountingSetupClient() {
  const user = useAuth((state) => state.user);
  const me = useAuth((state) => state.me);
  const restaurant = useRestaurant((state) => state.restaurant);
  const fetchRestaurant = useRestaurant((state) => state.fetchRestaurant);
  const router = useRouter();
  const [status, setStatus] = useState<AccountingSetupStatus | null>(null);
  const [instruments, setInstruments] = useState<PaymentInstrument[]>([]);
  const [loading, setLoading] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [instrumentSaving, setInstrumentSaving] = useState(false);
  const [instrumentUpdatingId, setInstrumentUpdatingId] = useState<number | null>(null);
  const [instrumentMethod, setInstrumentMethod] = useState("card");
  const [instrumentType, setInstrumentType] = useState("terminal");
  const [instrumentName, setInstrumentName] = useState("");
  const [instrumentProvider, setInstrumentProvider] = useState("");
  const [instrumentBankId, setInstrumentBankId] = useState<string>("none");

  const [banks, setBanks] = useState<PaymentBank[]>([]);

  const canView = hasPermission(user, "finance.accounting.view");
  const canRepairSetup = hasPermission(user, "finance.accounting.setup");
  const canManageInstruments = hasPermission(user, "finance.payment_instruments.manage");
  const restaurantId = user?.restaurant_id;

  useEffect(() => {
    const checkAuth = async () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      if (!user && token) await me();
      if (!user && !token) router.push("/");
    };
    void checkAuth();
  }, [user, me, router]);

  useEffect(() => {
    void fetchRestaurant();
  }, [fetchRestaurant]);

  const loadSetupStatus = useCallback(async () => {
    if (!restaurantId || !canView || !canRepairSetup) {
      toast.error("Setup repair requires finance.accounting.setup permission.");
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.get<BaseResponse<AccountingSetupStatus>>(
        AccountingApis.setupStatus({ restaurantId })
      );
      setStatus(res.data?.data ?? null);
    } catch (error) {
      console.error("Failed to load accounting setup status", error);
      setStatus(null);
      toast.error("Failed to load accounting setup status");
    } finally {
      setLoading(false);
    }
  }, [restaurantId, canView, canRepairSetup]);

  const loadInstruments = useCallback(async () => {
    if (!restaurantId || !canView) return;
    try {
      const res = await apiClient.get<BaseResponse<PaymentInstrument[]>>(
        AccountingApis.paymentInstruments({ restaurantId, businessLine: "restaurant" })
      );
      setInstruments(res.data?.data ?? []);
    } catch (error) {
      console.error("Failed to load payment instruments", error);
      setInstruments([]);
    }
  }, [restaurantId, canView]);

  const loadBanks = useCallback(async () => {
    if (!restaurantId || !canView) return;
    try {
      const res = await apiClient.get<BaseResponse<PaymentBank[]>>(
        AccountingApis.paymentBanks(restaurantId)
      );
      setBanks(res.data?.data ?? []);
    } catch (error) {
      console.error("Failed to load payment banks", error);
      setBanks([]);
    }
  }, [restaurantId, canView]);

  useEffect(() => {
    void loadSetupStatus();
    void loadBanks();
    void loadInstruments();
  }, [loadSetupStatus, loadBanks, loadInstruments]);

  const repairSetup = async () => {
    if (!restaurantId || !canView) return;
    setRepairing(true);
    try {
      const res = await apiClient.post<BaseResponse<AccountingSetupStatus>>(
        AccountingApis.repairSetup({ restaurantId })
      );
      const result = res.data?.data ?? null;
      setStatus(result);
      toast.success(
        `Repair setup completed: ${result?.accounts_created ?? 0} accounts and ${result?.mappings_created ?? 0} mappings added.`
      );
    } catch (error) {
      console.error("Failed to repair accounting setup", error);
      toast.error("Failed to repair accounting setup");
    } finally {
      setRepairing(false);
    }
  };

  const instrumentNameOptions = useMemo(() => {
    if (instrumentMethod === "card") {
      return Array.isArray(restaurant?.payment_cards)
        ? restaurant.payment_cards
            .filter((card) => card && typeof card.name === "string" && card.name.trim())
            .map((card) => ({
              value: String(card.name).trim(),
              label: String(card.name).trim(),
              hint: card.identifier ? String(card.identifier) : null,
            }))
        : [];
    }

    if (instrumentMethod === "digital") {
      return Array.isArray(restaurant?.payment_qrs)
        ? restaurant.payment_qrs
            .filter((qr) => qr && typeof qr.name === "string" && qr.name.trim())
            .map((qr) => ({
              value: String(qr.name).trim(),
              label: String(qr.name).trim(),
              hint: null,
            }))
        : [];
    }

    return [];
  }, [instrumentMethod, restaurant]);

  const matchingInstrument = useMemo(() => {
    const normalizedName = instrumentName.trim().toLowerCase();
    if (!normalizedName) return null;
    return instruments.find((instrument) => (
      String(instrument.payment_method || "").toLowerCase() === instrumentMethod &&
      String(instrument.name || "").trim().toLowerCase() === normalizedName
    )) || null;
  }, [instrumentMethod, instrumentName, instruments]);
  const duplicateInstrumentIsActive = Boolean(matchingInstrument?.is_active);
  const duplicateInstrumentIsInactive = Boolean(matchingInstrument && !matchingInstrument.is_active);

  const createInstrument = async () => {
    if (!restaurantId || !canManageInstruments) return;
    if (!instrumentName.trim()) {
      toast.error("Instrument name is required.");
      return;
    }
    if (duplicateInstrumentIsActive) {
      toast.error(`${instrumentName.trim()} is already active for ${instrumentMethod}.`);
      return;
    }
    setInstrumentSaving(true);
    try {
      const payload: PaymentInstrumentInput = {
        restaurant_id: restaurantId,
        business_line: "restaurant",
        payment_method: instrumentMethod,
        instrument_type: instrumentType,
        name: instrumentName.trim(),
        provider: instrumentProvider.trim() || null,
        bank_id: instrumentBankId !== "none" ? Number(instrumentBankId) : null,
        settlement_cycle_days: 1,
        is_active: true,
      };
      await apiClient.post(AccountingApis.createPaymentInstrument(), payload);
      setInstrumentName("");
      setInstrumentProvider("");
      setInstrumentBankId("none");
      await loadInstruments();
      toast.success("Payment instrument created.");
    } catch (error) {
      console.error("Failed to create payment instrument", error);
      toast.error(errorMessage(error, "Failed to create payment instrument"));
    } finally {
      setInstrumentSaving(false);
    }
  };

  const deactivateInstrument = async (instrument: PaymentInstrument) => {
    if (!canManageInstruments) return;
    const confirmed = window.confirm(
      `Deactivate payment instrument "${instrument.name}"?\n\nIt will stop appearing as an active checkout or settlement option.`
    );
    if (!confirmed) return;

    setInstrumentUpdatingId(instrument.id);
    try {
      await apiClient.post(AccountingApis.deactivatePaymentInstrument(instrument.id));
      await loadInstruments();
      toast.success(`Deactivated ${instrument.name}.`);
    } catch (error) {
      console.error("Failed to deactivate payment instrument", error);
      toast.error(errorMessage(error, "Failed to deactivate payment instrument"));
    } finally {
      setInstrumentUpdatingId(null);
    }
  };



  const cards = useMemo(
    () => [
      {
        label: "Setup status",
        value: status?.ready ? "Ready" : "Needs repair",
        tone: status?.ready ? "ok" : "warning",
      },
      {
        label: "Accounts",
        value: String(status?.account_count ?? 0),
        tone: (status?.missing_account_codes?.length ?? 0) === 0 ? "ok" : "warning",
      },
      {
        label: "Mappings",
        value: String(status?.mapping_count ?? 0),
        tone: (status?.missing_mapping_count ?? 0) === 0 ? "ok" : "warning",
      },
      {
        label: "Base currency",
        value: status?.settings?.base_currency ?? "NPR",
        tone: "neutral",
      },
      {
        label: "Fiscal year start",
        value: fiscalStartLabel(status),
        tone: "neutral",
      },
      {
        label: "IRD sync",
        value: status?.settings?.ird_sync_enabled ? "Enabled" : "Disabled",
        tone: "neutral",
      },
    ],
    [status]
  );

  const checklist = useMemo(() => {
    const missingAccounts = status?.missing_account_codes ?? [];
    const missingCoreMappings = status?.blocking_core_mapping_keys ?? [];
    const missingOptionalMappings = status?.non_blocking_mapping_keys ?? [];
    return [
      {
        title: "Chart of accounts",
        detail: missingAccounts.length
          ? `Missing required account codes: ${missingAccounts.join(", ")}`
          : "Default restaurant account template is available.",
        href: "/finance/accounting/chart-of-accounts",
        blocked: missingAccounts.length > 0,
        badge: missingAccounts.length > 0 ? "Blocked" : "Ready",
      },
      {
        title: "Core mappings",
        detail: missingCoreMappings.length
          ? keyList(missingCoreMappings)
          : "Required accounts for drawer cash, main cash, bank, sales, tax, refunds, variance, and Suspense.",
        href: "/finance/accounting/ledger-mapping",
        blocked: missingCoreMappings.length > 0,
        badge: missingCoreMappings.length > 0 ? "Blocked" : "Ready",
      },
      {
        title: "Non-blocking mappings",
        detail: missingOptionalMappings.length
          ? keyList(missingOptionalMappings)
          : "Card terminals, digital wallets, drawer expense categories, and custom routes can be tuned later.",
        href: "/finance/accounting/ledger-mapping",
        blocked: false,
        badge: missingOptionalMappings.length > 0 ? "Review" : "Ready",
      },
      {
        title: "Opening balances",
        detail: "Post opening balances before relying on balance sheet and aging reports.",
        href: "/finance/accounting/opening-balances",
        blocked: false,
        badge: "Review",
      },
      {
        title: "Drawer policies",
        detail: "Use the Daybook to confirm drawer opening cash, transfers, expenses, and closing cash.",
        href: "/finance/accounting/daybook",
        blocked: false,
        badge: "Review",
      },
      {
        title: "Settlement instruments",
        detail: "Card and digital collections clear through settlement batches before bank posting.",
        href: "/finance/accounting/settlements",
        blocked: false,
        badge: "Review",
      },
    ];
  }, [status]);

  const setupActions = [
    { label: "Chart of accounts", href: "/finance/accounting/chart-of-accounts" },
    { label: "Ledger mappings", href: "/finance/accounting/ledger-mapping" },
    { label: "Daybook", href: "/finance/accounting/daybook" },
    { label: "Settlements", href: "/finance/accounting/settlements" },
  ];

  if (!user) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-3 p-6">
        <h1 className="text-2xl font-bold">Accounting setup</h1>
        <div className="border border-border p-6 text-sm text-muted-foreground">
          Your user does not have finance access.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-6 p-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Link href="/finance/accounting">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Accounting setup</h1>
              <p className="text-sm text-muted-foreground">
                Default chart, ledger mappings, and setup repair for this restaurant.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={loadSetupStatus} disabled={loading || repairing}>
              <RefreshCw className={loading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
              Refresh
            </Button>
            <Button
              onClick={repairSetup}
              disabled={loading || repairing || !canRepairSetup}
              title={!canRepairSetup ? "Setup repair requires finance.accounting.setup permission." : undefined}
            >
              {repairing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wrench className="mr-2 h-4 w-4" />}
              Repair setup
            </Button>
          </div>
        </div>
        <FinanceSectionTabs />
        <AccountingNav />
      </div>

      {!canRepairSetup ? (
        <div className="border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900">
          Setup repair requires finance.accounting.setup permission.
        </div>
      ) : null}

      <Card>
        <CardHeader className="border-b border-border p-4">
          <CardTitle className="flex items-center justify-between gap-3 text-base">
            <span className="flex items-center gap-2">
              {status?.ready ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              )}
              Accounting setup
            </span>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${setupStatusClasses(status?.ready)}`}>
              {loading ? "loading" : status?.ready ? "ready" : "needs repair"}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          {loading && !status ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading setup status...
            </div>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                {cards.map((card) => (
                  <div
                    key={card.label}
                    className={`border p-3 ${
                      card.tone === "ok"
                        ? "border-emerald-500/30 bg-emerald-500/10"
                        : card.tone === "warning"
                          ? "border-amber-500/30 bg-amber-500/10"
                          : "border-border bg-background"
                    }`}
                  >
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {card.label}
                    </div>
                    <div className="mt-2 text-xl font-bold">{card.value}</div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                {setupActions.map((action) => (
                  <Link key={action.href} href={action.href}>
                    <Button variant="outline" size="sm">
                      {action.label}
                    </Button>
                  </Link>
                ))}
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                {checklist.map((item) => (
                  <div key={item.title} className="flex items-start justify-between gap-3 rounded-md border p-3">
                    <div className="min-w-0">
                      <div className="font-medium">{item.title}</div>
                      <div className="mt-1 text-sm text-muted-foreground">{item.detail}</div>
                    </div>
                    <Link href={item.href} className="shrink-0">
                      <Badge variant={item.blocked ? "destructive" : item.badge === "Ready" ? "default" : "outline"}>
                        {item.badge}
                      </Badge>
                    </Link>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="border border-border p-4">
                  <div className="mb-3 flex items-center gap-2 font-semibold">
                    <Settings className="h-4 w-4" />
                    Setup details
                  </div>
                  <div className="grid gap-2 text-sm">
                    <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
                      <span className="text-muted-foreground">Missing account codes</span>
                      <span className="font-semibold">{status?.missing_account_codes?.length ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
                      <span className="text-muted-foreground">Missing mapping count</span>
                      <span className="font-semibold">{status?.missing_mapping_count ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
                      <span className="text-muted-foreground">Latest run</span>
                      <span className="font-semibold">{status?.latest_run?.status ?? "-"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Latest run time</span>
                      <span className="font-semibold">{formatDateTime(status?.latest_run?.created_at)}</span>
                    </div>
                  </div>
                </div>

                <div className="border border-border p-4">
                  <div className="mb-3 flex items-center gap-2 font-semibold">
                    <AlertTriangle className="h-4 w-4" />
                    Repair notes
                  </div>
                  <div className="space-y-3 text-sm">
                    <p className="text-muted-foreground">
                      Repair setup creates missing default accounts and mappings only. It does not delete existing accounts,
                      rewrite journals, or reset historical balances.
                    </p>
                    {(status?.warnings?.length ?? 0) > 0 ? (
                      <div className="space-y-2">
                        {status?.warnings.map((warning) => (
                          <div key={warning} className="border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-800 dark:text-amber-300">
                            {warning}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-emerald-800 dark:text-emerald-300">
                        No setup warnings returned.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {(status?.missing_account_codes?.length ?? 0) > 0 && (
                <div className="border border-amber-500/30 bg-amber-500/10 p-4">
                  <div className="mb-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
                    Missing account codes
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {status?.missing_account_codes.map((code) => (
                      <span key={code} className="border border-amber-500/40 bg-background px-2 py-1 text-xs font-semibold">
                        {code}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>



      <Card>
        <CardHeader className="border-b border-border p-4">
          <CardTitle className="flex items-center justify-between gap-3 text-base">
            <span>Payment instruments</span>
            <Badge variant="outline">{instruments.length} configured</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_1.4fr_1.2fr_auto]">
            <div className="space-y-1.5">
              <Label htmlFor="instrument-method">Method</Label>
              <Select value={instrumentMethod} onValueChange={setInstrumentMethod}>
                <SelectTrigger id="instrument-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="digital">Digital</SelectItem>
                  <SelectItem value="fonepay">Fonepay</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="instrument-type">Type</Label>
              <Select value={instrumentType} onValueChange={setInstrumentType}>
                <SelectTrigger id="instrument-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="terminal">Terminal</SelectItem>
                  <SelectItem value="qr">QR</SelectItem>
                  <SelectItem value="wallet">Wallet</SelectItem>
                  <SelectItem value="bank_qr">Bank QR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="instrument-name">Instrument name</Label>
              {instrumentNameOptions.length > 0 ? (
                <Select value={instrumentName} onValueChange={setInstrumentName}>
                  <SelectTrigger id="instrument-name">
                    <SelectValue placeholder="Select from Settings" />
                  </SelectTrigger>
                  <SelectContent>
                    {instrumentNameOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.hint ? `${option.label} (${option.hint})` : option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="instrument-name"
                  value={instrumentName}
                  onChange={(event) => setInstrumentName(event.target.value)}
                  placeholder="Nabil POS 1"
                />
              )}
              <p className="text-xs text-muted-foreground">
                {instrumentNameOptions.length > 0
                  ? "Options come from Manage / Settings / Payments & POS so names stay aligned with checkout."
                  : "No matching Settings entries found for this method, so manual name entry is enabled."}
              </p>
              {duplicateInstrumentIsActive ? (
                <p className="text-xs font-medium text-amber-600">
                  This instrument is already active for {instrumentMethod}.
                </p>
              ) : null}
              {duplicateInstrumentIsInactive ? (
                <p className="text-xs font-medium text-muted-foreground">
                  This name already exists but is inactive. Adding will fail until it is reactivated or renamed.
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="instrument-provider">Provider</Label>
              <Input
                id="instrument-provider"
                value={instrumentProvider}
                onChange={(event) => setInstrumentProvider(event.target.value)}
                placeholder="Nabil, Fonepay, Esewa"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="instrument-bank">Bank Assignment</Label>
              <Select value={instrumentBankId} onValueChange={setInstrumentBankId}>
                <SelectTrigger id="instrument-bank">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {banks.map((b) => (
                    <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                className="w-full"
                onClick={createInstrument}
                disabled={!canManageInstruments || instrumentSaving || duplicateInstrumentIsActive}
                title={!canManageInstruments ? "Payment instrument management permission is required." : undefined}
              >
                {instrumentSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Add
              </Button>
            </div>
          </div>

          {instruments.length === 0 ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              No card, digital, or Fonepay instruments are configured. Once instruments are added, checkout and settlements
              validate new non-cash payments against this list.
            </div>
          ) : (
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {instruments.map((instrument) => (
                <div key={instrument.id} className="rounded-md border border-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{instrument.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {instrument.payment_method} / {instrument.instrument_type}
                      </div>
                    </div>
                    <Badge variant={instrument.is_active ? "default" : "outline"}>
                      {instrument.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground flex gap-2">
                    <span>{instrument.provider || "No provider"} · T+{instrument.settlement_cycle_days}</span>
                    {instrument.bank_id ? (
                      <Badge variant="outline" className="text-xs ml-auto">
                        {banks.find((b) => b.id === instrument.bank_id)?.name || `Bank #${instrument.bank_id}`}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="mt-3 flex justify-end">
                    {instrument.is_active ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => deactivateInstrument(instrument)}
                        disabled={!canManageInstruments || instrumentUpdatingId === instrument.id}
                        title={!canManageInstruments ? "Payment instrument management permission is required." : undefined}
                      >
                        {instrumentUpdatingId === instrument.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Deactivate
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
