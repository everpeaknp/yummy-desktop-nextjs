"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { History } from "lucide-react";

import apiClient from "@/lib/api-client";
import { DrawerSessionApis } from "@/lib/api/endpoints";
import { canAccessBusinessModule, hasPermission } from "@/lib/role-permissions";
import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";
import { AppPage } from "@/components/patterns/page/app-page";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DayCloseFlow } from "@/components/day-close/day-close-flow";
import {
  DayCloseHistory,
  type DayCloseHistoryHandle,
} from "@/components/analytics/day-close-history";
import type { BusinessLine } from "@/types/day-close";

function todayIso() {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export default function DayClosePage() {
  const searchParams = useSearchParams();
  const user = useAuth((state) => state.user);
  const restaurant = useRestaurant((state) => state.restaurant);
  const restaurantId = user?.restaurant_id ?? undefined;
  const requestedBusinessLine = searchParams.get("business_line");
  const requestedBusinessDate = searchParams.get("business_date");
  const targetDayCloseId =
    Number(searchParams.get("day_close_id") || "") || null;
  const detailId = Number(searchParams.get("detail") || "") || null;
  const [businessDate, setBusinessDate] = useState(
    requestedBusinessDate || todayIso(),
  );
  const [businessLine, setBusinessLine] = useState<BusinessLine>(
    requestedBusinessLine === "hotel" || requestedBusinessLine === "combined"
      ? requestedBusinessLine
      : "restaurant",
  );
  const [cashControlMode, setCashControlMode] = useState<
    "separate" | "combined"
  >("separate");
  const [showHistory, setShowHistory] = useState(Boolean(detailId));
  const historyRef = useRef<DayCloseHistoryHandle | null>(null);

  const canViewDayClose = hasPermission(user, "reports.dayclose.view");
  const canUseRestaurant = canAccessBusinessModule(user, "restaurant");
  const canUseHotel =
    Boolean(restaurant?.hotel_enabled) &&
    canAccessBusinessModule(user, "hotel") &&
    canViewDayClose;
  const showBusinessLinePicker = Boolean(
    cashControlMode !== "combined" &&
    restaurant?.restaurant_enabled &&
    restaurant?.hotel_enabled &&
    canUseRestaurant &&
    canUseHotel,
  );

  useEffect(() => {
    if (!restaurantId) return;
    let active = true;
    void apiClient
      .get(
        DrawerSessionApis.cashControlPolicy({
          restaurantId,
          effectiveDate: businessDate,
        }),
      )
      .then((response) => {
        if (!active) return;
        const mode =
          response.data?.data?.mode === "combined" ? "combined" : "separate";
        setCashControlMode(mode);
        if (mode === "combined") setBusinessLine("combined");
      })
      .catch(() => {
        if (active) setCashControlMode("separate");
      });
    return () => {
      active = false;
    };
  }, [businessDate, restaurantId]);

  useEffect(() => {
    if (cashControlMode === "combined") return;
    if (requestedBusinessLine === "hotel" && canUseHotel)
      setBusinessLine("hotel");
    else if (!canUseRestaurant && canUseHotel) setBusinessLine("hotel");
    else setBusinessLine("restaurant");
  }, [canUseHotel, canUseRestaurant, cashControlMode, requestedBusinessLine]);

  useEffect(() => {
    if (!detailId) return;
    setShowHistory(true);
  }, [detailId]);

  useEffect(() => {
    if (!detailId || !showHistory) return;
    const timer = window.setTimeout(() => {
      void historyRef.current?.openDayCloseDetail(detailId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [detailId, showHistory]);

  const scopeLabel = useMemo(() => {
    if (businessLine === "combined") return "Restaurant + hotel";
    if (businessLine === "hotel") return "Hotel";
    return "Restaurant";
  }, [businessLine]);

  if (!restaurantId || !canViewDayClose) return null;

  return (
    <AppPage width="wide" className="pb-6">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-5 flex items-center justify-between gap-3">
          {cashControlMode === "combined" ? (
            <p className="text-sm font-medium text-muted-foreground">
              {scopeLabel}
            </p>
          ) : showBusinessLinePicker ? (
            <Select
              value={businessLine}
              onValueChange={(value) => setBusinessLine(value as BusinessLine)}
            >
              <SelectTrigger className="h-11 w-[190px]">
                <SelectValue placeholder="Business area" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="restaurant">Restaurant</SelectItem>
                <SelectItem value="hotel">Hotel</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm font-medium text-muted-foreground">
              {scopeLabel}
            </p>
          )}
          <Button
            type="button"
            variant="ghost"
            className="h-11"
            onClick={() => setShowHistory((value) => !value)}
          >
            <History className="mr-2 h-4 w-4" />
            {showHistory ? "Back to close" : "History"}
          </Button>
        </div>

        {showHistory ? (
          <DayCloseHistory
            ref={historyRef}
            restaurantId={restaurantId}
            timezone={restaurant?.timezone}
            initialBusinessLine={businessLine}
          />
        ) : (
          <DayCloseFlow
            restaurantId={restaurantId}
            businessLine={businessLine}
            businessDate={businessDate}
            timezone={restaurant?.timezone}
            targetDayCloseId={targetDayCloseId}
            onBusinessDateChange={setBusinessDate}
          />
        )}
      </div>
    </AppPage>
  );
}
