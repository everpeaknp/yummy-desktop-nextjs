"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { RoleGuard } from "@/components/auth/role-guard";
import { GlobalKotPrinter } from "@/components/receipts/global-kot-printer";
import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth, useAuthHydrated } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";
import { usePermissionsSync } from "@/hooks/use-permissions-sync";
import { hasStoredSession } from "@/lib/auth-storage";
import { useSessionRestoreState } from "@/hooks/use-session-restore";
import { ProductTourHost } from "@/components/onboarding/product-tour-host";
import { canAccessOnboarding } from "@/lib/onboarding";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // NOTE: Selecting individual fields avoids returning a new object snapshot each time,
  // which can trigger `useSyncExternalStore` infinite-loop warnings in React 18.
  const restaurant = useRestaurant((s) => s.restaurant);
  const selectedModule = useRestaurant((s) => s.selectedModule);
  const setSelectedModule = useRestaurant((s) => s.setSelectedModule);
  const fetchRestaurant = useRestaurant((s) => s.fetchRestaurant);
  const loading = useRestaurant((s) => s.loading);
  const user = useAuth((s) => s.user);
  const token = useAuth((s) => s.token);
  const meLoading = useAuth((s) => s.meLoading);
  const authHydrated = useAuthHydrated();
  const sessionRestore = useSessionRestoreState();
  const router = useRouter();
  const pathname = usePathname() || "";
  const [mounted, setMounted] = useState(false);
  const [storeHydrated, setStoreHydrated] = useState(false);
  const gatewayRedirectedRef = useRef(false);

  usePermissionsSync();

  useEffect(() => {
    const persist = useRestaurant.persist;
    if (!persist) {
      setStoreHydrated(true);
      return;
    }
    if (persist.hasHydrated()) {
      setStoreHydrated(true);
      return;
    }
    return persist.onFinishHydration(() => setStoreHydrated(true));
  }, []);

  // Keep the server render and the first client render identical to prevent hydration mismatches.
  useEffect(() => {
    setMounted(true);
  }, []);

  const storedSession = hasStoredSession();
  const waitingForAuth =
    !authHydrated ||
    meLoading ||
    sessionRestore.inFlight ||
    (storedSession && !sessionRestore.finished) ||
    ((token || storedSession) && !user);

  useEffect(() => {
    if (!mounted || waitingForAuth || !token || !user) return;
    void fetchRestaurant();
  }, [fetchRestaurant, mounted, token, user, waitingForAuth]);

  useEffect(() => {
    if (!mounted || !storeHydrated) return;
    if (loading || restaurant) return;

    if (canAccessOnboarding(user)) {
      router.replace("/onboarding");
    }
  }, [mounted, storeHydrated, loading, restaurant, user, router]);

  useEffect(() => {
    if (!mounted || !storeHydrated) return;
    if (loading || !restaurant) return;
    if (gatewayRedirectedRef.current) return;

    const hotelEnabled = restaurant.hotel_enabled;
    const restEnabled = restaurant.restaurant_enabled;
    const bothEnabled = hotelEnabled && restEnabled;

    // --- Dual Mode ---
    if (bothEnabled) {
      if (!selectedModule) {
        gatewayRedirectedRef.current = true;
        router.replace("/gateway");
        return;
      }
      return;
    }

    // --- Hotel Only ---
    if (hotelEnabled && !restEnabled) {
      if (selectedModule !== "hotel") setSelectedModule("hotel");
      // Redirect away from restaurant-only pages
      if (["/dashboard", "/gateway"].includes(pathname)) {
        router.replace("/rooms");
      }
      return;
    }

    // --- Restaurant Only (or default) ---
    if (selectedModule !== "restaurant") setSelectedModule("restaurant");
    // Redirect away from hotel-only / gateway pages
    if (["/rooms", "/gateway"].includes(pathname)) {
      router.replace("/dashboard");
    }
  }, [
    restaurant,
    selectedModule,
    pathname,
    router,
    setSelectedModule,
    loading,
    mounted,
    storeHydrated,
  ]);

  const showShell = mounted && !waitingForAuth && (restaurant || !loading);

  if (!mounted) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!showShell) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!restaurant) {
    if (canAccessOnboarding(user)) {
      return (
        <div className="flex h-screen items-center justify-center bg-background">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      );
    }

    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Could not load your restaurant profile. Check your connection and try again.
        </p>
        <button
          type="button"
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          onClick={() => void fetchRestaurant(true)}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col bg-background md:flex-row overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 h-full overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-4">
          <RoleGuard>{children}</RoleGuard>
        </main>
      </div>
      <GlobalKotPrinter />
      <Suspense fallback={null}>
        <ProductTourHost />
      </Suspense>
    </div>
  );
}
