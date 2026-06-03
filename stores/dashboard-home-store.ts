import { create } from "zustand";
import apiClient from "@/lib/api-client";
import { DashboardApis } from "@/lib/api/endpoints";
import { applyDashboardDelta } from "@/lib/dashboard-v2-delta";
import { buildDashboardV2QueryContext } from "@/lib/dashboard-v2-query";
import type { DateRange } from "react-day-picker";
import type { DateRangePreset } from "@/components/ui/date-range-dropdown";
import {
  emptyDashboardV2Home,
  parseDashboardV2Delta,
  parseDashboardV2Response,
  type DashboardV2Home,
  type DashboardV2Meta,
  type DashboardV2QueryContext,
} from "@/types/dashboard-v2";

type DashboardHomeState = {
  meta: DashboardV2Meta | null;
  dashboardHome: DashboardV2Home | null;
  lastUpdated: string | null;
  deltaTimestamp: string | null;
  queryContext: DashboardV2QueryContext | null;
  loading: boolean;
  error: string | null;
  fetchDashboard: (input: {
    restaurantId: number;
    timezone: string;
    businessLine?: string;
    activeRange: DateRangePreset;
    date?: DateRange;
  }) => Promise<void>;
  /** Full reload using the last query context (after finance/POS invalidation). */
  refetchCurrent: () => Promise<void>;
  pollDelta: () => Promise<void>;
  reset: () => void;
};

export const useDashboardHomeStore = create<DashboardHomeState>((set, get) => ({
  meta: null,
  dashboardHome: null,
  lastUpdated: null,
  deltaTimestamp: null,
  queryContext: null,
  loading: false,
  error: null,

  reset: () =>
    set({
      meta: null,
      dashboardHome: null,
      lastUpdated: null,
      deltaTimestamp: null,
      queryContext: null,
      loading: false,
      error: null,
    }),

  fetchDashboard: async (input) => {
    const queryContext = buildDashboardV2QueryContext(input);
    set({ loading: true, error: null, queryContext });

    try {
      const res = await apiClient.get(
        DashboardApis.dashboardDataV2({
          restaurantId: queryContext.restaurantId,
          date: queryContext.date,
          startTime: queryContext.startTime,
          endTime: queryContext.endTime,
          timezone: queryContext.timezone,
          businessLine: queryContext.businessLine,
        }),
      );

      if (res.data?.status !== "success") {
        throw new Error(res.data?.message || "Failed to load dashboard.");
      }

      const parsed = parseDashboardV2Response(res.data.data);
      if (!parsed) {
        throw new Error("Dashboard response did not include meta/home.");
      }

      const lastUpdated = parsed.meta.generated_at ?? new Date().toISOString();
      set({
        meta: parsed.meta,
        dashboardHome: parsed.home,
        lastUpdated,
        deltaTimestamp: lastUpdated,
        loading: false,
        error: null,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load dashboard.";
      set({
        loading: false,
        error: message,
        meta: {
          outlet_name: "",
          currency: "NPR",
          timezone: "UTC",
          access_level: "full",
        },
        dashboardHome: emptyDashboardV2Home(message),
      });
    }
  },

  refetchCurrent: async () => {
    const { queryContext } = get();
    if (!queryContext) return;

    set({ loading: true, error: null });

    try {
      const res = await apiClient.get(
        DashboardApis.dashboardDataV2({
          restaurantId: queryContext.restaurantId,
          date: queryContext.date,
          startTime: queryContext.startTime,
          endTime: queryContext.endTime,
          timezone: queryContext.timezone,
          businessLine: queryContext.businessLine,
        }),
      );

      if (res.data?.status !== "success") {
        throw new Error(res.data?.message || "Failed to load dashboard.");
      }

      const parsed = parseDashboardV2Response(res.data.data);
      if (!parsed) {
        throw new Error("Dashboard response did not include meta/home.");
      }

      const lastUpdated = parsed.meta.generated_at ?? new Date().toISOString();
      set({
        meta: parsed.meta,
        dashboardHome: parsed.home,
        lastUpdated,
        deltaTimestamp: lastUpdated,
        loading: false,
        error: null,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load dashboard.";
      set({ loading: false, error: message });
    }
  },

  pollDelta: async () => {
    const { meta, dashboardHome, lastUpdated, queryContext } = get();
    if (!meta || !dashboardHome || !lastUpdated || !queryContext) return;

    try {
      const res = await apiClient.get(
        DashboardApis.dashboardDelta({
          restaurantId: queryContext.restaurantId,
          since: lastUpdated,
          date: queryContext.date,
          startTime: queryContext.startTime,
          endTime: queryContext.endTime,
          timezone: queryContext.timezone,
          businessLine: queryContext.businessLine,
        }),
      );

      if (res.data?.status !== "success") return;

      const delta = parseDashboardV2Delta(res.data.data);
      if (!delta.changed) {
        set({ deltaTimestamp: delta.last_updated ?? lastUpdated });
        return;
      }

      const merged = applyDashboardDelta({ meta, home: dashboardHome }, delta);
      if (!merged) return;

      const nextUpdated = merged.meta.generated_at ?? delta.last_updated ?? lastUpdated;
      set({
        meta: merged.meta,
        dashboardHome: merged.home,
        lastUpdated: nextUpdated,
        deltaTimestamp: delta.last_updated ?? nextUpdated,
      });
    } catch {
      // Delta failures are non-fatal; keep last snapshot.
    }
  },
}));
