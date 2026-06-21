"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import apiClient from "@/lib/api-client";
import { AccountingApis } from "@/lib/api/endpoints";
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
import type {
  AccountNodeType,
  AccountType,
  ChartAccount,
  ChartAccountPayload,
  NormalBalance,
  ProfitLossSection,
} from "@/types/accounting";

type BaseResponse<T> = {
  status?: string;
  data?: T;
  message?: string;
};

export type AccountDialogIntent = {
  nodeType: AccountNodeType;
  parentId?: number | null;
};

type AccountDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: number;
  accounts: ChartAccount[];
  intent: AccountDialogIntent | null;
  onSaved: () => void;
};

type AccountForm = {
  code: string;
  name: string;
  account_type: AccountType;
  normal_balance: NormalBalance;
  parent_id: string;
  pnl_section: ProfitLossSection | "none";
  reconciliation_enabled: boolean;
  ledger_class: string;
  ledger_type: string;
  subledger_type: string;
  reference_entity_id: string;
};

const NO_PARENT = "__none__";

function accountLabel(account: ChartAccount) {
  return `${account.code} - ${account.name}`;
}

function parentOptions(accounts: ChartAccount[], nodeType: AccountNodeType) {
  if (nodeType === "subledger") {
    return accounts.filter((account) => account.is_active && account.node_type === "ledger");
  }
  return accounts.filter((account) => account.is_active && account.node_type === "group");
}

function defaultTypeForParent(parent?: ChartAccount | null): AccountType {
  return parent?.account_type ?? "asset";
}

function defaultNormalForType(accountType: AccountType): NormalBalance {
  return accountType === "asset" || accountType === "expense" || accountType === "contra_revenue"
    ? "debit"
    : "credit";
}

export function AccountDialog({
  open,
  onOpenChange,
  restaurantId,
  accounts,
  intent,
  onSaved,
}: AccountDialogProps) {
  const nodeType = intent?.nodeType ?? "ledger";
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<AccountForm>({
    code: "",
    name: "",
    account_type: "asset",
    normal_balance: "debit",
    parent_id: NO_PARENT,
    pnl_section: "none",
    reconciliation_enabled: false,
    ledger_class: "",
    ledger_type: "",
    subledger_type: "",
    reference_entity_id: "",
  });

  const parents = useMemo(() => parentOptions(accounts, nodeType), [accounts, nodeType]);
  const selectedParent = accounts.find((account) => String(account.id) === form.parent_id) ?? null;
  const title =
    nodeType === "group" ? "New Group" : nodeType === "subledger" ? "New Subledger" : "New Ledger";

  useEffect(() => {
    if (!open) return;
    const parent = accounts.find((account) => account.id === intent?.parentId) ?? null;
    const accountType = defaultTypeForParent(parent);
    setForm({
      code: "",
      name: "",
      account_type: accountType,
      normal_balance: defaultNormalForType(accountType),
      parent_id: parent ? String(parent.id) : NO_PARENT,
      pnl_section: parent?.pnl_section ?? "none",
      reconciliation_enabled: false,
      ledger_class: "",
      ledger_type: "",
      subledger_type: "",
      reference_entity_id: "",
    });
  }, [accounts, intent, open]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = form.code.trim();
    const name = form.name.trim();
    const parentId = form.parent_id === NO_PARENT ? null : Number(form.parent_id);
    if (!code || !name) {
      toast.error("Code and name are required.");
      return;
    }
    if (nodeType === "subledger" && !parentId) {
      toast.error("Subledger requires a parent ledger.");
      return;
    }

    const payload: ChartAccountPayload = {
      restaurant_id: restaurantId,
      code,
      name,
      account_type: form.account_type,
      normal_balance: form.normal_balance,
      parent_id: parentId,
      node_type: nodeType,
      pnl_section: form.pnl_section === "none" ? null : form.pnl_section,
      reconciliation_enabled: nodeType === "group" ? false : form.reconciliation_enabled,
      ledger_class: form.ledger_class.trim() || null,
      ledger_type: form.ledger_type.trim() || null,
      subledger_type: nodeType === "subledger" ? form.subledger_type.trim() || null : null,
      reference_entity_id: form.reference_entity_id.trim() ? Number(form.reference_entity_id) : null,
      is_active: true,
      is_suspense: false,
    };

    setSaving(true);
    try {
      await apiClient.post<BaseResponse<ChartAccount>>(AccountingApis.createAccount(), payload);
      toast.success(`${title} created.`);
      onSaved();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Failed to create account", error);
      toast.error(error?.response?.data?.detail || "Failed to create chart account");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[680px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {nodeType === "group"
              ? "Create a container account used for chart organization and report rollups."
              : nodeType === "subledger"
                ? "Create a subledger under a posting ledger for party or entity-level tracking."
                : "Create a posting ledger under a group account."}
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="account-code">Account code</Label>
              <Input
                id="account-code"
                value={form.code}
                onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
                placeholder={nodeType === "group" ? "1.2.9" : "121009"}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="account-name">Account name</Label>
              <Input
                id="account-name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder={nodeType === "group" ? "Other Current Assets" : "Bank Settlement"}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Parent</Label>
              <Select
                value={form.parent_id}
                onValueChange={(value) => {
                  const parent = accounts.find((account) => String(account.id) === value) ?? null;
                  const accountType = defaultTypeForParent(parent);
                  setForm((current) => ({
                    ...current,
                    parent_id: value,
                    account_type: accountType,
                    normal_balance: defaultNormalForType(accountType),
                    pnl_section: parent?.pnl_section ?? current.pnl_section,
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select parent" />
                </SelectTrigger>
                <SelectContent>
                  {nodeType !== "subledger" && <SelectItem value={NO_PARENT}>Top level</SelectItem>}
                  {parents.map((account) => (
                    <SelectItem key={account.id} value={String(account.id)}>
                      {accountLabel(account)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedParent && (
                <p className="text-xs text-muted-foreground">
                  Inherits {selectedParent.account_type.replace(/_/g, " ")} classification from parent.
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label>Account type</Label>
              <Select
                value={form.account_type}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    account_type: value as AccountType,
                    normal_balance: defaultNormalForType(value as AccountType),
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asset">Asset</SelectItem>
                  <SelectItem value="liability">Liability</SelectItem>
                  <SelectItem value="equity">Equity</SelectItem>
                  <SelectItem value="revenue">Revenue</SelectItem>
                  <SelectItem value="contra_revenue">Contra revenue</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Normal balance</Label>
              <Select
                value={form.normal_balance}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, normal_balance: value as NormalBalance }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="debit">Debit</SelectItem>
                  <SelectItem value="credit">Credit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>P&L section</Label>
              <Select
                value={form.pnl_section}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, pnl_section: value as ProfitLossSection | "none" }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="gross">Gross P&L</SelectItem>
                  <SelectItem value="net">Net P&L</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {nodeType !== "group" && (
            <div className="grid gap-4 rounded-md border border-border p-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="ledger-class">Ledger class</Label>
                <Input
                  id="ledger-class"
                  value={form.ledger_class}
                  onChange={(event) => setForm((current) => ({ ...current, ledger_class: event.target.value }))}
                  placeholder="customer, vendor, settlement"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ledger-type">Ledger type</Label>
                <Input
                  id="ledger-type"
                  value={form.ledger_type}
                  onChange={(event) => setForm((current) => ({ ...current, ledger_type: event.target.value }))}
                  placeholder="bank, cash, party"
                />
              </div>
              {nodeType === "subledger" && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="subledger-type">Subledger type</Label>
                    <Input
                      id="subledger-type"
                      value={form.subledger_type}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, subledger_type: event.target.value }))
                      }
                      placeholder="customer, supplier, employee"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="reference-entity">Reference entity ID</Label>
                    <Input
                      id="reference-entity"
                      type="number"
                      value={form.reference_entity_id}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, reference_entity_id: event.target.value }))
                      }
                      placeholder="Optional"
                    />
                  </div>
                </>
              )}
              <label className="flex items-center gap-3 text-sm">
                <Switch
                  checked={form.reconciliation_enabled}
                  onCheckedChange={(checked) =>
                    setForm((current) => ({ ...current, reconciliation_enabled: checked }))
                  }
                />
                Reconciliation enabled
              </label>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
