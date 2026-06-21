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
import { AccountDialog, type AccountDialogIntent } from "./account-dialog";
import { AccountTable } from "./account-table";
import { AccountingDrilldownDrawer } from "./accounting-drilldown-drawer";
import { AccountingNav } from "./accounting-nav";
import { LedgerMappingDialog } from "./ledger-mapping-dialog";
import { LedgerMappingTable } from "./ledger-mapping-table";
import type { AccountingDrilldownResponse, AccountingSeedDefaultsResult, ChartAccount, LedgerMapping } from "@/types/accounting";

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
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [accountIntent, setAccountIntent] = useState<AccountDialogIntent | null>(null);
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [selectedMapping, setSelectedMapping] = useState<LedgerMapping | null>(null);
  const [accountSearch, setAccountSearch] = useState("");
  const [accountType, setAccountType] = useState("all");
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [drilldownTitle, setDrilldownTitle] = useState("Ledger");
  const [drilldownLoading, setDrilldownLoading] = useState(false);
  const [drilldownData, setDrilldownData] = useState<AccountingDrilldownResponse | null>(null);

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

  const openCreateAccount = (nodeType: AccountDialogIntent["nodeType"], parentId?: number | null) => {
    setAccountIntent({ nodeType, parentId: parentId ?? null });
    setAccountDialogOpen(true);
  };

  const openEditMapping = (mapping: LedgerMapping) => {
    setSelectedMapping(mapping);
    setMappingDialogOpen(true);
  };

  const openAccountLedger = useCallback(
    async (account: ChartAccount) => {
      if (!restaurantId || account.node_type === "group") return;
      setDrilldownTitle(`${account.code} - ${account.name}`);
      setDrilldownOpen(true);
      setDrilldownLoading(true);
      try {
        const res = await apiClient.get<BaseResponse<AccountingDrilldownResponse>>(
          AccountingApis.drilldown({
            restaurantId,
            accountId: account.id,
          })
        );
        setDrilldownData(res.data?.data ?? null);
      } catch (error) {
        console.error("Failed to load account ledger", error);
        setDrilldownData(null);
        toast.error("Failed to load ledger");
      } finally {
        setDrilldownLoading(false);
      }
    },
    [restaurantId]
  );

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
            {mode === "accounts" && (
              <Button variant="outline" onClick={() => openCreateAccount("group", null)} disabled={!canManageMasterData}>
                <Plus className="mr-2 h-4 w-4" />
                Create Group
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
              canManage={canManageMasterData}
              onCreateAccount={openCreateAccount}
              onOpenAccount={openAccountLedger}
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
      {mode === "accounts" && restaurantId ? (
        <AccountDialog
          open={accountDialogOpen}
          onOpenChange={setAccountDialogOpen}
          restaurantId={restaurantId}
          accounts={accounts}
          intent={accountIntent}
          onSaved={loadData}
        />
      ) : null}
      {mode === "accounts" ? (
        <AccountingDrilldownDrawer
          open={drilldownOpen}
          onOpenChange={setDrilldownOpen}
          title={drilldownTitle}
          data={drilldownData}
          loading={drilldownLoading}
        />
      ) : null}
    </div>
  );
}
