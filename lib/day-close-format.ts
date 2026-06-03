/** Display formatting for day close — no financial calculations. */

export function formatDayCloseCurrency(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `Rs. ${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDayCloseNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function formatDayClosePeriod(
  periodStart?: string | null,
  periodEnd?: string | null,
  timezone?: string
): string {
  if (!periodStart || !periodEnd) return "—";
  const tz = timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: tz,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  };
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "—";
  const fmt = new Intl.DateTimeFormat("en-US", opts);
  const startLabel = fmt.format(start);
  const endLabel = fmt.format(end);
  const sameYear = start.getFullYear() === end.getFullYear();
  const endOpts: Intl.DateTimeFormatOptions = sameYear
    ? opts
    : { ...opts, year: "numeric" };
  const endFmt = new Intl.DateTimeFormat("en-US", endOpts);
  return `${startLabel} – ${endFmt.format(end)}`;
}

export function formatDayCloseCloseName(businessLine?: string | null): string {
  return String(businessLine ?? "restaurant").toLowerCase() === "hotel"
    ? "Hotel Close"
    : "Restaurant Close";
}

/** Prefer exact close window; never use business_date as the financial boundary label. */
export function formatDayCloseListHeading(input: {
  id: number;
  business_date?: string | null;
  business_line?: string | null;
  period_start_at?: string | null;
  period_end_at?: string | null;
}): string {
  const closeName = formatDayCloseCloseName(input.business_line);
  const period = formatDayClosePeriod(input.period_start_at, input.period_end_at);
  if (period !== "—") return `${closeName} • Covers ${period}`;
  return `${closeName} #${input.id}`;
}

export function formatDayCloseCoveredRange(
  periodStart?: string | null,
  periodEnd?: string | null
): string | null {
  const period = formatDayClosePeriod(periodStart, periodEnd);
  return period === "—" ? null : `Covers ${period}`;
}

export function pickBackendAmount(
  ...values: Array<number | null | undefined>
): number | undefined {
  for (const value of values) {
    if (value != null && Number.isFinite(value)) return value;
  }
  return undefined;
}
