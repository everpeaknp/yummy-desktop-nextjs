"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import apiClient from "@/lib/api-client";
import { StaffApis } from "@/lib/api/endpoints";
import { hotelPmsApi } from "@/lib/hotel/api";
import { buildHotelSetupReadiness, type HotelSetupReadiness } from "@/lib/hotel/setup-readiness";

export type HotelSetupLoadStatus = "loading" | "ready" | "error";
export type HotelTeamLoadStatus = HotelSetupLoadStatus | "forbidden";
export interface HotelTeamMember {
  id: number;
  name: string;
  roles?: string[];
  role?: string | null;
  primary_role?: string | null;
  business_scope?: "restaurant" | "hotel" | "both" | null;
  permissions?: string[];
}
export interface HotelSetupReadinessResult {
  status: HotelSetupLoadStatus;
  readiness: HotelSetupReadiness | null;
  hotelTeam: HotelTeamMember[];
  teamStatus: HotelTeamLoadStatus;
  reload: () => Promise<void>;
}

export function useHotelSetupReadiness(restaurantId: number, canViewStaff: boolean): HotelSetupReadinessResult {
  const [status, setStatus] = useState<HotelSetupLoadStatus>("loading");
  const [readiness, setReadiness] = useState<HotelSetupReadiness | null>(null);
  const [hotelTeam, setHotelTeam] = useState<HotelTeamMember[]>([]);
  const [teamStatus, setTeamStatus] = useState<HotelTeamLoadStatus>(canViewStaff ? "loading" : "forbidden");
  const request = useRef(0);

  const reload = useCallback(async () => {
    const requestId = ++request.current;
    const current = () => request.current === requestId;
    setStatus("loading");
    setReadiness(null);
    setHotelTeam([]);
    setTeamStatus(canViewStaff ? "loading" : "forbidden");

    const loadHotel = async () => {
      try {
        const [settings, roomTypes, rooms, floors, ratePlans] = await Promise.all([
          hotelPmsApi.getSettings(restaurantId),
          hotelPmsApi.listRoomTypes(restaurantId),
          hotelPmsApi.listRooms(restaurantId),
          hotelPmsApi.listFloors(restaurantId),
          hotelPmsApi.listRatePlans(restaurantId),
        ]);
        if (!current()) return;
        setReadiness(buildHotelSetupReadiness({ settings, roomTypes, rooms, floors, ratePlans }));
        setStatus("ready");
      } catch {
        if (current()) setStatus("error");
      }
    };
    const loadTeam = async () => {
      if (!canViewStaff) return;
      try {
        const response = await apiClient.get<{ status: string; data: HotelTeamMember[] }>(StaffApis.list());
        if (!current()) return;
        if (response.data.status !== "success" || !Array.isArray(response.data.data)) {
          throw new Error("Staff list is unavailable.");
        }
        setHotelTeam(response.data.data.filter((member) => member.permissions?.some((key) => key.startsWith("hotel."))));
        setTeamStatus("ready");
      } catch (error) {
        if (!current()) return;
        const httpStatus = (error as { response?: { status?: number } })?.response?.status;
        setTeamStatus(httpStatus === 403 ? "forbidden" : "error");
      }
    };
    await Promise.all([loadHotel(), loadTeam()]);
  }, [restaurantId, canViewStaff]);

  useEffect(() => {
    void reload();
    return () => { request.current += 1; };
  }, [reload]);

  return { status, readiness, hotelTeam, teamStatus, reload };
}
