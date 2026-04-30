"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { RoleGuard } from "@/components/auth/role-guard";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useRestaurant } from "@/hooks/use-restaurant";

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
  const router = useRouter();
  const pathname = usePathname() || "";
  const [mounted, setMounted] = useState(false);

  // Keep the server render and the first client render identical to prevent hydration mismatches.
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    fetchRestaurant();
  }, [fetchRestaurant, mounted]);

  useEffect(() => {
    if (!mounted) return;
    if (loading || !restaurant) return;

    const hotelEnabled = restaurant.hotel_enabled;
    const restEnabled = restaurant.restaurant_enabled;
    const bothEnabled = hotelEnabled && restEnabled;

    // --- Dual Mode ---
    if (bothEnabled) {
      // No module chosen → go to standalone gateway for selection
      if (!selectedModule) {
        router.replace("/gateway");
        return;
      }
      return; // Module is chosen, render normally
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
  }, [restaurant, selectedModule, pathname, router, setSelectedModule, loading, mounted]);

  if (!mounted || loading || !restaurant) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
    </div>
  );
}
