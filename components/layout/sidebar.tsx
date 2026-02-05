"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  UtensilsCrossed,
  ChefHat,
  ClipboardList,
  Users,
  Settings,
  LogOut,
  CreditCard,
  Package,
  Plus,
  Activity,
  Armchair,
  Calendar,
  Percent
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";
import { useEffect } from "react";

const sidebarItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Orders",
    href: "/orders/active",
    icon: ClipboardList,
  },
  {
    title: "New Order",
    href: "/orders/new",
    icon: Plus,
  },
  {
    title: "Analytics",
    href: "/analytics",
    icon: Activity,
  },
  {
    title: "Menu",
    href: "/menu/items",
    icon: UtensilsCrossed,
  },
  {
    title: "Kitchen",
    href: "/kitchen",
    icon: ChefHat,
  },
  {
    title: "Inventory",
    href: "/inventory",
    icon: Package,
  },
  {
    title: "Finance",
    href: "/finance",
    icon: CreditCard,
  },
  {
    title: "Customers",
    href: "/customers",
    icon: Users,
  },
  {
    title: "Tables",
    href: "/tables",
    icon: Armchair,
  },
  {
    title: "Reservations",
    href: "/reservations",
    icon: Calendar,
  },
  {
    title: "Discounts",
    href: "/discounts",
    icon: Percent,
  },
  {
    title: "Manage",
    href: "/manage",
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const logout = useAuth(state => state.logout);
  const { restaurant, fetchRestaurant } = useRestaurant();

  useEffect(() => {
    if (!restaurant) {
      fetchRestaurant();
    }
  }, [restaurant, fetchRestaurant]);

  return (
    <div className="flex h-full w-72 flex-col border-r bg-card dark:border-white/5">
      <div className="flex h-16 items-center border-b px-6 dark:border-white/5">
        <Link href="/dashboard" className="flex items-center gap-3 font-bold text-xl hover:opacity-90 transition-opacity">
          {/* Use the new logo asset */}
          <div className="relative h-8 w-8 min-w-8">
             <img src="/refresh_icon.png" alt="Logo" className="object-contain h-full w-full" />
          </div>
          <span className="truncate text-primary">
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
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary",
                pathname === item.href || (pathname && pathname.startsWith(item.href + "/"))
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
      <div className="border-t p-4 dark:border-white/5">
        <button 
          onClick={() => logout()}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-base font-medium text-red-600 dark:text-red-400 transition-all hover:bg-destructive/10"
        >
          <LogOut className="h-5 w-5" />
          Logout
        </button>
      </div>
    </div>
  );
}
