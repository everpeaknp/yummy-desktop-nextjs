"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Bell, Search, User, Menu, LogOut, Store } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { ModeToggle } from "@/components/mode-toggle";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useRestaurant } from "@/hooks/use-restaurant";
import { useEffect, useState } from "react";
import { useSidebarItems } from "./sidebar";
import { cn } from "@/lib/utils";
import { useNotifications, useNotificationStore } from "@/hooks/use-notifications";
import { NotificationPanel } from "@/components/notifications/notification-panel";

function NotificationBell() {
  const { unreadCount } = useNotifications();
  const setPanelOpen = useNotificationStore((s) => s.setPanelOpen);

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
}

export function Header() {
  const user = useAuth(state => state.user);
  const logout = useAuth(state => state.logout);
  const { restaurant, fetchRestaurant } = useRestaurant();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const sidebarItems = useSidebarItems();

  useEffect(() => {
    if (!restaurant) {
      fetchRestaurant();
    }
  }, [restaurant, fetchRestaurant]);

  return (
    <header className="flex h-16 items-center gap-4 border-b bg-background px-6">
      {/* Mobile Menu */}
      <div className="md:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="shrink-0">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle navigation menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex flex-col p-0 w-[280px]">
            <div className="flex h-16 items-center border-b px-6">
              <Link href="/dashboard" className="flex items-center gap-2 font-bold text-lg" onClick={() => setOpen(false)}>
                <div className="relative h-8 w-8 min-w-8 flex items-center justify-center">
                  {restaurant?.profile_picture ? (
                    <Image src={restaurant.profile_picture} alt="Logo" className="object-cover rounded-md" fill priority />
                  ) : (
                    <div className="bg-primary/10 p-1.5 rounded-md">
                      <Store className="h-full w-full text-primary" />
                    </div>
                  )}
                </div>
                <span className="text-primary truncate">{restaurant?.name || "Yummy Kitchen"}</span>
              </Link>
            </div>
            <div className="flex-1 overflow-y-auto py-4">
              <nav className="grid items-start px-4 text-sm font-medium gap-2">
                {sidebarItems.map((item, index) => (
                  <Link
                    key={index}
                    href={item.href}
                    onClick={() => setOpen(false)}
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
            <div className="border-t p-4">
              <button
                onClick={() => logout()}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-base font-medium text-red-600 dark:text-red-400 transition-all hover:bg-destructive/10"
              >
                <LogOut className="h-5 w-5" />
                Logout
              </button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="w-full flex-1">
        <form>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search anything..."
              className="w-full appearance-none bg-background pl-8 shadow-none md:w-2/3 lg:w-1/3"
            />
          </div>
        </form>
      </div>
      <NotificationBell />
      <NotificationPanel />
      <ModeToggle />
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary overflow-hidden">
          {user?.full_name ? (
            <span className="text-xs font-bold">{user.full_name.charAt(0).toUpperCase()}</span>
          ) : (
            <User className="h-5 w-5" />
          )}
        </div>
        <div className="hidden md:block">
          <p className="text-sm font-medium">{user?.full_name || "Admin User"}</p>
          <p className="text-xs text-muted-foreground capitalize">{user?.roles?.length ? user.roles.join(", ") : user?.role || "Manager"}</p>
        </div>
      </div>
    </header>
  );
}
