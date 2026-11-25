"use client";
import { useState } from "react";
import { attendanceApi } from "@/lib/attendance/api";
import type { AttendancePayrollPreview } from "@/lib/attendance/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { operationError } from "./attendance-operations";

export function PayrollAdjustmentControls({ row, onSaved }: { row: AttendancePayrollPreview; onSaved: () => void }) {
  const days = row.days.filter(d => d.payroll_finalized);
  const [date, setDate] = useState(days[0]?.date || ""); const [amount, setAmount] = useState(""); const [reason, setReason] = useState(""); const [reverse, setReverse] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  if (!days.length) return null;
  const changes = days.flatMap(d => d.adjustments || []); const reversed = new Set(changes.map(a => a.reversal_of_id).filter(Boolean));
  async function save() {
    setBusy(true); setError("");
    try { if (reason.trim().length < 3) throw new Error("Enter a meaningful reason."); if (reverse) await attendanceApi.reversePayrollAdjustment(Number(reverse), reason.trim()); else { if (!Number.isFinite(Number(amount)) || !Number(amount)) throw new Error("Enter a nonzero signed amount."); await attendanceApi.adjustPayroll({ staff_id: row.staff_id, work_date: date, amount, reason: reason.trim() }); } onSaved(); } catch (e) { setError(operationError(e)); } finally { setBusy(false); }
  }
  return <details className="rounded-lg border p-3"><summary className="min-h-11 cursor-pointer text-sm font-medium">Adjust finalized earnings</summary><form className="space-y-3 text-sm" onSubmit={e => { e.preventDefault(); void save(); }}><p className="text-xs text-muted-foreground">Append a signed adjustment or reverse an existing one. The finalized base and payments are not edited. Total earnings cannot go below zero.</p><label className="block">Action<select className="min-h-11 w-full rounded-md border bg-background px-3 focus-visible:outline focus-visible:outline-2" value={reverse} onChange={e => setReverse(e.target.value)}><option value="">New adjustment</option>{changes.filter(a => !a.reversal_of_id && !reversed.has(a.id)).map(a => <option key={a.id} value={a.id}>Reverse #{a.id}: {a.amount} · {a.reason}</option>)}</select></label>{!reverse && <div className="grid gap-3 sm:grid-cols-2"><label>Finalized date<select className="min-h-11 w-full rounded-md border bg-background px-3 focus-visible:outline focus-visible:outline-2" value={date} onChange={e => setDate(e.target.value)}>{days.map(d => <option key={d.date} value={d.date}>{d.date}</option>)}</select></label><label>Signed amount<Input required type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} /></label></div>}<label className="block">Reason<Input required minLength={3} maxLength={500} value={reason} onChange={e => setReason(e.target.value)} /></label>{error && <p role="alert" className="text-destructive">{error}</p>}<Button disabled={busy}>{reverse ? "Record reversal" : "Record earnings adjustment"}</Button></form></details>;
}
