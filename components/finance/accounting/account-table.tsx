"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FileText, FolderTree, Network, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AccountNodeType, ChartAccount } from "@/types/accounting";

function labelize(value: string) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function nodeLabel(value: AccountNodeType | string) {
  if (value === "group") return "Group";
  if (value === "subledger") return "Subledger";
  return "Ledger";
}

function nodeIcon(value: AccountNodeType | string) {
  if (value === "group") return FolderTree;
  if (value === "subledger") return Network;
  return FileText;
}

type AccountTreeRow = {
  account: ChartAccount;
  depth: number;
  childCount: number;
};

function sortAccounts(accounts: ChartAccount[]) {
  return [...accounts].sort((a, b) =>
    String(a.code).localeCompare(String(b.code), undefined, {
      numeric: true,
      sensitivity: "base",
    })
  );
}

function flattenAccounts(accounts: ChartAccount[], expanded: Set<number>) {
  const childrenByParent = new Map<number | null, ChartAccount[]>();
  accounts.forEach((account) => {
    const key = account.parent_id ?? null;
    const existing = childrenByParent.get(key) ?? [];
    existing.push(account);
    childrenByParent.set(key, existing);
  });
  childrenByParent.forEach((children, key) => {
    childrenByParent.set(key, sortAccounts(children));
  });

  const rows: AccountTreeRow[] = [];
  const visit = (account: ChartAccount, depth: number) => {
    const children = childrenByParent.get(account.id) ?? [];
    rows.push({ account, depth, childCount: children.length });
    if (expanded.has(account.id)) {
      children.forEach((child) => visit(child, depth + 1));
    }
  };

  const roots = childrenByParent.get(null) ?? [];
  roots.forEach((account) => visit(account, 0));
  return rows;
}

type AccountTableProps = {
  accounts: ChartAccount[];
  loading?: boolean;
  search?: string;
  accountType?: string;
  onSearchChange?: (value: string) => void;
  onAccountTypeChange?: (value: string) => void;
  canManage?: boolean;
  onCreateAccount?: (nodeType: AccountNodeType, parentId?: number | null) => void;
  onOpenAccount?: (account: ChartAccount) => void;
};

export function AccountTable({
  accounts,
  loading,
  search = "",
  accountType = "all",
  onSearchChange,
  onAccountTypeChange,
  canManage = false,
  onCreateAccount,
  onOpenAccount,
}: AccountTableProps) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const groupIds = useMemo(
    () => new Set(accounts.filter((account) => account.node_type === "group").map((account) => account.id)),
    [accounts]
  );

  const rows = useMemo(() => {
    const expanded = expandedIds.size > 0 ? expandedIds : groupIds;
    const treeRows = flattenAccounts(accounts, expanded);
    return treeRows.filter(({ account }) => {
      const haystack = `${account.code} ${account.name} ${account.ledger_class ?? ""} ${account.ledger_type ?? ""}`.toLowerCase();
      const matchesSearch = !search || haystack.includes(search.toLowerCase());
      const matchesType = !accountType || accountType === "all" || account.account_type === accountType;
      return matchesSearch && matchesType;
    });
  }, [accountType, accounts, expandedIds, groupIds, search]);

  const toggleExpanded = (accountId: number) => {
    setExpandedIds((current) => {
      const next = new Set(current.size > 0 ? current : groupIds);
      if (next.has(accountId)) {
        next.delete(accountId);
      } else {
        next.add(accountId);
      }
      return next;
    });
  };

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading accounts...</div>;
  }

  if (accounts.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        No chart of accounts found. Seed default accounts to start posting journals.
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <Input
          placeholder="Search accounts"
          value={search}
          onChange={(event) => onSearchChange?.(event.target.value)}
          className="h-9 w-full sm:w-[260px]"
        />
        <Select value={accountType || "all"} onValueChange={(value) => onAccountTypeChange?.(value)}>
          <SelectTrigger className="h-9 w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="asset">Assets</SelectItem>
            <SelectItem value="liability">Liabilities</SelectItem>
            <SelectItem value="equity">Equity</SelectItem>
            <SelectItem value="revenue">Revenue</SelectItem>
            <SelectItem value="contra_revenue">Contra revenue</SelectItem>
            <SelectItem value="expense">Expenses</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!canManage}
            onClick={() => onCreateAccount?.("group", null)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Group
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!canManage}
            onClick={() => onCreateAccount?.("ledger", null)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Ledger
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[130px]">Code</TableHead>
              <TableHead className="min-w-[320px]">Name</TableHead>
              <TableHead>Node</TableHead>
              <TableHead>Account Type</TableHead>
              <TableHead>Ledger Class</TableHead>
              <TableHead>P&L</TableHead>
              <TableHead>Recon</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ account, depth, childCount }) => {
              const Icon = nodeIcon(account.node_type);
              const canHaveGroupChild = account.node_type === "group";
              const canHaveLedgerChild = account.node_type === "group";
              const canHaveSubledgerChild = account.node_type === "ledger";
              const isPostableNode = account.node_type !== "group";
              return (
                <TableRow
                  key={account.id}
                  className={account.node_type === "group" ? "bg-muted/20" : "cursor-pointer hover:bg-muted/40"}
                  onClick={() => {
                    if (isPostableNode) onOpenAccount?.(account);
                  }}
                  tabIndex={isPostableNode ? 0 : undefined}
                  onKeyDown={(event) => {
                    if (!isPostableNode) return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onOpenAccount?.(account);
                    }
                  }}
                  aria-label={isPostableNode ? `Open ledger ${account.code} ${account.name}` : undefined}
                >
                  <TableCell className="font-mono text-xs">{account.code}</TableCell>
                  <TableCell>
                    <div className="flex min-w-0 items-center gap-2" style={{ paddingLeft: depth * 20 }}>
                      {childCount > 0 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleExpanded(account.id);
                          }}
                          aria-label={expandedIds.has(account.id) || (expandedIds.size === 0 && groupIds.has(account.id)) ? "Collapse account" : "Expand account"}
                        >
                          {expandedIds.has(account.id) || (expandedIds.size === 0 && groupIds.has(account.id)) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      ) : (
                        <span className="h-6 w-6 shrink-0" />
                      )}
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <div className="truncate font-medium">{account.name}</div>
                        {account.is_suspense && (
                          <Badge variant="outline" className="mt-1">
                            Suspense account
                          </Badge>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={account.node_type === "group" ? "outline" : "secondary"}>
                      {nodeLabel(account.node_type)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{labelize(account.account_type)}</Badge>
                    <div className="mt-1 text-xs capitalize text-muted-foreground">{account.normal_balance}</div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {account.ledger_class || account.ledger_type ? (
                      <div>
                        <div>{account.ledger_class || "-"}</div>
                        <div className="text-xs">{account.ledger_type || "-"}</div>
                      </div>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    {account.pnl_section ? (
                      <Badge variant="outline">{account.pnl_section === "gross" ? "Gross P&L" : "Net P&L"}</Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {account.reconciliation_enabled ? (
                      <Badge className="bg-blue-500/10 text-blue-700 hover:bg-blue-500/10">Yes</Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {account.is_active ? (
                      <Badge className="bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/10">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {canHaveGroupChild && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!canManage}
                          onClick={(event) => {
                            event.stopPropagation();
                            onCreateAccount?.("group", account.id);
                          }}
                        >
                          Group
                        </Button>
                      )}
                      {canHaveLedgerChild && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!canManage}
                          onClick={(event) => {
                            event.stopPropagation();
                            onCreateAccount?.("ledger", account.id);
                          }}
                        >
                          Ledger
                        </Button>
                      )}
                      {canHaveSubledgerChild && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!canManage}
                          onClick={(event) => {
                            event.stopPropagation();
                            onCreateAccount?.("subledger", account.id);
                          }}
                        >
                          Subledger
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
