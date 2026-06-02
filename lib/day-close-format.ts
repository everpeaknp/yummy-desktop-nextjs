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
  return `${fmt.format(start)} → ${fmt.format(end)}`;
}

/** Prefer period window from snapshot/detail; fall back to business date label. */
export function formatDayCloseListHeading(input: {
  id: number;
  business_date?: string | null;
  period_start_at?: string | null;
  period_end_at?: string | null;
}): string {
  const period = formatDayClosePeriod(input.period_start_at, input.period_end_at);
  if (period !== "—") return period;
  if (input.business_date) {
    const d = new Date(String(input.business_date).slice(0, 10) + "T12:00:00");
    if (!Number.isNaN(d.getTime())) {
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(d);
    }
  }
  return `Day #${input.id}`;
}

export function pickBackendAmount(
  ...values: Array<number | null | undefined>
): number | undefined {
  for (const value of values) {
    if (value != null && Number.isFinite(value)) return value;
  }
  return undefined;
}
