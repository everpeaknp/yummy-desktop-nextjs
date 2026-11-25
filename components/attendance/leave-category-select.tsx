"use client";
import { useEffect, useState } from "react";
import { attendanceApi } from "@/lib/attendance/api";
import type { LeaveCategory } from "@/lib/attendance/operations-types";
import { operationError } from "./attendance-operations";

export function LeaveCategorySelect({ value, type, onChange }: { value: string; type: "paid" | "unpaid"; onChange: (id: string) => void }) {
  const [categories, setCategories] = useState<LeaveCategory[]>([]); const [error, setError] = useState("");
  useEffect(() => { let live = true; attendanceApi.leaveCategories().then(rows => { if (live) setCategories(rows); }).catch(e => { if (live) setError(operationError(e)); }); return () => { live = false; }; }, []);
  return <label className="block space-y-1 text-sm">Entitlement category<select className="block min-h-11 w-full rounded-md border bg-background px-3 focus-visible:outline focus-visible:outline-2" value={value} onChange={e => onChange(e.target.value)}><option value="">Manual-review leave (no quota deduction)</option>{categories.filter(c => c.is_active && c.leave_type === type).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>{error && <span role="alert" className="block text-xs text-destructive">Categories unavailable: {error}</span>}</label>;
}
