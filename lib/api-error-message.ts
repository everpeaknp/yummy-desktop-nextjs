export function getApiErrorMessage(error: unknown, fallback: string): string {
  const response = (error as { response?: { data?: unknown } })?.response?.data;
  if (!response || typeof response !== "object") return fallback;
  const data = response as { message?: unknown; detail?: unknown };
  if (typeof data.detail === "string" && data.detail.trim()) return data.detail;
  if (data.detail && typeof data.detail === "object") {
    const detail = data.detail as {
      message?: unknown;
      blockers?: unknown;
      errors?: unknown;
    };
    const message = typeof detail.message === "string" ? detail.message.trim() : "";
    const blockers = Array.isArray(detail.blockers)
      ? detail.blockers.map(String).map((item) => item.trim()).filter(Boolean)
      : [];
    if (message && blockers.length) return `${message}\n${blockers.map((item) => `• ${item}`).join("\n")}`;
    if (message) return message;
    if (detail.errors && typeof detail.errors === "object") {
      const errors = Object.entries(detail.errors as Record<string, unknown>)
        .map(([channel, reason]) => {
          const text = typeof reason === "string" ? reason.trim() : "";
          return text ? `${channel.toUpperCase()}: ${text}` : "";
        })
        .filter(Boolean);
      if (errors.length) return errors.join("; ");
    }
  }
  if (typeof data.message === "string" && data.message.trim()) return data.message;
  return fallback;
}
