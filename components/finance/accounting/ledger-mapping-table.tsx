import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LedgerMapping } from "@/types/accounting";

type LedgerMappingTableProps = {
  mappings: LedgerMapping[];
  loading?: boolean;
};

export function LedgerMappingTable({ mappings, loading }: LedgerMappingTableProps) {
  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading mappings...</div>;
  }

  if (mappings.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        No ledger mappings found. Seed default mappings before posting finance events.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[220px]">Event</TableHead>
            <TableHead>Payment</TableHead>
            <TableHead>Line</TableHead>
            <TableHead className="min-w-[220px]">Debit</TableHead>
            <TableHead className="min-w-[220px]">Credit</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {mappings.map((mapping) => (
            <TableRow key={mapping.id}>
              <TableCell className="font-mono text-xs">{mapping.event_type}</TableCell>
              <TableCell className="capitalize">{mapping.payment_method ?? "Any"}</TableCell>
              <TableCell className="capitalize">{mapping.business_line}</TableCell>
              <TableCell>
                {mapping.debit_account
                  ? `${mapping.debit_account.code} - ${mapping.debit_account.name}`
                  : mapping.debit_account_id}
              </TableCell>
              <TableCell>
                {mapping.credit_account
                  ? `${mapping.credit_account.code} - ${mapping.credit_account.name}`
                  : mapping.credit_account_id}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
