"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CircleDollarSign, Loader2, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import apiClient from "@/lib/api-client";
import { IncomeApis } from "@/lib/api/endpoints";
import { financeReportingApi } from "@/lib/api/finance-reporting-api";
import { useAuth } from "@/hooks/use-auth";
import { hasPermission } from "@/lib/role-permissions";
import { useRestaurant } from "@/hooks/use-restaurant";
import { AllocationLinesEditor, type AllocationLineItem, type EligibleHead } from "@/components/finance/allocation-lines-editor";
import { CashBankAccountSelect, type CashBankAccountOption } from "@/components/finance/cash-bank-account-select";
import { StationPicker } from "@/components/stations/station-picker";
import { legacyStationBucketForStationName } from "@/lib/finance-station-scope";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type IncomeRow = {
  id?: number;
  amount: number;
  paid_at: string;
  description?: string | null;
  source?: string | null;
  source_type?: string | null;
  order_id?: number | null;
  orderId?: number | null;
  payment_method?: string | null;
};

function yyyyMmDd(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function money(value: number) {
  return `NPR ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function OtherIncomeClient() {
  const user = useAuth((state) => state.user);
  const restaurant = useRestaurant((state) => state.restaurant);
  const canManageCoa = hasPermission(user, "finance.coa.manage");
  const [rows, setRows] = useState<IncomeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [businessLine, setBusinessLine] = useState<"restaurant" | "hotel">("restaurant");
  const [account, setAccount] = useState<CashBankAccountOption | null>(null);
  const [stationId, setStationId] = useState<number | null>(null);
  const [stationName, setStationName] = useState<string | null>(null);
  const [heads, setHeads] = useState<EligibleHead[]>([]);
  const [lines, setLines] = useState<AllocationLineItem[]>([]);
  const [saving, setSaving] = useState(false);
  const now = useMemo(() => new Date(), []);

  const load = useCallback(async () => {
    if (!user?.restaurant_id) return;
    setLoading(true);
    try {
      const response = await apiClient.get(IncomeApis.recent, {
        params: {
          restaurant_id: user.restaurant_id,
          date_from: yyyyMmDd(new Date(now.getFullYear(), now.getMonth(), 1)),
          date_to: yyyyMmDd(now),
          business_line: "all",
          limit: 100,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      });
      const entries = Array.isArray(response.data?.data) ? response.data.data as IncomeRow[] : [];
      setRows(entries.filter((entry) => {
        if (entry.order_id || entry.orderId) return false;
        const source = `${entry.source || ""} ${entry.source_type || ""}`.toLowerCase();
        return !source || source.includes("manual") || source.includes("other") || source.includes("income");
      }));
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Could not load other income.");
    } finally {
      setLoading(false);
    }
  }, [now, user?.restaurant_id]);

  useEffect(() => { void load(); }, [load]);

  const openCreate = () => {
    const line = restaurant?.hotel_enabled && !restaurant?.restaurant_enabled ? "hotel" : "restaurant";
    setBusinessLine(line);
    setAmount("");
    setDescription("");
    setAccount(null);
    setLines([]);
    setStationId(null);
    setStationName(null);
    setDialogOpen(true);
  };

  useEffect(() => {
    if (!dialogOpen || !user?.restaurant_id) return;
    financeReportingApi.getEligibleLeaves(Number(user.restaurant_id), { head_type: "income", business_line: businessLine })
      .then((result) => setHeads(result as EligibleHead[]))
      .catch(() => setHeads([]));
  }, [businessLine, dialogOpen, user?.restaurant_id]);

  const parsedAmount = Number(amount || 0);
  const isAllocated = parsedAmount > 0 && lines.length > 0 && Math.round(parsedAmount * 100) === lines.reduce((sum, line) => sum + Math.round(Number(line.amount || 0) * 100), 0);

  const save = async () => {
    if (!user?.restaurant_id || !account || !isAllocated) {
      toast.error("Enter an amount, receiving account, and a fully balanced income allocation.");
      return;
    }
    setSaving(true);
    try {
      await apiClient.post(IncomeApis.manual, {
        restaurant_id: Number(user.restaurant_id),
        amount: parsedAmount,
        payment_method: account.account_type === "drawer" ? "cash" : "bank_transfer",
        paid_at: new Date().toISOString(),
        description: description.trim() || null,
        business_line: businessLine,
        station: legacyStationBucketForStationName(stationName, businessLine),
        station_id: stationId,
        account_type: account.account_type,
        account_id: account.id,
        ...(account.account_type === "drawer" ? { drawer_session_id: account.drawer_session_id } : {}),
        lines,
      }, { params: { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } });
      toast.success("Other income recorded.");
      setDialogOpen(false);
      void load();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || error.response?.data?.message || "Could not record income.");
    } finally {
      setSaving(false);
    }
  };

  const total = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Finance</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Other income</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Record rent, commission, interest, grants, and other non-sales income. Order revenue stays in Sales.</p></div>
        <div className="flex gap-2"><Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button><Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Add other income</Button></div>
      </header>
      <Card className="max-w-sm border-border shadow-none"><CardContent className="flex items-center justify-between p-5"><div><p className="text-xs font-medium uppercase text-muted-foreground">Other income this month</p><p className="mt-2 text-2xl font-semibold tabular-nums">{money(total)}</p></div><CircleDollarSign className="h-6 w-6 text-emerald-600" /></CardContent></Card>
      <Card className="border-border shadow-none"><CardContent className="p-0">
        {loading ? <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : rows.length ? <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead>Source</TableHead><TableHead>Received through</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader><TableBody>{rows.map((row, index) => <TableRow key={row.id || `${row.paid_at}:${index}`}><TableCell>{new Date(row.paid_at).toLocaleDateString()}</TableCell><TableCell className="font-medium">{row.description || "Other income"}</TableCell><TableCell><Badge variant="secondary">Other income</Badge></TableCell><TableCell className="text-muted-foreground">{row.payment_method?.replaceAll("_", " ") || "—"}</TableCell><TableCell className="text-right font-semibold text-emerald-600">+ {money(row.amount)}</TableCell></TableRow>)}</TableBody></Table></div> : <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">No other income was recorded this month.</div>}
      </CardContent></Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>Add other income</DialogTitle><DialogDescription>Record genuine non-sales income and allocate it to one or more income heads.</DialogDescription></DialogHeader>
          <div className="grid gap-5 py-2">
            {restaurant?.hotel_enabled && restaurant?.restaurant_enabled ? <div className="grid gap-2"><Label>Business</Label><Select value={businessLine} onValueChange={(value) => { setBusinessLine(value as "restaurant" | "hotel"); setLines([]); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="restaurant">Restaurant</SelectItem><SelectItem value="hotel">Hotel</SelectItem></SelectContent></Select></div> : null}
            <div className="grid gap-2"><Label>Amount</Label><Input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => { setAmount(event.target.value); setLines([]); }} placeholder="0.00" /></div>
            <CashBankAccountSelect value={account} onChange={setAccount} businessLine={businessLine} label="Receive into" />
            {user?.restaurant_id && (
              <StationPicker
                restaurantId={user.restaurant_id}
                value={stationId}
                onChange={(id, station) => {
                  setStationId(id);
                  setStationName(station?.name ?? null);
                }}
              />
            )}
            <div className="grid gap-2"><Label>Description</Label><Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What was this income for?" /></div>
            <AllocationLinesEditor
              totalAmount={parsedAmount}
              eligibleHeads={heads}
              lines={lines}
              onChange={setLines}
              headTypeLabel="Income head"
              disabled={saving}
              restaurantId={user?.restaurant_id ?? undefined}
              headType="income"
              canCreateHead={canManageCoa}
              onHeadCreated={(head) => setHeads((prev) => [head, ...prev])}
            />
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button><Button onClick={() => void save()} disabled={saving || !account || !isAllocated}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Record income</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
