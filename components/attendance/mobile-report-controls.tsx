"use client";

import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { localDate, rangeError, shiftDate } from "@/lib/attendance/register";

export const mobileDetailClass = "max-sm:inset-0 max-sm:left-0 max-sm:top-0 max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:content-start max-sm:auto-rows-min max-sm:rounded-none max-sm:px-4 max-sm:pt-[max(1.5rem,env(safe-area-inset-top))] max-sm:pb-[max(1rem,env(safe-area-inset-bottom))]";

export function MobileReportControls({ from, to, daily = false, timezone, loading, onChange, onRefresh, onExport, exportDisabled }: {
  from: string; to: string; daily?: boolean; timezone?: string; loading: boolean;
  onChange: (from: string, to: string) => void; onRefresh: () => void; onExport?: () => void; exportDisabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(from);
  const [end, setEnd] = useState(to);
  const invalid = rangeError(start, daily ? start : end);
  function preset(kind: "today" | "week" | "month") {
    const today = localDate(timezone);
    const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
    setStart(kind === "today" ? today : kind === "month" ? `${today.slice(0, 7)}-01` : shiftDate(today, -((weekday + 6) % 7))); setEnd(today);
  }
  const label = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`)) : "Choose dates";
  return <div className="flex min-w-0 gap-2 md:hidden">
    {daily && <Button variant="outline" className="h-11 w-11 shrink-0 px-0" aria-label="Previous report day" disabled={!!rangeError(from, from)} onClick={() => onChange(shiftDate(from, -1), shiftDate(from, -1))}><ChevronLeft aria-hidden="true" className="h-4 w-4" /></Button>}
    <Button variant="outline" className="h-11 min-w-0 flex-1 justify-start px-3" onClick={() => { setStart(from); setEnd(to); setOpen(true); }}><CalendarDays aria-hidden="true" className="mr-2 h-4 w-4 shrink-0" /><span className="truncate">{label(from)}{!daily && from !== to ? ` – ${label(to)}` : ""}</span></Button>
    {daily && <Button variant="outline" className="h-11 w-11 shrink-0 px-0" aria-label="Next report day" disabled={!!rangeError(from, from)} onClick={() => onChange(shiftDate(from, 1), shiftDate(from, 1))}><ChevronRight aria-hidden="true" className="h-4 w-4" /></Button>}
    <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" className="h-11 w-11 shrink-0 px-0" aria-label="Report actions"><MoreHorizontal aria-hidden="true" className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem disabled={loading} onSelect={onRefresh}>Refresh report</DropdownMenuItem>{onExport && <DropdownMenuItem disabled={exportDisabled} onSelect={onExport}>Export CSV</DropdownMenuItem>}</DropdownMenuContent></DropdownMenu>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90dvh] overflow-y-auto overscroll-contain max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-t-xl max-sm:pb-[max(1.5rem,env(safe-area-inset-bottom))]"><DialogHeader><DialogTitle>Choose {daily ? "date" : "report period"}</DialogTitle><DialogDescription>Changes apply when you select Apply dates.</DialogDescription></DialogHeader>
      <div className="flex flex-wrap gap-2"><Button className="h-11" variant="outline" onClick={() => preset("today")}>Today</Button>{!daily && <><Button className="h-11" variant="outline" onClick={() => preset("week")}>This week</Button><Button className="h-11" variant="outline" onClick={() => preset("month")}>This month</Button></>}</div>
      <label className="space-y-1 text-sm font-medium">{daily ? "Date" : "From date"}<Input aria-label="Report start date" className="h-11 focus-visible:ring-2 focus-visible:ring-ring" type="date" value={start} onChange={event => setStart(event.target.value)} /></label>
      {!daily && <label className="space-y-1 text-sm font-medium">To date<Input aria-label="Report end date" className="h-11 focus-visible:ring-2 focus-visible:ring-ring" type="date" value={end} min={start} onChange={event => setEnd(event.target.value)} /></label>}
      {invalid && <p role="alert" className="text-sm text-destructive">{invalid}</p>}
      <Button className="h-11" disabled={!!invalid} onClick={() => { onChange(start, daily ? start : end); setOpen(false); }}>Apply dates</Button>
    </DialogContent></Dialog>
  </div>;
}
