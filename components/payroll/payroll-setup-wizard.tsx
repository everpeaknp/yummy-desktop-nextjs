"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  payrollPayablesApi,
  type PayrollSchedule,
  type PayrollSetupReadiness,
  type PayrollStaffSetup,
} from "@/lib/payroll/payables";

type TrackingMode = "after_last_paid" | "current_month" | "custom";

function errorMessage(error: any) {
  const detail = error?.response?.data?.detail;
  return (typeof detail === "string" ? detail : detail?.message) || error?.message || "Request failed";
}

function blockerHref(staff: PayrollStaffSetup, action?: string | null) {
  if (action === "attendance_schedule") return `/attendance?tab=schedules&staff_id=${staff.staff_id}`;
  if (action === "attendance_timesheets") return `/attendance?tab=timesheets&staff_id=${staff.staff_id}`;
  if (action === "staff_profile") return `/staff/${staff.user_id}?tab=employment`;
  return `/staff/${staff.user_id}?tab=payroll`;
}

export function PayrollSetupWizard({
  open,
  onOpenChange,
  readiness,
  schedule,
  onReload,
  onBulkPrepare,
  bulkBusy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  readiness: PayrollSetupReadiness;
  schedule?: PayrollSchedule;
  onReload: () => Promise<void>;
  onBulkPrepare: () => Promise<void>;
  bulkBusy: boolean;
}) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [frequency, setFrequency] = useState<"monthly" | "weekly">("monthly");
  const [periodStartDay, setPeriodStartDay] = useState("1");
  const [paymentDelayDays, setPaymentDelayDays] = useState("0");
  const [trackingMode, setTrackingMode] = useState<TrackingMode>("after_last_paid");
  const [customTrackingDate, setCustomTrackingDate] = useState("");
  const initializedForOpen = useRef(false);

  useEffect(() => {
    if (!open) {
      initializedForOpen.current = false;
      return;
    }
    if (initializedForOpen.current) return;
    initializedForOpen.current = true;
    setStep(0);
    setFrequency(schedule?.frequency || "monthly");
    setPeriodStartDay(String(schedule?.period_start_day ?? 1));
    setPaymentDelayDays(String(schedule?.payment_delay_days ?? 0));
    const existing = schedule?.effective_from || "";
    if (existing === readiness.tracking_presets.after_last_paid_period) {
      setTrackingMode("after_last_paid");
    } else if (existing === readiness.tracking_presets.current_month_start) {
      setTrackingMode("current_month");
    } else if (existing) {
      setTrackingMode("custom");
      setCustomTrackingDate(existing);
    } else {
      setTrackingMode("after_last_paid");
      setCustomTrackingDate(readiness.tracking_presets.current_month_start);
    }
  }, [open, readiness, schedule]);

  const trackingDate = useMemo(() => {
    if (trackingMode === "after_last_paid") return readiness.tracking_presets.after_last_paid_period;
    if (trackingMode === "current_month") return readiness.tracking_presets.current_month_start;
    return customTrackingDate;
  }, [customTrackingDate, readiness.tracking_presets, trackingMode]);

  const saveSchedule = async () => {
    const startDay = Number(periodStartDay);
    const delay = Number(paymentDelayDays);
    const min = frequency === "monthly" ? 1 : 0;
    const max = frequency === "monthly" ? 31 : 6;
    if (!Number.isInteger(startDay) || startDay < min || startDay > max) {
      toast.error(frequency === "monthly" ? "Monthly start day must be 1–31" : "Weekly start day must be 0–6");
      return;
    }
    if (!Number.isInteger(delay) || delay < 0 || delay > 90 || !trackingDate) {
      toast.error("Choose a valid tracking date and payment delay");
      return;
    }
    setSaving(true);
    try {
      await payrollPayablesApi.saveSchedule({
        frequency,
        period_start_day: startDay,
        payment_delay_days: delay,
        effective_from: trackingDate,
        is_active: true,
      });
      await onReload();
      toast.success("Payroll schedule saved");
      setStep(2);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const stepTitle = ["Pay cycle", "Tracking date", "Employee readiness", "Final review"][step];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Set up automatic payroll</DialogTitle>
          <DialogDescription>{readiness.staff_ready} of {readiness.staff_total} employees ready • Step {step + 1} of 4: {stepTitle}</DialogDescription>
        </DialogHeader>
        <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(step + 1) * 25}%` }} /></div>

        {step === 0 ? <div className="space-y-5">
          <div><h3 className="font-semibold">Choose the normal pay cycle</h3><p className="text-sm text-muted-foreground">This controls the periods Yummy calculates automatically. Manual dates remain available for off-cycle payroll.</p></div>
          <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Pay cycle</Label><Select value={frequency} onValueChange={(value: "monthly" | "weekly") => { setFrequency(value); setPeriodStartDay(value === "monthly" ? "1" : "0"); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="weekly">Weekly</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>{frequency === "monthly" ? "Period starts on day" : "Week starts (0 Monday – 6 Sunday)"}</Label><Input type="number" value={periodStartDay} onChange={(event) => setPeriodStartDay(event.target.value)} /></div></div>
          <div className="space-y-2"><Label>Payment due after period ends</Label><Input className="max-w-xs" type="number" min="0" max="90" value={paymentDelayDays} onChange={(event) => setPaymentDelayDays(event.target.value)} /><p className="text-xs text-muted-foreground">Use 0 when salary is due immediately after the period closes.</p></div>
        </div> : null}

        {step === 1 ? <div className="space-y-5">
          <div><h3 className="font-semibold">Where should unpaid payroll begin?</h3><p className="text-sm text-muted-foreground">This prevents salaries already paid outside Yummy from becoming false debt.</p></div>
          <RadioGroup value={trackingMode} onValueChange={(value) => setTrackingMode(value as TrackingMode)} className="space-y-3">
            <TrackingChoice id="after_last_paid" value="after_last_paid" title="After last paid period" description={`Recommended from ${readiness.tracking_presets.after_last_paid_period}`} />
            <TrackingChoice id="current_month" value="current_month" title="Start of current month" description={readiness.tracking_presets.current_month_start} />
            <TrackingChoice id="custom" value="custom" title="Custom" description="Choose the first genuinely unpaid date" />
          </RadioGroup>
          {trackingMode === "custom" ? <div className="space-y-2"><Label>First unpaid date</Label><Input className="max-w-xs" type="date" value={customTrackingDate} onChange={(event) => setCustomTrackingDate(event.target.value)} /></div> : null}
          <div className="rounded-xl border bg-muted/30 p-4 text-sm">Payroll will track unpaid salary from <strong>{trackingDate || "—"}</strong>.</div>
        </div> : null}

        {step === 2 ? <div className="space-y-4">
          <div><h3 className="font-semibold">Employee readiness</h3><p className="text-sm text-muted-foreground">Resolve each item before relying on automatic payroll.</p></div>
          <div className="space-y-2">{readiness.staff.map((staff) => <div key={staff.staff_id} className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2">{staff.ready ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <AlertTriangle className="h-5 w-5 text-amber-600" />}<p className="font-semibold">{staff.staff_name}</p><Badge variant="outline" className="capitalize">{staff.salary_type}</Badge></div>{staff.blockers.length ? <p className="mt-1 text-sm text-muted-foreground">{staff.blockers[0].message}</p> : <p className="mt-1 text-sm text-emerald-700">Compensation and attendance setup are ready.</p>}</div>{!staff.ready && staff.blockers[0] ? <Button asChild size="sm" variant="outline"><Link href={blockerHref(staff, staff.blockers[0].action)} onClick={() => onOpenChange(false)}>Fix {staff.blockers[0].action === "attendance_schedule" ? "schedule" : "issue"}</Link></Button> : null}</div>)}</div>
        </div> : null}

        {step === 3 ? <div className="space-y-5">
          <div className={`rounded-xl border p-5 ${readiness.all_ready ? "border-emerald-500/30 bg-emerald-500/10" : "border-amber-500/30 bg-amber-500/10"}`}><div className="flex items-center gap-2 text-lg font-semibold">{readiness.all_ready ? <CheckCircle2 className="text-emerald-600" /> : <AlertTriangle className="text-amber-600" />}{readiness.all_ready ? "Payroll setup is ready" : `${readiness.blocking_staff_count} employees still need attention`}</div><p className="mt-2 text-sm text-muted-foreground">{readiness.payroll_schedule_configured ? "Automatic pay cycle configured." : "The automatic pay cycle still needs to be saved."} {readiness.staff_ready} of {readiness.staff_total} employees currently pass readiness checks.</p></div>
          {!readiness.all_ready ? <div className="space-y-2">{readiness.staff.filter((staff) => !staff.ready).map((staff) => <div key={staff.staff_id} className="flex items-center justify-between rounded-lg border p-3"><div><p className="font-medium">{staff.staff_name}</p><p className="text-xs text-muted-foreground">{staff.blockers.map((row) => row.message).join(" • ")}</p></div><Button asChild size="sm" variant="outline"><Link href={blockerHref(staff, staff.blockers[0]?.action)} onClick={() => onOpenChange(false)}>Fix</Link></Button></div>)}</div> : null}
          <Button onClick={onBulkPrepare} disabled={bulkBusy || !readiness.payroll_schedule_configured}>{bulkBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Prepare all ready payroll</Button>
        </div> : null}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => step === 0 ? onOpenChange(false) : setStep((value) => value - 1)}>{step === 0 ? "Close" : "Back"}</Button>
          {step === 0 ? <Button onClick={() => setStep(1)}>Continue</Button> : null}
          {step === 1 ? <Button onClick={saveSchedule} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save and check staff</Button> : null}
          {step === 2 ? <Button onClick={() => setStep(3)}>Final review</Button> : null}
          {step === 3 ? <Button onClick={() => onOpenChange(false)}>Done</Button> : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TrackingChoice({ id, value, title, description }: { id: string; value: string; title: string; description: string }) {
  return <Label htmlFor={id} className="flex cursor-pointer items-start gap-3 rounded-xl border p-4"><RadioGroupItem id={id} value={value} className="mt-1" /><span><span className="block font-semibold">{title}</span><span className="block text-sm font-normal text-muted-foreground">{description}</span></span></Label>;
}
