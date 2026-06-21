"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Database, Loader2, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import apiClient from "@/lib/api-client";
import { AccountingApis } from "@/lib/api/endpoints";
import { hasPermission } from "@/lib/role-permissions";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FinanceSectionTabs } from "@/components/finance/finance-section-tabs";
import { AccountTable } from "./account-table";
import { AccountingNav } from "./accounting-nav";
import { LedgerMappingDialog } from "./ledger-mapping-dialog";
import { LedgerMappingTable } from "./ledger-mapping-table";
import type { AccountingSeedDefaultsResult, ChartAccount, LedgerMapping } from "@/types/accounting";

type BaseResponse<T> = {
  status?: string;
  data?: T;
  message?: string;
};

type AccountingMasterDataClientProps = {
  mode: "accounts" | "mappings";
};

export function AccountingMasterDataClient({ mode }: AccountingMasterDataClientProps) {
  const user = useAuth((state) => state.user);
  const me = useAuth((state) => state.me);
  const router = useRouter();
  const [accounts, setAccounts] = useState<ChartAccount[]>([]);
  const [mappings, setMappings] = useState<LedgerMapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<AccountingSeedDefaultsResult | null>(null);
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [selectedMapping, setSelectedMapping] = useState<LedgerMapping | null>(null);
  const [accountSearch, setAccountSearch] = useState("");
  const [accountType, setAccountType] = useState("all");

  const canView = hasPermission(user, "finance.accounting.view");
  const canSetupAccounting = hasPermission(user, "finance.accounting.setup");
  const canManageMasterData = hasPermission(
    user,
    mode === "accounts" ? "finance.coa.manage" : "finance.mapping.manage",
  );
  const restaurantId = user?.restaurant_id;
  const title = mode === "accounts" ? "Chart of Accounts" : "Ledger Mapping";

  useEffect(() => {
    const checkAuth = async () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      if (!user && token) await me();
      if (!user && !token) router.push("/");
    };
    void checkAuth();
  }, [user, me, router]);

  const loadData = useCallback(async () => {
    if (!restaurantId || !canView) {
      return;
    }
    setLoading(true);
    try {
      if (mode === "accounts") {
        const res = await apiClient.get<BaseResponse<ChartAccount[]>>(
          AccountingApis.accounts({ restaurantId })
        );
        setAccounts(res.data?.data ?? []);
      } else {
        const [accountsRes, mappingsRes] = await Promise.all([
          apiClient.get<BaseResponse<ChartAccount[]>>(AccountingApis.accounts({ restaurantId })),
          apiClient.get<BaseResponse<LedgerMapping[]>>(
            AccountingApis.mappings({ restaurantId, businessLine: "restaurant" })
          ),
        ]);
        setAccounts(accountsRes.data?.data ?? []);
        setMappings(mappingsRes.data?.data ?? []);
      }
    } catch (error) {
      console.error(`Failed to load ${mode}`, error);
      toast.error(`Failed to load ${title.toLowerCase()}`);
    } finally {
      setLoading(false);
    }
  }, [restaurantId, canView, mode, title]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const seedDefaults = async () => {
    if (!restaurantId || !canView) return;
    setSeeding(true);
    try {
      const res = await apiClient.post<BaseResponse<AccountingSeedDefaultsResult>>(
        AccountingApis.seedDefaults({ restaurantId, businessLine: "restaurant" })
      );
      const result = res.data?.data ?? null;
      setSeedResult(result);
      toast.success(
        `Seeded ${result?.accounts_created ?? 0} accounts and ${result?.mappings_created ?? 0} mappings.`
      );
      await loadData();
    } catch (error) {
      console.error("Failed to seed accounting defaults", error);
      toast.error("Failed to seed accounting defaults");
    } finally {
      setSeeding(false);
    }
  };

  const openCreateMapping = () => {
    setSelectedMapping(null);
    setMappingDialogOpen(true);
  };

  const openEditMapping = (mapping: LedgerMapping) => {
    setSelectedMapping(mapping);
    setMappingDialogOpen(true);
  };

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
        <h1 className="text-2xl font-bold">{title}</h1>
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
              <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
              <p className="text-sm text-muted-foreground">
                {mode === "accounts"
                  ? "Accounts used by journal posting and reports."
                  : "Finance events mapped to debit and credit accounts."}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {mode === "mappings" && (
              <Button variant="outline" onClick={openCreateMapping} disabled={!canManageMasterData}>
                <Plus className="mr-2 h-4 w-4" />
                Create Mapping
              </Button>
            )}
            <Button variant="outline" onClick={loadData} disabled={loading || seeding}>
              <RefreshCw className={loading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
              Refresh
            </Button>
            <Button
              onClick={seedDefaults}
              disabled={loading || seeding || !canSetupAccounting}
              title={!canSetupAccounting ? "Accounting setup changes require finance.accounting.setup permission." : undefined}
            >
              {seeding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
              Seed Defaults
            </Button>
          </div>
        </div>
        <FinanceSectionTabs />
        <AccountingNav />
      </div>

      {seedResult && (
        <div className="border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300">
          Seeded {seedResult.accounts_created} accounts and {seedResult.mappings_created} mappings.
        </div>
      )}

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border p-4">
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {mode === "accounts" ? (
            <AccountTable
              accounts={accounts}
              loading={loading}
              search={accountSearch}
              accountType={accountType}
              onSearchChange={setAccountSearch}
              onAccountTypeChange={setAccountType}
            />
          ) : (
            <LedgerMappingTable
              mappings={mappings}
              loading={loading}
              onEdit={canManageMasterData ? openEditMapping : undefined}
            />
          )}
        </CardContent>
      </Card>

      {mode === "mappings" && restaurantId ? (
        <LedgerMappingDialog
          open={mappingDialogOpen}
          onOpenChange={setMappingDialogOpen}
          restaurantId={restaurantId}
          accounts={accounts}
          mapping={selectedMapping}
          onSaved={loadData}
        />
      ) : null}
    </div>
  );
}
