import type { BalanceSheetResponse, FinancialStatementLine } from "@/types/accounting";
import { Button } from "@/components/ui/button";

function formatMoney(value: number) {
  return `Rs. ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function StatementSection({
  title,
  rows,
  total,
  onOpenDrilldown,
}: {
  title: string;
  rows: FinancialStatementLine[];
  total: number;
  onOpenDrilldown?: (accountId: number, title: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      {rows.length === 0 ? (
        <div className="border-y border-border px-3 py-3 text-sm text-muted-foreground">No rows</div>
      ) : (
        <div className="divide-y divide-border border-y border-border">
          {rows.map((row, index) => (
            <div key={`${row.account_code}-${index}`} className="flex items-center justify-between px-3 py-2 text-sm">
              <span>{row.account_code ? `${row.account_code} - ${row.account_name}` : row.account_name}</span>
              <span className="flex items-center gap-3">
                <span className="font-mono">{formatMoney(row.amount)}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onOpenDrilldown?.(row.account_id, row.account_code ? `${row.account_code} - ${row.account_name}` : row.account_name)}
                >
                  Trace
                </Button>
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between px-3 text-sm font-semibold">
        <span>Total {title}</span>
        <span className="font-mono">{formatMoney(total)}</span>
      </div>
    </div>
  );
}

type BalanceSheetStatementProps = {
  data: BalanceSheetResponse | null;
  onOpenDrilldown?: (accountId: number, title: string) => void;
};

export function BalanceSheetStatement({ data, onOpenDrilldown }: BalanceSheetStatementProps) {
  if (!data) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        No balance sheet rows found for this date range.
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div className="grid gap-6 lg:grid-cols-3">
        <StatementSection title="Assets" rows={data.assets} total={data.total_assets} onOpenDrilldown={onOpenDrilldown} />
        <StatementSection title="Liabilities" rows={data.liabilities} total={data.total_liabilities} onOpenDrilldown={onOpenDrilldown} />
        <StatementSection title="Equity" rows={data.equity} total={data.total_equity} onOpenDrilldown={onOpenDrilldown} />
      </div>
      <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
        <div className="flex justify-between text-sm">
          <span className="font-medium">Current Earnings</span>
          <span className="font-mono font-semibold">{formatMoney(data.current_earnings)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="font-medium">Liabilities + Equity</span>
          <span className="font-mono font-semibold">{formatMoney(data.total_liabilities_and_equity)}</span>
        </div>
      </div>
    </div>
  );
}
