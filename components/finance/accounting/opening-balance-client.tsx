"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Loader2, Plus, RefreshCw, RotateCcw, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import apiClient from "@/lib/api-client";
import { AccountingApis } from "@/lib/api/endpoints";
import { hasPermission } from "@/lib/role-permissions";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FinanceSectionTabs } from "@/components/finance/finance-section-tabs";
import { AccountingNav } from "./accounting-nav";
import type {
  ChartAccount,
  OpeningBalanceBatch,
  OpeningBalanceBatchInput,
  OpeningBalanceLineInput,
} from "@/types/accounting";

type BaseResponse<T> = {
  status?: string;
  data?: T;
  message?: string;
};

type LineDraft = OpeningBalanceLineInput & {
  row_key: string;
};

function yyyyMmDd(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function newLine(): LineDraft {
  return {
    row_key: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    account_id: 0,
    debit: 0,
    credit: 0,
    memo: "",
  };
}

function formatMoney(value: number) {
  return `Rs. ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function statusClass(status: string) {
  if (status === "posted") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300";
  if (status === "reversed") return "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300";
  return "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300";
}

export function OpeningBalanceClient() {
  const user = useAuth((state) => state.user);
  const me = useAuth((state) => state.me);
  const router = useRouter();
  const [accounts, setAccounts] = useState<ChartAccount[]>([]);
  const [batches, setBatches] = useState<OpeningBalanceBatch[]>([]);
  const [asOfDate, setAsOfDate] = useState(() => yyyyMmDd(new Date()));
  const [lines, setLines] = useState<LineDraft[]>(() => [newLine(), newLine()]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [postingId, setPostingId] = useState<number | null>(null);
  const [reversingId, setReversingId] = useState<number | null>(null);

  const canView = hasPermission(user, "finance.accounting.view");
  const canManageOpeningBalances = hasPermission(user, "finance.accounting.opening_balances.manage");
  const restaurantId = user?.restaurant_id;
  const postableAccounts = useMemo(
    () => accounts.filter((account) => account.is_active && account.node_type !== "group"),
    [accounts]
  );

  useEffect(() => {
    const checkAuth = async () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      if (!user && token) await me();
      if (!user && !token) router.push("/");
    };
    void checkAuth();
  }, [user, me, router]);

  const loadData = useCallback(async () => {
    if (!restaurantId || !canView || !canManageOpeningBalances) {
      toast.error("Opening balance management requires finance.accounting.opening_balances.manage permission.");
      return;
    }
    setLoading(true);
    try {
      const [accountsRes, batchesRes] = await Promise.all([
        apiClient.get<BaseResponse<ChartAccount[]>>(AccountingApis.accounts({ restaurantId })),
        apiClient.get<BaseResponse<OpeningBalanceBatch[]>>(AccountingApis.openingBalances({ restaurantId })),
      ]);
      setAccounts(accountsRes.data?.data ?? []);
      setBatches(batchesRes.data?.data ?? []);
    } catch (error) {
      console.error("Failed to load opening balances", error);
      toast.error("Failed to load opening balances");
    } finally {
      setLoading(false);
    }
  }, [restaurantId, canView]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const totals = useMemo(() => {
    const debit = lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
    const credit = lines.reduce((sum, line) => sum + Number(line.credit || 0), 0);
    return {
      debit,
      credit,
      difference: Math.abs(debit - credit),
    };
  }, [lines]);

  const updateLine = (rowKey: string, patch: Partial<LineDraft>) => {
    setLines((current) =>
      current.map((line) => (line.row_key === rowKey ? { ...line, ...patch } : line))
    );
  };

  const removeLine = (rowKey: string) => {
    setLines((current) => (current.length <= 1 ? current : current.filter((line) => line.row_key !== rowKey)));
  };

  const resetDraft = () => {
    setAsOfDate(yyyyMmDd(new Date()));
    setLines([newLine(), newLine()]);
  };

  const createOpeningBalance = async () => {
    if (!restaurantId || !canView) return;
    const payloadLines = lines
      .filter((line) => line.account_id > 0 && (Number(line.debit || 0) > 0 || Number(line.credit || 0) > 0))
      .map((line) => ({
        account_id: line.account_id,
        debit: Number(line.debit || 0),
        credit: Number(line.credit || 0),
        memo: line.memo || null,
      }));

    if (payloadLines.length === 0) {
      toast.error("Add at least one non-zero opening balance line.");
      return;
    }
    if (totals.difference !== 0) {
      toast.error("Opening balance must have equal debit and credit totals.");
      return;
    }

    setSaving(true);
    try {
      const payload: OpeningBalanceBatchInput = {
        restaurant_id: restaurantId,
        as_of_date: asOfDate,
        lines: payloadLines,
      };
      await apiClient.post<BaseResponse<OpeningBalanceBatch>>(
        AccountingApis.createOpeningBalance(),
        payload
      );
      toast.success("Opening balance draft created.");
      resetDraft();
      await loadData();
    } catch (error) {
      console.error("Failed to create opening balance", error);
      toast.error("Failed to create opening balance");
    } finally {
      setSaving(false);
    }
  };

  const postBatch = async (batchId: number) => {
    if (!canManageOpeningBalances) {
      toast.error("Opening balance management requires finance.accounting.opening_balances.manage permission.");
      return;
    }
    setPostingId(batchId);
    try {
      await apiClient.post<BaseResponse<OpeningBalanceBatch>>(AccountingApis.postOpeningBalance(batchId));
      toast.success("Opening balance posted.");
      await loadData();
    } catch (error) {
      console.error("Failed to post opening balance", error);
      toast.error("Failed to post opening balance");
    } finally {
      setPostingId(null);
    }
  };

  const reverseBatch = async (batchId: number) => {
    if (!canManageOpeningBalances) {
      toast.error("Opening balance management requires finance.accounting.opening_balances.manage permission.");
      return;
    }
    setReversingId(batchId);
    try {
      await apiClient.post<BaseResponse<OpeningBalanceBatch>>(AccountingApis.reverseOpeningBalance(batchId));
      toast.success("Opening balance reversed.");
      await loadData();
    } catch (error) {
      console.error("Failed to reverse opening balance", error);
      toast.error("Failed to reverse opening balance");
    } finally {
      setReversingId(null);
    }
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
        <h1 className="text-2xl font-bold">Opening balances</h1>
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
              <h1 className="text-2xl font-bold tracking-tight">Opening balances</h1>
              <p className="text-sm text-muted-foreground">
                Start accounting from existing cash, bank, receivable, payable, inventory, and equity balances.
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={loadData} disabled={loading || saving}>
            <RefreshCw className={loading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
            Refresh
          </Button>
        </div>
        <FinanceSectionTabs />
        <AccountingNav />
      </div>

      {!canManageOpeningBalances ? (
        <div className="border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900">
          Opening balance management requires finance.accounting.opening_balances.manage permission.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Debit total</div>
            <div className="mt-2 text-xl font-bold">{formatMoney(totals.debit)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Credit total</div>
            <div className="mt-2 text-xl font-bold">{formatMoney(totals.credit)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Difference</div>
            <div className={totals.difference === 0 ? "mt-2 text-xl font-bold text-emerald-600" : "mt-2 text-xl font-bold text-red-600"}>
              {formatMoney(totals.difference)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Batches</div>
            <div className="mt-2 text-xl font-bold">{batches.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b border-border p-4">
          <CardTitle className="text-base">New opening balance batch</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-3 md:grid-cols-[220px_1fr]">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                As of date
              </label>
              <Input type="date" value={asOfDate} onChange={(event) => setAsOfDate(event.target.value)} />
            </div>
            <div className="flex items-end justify-end gap-2">
               <Button
                variant="outline"
                onClick={() => setLines((current) => [...current, newLine()])}
                disabled={!canManageOpeningBalances}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add line
              </Button>
              <Button
                onClick={createOpeningBalance}
                disabled={saving || loading || postableAccounts.length === 0 || !canManageOpeningBalances}
                title={!canManageOpeningBalances ? "Opening balance management requires finance.accounting.opening_balances.manage permission." : undefined}
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Save draft
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto border border-border">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-semibold">Account</th>
                  <th className="w-36 px-3 py-2 font-semibold">Debit</th>
                  <th className="w-36 px-3 py-2 font-semibold">Credit</th>
                  <th className="px-3 py-2 font-semibold">Memo</th>
                  <th className="w-12 px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.row_key} className="border-t border-border">
                    <td className="px-3 py-2">
                      <Select
                        value={line.account_id ? String(line.account_id) : undefined}
                        onValueChange={(value) => updateLine(line.row_key, { account_id: Number(value) })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select account" />
                        </SelectTrigger>
                        <SelectContent>
                          {postableAccounts.map((account) => (
                            <SelectItem key={account.id} value={String(account.id)}>
                              {account.code} - {account.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.debit || ""}
                        onChange={(event) => updateLine(line.row_key, { debit: Number(event.target.value || 0) })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.credit || ""}
                        onChange={(event) => updateLine(line.row_key, { credit: Number(event.target.value || 0) })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        value={line.memo || ""}
                        onChange={(event) => updateLine(line.row_key, { memo: event.target.value })}
                        placeholder="Optional memo"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Button variant="ghost" size="icon" onClick={() => removeLine(line.row_key)} disabled={lines.length <= 1}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-border p-4">
          <CardTitle className="text-base">Opening balance batches</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading && batches.length === 0 ? (
            <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading opening balances...
            </div>
          ) : batches.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No opening balance batches yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 text-right font-semibold">Debit</th>
                    <th className="px-4 py-3 text-right font-semibold">Credit</th>
                    <th className="px-4 py-3 text-right font-semibold">Lines</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((batch) => (
                    <tr key={batch.id} className="border-t border-border">
                      <td className="px-4 py-3 font-medium">{batch.as_of_date}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full border px-2 py-1 text-xs font-semibold uppercase ${statusClass(batch.status)}`}>
                          {batch.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">{formatMoney(batch.debit_total)}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatMoney(batch.credit_total)}</td>
                      <td className="px-4 py-3 text-right">{batch.lines.length}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {batch.status === "draft" && (
                            <Button
                              size="sm"
                              onClick={() => postBatch(batch.id)}
                              disabled={postingId === batch.id || !canManageOpeningBalances}
                              title={!canManageOpeningBalances ? "Opening balance management requires finance.accounting.opening_balances.manage permission." : undefined}
                            >
                              {postingId === batch.id ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                              )}
                              Post batch
                            </Button>
                          )}
                          {batch.status === "posted" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => reverseBatch(batch.id)}
                              disabled={reversingId === batch.id || !canManageOpeningBalances}
                              title={!canManageOpeningBalances ? "Opening balance management requires finance.accounting.opening_balances.manage permission." : undefined}
                            >
                              {reversingId === batch.id ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <RotateCcw className="mr-2 h-4 w-4" />
                              )}
                              Reverse
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
