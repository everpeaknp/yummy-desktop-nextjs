"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Loader2, RefreshCw, Send, Stamp, ThumbsDown } from "lucide-react";
import { toast } from "sonner";

import apiClient from "@/lib/api-client";
import { AccountingApis } from "@/lib/api/endpoints";
import { hasPermission } from "@/lib/role-permissions";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FinanceSectionTabs } from "@/components/finance/finance-section-tabs";
import { AccountingNav } from "./accounting-nav";
import { ReverseJournalDialog } from "./reverse-journal-dialog";
import type { JournalEntryReverseInput, JournalVoucher, JournalVoucherStatus } from "@/types/accounting";

type BaseResponse<T> = {
  status?: string;
  data?: T;
  message?: string;
};

type JournalVoucherDetailClientProps = {
  voucherId: number;
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

function totals(voucher?: JournalVoucher | null) {
  return (voucher?.lines ?? []).reduce(
    (sum, line) => ({
      debit: sum.debit + Number(line.debit || 0),
      credit: sum.credit + Number(line.credit || 0),
    }),
    { debit: 0, credit: 0 }
  );
}

export function JournalVoucherDetailClient({ voucherId }: JournalVoucherDetailClientProps) {
  const user = useAuth((state) => state.user);
  const me = useAuth((state) => state.me);
  const router = useRouter();
  const [vouchers, setVouchers] = useState<JournalVoucher[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionKey, setActionKey] = useState<string | null>(null);

  const canView = hasPermission(user, "finance.accounting.view");
  const canCreateVoucher = hasPermission(user, "finance.accounting.vouchers.create");
  const canApproveVoucher = hasPermission(user, "finance.accounting.vouchers.approve");
  const canPostVoucher = hasPermission(user, "finance.accounting.vouchers.post");
  const canReverseVoucher = hasPermission(user, "finance.accounting.vouchers.reverse");
  const restaurantId = user?.restaurant_id;
  const voucher = useMemo(() => vouchers.find((item) => item.id === voucherId) ?? null, [voucherId, vouchers]);
  const voucherTotals = totals(voucher);
  const status = voucher?.approval_status || "draft";
  const canReverse =
    status === "posted" &&
    !!voucher &&
    !voucher.reversed_by_entry_id &&
    !voucher.reversal_of_entry_id;

  useEffect(() => {
    const checkAuth = async () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      if (!user && token) await me();
      if (!user && !token) router.push("/");
    };
    void checkAuth();
  }, [user, me, router]);

  const loadVoucher = useCallback(async () => {
    if (!restaurantId || !canView) return;
    setLoading(true);
    try {
      const res = await apiClient.get<BaseResponse<JournalVoucher[]>>(
        AccountingApis.journalVouchers({ restaurantId })
      );
      setVouchers(res.data?.data ?? []);
    } catch (error) {
      console.error("Failed to load journal voucher", error);
      toast.error("Failed to load journal voucher");
    } finally {
      setLoading(false);
    }
  }, [restaurantId, canView]);

  useEffect(() => {
    void loadVoucher();
  }, [loadVoucher]);

  const runAction = async (action: "submit" | "approve" | "reject" | "post") => {
    if (!voucher) return;
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
      await loadVoucher();
    } catch (error) {
      console.error("Failed to update journal voucher", error);
      toast.error("Failed to update journal voucher");
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
      await loadVoucher();
    } catch (error) {
      console.error("Failed to reverse journal entry", error);
      toast.error("Failed to reverse journal entry");
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
        <h1 className="text-2xl font-bold">Journal voucher</h1>
        <div className="border border-border p-6 text-sm text-muted-foreground">
          Your user does not have finance access.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6 p-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Link href="/finance/accounting/vouchers">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Journal voucher</h1>
              <p className="text-sm text-muted-foreground">
                Voucher drilldown with approval status, account impact, and source metadata.
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={loadVoucher} disabled={loading}>
            <RefreshCw className={loading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
            Refresh
          </Button>
        </div>
        <FinanceSectionTabs />
        <AccountingNav />
      </div>

      {!canCreateVoucher || !canApproveVoucher || !canPostVoucher || !canReverseVoucher ? (
        <div className="border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900">
          Voucher actions require separate create, approve, post, and reverse permissions.
        </div>
      ) : null}

      {loading && !voucher ? (
        <div className="flex items-center gap-2 border border-border p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading voucher...
        </div>
      ) : !voucher ? (
        <div className="border border-border p-4 text-sm text-muted-foreground">Journal voucher not found.</div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Voucher no.</div>
                <div className="mt-2 text-lg font-bold">{voucher.entry_number || voucher.source_key}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</div>
                <div className="mt-2">
                  <span className={`rounded-full border px-2 py-1 text-xs font-semibold uppercase ${statusClass(status)}`}>
                    {status}
                  </span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Debit</div>
                <div className="mt-2 text-lg font-bold">{formatMoney(voucherTotals.debit)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Credit</div>
                <div className="mt-2 text-lg font-bold">{formatMoney(voucherTotals.credit)}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="border-b border-border p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <CardTitle className="text-base">Voucher details</CardTitle>
                <div className="flex gap-2">
                  {(status === "draft" || status === "rejected") && (
                    <Button
                      size="sm"
                      onClick={() => runAction("submit")}
                      disabled={actionKey === `submit:${voucher.id}` || !canCreateVoucher}
                      title={!canCreateVoucher ? "Voucher creation requires finance.accounting.vouchers.create permission." : undefined}
                    >
                      {actionKey === `submit:${voucher.id}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                      Submit
                    </Button>
                  )}
                  {status === "submitted" && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => runAction("approve")}
                        disabled={actionKey === `approve:${voucher.id}` || !canApproveVoucher}
                        title={!canApproveVoucher ? "Voucher approval requires finance.accounting.vouchers.approve permission." : undefined}
                      >
                        {actionKey === `approve:${voucher.id}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => runAction("reject")}
                        disabled={actionKey === `reject:${voucher.id}` || !canApproveVoucher}
                        title={!canApproveVoucher ? "Voucher approval requires finance.accounting.vouchers.approve permission." : undefined}
                      >
                        {actionKey === `reject:${voucher.id}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ThumbsDown className="mr-2 h-4 w-4" />}
                        Reject
                      </Button>
                    </>
                  )}
                  {status === "approved" && (
                    <Button
                      size="sm"
                      onClick={() => runAction("post")}
                      disabled={actionKey === `post:${voucher.id}` || !canPostVoucher}
                      title={!canPostVoucher ? "Voucher posting requires finance.accounting.vouchers.post permission." : undefined}
                    >
                      {actionKey === `post:${voucher.id}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Stamp className="mr-2 h-4 w-4" />}
                      Post
                    </Button>
                  )}
                  {canReverse && (
                    <ReverseJournalDialog
                      entryId={voucher.id}
                      entryLabel={voucher.entry_number || voucher.source_key}
                      disabled={actionKey === `reverse:${voucher.id}` || !canReverseVoucher}
                      onReverse={reverseVoucher}
                    />
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-4">
              <div className="grid gap-4 text-sm md:grid-cols-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Entry date</div>
                  <div className="mt-1 font-medium">{formatDate(voucher.entry_date)}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Business date</div>
                  <div className="mt-1 font-medium">{formatDate(voucher.business_date)}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Type</div>
                  <div className="mt-1 font-medium">{voucher.voucher_type || "journal"}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reference</div>
                  <div className="mt-1 font-medium">{voucher.external_reference || "-"}</div>
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Memo</div>
                <div className="mt-1 text-sm">{voucher.memo || "-"}</div>
              </div>

              {voucher.reversed_by_entry_id || voucher.reversal_of_entry_id ? (
                <div className="border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  {voucher.reversed_by_entry_id ? (
                    <div>Reversed by entry #{voucher.reversed_by_entry_id}. This original entry remains visible for audit history.</div>
                  ) : null}
                  {voucher.reversal_of_entry_id ? (
                    <div>Reversal of entry #{voucher.reversal_of_entry_id}. This entry offsets the original journal.</div>
                  ) : null}
                </div>
              ) : null}

              <div className="overflow-x-auto border border-border">
                <table className="w-full min-w-[840px] text-sm">
                  <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Line</th>
                      <th className="px-3 py-2 font-semibold">Account</th>
                      <th className="px-3 py-2 font-semibold">Memo</th>
                      <th className="px-3 py-2 text-right font-semibold">Debit</th>
                      <th className="px-3 py-2 text-right font-semibold">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {voucher.lines.map((line) => (
                      <tr key={line.id} className="border-t border-border">
                        <td className="px-3 py-2">{line.line_no || "-"}</td>
                        <td className="px-3 py-2 font-medium">
                          {line.account ? `${line.account.code} - ${line.account.name}` : line.account_id}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{line.memo || "-"}</td>
                        <td className="px-3 py-2 text-right font-semibold">{formatMoney(line.debit)}</td>
                        <td className="px-3 py-2 text-right font-semibold">{formatMoney(line.credit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
