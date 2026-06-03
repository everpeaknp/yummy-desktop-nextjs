/**
 * Maps the legacy flat `/admin/dashboard/v2` payload (health, kpis, breakdowns, …)
 * into the `home` section model when the backend has not yet shipped `home`.
 * Same endpoint — no analytics mixing.
 */
import type { DashboardV2Home } from "@/types/dashboard-v2";

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readInt(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.trunc(parsed);
  }
  return fallback;
}

function readNum(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function parseList<T>(value: unknown, map: (row: Record<string, unknown>) => T): T[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row): row is Record<string, unknown> => !!row && typeof row === "object" && !Array.isArray(row))
    .map(map);
}

function unavailableSection(reason: string): { available: false; reason: string } {
  return { available: false, reason };
}

/** Full legacy payload → home sections. */
export function mapLegacyFlatDashboardToHome(
  raw: unknown,
  accessLevel = "full",
): DashboardV2Home {
  const json = readRecord(raw);
  const health = readRecord(json.health);
  const kpis = readRecord(json.kpis);
  const breakdowns = readRecord(json.breakdowns);
  const receivables = readRecord(json.receivables);
  const limited = accessLevel === "limited";

  const healthAlerts = parseList(health.alerts, (row) => ({
    type: readString(row.type),
    severity: readString(row.severity, "MEDIUM"),
    message: readString(row.message),
    action_hint: null as string | null,
  }));

  const quickInsightItems = parseList(json.quick_insights, (row) => ({
    type: readString(row.type),
    message: readString(row.message),
  }));

  const statusCounts = parseList(breakdowns.order_status, (row) => ({
    status: readString(row.status),
    count: readInt(row.count),
  }));

  const topItems = parseList(breakdowns.top_items, (row) => ({
    item_id: readInt(row.item_id),
    name: readString(row.name),
    qty: readInt(row.quantity ?? row.qty),
    revenue: readNum(row.revenue),
  }));

  const hasHealth = Object.keys(health).length > 0;
  const hasKpis = Object.keys(kpis).length > 0;
  const hasBreakdowns = Object.keys(breakdowns).length > 0;

  return {
    shift_pulse: hasHealth
      ? {
          available: true,
          active_orders: readInt(health.active_orders),
          kot_pending: readInt(health.kot_pending),
          kot_delayed: readInt(health.kot_delayed),
          cancelled: readInt(health.cancelled_today ?? health.cancelled),
          refunded: readInt(health.refunded_today ?? health.refunded),
        }
      : {
          ...unavailableSection("Operational metrics unavailable"),
          active_orders: 0,
          kot_pending: 0,
          kot_delayed: 0,
          cancelled: 0,
          refunded: 0,
        },
    action_queue: hasHealth
      ? {
          available: true,
          delayed_kots: readInt(health.kot_delayed),
          oldest_active_order_minutes: 0,
          stale_open_orders: 0,
          stale_oldest_order_minutes: 0,
          credit_orders_unsettled: readInt(receivables.credit_orders_count),
          refunds_pending: readInt(health.refunded_today ?? health.refunded),
          high_cancellation: readInt(health.cancelled_today ?? health.cancelled),
        }
      : {
          ...unavailableSection("Action queue unavailable"),
          delayed_kots: 0,
          oldest_active_order_minutes: 0,
          stale_open_orders: 0,
          stale_oldest_order_minutes: 0,
          credit_orders_unsettled: 0,
          refunds_pending: 0,
          high_cancellation: 0,
        },
    cash_watch: hasKpis
      ? {
          available: true,
          cash_collected: limited ? 0 : readNum(kpis.cash_sales),
          digital_collected: limited ? 0 : readNum(kpis.non_cash_sales),
          credit_sales: limited ? 0 : readNum(receivables.credit_sales),
          total_outstanding: limited ? 0 : readNum(receivables.total_outstanding),
        }
      : {
          ...unavailableSection("Cash metrics unavailable"),
          cash_collected: 0,
          digital_collected: 0,
          credit_sales: 0,
          total_outstanding: 0,
        },
    quick_actions: { ...unavailableSection("Quick actions not in API response"), items: [] },
    attention_items: { ...unavailableSection("Attention items not in API response"), items: [] },
    active_orders_preview: {
      ...unavailableSection("Active order preview not in API response"),
      items: [],
    },
    pipeline: hasBreakdowns
      ? {
          available: true,
          status_counts: statusCounts,
          aging_buckets: {},
        }
      : {
          ...unavailableSection("Pipeline unavailable"),
          status_counts: [],
          aging_buckets: {},
        },
    throughput: {
      ...unavailableSection("Throughput not in legacy API response"),
      comparison_basis: "previous_period",
      points: [],
    },
    top_items_live: hasBreakdowns
      ? {
          available: true,
          items: topItems,
        }
      : {
          ...unavailableSection("Top items unavailable"),
          items: [],
        },
    occupancy: {
      ...unavailableSection("Occupancy not in legacy API response"),
      occupied_tables: 0,
      free_tables: 0,
      occupied_rooms: 0,
      free_rooms: 0,
    },
    reservations_today: {
      ...unavailableSection("Reservations not in legacy API response"),
      pending_count: 0,
      confirmed_count: 0,
      items: [],
    },
    day_close_status: {
      available: true,
      status: "open",
      route: "/day-close",
      action_label: "Open Day Close",
    },
    alerts: {
      available: healthAlerts.length > 0,
      reason: healthAlerts.length > 0 ? null : "No alerts",
      items: healthAlerts,
    },
    quick_insights: {
      available: quickInsightItems.length > 0,
      reason: quickInsightItems.length > 0 ? null : "No insights",
      items: quickInsightItems,
    },
    tutorial_video: null,
  };
}

/** Partial legacy delta updates → partial home patch. */
export function mapLegacyFlatDashboardToHomePartial(
  raw: unknown,
  accessLevel = "full",
): Partial<DashboardV2Home> {
  const json = readRecord(raw);
  const patch: Partial<DashboardV2Home> = {};

  if (json.health !== undefined) {
    const mapped = mapLegacyFlatDashboardToHome({ health: json.health }, accessLevel);
    patch.shift_pulse = mapped.shift_pulse;
    patch.action_queue = mapped.action_queue;
    patch.alerts = mapped.alerts;
  }
  if (json.kpis !== undefined || json.receivables !== undefined) {
    const mapped = mapLegacyFlatDashboardToHome(
      { kpis: json.kpis, receivables: json.receivables },
      accessLevel,
    );
    patch.cash_watch = mapped.cash_watch;
  }
  if (json.breakdowns !== undefined) {
    const mapped = mapLegacyFlatDashboardToHome({ breakdowns: json.breakdowns }, accessLevel);
    patch.pipeline = mapped.pipeline;
    patch.top_items_live = mapped.top_items_live;
  }
  if (json.quick_insights !== undefined) {
    const mapped = mapLegacyFlatDashboardToHome({ quick_insights: json.quick_insights }, accessLevel);
    patch.quick_insights = mapped.quick_insights;
  }

  return patch;
}

export function isLegacyFlatDashboardPayload(raw: unknown): boolean {
  const json = readRecord(raw);
  return !json.home && (json.health != null || json.kpis != null || json.breakdowns != null);
}
