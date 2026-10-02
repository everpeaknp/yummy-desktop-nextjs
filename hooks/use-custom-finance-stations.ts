"use client";

import { useEffect, useState } from "react";
import apiClient from "@/lib/api-client";
import { StationApis } from "@/lib/api/endpoints";
import type { CustomFinanceStation } from "@/lib/finance-station-scope";

/**
 * A restaurant's own active dynamic Station rows (see
 * components/stations/station-picker.tsx), for use as the `customStations`
 * scope on financeStationOptions/toFinanceStationParam/isFinanceStationAvailable
 * so a custom station is selectable/valid as a finance report filter, not
 * just the fixed 5.
 */
export function useCustomFinanceStations(
  restaurantId: number | null | undefined,
) {
  const [customStations, setCustomStations] = useState<CustomFinanceStation[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (!restaurantId) {
      setCustomStations([]);
      return;
    }
    apiClient
      .get(StationApis.list({ restaurantId, isActive: true, limit: 200 }))
      .then((response) => {
        if (cancelled) return;
        if (response.data.status === "success") {
          const rows = response.data.data?.stations || [];
          setCustomStations(
            Array.isArray(rows)
              ? rows.map((row: any) => ({
                  name: row.name,
                  business_line: row.business_line ?? null,
                }))
              : [],
          );
        }
      })
      .catch(() => {
        if (!cancelled) setCustomStations([]);
      });
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  return customStations;
}
