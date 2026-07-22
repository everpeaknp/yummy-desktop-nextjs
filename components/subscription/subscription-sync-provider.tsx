"use client";

import { useEffect } from "react";

import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";
import { useSubscriptionStore } from "@/hooks/use-subscription";

export function SubscriptionSyncProvider() {
  const userId = useAuth((state) => state.user?.id ?? null);
  const restaurantId = useRestaurant((state) => state.restaurant?.id ?? null);
  const fetchCurrent = useSubscriptionStore((state) => state.fetchCurrent);
  const clearCurrent = useSubscriptionStore((state) => state.clearCurrent);

  useEffect(() => {
    if (!userId || !restaurantId) {
      clearCurrent();
      return;
    }
    void fetchCurrent({ restaurantId }).catch(() => {
      // The store exposes the error to plan-aware screens. Existing API guards remain authoritative.
    });
  }, [clearCurrent, fetchCurrent, restaurantId, userId]);

  return null;
}
