export type ActiveCashDrawerSession = {
  id: number;
  status: string;
  name?: string | null;
  drawer_key?: string | null;
  station?: string | null;
  business_date?: string | null;
};

type ActiveCashDrawerResult = {
  controlsEnabled: boolean;
  sessions: ActiveCashDrawerSession[];
};

type CashExpenseDrawerPayloadInput = {
  paymentMethod: string;
  controlsEnabled: boolean;
  selectedDrawerSessionId: string | number | null | undefined;
};

const paymentReadyStatuses = new Set([
  "opened",
  "closing_count_required",
  "reopened",
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

export function parseActiveCashDrawers(responseData: unknown): ActiveCashDrawerResult {
  const payload = asRecord(responseData) ?? {};
  const message = String(payload.message ?? "").trim().toLowerCase();
  if (message.includes("controls are disabled")) {
    return { controlsEnabled: false, sessions: [] };
  }

  const rows = Array.isArray(payload.data) ? payload.data : [];
  const sessions = rows.flatMap((row) => {
    const record = asRecord(row);
    if (record === null) return [];

    const id = Number(record.id);
    const status = String(record.status ?? "").trim().toLowerCase();
    if (!Number.isInteger(id) || id <= 0 || !paymentReadyStatuses.has(status)) {
      return [];
    }

    return [
      {
        id,
        status,
        name: record.name == null ? null : String(record.name),
        drawer_key:
          record.drawer_key == null ? null : String(record.drawer_key),
        station: record.station == null ? null : String(record.station),
        business_date:
          record.business_date == null ? null : String(record.business_date),
      },
    ];
  });

  return { controlsEnabled: true, sessions };
}

export function buildCashExpenseDrawerPayload({
  paymentMethod,
  controlsEnabled,
  selectedDrawerSessionId,
}: CashExpenseDrawerPayloadInput): { drawer_session_id?: number } {
  if (paymentMethod.trim().toLowerCase() !== "cash" || !controlsEnabled) {
    return {};
  }

  const drawerSessionId = Number(selectedDrawerSessionId);
  if (!Number.isInteger(drawerSessionId) || drawerSessionId <= 0) {
    throw new Error(
      "Select an open cash drawer before recording this cash expense.",
    );
  }

  return { drawer_session_id: drawerSessionId };
}
