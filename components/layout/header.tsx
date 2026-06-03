"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Bell, User, Menu, LogOut, Store, ClipboardList, ChefHat, DollarSign, ArrowLeft, Settings, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { ModeToggle } from "@/components/mode-toggle";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useRestaurant } from "@/hooks/use-restaurant";
import { useEffect, useState } from "react";
import { useSidebarItems } from "@/hooks/use-sidebar-items";
import { cn, getImageUrl } from "@/lib/utils";
import { useNotifications, useNotificationStore } from "@/hooks/use-notifications";
import { NotificationPanel } from "@/components/notifications/notification-panel";
import { useDashboardHomeStore } from "@/stores/dashboard-home-store";
import { ModuleSwitcher } from "./module-switcher";
import { hasPermission } from "@/lib/role-permissions";

import { memo } from "react";

const LiveStats = memo(function LiveStats() {
  const user = useAuth(state => state.user);
  const restaurant = useRestaurant(state => state.restaurant);
  const selectedModule = useRestaurant(state => state.selectedModule);
  const dashboardHome = useDashboardHomeStore(state => state.dashboardHome);
  const fetchDashboard = useDashboardHomeStore(state => state.fetchDashboard);
  const pollDelta = useDashboardHomeStore(state => state.pollDelta);

  useEffect(() => {
    if (!user?.restaurant_id || dashboardHome) return;
    const timezone =
      restaurant?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    fetchDashboard({
      restaurantId: user.restaurant_id,
      timezone,
      businessLine: selectedModule ?? undefined,
      activeRange: "today",
    });
  }, [user?.restaurant_id, restaurant?.timezone, selectedModule, dashboardHome, fetchDashboard]);

  useEffect(() => {
    if (!user?.restaurant_id || !dashboardHome) return;
    const interval = setInterval(() => pollDelta(), 30000);
    return () => clearInterval(interval);
  }, [user?.restaurant_id, dashboardHome, pollDelta]);

  const shiftPulse = dashboardHome?.shift_pulse;
  const cashWatch = dashboardHome?.cash_watch;

  if (!shiftPulse?.available && !cashWatch?.available) return null;

  const activeOrders = shiftPulse?.available ? shiftPulse.active_orders : 0;
  const kotPending = shiftPulse?.available ? shiftPulse.kot_pending : 0;
  const todaySales =
    cashWatch?.available
      ? cashWatch.cash_collected + cashWatch.digital_collected + cashWatch.credit_sales
      : 0;

  const canViewAnalytics = hasPermission(user, "reports.analytics.view");
  const currency = "Rs.";
  const formatSales = (n: number) => {
    if (n >= 100000) return `${(n / 1000).toFixed(0)}k`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return n.toLocaleString();
  };

  return (
    <div className="hidden md:flex items-center gap-2">
      <Link
        href="/orders/active"
        className="flex items-center gap-2 px-3 py-1 rounded-md bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors"
      >
        <ClipboardList className="h-3.5 w-3.5 text-blue-500" />
        <span className="text-xs font-bold text-foreground">{activeOrders}</span>
        <span className="text-[10px] text-muted-foreground uppercase font-black">orders</span>
      </Link>
      <Link
        href="/kitchen"
        className="flex items-center gap-2 px-3 py-1 rounded-md bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors"
      >
        <ChefHat className="h-3.5 w-3.5 text-orange-500" />
        <span className="text-xs font-bold text-foreground">{kotPending}</span>
        <span className="text-[10px] text-muted-foreground uppercase font-black">KOT</span>
      </Link>
      {canViewAnalytics && (
        <Link
          href="/analytics"
          className="flex items-center gap-2 px-3 py-1 rounded-md bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors"
        >
          <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
          <span className="text-xs font-bold text-foreground">{currency} {formatSales(todaySales)}</span>
          <span className="text-[10px] text-muted-foreground uppercase font-black">today</span>
        </Link>
      )}
    </div>
  );
});

const NotificationBell = memo(function NotificationBell() {
    const unreadCount = useNotificationStore(state => state.unreadCount);
    const setPanelOpen = useNotificationStore(state => state.setPanelOpen);

    return (
    <Button
      variant="ghost"
      size="icon"
      className="relative text-muted-foreground"
      onClick={() => setPanelOpen(true)}
    >
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
      <span className="sr-only">Notifications</span>
    </Button>
  );
});

export const Header = memo(function Header() {
  const user = useAuth(state => state.user);
  const logout = useAuth(state => state.logout);
  const restaurant = useRestaurant((s) => s.restaurant);
  const fetchRestaurant = useRestaurant((s) => s.fetchRestaurant);
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const sidebarItems = useSidebarItems();

  const [isFromManage, setIsFromManage] = useState(false);

  useEffect(() => {
    if (!restaurant) {
      fetchRestaurant();
    }
  }, [restaurant, fetchRestaurant]);

  useEffect(() => {
    const checkFromManage = () => {
      const fromManage = sessionStorage.getItem('fromManage') === 'true';
      setIsFromManage(fromManage && pathname !== '/manage');
    };

    checkFromManage();
    // Also listen for storage events in case of multiple tabs (though less likely for this use case)
    window.addEventListener('storage', checkFromManage);
    return () => window.removeEventListener('storage', checkFromManage);
  }, [pathname]);

  const handleBackToManage = () => {
    sessionStorage.removeItem('fromManage');
    setIsFromManage(false);
  };

  return (
    <header className="flex h-16 items-center gap-4 border-b bg-background px-4 sm:px-6">

      {/* Live stats — active orders, KOT pending, today's sales */}
      <div className="flex items-center gap-4">
        {isFromManage && (
            <Button
                variant="outline"
                size="sm"
                asChild
                className="h-8 px-2 gap-1.5 text-xs font-semibold hover:bg-primary/10 hover:text-primary bg-muted/30 border-dashed"
                onClick={handleBackToManage}
            >
                <Link href="/manage">
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to Manage
                </Link>
            </Button>
        )}
        <LiveStats />
        <ModuleSwitcher />
      </div>
      <div className="flex-1" />

      <div className="flex items-center gap-1">
        {/* Mobile Menu (hamburger on the right) */}
        <div className="md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="flex flex-col p-0 w-[280px]">
              <div className="flex h-16 items-center border-b px-6">
                <Link
                  href="/dashboard"
                  className="flex items-center gap-2 font-bold text-lg"
                  onClick={() => {
                    setOpen(false);
                    sessionStorage.removeItem("fromManage");
                  }}
                >
                  <div className="relative h-8 w-8 min-w-8 flex items-center justify-center">
                    {restaurant?.profile_picture ? (
                      <Image
                        src={getImageUrl(restaurant.profile_picture)}
                        alt="Logo"
                        className="object-cover rounded-md"
                        fill
                        priority
                        unoptimized
                      />
                    ) : (
                      <div className="bg-primary/10 p-1.5 rounded-md">
                        <Store className="h-full w-full text-primary" />
                      </div>
                    )}
                  </div>
                  <span className="text-primary truncate">
                    {restaurant?.name || "Yummy Kitchen"}
                  </span>
                </Link>
              </div>
              <div className="flex-1 overflow-y-auto py-4">
                <nav className="grid items-start px-4 text-sm font-medium gap-2">
                  {sidebarItems.map((item, index) => (
                    <Link
                      key={index}
                      href={item.href}
                      onClick={() => {
                        setOpen(false);
                        sessionStorage.removeItem("fromManage");
                      }}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary",
                        pathname === item.href ||
                          (pathname && pathname.startsWith(item.href + "/"))
                          ? "bg-muted text-primary"
                          : "text-muted-foreground"
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                      <span className="text-base font-medium">{item.title}</span>
                    </Link>
                  ))}
                </nav>
              </div>
              <div className="border-t p-4">
                <button
                  onClick={() => {
                    logout();
                    router.push("/");
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-base font-medium text-red-600 dark:text-red-400 transition-all hover:bg-destructive/10"
                >
                  <LogOut className="h-5 w-5" />
                  Logout
                </button>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {/* Go Premium Navbar Button */}
          {((user?.role?.toLowerCase() === "admin" || user?.role?.toLowerCase() === "manager" || 
            user?.roles?.some(r => ["admin", "manager"].includes(r.toLowerCase()))) || true) && (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="group relative flex items-center gap-1.5 px-4 h-8 bg-amber-500/5 hover:bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-500 font-bold text-[10px] uppercase tracking-wider rounded-full overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98] mr-1"
            >
              <Link href="/premium">
                <Zap className="h-3.5 w-3.5 fill-current animate-pulse group-hover:animate-none" />
                <span>Premium</span>
              </Link>
            </Button>
          )}

          <NotificationBell />
          <NotificationPanel />
          <ModeToggle />
        </div>

        <div className="h-6 w-px bg-border mx-1 hidden md:block" />
        <div className="flex items-center gap-2 pl-1">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary overflow-hidden">
            {user?.full_name ? (
              <span className="text-xs font-bold">{user.full_name.charAt(0).toUpperCase()}</span>
            ) : (
              <User className="h-5 w-5" />
            )}
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-medium leading-tight">{user?.full_name || "Admin User"}</p>
            <p className="text-xs text-muted-foreground capitalize leading-tight">{user?.roles?.length ? user.roles.join(", ") : user?.role || "Manager"}</p>
          </div>
        </div>
      </div>
    </header>
  );
});
