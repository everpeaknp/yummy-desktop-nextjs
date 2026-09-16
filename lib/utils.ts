import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  configuredProductCurrency,
  formatMoney,
  formatProductDate,
} from "@/lib/presentation-format";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export function getImageUrl(path?: string) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (path.startsWith("asset:")) {
    // Convert asset:menu_gallery/americano.webp to /assets/menu_gallery/americano.webp
    return `/${path.replace("asset:", "assets/")}`;
  }
  // Remove Supabase storage fallback and return the relative path (or prepend base if needed, but modern Cloudinary URLs are absolute)
  return path;
}

export function formatCurrency(
  amount: number | string | null | undefined,
  currency?: string | null,
) {
  return formatMoney(amount, { currency, emptyValue: "NPR 0.00" });
}

/** Compact product-UI money presentation for constrained chart axes. */
export function formatCompactCurrency(
  amount: number | string | null | undefined,
  currency?: string | null,
) {
  const numeric = Number(amount);
  const code = currency?.trim().toUpperCase() || configuredProductCurrency;
  const value = Number.isFinite(numeric) ? numeric : 0;
  return `${code} ${value.toLocaleString(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  })}`;
}

export function formatDate(dateStr: string | Date | null | undefined) {
  return formatProductDate(dateStr, "business-date");
}

export function formatDateTime(dateStr: string | Date | null | undefined) {
  return formatProductDate(dateStr, "timestamp");
}
