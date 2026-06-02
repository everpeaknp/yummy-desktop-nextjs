import type { DayCloseSession } from "@/types/day-close-session";

function parseInstant(iso: string): Date | null {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatInstant(
  instant: Date,
  timezone: string,
  options: Intl.DateTimeFormatOptions
): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    ...options,
  }).format(instant);
}

/** Chip title when a session is selected, e.g. "Jun 3, 2026". */
export function formatDaybookSessionLabel(
  session: DayCloseSession,
  timezone: string
): string {
  const source = session.period_end_at || session.confirmed_at || session.business_date;
  const instant = parseInstant(source);
  if (!instant) return session.business_date || "Session";

  return formatInstant(instant, timezone, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Helper line under the chip, e.g. "Covers Jun 1, 11:40 PM - Jun 3, 8:15 PM". */
export function formatDaybookSessionRange(
  session: DayCloseSession,
  timezone: string
): string {
  const start = parseInstant(session.period_start_at);
  const end = parseInstant(session.period_end_at);
  if (!start || !end) {
    return session.business_date ? `Covers ${session.business_date}` : "Covers selected daybook window";
  }

  const sameYear = start.getFullYear() === end.getFullYear();
  const pattern: Intl.DateTimeFormatOptions = sameYear
    ? { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
    : {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      };

  const startLabel = formatInstant(start, timezone, pattern);
  const endLabel = formatInstant(end, timezone, pattern);
  return `Covers ${startLabel} - ${endLabel}`;
}

export function formatDaybookChipLabel(
  session: DayCloseSession | null | undefined,
  timezone: string
): string {
  if (!session) return "Daybook: All";
  return `Daybook: ${formatDaybookSessionLabel(session, timezone)}`;
}
