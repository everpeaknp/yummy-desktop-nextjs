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
import type { ChartAccount } from "@/types/accounting";

function labelize(value: string) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

type AccountTableProps = {
  accounts: ChartAccount[];
  loading?: boolean;
  search?: string;
  accountType?: string;
  onSearchChange?: (value: string) => void;
  onAccountTypeChange?: (value: string) => void;
};

export function AccountTable({
  accounts,
  loading,
  search = "",
  accountType = "all",
  onSearchChange,
  onAccountTypeChange,
}: AccountTableProps) {
  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading accounts...</div>;
  }

  const filteredAccounts = accounts.filter((account) => {
    const haystack = `${account.code} ${account.name}`.toLowerCase();
    const matchesSearch = !search || haystack.includes(search.toLowerCase());
    const matchesType = !accountType || accountType === "all" || account.account_type === accountType;
    return matchesSearch && matchesType;
  });

  if (accounts.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        No chart of accounts found. Seed default accounts to start posting journals.
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 border-b border-border p-3">
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
      </div>
      <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[110px]">Code</TableHead>
            <TableHead className="min-w-[240px]">Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Normal</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Usage</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredAccounts.map((account) => (
            <TableRow key={account.id}>
              <TableCell className="font-mono text-xs">{account.code}</TableCell>
              <TableCell>
                <div className="font-medium">{account.name}</div>
                {account.is_suspense && (
                  <Badge variant="outline" className="mt-1">
                    Suspense account
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{labelize(account.account_type)}</Badge>
              </TableCell>
              <TableCell className="capitalize">{account.normal_balance}</TableCell>
              <TableCell>
                {account.is_active ? (
                  <Badge className="bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/10">
                    Active
                  </Badge>
                ) : (
                  <Badge variant="secondary">Inactive</Badge>
                )}
              </TableCell>
              <TableCell>
                <span className="text-xs text-muted-foreground">Used in mappings</span>
              </TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="sm" disabled>
                  Deactivate
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
    </div>
  );
}
