"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Send,
  Stamp,
  ThumbsDown,
} from "lucide-react";
import { toast } from "sonner";

import apiClient from "@/lib/api-client";
import { AccountingApis } from "@/lib/api/endpoints";
import { hasPermission } from "@/lib/role-permissions";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FinanceSectionTabs } from "@/components/finance/finance-section-tabs";
import { AccountingNav } from "./accounting-nav";
import { JournalVoucherForm } from "./journal-voucher-form";
import { ReverseJournalDialog } from "./reverse-journal-dialog";
import type {
  ChartAccount,
  JournalEntryReverseInput,
  JournalVoucher,
  JournalVoucherInput,
  JournalVoucherStatus,
} from "@/types/accounting";

type BaseResponse<T> = {
  status?: string;
  data?: T;
  message?: string;
};

function formatMoney(value: number) {
  return `Rs. ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function statusClass(status?: JournalVoucherStatus | null) {
  if (status === "posted") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300";
  if (status === "approved") return "border-blue-500/30 bg-blue-500/10 text-blue-800 dark:text-blue-300";
  if (status === "submitted") return "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300";
  if (status === "rejected") return "border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-300";
  if (status === "reversed") return "border-orange-500/30 bg-orange-500/10 text-orange-800 dark:text-orange-300";
  return "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300";
}

function voucherTotals(voucher: JournalVoucher) {
  return voucher.lines.reduce(
    (totals, line) => ({
      debit: totals.debit + Number(line.debit || 0),
      credit: totals.credit + Number(line.credit || 0),
    }),
    { debit: 0, credit: 0 }
  );
}

function actionErrorLabel(action: string) {
  if (action === "submit") return "Failed to submit voucher";
  if (action === "approve") return "Failed to approve voucher";
  if (action === "reject") return "Failed to reject voucher";
  if (action === "post") return "Failed to post voucher";
  if (action === "reverse") return "Failed to reverse voucher";
  return "Failed to update voucher";
}

export function JournalVoucherClient() {
  const user = useAuth((state) => state.user);
  const me = useAuth((state) => state.me);
  const router = useRouter();
  const [accounts, setAccounts] = useState<ChartAccount[]>([]);
  const [vouchers, setVouchers] = useState<JournalVoucher[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionKey, setActionKey] = useState<string | null>(null);

  const canView = hasPermission(user, "finance.accounting.view");
  const canCreateVoucher = hasPermission(user, "finance.accounting.vouchers.create");
  const canApproveVoucher = hasPermission(user, "finance.accounting.vouchers.approve");
  const canPostVoucher = hasPermission(user, "finance.accounting.vouchers.post");
  const canReverseVoucher = hasPermission(user, "finance.accounting.vouchers.reverse");
  const restaurantId = user?.restaurant_id;

  useEffect(() => {
    const checkAuth = async () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      if (!user && token) await me();
      if (!user && !token) router.push("/");
    };
    void checkAuth();
  }, [user, me, router]);

  const loadData = useCallback(async () => {
    if (!restaurantId || !canView) return;
    setLoading(true);
    try {
      const [accountsRes, vouchersRes] = await Promise.all([
        apiClient.get<BaseResponse<ChartAccount[]>>(AccountingApis.accounts({ restaurantId })),
        apiClient.get<BaseResponse<JournalVoucher[]>>(AccountingApis.journalVouchers({ restaurantId })),
      ]);
      setAccounts(accountsRes.data?.data ?? []);
      setVouchers(vouchersRes.data?.data ?? []);
    } catch (error) {
      console.error("Failed to load manual journal vouchers", error);
      toast.error("Failed to load manual journal vouchers");
    } finally {
      setLoading(false);
    }
  }, [restaurantId, canView]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const stats = useMemo(() => {
    const byStatus = vouchers.reduce<Record<string, number>>((counts, voucher) => {
      const status = voucher.approval_status || "draft";
      counts[status] = (counts[status] || 0) + 1;
      return counts;
    }, {});
    return {
      total: vouchers.length,
      draft: byStatus.draft || 0,
      submitted: byStatus.submitted || 0,
      approved: byStatus.approved || 0,
      posted: byStatus.posted || 0,
      reversed: byStatus.reversed || 0,
    };
  }, [vouchers]);

  const createVoucher = async (payload: JournalVoucherInput) => {
    if (!canCreateVoucher) {
      toast.error("Voucher creation requires finance.accounting.vouchers.create permission.");
      return;
    }
    setSaving(true);
    try {
      await apiClient.post<BaseResponse<JournalVoucher>>(AccountingApis.createJournalVoucher(), payload);
      toast.success("Journal voucher draft created.");
      await loadData();
    } catch (error) {
      console.error("Failed to create journal voucher", error);
      toast.error("Failed to create journal voucher");
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (voucher: JournalVoucher, action: "submit" | "approve" | "reject" | "post") => {
    if ((action === "submit" && !canCreateVoucher) || ((action === "approve" || action === "reject") && !canApproveVoucher) || (action === "post" && !canPostVoucher)) {
      toast.error("You do not have permission to run this voucher action.");
      return;
    }
    const key = `${action}:${voucher.id}`;
    setActionKey(key);
    try {
      const endpoint =
        action === "submit"
          ? AccountingApis.submitJournalVoucher(voucher.id)
          : action === "approve"
            ? AccountingApis.approveJournalVoucher(voucher.id)
            : action === "reject"
              ? AccountingApis.rejectJournalVoucher(voucher.id)
              : AccountingApis.postJournalVoucher(voucher.id);
      await apiClient.post<BaseResponse<JournalVoucher>>(endpoint);
      toast.success(`Voucher ${action}ed.`);
      await loadData();
    } catch (error) {
      console.error(actionErrorLabel(action), error);
      toast.error(actionErrorLabel(action));
    } finally {
      setActionKey(null);
    }
  };

  const reverseVoucher = async (entryId: number, payload: JournalEntryReverseInput) => {
    if (!canReverseVoucher) {
      toast.error("Voucher reversal requires finance.accounting.vouchers.reverse permission.");
      return;
    }
    const key = `reverse:${entryId}`;
    setActionKey(key);
    try {
      await apiClient.post<BaseResponse<JournalVoucher>>(AccountingApis.reverseJournalEntry(entryId), payload);
      toast.success("Journal entry reversed.");
      await loadData();
    } catch (error) {
      console.error(actionErrorLabel("reverse"), error);
      toast.error(actionErrorLabel("reverse"));
      throw error;
    } finally {
      setActionKey(null);
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
        <h1 className="text-2xl font-bold">Manual journal vouchers</h1>
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
              <h1 className="text-2xl font-bold tracking-tight">Manual journal vouchers</h1>
              <p className="text-sm text-muted-foreground">
                Record accountant-approved corrections, accruals, adjustments, and bank movements.
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

      {!canCreateVoucher ? (
        <div className="border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900">
          Voucher creation requires finance.accounting.vouchers.create permission. Approval, posting, and reversal use separate accounting permissions.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-6">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total vouchers</div>
            <div className="mt-2 text-xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Draft</div>
            <div className="mt-2 text-xl font-bold">{stats.draft}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Submitted</div>
            <div className="mt-2 text-xl font-bold">{stats.submitted}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Approved</div>
            <div className="mt-2 text-xl font-bold">{stats.approved}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Posted</div>
            <div className="mt-2 text-xl font-bold">{stats.posted}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reversed</div>
            <div className="mt-2 text-xl font-bold">{stats.reversed}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b border-border p-4">
          <CardTitle className="text-base">Create voucher</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {restaurantId && canCreateVoucher ? (
            <JournalVoucherForm
              restaurantId={restaurantId}
              accounts={accounts}
              saving={saving}
              onSubmit={createVoucher}
            />
          ) : !canCreateVoucher ? (
            <div className="text-sm text-muted-foreground">
              Voucher creation requires finance.accounting.vouchers.create permission.
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Restaurant context is not available.</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-border p-4">
          <CardTitle className="text-base">Voucher register</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading && vouchers.length === 0 ? (
            <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading vouchers...
            </div>
          ) : vouchers.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No manual journal vouchers yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Voucher</th>
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Memo</th>
                    <th className="px-4 py-3 text-right font-semibold">Debit</th>
                    <th className="px-4 py-3 text-right font-semibold">Credit</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {vouchers.map((voucher) => {
                    const totals = voucherTotals(voucher);
                    const status = voucher.approval_status || "draft";
                    const loadingKey = (action: string) => actionKey === `${action}:${voucher.id}`;
                    const canReverse =
                      status === "posted" &&
                      !voucher.reversed_by_entry_id &&
                      !voucher.reversal_of_entry_id;
                    return (
                      <tr key={voucher.id} className="border-t border-border align-top">
                        <td className="px-4 py-3">
                          <Link
                            href={`/finance/accounting/vouchers/${voucher.id}`}
                            className="font-semibold text-primary hover:underline"
                          >
                            {voucher.entry_number || voucher.source_key}
                          </Link>
                          <div className="text-xs text-muted-foreground">{voucher.voucher_type || "journal"}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div>{formatDate(voucher.entry_date)}</div>
                          <div className="text-xs text-muted-foreground">Business: {formatDate(voucher.business_date)}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full border px-2 py-1 text-xs font-semibold uppercase ${statusClass(status)}`}>
                            {status}
                          </span>
                        </td>
                        <td className="max-w-[360px] px-4 py-3">
                          <div className="font-medium">{voucher.memo || "-"}</div>
                          {voucher.external_reference ? (
                            <div className="mt-1 text-xs text-muted-foreground">Ref: {voucher.external_reference}</div>
                          ) : null}
                          {voucher.reversed_by_entry_id ? (
                            <div className="mt-1 text-xs font-medium text-amber-700">
                              Reversed by entry #{voucher.reversed_by_entry_id}
                            </div>
                          ) : null}
                          {voucher.reversal_of_entry_id ? (
                            <div className="mt-1 text-xs font-medium text-blue-700">
                              Reversal of entry #{voucher.reversal_of_entry_id}
                            </div>
                          ) : null}
                          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                            {voucher.lines.map((line) => (
                              <div key={line.id}>
                                {line.account?.code || line.account_id} {line.account?.name || ""}:{" "}
                                {Number(line.debit || 0) > 0 ? `Dr ${formatMoney(line.debit)}` : `Cr ${formatMoney(line.credit)}`}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">{formatMoney(totals.debit)}</td>
                        <td className="px-4 py-3 text-right font-semibold">{formatMoney(totals.credit)}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            {(status === "draft" || status === "rejected") && (
                              <Button
                                size="sm"
                                onClick={() => runAction(voucher, "submit")}
                                disabled={loadingKey("submit") || !canCreateVoucher}
                                title={!canCreateVoucher ? "Voucher creation requires finance.accounting.vouchers.create permission." : undefined}
                              >
                                {loadingKey("submit") ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                Submit
                              </Button>
                            )}
                            {status === "submitted" && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => runAction(voucher, "approve")}
                                  disabled={loadingKey("approve") || !canApproveVoucher}
                                  title={!canApproveVoucher ? "Voucher approval requires finance.accounting.vouchers.approve permission." : undefined}
                                >
                                  {loadingKey("approve") ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => runAction(voucher, "reject")}
                                  disabled={loadingKey("reject") || !canApproveVoucher}
                                  title={!canApproveVoucher ? "Voucher approval requires finance.accounting.vouchers.approve permission." : undefined}
                                >
                                  {loadingKey("reject") ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ThumbsDown className="mr-2 h-4 w-4" />}
                                  Reject
                                </Button>
                              </>
                            )}
                            {status === "approved" && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => runAction(voucher, "post")}
                                  disabled={loadingKey("post") || !canPostVoucher}
                                  title={!canPostVoucher ? "Voucher posting requires finance.accounting.vouchers.post permission." : undefined}
                                >
                                  {loadingKey("post") ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Stamp className="mr-2 h-4 w-4" />}
                                  Post
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => runAction(voucher, "reject")}
                                  disabled={loadingKey("reject") || !canApproveVoucher}
                                  title={!canApproveVoucher ? "Voucher approval requires finance.accounting.vouchers.approve permission." : undefined}
                                >
                                  {loadingKey("reject") ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ThumbsDown className="mr-2 h-4 w-4" />}
                                  Reject
                                </Button>
                              </>
                            )}
                            {canReverse && (
                              <ReverseJournalDialog
                                entryId={voucher.id}
                                entryLabel={voucher.entry_number || voucher.source_key}
                                disabled={loadingKey("reverse") || !canReverseVoucher}
                                onReverse={reverseVoucher}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
