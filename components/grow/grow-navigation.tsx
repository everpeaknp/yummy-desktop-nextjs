"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gift, LayoutDashboard, Megaphone, Settings2, UsersRound } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { hasPermission } from "@/lib/role-permissions";
import { cn } from "@/lib/utils";

const destinations = [
  { label: "Overview", href: "/grow", icon: LayoutDashboard, matches: (path: string) => path === "/grow" },
  { label: "Campaigns", href: "/grow/campaigns", icon: Megaphone, matches: (path: string) => path.startsWith("/grow/campaigns") },
  { label: "Offers", href: "/grow/offers", icon: Gift, matches: (path: string) => path.startsWith("/grow/offers") },
  { label: "Customers", href: "/grow/subscribers", icon: UsersRound, matches: (path: string) => path.startsWith("/grow/subscribers") },
  { label: "Settings", href: "/grow/settings", icon: Settings2, matches: (path: string) => path.startsWith("/grow/settings"), permission: "grow.settings.manage" },
] as const;

export function GrowNavigation() {
  const pathname = usePathname() || "/grow";
  const user = useAuth((state) => state.user);
  const visibleDestinations = destinations.filter((destination) =>
    !("permission" in destination) || hasPermission(user, destination.permission),
  );

  return (
    <nav aria-label="Grow" className="mx-auto w-full max-w-[1500px] px-4">
      <div className="flex min-w-0 gap-1 overflow-x-auto border-b border-border/80 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-3">
        {visibleDestinations.map(({ label, href, icon: Icon, matches }) => {
          const active = matches(pathname);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative -mb-px inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-t-lg border-b-2 border-transparent px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:px-4",
                active
                  ? "border-primary text-primary"
                  : "text-muted-foreground hover:border-border hover:text-foreground",
              )}
            >
              <Icon aria-hidden="true" className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
