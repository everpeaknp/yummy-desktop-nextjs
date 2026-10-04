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
  Settings2,
  MoreHorizontal,
  Zap,
  Download,
  HelpCircle,
} from "lucide-react";
import { DESKTOP_APP_DOWNLOAD_URL } from "@/lib/desktop-download";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { ModeToggle } from "@/components/mode-toggle";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useRestaurant } from "@/hooks/use-restaurant";
import { useEffect, useState, useCallback } from "react";
import { useSidebarItems } from "@/hooks/use-sidebar-items";
import {
  getMobileRoutePresentation,
  isMobileSecondaryModuleRoute,
  shouldMobileBottomNavBeVisible,
} from "@/lib/mobile-module-navigation";
import { getSettingsRouteOwnership } from "@/lib/settings-navigation";
import { cn, getImageUrl } from "@/lib/utils";
import {
  useNotifications,
  useNotificationStore,
} from "@/hooks/use-notifications";
import { NotificationPanel } from "@/components/notifications/notification-panel";
import apiClient from "@/lib/api-client";
import { LiveStats } from "@/components/layout/live-stats";
import { getHomeRouteForUser, isPathAccessible, hasPermission } from "@/lib/role-permissions";

import { memo } from "react";
import {
  MOBILE_APP_BAR_ACTIONS_EVENT,
  MOBILE_APP_BAR_TITLE_EVENT,
  type MobileAppBarAction,
} from "@/components/layout/mobile-app-bar-title";
import { MobileAppBar } from "@/components/patterns/navigation/mobile-app-bar";
import { HelpCenterDialog } from "@/components/onboarding/help-center-dialog";

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

function mobileAppBarBackHref(pathname: string) {
  const orderChild = pathname.match(
    /^\/orders\/(\d+)\/(?:checkout|receipt|add-items)/,
  );
  if (orderChild) return `/orders/${orderChild[1]}`;
  if (/^\/orders\/(?:new|history|\d+)/.test(pathname)) return "/orders";

  if (pathname.startsWith("/inventory/purchases")) return "/inventory";
  if (
    pathname.startsWith("/menu/items") ||
    pathname.startsWith("/menu/categories") ||
    pathname.startsWith("/menu/modifiers") ||
    pathname.startsWith("/discounts")
  )
    return "/manage";
  if (pathname.startsWith("/finance/reports/")) return "/finance/reports";
  if (pathname.startsWith("/finance/sales/")) return "/finance/sales";
  if (pathname.startsWith("/finance/purchases/")) return "/finance/purchases";
  if (pathname.startsWith("/finance/accounting/")) return "/finance/reports";
  if (pathname === "/finance/heads") return "/finance/setup";
  if (pathname === "/finance") return null;
  if (pathname.startsWith("/finance/")) return "/finance";
  if (pathname.startsWith("/manage/")) return "/manage";
  if (pathname.startsWith("/customers/")) return "/customers";
  if (pathname.startsWith("/suppliers/")) return "/suppliers";
  if (pathname.startsWith("/workforce/")) return "/workforce";

  return "/dashboard";
}

function hasMobileAppBarBack(pathname: string) {
  return !shouldMobileBottomNavBeVisible(pathname);
}


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
  const [helpOpen, setHelpOpen] = useState(false);
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
      : getMobileRoutePresentation(pathname).title;
  const isDashboard = pathname === "/dashboard";
  const showMobileBack = hasMobileAppBarBack(pathname);
  const mobilePresentation = getMobileRoutePresentation(pathname);
  const [contextualTitle, setContextualTitle] = useState<string | null>(null);
  const [contextualActions, setContextualActions] = useState<
    MobileAppBarAction[]
  >([]);
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

  useEffect(() => {
    const setActions = (event: Event) => {
      setContextualActions(
        (event as CustomEvent<MobileAppBarAction[]>).detail || [],
      );
    };
    window.addEventListener(MOBILE_APP_BAR_ACTIONS_EVENT, setActions);
    return () =>
      window.removeEventListener(MOBILE_APP_BAR_ACTIONS_EVENT, setActions);
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
          href={getHomeRouteForUser(user)}
          className="flex min-w-0 items-center gap-2 text-sm font-semibold tracking-tight text-foreground lg:hidden"
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
      ) : (
        <MobileAppBar
          title={displayedAppBarTitle}
          navigation={mobilePresentation.navigationLevel}
          onBack={
            showMobileBack
              ? () => {
                  if (pathname === "/settings") {
                    router.push(isPathAccessible("/manage", user) ? "/manage" : getHomeRouteForUser(user));
                    return;
                  }
                  const settingsOwner = getSettingsRouteOwnership(pathname);
                  if (settingsOwner) {
                    router.push(isPathAccessible(settingsOwner.mobileBackTarget, user) ? settingsOwner.mobileBackTarget : getHomeRouteForUser(user));
                    return;
                  }
                  if (isMobileSecondaryModuleRoute(pathname || "")) {
                    router.back();
                    return;
                  }
                  const href = mobileAppBarBackHref(pathname);
                  if (href) router.push(isPathAccessible(href, user) ? href : getHomeRouteForUser(user));
                  else router.back();
                }
              : undefined
          }
          actions={
            contextualActions.length ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 rounded-xl"
                    aria-label="More actions"
                  >
                    <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {contextualActions.map((action) => (
                    <DropdownMenuItem
                      key={action.id}
                      disabled={action.disabled}
                      className={cn(
                        "min-h-11",
                        action.destructive && "text-destructive",
                      )}
                      onSelect={action.onSelect}
                    >
                      {action.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : pathname === "/cash-drawers" && isPathAccessible("/finance/operations", user) ? (
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="h-11 w-11 rounded-xl md:hidden"
                aria-label="Configure drawers"
                title="Configure drawers"
              >
                <Link href="/finance/operations?tab=cash-drawers">
                  <Settings2 className="h-5 w-5" aria-hidden="true" />
                </Link>
              </Button>
            ) : null
          }
          className="min-w-0"
        />
      )}

      {/* Live stats — active orders, KOT pending, today's sales */}
      <div className="flex items-center gap-4">
        {isFromManage && isPathAccessible("/manage", user) && (
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
                  href={getHomeRouteForUser(user)}
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
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-muted-foreground"
            aria-label="Help"
            title="Help and product tour"
            data-tour="navbar-help"
            onClick={() => setHelpOpen(true)}
          >
            <HelpCircle className="h-5 w-5" aria-hidden="true" />
          </Button>
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
              <Link href="/leave-restaurant" aria-label="Leave restaurant" title="Leave restaurant">
                <Store className="h-4 w-4 shrink-0 min-[2300px]:hidden" aria-hidden="true" />
                <span className="sr-only min-[2300px]:not-sr-only">Leave restaurant</span>
              </Link>
            </Button>
          )}
          <div className="relative h-8 w-8 min-w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary overflow-hidden border border-border/50">
            {user?.photo_url ? (
              <Image
                src={getImageUrl(user.photo_url)}
                alt={user.full_name || "Profile"}
                className="object-cover"
                fill
                unoptimized
              />
            ) : user?.full_name && !user.full_name.includes("@") ? (
              <span className="text-xs font-bold">
                {user.full_name.charAt(0).toUpperCase()}
              </span>
            ) : restaurant?.profile_picture ? (
              <Image
                src={getImageUrl(restaurant.profile_picture)}
                alt="Profile"
                className="object-cover"
                fill
                unoptimized
              />
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
      <HelpCenterDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </header>
  );
});
