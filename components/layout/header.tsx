"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  User,
  Menu,
  LogOut,
  Store,
  ClipboardList,
  ChefHat,
  DollarSign,
  ArrowLeft,
  Zap,
  Download,
} from "lucide-react";
import { DESKTOP_APP_DOWNLOAD_URL } from "@/lib/desktop-download";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { ModeToggle } from "@/components/mode-toggle";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useRestaurant } from "@/hooks/use-restaurant";
import { useEffect, useState, useCallback } from "react";
import { useSidebarItems } from "@/hooks/use-sidebar-items";
import { cn, getImageUrl } from "@/lib/utils";
import {
  useNotifications,
  useNotificationStore,
} from "@/hooks/use-notifications";
import { NotificationPanel } from "@/components/notifications/notification-panel";
import apiClient from "@/lib/api-client";
import { DashboardApis } from "@/lib/api/endpoints";
import { hasPermission } from "@/lib/role-permissions";

import { memo } from "react";
import { MOBILE_APP_BAR_TITLE_EVENT } from "@/components/layout/mobile-app-bar-title";

function formatRoleLabel(role: string) {
  return role.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function getVisibleRoleLabels(
  user: { role?: string | null; roles?: string[] | null } | null | undefined,
) {
  const rawRoles = (user?.roles || []).filter(
    (role) => role && !role.startsWith("__user_"),
  );
  const normalized = Array.from(
    new Set(rawRoles.map((role) => role.toLowerCase())),
  );

  const platformOnly = normalized.filter(
    (role) => role === "platform_staff" || role === "superadmin",
  );
  const restaurantRoles = normalized.filter(
    (role) => role !== "platform_staff" && role !== "superadmin",
  );

  const effective = restaurantRoles.length ? restaurantRoles : platformOnly;
  if (effective.length) return effective.map(formatRoleLabel).join(", ");

  return formatRoleLabel(user?.role || "Manager");
}

function mobileAppBarTitle(pathname: string) {
  if (pathname === "/dashboard") return "Yummy";

  if (/^\/orders\/\d+\/checkout/.test(pathname)) return "Checkout";
  if (/^\/orders\/\d+\/receipt/.test(pathname)) return "Receipt";
  if (/^\/orders\/\d+\/add-items/.test(pathname)) return "Add items";
  if (/^\/orders\/\d+/.test(pathname)) return "Order";

  const titles: Array<[string, string]> = [
    ["/orders/new", "New order"],
    ["/orders/history", "Order history"],
    ["/orders", "Orders"],
    ["/analytics", "Analytics"],
    ["/manage/additional-settings", "Additional settings"],
    ["/manage/audit-logs", "Audit logs"],
    ["/manage/receipt-designer", "Receipt designer"],
    ["/manage/kot-designer", "KOT designer"],
    ["/manage/taxes", "Taxes & fees"],
    ["/manage/settings", "System settings"],
    ["/manage/roles", "Roles"],
    ["/manage/profile", "Profile"],
    ["/manage", "Manage"],
    ["/finance/purchases/returns", "Purchase returns"],
    ["/finance/purchases", "Purchases"],
    ["/finance/sales/returns", "Sales returns"],
    ["/finance/reports/department-breakdown", "Department performance"],
    ["/finance/reports/custody-reconciliation", "Custody reconciliation"],
    ["/finance/reports/party-balances", "Party balances"],
    ["/finance/reports/account-ledger", "Account ledger"],
    ["/finance/reports/profit-and-loss", "Profit & Loss"],
    ["/finance/reports/balance-sheet", "Balance sheet"],
    ["/finance/reports/trial-balance", "Trial balance"],
    ["/finance/reports/head-activity", "Account activity"],
    ["/finance/reports/vat-sales", "VAT sales"],
    ["/finance/reports/cash-flow", "Cash flow"],
    ["/finance/reports/refunds", "Refunds"],
    ["/finance/reports/daybook", "Daybook"],
    ["/finance/reports", "Reports"],
    ["/finance/accounting/opening-balances", "Opening balances"],
    ["/finance/accounting/ledger-mapping", "Ledger mapping"],
    ["/finance/accounting/settlements", "Settlement reconciliation"],
    ["/finance/accounting/period-reports", "Period reports"],
    ["/finance/accounting/trial-balance", "Trial balance"],
    ["/finance/accounting/balance-sheet", "Balance sheet"],
    ["/finance/accounting/profit-loss", "Profit and loss"],
    ["/finance/accounting/customer-ledger", "Customer ledger"],
    ["/finance/accounting/supplier-ledger", "Supplier ledger"],
    ["/finance/accounting/general-ledger", "General ledger"],
    ["/finance/accounting/day-closes", "Day close review"],
    ["/finance/accounting/vouchers", "Journal vouchers"],
    ["/finance/accounting/inventory", "Inventory accounting"],
    ["/finance/accounting/periods", "Accounting periods"],
    ["/finance/accounting/vat-export", "VAT export"],
    ["/finance/accounting/ap-aging", "Payables aging"],
    ["/finance/accounting/ar-aging", "Receivables aging"],
    ["/finance/accounting/setup", "Accounting setup"],
    ["/finance/other-income", "Other income"],
    ["/finance/transactions", "Transactions"],
    ["/finance/journals", "Journal vouchers"],
    ["/finance/operations", "Cash & banks"],
    ["/finance/heads", "Chart of accounts"],
    ["/finance/payments", "Payments"],
    ["/finance/expenses", "Expenses"],
    ["/finance/sales", "Sales"],
    ["/finance/setup", "Finance setup"],
    ["/cash-drawers", "Cash drawers"],
    ["/day-close", "Day close"],
    ["/finance", "Finance"],
    ["/inventory/purchases", "Purchases"],
    ["/inventory", "Inventory"],
    ["/customers", "Customers"],
    ["/suppliers", "Suppliers"],
    ["/workforce", "Workforce"],
    ["/premium", "Plans"],
  ];

  const matchedTitle = titles.find(([path]) => pathname.startsWith(path))?.[1];
  if (matchedTitle) return matchedTitle;

  const lastSegment = pathname.split("/").filter(Boolean).at(-1);
  return lastSegment
    ? lastSegment
        .replace(/[-_]+/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase())
    : "Yummy";
}

function mobileAppBarBackHref(pathname: string) {
  const orderChild = pathname.match(
    /^\/orders\/(\d+)\/(?:checkout|receipt|add-items)/,
  );
  if (orderChild) return `/orders/${orderChild[1]}`;
  if (/^\/orders\/(?:new|history|\d+)/.test(pathname)) return "/orders";

  if (pathname.startsWith("/inventory/purchases")) return "/inventory";
  if (pathname.startsWith("/finance/reports/")) return "/finance/reports";
  if (pathname.startsWith("/finance/sales/")) return "/finance/sales";
  if (pathname.startsWith("/finance/purchases/")) return "/finance/purchases";
  if (pathname.startsWith("/finance/accounting/")) return "/finance/reports";
  if (pathname === "/finance/heads") return "/finance/setup";
  if (pathname.startsWith("/finance/")) return "/finance";
  if (pathname.startsWith("/manage/") && pathname !== "/manage/profile")
    return "/manage/profile";
  if (pathname.startsWith("/customers/")) return "/customers";
  if (pathname.startsWith("/suppliers/")) return "/suppliers";
  if (pathname.startsWith("/workforce/")) return "/workforce";

  return "/dashboard";
}

function hasMobileAppBarBack(pathname: string) {
  return ![
    "/dashboard",
    "/orders",
    "/analytics",
    "/manage",
    "/manage/profile",
  ].includes(pathname);
}

const LiveStats = memo(function LiveStats() {
  const user = useAuth((state) => state.user);
  const restaurant = useRestaurant((state) => state.restaurant);
  const [stats, setStats] = useState<{
    activeOrders: number;
    kotPending: number;
    todaySales: number;
  } | null>(null);

  const canViewAnalytics = hasPermission(user, "reports.analytics.view");

  const fetchStats = useCallback(async () => {
    if (!user?.restaurant_id) return;
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await apiClient.get(
        DashboardApis.dashboardDataV2({
          restaurantId: user.restaurant_id,
          businessLine:
            restaurant?.hotel_enabled && restaurant?.restaurant_enabled
              ? "all"
              : restaurant?.hotel_enabled
                ? "hotel"
                : "restaurant",
          timezone,
        }),
      );
      if (res.data?.status === "success") {
        const d = res.data.data;
        const shiftPulse = d?.home?.shift_pulse;
        const cashWatch = d?.home?.cash_watch;
        setStats({
          activeOrders:
            shiftPulse?.active_orders ?? d?.health?.active_orders ?? 0,
          kotPending: shiftPulse?.kot_pending ?? d?.health?.kot_pending ?? 0,
          todaySales:
            d?.kpis?.gross_sales ??
            (cashWatch?.cash_collected ?? 0) +
              (cashWatch?.digital_collected ?? 0) +
              (cashWatch?.credit_sales ?? 0),
        });
      }
    } catch {
      // silently fail — stats are non-critical
    }
  }, [
    restaurant?.hotel_enabled,
    restaurant?.restaurant_enabled,
    user?.restaurant_id,
  ]);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  if (!stats) return null;

  const currency = "Rs.";
  const formatSales = (n: number) => {
    if (n >= 100000) return `${(n / 1000).toFixed(0)}k`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return n.toLocaleString();
  };

  return (
    <div className="hidden md:flex items-center gap-2">
      <Link
        href="/orders"
        data-tour="navbar-stat-orders"
        className="flex items-center gap-2 px-3 py-1 rounded-md bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors"
      >
        <ClipboardList className="h-3.5 w-3.5 text-blue-500" />
        <span className="text-xs font-bold text-foreground">
          {stats.activeOrders}
        </span>
        <span className="text-[10px] text-muted-foreground uppercase font-black">
          orders
        </span>
      </Link>
      <Link
        href="/orders?tab=kot"
        data-tour="navbar-stat-kot"
        className="flex items-center gap-2 px-3 py-1 rounded-md bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors"
      >
        <ChefHat className="h-3.5 w-3.5 text-orange-500" />
        <span className="text-xs font-bold text-foreground">
          {stats.kotPending}
        </span>
        <span className="text-[10px] text-muted-foreground uppercase font-black">
          KOT
        </span>
      </Link>
      {canViewAnalytics && (
        <Link
          href="/analytics"
          data-tour="navbar-stat-sales"
          className="flex items-center gap-2 px-3 py-1 rounded-md bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors"
        >
          <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
          <span className="text-xs font-bold text-foreground">
            {currency} {formatSales(stats.todaySales)}
          </span>
          <span className="text-[10px] text-muted-foreground uppercase font-black">
            today
          </span>
        </Link>
      )}
    </div>
  );
});

const NotificationBell = memo(function NotificationBell() {
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const setPanelOpen = useNotificationStore((state) => state.setPanelOpen);

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative text-muted-foreground"
      data-tour="navbar-notifications"
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
  const user = useAuth((state) => state.user);
  const logout = useAuth((state) => state.logout);
  const restaurant = useRestaurant((s) => s.restaurant);
  const fetchRestaurant = useRestaurant((s) => s.fetchRestaurant);
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const sidebarItems = useSidebarItems();
  const identityRoles = [
    user?.role,
    user?.primary_role,
    ...(user?.roles || []),
  ].map((role) =>
    String(role || "")
      .trim()
      .toLowerCase(),
  );
  const isPlatformIdentity = identityRoles.some((role) =>
    ["superadmin", "super_admin", "platform_staff"].includes(role),
  );
  const canLeaveRestaurant = Boolean(restaurant?.id) && !isPlatformIdentity;
  const appBarTitle =
    pathname === "/dashboard"
      ? restaurant?.name || "Yummy"
      : mobileAppBarTitle(pathname);
  const isDashboard = pathname === "/dashboard";
  const showMobileBack = hasMobileAppBarBack(pathname);
  const [contextualTitle, setContextualTitle] = useState<string | null>(null);

  const [isFromManage, setIsFromManage] = useState(false);

  useEffect(() => {
    if (!restaurant) {
      fetchRestaurant();
    }
  }, [restaurant, fetchRestaurant]);

  useEffect(() => {
    setContextualTitle(
      document.documentElement.dataset.mobileAppBarTitle || null,
    );
  }, [pathname]);

  useEffect(() => {
    const setTitle = (event: Event) => {
      setContextualTitle((event as CustomEvent<string | null>).detail || null);
    };
    window.addEventListener(MOBILE_APP_BAR_TITLE_EVENT, setTitle);
    setContextualTitle(
      document.documentElement.dataset.mobileAppBarTitle || null,
    );
    return () =>
      window.removeEventListener(MOBILE_APP_BAR_TITLE_EVENT, setTitle);
  }, []);

  const displayedAppBarTitle = contextualTitle || appBarTitle;

  useEffect(() => {
    const checkFromManage = () => {
      const fromManage = sessionStorage.getItem("fromManage") === "true";
      setIsFromManage(fromManage && pathname !== "/manage");
    };

    checkFromManage();
    // Also listen for storage events in case of multiple tabs (though less likely for this use case)
    window.addEventListener("storage", checkFromManage);
    return () => window.removeEventListener("storage", checkFromManage);
  }, [pathname]);

  const handleBackToManage = () => {
    sessionStorage.removeItem("fromManage");
    setIsFromManage(false);
  };

  return (
    <header
      data-tour="navbar"
      className="flex h-16 items-center gap-4 border-b bg-background px-4 sm:px-6"
    >
      {isDashboard ? (
        <Link
          href="/dashboard"
          className="flex min-w-0 items-center gap-2 text-sm font-semibold tracking-tight text-foreground md:hidden"
        >
          <span className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-primary/10 text-primary">
            {restaurant?.profile_picture ? (
              <Image
                src={getImageUrl(restaurant.profile_picture)}
                alt=""
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <Store className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </span>
          <span className="truncate">{displayedAppBarTitle}</span>
        </Link>
      ) : showMobileBack ? (
        <div className="flex min-w-0 items-center gap-1 md:hidden">
          <Button
            variant="ghost"
            size="icon"
            className="-ml-2 h-9 w-9 shrink-0 rounded-lg"
            onClick={() => router.push(mobileAppBarBackHref(pathname))}
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Back</span>
          </Button>
          <p className="min-w-0 truncate text-sm font-semibold tracking-tight text-foreground">
            {displayedAppBarTitle}
          </p>
        </div>
      ) : (
        <p className="min-w-0 truncate text-sm font-semibold tracking-tight text-foreground md:hidden">
          {displayedAppBarTitle}
        </p>
      )}

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
      </div>
      <div className="flex-1" />

      <div className="flex items-center gap-1">
        {/* Mobile Menu (hamburger on the right) */}
        <div className="hidden">
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
                          : "text-muted-foreground",
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                      <span className="text-base font-medium">
                        {item.title}
                      </span>
                    </Link>
                  ))}
                </nav>
              </div>
              <div className="border-t p-4">
                {canLeaveRestaurant && (
                  <Link
                    href="/leave-restaurant"
                    onClick={() => setOpen(false)}
                    className="mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-base font-medium text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
                  >
                    <Store className="h-5 w-5" />
                    Leave restaurant
                  </Link>
                )}
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
          <Button
            variant="ghost"
            size="icon"
            asChild
            className="hidden h-8 w-8 text-muted-foreground hover:text-primary sm:inline-flex"
            data-tour="navbar-download"
          >
            <a
              href={DESKTOP_APP_DOWNLOAD_URL}
              target="_blank"
              rel="noopener noreferrer"
              title="Download Yummy POS for Windows"
            >
              <Download className="h-4 w-4" />
              <span className="sr-only">Download desktop app</span>
            </a>
          </Button>

          {/* Subscription catalog shortcut */}
          {isDashboard ? (
            <>
              <Button
                variant="outline"
                size="sm"
                asChild
                data-tour="navbar-premium"
                className="group relative inline-flex h-8 items-center gap-1.5 rounded-full border-amber-500/30 bg-amber-500/5 px-3 text-xs font-semibold text-amber-600 transition-colors hover:bg-amber-500/10 dark:text-amber-500 sm:px-4"
              >
                <Link href="/premium">
                  <Zap className="h-3.5 w-3.5 fill-current" />
                  <span>Plans</span>
                </Link>
              </Button>
              <NotificationBell />
              <NotificationPanel />
            </>
          ) : null}
          <div className="hidden sm:block" data-tour="navbar-theme">
            <ModeToggle />
          </div>
        </div>

        <div className="h-6 w-px bg-border mx-1 hidden md:block" />
        <div
          className="hidden items-center gap-2 pl-1 sm:flex"
          data-tour="navbar-user"
        >
          {canLeaveRestaurant && (
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="hidden text-muted-foreground md:inline-flex"
            >
              <Link href="/leave-restaurant">Leave restaurant</Link>
            </Button>
          )}
          <div className="relative h-8 w-8 min-w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary overflow-hidden border border-border/50">
            {restaurant?.profile_picture ? (
              <Image
                src={getImageUrl(restaurant.profile_picture)}
                alt="Profile"
                className="object-cover"
                fill
                unoptimized
              />
            ) : user?.full_name && !user.full_name.includes("@") ? (
              <span className="text-xs font-bold">
                {user.full_name.charAt(0).toUpperCase()}
              </span>
            ) : (
              <User className="h-5 w-5" />
            )}
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-medium leading-tight">
              {user?.full_name && !user.full_name.includes("@")
                ? user.full_name
                : "Admin User"}
            </p>
            <p className="text-xs text-muted-foreground leading-tight">
              {getVisibleRoleLabels(user)}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
});
