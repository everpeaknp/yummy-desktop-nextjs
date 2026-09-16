"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Armchair,
  Calendar,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Fingerprint,
  LayoutGrid,
  LineChart,
  Package,
  Receipt,
  Settings,
  Settings2,
  Truck,
  Users,
  UtensilsCrossed,
} from "lucide-react";

import { DataList, ListRow } from "@/components/patterns/data/data-list";
import { AppPage } from "@/components/patterns/page/app-page";
import { PageHeader } from "@/components/patterns/page/page-header";
import { PageSection } from "@/components/patterns/page/page-section";
import { useAuth } from "@/hooks/use-auth";
import { type SidebarItem, useSidebarItems } from "@/hooks/use-sidebar-items";
import { isPathAccessible } from "@/lib/role-permissions";
import { cn } from "@/lib/utils";

type ManageItem = {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  accessHref?: string;
  sidebarHref?: string;
  action?: "finance";
};

const sections: Array<{ title: string; items: ManageItem[] }> = [
  {
    title: "Core operations",
    items: [
      {
        title: "Tables",
        description: "Floor & occupancy",
        href: "/tables",
        icon: Armchair,
        sidebarHref: "/tables",
      },
      {
        title: "Reservations",
        description: "Bookings & guests",
        href: "/reservations",
        icon: Calendar,
        sidebarHref: "/reservations",
      },
      {
        title: "Receipts",
        description: "Past transactions",
        href: "/receipts",
        icon: Receipt,
      },
      {
        title: "Services",
        description: "Kitchen & service workflow",
        href: "/kitchen",
        icon: UtensilsCrossed,
        sidebarHref: "/kitchen",
      },
    ],
  },
  {
    title: "Menu & offers",
    items: [
      {
        title: "Menu",
        description: "Items & prices",
        href: "/menu/items",
        icon: UtensilsCrossed,
        sidebarHref: "/menu/items",
      },
      {
        title: "Categories",
        description: "Organize items",
        href: "/menu/categories",
        icon: LayoutGrid,
        sidebarHref: "/menu/categories",
      },
      {
        title: "Options & add-ons",
        description: "Toppings, extras & sides",
        href: "/menu/modifiers",
        icon: Settings2,
        sidebarHref: "/menu/modifiers",
      },
      {
        title: "Discounts",
        description: "Promos & coupons",
        href: "/discounts",
        icon: Settings2,
        sidebarHref: "/discounts",
      },
      {
        title: "Stations",
        description: "Departments & printers",
        href: "/manage/stations",
        icon: LayoutGrid,
      },
    ],
  },
  {
    title: "Finance & insights",
    items: [
      {
        title: "Finance",
        description: "Money & accounting",
        href: "/finance",
        icon: CreditCard,
        action: "finance",
      },
      {
        title: "Analytics",
        description: "Trends & insights",
        href: "/analytics",
        icon: LineChart,
        sidebarHref: "/analytics",
      },
    ],
  },
  {
    title: "Inventory & supply",
    items: [
      {
        title: "Inventory",
        description: "Stock, usage & activity",
        href: "/inventory",
        icon: Package,
        sidebarHref: "/inventory",
      },
      {
        title: "Suppliers",
        description: "Purchasing partners",
        href: "/suppliers",
        icon: Truck,
        sidebarHref: "/suppliers",
      },
    ],
  },
  {
    title: "Customers",
    items: [
      {
        title: "Customers",
        description: "Profiles, points & credit",
        href: "/customers",
        icon: CreditCard,
        sidebarHref: "/customers",
      },
    ],
  },
  {
    title: "People & admin",
    items: [
      {
        title: "Workforce",
        description: "Staff, attendance & pay",
        href: "/workforce",
        icon: Users,
        sidebarHref: "/workforce",
      },
      {
        title: "Settings",
        description: "Business, finance and access setup",
        href: "/settings",
        icon: Settings,
        sidebarHref: "/settings",
      },
    ],
  },
];

function flattenSidebarItems(items: SidebarItem[]): SidebarItem[] {
  return items.flatMap((item) => [
    item,
    ...flattenSidebarItems(item.subItems ?? []),
  ]);
}

function FinanceManageGroup({
  items,
  expanded,
  onExpandedChange,
}: {
  items: SidebarItem[];
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}) {
  return (
    <div>
      <button
        type="button"
        className="flex min-h-14 w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-4"
        aria-expanded={expanded}
        aria-controls="manage-finance-destinations"
        onClick={() => onExpandedChange(!expanded)}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <CreditCard className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">
            Finance
          </span>
          <span className="mt-0.5 block truncate text-xs leading-4 text-muted-foreground">
            Money & accounting
          </span>
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-180",
          )}
        />
      </button>
      {expanded ? (
        <div
          id="manage-finance-destinations"
          className="border-t border-border bg-muted/20 px-3 py-1.5"
        >
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex min-h-11 items-center gap-3 rounded-lg px-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{item.title}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default function ManagePage() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const sidebarItems = useSidebarItems();
  const [financeExpanded, setFinanceExpanded] = useState(false);
  const [routeResolved, setRouteResolved] = useState(false);
  const desktopResolutionStarted = useRef(false);

  useEffect(() => {
    if (desktopResolutionStarted.current || !user || !sidebarItems.length)
      return;

    desktopResolutionStarted.current = true;
    if (window.matchMedia("(min-width: 1024px)").matches) {
      const firstWorkspace = sidebarItems.find(
        (item) => item.href !== "/manage" && !item.isNestedChild,
      );
      router.replace(firstWorkspace?.href ?? "/dashboard");
      return;
    }

    setRouteResolved(true);
  }, [router, sidebarItems, user]);

  const visibleSidebarHrefs = useMemo(
    () => new Set(flattenSidebarItems(sidebarItems).map((item) => item.href)),
    [sidebarItems],
  );
  const financeItems = useMemo(
    () => sidebarItems.find((item) => item.title === "Finance")?.subItems ?? [],
    [sidebarItems],
  );
  const visibleSections = useMemo(
    () =>
      sections
        .map((section) => ({
          ...section,
          items: section.items.filter((item) => {
            if (item.action === "finance") return financeItems.length > 0;
            if (item.sidebarHref)
              return visibleSidebarHrefs.has(item.sidebarHref);
            return isPathAccessible(item.accessHref ?? item.href, user);
          }),
        }))
        .filter((section) => section.items.length > 0),
    [financeItems.length, user, visibleSidebarHrefs],
  );

  if (!routeResolved) {
    return (
      <AppPage
        width="reading"
        className="flex min-h-[12rem] items-center justify-center pb-24 lg:pb-8"
      >
        <p className="text-sm text-muted-foreground" role="status">
          Opening your workspace…
        </p>
      </AppPage>
    );
  }

  return (
    <AppPage width="workspace" className="pb-24 lg:pb-8">
      <PageHeader
        className="hidden lg:flex"
        title="Manage"
        description="Business operations, settings and administration."
      />

      <div className="space-y-7 md:space-y-9 lg:grid lg:grid-cols-2 lg:gap-x-8 lg:gap-y-10 lg:space-y-0 xl:grid-cols-3">
        {visibleSections.map((section) => (
          <PageSection
            key={section.title}
            title={section.title}
            className="space-y-0"
          >
            <DataList className="rounded-none border-x-0 bg-transparent shadow-none">
              {section.items.map((item) => {
                if (item.action === "finance") {
                  return (
                    <FinanceManageGroup
                      key={item.href}
                      items={financeItems}
                      expanded={financeExpanded}
                      onExpandedChange={setFinanceExpanded}
                    />
                  );
                }
                const row = (
                  <ListRow
                    leading={<item.icon className="h-4 w-4" />}
                    title={item.title}
                    description={item.description}
                    interactive
                  />
                );
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {row}
                  </Link>
                );
              })}
            </DataList>
          </PageSection>
        ))}
      </div>
    </AppPage>
  );
}
