"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import apiClient from "@/lib/api-client";
import { CashAndBanksApis } from "@/lib/api/endpoints";

export interface CashBankAccountOption {
  account_type: "drawer" | "bank";
  id: number;
  name: string;
  bank_type: string;
  current_balance: number | string;
  status?: string | null;
  drawer_session_id?: number | null;
}

function accountLabel(account: CashBankAccountOption): string {
  const balance = `Rs. ${Number(account.current_balance || 0).toLocaleString()}`;
  if (account.account_type === "drawer") {
    return `${account.name} · ${balance}`;
  }
  switch (account.bank_type) {
    case "custom": return `${account.name} · ${balance}`;
    case "owner_equity": return `${account.name} · ${balance}`;
    default: return `${account.name} · ${balance}`;
  }
}

function groupLabel(account: CashBankAccountOption): string {
  if (account.account_type === "drawer") return "Cash Drawers";
  if (account.bank_type === "custom") return "Safe & Cash Accounts";
  if (account.bank_type === "owner_equity") return "Owner Accounts";
  return "Bank Accounts";
}

export function CashBankAccountSelect({
  value,
  onChange,
  businessLine = "restaurant",
  disabled = false,
  label = "Account",
  accountFilter,
}: {
  value: CashBankAccountOption | null;
  onChange: (account: CashBankAccountOption | null) => void;
  businessLine?: string;
  disabled?: boolean;
  label?: string;
  accountFilter?: (account: CashBankAccountOption) => boolean;
}) {
  const restaurantId = useAuth((state) => state.user?.restaurant_id);
  const [accounts, setAccounts] = useState<CashBankAccountOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!restaurantId) return;
      setLoading(true);
      onChange(null);
      try {
        const response = await apiClient.get(
          CashAndBanksApis.list(Number(restaurantId), businessLine),
        );
        if (cancelled) return;
        const rows = Array.isArray(response.data?.data)
          ? (response.data.data as CashBankAccountOption[])
          : [];
        // Show all bank accounts + drawers that are currently open (status="open").
        // Closed drawers are excluded because you cannot pay from retained float
        // without an open session to debit the movement against.
        const available = rows.filter(
          (account) =>
            (account.account_type === "bank" || account.status === "open") &&
            (!accountFilter || accountFilter(account)),
        );
        setAccounts(available);
        onChange(available[0] || null);
      } catch (error: any) {
        if (cancelled) return;
        setAccounts([]);
        onChange(null);
        toast.error(
          error.response?.data?.detail || "Could not load Cash & Banks accounts.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [businessLine, restaurantId]);

  // Group accounts by type for display
  const groups: Record<string, CashBankAccountOption[]> = {};
  for (const account of accounts) {
    const group = groupLabel(account);
    (groups[group] ??= []).push(account);
  }
  const groupOrder = ["Cash Drawers", "Safe & Cash Accounts", "Bank Accounts", "Owner Accounts"];

  const selectedKey = value ? `${value.account_type}:${value.id}` : "";

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select
        value={selectedKey}
        disabled={disabled || loading || accounts.length === 0}
        onValueChange={(key) =>
          onChange(
            accounts.find(
              (account) => `${account.account_type}:${account.id}` === key,
            ) || null,
          )
        }
      >
        <SelectTrigger>
          <SelectValue placeholder={loading ? "Loading accounts..." : "Select account"} />
        </SelectTrigger>
        <SelectContent>
          {groupOrder
            .filter((g) => groups[g]?.length)
            .map((group) => (
              <SelectGroup key={group}>
                <SelectLabel>{group}</SelectLabel>
                {groups[group].map((account) => (
                  <SelectItem
                    key={`${account.account_type}:${account.id}`}
                    value={`${account.account_type}:${account.id}`}
                  >
                    {accountLabel(account)}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
        </SelectContent>
      </Select>
      {!loading && accounts.length === 0 ? (
        <p className="text-xs text-destructive">
          No accounts available. Add a safe, bank, or owner account under Cash &amp; Banks, or open a cash drawer.
        </p>
      ) : null}
    </div>
  );
}
