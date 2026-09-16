"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, UserRound } from "lucide-react";

import { useSidebarItems, type SidebarItem } from "@/hooks/use-sidebar-items";
import { cn } from "@/lib/utils";
import { shouldMobileBottomNavBeVisible } from "@/lib/mobile-module-navigation";

const isActive = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

export function MobileBottomNav() {
  const pathname = usePathname() || "/dashboard";
  const items = useSidebarItems();
  const home =
    items.find(
      (item) => item.href === "/dashboard" || item.href === "/hotel",
    ) || items[0];
  const orders = items.find((item) => item.href === "/orders");
  const analytics = items.find((item) => item.href === "/analytics");
  const primaryItems = [home, orders, analytics].filter(
    (item): item is SidebarItem => Boolean(item),
  );
  const navigationItems = [
    ...primaryItems,
    {
      title: "Profile",
      href: "/manage/profile",
      icon: UserRound,
    },
    {
      title: "Manage",
      href: "/manage",
      icon: LayoutGrid,
    },
  ];
  if (!shouldMobileBottomNavBeVisible(pathname)) return null;

  return (
    <nav
      aria-label="Primary navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/95 px-4 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur lg:hidden"
    >
      <div
        className="mx-auto grid max-w-md items-end"
        style={{
          gridTemplateColumns: `repeat(${navigationItems.length}, minmax(0, 1fr))`,
        }}
      >
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/manage"
              ? pathname === "/manage"
              : isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="max-w-full truncate">{item.title}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
