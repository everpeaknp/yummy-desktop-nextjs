"use client";

import { format } from "date-fns";
import { ChevronRight, FileText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  TYPE_META,
  type StaffOption,
  type TransactionItem,
  staffLabel,
} from "@/lib/transactions";

type TransactionCardProps = {
  item: TransactionItem;
  staff: StaffOption[];
  paymentAddedByLabel?: string | null;
  amountDisplay: React.ReactNode;
  onClick: () => void;
};

export function TransactionCard({
  item,
  staff,
  paymentAddedByLabel,
  amountDisplay,
  onClick,
}: TransactionCardProps) {
  const meta = TYPE_META[item.type];
  const createdBy = staffLabel(staff, item.user_id, item.user_name);
  const paymentBy =
    item.payment_user_name?.trim() ||
    paymentAddedByLabel ||
    (item.payment_user_id != null
      ? staffLabel(staff, item.payment_user_id, null)
      : null);

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-2xl border border-border/60 bg-card hover:bg-muted/30 transition-colors p-4 flex gap-4 items-start group"
    >
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            className={`border-none font-bold uppercase text-[10px] ${meta?.badge ?? "bg-muted text-muted-foreground"}`}
          >
            {meta?.label ?? item.type}
          </Badge>
          <span className="text-[11px] font-semibold text-muted-foreground">
            {item.created_at
              ? format(new Date(item.created_at), "MMM dd, yyyy · HH:mm")
              : "—"}
          </span>
        </div>

        <p className="text-base font-bold text-foreground truncate">
          {item.title || "—"}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
          <p className="text-muted-foreground">
            <span className="font-bold uppercase tracking-wide text-[10px] mr-1">
              Created by
            </span>
            <span className="text-foreground font-semibold">{createdBy}</span>
          </p>
          {item.type === "order" && paymentBy ? (
            <p className="text-muted-foreground">
              <span className="font-bold uppercase tracking-wide text-[10px] mr-1">
                Payment added by
              </span>
              <span className="text-foreground font-semibold">{paymentBy}</span>
            </p>
          ) : null}
        </div>
      </div>

      <div className="shrink-0 flex flex-col items-end gap-2">
        <div className="text-right font-black text-lg tabular-nums">{amountDisplay}</div>
        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground group-hover:text-orange-600">
          {item.type === "order" ? "View order" : "Details"}
          {item.type === "order" ? (
            <ChevronRight className="w-3.5 h-3.5" />
          ) : (
            <FileText className="w-3.5 h-3.5" />
          )}
        </span>
      </div>
    </button>
  );
}
