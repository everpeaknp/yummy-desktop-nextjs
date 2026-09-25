"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { cn, getImageUrl } from "@/lib/utils";
import {
  LogOut,
  Store,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  Search,
  Bell,
  Crown,
  ChevronRight,
  Zap,
  Settings,
  Pencil,
  Sun,
  Maximize,
  Calendar,
  ThumbsUp,
  Share,
  User,
  DollarSign,
  HelpCircle,
  Camera,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import apiClient from "@/lib/api-client";
import { AuthApis } from "@/lib/api/endpoints";
import { useTheme } from "next-themes";
import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";
import { useSubscriptionStore } from "@/hooks/use-subscription";
import { useSidebar } from "@/hooks/use-sidebar";
import { currentPlanDisplayName } from "@/lib/subscription/entitlements";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSidebarItems, type SidebarItem } from "@/hooks/use-sidebar-items";
import { isPathAccessible } from "@/lib/role-permissions";
import { GlobalSearch } from "./global-search";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { HelpCenterDialog } from "@/components/onboarding/help-center-dialog";

// Purchase documents are inventory-backed routes, but Finance owns their
// navigation entry. Exclude them before the broader Inventory prefix match.
const activeRouteExclusions: Record<string, string[]> = {
  "/inventory": ["/inventory/purchases"],
};

// Index destinations own only their exact route. Without this boundary,
// `/finance` also matches every Finance child and makes Overview compete with
// the actual report, setup, or register destination.
const exactActiveRoutes = new Set(["/finance"]);

function matchesRoute(pathname: string | null, href: string) {
  if (exactActiveRoutes.has(href)) return pathname === href;
  return pathname === href || Boolean(pathname?.startsWith(`${href}/`));
}

function isExcludedRoute(pathname: string | null, href: string) {
  return (activeRouteExclusions[href] || []).some((excludedHref) =>
    matchesRoute(pathname, excludedHref),
  );
}

function SidebarNavLink({
  item,
  collapsed,
  isActive,
  hasSubItems,
  isOpen,
  onToggle,
}: {
  item: SidebarItem;
  collapsed: boolean;
  isActive: boolean;
  hasSubItems: boolean;
  isOpen?: boolean;
  onToggle?: () => void;
}) {
  const classes = cn(
    "flex items-center rounded-xl transition-all duration-150 group relative font-medium text-[13.5px]",
    collapsed ? "justify-center h-10 w-10 mx-auto my-0.5" : "gap-3 px-3 py-2 my-0.5",
    !collapsed && item.isNestedChild ? "pl-9 pr-3 text-[13px]" : "",
    isActive && !item.isNestedChild
      ? "bg-primary/10 text-primary font-semibold shadow-xs"
      : isActive && item.isNestedChild
        ? "text-primary font-semibold bg-primary/5"
        : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
  );

  const content = (
    <>
      {isActive && !collapsed && !item.isNestedChild && (
        <div className="absolute left-1.5 top-1/2 -translate-y-1/2 h-4 w-1 bg-primary rounded-full" />
      )}
      <div
        className={cn(
          "flex items-center justify-center shrink-0 rounded-lg transition-colors",
          collapsed ? "h-8 w-8" : "h-6 w-6",
          isActive
            ? "text-primary"
            : "text-muted-foreground group-hover:text-foreground",
        )}
      >
        <item.icon
          className={cn(
            "shrink-0 transition-transform duration-150 group-hover:scale-105",
            item.isNestedChild ? "h-3.5 w-3.5" : "h-[18px] w-[18px]",
          )}
        />
      </div>
      {!collapsed && (
        <span
          className={cn(
            "flex-1 truncate",
            item.isNestedChild ? "text-[13px]" : "text-[13.5px]",
          )}
        >
          {item.title}
        </span>
      )}
      {!collapsed && hasSubItems && (
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground/70 transition-transform duration-200",
            isOpen && "rotate-90 text-foreground",
          )}
        />
      )}
    </>
  );

  const tourAttr = tourAttrForHref(item.href, {
    isGroup: hasSubItems,
    title: item.title,
  });

  if (item.externalUrl) {
    return (
      <a
        href={item.externalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={classes}
        title={item.title}
        {...tourAttr}
      >
        {content}
      </a>
    );
  }

  if (hasSubItems) {
    return (
      <button
        onClick={onToggle}
        className={cn(classes, "w-full text-left")}
        {...tourAttr}
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={() => sessionStorage.removeItem("fromManage")}
      className={classes}
      {...tourAttr}
    >
      {content}
    </Link>
  );
}

function tourAttrForHref(
  href?: string,
  options?: { isGroup?: boolean; title?: string },
): { "data-tour"?: string } {
  if (options?.isGroup) {
    const key = (options.title || href || "group")
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    return { "data-tour": `nav-group-${key}` };
  }
  if (!href) return {};
  const key = href.replace(/^\//, "").replace(/\//g, "-");
  if (!key) return {};
  return { "data-tour": `nav-${key}` };
}

export function Sidebar() {
  const MIN_WIDTH = 240;
  const MAX_WIDTH = 420;

  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { restaurant, fetchRestaurant } = useRestaurant();
  const currentSubscription = useSubscriptionStore((state) => state.current);
  const { collapsed, width, toggle, setWidth, setCollapsed } = useSidebar();
  const items = useSidebarItems();
  const { theme, setTheme } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const [helpOpen, setHelpOpen] = useState(false);
  const resizingRef = useRef(false);
  const planDisplayName = currentPlanDisplayName(
    currentSubscription,
    restaurant,
  );
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file (PNG, JPG, etc.)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be less than 5MB");
      return;
    }

    try {
      setUploadingAvatar(true);
      const formData = new FormData();
      formData.append("file", file);

      const res = await apiClient.post(AuthApis.uploadProfilePicture, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data?.status === "success" || res.data?.data?.file_url) {
        const fileUrl = res.data?.data?.file_url;
        if (user) {
          useAuth.getState().setAuth(
            { ...user, photo_url: fileUrl },
            useAuth.getState().token,
            useAuth.getState().refreshToken
          );
        }
        toast.success("Profile photo updated successfully!");
      }
    } catch (err: any) {
      console.error("Avatar upload failed:", err);
      toast.error(err?.response?.data?.message || "Failed to upload profile photo");
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  // Expand all sidebar groups while the product tour is active
  useEffect(() => {
    const onTour = (event: Event) => {
      const active = Boolean(
        (event as CustomEvent<{ active?: boolean }>).detail?.active,
      );
      if (!active) return;
      setCollapsed(false);
      const next: Record<string, boolean> = {};
      items.forEach((item) => {
        if (item.subItems?.length) next[item.title] = true;
      });
      setOpenMenus(next);
      try {
        localStorage.setItem("sidebar:open-menus", JSON.stringify(next));
      } catch {
        // ignore
      }
    };
    window.addEventListener("yummy-product-tour", onTour);
    return () => window.removeEventListener("yummy-product-tour", onTour);
  }, [items, setCollapsed]);

  // Restore open menus from local storage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("sidebar:open-menus");
      if (saved) {
        setOpenMenus(JSON.parse(saved));
      }
    } catch {
      // Ignore
    }
  }, []);

  // Auto-open parent menus if a child route is active
  useEffect(() => {
    setOpenMenus((prev) => {
      const next = { ...prev };
      let changed = false;
      items.forEach((item) => {
        if (item.subItems) {
          const hasActiveChild = item.subItems.some((sub) =>
            matchesRoute(pathname, sub.href),
          );
          if (hasActiveChild && !next[item.title]) {
            next[item.title] = true;
            changed = true;
          }
        }
      });
      if (changed) {
        localStorage.setItem("sidebar:open-menus", JSON.stringify(next));
        return next;
      }
      return prev;
    });
  }, [items, pathname]);

  const homeHref =
    restaurant?.hotel_enabled && !restaurant?.restaurant_enabled
      ? "/hotel"
      : "/dashboard";

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  useEffect(() => {
    if (!restaurant) {
      fetchRestaurant();
    }
  }, [restaurant, fetchRestaurant]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!resizingRef.current || collapsed) return;
      const nextWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, event.clientX));
      setWidth(nextWidth);
    };
    const handleMouseUp = () => {
      if (!resizingRef.current) return;
      resizingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [collapsed, setWidth]);

  const startResize = () => {
    if (collapsed) return;
    resizingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const toggleMenu = (title: string) => {
    setOpenMenus((prev) => {
      const next = { ...prev, [title]: !prev[title] };
      localStorage.setItem("sidebar:open-menus", JSON.stringify(next));
      return next;
    });
  };

  const isItemActive = (item: SidebarItem) => {
    if (
      !isExcludedRoute(pathname, item.href) &&
      matchesRoute(pathname, item.href)
    ) {
      return true;
    }
    if (item.subItems) {
      return item.subItems.some((sub) => matchesRoute(pathname, sub.href));
    }
    return false;
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div
        data-tour="sidebar"
        className={cn(
          "hidden h-full shrink-0 flex-col border-r bg-background transition-[width] duration-300 ease-in-out lg:flex relative",
          collapsed ? "w-[68px]" : "",
        )}
        style={
          collapsed
            ? undefined
            : {
                width: `${Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, width || 260))}px`,
              }
        }
      >
        {/* Unified Workspace Header */}
        <div
          data-tour="sidebar-outlet"
          className={cn(
            "flex items-center justify-between border-b border-border/50 transition-all",
            collapsed ? "flex-col gap-2 py-3 px-2" : "h-14 px-3.5",
          )}
        >
          <div
            className={cn(
              "flex items-center min-w-0 flex-1",
              collapsed ? "justify-center" : "gap-2.5",
            )}
          >
            <div className="relative h-8 w-8 min-w-8 flex items-center justify-center shrink-0 rounded-lg overflow-hidden border border-border/50 bg-background shadow-2xs">
              {restaurant?.profile_picture ? (
                <Image
                  src={getImageUrl(restaurant.profile_picture)}
                  alt="Logo"
                  className="object-cover"
                  fill
                  unoptimized
                />
              ) : (
                <div className="bg-primary/10 w-full h-full flex items-center justify-center">
                  <Store className="h-4 w-4 text-primary" />
                </div>
              )}
            </div>

            {!collapsed && (
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-bold text-[13.5px] truncate text-foreground tracking-tight">
                    {restaurant?.name || "Yummy Outlet"}
                  </span>
                  {isPathAccessible("/premium", user) ? (
                    <Link
                      href="/premium"
                      title="View Billing & Subscription"
                      className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold tracking-tight shrink-0 hover:bg-amber-500/20 transition-colors"
                    >
                      <Crown className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                      {planDisplayName}
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold tracking-tight shrink-0">
                      <Crown className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                      {planDisplayName}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-[10.5px] text-muted-foreground leading-tight mt-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="truncate">Active Outlet</span>
                </div>
              </div>
            )}
          </div>

          <div
            className={cn(
              "flex items-center shrink-0",
              collapsed ? "flex-col gap-2" : "gap-1",
            )}
          >
            <button
              data-tour="sidebar-collapse"
              onClick={toggle}
              className="flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <ChevronsRight className="h-4 w-4" />
              ) : (
                <ChevronsLeft className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />

        <div className="px-3 pt-2.5 pb-1">
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  data-tour="sidebar-search"
                  onClick={() => setSearchOpen(true)}
                  className="flex h-9 w-9 mx-auto items-center justify-center rounded-xl border border-border/50 bg-muted/40 hover:bg-muted/70 text-muted-foreground hover:text-foreground transition-all shadow-2xs"
                >
                  <Search className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Search (Ctrl+K)</TooltipContent>
            </Tooltip>
          ) : (
            <button
              type="button"
              data-tour="sidebar-search"
              onClick={() => setSearchOpen(true)}
              className="w-full flex items-center justify-between rounded-xl border border-border/50 bg-muted/40 hover:bg-muted/70 text-muted-foreground hover:text-foreground px-2.5 py-2 text-xs transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-2xs group cursor-pointer"
            >
              <div className="flex items-center gap-2 truncate">
                <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70 group-hover:text-foreground transition-colors" />
                <span className="text-[12.5px] truncate">Search...</span>
              </div>
              <kbd className="text-[10px] font-mono bg-background/80 border border-border/60 text-muted-foreground/80 px-1.5 py-0.5 rounded shadow-2xs shrink-0">
                Ctrl+K
              </kbd>
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 sidebar-scroll px-2.5 py-2">
          <nav className="flex flex-col gap-0.5">
            {items.map((item, index) => {
              const active = isItemActive(item);
              const isOpen = openMenus[item.title];

              return (
                <div key={index} className="flex flex-col">
                  {collapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <SidebarNavLink
                            item={item}
                            collapsed={collapsed}
                            isActive={active}
                            hasSubItems={!!item.subItems?.length}
                            isOpen={isOpen}
                            onToggle={() => toggleMenu(item.title)}
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right">{item.title}</TooltipContent>
                    </Tooltip>
                  ) : (
                    <SidebarNavLink
                      item={item}
                      collapsed={collapsed}
                      isActive={active}
                      hasSubItems={!!item.subItems?.length}
                      isOpen={isOpen}
                      onToggle={() => toggleMenu(item.title)}
                    />
                  )}

                  {!collapsed &&
                    item.subItems &&
                    item.subItems.length > 0 &&
                    isOpen && (
                      <div className="ml-5 my-0.5 flex flex-col gap-0.5 border-l-2 border-border/40 pl-3">
                        {item.subItems.map((sub, sIdx) => {
                          const subActive = matchesRoute(pathname, sub.href);
                          const subTour = tourAttrForHref(sub.href);
                          return (
                            <Link
                              key={sIdx}
                              href={sub.href}
                              {...subTour}
                              className={cn(
                                "text-[12.5px] py-1.5 px-2.5 rounded-lg transition-all font-medium flex items-center gap-2",
                                subActive
                                  ? "text-primary bg-primary/10 font-semibold"
                                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                              )}
                            >
                              <span
                                className={cn(
                                  "h-1.5 w-1.5 rounded-full shrink-0 transition-colors",
                                  subActive
                                    ? "bg-primary"
                                    : "bg-muted-foreground/40",
                                )}
                              />
                              <span className="truncate">{sub.title}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                </div>
              );
            })}
          </nav>
        </div>

        <div className="p-2.5 mt-auto border-t border-border/40" data-tour="sidebar-account">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "w-full flex items-center rounded-xl border border-transparent hover:border-border/50 hover:bg-muted/50 p-2 transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary group",
                  collapsed ? "justify-center p-1.5" : "gap-2.5",
                )}
              >
                <div className="relative shrink-0">
                  {user?.photo_url ? (
                    <div className="relative h-8 w-8 rounded-lg overflow-hidden border border-border/50 bg-background shadow-2xs">
                      <Image
                        src={getImageUrl(user.photo_url)}
                        alt={user.full_name || "User"}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-600/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs border border-blue-500/20">
                      {(user?.full_name && !user.full_name.includes("@")
                        ? user.full_name
                        : "User"
                      )
                        .substring(0, 2)
                        .toUpperCase()}
                    </div>
                  )}
                  <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-background" />
                </div>
                {!collapsed && (
                  <div className="flex-1 min-w-0 flex flex-col justify-center text-left">
                    <div className="font-semibold text-[13px] truncate text-foreground leading-tight group-hover:text-primary transition-colors">
                      {user?.full_name && !user.full_name.includes("@")
                        ? user.full_name
                        : "User"}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground truncate leading-tight mt-0.5">
                      <span className="capitalize">{user?.role || user?.roles?.[0] || "Staff"}</span>
                      <span className="text-[9px] text-muted-foreground/50">•</span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Online</span>
                    </div>
                  </div>
                )}
                {!collapsed && (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-foreground shrink-0 transition-transform group-hover:translate-x-0.5" />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side={collapsed ? "right" : "top"}
              align="start"
              sideOffset={collapsed ? 12 : 8}
              className="w-[240px] p-1.5 rounded-2xl shadow-xl border border-border/60 bg-popover/95 backdrop-blur-md z-50 mb-1"
            >
              {/* User preview inside dropdown */}
              <div className="flex items-center gap-2.5 p-2 rounded-xl bg-muted/30 border border-border/30 mb-1">
                <div className="relative shrink-0">
                  {user?.photo_url ? (
                    <div className="relative h-9 w-9 rounded-xl overflow-hidden border border-border/50 bg-background shadow-2xs">
                      <Image
                        src={getImageUrl(user.photo_url)}
                        alt={user.full_name || "User"}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs border border-blue-500/20">
                      {(user?.full_name && !user.full_name.includes("@")
                        ? user.full_name
                        : "User"
                      )
                        .substring(0, 2)
                        .toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-xs truncate text-foreground leading-tight">
                    {user?.full_name && !user.full_name.includes("@")
                      ? user.full_name
                      : "User"}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate leading-tight capitalize mt-0.5">
                    {user?.email || user?.role || "Staff"}
                  </p>
                </div>
              </div>

              <div className="py-0.5 space-y-0.5">
                <DropdownMenuItem
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="cursor-pointer gap-2.5 py-2 px-2.5 text-xs font-medium text-foreground/90 hover:text-foreground rounded-lg"
                >
                  {uploadingAvatar ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <Camera className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span>{uploadingAvatar ? "Uploading photo..." : "Upload Profile Photo"}</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => router.push("/manage/profile")}
                  className="cursor-pointer gap-2.5 py-2 px-2.5 text-xs font-medium text-foreground/90 hover:text-foreground rounded-lg"
                >
                  <Pencil className="h-4 w-4 text-muted-foreground" /> Business Profile
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => router.push("/feedback")}
                  className="cursor-pointer gap-2.5 py-2 px-2.5 text-xs font-medium text-foreground/90 hover:text-foreground rounded-lg"
                >
                  <ThumbsUp className="h-4 w-4 text-muted-foreground" /> Give Feedback
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => setHelpOpen(true)}
                  className="cursor-pointer gap-2.5 py-2 px-2.5 text-xs font-medium text-foreground/90 hover:text-foreground rounded-lg"
                >
                  <HelpCircle className="h-4 w-4 text-muted-foreground" /> Help & Support
                </DropdownMenuItem>

                <DropdownMenuItem
                  className="cursor-pointer gap-2.5 py-2 px-2.5 text-xs font-medium text-foreground/90 hover:text-foreground rounded-lg flex items-center justify-between"
                  onSelect={(e) => e.preventDefault()}
                >
                  <div className="flex items-center gap-2.5">
                    <Sun className="h-4 w-4 text-muted-foreground" /> Dark Theme
                  </div>
                  <Switch
                    checked={theme === "dark"}
                    onCheckedChange={(checked) =>
                      setTheme(checked ? "dark" : "light")
                    }
                  />
                </DropdownMenuItem>

                <DropdownMenuSeparator className="my-1 bg-border/50" />

                <DropdownMenuItem
                  onClick={() => router.push("/settings")}
                  className="cursor-pointer gap-2.5 py-2 px-2.5 text-xs font-medium text-foreground/90 hover:text-foreground rounded-lg"
                >
                  <Settings className="h-4 w-4 text-muted-foreground" /> Settings
                </DropdownMenuItem>
              </div>

              <div className="pt-1.5 px-0.5 pb-0.5 border-t border-border/40 mt-1">
                <button
                  onClick={() => {
                    logout();
                    router.push("/");
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-muted/40 hover:bg-muted text-foreground py-2 rounded-xl text-xs font-bold transition-colors border border-transparent hover:border-border/50 cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5 text-foreground/60" /> Log out
                </button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarUpload}
          />
        </div>

        {!collapsed && (
          <button
            aria-label="Resize sidebar"
            onMouseDown={startResize}
            className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-primary/40 transition-colors"
            type="button"
          />
        )}
      </div>
      <HelpCenterDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </TooltipProvider>
  );
}
