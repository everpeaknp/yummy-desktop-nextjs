import type { FinancialStatementLine, ProfitLossResponse } from "@/types/accounting";
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
  onOpenDrilldown,
}: {
  title: string;
  rows: FinancialStatementLine[];
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
    </div>
  );
}

type ProfitLossStatementProps = {
  data: ProfitLossResponse | null;
  onOpenDrilldown?: (accountId: number, title: string) => void;
};

export function ProfitLossStatement({ data, onOpenDrilldown }: ProfitLossStatementProps) {
  if (!data) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        No profit and loss rows found for this date range.
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      <StatementSection title="Revenue" rows={data.revenue} onOpenDrilldown={onOpenDrilldown} />
      <StatementSection title="Sales Returns" rows={data.contra_revenue} onOpenDrilldown={onOpenDrilldown} />
      <StatementSection title="Expenses" rows={data.expenses} onOpenDrilldown={onOpenDrilldown} />
      <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex justify-between text-sm">
          <span className="font-medium">Revenue</span>
          <span className="font-mono font-semibold">{formatMoney(data.total_revenue)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="font-medium">Expenses</span>
          <span className="font-mono font-semibold">{formatMoney(data.total_expenses)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="font-medium">Gross Profit</span>
          <span className="font-mono font-semibold">{formatMoney(data.gross_profit)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="font-medium">Net Profit</span>
          <span className="font-mono font-semibold">{formatMoney(data.net_profit)}</span>
        </div>
      </div>
    </div>
  );
}
