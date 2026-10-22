export type CurrencyValue = number | string | null | undefined;

export type MoneyFormatOptions = {
  currency?: string | null;
  locale?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  emptyValue?: string;
};

export const configuredProductCurrency =
  process.env.NEXT_PUBLIC_CURRENCY_CODE?.trim().toUpperCase() || "NPR";

function asFiniteNumber(value: CurrencyValue): number | undefined {
  if (value == null || (typeof value === "string" && value.trim() === "")) {
    return undefined;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Product UI money presentation. Fiscal and legal print layouts keep their own output. */
export function formatMoney(
  value: CurrencyValue,
  {
    currency = configuredProductCurrency,
    locale,
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
    emptyValue = "—",
  }: MoneyFormatOptions = {},
): string {
  const amount = asFiniteNumber(value);
  if (amount == null) return emptyValue;
  const code = currency?.trim().toUpperCase() || configuredProductCurrency;
  return `${code} ${amount.toLocaleString(locale, {
    minimumFractionDigits,
    maximumFractionDigits,
  })}`;
}

export type ProductDateKind = "business-date" | "timestamp" | "range";

export function formatProductDate(
  value: string | Date | null | undefined,
  kind: ProductDateKind = "business-date",
  locale?: string,
): string {
  if (!value) return "—";
  const businessDateMatch =
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
      : null;
  const date =
    businessDateMatch && kind !== "timestamp"
      ? new Date(
          Number(businessDateMatch[1]),
          Number(businessDateMatch[2]) - 1,
          Number(businessDateMatch[3]),
        )
      : value instanceof Date
        ? value
        : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const displayLocale = locale || "en-GB";
  const datePart = new Intl.DateTimeFormat(displayLocale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
    .format(date)
    .replace(/\bSept\b/, "Sep");
  if (kind !== "timestamp") return datePart;
  const timePart = new Intl.DateTimeFormat(displayLocale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  return `${datePart} · ${timePart}`;
}
