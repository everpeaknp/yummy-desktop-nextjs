import { Badge } from "@/components/ui/badge";
import { humanizeHotelStatus } from "@/lib/hotel/display-labels";
import { cn } from "@/lib/utils";

export { humanizeHotelStatus, roomServiceStatusLabel } from "@/lib/hotel/display-labels";

export function HotelStatusBadge({ value, label }: { value: string; label?: string }) {
  const variant =
    value === "completed" || value === "inspected" || value === "clean" || value === "confirmed"
      ? "success"
      : value === "canceled" || value === "no_show" || value === "out_of_order"
        ? "destructive"
        : value === "pending" || value === "dirty" || value === "due_out"
          ? "warning"
          : value === "in_house" || value === "checked_in" || value === "in_progress"
            ? "info"
            : "outline";
  return <Badge variant={variant}>{label ?? humanizeHotelStatus(value)}</Badge>;
}

export function HotelEmptyState({
  title,
  description,
  className,
}: {
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-dashed p-8 text-center", className)}>
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export function hotelCurrency(value: string | number, currency = "NPR"): string {
  const amount = Number(value);
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
  return `${currency} ${formatted}`;
}
