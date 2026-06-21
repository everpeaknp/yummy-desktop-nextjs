import apiClient from "@/lib/api-client";
import { DayCloseApis } from "@/lib/api/endpoints";
import {
  parseDayCloseSnapshotData,
  parseDayCloseSnapshotResponse,
  type DayCloseDetail,
  type DayCloseSnapshotResponse,
} from "@/types/day-close";

function isMissingSnapshotError(err: unknown): boolean {
  const status = (err as { response?: { status?: number } })?.response?.status;
  return status === 404;
}

/** Open / in-progress sessions only get a live snapshot from generate-snapshot. */
function usesLiveSnapshot(status: string | undefined): boolean {
  const s = String(status ?? "open").toLowerCase();
  return s === "open" || s === "pending" || s === "reopened";
}

/**
 * Load a day-close snapshot: saved report for confirmed closes, or live
 * generate-snapshot for open/pending/reopened sessions (no saved snapshot yet).
 */
export async function fetchDayCloseSnapshotForDetail(
  id: number,
  detail: DayCloseDetail | null,
  options?: { restaurantId?: number; businessLine?: string },
): Promise<DayCloseSnapshotResponse | null> {
  const useLiveSnapshot = usesLiveSnapshot(detail?.status);
  const restaurantId = detail?.restaurant_id ?? options?.restaurantId;
  const businessLine = detail?.business_line ?? options?.businessLine ?? "restaurant";

  if (useLiveSnapshot && restaurantId) {
    const res = await apiClient.get(
      DayCloseApis.generateSnapshot({
        restaurantId,
        businessLine,
        businessDate: detail?.business_date,
      }),
    );
    if (res.data?.status === "success") {
      const snapshot_data = parseDayCloseSnapshotData(res.data.data);
      if (snapshot_data) {
        return {
          snapshot_data,
          generated_at:
            typeof res.data?.data === "object" &&
            res.data.data != null &&
            "generated_at" in (res.data.data as object)
              ? String((res.data.data as { generated_at?: unknown }).generated_at)
              : undefined,
        };
      }
    }
  }

  try {
    const res = await apiClient.get(DayCloseApis.snapshot(id));
    if (res.data?.status === "success") {
      return parseDayCloseSnapshotResponse(res.data.data);
    }
  } catch (err) {
    if (!isMissingSnapshotError(err)) throw err;
  }

  return null;
}
