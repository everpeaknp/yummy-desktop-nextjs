"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { useAuth, useAuthHydrated } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";
import { hasStoredSession } from "@/lib/auth-storage";
import { canAccessOnboarding } from "@/lib/onboarding";
import { getHomeRouteForUser } from "@/lib/role-permissions";

function isReplayQuery(searchParams: ReturnType<typeof useSearchParams>) {
  const replay = searchParams.get("replay");
  // Accept ?replay=1 and accidental ?replay-1 (treated as flag key)
  return replay === "1" || replay === "true" || searchParams.has("replay-1");
}

export default function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isReplay = isReplayQuery(searchParams);
  const authHydrated = useAuthHydrated();
  const user = useAuth((s) => s.user);
  const token = useAuth((s) => s.token);
  const restaurant = useRestaurant((s) => s.restaurant);
  const loading = useRestaurant((s) => s.loading);
  const fetchRestaurant = useRestaurant((s) => s.fetchRestaurant);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!authHydrated) return;
    if (!token && !hasStoredSession()) {
      router.replace("/");
      return;
    }
    void fetchRestaurant(true).finally(() => setReady(true));
  }, [authHydrated, token, router, fetchRestaurant]);

  useEffect(() => {
    if (!authHydrated || !user) return;
    if (!canAccessOnboarding(user)) {
      router.replace(getHomeRouteForUser(user));
    }
  }, [authHydrated, user, router]);

  useEffect(() => {
    if (!ready || loading) return;
    if (!canAccessOnboarding(user)) return;
    if (restaurant?.id && !isReplay) {
      router.replace("/dashboard");
    }
  }, [ready, loading, restaurant, router, isReplay, user]);

  if (!authHydrated || !ready || loading || !canAccessOnboarding(user)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (restaurant?.id && !isReplay) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  const restaurantId = user?.restaurant_id ?? restaurant?.id ?? null;

  return (
    <OnboardingWizard
      initialEmail={user?.email || ""}
      replay={isReplay && Boolean(restaurantId)}
      restaurantId={restaurantId}
      initialRestaurant={restaurant}
    />
  );
}
