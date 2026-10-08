"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Gift, Loader2, RefreshCw } from "lucide-react";
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
import apiClient from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/api-error-message";
import { CustomerApis } from "@/lib/api/endpoints";

interface LoyaltySettings {
  loyalty_points_enabled: boolean;
  loyalty_points_per_amount: number;
  loyalty_amount_per_points: number;
}

const defaults: LoyaltySettings = {
  loyalty_points_enabled: true,
  loyalty_points_per_amount: 5,
  loyalty_amount_per_points: 100,
};

export function LoyaltySettingsDialog({
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
  const [loadError, setLoadError] = useState("");

  const loadSettings = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    setLoadError("");
    try {
      const response = await apiClient.get(CustomerApis.loyaltySettings(restaurantId));
      const data = response.data?.data ?? response.data;
      setSettings({
        loyalty_points_enabled: Boolean(data.loyalty_points_enabled),
        loyalty_points_per_amount: Number(data.loyalty_points_per_amount) || defaults.loyalty_points_per_amount,
        loyalty_amount_per_points: Number(data.loyalty_amount_per_points) || defaults.loyalty_amount_per_points,
      });
    } catch (error) {
      setLoadError(getApiErrorMessage(error, "Could not load loyalty settings"));
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    if (open) void loadSettings();
  }, [open, loadSettings]);

  const examplePoints = useMemo(() => {
    if (!settings.loyalty_points_enabled || settings.loyalty_amount_per_points <= 0) return 0;
    return Math.floor((1000 * settings.loyalty_points_per_amount) / settings.loyalty_amount_per_points);
  }, [settings]);

  const updateNumber = (key: "loyalty_points_per_amount" | "loyalty_amount_per_points", value: string) => {
    const number = Number(value);
    setSettings((current) => ({ ...current, [key]: Number.isFinite(number) ? number : 0 }));
  };

  const save = async () => {
    if (!restaurantId) return;
    setSaving(true);
    try {
      const response = await apiClient.put(CustomerApis.loyaltySettings(restaurantId), settings);
      const data = response.data?.data ?? response.data;
      setSettings({
        loyalty_points_enabled: Boolean(data.loyalty_points_enabled),
        loyalty_points_per_amount: Number(data.loyalty_points_per_amount),
        loyalty_amount_per_points: Number(data.loyalty_amount_per_points),
      });
      toast.success(settings.loyalty_points_enabled ? "Loyalty earning rule saved" : "Loyalty earning paused");
      onOpenChange(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not save loyalty settings"));
    } finally {
      setSaving(false);
    }
  };

  const disabled = !settings.loyalty_points_enabled;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto overscroll-contain p-0">
        <DialogHeader className="border-b border-border px-6 py-5 pr-12">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Gift className="h-5 w-5" />
            </span>
            <div>
              <DialogTitle>Loyalty points</DialogTitle>
              <DialogDescription className="mt-1">Choose how customers earn points from completed orders.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex min-h-60 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading settings…
          </div>
        ) : loadError ? (
          <div className="flex min-h-60 flex-col items-center justify-center px-6 text-center">
            <p className="text-sm font-semibold text-foreground">Loyalty settings are unavailable</p>
            <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{loadError}</p>
            <Button variant="outline" className="mt-5" onClick={() => void loadSettings()}>
              <RefreshCw className="mr-2 h-4 w-4" /> Try again
            </Button>
          </div>
        ) : (
          <div className="space-y-5 px-6 py-5">
            <div className="flex items-start justify-between gap-4 rounded-2xl border border-border px-4 py-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Give points on orders</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">When off, existing point balances stay available but new orders do not earn points.</p>
              </div>
              <Switch
                checked={settings.loyalty_points_enabled}
                onCheckedChange={(checked) => setSettings((current) => ({ ...current, loyalty_points_enabled: checked }))}
                aria-label="Give points on orders"
              />
            </div>

            <div className={disabled ? "space-y-4 opacity-50" : "space-y-4"} aria-disabled={disabled}>
              <div>
                <p className="text-sm font-semibold text-foreground">Earning rule</p>
                <p className="mt-1 text-xs text-muted-foreground">Points are rounded down to whole numbers.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <NumberField
                  id="loyalty-points"
                  label="Give"
                  suffix="points"
                  value={settings.loyalty_points_per_amount}
                  min={1}
                  max={10000}
                  disabled={disabled}
                  onChange={(value) => updateNumber("loyalty_points_per_amount", value)}
                />
                <NumberField
                  id="loyalty-amount"
                  label="For every"
                  prefix="NPR"
                  suffix="spent"
                  value={settings.loyalty_amount_per_points}
                  min={1}
                  max={1000000}
                  step={0.01}
                  disabled={disabled}
                  onChange={(value) => updateNumber("loyalty_amount_per_points", value)}
                />
              </div>
              <div className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
                A NPR 1,000 order earns <span className="font-semibold text-foreground">{examplePoints} points</span>.
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="border-t border-border px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={loading || saving || Boolean(loadError) || !restaurantId || settings.loyalty_points_per_amount < 1 || settings.loyalty_amount_per_points < 1}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  max: number;
  step?: number;
  disabled: boolean;
  onChange: (value: string) => void;
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
          value={value || ""}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
        {suffix ? <span className="pr-3 text-xs text-muted-foreground">{suffix}</span> : null}
      </div>
    </div>
  );
}
