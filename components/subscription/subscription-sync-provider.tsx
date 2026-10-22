"use client";

import { useEffect } from "react";

import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";
import { useSubscriptionStore } from "@/hooks/use-subscription";
import { QuotaCompliancePrompt } from "@/components/subscription/quota-compliance-prompt";

export function SubscriptionSyncProvider() {
  const userId = useAuth((state) => state.user?.id ?? null);
  const restaurantId = useRestaurant((state) => state.restaurant?.id ?? null);
  const fetchCatalog = useSubscriptionStore((state) => state.fetchCatalog);
  const fetchCurrent = useSubscriptionStore((state) => state.fetchCurrent);
  const clearCurrent = useSubscriptionStore((state) => state.clearCurrent);

  useEffect(() => {
    if (!userId || !restaurantId) {
      clearCurrent();
      return;
    }
    void Promise.allSettled([
      fetchCurrent({ restaurantId }),
      fetchCatalog(),
    ]);
  }, [clearCurrent, fetchCatalog, fetchCurrent, restaurantId, userId]);

  return <QuotaCompliancePrompt />;
}
