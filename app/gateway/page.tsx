"use client";

import { useRestaurant } from "@/hooks/use-restaurant";
import { useRouter } from "next/navigation";
import { UtensilsCrossed, Bed, ArrowRight, LogOut, ChevronRight } from "lucide-react";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";

export default function GatewayPage() {
  const { restaurant, setSelectedModule, fetchRestaurant, loading } = useRestaurant();
  const router = useRouter();
  const logout = useAuth((state) => state.logout);

  useEffect(() => {
    fetchRestaurant();
  }, [fetchRestaurant]);

  useEffect(() => {
    if (loading || !restaurant) return;

    // Auto-redirect if only one module is enabled
    if (restaurant.hotel_enabled && !restaurant.restaurant_enabled) {
      setSelectedModule("hotel");
      router.replace("/rooms");
      return;
    }
    if (!restaurant.hotel_enabled && restaurant.restaurant_enabled) {
      setSelectedModule("restaurant");
      router.replace("/dashboard");
      return;
    }
    // If neither enabled, still let them see gateway (edge case)
  }, [restaurant, loading, router, setSelectedModule]);

  const handleSelect = (module: "restaurant" | "hotel") => {
    setSelectedModule(module);
    if (module === "restaurant") {
      router.push("/dashboard");
    } else {
      router.push("/rooms");
    }
  };

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  if (loading || !restaurant) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
          <p className="text-sm text-muted-foreground">Loading workspace…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Bar */}
      <header className="flex items-center justify-between px-6 py-4 border-b bg-card/50 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <span className="text-primary font-bold text-sm">Y</span>
          </div>
          <span className="font-semibold text-foreground">{restaurant.name}</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-red-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        {/* Heading */}
        <div className="text-center mb-14 space-y-3">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider mb-2">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            Connected
          </div>
          <h1 className="text-5xl font-bold tracking-tight text-foreground">
            Welcome back
          </h1>
          <p className="text-lg text-muted-foreground max-w-md mx-auto">
            Choose your workspace to get started
          </p>
        </div>

        {/* Module Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
          {/* Restaurant Card */}
          {restaurant.restaurant_enabled && (
            <button
              onClick={() => handleSelect("restaurant")}
              className="group relative flex flex-col items-start p-8 bg-card border-2 border-border hover:border-orange-400 rounded-2xl transition-all duration-300 hover:shadow-xl hover:-translate-y-1 text-left overflow-hidden"
            >
              {/* Accent bar */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-400 to-amber-500 scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left rounded-t-2xl" />

              {/* Background glow */}
              <div className="absolute bottom-0 right-0 w-48 h-48 bg-orange-500/5 rounded-full translate-x-1/4 translate-y-1/4 group-hover:scale-150 transition-transform duration-700" />

              <div className="relative">
                <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                  <UtensilsCrossed className="w-8 h-8 text-orange-600 dark:text-orange-400" />
                </div>

                <h2 className="text-2xl font-bold text-foreground mb-2">Restaurant POS</h2>
                <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                  Manage dining orders, KOT, tables, menu, and restaurant analytics.
                </p>

                <div className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400 font-semibold text-sm">
                  Enter Restaurant
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </button>
          )}

          {/* Hotel Card */}
          {restaurant.hotel_enabled && (
            <button
              onClick={() => handleSelect("hotel")}
              className="group relative flex flex-col items-start p-8 bg-card border-2 border-border hover:border-blue-400 rounded-2xl transition-all duration-300 hover:shadow-xl hover:-translate-y-1 text-left overflow-hidden"
            >
              {/* Accent bar */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500 scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left rounded-t-2xl" />

              {/* Background glow */}
              <div className="absolute bottom-0 right-0 w-48 h-48 bg-blue-500/5 rounded-full translate-x-1/4 translate-y-1/4 group-hover:scale-150 transition-transform duration-700" />

              <div className="relative">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                  <Bed className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>

                <h2 className="text-2xl font-bold text-foreground mb-2">Hotel Management</h2>
                <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                  Manage room folios, check-ins, check-outs, housekeeping, and hotel analytics.
                </p>

                <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-semibold text-sm">
                  Enter Hotel
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </button>
          )}
        </div>

        <p className="mt-12 text-xs text-muted-foreground text-center">
          You can switch module at any time from the sidebar
        </p>
      </div>
    </div>
  );
}
