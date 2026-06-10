import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TrialBalanceResponse } from "@/types/accounting";

function formatMoney(value: number) {
  return `Rs. ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function labelize(value: string) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

type TrialBalanceTableProps = {
  data: TrialBalanceResponse | null;
  loading?: boolean;
  onOpenDrilldown?: (accountId: number, title: string) => void;
};

export function TrialBalanceTable({ data, loading, onOpenDrilldown }: TrialBalanceTableProps) {
  const rows = data?.rows ?? [];

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading trial balance...</div>;
  }

  if (rows.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        No posted journal lines found for this date range.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[110px]">Code</TableHead>
            <TableHead className="min-w-[240px]">Account</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Debit</TableHead>
            <TableHead className="text-right">Credit</TableHead>
            <TableHead className="text-right">Balance</TableHead>
            <TableHead className="text-right">Trace</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.account_id}>
              <TableCell className="font-mono text-xs">{row.account_code}</TableCell>
              <TableCell className="font-medium">{row.account_name}</TableCell>
              <TableCell>
                <Badge variant="secondary">{labelize(String(row.account_type))}</Badge>
              </TableCell>
              <TableCell className="text-right font-mono">{formatMoney(row.debit)}</TableCell>
              <TableCell className="text-right font-mono">{formatMoney(row.credit)}</TableCell>
              <TableCell className="text-right font-mono font-semibold">
                {formatMoney(row.balance)}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onOpenDrilldown?.(row.account_id, `${row.account_code} - ${row.account_name}`)}
                >
                  Trace
                </Button>
              </TableCell>
            </TableRow>
          ))}
          <TableRow className="bg-muted/40 font-semibold">
            <TableCell colSpan={3}>Totals</TableCell>
            <TableCell className="text-right font-mono">{formatMoney(data?.total_debit ?? 0)}</TableCell>
            <TableCell className="text-right font-mono">{formatMoney(data?.total_credit ?? 0)}</TableCell>
            <TableCell className="text-right font-mono">
              {formatMoney((data?.total_debit ?? 0) - (data?.total_credit ?? 0))}
            </TableCell>
            <TableCell />
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
