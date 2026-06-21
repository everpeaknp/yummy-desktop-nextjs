"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CreditCard, Loader2, RefreshCw, RotateCcw, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import apiClient from "@/lib/api-client";
import { AccountingApis } from "@/lib/api/endpoints";
import { hasPermission } from "@/lib/role-permissions";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { FinanceSectionTabs } from "@/components/finance/finance-section-tabs";
import { AccountingNav } from "./accounting-nav";
import type {
  PaymentSettlementBatch,
  PaymentSettlementCreateInput,
  PaymentSettlementPreviewInput,
  PaymentSettlementPreviewLine,
  PaymentSettlementPreviewResponse,
  PaymentSettlementVarianceApprovalInput,
} from "@/types/accounting";

type BaseResponse<T> = {
  status?: string;
  data?: T;
  message?: string;
};

type PaymentMethod = "card" | "digital" | "fonepay";

const methodLabels: Record<PaymentMethod, string> = {
  card: "Card",
  digital: "Digital wallet",
  fonepay: "Fonepay",
};

function todayInputValue() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function monthStartInputValue() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const local = new Date(start.getTime() - start.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function formatMoney(value: number) {
  return `Rs. ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function numberValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function statusClass(status: string) {
  if (status === "posted") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300";
  if (status === "variance_approved") return "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300";
  if (status === "reversed") return "border-muted bg-muted text-muted-foreground";
  if (status === "matched") return "border-blue-500/30 bg-blue-500/10 text-blue-800 dark:text-blue-300";
  return "border-border bg-background text-muted-foreground";
}

function eventLabel(value: string) {
  return value.replace(/_/g, " ");
}

function bridgeRows(preview: PaymentSettlementPreviewResponse | null) {
  if (!preview) return [];
  return [
    ["POS collections", preview.pos_collections],
    ["Refunds", -preview.refunds],
    ["Processor fees", -preview.fee_amount],
    ["Settlement variance", preview.variance_amount],
    ["Bank deposit", preview.actual_amount],
  ] as const;
}

export function SettlementReconciliationClient() {
  const user = useAuth((state) => state.user);
  const me = useAuth((state) => state.me);
  const router = useRouter();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
  const [instrument, setInstrument] = useState("");
  const [dateFrom, setDateFrom] = useState(monthStartInputValue);
  const [dateTo, setDateTo] = useState(todayInputValue);
  const [settlementDate, setSettlementDate] = useState(todayInputValue);
  const [actualAmount, setActualAmount] = useState("");
  const [feeAmount, setFeeAmount] = useState("0");
  const [varianceReason, setVarianceReason] = useState("");
  const [preview, setPreview] = useState<PaymentSettlementPreviewResponse | null>(null);
  const [batches, setBatches] = useState<PaymentSettlementBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);

  const canView = hasPermission(user, "finance.accounting.view");
  const canManageSettlements = hasPermission(user, "finance.payment_settlements.manage");
  const restaurantId = user?.restaurant_id;
  const settlementLines = useMemo(() => preview?.lines ?? [], [preview]);
  const bridge = useMemo(() => bridgeRows(preview), [preview]);

  useEffect(() => {
    const checkAuth = async () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      if (!user && token) await me();
      if (!user && !token) router.push("/");
    };
    void checkAuth();
  }, [user, me, router]);

  const payload = useCallback((): PaymentSettlementPreviewInput => {
    if (!restaurantId) {
      throw new Error("Missing restaurant context.");
    }
    return {
      restaurant_id: restaurantId,
      payment_method: paymentMethod,
      instrument: instrument.trim() || null,
      date_from: dateFrom,
      date_to: dateTo,
      settlement_date: settlementDate,
      actual_amount: numberValue(actualAmount),
      fee_amount: numberValue(feeAmount),
      business_line: "restaurant",
    };
  }, [restaurantId, paymentMethod, instrument, dateFrom, dateTo, settlementDate, actualAmount, feeAmount]);

  const loadBatches = useCallback(async () => {
    if (!restaurantId || !canView || !canManageSettlements) {
      toast.error("Settlement management requires finance.payment_settlements.manage permission.");
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.get<BaseResponse<PaymentSettlementBatch[]>>(
        AccountingApis.settlements({
          restaurantId,
          dateFrom,
          dateTo,
          paymentMethod,
        })
      );
      setBatches(res.data?.data ?? []);
    } catch (error) {
      console.error("Failed to load payment settlements", error);
      toast.error("Failed to load payment settlements");
    } finally {
      setLoading(false);
    }
  }, [restaurantId, canView, canManageSettlements, dateFrom, dateTo, paymentMethod]);

  const previewSettlement = useCallback(async () => {
    if (!restaurantId || !canView) return;
    setPreviewing(true);
    try {
      const res = await apiClient.post<BaseResponse<PaymentSettlementPreviewResponse>>(
        AccountingApis.previewSettlement(),
        payload()
      );
      setPreview(res.data?.data ?? null);
    } catch (error) {
      console.error("Failed to preview payment settlement", error);
      toast.error("Failed to preview payment settlement");
      setPreview(null);
    } finally {
      setPreviewing(false);
    }
  }, [restaurantId, canView, payload]);

  const createSettlement = async () => {
    if (!restaurantId || !canView || !canManageSettlements) {
      toast.error("Settlement management requires finance.payment_settlements.manage permission.");
      return;
    }
    setActionId(-1);
    try {
      const body: PaymentSettlementCreateInput = payload();
      const res = await apiClient.post<BaseResponse<PaymentSettlementBatch>>(
        AccountingApis.createSettlement(),
        body
      );
      const batch = res.data?.data;
      toast.success(`Create batch completed${batch ? `: #${batch.id}` : ""}`);
      setPreview(null);
      await loadBatches();
    } catch (error) {
      console.error("Failed to create payment settlement", error);
      toast.error("Failed to create settlement batch");
    } finally {
      setActionId(null);
    }
  };

  const runBatchAction = async (
    batch: PaymentSettlementBatch,
    action: "match" | "approve" | "post" | "reverse"
  ) => {
    if (!canManageSettlements) {
      toast.error("Settlement management requires finance.payment_settlements.manage permission.");
      return;
    }
    setActionId(batch.id);
    try {
      if (action === "match") {
        await apiClient.post<BaseResponse<PaymentSettlementBatch>>(AccountingApis.matchSettlement(batch.id), {});
        toast.success("Settlement matched");
      } else if (action === "approve") {
        const body: PaymentSettlementVarianceApprovalInput = {
          reason: varianceReason.trim() || "Approved settlement variance from UI",
        };
        await apiClient.post<BaseResponse<PaymentSettlementBatch>>(
          AccountingApis.approveSettlementVariance(batch.id),
          body
        );
        toast.success("Approve variance completed");
      } else if (action === "post") {
        await apiClient.post<BaseResponse<PaymentSettlementBatch>>(AccountingApis.postSettlement(batch.id), {});
        toast.success("Post settlement completed");
      } else {
        await apiClient.post<BaseResponse<PaymentSettlementBatch>>(
          AccountingApis.reverseSettlement(batch.id, settlementDate),
          {}
        );
        toast.success("Settlement reversed");
      }
      await loadBatches();
    } catch (error) {
      console.error("Failed to run settlement action", error);
      toast.error("Settlement action failed");
    } finally {
      setActionId(null);
    }
  };

  useEffect(() => {
    void loadBatches();
  }, [loadBatches]);

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
        <h1 className="text-2xl font-bold">Settlements</h1>
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
              <h1 className="text-2xl font-bold tracking-tight">Settlements</h1>
              <p className="text-sm text-muted-foreground">
                POS collections minus refunds and fees, reconciled to bank deposits.
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={loadBatches} disabled={loading || previewing}>
            <RefreshCw className={loading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
            Refresh
          </Button>
        </div>
        <FinanceSectionTabs />
        <AccountingNav />
      </div>

      {!canManageSettlements ? (
        <div className="border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900">
          Settlement management requires finance.payment_settlements.manage permission.
        </div>
      ) : null}

      <Card>
        <CardHeader className="border-b border-border p-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4" />
            Settlement preview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-7">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Payment method</Label>
              <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="digital">Digital wallet</SelectItem>
                  <SelectItem value="fonepay">Fonepay</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="settlement-instrument" className="text-xs text-muted-foreground">
                Instrument
              </Label>
              <Input
                id="settlement-instrument"
                value={instrument}
                onChange={(event) => setInstrument(event.target.value)}
                placeholder="HBL POS"
                className="h-9"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="settlement-from" className="text-xs text-muted-foreground">
                From
              </Label>
              <Input id="settlement-from" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="h-9" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="settlement-to" className="text-xs text-muted-foreground">
                To
              </Label>
              <Input id="settlement-to" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="h-9" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="settlement-date" className="text-xs text-muted-foreground">
                Settlement date
              </Label>
              <Input id="settlement-date" type="date" value={settlementDate} onChange={(event) => setSettlementDate(event.target.value)} className="h-9" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="actual-amount" className="text-xs text-muted-foreground">
                Bank deposit
              </Label>
              <Input
                id="actual-amount"
                type="number"
                value={actualAmount}
                onChange={(event) => setActualAmount(event.target.value)}
                className="h-9"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="fee-amount" className="text-xs text-muted-foreground">
                Processor fees
              </Label>
              <Input
                id="fee-amount"
                type="number"
                value={feeAmount}
                onChange={(event) => setFeeAmount(event.target.value)}
                className="h-9"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={previewSettlement}
              disabled={previewing || loading || !canManageSettlements}
              title={!canManageSettlements ? "Settlement management requires finance.payment_settlements.manage permission." : undefined}
            >
              {previewing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
              Preview settlement
            </Button>
            <Button
              variant="outline"
              onClick={createSettlement}
              disabled={!preview || actionId === -1 || !canManageSettlements}
              title={!canManageSettlements ? "Settlement management requires finance.payment_settlements.manage permission." : undefined}
            >
              {actionId === -1 ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Create batch
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader className="border-b border-border p-4">
            <CardTitle className="text-base">POS-to-bank bridge</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            {preview ? (
              <>
                {bridge.map(([label, amount]) => (
                  <div key={label} className="flex items-center justify-between gap-3 border-b border-border pb-2 last:border-0 last:pb-0">
                    <span className="text-sm text-muted-foreground">{label}</span>
                    <span className="font-mono text-sm font-semibold">{formatMoney(amount)}</span>
                  </div>
                ))}
                <div className="border border-border p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Formula
                  </div>
                  <div className="mt-2 text-sm">
                    POS collections - Refunds - Processor fees +/- Settlement variance = Bank deposit
                  </div>
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">Run preview to see the settlement bridge.</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border p-4">
            <CardTitle className="text-base">Preview lines</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {settlementLines.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">No preview lines loaded.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Instrument</TableHead>
                      <TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {settlementLines.map((line: PaymentSettlementPreviewLine) => (
                      <TableRow key={line.finance_event_id}>
                        <TableCell>{line.financial_date}</TableCell>
                        <TableCell className="capitalize">{eventLabel(line.event_type)}</TableCell>
                        <TableCell>{line.instrument || methodLabels[paymentMethod]}</TableCell>
                        <TableCell className="text-right font-mono">{formatMoney(line.gross_amount)}</TableCell>
                        <TableCell className="text-right font-mono">{formatMoney(line.net_amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b border-border p-4">
          <CardTitle className="text-base">Settlement batches</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-1.5">
            <Label htmlFor="variance-reason" className="text-xs text-muted-foreground">
              Variance reason
            </Label>
            <Textarea
              id="variance-reason"
              value={varianceReason}
              onChange={(event) => setVarianceReason(event.target.value)}
              placeholder="Processor short-settled this batch..."
            />
          </div>

          {loading && batches.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading settlements...
            </div>
          ) : batches.length === 0 ? (
            <div className="text-sm text-muted-foreground">No settlement batches found for this filter.</div>
          ) : (
            <div className="overflow-x-auto border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Batch</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Settlement date</TableHead>
                    <TableHead className="text-right">Expected</TableHead>
                    <TableHead className="text-right">Bank deposit</TableHead>
                    <TableHead className="text-right">Fees</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.map((batch) => (
                    <TableRow key={batch.id}>
                      <TableCell>
                        <div className="font-semibold">#{batch.id}</div>
                        <div className="text-xs text-muted-foreground">{batch.instrument || "-"}</div>
                      </TableCell>
                      <TableCell>{methodLabels[(batch.payment_method as PaymentMethod) || "card"] || batch.payment_method}</TableCell>
                      <TableCell>{batch.settlement_date}</TableCell>
                      <TableCell className="text-right font-mono">{formatMoney(batch.expected_amount)}</TableCell>
                      <TableCell className="text-right font-mono">{formatMoney(batch.actual_amount)}</TableCell>
                      <TableCell className="text-right font-mono">{formatMoney(batch.fee_amount)}</TableCell>
                      <TableCell className="text-right font-mono">{formatMoney(batch.variance_amount)}</TableCell>
                      <TableCell>
                        <span className={`rounded-full border px-2 py-1 text-xs font-semibold uppercase tracking-wide ${statusClass(batch.status)}`}>
                          {batch.status.replace(/_/g, " ")}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          {batch.status === "draft" && Number(batch.variance_amount || 0) === 0 ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => runBatchAction(batch, "match")}
                              disabled={actionId === batch.id || !canManageSettlements}
                            >
                              {actionId === batch.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                              Match
                            </Button>
                          ) : null}
                          {batch.status === "draft" && Number(batch.variance_amount || 0) !== 0 ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => runBatchAction(batch, "approve")}
                              disabled={actionId === batch.id || !canManageSettlements}
                            >
                              {actionId === batch.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                              Approve variance
                            </Button>
                          ) : null}
                          {(batch.status === "matched" || batch.status === "variance_approved") ? (
                            <Button size="sm" onClick={() => runBatchAction(batch, "post")} disabled={actionId === batch.id || !canManageSettlements}>
                              {actionId === batch.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                              Post settlement
                            </Button>
                          ) : null}
                          {batch.status === "posted" ? (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => runBatchAction(batch, "reverse")}
                              disabled={actionId === batch.id || !canManageSettlements}
                            >
                              {actionId === batch.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                              Reverse
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
