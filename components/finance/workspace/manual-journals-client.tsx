"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/use-auth";
import { financeReportingApi } from "@/lib/api/finance-reporting-api";
import { hasPermission } from "@/lib/role-permissions";
import type { FinanceReportingEntryRead, FinanceReportingHeadRead } from "@/types/finance-reporting";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { AppPage } from "@/components/patterns/page/app-page";
import { PageHeader } from "@/components/patterns/page/page-header";
import { DataList, ListRow } from "@/components/patterns/data/data-list";

type JournalLine = {
  key: string;
  reportingHeadId: string;
  debit: string;
  credit: string;
  description: string;
};

const emptyLine = (): JournalLine => ({
  key: `${Date.now()}-${Math.random()}`,
  reportingHeadId: "",
  debit: "",
  credit: "",
  description: "",
});

const today = () => new Date().toISOString().slice(0, 10);
const minor = (value: string | number | null | undefined) => Math.round(Number(value || 0) * 100);
const money = (value: number) => `NPR ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function referenceOf(entry: FinanceReportingEntryRead) {
  const parts = entry.source_key.split(":");
  return parts[parts.length - 1] || `JV-${entry.id}`;
}

export function ManualJournalsClient() {
  const user = useAuth((state) => state.user);
  const canView = hasPermission(user, "finance.journal.view");
  const canCreate = hasPermission(user, "finance.journal.manage");
  const canReverse = hasPermission(user, "finance.journal.reverse");
  const [entries, setEntries] = useState<FinanceReportingEntryRead[]>([]);
  const [heads, setHeads] = useState<FinanceReportingHeadRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reference, setReference] = useState("");
  const [businessDate, setBusinessDate] = useState(today());
  const [memo, setMemo] = useState("");
  const [businessLine, setBusinessLine] = useState("restaurant");
  const [lines, setLines] = useState<JournalLine[]>([emptyLine(), emptyLine()]);
  const [reverseEntry, setReverseEntry] = useState<FinanceReportingEntryRead | null>(null);
  const [reverseReason, setReverseReason] = useState("");

  const load = useCallback(async () => {
    if (!canView || !user?.restaurant_id) return;
    setLoading(true);
    try {
      const [journalResult, headResult] = await Promise.all([
        financeReportingApi.listManualJournals({ limit: 100, offset: 0 }),
        financeReportingApi.getEligibleLeaves(Number(user.restaurant_id)),
      ]);
      setEntries(journalResult.entries);
      setHeads(headResult);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Could not load journal vouchers.");
    } finally {
      setLoading(false);
    }
  }, [canView, user?.restaurant_id]);

  useEffect(() => { void load(); }, [load]);

  const totals = useMemo(() => lines.reduce((sum, line) => ({
    debit: sum.debit + minor(line.debit),
    credit: sum.credit + minor(line.credit),
  }), { debit: 0, credit: 0 }), [lines]);
  const completeLines = lines.filter((line) => line.reportingHeadId && (minor(line.debit) > 0 || minor(line.credit) > 0));
  const isBalanced = completeLines.length >= 2 && totals.debit > 0 && totals.debit === totals.credit;

  const openCreate = () => {
    setReference(`JV-${today().replaceAll("-", "")}-${String(Date.now()).slice(-6)}`);
    setBusinessDate(today());
    setMemo("");
    setBusinessLine("restaurant");
    setLines([emptyLine(), emptyLine()]);
    setCreateOpen(true);
  };

  const updateLine = (key: string, field: keyof Omit<JournalLine, "key">, value: string) => {
    setLines((current) => current.map((line) => {
      if (line.key !== key) return line;
      if (field === "debit" && value) return { ...line, debit: value, credit: "" };
      if (field === "credit" && value) return { ...line, credit: value, debit: "" };
      return { ...line, [field]: value };
    }));
  };

  const save = async () => {
    if (!reference.trim() || !memo.trim() || !isBalanced) {
      toast.error("Add a reference, memo, and at least two balanced debit and credit lines.");
      return;
    }
    setSaving(true);
    try {
      await financeReportingApi.postManualJournal({
        client_reference: reference.trim(),
        business_date: businessDate,
        business_line: businessLine,
        memo: memo.trim(),
        lines: completeLines.map((line) => ({
          reporting_head_id: Number(line.reportingHeadId),
          debit: minor(line.debit) > 0 ? Number(line.debit) : null,
          credit: minor(line.credit) > 0 ? Number(line.credit) : null,
          description: line.description.trim() || null,
        })),
      });
      toast.success("Journal voucher posted.");
      setCreateOpen(false);
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Could not post journal voucher.");
    } finally {
      setSaving(false);
    }
  };

  const reverse = async () => {
    if (!reverseEntry || !reverseReason.trim()) return;
    setSaving(true);
    try {
      await financeReportingApi.reverseManualJournal(reverseEntry.id, { reason: reverseReason.trim() });
      toast.success("Journal voucher reversed with a linked audit entry.");
      setReverseEntry(null);
      setReverseReason("");
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Could not reverse journal voucher.");
    } finally {
      setSaving(false);
    }
  };

  if (!canView) {
    return (
      <AppPage width="reading">
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-4 text-lg font-semibold">Access restricted</p>
            <p className="mt-2 text-sm text-muted-foreground">You do not have permission to view journal vouchers.</p>
          </CardContent>
        </Card>
      </AppPage>
    );
  }

  return (
    <AppPage width="wide" density="compact">
      <PageHeader
        title="Journal vouchers"
        description="Exceptional accounting adjustments. Posted vouchers are corrected by reversal, never deletion."
        actions={canCreate ? (
          <Button className="w-full sm:w-auto" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            New voucher
          </Button>
        ) : undefined}
      />

      <Card className="overflow-hidden border-border shadow-none">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex min-h-64 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : entries.length ? (
            <>
              <DataList className="rounded-none border-0 md:hidden">
                {entries.map((entry) => {
                  const total = entry.lines.reduce(
                    (sum, line) => sum + Number(line.debit || 0),
                    0,
                  );
                  const reversible =
                    canReverse &&
                    entry.status === "posted" &&
                    !entry.source_type.startsWith("reversal:");
                  return (
                    <div key={entry.id}>
                      <ListRow
                        title={referenceOf(entry)}
                        description={`${new Date(`${entry.business_date}T00:00:00`).toLocaleDateString()} · ${entry.lines.find((line) => line.description)?.description || "Journal voucher"}`}
                        meta={<span className="font-semibold tabular-nums">{money(total)}</span>}
                        trailing={<Badge variant={entry.status === "posted" ? "secondary" : "outline"}>{entry.status}</Badge>}
                      />
                      {reversible ? (
                        <div className="flex justify-end border-t border-border/60 bg-muted/20 px-3 py-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8"
                            onClick={() => {
                              setReverseEntry(entry);
                              setReverseReason("");
                            }}
                          >
                            <RotateCcw className="mr-2 h-4 w-4" /> Reverse
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </DataList>
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Memo</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => {
                      const total = entry.lines.reduce(
                        (sum, line) => sum + Number(line.debit || 0),
                        0,
                      );
                      return (
                        <TableRow key={entry.id}>
                          <TableCell>{new Date(`${entry.business_date}T00:00:00`).toLocaleDateString()}</TableCell>
                          <TableCell className="font-mono text-xs">{referenceOf(entry)}</TableCell>
                          <TableCell className="max-w-md font-medium">{entry.lines.find((line) => line.description)?.description || "Journal voucher"}</TableCell>
                          <TableCell className="text-right tabular-nums">{money(total)}</TableCell>
                          <TableCell><Badge variant={entry.status === "posted" ? "secondary" : "outline"}>{entry.status}</Badge></TableCell>
                          <TableCell className="text-right">
                            {canReverse && entry.status === "posted" && !entry.source_type.startsWith("reversal:") ? (
                              <Button size="sm" variant="ghost" onClick={() => { setReverseEntry(entry); setReverseReason(""); }}>
                                <RotateCcw className="mr-2 h-4 w-4" /> Reverse
                              </Button>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
              <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
              <p className="mt-4 font-medium">No manual journal vouchers</p>
              <p className="mt-1 text-sm text-muted-foreground">Normal operations post automatically. Use a voucher only for a genuine accounting adjustment.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[92dvh] w-[calc(100vw-1.5rem)] max-w-5xl overflow-y-auto rounded-2xl p-4 sm:p-6">
          <DialogHeader><DialogTitle>New journal voucher</DialogTitle><DialogDescription>Debits and credits must balance exactly. Choose only postable account heads.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-3"><div className="grid gap-2"><Label>Reference</Label><Input value={reference} onChange={(event) => setReference(event.target.value)} /></div><div className="grid gap-2"><Label>Business date</Label><Input type="date" value={businessDate} onChange={(event) => setBusinessDate(event.target.value)} /></div><div className="grid gap-2"><Label>Business</Label><Select value={businessLine} onValueChange={setBusinessLine}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="restaurant">Restaurant</SelectItem><SelectItem value="hotel">Hotel</SelectItem><SelectItem value="shared">Shared</SelectItem></SelectContent></Select></div></div>
          <div className="grid gap-2"><Label>Memo</Label><Textarea value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="Why is this adjustment required?" /></div>
          <div className="mt-2 space-y-3 md:hidden">
            {lines.map((line, index) => (
              <section key={line.key} className="rounded-2xl border border-border p-3">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-medium">Line {index + 1}</p>
                  <Button variant="ghost" size="icon" className="h-9 w-9" disabled={lines.length <= 2} onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))} aria-label={`Remove line ${index + 1}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid gap-3">
                  <div className="grid gap-1.5">
                    <Label>Account head</Label>
                    <Select value={line.reportingHeadId} onValueChange={(value) => updateLine(line.key, "reportingHeadId", value)}>
                      <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select account" /></SelectTrigger>
                      <SelectContent className="max-h-72">{heads.map((head) => <SelectItem key={head.id} value={String(head.id)}>{head.hierarchy_path || head.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="grid gap-1.5"><Label>Debit</Label><Input className="h-11 rounded-xl" type="number" min="0" step="0.01" value={line.debit} onChange={(event) => updateLine(line.key, "debit", event.target.value)} placeholder="0.00" /></div>
                    <div className="grid gap-1.5"><Label>Credit</Label><Input className="h-11 rounded-xl" type="number" min="0" step="0.01" value={line.credit} onChange={(event) => updateLine(line.key, "credit", event.target.value)} placeholder="0.00" /></div>
                  </div>
                  <div className="grid gap-1.5"><Label>Line note</Label><Input className="h-11 rounded-xl" value={line.description} onChange={(event) => updateLine(line.key, "description", event.target.value)} placeholder="Optional" /></div>
                </div>
              </section>
            ))}
          </div>
          <div className="mt-2 hidden overflow-x-auto rounded-lg border md:block"><Table><TableHeader><TableRow><TableHead className="min-w-64">Account head</TableHead><TableHead className="w-40">Debit</TableHead><TableHead className="w-40">Credit</TableHead><TableHead className="min-w-48">Line note</TableHead><TableHead className="w-12" /></TableRow></TableHeader><TableBody>{lines.map((line) => <TableRow key={line.key}><TableCell><Select value={line.reportingHeadId} onValueChange={(value) => updateLine(line.key, "reportingHeadId", value)}><SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger><SelectContent className="max-h-72">{heads.map((head) => <SelectItem key={head.id} value={String(head.id)}>{head.hierarchy_path || head.name}</SelectItem>)}</SelectContent></Select></TableCell><TableCell><Input type="number" min="0" step="0.01" value={line.debit} onChange={(event) => updateLine(line.key, "debit", event.target.value)} placeholder="0.00" /></TableCell><TableCell><Input type="number" min="0" step="0.01" value={line.credit} onChange={(event) => updateLine(line.key, "credit", event.target.value)} placeholder="0.00" /></TableCell><TableCell><Input value={line.description} onChange={(event) => updateLine(line.key, "description", event.target.value)} placeholder="Optional" /></TableCell><TableCell><Button variant="ghost" size="icon" disabled={lines.length <= 2} onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}><Trash2 className="h-4 w-4" /></Button></TableCell></TableRow>)}</TableBody></Table></div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><Button variant="outline" size="sm" onClick={() => setLines((current) => [...current, emptyLine()])}><Plus className="mr-2 h-4 w-4" />Add line</Button><div className={`rounded-lg border px-4 py-3 text-sm ${isBalanced ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}><span className="mr-4">Debit {money(totals.debit / 100)}</span><span>Credit {money(totals.credit / 100)}</span><strong className="ml-4">{isBalanced ? "Balanced" : `Difference ${money(Math.abs(totals.debit - totals.credit) / 100)}`}</strong></div></div>
          <DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>Cancel</Button><Button onClick={() => void save()} disabled={saving || !isBalanced}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Post voucher</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(reverseEntry)} onOpenChange={(open) => { if (!open) setReverseEntry(null); }}><DialogContent><DialogHeader><DialogTitle>Reverse journal voucher?</DialogTitle><DialogDescription>This creates an equal and opposite audit entry. The original voucher is never deleted.</DialogDescription></DialogHeader><div className="grid gap-2"><Label>Reason</Label><Textarea value={reverseReason} onChange={(event) => setReverseReason(event.target.value)} placeholder="Required reversal reason" /></div><DialogFooter><Button variant="outline" onClick={() => setReverseEntry(null)} disabled={saving}>Cancel</Button><Button variant="destructive" onClick={() => void reverse()} disabled={saving || !reverseReason.trim()}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}Reverse voucher</Button></DialogFooter></DialogContent></Dialog>
    </AppPage>
  );
}
