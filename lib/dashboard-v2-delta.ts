import type {
  DashboardV2DeltaResponse,
  DashboardV2Home,
  DashboardV2Meta,
  DashboardV2Response,
} from "@/types/dashboard-v2";

type HomeSectionKey = keyof DashboardV2Home;

const HOME_SECTION_KEYS: HomeSectionKey[] = [
  "shift_pulse",
  "action_queue",
  "cash_watch",
  "quick_actions",
  "attention_items",
  "active_orders_preview",
  "pipeline",
  "throughput",
  "top_items_live",
  "occupancy",
  "reservations_today",
  "day_close_status",
  "alerts",
  "quick_insights",
  "tutorial_video",
];

export function mergeDashboardHome(
  current: DashboardV2Home,
  patch: Partial<DashboardV2Home> | null | undefined,
): DashboardV2Home {
  if (!patch) return current;
  const next = { ...current };
  for (const key of HOME_SECTION_KEYS) {
    if (patch[key] !== undefined) {
      (next as Record<string, unknown>)[key] = patch[key];
    }
  }
  return next;
}

export function applyDashboardDelta(
  current: DashboardV2Response,
  delta: DashboardV2DeltaResponse,
): DashboardV2Response | null {
  if (!delta.changed || !delta.updates) return null;

  const nextMeta: DashboardV2Meta = delta.updates.meta ?? current.meta;
  const patchHome = delta.updates.home;

  let nextHome = current.home;
  if (patchHome) {
    nextHome = mergeDashboardHome(current.home, patchHome);
  }

  const lastUpdated =
    delta.last_updated ?? nextMeta.generated_at ?? current.meta.generated_at ?? null;

  return {
    meta: {
      ...nextMeta,
      generated_at: lastUpdated,
    },
    home: nextHome,
  };
}
