/** @typedef {{ amount: number, [key: string]: unknown }} TrendPoint */

/**
 * @param {number} minutes
 * @returns {string}
 */
export function formatDashboardDuration(minutes) {
  const totalMinutes = Math.max(0, Math.floor(Number(minutes) || 0));
  if (totalMinutes < 60) return `${totalMinutes}m`;

  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;
  if (totalHours < 48) return remainingMinutes ? `${totalHours}h ${remainingMinutes}m` : `${totalHours}h`;

  const roundedHours = Math.round(totalMinutes / 60);
  const days = Math.floor(roundedHours / 24);
  const remainingHours = roundedHours % 24;
  return remainingHours ? `${days}d ${remainingHours}h` : `${days}d`;
}

/**
 * @param {string} rawLabel
 * @returns {string}
 */
export function formatPaymentInstrumentLabel(rawLabel) {
  const label = String(rawLabel || "Other").trim().replaceAll("_", " ");
  const normalized = label.toLowerCase().replace(/\s+/g, " ");
  if (normalized.includes("unspecified card")) return "Card – Other";
  if (normalized.includes("unspecified qr")) return "QR – Other";

  const parts = label.split(/[•·|]/).map((part) => part.trim()).filter(Boolean);
  if (parts.length > 1) {
    const category = parts[0].toLowerCase();
    const kind = category.includes("digital") || category === "qr" ? "QR" : category === "card" ? "Card" : titleCase(parts[0]);
    return `${kind} – ${titleCase(parts.slice(1).join(" "))}`;
  }

  return titleCase(label);
}

/** @param {string} rawType */
export function formatAttentionType(rawType) {
  const normalized = String(rawType || "").trim().toUpperCase();
  const labels = {
    ORDER_AGING: "Order aging",
    OUTSTANDING_RECEIVABLES: "Outstanding receivables",
    STALE_OPEN_ORDERS: "Stale open orders",
    KOT_DELAY: "Kitchen delay",
  };
  return labels[normalized] || titleCase(normalized.replaceAll("_", " ").toLowerCase());
}

/** @param {string} value */
function titleCase(value) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/**
 * @template {TrendPoint} T
 * @param {T[]} points
 * @param {number} [windowSize]
 * @returns {(T & { movingAverage: number })[]}
 */
export function addTrailingMovingAverage(points, windowSize = 7) {
  const safeWindow = Math.max(1, Math.floor(Number(windowSize) || 7));
  return points.map((point, index) => {
    const window = points.slice(Math.max(0, index - safeWindow + 1), index + 1);
    const total = window.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
    return { ...point, movingAverage: total / window.length };
  });
}
