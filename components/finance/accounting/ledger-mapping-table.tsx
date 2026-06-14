import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { accountingEventLabel } from "@/lib/accounting-event-labels";
import type { LedgerMapping } from "@/types/accounting";

type LedgerMappingTableProps = {
  mappings: LedgerMapping[];
  loading?: boolean;
  onEdit?: (mapping: LedgerMapping) => void;
};

export function LedgerMappingTable({ mappings, loading, onEdit }: LedgerMappingTableProps) {
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
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {mappings.map((mapping) => {
            const eventLabel = accountingEventLabel(mapping.event_type);
            return (
              <TableRow key={mapping.id}>
                <TableCell>
                  <div className="font-medium">{mapping.label || eventLabel.label}</div>
                  <div className="mt-1 font-mono text-xs text-muted-foreground">{mapping.event_type}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{mapping.description || eventLabel.meaning}</div>
                </TableCell>
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
                <TableCell>{mapping.is_active === false ? "Inactive" : "Active"}</TableCell>
                <TableCell className="text-right">
                  {onEdit ? (
                    <Button variant="outline" size="sm" onClick={() => onEdit(mapping)}>
                      Edit Mapping
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
