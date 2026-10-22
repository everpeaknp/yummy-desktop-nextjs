"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SettingsDesktopRailProps = {
  activeItemId?: string;
};

export function SettingsDesktopRail({
  activeItemId,
}: SettingsDesktopRailProps) {
  const user = useAuth((state) => state.user);
  const subscription = useSubscriptionStore((state) => state.current);
  const router = useRouter();
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

  const visibleItems = groups.flatMap((category) => category.items);
  const activeItem = visibleItems.find((item) => item.id === activeItemId);
  const navigateToSetting = (itemId: string) => {
    const target = visibleItems.find((item) => item.id === itemId);
    if (target) router.push(target.route);
  };

  return (
    <div className="min-w-0 shrink-0 2xl:sticky 2xl:top-24 2xl:h-[calc(100dvh-7rem)] 2xl:w-64">
      <div className="mb-5 2xl:hidden">
        <Select value={activeItem?.id} onValueChange={navigateToSetting}>
          <SelectTrigger aria-label="Settings section" className="h-11 rounded-xl">
            <SelectValue placeholder="Choose a settings page" />
          </SelectTrigger>
          <SelectContent className="max-h-[min(24rem,70vh)]">
            {groups.map((category) => (
              <SelectGroup key={category.id}>
                <SelectLabel>{category.title}</SelectLabel>
                {category.items.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.title}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>
      <aside className="sidebar-scroll hidden h-full w-full min-w-0 overflow-y-auto overscroll-contain border-r border-border pr-5 2xl:block">
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
    </div>
  );
}
