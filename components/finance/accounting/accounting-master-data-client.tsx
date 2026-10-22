"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import apiClient from "@/lib/api-client";
import { AccountingApis } from "@/lib/api/endpoints";
import { hasPermission } from "@/lib/role-permissions";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FinanceSectionTabs } from "@/components/finance/finance-section-tabs";
import { AccountingNav } from "./accounting-nav";
import { LedgerMappingDialog } from "./ledger-mapping-dialog";
import { LedgerMappingTable } from "./ledger-mapping-table";
import type { ChartAccount, LedgerMapping } from "@/types/accounting";

type BaseResponse<T> = {
  status?: string;
  data?: T;
  message?: string;
};

/**
 * Accounting mappings still use the legacy accounting account contract.
 * The Chart of Accounts itself is owned by /finance/heads, the reporting-head
 * hierarchy used throughout the current finance workspace.
 */
export function AccountingMasterDataClient() {
  const user = useAuth((state) => state.user);
  const me = useAuth((state) => state.me);
  const router = useRouter();
  const [accounts, setAccounts] = useState<ChartAccount[]>([]);
  const [mappings, setMappings] = useState<LedgerMapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [selectedMapping, setSelectedMapping] = useState<LedgerMapping | null>(null);

  const canView = hasPermission(user, "finance.accounting.view");
  const canManageMasterData = hasPermission(user, "finance.mapping.manage");
  const restaurantId = user?.restaurant_id;
  const title = "Ledger Mapping";

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
      const [accountsRes, mappingsRes] = await Promise.all([
        apiClient.get<BaseResponse<ChartAccount[]>>(AccountingApis.accounts({ restaurantId })),
        apiClient.get<BaseResponse<LedgerMapping[]>>(
          AccountingApis.mappings({ restaurantId, businessLine: "restaurant" })
        ),
      ]);
      setAccounts(accountsRes.data?.data ?? []);
      setMappings(mappingsRes.data?.data ?? []);
    } catch (error) {
      console.error("Failed to load ledger mappings", error);
      toast.error(`Failed to load ${title.toLowerCase()}`);
    } finally {
      setLoading(false);
    }
  }, [restaurantId, canView, title]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

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
              <p className="text-sm text-muted-foreground">Finance events mapped to debit and credit accounts.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={openCreateMapping} disabled={!canManageMasterData}>
              <Plus className="mr-2 h-4 w-4" />
              Create Mapping
            </Button>
            <Button variant="outline" onClick={loadData} disabled={loading}>
              <RefreshCw className={loading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
              Refresh
            </Button>
          </div>
        </div>
        <FinanceSectionTabs />
        <AccountingNav />
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border p-4">
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <LedgerMappingTable
            mappings={mappings}
            loading={loading}
            onEdit={canManageMasterData ? openEditMapping : undefined}
          />
        </CardContent>
      </Card>

      {restaurantId ? (
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
