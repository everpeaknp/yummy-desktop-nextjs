import { formatCurrency } from "@/lib/utils";

export interface DiscountRecord {
  id: number;
  name: string;
  code?: string | null;
  type: "percentage" | "fixed";
  value: number;
  description?: string | null;
  min_order_amount?: number | null;
  max_discount_amount?: number | null;
  applicable_items?: number[] | null;
  applicable_categories?: number[] | null;
  valid_from?: string | null;
  valid_until?: string | null;
  usage_limit?: number | null;
  usage_count?: number | null;
  is_active?: boolean;
}

export function discountTypeLabel(type: DiscountRecord["type"]) {
  return type === "percentage" ? "Percentage" : "Fixed amount";
}

export function formatDiscountPercentage(value: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);

  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 4,
  }).format(numeric);
}

export function discountValueLabel(
  discount: Pick<DiscountRecord, "type" | "value">,
  currency?: string | null,
) {
  return discount.type === "percentage"
    ? `${formatDiscountPercentage(discount.value)}% off`
    : `${formatCurrency(discount.value, currency)} off`;
}

export function discountApplicabilityLabel(
  discount: Pick<DiscountRecord, "applicable_items" | "applicable_categories">,
) {
  const itemCount = discount.applicable_items?.length || 0;
  const categoryCount = discount.applicable_categories?.length || 0;
  if (!itemCount && !categoryCount) return "All menu items";

  const parts = [] as string[];
  if (itemCount) parts.push(`${itemCount} item${itemCount === 1 ? "" : "s"}`);
  if (categoryCount) {
    parts.push(`${categoryCount} categor${categoryCount === 1 ? "y" : "ies"}`);
  }
  return parts.join(" · ");
}
