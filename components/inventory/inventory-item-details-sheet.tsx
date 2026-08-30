"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowDownRight,
  ArrowUpRight,
  History,
  MapPin,
  MinusCircle,
  Package,
  PlusCircle,
  Ruler,
  Scale,
  StickyNote,
  Truck,
} from "lucide-react";
import apiClient from "@/lib/api-client";
import { InventoryApis } from "@/lib/api/endpoints";
import { cn, formatCurrency } from "@/lib/utils";

interface InventoryItemDetailsSheetProps {
  item: any | null;
  value?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddStock: (item: any) => void;
  onReduceStock: (item: any) => void;
  onCountStock: (item: any) => void;
  onViewLedger: (item: any) => void;
}

function activityLabel(movement: any): string {
  const delta = Number(movement?.qty_delta) || 0;
  const sourceType = String(movement?.source_type || "").toLowerCase();
  if (sourceType.includes("purchase_return")) return "Purchase returned";
  if (sourceType.includes("purchase")) return "Purchase received";
  if (sourceType.includes("kot") || sourceType.includes("sale")) return "Used in an order";
  if (sourceType.includes("consumption")) return "Manually consumed";
  if (sourceType.includes("reversal") || sourceType.includes("voided")) return "Reversed";
  return delta >= 0 ? "Stock added" : "Stock reduced";
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

export function InventoryItemDetailsSheet({
  item,
  value,
  open,
  onOpenChange,
  onAddStock,
  onReduceStock,
  onCountStock,
  onViewLedger,
}: InventoryItemDetailsSheetProps) {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<{
    stockIn: number;
    stockOut: number;
    recent: any | null;
  } | null>(null);

  useEffect(() => {
    if (!open || !item?.id) {
      setStats(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await apiClient.get(
          InventoryApis.getLedger({ itemId: item.id, skip: 0, limit: 200 }),
        );
        if (cancelled) return;
        const movements: any[] = res.data?.data?.movements || [];
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        let stockIn = 0;
        let stockOut = 0;
        for (const movement of movements) {
          const occurredAt = new Date(movement.created_at);
          if (occurredAt < monthStart) continue;
          const delta = Number(movement.qty_delta) || 0;
          if (delta > 0) stockIn += delta;
          else stockOut += Math.abs(delta);
        }
        setStats({ stockIn, stockOut, recent: movements[0] || null });
      } catch {
        if (!cancelled) setStats({ stockIn: 0, stockOut: 0, recent: null });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [open, item?.id]);

  if (!item) return null;

  const isNegative = Number(item.current_stock) < 0;
  const heroTone = isNegative
    ? "border-rose-200 bg-rose-50 dark:border-rose-900/50 dark:bg-rose-950/20"
    : item.is_low_stock
      ? "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20"
      : "border-border bg-card";
  const heroNumberTone = isNegative
    ? "text-rose-600"
    : item.is_low_stock
      ? "text-amber-600"
      : "text-foreground";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-y-auto p-0 sm:max-w-[440px]">
        <DialogHeader className="space-y-3 border-b px-5 py-5">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                isNegative
                  ? "bg-rose-100 text-rose-600 dark:bg-rose-900/30"
                  : item.is_low_stock
                    ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30"
                    : "bg-primary/10 text-primary",
              )}
            >
              <Package className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <DialogTitle className="truncate text-lg leading-tight">{item.name}</DialogTitle>
                {item.is_low_stock && (
                  <Badge className="border-amber-200 bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                    LOW
                  </Badge>
                )}
                {!item.is_active && <Badge variant="secondary">INACTIVE</Badge>}
              </div>
              <p className="text-sm capitalize text-muted-foreground">
                {item.station || "General"} · {item.unit}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Button
              size="sm"
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() => onAddStock(item)}
            >
              <PlusCircle className="mr-1.5 h-4 w-4" /> Add
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-rose-300 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-900 dark:hover:bg-rose-950/30"
              onClick={() => onReduceStock(item)}
            >
              <MinusCircle className="mr-1.5 h-4 w-4" /> Reduce
            </Button>
            <Button size="sm" variant="outline" onClick={() => onCountStock(item)}>
              <Scale className="mr-1.5 h-4 w-4" /> Count
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-5 px-5 py-5">
          <div className={cn("rounded-xl border p-4", heroTone)}>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Current Stock</p>
                <p className={cn("text-3xl font-bold tabular-nums leading-none", heroNumberTone)}>
                  {item.current_stock}
                  <span className="ml-1 text-base font-medium text-muted-foreground">{item.unit}</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium text-muted-foreground">Book value</p>
                <p className="text-lg font-semibold tabular-nums">{formatCurrency(value ?? 0)}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <ArrowDownRight className="h-3.5 w-3.5" />
                <p className="text-[11px] font-semibold uppercase tracking-wide">Stock In</p>
              </div>
              <p className="mt-1 text-lg font-bold tabular-nums">
                {loading ? "…" : stats?.stockIn ?? 0}
                <span className="ml-1 text-xs font-normal text-muted-foreground">{item.unit}</span>
              </p>
              <p className="text-[11px] text-muted-foreground">This month</p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                <ArrowUpRight className="h-3.5 w-3.5" />
                <p className="text-[11px] font-semibold uppercase tracking-wide">Stock Out</p>
              </div>
              <p className="mt-1 text-lg font-bold tabular-nums">
                {loading ? "…" : stats?.stockOut ?? 0}
                <span className="ml-1 text-xs font-normal text-muted-foreground">{item.unit}</span>
              </p>
              <p className="text-[11px] text-muted-foreground">This month</p>
            </div>
          </div>

          {stats?.recent && (
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{activityLabel(stats.recent)}</p>
                {stats.recent.reason && (
                  <p className="truncate text-xs text-muted-foreground">{stats.recent.reason}</p>
                )}
              </div>
              <span className="shrink-0 pl-2 text-xs text-muted-foreground">
                {new Date(stats.recent.created_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-x-3 gap-y-4 rounded-lg border p-4">
            {item.accounting_profile?.treatment === "inventory_asset" ||
            Number(item.book_quantity || 0) !== 0 ||
            Number(item.book_unit_cost || 0) !== 0 ? (
              <DetailRow icon={Ruler} label="Inventory unit cost" value={formatCurrency(item.book_unit_cost ?? 0)} />
            ) : (
              <DetailRow
                icon={Ruler}
                label="Reference cost estimate"
                value={formatCurrency(item.operational_unit_cost ?? item.cost_per_unit ?? 0)}
              />
            )}
            <DetailRow
              icon={Package}
              label="Min stock level"
              value={`${item.min_stock_level ?? 0} ${item.unit}`}
            />
            <DetailRow icon={Truck} label="Supplier" value={item.supplier?.name || "Not set"} />
            <DetailRow icon={MapPin} label="Storage location" value={item.storage_location || "Not set"} />
            {item.description && (
              <div className="col-span-2">
                <DetailRow icon={StickyNote} label="Description" value={item.description} />
              </div>
            )}
          </div>

          <Button variant="outline" className="w-full" onClick={() => onViewLedger(item)}>
            <History className="mr-2 h-4 w-4" /> View Full Ledger
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
