/** Confirmed day-close session returned by `GET /day-closes/sessions`. */

export interface DayCloseSession {
  id: number;
  business_date: string;
  business_line: string;
  confirmed_at: string;
  period_start_at: string;
  period_end_at: string;
}

/** API payload: `{ status, data: DayCloseSession[] }` or a bare array. */
export type DayCloseSessionResponse = DayCloseSession[];

export interface AnalyticsDaybookState {
  selectedDayCloseSession?: DayCloseSession | null;
  dayCloseSessions: DayCloseSession[];
  dayCloseSessionsLoading: boolean;
  dayCloseSessionsError: string | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function parseSessionRow(value: unknown): DayCloseSession | null {
  const row = asRecord(value);
  if (!row) return null;

  const id = Number(row.id);
  const periodStart = String(row.period_start_at ?? "").trim();
  const periodEnd = String(row.period_end_at ?? "").trim();
  if (!Number.isFinite(id) || !periodStart || !periodEnd) return null;

  return {
    id,
    business_date: String(row.business_date ?? ""),
    business_line: String(row.business_line ?? "restaurant"),
    confirmed_at: String(row.confirmed_at ?? ""),
    period_start_at: periodStart,
    period_end_at: periodEnd,
  };
}

export function parseDayCloseSessions(payload: unknown): DayCloseSession[] {
  if (Array.isArray(payload)) {
    return payload
      .map(parseSessionRow)
      .filter((session): session is DayCloseSession => session !== null);
  }

  const envelope = asRecord(payload);
  if (!envelope) return [];

  const data = envelope.data;
  if (Array.isArray(data)) {
    return data
      .map(parseSessionRow)
      .filter((session): session is DayCloseSession => session !== null);
  }

  return [];
}
