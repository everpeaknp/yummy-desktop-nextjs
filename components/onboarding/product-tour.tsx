"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/hooks/use-sidebar";
import { useSidebarItems, type SidebarItem } from "@/hooks/use-sidebar-items";
import { mobileNavigationTourSelector } from "@/lib/mobile-navigation-tour";

export type TourStep = {
  target: string;
  title: string;
  text: string;
  /** Mobile tours move to the actual destination before showing this step. */
  href?: string;
};

type ProductTourProps = {
  open: boolean;
  /** Optional static steps. When omitted, steps are discovered from the DOM in visual order. */
  steps?: TourStep[];
  onClose: () => void;
};

const TOUR_COPY: Record<string, { title: string; text: string }> = {
  "navbar-stat-orders": {
    title: "Active orders",
    text: "See how many orders are live right now and jump straight into the orders list.",
  },
  "navbar-stat-kot": {
    title: "Pending KOTs",
    text: "Track kitchen tickets waiting to be prepared.",
  },
  "navbar-stat-sales": {
    title: "Today’s sales",
    text: "A quick read of today’s revenue from the top bar.",
  },
  "navbar-module": {
    title: "Workspace switcher",
    text: "Switch between Restaurant and Hotel when both modules are enabled.",
  },
  "navbar-download": {
    title: "Desktop app",
    text: "Download the Yummy POS desktop app for Windows.",
  },
  "navbar-premium": {
    title: "Plans & billing",
    text: "View the current subscription, usage, published plans, and upgrade options.",
  },
  "navbar-notifications": {
    title: "Notifications",
    text: "Order alerts and important updates show up here.",
  },
  "navbar-help": {
    title: "Help",
    text: "Open help for the product tour, settings, and useful links.",
  },
  "navbar-theme": {
    title: "Theme",
    text: "Switch between light and dark appearance.",
  },
  "navbar-user": {
    title: "Signed-in user",
    text: "Your name and role are shown here across the app.",
  },
  "sidebar-brand": {
    title: "Yummy Manage",
    text: "Return home from the logo, or use search and collapse controls beside it.",
  },
  "sidebar-search": {
    title: "Search",
    text: "Find pages and settings quickly (Ctrl+K).",
  },
  "sidebar-collapse": {
    title: "Collapse sidebar",
    text: "Shrink the menu for more workspace on smaller screens.",
  },
  "sidebar-outlet": {
    title: "Restaurant card",
    text: "Your outlet name, plan, and upgrade options live here.",
  },
  "nav-dashboard": {
    title: "Dashboard",
    text: "Main overview with KPIs, shift pulse, and quick actions.",
  },
  "nav-orders": {
    title: "Orders",
    text: "Active tickets, history, and order status.",
  },
  "nav-orders-new": {
    title: "New order",
    text: "Start a dine-in, takeaway, or delivery order.",
  },
  "nav-orders-active": {
    title: "Active orders",
    text: "Focus on orders currently in progress.",
  },
  "nav-orders-history": {
    title: "Order history",
    text: "Browse completed and past orders.",
  },
  "nav-analytics": {
    title: "Analytics",
    text: "Trends and performance reports for your outlet.",
  },
  "nav-menu-items": {
    title: "Menu items",
    text: "Add and edit dishes, prices, and availability.",
  },
  "nav-group-menu": {
    title: "Menu",
    text: "Open this section for items, categories, options, and add-ons.",
  },
  "nav-group-table-and-space": {
    title: "Tables & space",
    text: "Floor plan, tables, and reservations.",
  },
  "nav-group-services": {
    title: "Services",
    text: "Kitchen display and discount tools.",
  },
  "nav-group-finance": {
    title: "Finance",
    text: "Income, expenses, day close, and reports.",
  },
  "nav-group-inventory": {
    title: "Inventory",
    text: "Stock and supplier inventory workflows.",
  },
  "nav-group-workforce": {
    title: "Workforce",
    text: "Staff, attendance, and salary.",
  },
  "nav-group-settings": {
    title: "Settings",
    text: "System settings and restaurant configuration.",
  },
  "nav-menu-categories": {
    title: "Categories",
    text: "Organize menu items into categories.",
  },
  "nav-menu-modifiers": {
    title: "Options & add-ons",
    text: "Choices such as toppings, sizes, and extras customers can select.",
  },
  "nav-tables": {
    title: "Tables",
    text: "Floor plan and table status.",
  },
  "nav-reservations": {
    title: "Reservations",
    text: "Bookings and guest seating schedules.",
  },
  "nav-kitchen": {
    title: "Kitchen",
    text: "Kitchen display for preparing tickets.",
  },
  "nav-discounts": {
    title: "Discounts",
    text: "Promos and coupon rules for checkout.",
  },
  "nav-finance-income": {
    title: "Income",
    text: "Sales revenue and income tracking.",
  },
  "nav-finance-expenses": {
    title: "Expenses",
    text: "Track outlet costs and spending.",
  },
  "nav-finance-accounting": {
    title: "Accounting",
    text: "Accounting views for your business.",
  },
  "nav-finance-reports": {
    title: "Reports",
    text: "Financial reports and summaries.",
  },
  "nav-day-close": {
    title: "Day close",
    text: "Close the business day and review evidence.",
  },
  "nav-transactions": {
    title: "Transactions",
    text: "Payment and cash movement history.",
  },
  "nav-cash-drawers": {
    title: "Cash drawers",
    text: "Open and manage drawer sessions.",
  },
  "nav-inventory": {
    title: "Inventory",
    text: "Stock levels and inventory workflows.",
  },
  "nav-manage-suppliers": {
    title: "Suppliers",
    text: "Vendor directory for purchases.",
  },
  "nav-workforce": {
    title: "Workforce",
    text: "Staff, attendance, and salary hub.",
  },
  "nav-staff": {
    title: "Staff",
    text: "Employees, roles, and access.",
  },
  "nav-attendance": {
    title: "Attendance",
    text: "QR check-in and attendance devices.",
  },
  "nav-customers": {
    title: "Customers",
    text: "Profiles, credit, and loyalty points.",
  },
  "nav-manage": {
    title: "Settings",
    text: "Restaurant profile, taxes, roles, and system settings.",
  },
  "nav-rooms": {
    title: "Rooms",
    text: "Hotel room overview and occupancy.",
  },
  "nav-rooms-checkin": {
    title: "Check in / out",
    text: "Guest check-in and check-out flows.",
  },
  "nav-premium": {
    title: "Plans & billing",
    text: "Subscription and plan details.",
  },
  "sidebar-account": {
    title: "Your account",
    text: "Profile, theme, help, and logout at the bottom of the sidebar.",
  },
};

function titleFromElement(el: HTMLElement) {
  const labeled =
    el.getAttribute("aria-label") ||
    el.getAttribute("title") ||
    el.textContent?.replace(/\s+/g, " ").trim();
  if (labeled && labeled.length < 48) return labeled;
  return "This control";
}

function copyFor(key: string, el: HTMLElement): { title: string; text: string } {
  if (TOUR_COPY[key]) return TOUR_COPY[key];
  if (key.startsWith("nav-")) {
    const label = titleFromElement(el);
    return {
      title: label,
      text: `Open ${label} from the sidebar to manage this part of your workspace.`,
    };
  }
  return {
    title: titleFromElement(el),
    text: "Use this control from the top bar.",
  };
}

function isVisible(el: HTMLElement) {
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
    return false;
  }
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function leafTourNodes(nodes: HTMLElement[]) {
  return nodes.filter(
    (node) => !nodes.some((other) => other !== node && node.contains(other))
  );
}

function mobileTourSteps(items: SidebarItem[]): TourStep[] {
  const home =
    items.find((item) => item.href === "/dashboard" || item.href === "/hotel") ||
    items[0];
  const orders = items.find((item) => item.href === "/orders");
  const analytics = items.find((item) => item.href === "/analytics");
  const mobileTabs = [
    home,
    orders,
    analytics,
    { title: "Profile", href: "/manage/profile" },
    { title: "Manage", href: "/manage" },
  ].filter((item): item is { title: string; href: string } => Boolean(item));

  const copy: Record<string, string> = {
    "/dashboard": "Start here to see today's work, quick actions, and your business snapshot.",
    "/hotel": "Start here to see today's hotel activity and front-desk work.",
    "/orders": "Use this tab to create, follow, and complete orders.",
    "/analytics": "Use this tab to review sales, operations, and team performance.",
    "/manage/profile": "Use this tab to view your attendance, performance, and account details.",
    "/manage": "Use this tab for restaurant setup, staff, finance, and other management tools.",
  };

  const dashboardActions: TourStep[] = [
    {
      target: '[data-tour="mobile-dashboard-action-create_order"]',
      title: "New order",
      text: "Start a sale here. Choose the order type that fits the customer.",
    },
    {
      target: '[data-tour="mobile-dashboard-action-running_orders"]',
      title: "Running orders",
      text: "Open this to follow orders that are still in progress.",
    },
    {
      target: '[data-tour="mobile-dashboard-action-kot"]',
      title: "Kitchen tickets",
      text: "Use this shortcut to see work waiting in the kitchen.",
    },
    {
      target: '[data-tour="mobile-dashboard-action-day_close"]',
      title: "Day close",
      text: "Review and close the current business day when your shift is ready.",
    },
  ].filter((step) => targetExists(step.target));

  const accessibleHrefs = new Set(
    items.flatMap(function flatten(item): string[] {
      return [item.href, ...(item.subItems?.flatMap(flatten) ?? [])];
    }),
  );
  const manageTools = [
    { href: "/tables", title: "Tables", text: "Set up tables and check their current occupancy." },
    { href: "/reservations", title: "Reservations", text: "Manage guest bookings and seating plans." },
    { href: "/menu/items", title: "Menu", text: "Add or update items, prices, and availability." },
    { href: "/menu/categories", title: "Categories", text: "Organize menu items into clear groups." },
    { href: "/menu/modifiers", title: "Options & add-ons", text: "Set up choices, toppings, sizes, and extras." },
    { href: "/discounts", title: "Discounts", text: "Create and manage promotions and coupon rules." },
    { href: "/finance/income", title: "Finance", text: "Open finance tools for income, expenses, and cash controls." },
    { href: "/inventory", title: "Inventory", text: "Track stock, usage, and inventory activity." },
    { href: "/suppliers", title: "Suppliers", text: "Manage purchasing partners and supplier details." },
    { href: "/customers", title: "Customers", text: "View customer profiles, credit, and loyalty activity." },
    { href: "/workforce", title: "Workforce", text: "Manage staff, attendance, and pay-related tools." },
    { href: "/settings", title: "Settings", text: "Configure business, access, and operational settings." },
  ]
    .filter((tool) => accessibleHrefs.has(tool.href))
    .map((tool) => ({
      target:
        tool.href === "/finance/income"
          ? '[data-tour="mobile-manage-tool-finance"]'
          : `[data-tour="mobile-manage-tool-${tool.href.replace(/^\//, "").replace(/\//g, "-")}"]`,
      title: tool.title,
      text: tool.text,
    }));

  const detailSteps: Record<string, TourStep[]> = {
    "/dashboard": [
      ...dashboardActions,
    ],
    "/orders": [
      {
        target: '[data-tour="mobile-orders-sections"]',
        title: "Order sections",
        text: "Switch between active orders, kitchen tickets, and completed history.",
      },
      {
        target: '[data-tour="mobile-orders-filters"]',
        title: "Order filters",
        text: "Narrow the current order list to find the work you need quickly.",
      },
      {
        target: '[data-tour="mobile-orders-new-order"]',
        title: "Start a new order",
        text: "Use this button to choose an order type and begin a new ticket.",
      },
    ],
    "/analytics": [
      {
        target: '[data-tour="mobile-analytics-date-range"]',
        title: "Choose a period",
        text: "Change the date range to review today, a recent period, or a custom range.",
      },
      {
        target: '[data-tour="mobile-analytics-filters"]',
        title: "Refine analytics",
        text: "Use filters to narrow the report to a daybook, station, or service when available.",
      },
    ],
    "/manage/profile": [
      {
        target: '[data-tour="mobile-profile-attendance"]',
        title: "Record attendance",
        text: "Use this action to clock in or out through your restaurant's approved attendance process.",
      },
      {
        target: '[data-tour="mobile-profile-performance"]',
        title: "Your performance",
        text: "Review your verified work, attendance, score, and ranking for the selected period.",
      },
      {
        target: '[data-tour="mobile-profile-account-settings"]',
        title: "Account settings",
        text: "Update personal details, password, and restaurant access from here.",
      },
    ],
    "/manage": manageTools,
  };

  return mobileTabs.flatMap((item) => [
    {
      target: mobileNavigationTourSelector(item.href),
      title: item.title,
      text: copy[item.href] || `Use this tab to open ${item.title}.`,
      href: item.href,
    },
    ...(detailSteps[item.href] || []),
  ]);
}

function discoverTourSteps(): TourStep[] {
  const steps: TourStep[] = [];
  const seen = new Set<string>();

  const pushNode = (el: HTMLElement) => {
    const key = el.getAttribute("data-tour");
    if (!key || seen.has(key) || !isVisible(el)) return;
    seen.add(key);
    const copy = copyFor(key, el);
    steps.push({
      target: `[data-tour="${key}"]`,
      title: copy.title,
      text: copy.text,
    });
  };

  const navbar = document.querySelector<HTMLElement>('[data-tour="navbar"]');
  if (navbar) {
    const navNodes = leafTourNodes(
      Array.from(navbar.querySelectorAll<HTMLElement>("[data-tour^='navbar-']"))
    );
    navNodes.sort((a, b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      return ar.left - br.left || ar.top - br.top;
    });
    navNodes.forEach(pushNode);
  }

  const sidebars = Array.from(
    document.querySelectorAll<HTMLElement>('[data-tour="sidebar"]'),
  );
  sidebars.forEach((sidebar) => {
    const sideNodes = leafTourNodes(
      Array.from(
        sidebar.querySelectorAll<HTMLElement>(
          "[data-tour='sidebar-brand'], [data-tour='sidebar-search'], [data-tour='sidebar-collapse'], [data-tour='sidebar-outlet'], [data-tour^='nav-'], [data-tour='sidebar-account']"
        )
      )
    );
    sideNodes.sort((a, b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      return ar.top - br.top || ar.left - br.left;
    });
    sideNodes.forEach(pushNode);
  });

  return steps;
}

function targetExists(selector: string) {
  if (typeof document === "undefined") return false;
  const el = document.querySelector(selector);
  return el instanceof HTMLElement && isVisible(el);
}

function nextAvailableIndex(steps: TourStep[], from: number, direction: 1 | -1) {
  let i = from;
  while (i >= 0 && i < steps.length) {
    if (targetExists(steps[i].target)) return i;
    i += direction;
  }
  return -1;
}

export function ProductTour({ open, steps: staticSteps, onClose }: ProductTourProps) {
  const setCollapsed = useSidebar((s) => s.setCollapsed);
  const sidebarItems = useSidebarItems();
  const router = useRouter();
  const pathname = usePathname();
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [index, setIndex] = useState(0);
  const [isNarrowLayout, setIsNarrowLayout] = useState(false);
  const [layoutKnown, setLayoutKnown] = useState(false);
  const [pendingRouteIndex, setPendingRouteIndex] = useState<number | null>(null);
  const onCloseRef = useRef(onClose);
  const staticStepsRef = useRef(staticSteps);
  const startedRef = useRef(false);
  const positionTimerRef = useRef<number | null>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    staticStepsRef.current = staticSteps;
  }, [staticSteps]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)");
    const syncLayout = () => {
      setIsNarrowLayout(media.matches);
      setLayoutKnown(true);
    };
    syncLayout();
    media.addEventListener("change", syncLayout);
    return () => media.removeEventListener("change", syncLayout);
  }, []);

  useEffect(() => {
    if (pendingRouteIndex === null) return;
    const pendingStep = steps[pendingRouteIndex];
    if (!pendingStep || pendingStep.href !== pathname) return;
    const timer = window.setTimeout(() => {
      setIndex(pendingRouteIndex);
      setPendingRouteIndex(null);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [pathname, pendingRouteIndex, steps]);

  const clearHighlight = useCallback(() => {
    document.querySelectorAll(".tour-highlight").forEach((el) => {
      el.classList.remove("tour-highlight");
    });
  }, []);

  const positionTooltip = useCallback((target: Element, tooltip: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    const margin = 18;
    const tooltipWidth = Math.min(340, window.innerWidth - 32);
    const tooltipHeight = tooltip.offsetHeight || 220;
    const isLeftRail = rect.left < window.innerWidth * 0.35 && rect.right < window.innerWidth * 0.45;
    const isTopBar = rect.top < 96;

    let left: number;
    let top: number;

    if (isLeftRail) {
      left = Math.min(rect.right + margin, window.innerWidth - tooltipWidth - 16);
      top = Math.min(
        Math.max(16, rect.top + rect.height / 2 - tooltipHeight / 2),
        window.innerHeight - tooltipHeight - 16
      );
    } else if (isTopBar) {
      left = Math.min(Math.max(16, rect.left), window.innerWidth - tooltipWidth - 16);
      top = Math.min(rect.bottom + margin, window.innerHeight - tooltipHeight - 16);
    } else {
      left = Math.min(Math.max(16, rect.left), window.innerWidth - tooltipWidth - 16);
      top = rect.bottom + margin;
      if (top + tooltipHeight > window.innerHeight) {
        top = Math.max(16, rect.top - tooltipHeight - margin);
      }
    }

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.style.width = `${tooltipWidth}px`;
  }, []);

  const showStep = useCallback(
    (stepIndex: number, stepList: TourStep[]) => {
      const step = stepList[stepIndex];
      if (!step) return;
      clearHighlight();
      const target = document.querySelector(step.target);
      const tooltip = document.getElementById("product-tour-tooltip");
      if (!target || !tooltip) return;
      if (positionTimerRef.current !== null) {
        window.clearTimeout(positionTimerRef.current);
      }
      tooltip.style.visibility = "hidden";
      target.classList.add("tour-highlight");
      target.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
      positionTimerRef.current = window.setTimeout(() => {
        positionTooltip(target, tooltip);
        tooltip.style.visibility = "visible";
        positionTimerRef.current = null;
      }, 200);
    },
    [clearHighlight, positionTooltip]
  );

  // Start / stop tour once per open cycle — do not re-run on parent re-renders.
  useEffect(() => {
    if (!open) {
      if (positionTimerRef.current !== null) {
        window.clearTimeout(positionTimerRef.current);
        positionTimerRef.current = null;
      }
      startedRef.current = false;
      clearHighlight();
      setSteps([]);
      setIndex(0);
      setPendingRouteIndex(null);
      window.dispatchEvent(new CustomEvent("yummy-product-tour", { detail: { active: false } }));
      return;
    }

    if (startedRef.current || !layoutKnown) return;
    startedRef.current = true;

    if (!isNarrowLayout) setCollapsed(false);
    window.dispatchEvent(new CustomEvent("yummy-product-tour", { detail: { active: true } }));

    const timer = window.setTimeout(() => {
      const discovered = staticStepsRef.current?.length
        ? staticStepsRef.current
        : isNarrowLayout
          ? mobileTourSteps(sidebarItems)
          : discoverTourSteps();
      const isMobileTour = !staticStepsRef.current?.length && isNarrowLayout;
      // A tour can be started from a secondary mobile page, where the bottom
      // navigation is intentionally hidden. Route to its first real tab
      // before checking for a visible target.
      const first = isMobileTour ? 0 : nextAvailableIndex(discovered, 0, 1);
      if (first === -1 || discovered.length === 0) {
        startedRef.current = false;
        onCloseRef.current();
        return;
      }
      setSteps(discovered);
      const firstStep = discovered[first];
      if (firstStep?.href && firstStep.href !== pathname) {
        setPendingRouteIndex(first);
        router.push(firstStep.href);
      } else {
        setIndex(first);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [clearHighlight, isNarrowLayout, layoutKnown, open, pathname, router, setCollapsed, sidebarItems]);

  // Highlight current step only when index/steps change.
  useEffect(() => {
    if (!open || !steps.length || pendingRouteIndex !== null) return;
    if (!targetExists(steps[index]?.target ?? "")) {
      const next = nextAvailableIndex(steps, index + 1, 1);
      if (next === -1) {
        clearHighlight();
        onCloseRef.current();
        return;
      }
      if (next !== index) setIndex(next);
      return;
    }
    showStep(index, steps);
  }, [clearHighlight, index, open, pendingRouteIndex, showStep, steps]);

  useEffect(
    () => () => {
      if (positionTimerRef.current !== null) {
        window.clearTimeout(positionTimerRef.current);
      }
      clearHighlight();
    },
    [clearHighlight],
  );

  if (!open || steps.length === 0) return null;

  if (pendingRouteIndex !== null) {
    return <div className="fixed inset-0 z-[1000] bg-slate-950/70 backdrop-blur-[1px]" />;
  }

  const step = steps[index];
  if (!step) return null;

  const moveTo = (nextIndex: number) => {
    const nextStep = steps[nextIndex];
    if (nextStep?.href && nextStep.href !== pathname) {
      clearHighlight();
      setPendingRouteIndex(nextIndex);
      router.push(nextStep.href);
      return;
    }
    setIndex(nextIndex);
  };

  const goNext = () => {
    const next = nextAvailableIndex(steps, index + 1, 1);
    if (next === -1) {
      clearHighlight();
      onCloseRef.current();
      return;
    }
    moveTo(next);
  };

  const goBack = () => {
    const prev = nextAvailableIndex(steps, index - 1, -1);
    if (prev === -1) return;
    moveTo(prev);
  };

  const finish = () => {
    clearHighlight();
    onCloseRef.current();
  };

  const isLast = nextAvailableIndex(steps, index + 1, 1) === -1;
  // Mobile steps intentionally span several pages. Do not recalculate the
  // counter from the controls mounted on the current page, otherwise a
  // complete 11-step journey can incorrectly read as "6 of 6" on Manage.
  const stepNumber = index + 1;
  const stepCount = steps.length;

  return (
    <>
      <div className="fixed inset-0 z-[1000] bg-slate-950/70 backdrop-blur-[1px]" />
      <div
        id="product-tour-tooltip"
        style={{ visibility: "hidden" }}
        className={cn(
          "fixed z-[1003] rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-2xl",
          "animate-in fade-in zoom-in-95 duration-200"
        )}
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary">
          Step {stepNumber} of {stepCount}
        </p>
        <h4 className="mt-2 text-lg font-bold tracking-tight">{step.title}</h4>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={finish}
            className="text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            Skip tour
          </button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              className={cn(stepNumber <= 1 && "invisible")}
              onClick={goBack}
            >
              Back
            </Button>
            <Button type="button" onClick={goNext}>
              {isLast ? "Finish" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

/** Kept for callers that still pass static steps; discovery is preferred. */
export const DASHBOARD_TOUR_STEPS: TourStep[] = [];
