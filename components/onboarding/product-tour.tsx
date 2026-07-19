"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/hooks/use-sidebar";

export type TourStep = {
  target: string;
  title: string;
  text: string;
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
    title: "Premium",
    text: "View billing, trial status, and upgrade options.",
  },
  "navbar-notifications": {
    title: "Notifications",
    text: "Order alerts and important updates show up here.",
  },
  "navbar-help": {
    title: "Help",
    text: "Open help for the product tour, onboarding, and useful links.",
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
    text: "Open this section for items, categories, and modifiers.",
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
    text: "Staff, attendance, and payroll.",
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
    title: "Modifiers",
    text: "Add-ons and options customers can choose.",
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
    text: "Staff, attendance, and payroll hub.",
  },
  "nav-staff": {
    title: "Staff",
    text: "Employees, roles, and access.",
  },
  "nav-attendance": {
    title: "Attendance",
    text: "QR check-in and attendance devices.",
  },
  "nav-payroll": {
    title: "Payroll",
    text: "Salary runs and staff payments.",
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
    title: "Premium",
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

  const sidebar = document.querySelector<HTMLElement>('[data-tour="sidebar"]');
  if (sidebar) {
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
  }

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
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [index, setIndex] = useState(0);
  const onCloseRef = useRef(onClose);
  const staticStepsRef = useRef(staticSteps);
  const startedRef = useRef(false);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    staticStepsRef.current = staticSteps;
  }, [staticSteps]);

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
      target.classList.add("tour-highlight");
      target.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
      window.setTimeout(() => positionTooltip(target, tooltip), 200);
    },
    [clearHighlight, positionTooltip]
  );

  // Start / stop tour once per open cycle — do not re-run on parent re-renders.
  useEffect(() => {
    if (!open) {
      startedRef.current = false;
      clearHighlight();
      setSteps([]);
      setIndex(0);
      window.dispatchEvent(new CustomEvent("yummy-product-tour", { detail: { active: false } }));
      return;
    }

    if (startedRef.current) return;
    startedRef.current = true;

    setCollapsed(false);
    window.dispatchEvent(new CustomEvent("yummy-product-tour", { detail: { active: true } }));

    const timer = window.setTimeout(() => {
      const discovered =
        staticStepsRef.current?.length ? staticStepsRef.current : discoverTourSteps();
      const first = nextAvailableIndex(discovered, 0, 1);
      if (first === -1 || discovered.length === 0) {
        startedRef.current = false;
        onCloseRef.current();
        return;
      }
      setSteps(discovered);
      setIndex(first);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [clearHighlight, open, setCollapsed]);

  // Highlight current step only when index/steps change.
  useEffect(() => {
    if (!open || !steps.length) return;
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
  }, [clearHighlight, index, open, showStep, steps]);

  useEffect(() => () => clearHighlight(), [clearHighlight]);

  if (!open || steps.length === 0) return null;

  const step = steps[index];
  if (!step) return null;

  const goNext = () => {
    const next = nextAvailableIndex(steps, index + 1, 1);
    if (next === -1) {
      clearHighlight();
      onCloseRef.current();
      return;
    }
    setIndex(next);
  };

  const goBack = () => {
    const prev = nextAvailableIndex(steps, index - 1, -1);
    if (prev === -1) return;
    setIndex(prev);
  };

  const finish = () => {
    clearHighlight();
    onCloseRef.current();
  };

  const isLast = nextAvailableIndex(steps, index + 1, 1) === -1;
  const visibleCount = steps.filter((s) => targetExists(s.target)).length;
  const visibleIndex =
    steps.slice(0, index + 1).filter((s) => targetExists(s.target)).length || 1;

  return (
    <>
      <div className="fixed inset-0 z-[1000] bg-slate-950/70 backdrop-blur-[1px]" />
      <div
        id="product-tour-tooltip"
        className={cn(
          "fixed z-[1003] rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-2xl",
          "animate-in fade-in zoom-in-95 duration-200"
        )}
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary">
          Step {visibleIndex} of {visibleCount || steps.length}
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
              className={cn(visibleIndex <= 1 && "invisible")}
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
