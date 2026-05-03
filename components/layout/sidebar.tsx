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
  ArrowLeftRight,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";
import { useSidebar } from "@/hooks/use-sidebar";
import { useEffect, memo, useRef } from "react";
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

export const Sidebar = memo(function Sidebar() {
  const MIN_WIDTH = 240;
  const MAX_WIDTH = 420;

  const pathname = usePathname();
  const router = useRouter();
  const logout = useAuth(state => state.logout);
  const restaurant = useRestaurant((s) => s.restaurant);
  const fetchRestaurant = useRestaurant((s) => s.fetchRestaurant);
  const selectedModule = useRestaurant((s) => s.selectedModule);
  const collapsed = useSidebar((s) => s.collapsed);
  const width = useSidebar((s) => s.width);
  const toggle = useSidebar((s) => s.toggle);
  const setWidth = useSidebar((s) => s.setWidth);
  const items = useSidebarItems();
  const resizingRef = useRef(false);

  // Home link depends on active module
  const homeHref = selectedModule === "hotel" ? "/rooms" : "/dashboard";

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

  return (
    <TooltipProvider delayDuration={0}>
      <div
        className={cn(
          "hidden md:flex h-full flex-col border-r bg-card transition-[width] duration-300 ease-in-out shrink-0 relative",
          collapsed ? "w-[68px]" : ""
        )}
        style={collapsed ? undefined : { width: `${Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, width || 288))}px` }}
      >
        {/* Logo / Brand + Collapse Toggle */}
        <div className={cn(
          "flex items-center border-b",
          collapsed ? "flex-col gap-1 py-3 px-2" : "h-16 px-4 flex-row"
        )}>
          <Link href={homeHref} className={cn(
            "flex items-center font-bold hover:opacity-90 transition-opacity",
            collapsed ? "justify-center" : "gap-3 text-xl overflow-hidden flex-1 min-w-0"
          )}>
            <div className="relative h-8 w-8 min-w-8 flex items-center justify-center shrink-0">
              {restaurant?.profile_picture ? (
                <Image src={getImageUrl(restaurant.profile_picture)} alt="Logo" className="object-cover rounded-md" fill priority unoptimized />
              ) : (
                <div className="bg-primary/10 p-1.5 rounded-md">
                  <Store className="h-full w-full text-primary" />
                </div>
              )}
            </div>
            {!collapsed && (
              <span 
                className="truncate text-primary"
                onClick={() => sessionStorage.removeItem('fromManage')}
              >
                {restaurant?.name || "Yummy Kitchen"}
              </span>
            )}
          </Link>
          <button
            onClick={toggle}
            className={cn(
              "flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0",
              collapsed ? "h-6 w-6" : "h-7 w-7"
            )}
          >
            {collapsed ? <ChevronsRight className="h-3.5 w-3.5" /> : <ChevronsLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Nav Items */}
        <div className="flex-1 overflow-y-auto py-4 min-h-0 sidebar-scroll">
          <nav className={cn("grid items-start text-sm font-medium gap-1", collapsed ? "px-2" : "px-4 gap-2")}>
            {items.map((item, index) => {
              const isActive = pathname === item.href || (pathname && pathname.startsWith(item.href + "/"));
              const link = (
                <Link
                  key={index}
                  href={item.href}
                  onClick={() => sessionStorage.removeItem('fromManage')}
                  className={cn(
                    "flex items-center rounded-lg transition-all hover:text-primary",
                    collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2",
                    isActive
                      ? "bg-muted text-primary"
                      : "text-muted-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {!collapsed && <span className="text-base font-medium">{item.title}</span>}
                </Link>
              );

              if (collapsed) {
                return (
                  <Tooltip key={index}>
                    <TooltipTrigger asChild>{link}</TooltipTrigger>
                    <TooltipContent side="right" sideOffset={8}>
                      {item.title}
                    </TooltipContent>
                  </Tooltip>
                );
              }
              return link;
            })}
          </nav>
        </div>

        {/* Module Switcher — only when both modules are enabled */}
        {restaurant?.hotel_enabled && restaurant?.restaurant_enabled && (
          <div className="border-t p-2">
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => router.push("/gateway")}
                    className="flex w-full items-center justify-center rounded-lg py-2.5 text-muted-foreground hover:text-primary hover:bg-muted transition-all"
                  >
                    <ArrowLeftRight className="h-5 w-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>Switch Module</TooltipContent>
              </Tooltip>
            ) : (
              <button
                onClick={() => router.push("/gateway")}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-base font-medium text-muted-foreground hover:text-primary hover:bg-muted transition-all"
              >
                <ArrowLeftRight className="h-5 w-5" />
                Switch Module
              </button>
            )}
          </div>
        )}

        {/* Logout */}
        <div className="border-t p-2">
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => {
                    logout();
                    router.push("/");
                  }}
                  className="flex w-full items-center justify-center rounded-lg py-2.5 text-red-600 dark:text-red-400 transition-all hover:bg-destructive/10"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>Logout</TooltipContent>
            </Tooltip>
          ) : (
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
          )}
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
});
