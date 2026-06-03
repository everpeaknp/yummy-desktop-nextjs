/**
 * Standard backend envelope: { status, message, data }.
 * Frontend must read `.data` — never treat the raw axios body as the payload.
 */

export type ApiEnvelope<T = unknown> = {
  status?: string;
  message?: string;
  data?: T;
};

export function isApiSuccess(payload: unknown): boolean {
  const row = asRecord(payload);
  return row?.status === "success";
}

export function unwrapApiEnvelope<T>(response: { data?: unknown }): T {
  const body = response.data;
  const row = asRecord(body);
  if (row && row.status === "success" && "data" in row) {
    return row.data as T;
  }
  if (row && "data" in row && row.data !== undefined) {
    return row.data as T;
  }
  return body as T;
}

export function unwrapApiEnvelopeOrThrow<T>(
  response: { data?: unknown },
  fallbackMessage = "Request failed"
): T {
  const body = response.data;
  const row = asRecord(body);
  if (row?.status === "success" && "data" in row) {
    return row.data as T;
  }
  const message =
    (typeof row?.message === "string" && row.message) ||
    (typeof row?.detail === "string" && row.detail) ||
    fallbackMessage;
  throw new Error(message);
}

/** Typed unwrap with an optional parser (day-close style). */
export function unwrapApiData<T>(
  payload: unknown,
  parser: (value: unknown) => T | null
): T | null {
  const root = asRecord(payload);
  if (!root) return parser(payload);
  if (root.status === "success" && "data" in root) {
    return parser(root.data);
  }
  return parser(root.data ?? payload);
}

/** Primary user-facing error text — prefers backend detail/message. */
export function getApiErrorMessage(err: unknown, fallback = "Request failed. Please try again."): string {
  const data = (err as { response?: { data?: unknown } })?.response?.data;
  if (typeof data === "string" && data.trim()) return data;
  if (data && typeof data === "object") {
    const row = data as Record<string, unknown>;
    if (typeof row.detail === "string" && row.detail.trim()) return row.detail;
    if (typeof row.message === "string" && row.message.trim()) return row.message;
    if (Array.isArray(row.detail)) {
      const joined = row.detail
        .map((item) => {
          if (typeof item === "string") return item;
          if (item && typeof item === "object" && "msg" in item) {
            return String((item as { msg?: string }).msg ?? "");
          }
          return "";
        })
        .filter(Boolean)
        .join(". ");
      if (joined) return joined;
    }
  }
  if (err instanceof Error && err.message.trim()) return err.message;
  return fallback;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
