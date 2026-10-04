"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { SearchField } from "@/components/patterns/controls/search-field";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useSubscriptionStore } from "@/hooks/use-subscription";
import { hasPermission } from "@/lib/role-permissions";
import {
  SETTINGS_CATEGORIES,
  SETTINGS_NAVIGATION_ITEMS,
} from "@/lib/settings-navigation";
import { isSubscriptionEntitlementEnabled } from "@/lib/subscription/entitlements";
import { cn } from "@/lib/utils";

type SettingsDesktopRailProps = {
  activeItemId?: string;
};

export function SettingsDesktopRail({
  activeItemId,
}: SettingsDesktopRailProps) {
  const user = useAuth((state) => state.user);
  const subscription = useSubscriptionStore((state) => state.current);
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const accessibleItems = SETTINGS_NAVIGATION_ITEMS.filter((item) => {
      if (item.availabilityState !== "available") return false;
      if (item.permission && !hasPermission(user, item.permission))
        return false;
      if (!normalizedQuery) return true;
      return [item.title, item.description, ...item.searchTerms].some((value) =>
        value.toLowerCase().includes(normalizedQuery),
      );
    });

    return SETTINGS_CATEGORIES.map((category) => ({
      ...category,
      items: accessibleItems.filter((item) => item.category === category.id),
    })).filter((category) => category.items.length);
  }, [query, user]);

  return (
    <aside className="sticky top-24 hidden h-[calc(100vh-7rem)] w-64 shrink-0 overflow-y-auto border-r border-border pr-5 2xl:block">
      <SearchField
        placeholder="Search settings"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <nav aria-label="Settings" className="mt-5 space-y-5 pb-8">
        {groups.map((category) => (
          <section key={category.id} className="space-y-1">
            <h2 className="px-3 text-xs font-semibold text-muted-foreground">
              {category.title}
            </h2>
            {category.items.map((item) => {
              const Icon = item.icon;
              const restricted = Boolean(
                item.entitlement &&
                !isSubscriptionEntitlementEnabled(
                  subscription,
                  item.entitlement,
                  item.entitlementLegacyFallback ?? false,
                ),
              );
              const content = (
                <span
                  className={cn(
                    "flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm transition-colors",
                    item.id === activeItemId
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    restricted && "opacity-70",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{item.title}</span>
                  {restricted ? (
                    <Badge variant="outline" className="px-1.5 text-[10px]">
                      Plan
                    </Badge>
                  ) : null}
                </span>
              );

              return (
                <Link
                  key={item.id}
                  href={item.route}
                  aria-label={restricted ? `View upgrade options for ${item.title}` : undefined}
                  className="block"
                >
                  {content}
                </Link>
              );
            })}
          </section>
        ))}
      </nav>
    </aside>
  );
}
