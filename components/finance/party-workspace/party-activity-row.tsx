import type { ComponentType } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CircleDot,
  CreditCard,
  ReceiptText,
  RotateCcw,
  ShoppingCart,
} from "lucide-react";

import { cn } from "@/lib/utils";

export type PartyActivityKind =
  "bill" | "credit" | "opening" | "payment" | "purchase" | "return";

const activityIcons: Record<
  PartyActivityKind,
  ComponentType<{ className?: string }>
> = {
  bill: ReceiptText,
  credit: ArrowDownLeft,
  opening: CircleDot,
  payment: CreditCard,
  purchase: ShoppingCart,
  return: RotateCcw,
};

export function PartyActivityRow({
  amount,
  amountTone = "default",
  kind,
  metadata,
  onClick,
  status,
  title,
}: {
  amount: string;
  amountTone?: "default" | "positive" | "warning";
  kind: PartyActivityKind;
  metadata: string;
  onClick: () => void;
  status: string;
  title: string;
}) {
  const Icon = activityIcons[kind];

  return (
    <button
      type="button"
      onClick={onClick}
      className="grid min-h-[72px] w-full grid-cols-[1.25rem_minmax(0,1fr)_minmax(5.75rem,7.25rem)] items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:grid-cols-[1.25rem_minmax(0,1fr)_8.5rem] sm:px-4"
    >
      <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0">
        <p className="line-clamp-2 text-sm font-medium leading-5">{title}</p>
        <p className="mt-0.5 truncate text-xs leading-4 text-muted-foreground">
          {metadata}
        </p>
      </div>
      <div className="min-w-0 text-right">
        <p
          className={cn(
            "truncate text-sm font-semibold tabular-nums",
            amountTone === "positive" && "text-emerald-600",
            amountTone === "warning" && "text-orange-600",
          )}
        >
          {amount}
        </p>
        <p className="mt-0.5 truncate text-xs leading-4 text-muted-foreground">
          {status}
        </p>
      </div>
    </button>
  );
}
