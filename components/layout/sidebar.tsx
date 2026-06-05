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
  ArrowLeftRight,
  Zap,
  Settings,
  Pencil,
  Sun,
  Maximize,
  Calendar,
  ThumbsUp,
  Share,
  User,
  DollarSign
} from "lucide-react";
import { useTheme } from "next-themes";
import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";
import { useSidebar } from "@/hooks/use-sidebar";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useSidebarItems,
  type SidebarItem
} from "@/hooks/use-sidebar-items";
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
    "flex items-center rounded-lg transition-all group relative",
    collapsed ? "justify-center px-0 py-2.5" : "gap-3 py-2.5",
    !collapsed && item.isNestedChild ? "pl-9 pr-3 mt-0.5 text-[13px]" : "px-3",
    isActive && !item.isNestedChild
      ? "bg-primary/10 text-primary font-semibold"
      : isActive && item.isNestedChild
      ? "text-primary font-semibold"
      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
  );

  const content = (
    <>
      {isActive && !collapsed && !item.isNestedChild && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-2/3 w-1 bg-primary rounded-r-md" />
      )}
      <item.icon className={cn("shrink-0", item.isNestedChild ? "h-4 w-4" : "h-5 w-5", isActive ? "text-primary" : "")} />
      {!collapsed && <span className={cn("flex-1 truncate", item.isNestedChild ? "text-[13px]" : "text-sm")}>{item.title}</span>}
      {!collapsed && hasSubItems && (
        <ChevronRight className={cn("h-4 w-4 shrink-0 transition-transform", isOpen && "rotate-90")} />
      )}
    </>
  );

  if (item.externalUrl) {
    return (
      <a
        href={item.externalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={classes}
        title={item.title}
      >
        {content}
      </a>
    );
  }

  if (hasSubItems) {
    return (
      <button onClick={onToggle} className={cn(classes, "w-full text-left")}>
        {content}
      </button>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={() => sessionStorage.removeItem("fromManage")}
      className={classes}
    >
      {content}
    </Link>
  );
}

export function Sidebar() {
  const MIN_WIDTH = 240;
  const MAX_WIDTH = 420;

  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { restaurant, fetchRestaurant, selectedModule } = useRestaurant();
  const { collapsed, width, toggle, setWidth } = useSidebar();
  const items = useSidebarItems();
  const { theme, setTheme } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const resizingRef = useRef(false);

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
          const hasActiveChild = item.subItems.some(
            (sub) => pathname === sub.href || (pathname && pathname.startsWith(sub.href + "/"))
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

  const homeHref = selectedModule === "hotel" ? "/rooms" : "/dashboard";

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
    if (pathname === item.href || (pathname && pathname.startsWith(item.href + "/"))) {
      return true;
    }
    if (item.subItems) {
      return item.subItems.some((sub) => pathname === sub.href || (pathname && pathname.startsWith(sub.href + "/")));
    }
    return false;
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div
        className={cn(
          "hidden md:flex h-full flex-col border-r bg-background transition-[width] duration-300 ease-in-out shrink-0 relative",
          collapsed ? "w-[68px]" : ""
        )}
        style={collapsed ? undefined : { width: `${Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, width || 260))}px` }}
      >
        <div className={cn(
          "flex items-center justify-between border-b border-border/50",
          collapsed ? "flex-col gap-2 py-3 px-2" : "h-14 px-4"
        )}>
          <Link href={homeHref} className={cn(
            "flex items-center font-bold hover:opacity-90 transition-opacity",
            collapsed ? "justify-center" : "gap-2 text-lg overflow-hidden min-w-0"
          )}>
            <div className="relative h-6 w-6 min-w-6 flex items-center justify-center shrink-0">
              <Image src="/logos/yummy_logo.png" alt="Logo" width={24} height={24} className="rounded" unoptimized />
            </div>
            {!collapsed && (
              <span className="truncate text-foreground tracking-tight">
                Yummy Manage
              </span>
            )}
          </Link>
          
          <div className={cn("flex items-center", collapsed ? "flex-col gap-2" : "gap-1")}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setSearchOpen(true)}
                  className="flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <Search className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Search (Ctrl+K)</TooltipContent>
            </Tooltip>

            <button
              onClick={toggle}
              className="flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />

        <div className="p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn(
                "w-full rounded-xl border border-border/50 bg-card transition-all hover:border-primary/30 outline-none focus-visible:ring-2 focus-visible:ring-primary overflow-hidden text-left shadow-sm",
                collapsed ? "p-2" : ""
              )}>
                <div className={cn("flex items-center", collapsed ? "justify-center" : "p-3 gap-3")}>
                  <div className="relative h-9 w-9 min-w-9 flex items-center justify-center shrink-0">
                    {restaurant?.profile_picture ? (
                       <Image src={getImageUrl(restaurant.profile_picture)} alt="Logo" className="object-cover rounded-lg" fill unoptimized />
                    ) : (
                       <div className="bg-primary/10 w-full h-full rounded-lg flex items-center justify-center">
                         <Store className="h-5 w-5 text-primary" />
                       </div>
                    )}
                  </div>
                  {!collapsed && (
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate text-foreground">
                        {restaurant?.name || "Ramon Restro"}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                        <Crown className="h-3 w-3 text-amber-500" />
                        <span className="truncate">Premium (Trial)</span>
                      </div>
                    </div>
                  )}
                  {!collapsed && <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                </div>
                {!collapsed && (
                  <div className="bg-primary/5 text-primary text-[11px] font-semibold px-3 py-1.5 text-center border-t border-primary/10 hover:bg-primary/10 transition-colors flex items-center justify-center gap-1 uppercase tracking-wider">
                    Upgrade Now <Zap className="h-3 w-3" />
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[300px] p-2 rounded-2xl" align="start" side="right" sideOffset={16}>
              <div className="flex items-center justify-between p-2 mb-2">
                <div className="flex items-center gap-3">
                  <div className="relative h-11 w-11 min-w-11 flex items-center justify-center shrink-0">
                    {restaurant?.profile_picture ? (
                       <Image src={getImageUrl(restaurant.profile_picture)} alt="Logo" className="object-cover rounded-xl" fill unoptimized />
                    ) : (
                       <div className="bg-primary/10 w-full h-full rounded-xl flex items-center justify-center">
                         <Store className="h-5 w-5 text-primary" />
                       </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[15px] truncate leading-tight text-foreground">{restaurant?.name || "Yummy"}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex items-center gap-1 text-[11px] text-amber-500 font-bold tracking-tight">
                        <Crown className="h-3 w-3 fill-amber-500" />
                        Premium (Trial)
                      </div>
                      <div className="text-[10px] font-bold bg-muted px-2 py-0.5 rounded-md text-foreground/80 tracking-tight">
                        Role: {user?.roles?.[0] || user?.role || "Admin"}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="h-3 w-3 rounded-full border-[2.5px] border-primary bg-transparent shrink-0 self-start mt-1 mr-1" />
              </div>

              <div className="py-1">
                {isPathAccessible("/premium", user) && (
                  <DropdownMenuItem onClick={() => router.push("/premium")} className="cursor-pointer gap-4 py-2.5 px-3 text-[14px] font-medium text-foreground/90 hover:text-foreground">
                    <DollarSign className="h-4 w-4" /> Billing & Subscription
                  </DropdownMenuItem>
                )}

                {isPathAccessible("/staff", user) && (
                  <DropdownMenuItem onClick={() => router.push("/staff")} className="cursor-pointer gap-4 py-2.5 px-3 text-[14px] font-medium text-foreground/90 hover:text-foreground">
                    <User className="h-4 w-4" /> Manage Staff
                  </DropdownMenuItem>
                )}

                {isPathAccessible("/manage/settings", user) && (
                  <DropdownMenuItem onClick={() => router.push("/manage/settings")} className="cursor-pointer gap-4 py-2.5 px-3 text-[14px] font-medium text-foreground/90 hover:text-foreground">
                    <Settings className="h-4 w-4" /> Settings
                  </DropdownMenuItem>
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 sidebar-scroll px-3 pb-4">
          <nav className="flex flex-col gap-1">
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

                  {!collapsed && item.subItems && item.subItems.length > 0 && isOpen && (
                    <div className="ml-5 mt-1 flex flex-col gap-1 border-l pl-4 border-border/50">
                      {item.subItems.map((sub, sIdx) => {
                        const subActive = pathname === sub.href || (!!pathname && pathname.startsWith(sub.href + "/"));
                        return (
                          <Link
                            key={sIdx}
                            href={sub.href}
                            className={cn(
                              "text-[13px] py-1.5 px-3 rounded-md transition-all font-medium",
                              subActive ? "text-primary bg-primary/5" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                            )}
                          >
                            {sub.title}
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

        <div className="p-3 mt-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn(
                "w-full flex items-center rounded-xl border border-border/50 bg-card p-2 transition-all hover:bg-muted/50 outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-sm",
                collapsed ? "justify-center" : "gap-3"
              )}>
                <div className="h-9 w-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0 text-sm">
                  {user?.full_name?.substring(0, 2)?.toUpperCase() || "US"}
                </div>
                {!collapsed && (
                  <div className="flex-1 min-w-0 flex flex-col justify-center text-left">
                    <div className="font-semibold text-sm truncate text-foreground leading-none mb-1">
                      {user?.full_name || "User"}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate leading-none">
                      @{user?.email?.split('@')[0] || "user"}
                    </div>
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end" sideOffset={16} className="w-[300px] p-2 rounded-2xl mb-2">
              <div className="flex items-center gap-3 p-2 mb-1">
                <div className="h-12 w-12 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xl shrink-0">
                  {user?.full_name?.substring(0, 2)?.toUpperCase() || "US"}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-[15px] truncate text-foreground">{user?.full_name || "User"}</span>
                  <span className="text-xs text-muted-foreground truncate leading-snug">@{user?.email?.split('@')[0] || "user"}</span>
                  <span className="text-[11px] text-foreground truncate mt-0.5">{user?.email || "user@example.com"}</span>
                </div>
              </div>
              
              <DropdownMenuSeparator className="mx-2 bg-border/50" />
              
              <div className="py-1">
                <DropdownMenuItem onClick={() => router.push("/manage/profile")} className="cursor-pointer gap-3 py-2 px-3 text-sm font-medium text-foreground/80 hover:text-foreground">
                  <Pencil className="h-4 w-4" /> Profile Setting
                </DropdownMenuItem>

                {restaurant?.hotel_enabled && restaurant?.restaurant_enabled && (
                  <DropdownMenuItem onClick={() => router.push("/gateway")} className="cursor-pointer gap-3 py-2 px-3 text-sm font-medium text-foreground/80 hover:text-foreground">
                    <ArrowLeftRight className="h-4 w-4" /> Switch Module
                  </DropdownMenuItem>
                )}

                <DropdownMenuItem onClick={() => router.push("/feedback")} className="cursor-pointer gap-3 py-2 px-3 text-sm font-medium text-foreground/80 hover:text-foreground">
                  <ThumbsUp className="h-4 w-4" /> Give Feedback
                </DropdownMenuItem>

                <DropdownMenuItem className="cursor-pointer gap-3 py-2 px-3 text-sm font-medium text-foreground/80 hover:text-foreground flex items-center justify-between" onSelect={(e) => e.preventDefault()}>
                  <div className="flex items-center gap-3">
                    <Sun className="h-4 w-4" /> Dark Theme
                  </div>
                  <Switch checked={theme === "dark"} onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")} />
                </DropdownMenuItem>

                <DropdownMenuSeparator className="mx-2 bg-border/50" />

                <DropdownMenuItem onClick={() => router.push("/manage/settings")} className="cursor-pointer gap-3 py-2 px-3 text-sm font-medium text-foreground/80 hover:text-foreground">
                  <Settings className="h-4 w-4" /> Manage Settings
                </DropdownMenuItem>
              </div>

              <div className="pt-2 px-1 pb-1">
                <button
                  onClick={() => { logout(); router.push("/"); }}
                  className="w-full flex items-center justify-center gap-2 bg-muted/40 hover:bg-muted text-foreground py-2.5 rounded-xl text-[13px] font-bold transition-colors border border-transparent hover:border-border/50"
                >
                  <LogOut className="h-4 w-4 text-foreground/60" /> Log out
                </button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
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
    </TooltipProvider>
  );
}
