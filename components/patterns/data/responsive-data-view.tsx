import * as React from "react";

import { cn } from "@/lib/utils";

export interface ResponsiveColumn<T> {
  key: string;
  header: React.ReactNode;
  cell: (item: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
}

export interface ResponsiveDataViewProps<T> {
  data: T[];
  columns: ResponsiveColumn<T>[];
  getKey: (item: T) => React.Key;
  renderMobileItem: (item: T) => React.ReactNode;
  emptyState?: React.ReactNode;
  className?: string;
  mobileClassName?: string;
  tableMinWidth?: string;
  onItemClick?: (item: T) => void;
  getItemLabel?: (item: T) => string;
  embedded?: boolean;
}

export function ResponsiveDataView<T>({
  data,
  columns,
  getKey,
  renderMobileItem,
  emptyState,
  className,
  mobileClassName,
  tableMinWidth = "720px",
  onItemClick,
  getItemLabel,
  embedded = false,
}: ResponsiveDataViewProps<T>) {
  if (data.length === 0) return <>{emptyState ?? null}</>;

  return (
    <div className={cn("min-w-0", className)}>
      <div className={cn("space-y-2 md:hidden", mobileClassName)}>
        {data.map((item) => <React.Fragment key={getKey(item)}>{renderMobileItem(item)}</React.Fragment>)}
      </div>
      <div
        className={cn(
          "hidden max-w-full overflow-x-auto bg-card md:block",
          !embedded && "rounded-2xl border border-border"
        )}
      >
        <table className="w-full border-collapse text-sm" style={{ minWidth: tableMinWidth }}>
          <thead className="bg-muted/70 text-left text-xs font-medium text-muted-foreground">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className={cn("whitespace-nowrap px-4 py-3", column.headerClassName)}>{column.header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.map((item) => (
              <tr
                key={getKey(item)}
                tabIndex={onItemClick ? 0 : undefined}
                role={onItemClick ? "button" : undefined}
                aria-label={onItemClick ? getItemLabel?.(item) : undefined}
                onClick={onItemClick ? () => onItemClick(item) : undefined}
                onKeyDown={
                  onItemClick
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onItemClick(item);
                        }
                      }
                    : undefined
                }
                className={cn(
                  "transition-colors hover:bg-muted/40",
                  onItemClick && "cursor-pointer focus-visible:bg-muted/50 focus-visible:outline-none"
                )}
              >
                {columns.map((column) => (
                  <td key={column.key} className={cn("px-4 py-3 align-middle", column.className)}>{column.cell(item)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
