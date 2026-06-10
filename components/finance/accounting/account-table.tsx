import { Badge } from "@/components/ui/badge";
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
};

export function AccountTable({ accounts, loading }: AccountTableProps) {
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
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[110px]">Code</TableHead>
            <TableHead className="min-w-[240px]">Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Normal</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {accounts.map((account) => (
            <TableRow key={account.id}>
              <TableCell className="font-mono text-xs">{account.code}</TableCell>
              <TableCell className="font-medium">{account.name}</TableCell>
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
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
