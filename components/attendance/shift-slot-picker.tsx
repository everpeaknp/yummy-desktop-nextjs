"use client";

import { Button } from "@/components/ui/button";
import { OptionSelect } from "@/components/ui/option-select";
import type { AttendanceShiftTemplate } from "@/lib/attendance/types";

export function ShiftSlotPicker({ templates, value, onChange, disabled, label, maxShifts = 8 }: {
  templates: AttendanceShiftTemplate[]; value: number[]; onChange: (ids: number[]) => void;
  disabled?: boolean; label: string; maxShifts?: number;
}) {
  const unused = templates.filter(template => !value.includes(template.id));
  return <div className="min-w-0 w-full space-y-2">
    {!value.length && <p className="py-2 text-sm text-muted-foreground">Day off</p>}
    {value.map((id, index) => <div key={index} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
      <OptionSelect aria-label={`${label}, shift ${index + 1}`} name={`${label}-shift-${index + 1}`} className="h-auto min-h-11 min-w-0 w-full [&>span]:whitespace-normal [&>span]:text-left [&>span]:[overflow-wrap:anywhere]" disabled={disabled} value={String(id)}
        onValueChange={next => onChange(value.map((item, position) => position === index ? Number(next) : item))}>
        {!templates.some(template => template.id === id) && <option value={id}>Shift unavailable</option>}
        {templates.filter(template => template.id === id || !value.includes(template.id)).map(template =>
          <option key={template.id} value={template.id}>{template.name} · {template.start_local_time.slice(0, 5)}–{template.end_local_time.slice(0, 5)}</option>)}
      </OptionSelect>
      <Button type="button" variant="ghost" className="h-11 w-11 shrink-0 px-2" disabled={disabled}
        aria-label={`Remove ${label}, shift ${index + 1}`} onClick={() => onChange(value.filter((_, position) => position !== index))}>×</Button>
    </div>)}
    {!templates.length && <p className="text-xs text-muted-foreground">Create an active shift template before assigning working hours.</p>}
    <Button type="button" variant="outline" className="min-h-11 w-full" aria-label={`Add shift for ${label}`} disabled={disabled || !unused.length || value.length >= maxShifts}
      onClick={() => onChange([...value, unused[0].id])}>Add shift</Button>
  </div>;
}
