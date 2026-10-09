"use client";

import { useEffect, useState } from "react";
import { BellRing, Loader2, Mail, MessageSquare } from "lucide-react";
import { toast } from "sonner";

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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import apiClient from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/api-error-message";
import { CustomerApis } from "@/lib/api/endpoints";

interface CreditReminderSettings {
  credit_order_email_enabled: boolean;
  credit_reminders_enabled: boolean;
  credit_reminder_email_enabled: boolean;
  credit_reminder_sms_enabled: boolean;
  credit_reminder_interval_days: number;
  credit_reminder_send_hour: number;
  credit_reminder_min_amount: number;
}

const defaults: CreditReminderSettings = {
  credit_order_email_enabled: true,
  credit_reminders_enabled: false,
  credit_reminder_email_enabled: true,
  credit_reminder_sms_enabled: false,
  credit_reminder_interval_days: 7,
  credit_reminder_send_hour: 9,
  credit_reminder_min_amount: 1,
};

export function CreditReminderSettingsDialog({
  restaurantId,
  open,
  onOpenChange,
}: {
  restaurantId: number | null | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [settings, setSettings] = useState(defaults);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !restaurantId) return;
    let active = true;
    setLoading(true);
    apiClient
      .get(CustomerApis.creditReminderSettings(restaurantId))
      .then((response) => {
        const data = response.data?.data ?? response.data;
        if (active) setSettings({ ...defaults, ...data });
      })
      .catch((error) => {
        toast.error(getApiErrorMessage(error, "Could not load reminder settings"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, restaurantId]);

  const update = <K extends keyof CreditReminderSettings>(
    key: K,
    value: CreditReminderSettings[K],
  ) => setSettings((current) => ({ ...current, [key]: value }));

  const save = async () => {
    if (!restaurantId) return;
    setSaving(true);
    try {
      const response = await apiClient.put(
        CustomerApis.creditReminderSettings(restaurantId),
        settings,
      );
      setSettings({ ...defaults, ...(response.data?.data ?? response.data) });
      toast.success("Credit reminder settings saved");
      onOpenChange(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not save reminder settings"));
    } finally {
      setSaving(false);
    }
  };

  const channelsDisabled = !settings.credit_reminders_enabled;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto overscroll-contain p-0">
        <DialogHeader className="border-b border-border px-6 py-5 pr-12">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BellRing className="h-5 w-5" />
            </span>
            <div>
              <DialogTitle>Credit notifications</DialogTitle>
              <DialogDescription className="mt-1">
                Keep customers informed about unpaid balances without changing how your team manages payments.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex min-h-72 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading settings…
          </div>
        ) : (
          <div className="space-y-5 px-6 py-5">
            <SettingRow
              icon={<Mail className="h-4 w-4" />}
              title="Email each unpaid order"
              description="Send a receipt-like email when a sale is added to a customer's unpaid balance."
              checked={settings.credit_order_email_enabled}
              onCheckedChange={(checked) => update("credit_order_email_enabled", checked)}
            />

            <div className="rounded-2xl border border-border">
              <SettingRow
                icon={<BellRing className="h-4 w-4" />}
                title="Send outstanding balance reminders"
                description="Remind linked customers who still have an unpaid balance."
                checked={settings.credit_reminders_enabled}
                onCheckedChange={(checked) => update("credit_reminders_enabled", checked)}
                borderless
              />

              <div className="space-y-4 border-t border-border px-4 py-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <NumberField
                    id="credit-reminder-days"
                    label="Repeat every"
                    suffix="days"
                    min={1}
                    max={90}
                    disabled={channelsDisabled}
                    value={settings.credit_reminder_interval_days}
                    onChange={(value) => update("credit_reminder_interval_days", value)}
                  />
                  <ReminderHourField
                    disabled={channelsDisabled}
                    hour={settings.credit_reminder_send_hour}
                    onHourChange={(value) => update("credit_reminder_send_hour", value)}
                  />
                  <NumberField
                    id="credit-reminder-minimum"
                    label="Minimum due"
                    prefix="NPR"
                    min={0.01}
                    step={0.01}
                    disabled={channelsDisabled}
                    value={settings.credit_reminder_min_amount}
                    onChange={(value) => update("credit_reminder_min_amount", value)}
                  />
                </div>

                <p className="text-xs text-muted-foreground">
                  Sent during the {formatReminderHour(settings.credit_reminder_send_hour)} hour in the restaurant&apos;s local time.
                </p>

                <ChannelRow
                  icon={<Mail className="h-4 w-4" />}
                  title="Email reminders"
                  description="Only verified account email addresses receive reminders."
                  disabled={channelsDisabled}
                  checked={settings.credit_reminder_email_enabled}
                  onCheckedChange={(checked) => update("credit_reminder_email_enabled", checked)}
                />
                <ChannelRow
                  icon={<MessageSquare className="h-4 w-4" />}
                  title="SMS reminders"
                  description="Uses this restaurant's SMS credits for each message sent."
                  disabled={channelsDisabled}
                  checked={settings.credit_reminder_sms_enabled}
                  onCheckedChange={(checked) => update("credit_reminder_sms_enabled", checked)}
                />
              </div>
            </div>

            <p className="text-xs leading-5 text-muted-foreground">
              Reminders go only to customers linked to a verified Yummy account. These settings never block sales or change account balances.
            </p>
          </div>
        )}

        <DialogFooter className="border-t border-border px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={loading || saving || !restaurantId}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatReminderHour(hour: number) {
  const period = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12} ${period}`;
}

function ReminderHourField({
  disabled,
  hour,
  onHourChange,
}: {
  disabled: boolean;
  hour: number;
  onHourChange: (value: number) => void;
}) {
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  const setPeriod = (nextPeriod: "AM" | "PM") => {
    onHourChange((hour % 12) + (nextPeriod === "PM" ? 12 : 0));
  };

  return (
    <fieldset className="space-y-1.5">
      <legend className="text-xs text-muted-foreground">Send during</legend>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Hour</span>
          <Select
            disabled={disabled}
            value={String(hour12)}
            onValueChange={(value) => onHourChange((Number(value) % 12) + (period === "PM" ? 12 : 0))}
          >
            <SelectTrigger aria-label="Reminder hour" className="h-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => (
                <SelectItem key={value} value={String(value)}>{value}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">AM/PM</span>
          <Select disabled={disabled} value={period} onValueChange={(value) => setPeriod(value as "AM" | "PM")}>
            <SelectTrigger aria-label="Reminder time period" className="h-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AM">AM</SelectItem>
              <SelectItem value="PM">PM</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </fieldset>
  );
}

function SettingRow({
  icon,
  title,
  description,
  checked,
  onCheckedChange,
  disabled = false,
  borderless = false,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  borderless?: boolean;
}) {
  return (
    <div className={`flex items-start justify-between gap-4 px-4 py-4 ${borderless ? "" : "rounded-2xl border border-border"}`}>
      <div className="flex min-w-0 gap-3">
        <span className="mt-0.5 text-muted-foreground">{icon}</span>
        <div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch disabled={disabled} checked={checked} onCheckedChange={onCheckedChange} aria-label={title} />
    </div>
  );
}

function ChannelRow({ disabled, ...props }: Omit<React.ComponentProps<typeof SettingRow>, "borderless"> & { disabled: boolean }) {
  return (
    <div className={disabled ? "opacity-50" : ""}>
      <SettingRow {...props} disabled={disabled} borderless />
    </div>
  );
}

function NumberField({
  id,
  label,
  prefix,
  suffix,
  value,
  min,
  max,
  step = 1,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  prefix?: string;
  suffix?: string;
  value: number;
  min: number;
  max?: number;
  step?: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center rounded-xl border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
        {prefix ? <span className="pl-3 text-xs text-muted-foreground">{prefix}</span> : null}
        <Input
          id={id}
          name={id}
          type="number"
          inputMode={step === 1 ? "numeric" : "decimal"}
          autoComplete="off"
          className="h-10 border-0 bg-transparent shadow-none focus-visible:ring-0"
          value={value}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        {suffix ? <span className="pr-3 text-xs text-muted-foreground">{suffix}</span> : null}
      </div>
    </div>
  );
}
