/** Dashboard V2 — render-only types for `meta` + `home` contract. */

import type { BusinessLine } from "@/lib/api/endpoint-types";
import {
  isLegacyFlatDashboardPayload,
  mapLegacyFlatDashboardToHome,
  mapLegacyFlatDashboardToHomePartial,
} from "@/lib/dashboard-v2-legacy-mapper";

export interface DashboardSectionMeta {
  available: boolean;
  reason?: string | null;
}

export interface DashboardV2Meta {
  restaurant_id?: number | null;
  outlet_name: string;
  currency: string;
  timezone: string;
  from_time?: string | null;
  to_time?: string | null;
  generated_at?: string | null;
  access_level: string;
  access_note?: string | null;
}

export interface ShiftPulseSection extends DashboardSectionMeta {
  active_orders: number;
  kot_pending: number;
  kot_delayed: number;
  cancelled: number;
  refunded: number;
}

export interface ActionQueueSection extends DashboardSectionMeta {
  delayed_kots: number;
  oldest_active_order_minutes: number;
  stale_open_orders?: number;
  stale_oldest_order_minutes?: number;
  credit_orders_unsettled: number;
  refunds_pending: number;
  high_cancellation: number;
}

export interface HomeQuickAction {
  key: string;
  title: string;
  route: string;
  enabled: boolean;
  reason?: string | null;
  icon: string;
}

export interface QuickActionsSection extends DashboardSectionMeta {
  items: HomeQuickAction[];
}

export interface AttentionItem {
  type: string;
  severity: string;
  title: string;
  subtitle: string;
  route: string;
  entity_id?: number | null;
  age_minutes?: number | null;
}

export interface AttentionItemsSection extends DashboardSectionMeta {
  items: AttentionItem[];
}

export interface ActiveOrderPreview {
  order_id: number;
  label: string;
  channel: string;
  status: string;
  age_minutes: number;
  grand_total?: number | null;
}

export interface ActiveOrdersPreviewSection extends DashboardSectionMeta {
  items: ActiveOrderPreview[];
}

export interface StatusCount {
  status: string;
  count: number;
}

export interface PipelineSection extends DashboardSectionMeta {
  status_counts: StatusCount[];
  aging_buckets: Record<string, number>;
}

export interface ThroughputPoint {
  timestamp?: string | null;
  orders_completed: number;
  sales_collected: number;
}

export interface ThroughputSection extends DashboardSectionMeta {
  comparison_basis: string;
  points: ThroughputPoint[];
}

export interface CashWatchSection extends DashboardSectionMeta {
  cash_collected: number;
  digital_collected: number;
  credit_sales: number;
  total_outstanding: number;
}

export interface TopItemLive {
  item_id: number;
  name: string;
  qty: number;
  revenue: number;
}

export interface TopItemsLiveSection extends DashboardSectionMeta {
  items: TopItemLive[];
}

export interface OccupancySection extends DashboardSectionMeta {
  occupied_tables: number;
  free_tables: number;
  occupied_rooms: number;
  free_rooms: number;
}

export interface ReservationPreview {
  reservation_id: number;
  customer_name: string;
  guest_count: number;
  reservation_time: string;
  status: string;
  table_name?: string | null;
}

export interface ReservationsTodaySection extends DashboardSectionMeta {
  pending_count: number;
  confirmed_count: number;
  items: ReservationPreview[];
}

export interface DayCloseStatusSection extends DashboardSectionMeta {
  status: string;
  route: string;
  action_label: string;
}

export interface HomeAlert {
  type: string;
  severity: string;
  message: string;
  action_hint?: string | null;
}

export interface AlertsSection extends DashboardSectionMeta {
  items: HomeAlert[];
}

export interface QuickInsightItem {
  type: string;
  message: string;
}

export interface QuickInsightsSection extends DashboardSectionMeta {
  items: QuickInsightItem[];
}

export interface DashboardV2Home {
  shift_pulse: ShiftPulseSection;
  action_queue: ActionQueueSection;
  cash_watch: CashWatchSection;
  quick_actions: QuickActionsSection;
  attention_items: AttentionItemsSection;
  active_orders_preview: ActiveOrdersPreviewSection;
  pipeline: PipelineSection;
  throughput: ThroughputSection;
  top_items_live: TopItemsLiveSection;
  occupancy: OccupancySection;
  reservations_today: ReservationsTodaySection;
  day_close_status: DayCloseStatusSection;
  alerts: AlertsSection;
  quick_insights: QuickInsightsSection;
  tutorial_video?: Record<string, unknown> | null;
}

export interface DashboardV2Response {
  meta: DashboardV2Meta;
  home: DashboardV2Home;
}

type HomeSectionKey = keyof DashboardV2Home;

export interface DashboardV2DeltaUpdates {
  meta?: DashboardV2Meta | null;
  home?: Partial<DashboardV2Home> | null;
}

export interface DashboardV2DeltaResponse {
  changed: boolean;
  last_updated?: string | null;
  updates?: DashboardV2DeltaUpdates | null;
}

export type DashboardV2QueryContext = {
  restaurantId: number;
  timezone: string;
  businessLine?: BusinessLine | string;
  date?: string;
  startTime?: string;
  endTime?: string;
};

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

function readBool(value: unknown, fallback = true): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return fallback;
}

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseSectionMeta(json: Record<string, unknown>): Pick<DashboardSectionMeta, "available" | "reason"> {
  return {
    available: readBool(json.available, true),
    reason: typeof json.reason === "string" ? json.reason : null,
  };
}

function parseList<T>(value: unknown, map: (row: Record<string, unknown>) => T): T[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row): row is Record<string, unknown> => !!row && typeof row === "object" && !Array.isArray(row))
    .map(map);
}

export function parseDashboardV2Meta(raw: unknown): DashboardV2Meta {
  const json = readRecord(raw);
  return {
    restaurant_id: json.restaurant_id == null ? null : readInt(json.restaurant_id),
    outlet_name: readString(json.outlet_name),
    currency: readString(json.currency, "NPR"),
    timezone: readString(json.timezone, "UTC"),
    from_time: typeof json.from_time === "string" ? json.from_time : null,
    to_time: typeof json.to_time === "string" ? json.to_time : null,
    generated_at:
      typeof json.generated_at === "string"
        ? json.generated_at
        : typeof json.last_updated === "string"
          ? json.last_updated
          : null,
    access_level: readString(json.access_level, "full"),
    access_note: typeof json.access_note === "string" ? json.access_note : null,
  };
}

function parseShiftPulse(raw: unknown): ShiftPulseSection {
  const json = readRecord(raw);
  return {
    ...parseSectionMeta(json),
    active_orders: readInt(json.active_orders),
    kot_pending: readInt(json.kot_pending),
    kot_delayed: readInt(json.kot_delayed),
    cancelled: readInt(json.cancelled ?? json.cancelled_today),
    refunded: readInt(json.refunded ?? json.refunded_today),
  };
}

function parseActionQueue(raw: unknown): ActionQueueSection {
  const json = readRecord(raw);
  return {
    ...parseSectionMeta(json),
    delayed_kots: readInt(json.delayed_kots),
    oldest_active_order_minutes: readInt(json.oldest_active_order_minutes),
    stale_open_orders: readInt(json.stale_open_orders),
    stale_oldest_order_minutes: readInt(json.stale_oldest_order_minutes),
    credit_orders_unsettled: readInt(json.credit_orders_unsettled),
    refunds_pending: readInt(json.refunds_pending),
    high_cancellation: readInt(json.high_cancellation),
  };
}

function parseQuickActions(raw: unknown): QuickActionsSection {
  const json = readRecord(raw);
  return {
    ...parseSectionMeta(json),
    items: parseList(json.items, (row) => ({
      key: readString(row.key),
      title: readString(row.title),
      route: readString(row.route),
      enabled: readBool(row.enabled, true),
      reason: typeof row.reason === "string" ? row.reason : null,
      icon: readString(row.icon),
    })),
  };
}

function parseAttentionItems(raw: unknown): AttentionItemsSection {
  const json = readRecord(raw);
  return {
    ...parseSectionMeta(json),
    items: parseList(json.items, (row) => ({
      type: readString(row.type),
      severity: readString(row.severity),
      title: readString(row.title),
      subtitle: readString(row.subtitle),
      route: readString(row.route),
      entity_id: row.entity_id == null ? null : readInt(row.entity_id),
      age_minutes: row.age_minutes == null ? null : readInt(row.age_minutes),
    })),
  };
}

function parseActiveOrdersPreview(raw: unknown): ActiveOrdersPreviewSection {
  const json = readRecord(raw);
  return {
    ...parseSectionMeta(json),
    items: parseList(json.items, (row) => ({
      order_id: readInt(row.order_id),
      label: readString(row.label),
      channel: readString(row.channel),
      status: readString(row.status),
      age_minutes: readInt(row.age_minutes),
      grand_total: row.grand_total == null ? null : readNum(row.grand_total),
    })),
  };
}

function parsePipeline(raw: unknown): PipelineSection {
  const json = readRecord(raw);
  const agingRaw = readRecord(json.aging_buckets);
  const aging_buckets: Record<string, number> = {
    "0_10m": readInt(agingRaw["0_10m"]),
    "10_20m": readInt(agingRaw["10_20m"]),
    "20m_plus": readInt(agingRaw["20m_plus"]),
  };
  Object.entries(agingRaw).forEach(([key, value]) => {
    aging_buckets[key] = readInt(value);
  });
  return {
    ...parseSectionMeta(json),
    status_counts: parseList(json.status_counts, (row) => ({
      status: readString(row.status),
      count: readInt(row.count),
    })),
    aging_buckets,
  };
}

function parseThroughput(raw: unknown): ThroughputSection {
  const json = readRecord(raw);
  return {
    ...parseSectionMeta(json),
    comparison_basis: readString(json.comparison_basis, "previous_period"),
    points: parseList(json.points, (row) => ({
      timestamp: typeof row.timestamp === "string" ? row.timestamp : null,
      orders_completed: readInt(row.orders_completed),
      sales_collected: readNum(row.sales_collected),
    })),
  };
}

function parseCashWatch(raw: unknown): CashWatchSection {
  const json = readRecord(raw);
  return {
    ...parseSectionMeta(json),
    cash_collected: readNum(json.cash_collected),
    digital_collected: readNum(json.digital_collected),
    credit_sales: readNum(json.credit_sales),
    total_outstanding: readNum(json.total_outstanding),
  };
}

function parseTopItemsLive(raw: unknown): TopItemsLiveSection {
  const json = readRecord(raw);
  return {
    ...parseSectionMeta(json),
    items: parseList(json.items, (row) => ({
      item_id: readInt(row.item_id),
      name: readString(row.name),
      qty: readInt(row.qty ?? row.quantity),
      revenue: readNum(row.revenue),
    })),
  };
}

function parseOccupancy(raw: unknown): OccupancySection {
  const json = readRecord(raw);
  return {
    ...parseSectionMeta(json),
    occupied_tables: readInt(json.occupied_tables),
    free_tables: readInt(json.free_tables),
    occupied_rooms: readInt(json.occupied_rooms),
    free_rooms: readInt(json.free_rooms),
  };
}

function parseReservationsToday(raw: unknown): ReservationsTodaySection {
  const json = readRecord(raw);
  return {
    ...parseSectionMeta(json),
    pending_count: readInt(json.pending_count),
    confirmed_count: readInt(json.confirmed_count),
    items: parseList(json.items, (row) => ({
      reservation_id: readInt(row.reservation_id),
      customer_name: readString(row.customer_name),
      guest_count: readInt(row.guest_count),
      reservation_time: readString(row.reservation_time),
      status: readString(row.status),
      table_name: typeof row.table_name === "string" ? row.table_name : null,
    })),
  };
}

function parseDayCloseStatus(raw: unknown): DayCloseStatusSection {
  const json = readRecord(raw);
  return {
    ...parseSectionMeta(json),
    status: readString(json.status, "unavailable"),
    route: readString(json.route, "/day-close"),
    action_label: readString(json.action_label, "Open Day Close"),
  };
}

function parseAlerts(raw: unknown): AlertsSection {
  const json = readRecord(raw);
  return {
    ...parseSectionMeta(json),
    items: parseList(json.items, (row) => ({
      type: readString(row.type),
      severity: readString(row.severity),
      message: readString(row.message),
      action_hint: typeof row.action_hint === "string" ? row.action_hint : null,
    })),
  };
}

function parseQuickInsights(raw: unknown): QuickInsightsSection {
  const json = readRecord(raw);
  return {
    ...parseSectionMeta(json),
    items: parseList(json.items, (row) => ({
      type: readString(row.type),
      message: readString(row.message),
    })),
  };
}

export function emptyDashboardV2Home(reason = "Dashboard data unavailable"): DashboardV2Home {
  const unavailable = { available: false, reason };
  return {
    shift_pulse: { ...unavailable, active_orders: 0, kot_pending: 0, kot_delayed: 0, cancelled: 0, refunded: 0 },
    action_queue: {
      ...unavailable,
      delayed_kots: 0,
      oldest_active_order_minutes: 0,
      stale_open_orders: 0,
      stale_oldest_order_minutes: 0,
      credit_orders_unsettled: 0,
      refunds_pending: 0,
      high_cancellation: 0,
    },
    cash_watch: {
      ...unavailable,
      cash_collected: 0,
      digital_collected: 0,
      credit_sales: 0,
      total_outstanding: 0,
    },
    quick_actions: { ...unavailable, items: [] },
    attention_items: { ...unavailable, items: [] },
    active_orders_preview: { ...unavailable, items: [] },
    pipeline: { ...unavailable, status_counts: [], aging_buckets: {} },
    throughput: { ...unavailable, comparison_basis: "previous_period", points: [] },
    top_items_live: { ...unavailable, items: [] },
    occupancy: { ...unavailable, occupied_tables: 0, free_tables: 0, occupied_rooms: 0, free_rooms: 0 },
    reservations_today: { ...unavailable, pending_count: 0, confirmed_count: 0, items: [] },
    day_close_status: {
      ...unavailable,
      status: "unavailable",
      route: "/day-close",
      action_label: "Open Day Close",
    },
    alerts: { ...unavailable, items: [] },
    quick_insights: { ...unavailable, items: [] },
    tutorial_video: null,
  };
}

export function hasVisibleDashboardSections(home: DashboardV2Home): boolean {
  const sections = [
    home.shift_pulse,
    home.action_queue,
    home.cash_watch,
    home.quick_actions,
    home.attention_items,
    home.active_orders_preview,
    home.pipeline,
    home.throughput,
    home.top_items_live,
    home.occupancy,
    home.reservations_today,
    home.day_close_status,
    home.alerts,
    home.quick_insights,
  ];
  return sections.some((section) => section.available);
}

export function parseDashboardV2Home(raw: unknown): DashboardV2Home {
  const json = readRecord(raw);
  return {
    shift_pulse: parseShiftPulse(json.shift_pulse),
    action_queue: parseActionQueue(json.action_queue),
    cash_watch: parseCashWatch(json.cash_watch),
    quick_actions: parseQuickActions(json.quick_actions),
    attention_items: parseAttentionItems(json.attention_items),
    active_orders_preview: parseActiveOrdersPreview(json.active_orders_preview),
    pipeline: parsePipeline(json.pipeline),
    throughput: parseThroughput(json.throughput),
    top_items_live: parseTopItemsLive(json.top_items_live),
    occupancy: parseOccupancy(json.occupancy),
    reservations_today: parseReservationsToday(json.reservations_today),
    day_close_status: parseDayCloseStatus(json.day_close_status),
    alerts: parseAlerts(json.alerts),
    quick_insights: parseQuickInsights(json.quick_insights),
    tutorial_video:
      json.tutorial_video && typeof json.tutorial_video === "object"
        ? (json.tutorial_video as Record<string, unknown>)
        : null,
  };
}

export function parsePartialDashboardHome(raw: unknown): Partial<DashboardV2Home> {
  const json = readRecord(raw);
  const patch: Partial<DashboardV2Home> = {};
  const sectionParsers: Array<[HomeSectionKey, (value: unknown) => unknown]> = [
    ["shift_pulse", parseShiftPulse],
    ["action_queue", parseActionQueue],
    ["cash_watch", parseCashWatch],
    ["quick_actions", parseQuickActions],
    ["attention_items", parseAttentionItems],
    ["active_orders_preview", parseActiveOrdersPreview],
    ["pipeline", parsePipeline],
    ["throughput", parseThroughput],
    ["top_items_live", parseTopItemsLive],
    ["occupancy", parseOccupancy],
    ["reservations_today", parseReservationsToday],
    ["day_close_status", parseDayCloseStatus],
    ["alerts", parseAlerts],
    ["quick_insights", parseQuickInsights],
  ];

  for (const [key, parser] of sectionParsers) {
    if (json[key] !== undefined) {
      (patch as Record<string, unknown>)[key] = parser(json[key]);
    }
  }

  if (json.tutorial_video !== undefined) {
    patch.tutorial_video =
      json.tutorial_video && typeof json.tutorial_video === "object"
        ? (json.tutorial_video as Record<string, unknown>)
        : null;
  }

  return patch;
}

export function parseDashboardV2Response(raw: unknown): DashboardV2Response | null {
  const json = readRecord(raw);
  if (!json.meta && !json.home && !json.health && !json.kpis) return null;

  const meta = parseDashboardV2Meta(json.meta);
  let home: DashboardV2Home;

  if (json.home) {
    home = parseDashboardV2Home(json.home);
  } else if (isLegacyFlatDashboardPayload(json)) {
    home = mapLegacyFlatDashboardToHome(json, meta.access_level);
  } else {
    home = emptyDashboardV2Home();
  }

  return { meta, home };
}

export function parseDashboardV2Delta(raw: unknown): DashboardV2DeltaResponse {
  const json = readRecord(raw);
  const updatesRaw = json.updates;
  let updates: DashboardV2DeltaUpdates | null = null;

  if (updatesRaw && typeof updatesRaw === "object") {
    const record = updatesRaw as Record<string, unknown>;
    const meta =
      record.meta && typeof record.meta === "object"
        ? parseDashboardV2Meta(record.meta)
        : null;

    let home: Partial<DashboardV2Home> | null = null;
    if (record.home !== undefined) {
      home = parsePartialDashboardHome(record.home);
    } else if (isLegacyFlatDashboardPayload(record)) {
      const accessLevel =
        meta?.access_level ??
        (record.meta && typeof record.meta === "object"
          ? readString((record.meta as Record<string, unknown>).access_level, "full")
          : "full");
      home = mapLegacyFlatDashboardToHomePartial(record, accessLevel);
    }

    updates = { meta, home };
  }

  return {
    changed: readBool(json.changed, false),
    last_updated: typeof json.last_updated === "string" ? json.last_updated : null,
    updates,
  };
}
