"use client";

import { Bell, Search, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { ModeToggle } from "@/components/mode-toggle";

export function Header() {
  const user = useAuth(state => state.user);
  return (
    <header className="flex h-16 items-center gap-4 border-b bg-background px-6">
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
      <Button variant="ghost" size="icon" className="text-muted-foreground">
        <Bell className="h-5 w-5" />
        <span className="sr-only">Notifications</span>
      </Button>
      <ModeToggle />
      <div className="flex items-center gap-2">
         <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary overflow-hidden">
            {user?.full_name ? (
              <span className="text-xs font-bold">{user.full_name.charAt(0).toUpperCase()}</span>
            ) : (
              <User className="h-5 w-5"/>
            )}
         </div>
         <div className="hidden md:block">
            <p className="text-sm font-medium">{user?.full_name || "Admin User"}</p>
            <p className="text-xs text-muted-foreground capitalize">{user?.role || "Manager"}</p>
         </div>
      </div>
    </header>
  );
}
