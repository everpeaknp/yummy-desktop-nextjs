"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import apiClient from "@/lib/api-client";
import { AccountingApis } from "@/lib/api/endpoints";
import { ACCOUNTING_EVENT_OPTIONS, accountingEventLabel } from "@/lib/accounting-event-labels";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { ChartAccount, LedgerMapping, LedgerMappingPayload } from "@/types/accounting";

type BaseResponse<T> = {
  status?: string;
  data?: T;
  message?: string;
};

type LedgerMappingDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: number;
  accounts: ChartAccount[];
  mapping?: LedgerMapping | null;
  onSaved: () => void;
};

type MappingForm = {
  event_type: string;
  payment_method: string;
  business_line: string;
  debit_account_id: string;
  credit_account_id: string;
  label: string;
  description: string;
  is_active: boolean;
  reason: string;
};

const ANY_PAYMENT_METHOD = "__any__";

const PAYMENT_METHOD_OPTIONS = [
  { value: ANY_PAYMENT_METHOD, label: "Any method", description: "Generic fallback mapping" },
  { value: "cash", label: "Cash", description: "Cash drawer or cash account" },
  { value: "card", label: "Card", description: "Card clearing account" },
  { value: "digital", label: "Digital / QR", description: "Digital wallet clearing account" },
  { value: "fonepay", label: "Fonepay", description: "Fonepay clearing account" },
];

const EVENTS_REQUIRING_EXACT_PAYMENT_METHOD = new Set([
  "collection_received",
  "refund_processed",
  "manual_income_received",
]);

function accountLabel(account: ChartAccount) {
  return `${account.code} - ${account.name}`;
}

function normalizeEventType(value?: string | null) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizePaymentMethod(value?: string | null) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized || ANY_PAYMENT_METHOD;
}

function paymentMethodPayload(value: string) {
  const normalized = normalizePaymentMethod(value);
  return normalized === ANY_PAYMENT_METHOD ? null : normalized;
}

export function LedgerMappingDialog({
  open,
  onOpenChange,
  restaurantId,
  accounts,
  mapping,
  onSaved,
}: LedgerMappingDialogProps) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<MappingForm>({
    event_type: "",
    payment_method: "",
    business_line: "restaurant",
    debit_account_id: "",
    credit_account_id: "",
    label: "",
    description: "",
    is_active: true,
    reason: "",
  });

  const activeAccounts = useMemo(
    () => accounts.filter((account) => account.is_active && account.node_type !== "group"),
    [accounts]
  );
  const normalizedEventType = normalizeEventType(form.event_type || mapping?.event_type || "");
  const paymentMethodValue = normalizePaymentMethod(form.payment_method);
  const eventHelp = accountingEventLabel(normalizedEventType);
  const unknownEventSelected =
    Boolean(normalizedEventType) && !ACCOUNTING_EVENT_OPTIONS.some((option) => option.value === normalizedEventType);
  const unknownPaymentSelected =
    paymentMethodValue !== ANY_PAYMENT_METHOD &&
    !PAYMENT_METHOD_OPTIONS.some((option) => option.value === paymentMethodValue);
  const genericPaymentMethodBlocked =
    Boolean(normalizedEventType) &&
    EVENTS_REQUIRING_EXACT_PAYMENT_METHOD.has(normalizedEventType) &&
    paymentMethodValue === ANY_PAYMENT_METHOD;
  const genericPaymentMethodWarning =
    Boolean(normalizedEventType) &&
    Boolean(eventHelp.paymentMethodSensitive) &&
    paymentMethodValue === ANY_PAYMENT_METHOD &&
    !genericPaymentMethodBlocked;

  useEffect(() => {
    if (!open) return;
    setForm({
      event_type: normalizeEventType(mapping?.event_type),
      payment_method: normalizePaymentMethod(mapping?.payment_method),
      business_line: mapping?.business_line ?? "restaurant",
      debit_account_id: mapping?.debit_account_id ? String(mapping.debit_account_id) : "",
      credit_account_id: mapping?.credit_account_id ? String(mapping.credit_account_id) : "",
      label: mapping?.label ?? "",
      description: mapping?.description ?? "",
      is_active: mapping?.is_active ?? true,
      reason: "",
    });
  }, [mapping, open]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const eventType = normalizeEventType(form.event_type);
    const paymentMethod = paymentMethodPayload(form.payment_method);
    if (!eventType) {
      toast.error("Event type is required.");
      return;
    }
    if (EVENTS_REQUIRING_EXACT_PAYMENT_METHOD.has(eventType) && !paymentMethod) {
      toast.error("Select a specific payment method for this event.");
      return;
    }
    if (!form.debit_account_id || !form.credit_account_id) {
      toast.error("Debit and credit accounts are required.");
      return;
    }

    const payload: LedgerMappingPayload = {
      restaurant_id: restaurantId,
      event_type: eventType,
      payment_method: paymentMethod,
      business_line: form.business_line.trim() || "restaurant",
      debit_account_id: Number(form.debit_account_id),
      credit_account_id: Number(form.credit_account_id),
      label: form.label.trim() || null,
      description: form.description.trim() || null,
      is_active: form.is_active,
      reason: form.reason.trim() || "Accountant mapping update",
    };

    setSaving(true);
    try {
      if (mapping?.id) {
        await apiClient.patch<BaseResponse<LedgerMapping>>(
          AccountingApis.updateMapping(mapping.id, restaurantId),
          payload
        );
      } else {
        await apiClient.post<BaseResponse<LedgerMapping>>(AccountingApis.createMapping(), payload);
      }
      toast.success(mapping?.id ? "Ledger mapping updated." : "Ledger mapping created.");
      onSaved();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save ledger mapping", error);
      toast.error("Failed to save ledger mapping");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>{mapping?.id ? "Edit Mapping" : "Create Mapping"}</DialogTitle>
          <DialogDescription>
            Map finance events to debit and credit accounts used by journal posting.
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={submit}>
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
            Mapping changes apply to future postings only. Existing posted journals require a correction voucher or
            reversal/repost.
          </div>

          <div className="rounded-md border border-border p-3 text-sm">
            <div className="font-semibold">{eventHelp.label}</div>
            <div className="mt-1 text-muted-foreground">{eventHelp.meaning}</div>
            <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
              <span>Debit hint: {eventHelp.defaultDebitHint}</span>
              <span>Credit hint: {eventHelp.defaultCreditHint}</span>
            </div>
            {normalizedEventType ? (
              <div className="mt-2 text-xs text-muted-foreground">
                Event key: <code>{normalizedEventType}</code>
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="mapping-event-type">Event type</Label>
              <Select
                value={form.event_type}
                onValueChange={(value) => setForm((current) => ({ ...current, event_type: value }))}
              >
                <SelectTrigger id="mapping-event-type">
                  <SelectValue placeholder="Select finance event" />
                </SelectTrigger>
                <SelectContent>
                  {unknownEventSelected ? (
                    <SelectItem value={normalizedEventType}>
                      <span className="font-medium">{normalizedEventType.replace(/_/g, " ")}</span>
                    </SelectItem>
                  ) : null}
                  {ACCOUNTING_EVENT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="grid gap-0.5">
                        <span className="font-medium">{option.label}</span>
                        <span className="text-xs text-muted-foreground">{option.value}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="mapping-payment-method">Payment method</Label>
              <Select
                value={paymentMethodValue}
                onValueChange={(value) => setForm((current) => ({ ...current, payment_method: value }))}
              >
                <SelectTrigger id="mapping-payment-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {unknownPaymentSelected ? (
                    <SelectItem value={paymentMethodValue}>
                      <span className="capitalize">{paymentMethodValue}</span>
                    </SelectItem>
                  ) : null}
                  {PAYMENT_METHOD_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="grid gap-0.5">
                        <span className="font-medium">{option.label}</span>
                        <span className="text-xs text-muted-foreground">{option.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="mapping-business-line">Business line</Label>
              <Select
                value={form.business_line || "restaurant"}
                onValueChange={(value) => setForm((current) => ({ ...current, business_line: value }))}
              >
                <SelectTrigger id="mapping-business-line">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="restaurant">Restaurant</SelectItem>
                  <SelectItem value="hotel">Hotel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <div>
                <Label htmlFor="mapping-active">Active</Label>
                <div className="text-xs text-muted-foreground">Inactive mappings are retained for audit.</div>
              </div>
              <Switch
                id="mapping-active"
                checked={form.is_active}
                onCheckedChange={(checked) => setForm((current) => ({ ...current, is_active: checked }))}
              />
            </div>
          </div>

          {genericPaymentMethodBlocked ? (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-800 dark:text-red-300">
              This event must be mapped by exact payment method. Choose Cash, Card, Digital / QR, or Fonepay so
              collections and refunds post to the correct cash or clearing account.
            </div>
          ) : null}

          {genericPaymentMethodWarning ? (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
              This event changes cash or clearing balances. An exact payment-method mapping is safer; Any method uses
              the generic fallback mapping.
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Debit account</Label>
              <Select
                value={form.debit_account_id}
                onValueChange={(value) => setForm((current) => ({ ...current, debit_account_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select debit account" />
                </SelectTrigger>
                <SelectContent>
                  {activeAccounts.map((account) => (
                    <SelectItem key={account.id} value={String(account.id)}>
                      {accountLabel(account)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Credit account</Label>
              <Select
                value={form.credit_account_id}
                onValueChange={(value) => setForm((current) => ({ ...current, credit_account_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select credit account" />
                </SelectTrigger>
                <SelectContent>
                  {activeAccounts.map((account) => (
                    <SelectItem key={account.id} value={String(account.id)}>
                      {accountLabel(account)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="mapping-label">Label</Label>
              <Input
                id="mapping-label"
                value={form.label}
                onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
                placeholder={eventHelp.label}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="mapping-description">Description</Label>
              <Textarea
                id="mapping-description"
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder={eventHelp.meaning}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="mapping-reason">Reason</Label>
              <Textarea
                id="mapping-reason"
                value={form.reason}
                onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}
                placeholder="Explain why this mapping is being changed"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {mapping?.id ? "Save Mapping" : "Create Mapping"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
