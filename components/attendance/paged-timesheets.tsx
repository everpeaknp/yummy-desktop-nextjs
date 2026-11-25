"use client";
import { useEffect, useState, type ReactNode } from "react";
import { attendanceApi } from "@/lib/attendance/api";
import type { AttendanceEntry } from "@/lib/attendance/types";
import { Button } from "@/components/ui/button";
import { operationError } from "./attendance-operations";

export function PagedTimesheets({ from, to, staffId, version, children }: { from: string; to: string; staffId?: number; version: unknown; children: (entries: AttendanceEntry[]) => ReactNode }) {
  const [offset, setOffset] = useState(0); const [approval, setApproval] = useState(""); const [rows, setRows] = useState<AttendanceEntry[] | null>(null); const [total, setTotal] = useState(0); const [error, setError] = useState(""); const [reload, setReload] = useState(0);
  useEffect(() => { setOffset(0); }, [from, to, staffId, approval]);
  useEffect(() => { let live = true; setRows(null); setError(""); attendanceApi.operationsPage("entries/page", { date_from: from, date_to: to, staff_id: staffId, offset, limit: 50, approval: approval || undefined }).then(page => { if (live) { setRows(page.items); setTotal(page.total); } }).catch(e => { if (live) setError(operationError(e)); }); return () => { live = false; }; }, [from, to, staffId, offset, approval, version, reload]);
  return <><div className="flex flex-wrap items-end justify-between gap-3 border-b p-3"><label className="space-y-1 text-sm">Approval status<select className="block min-h-11 rounded-md border bg-background px-3 focus-visible:outline focus-visible:outline-2" value={approval} onChange={e => setApproval(e.target.value)}><option value="">All statuses</option>{["draft", "pending", "approved", "rejected", "needs_correction", "payroll_exported"].map(value => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label><Button variant="outline" onClick={() => setReload(n => n + 1)}>Refresh timesheets</Button></div>{error ? <p role="alert" className="p-4 text-sm text-destructive">{error}</p> : rows === null ? <p role="status" className="p-4 text-sm">Loading timesheets…</p> : <>{children(rows)}<div className="flex flex-wrap items-center justify-between gap-3 border-t p-3 text-sm"><span>{total} entries · Page {Math.floor(offset / 50) + 1}</span><div className="flex gap-2"><Button variant="outline" disabled={!offset} onClick={() => setOffset(Math.max(0, offset - 50))}>Previous</Button><Button variant="outline" disabled={offset + 50 >= total} onClick={() => setOffset(offset + 50)}>Next</Button></div></div></>}</>;
}
